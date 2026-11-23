const MAX_JSON_BYTES = 6 * 1024 * 1024
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
const LANGUAGES = {
  en: 'English',
  hi: 'Hindi',
  kn: 'Kannada',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  bn: 'Bengali',
  mr: 'Marathi',
  pa: 'Punjabi',
}
const RESPONSE_LANGUAGES = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  kn: 'Kannada (ಕನ್ನಡ)',
  ta: 'Tamil (தமிழ்)',
  te: 'Telugu (తెలుగు)',
  ml: 'Malayalam (മലയാളം)',
  bn: 'Bengali (বাংলা)',
  mr: 'Marathi (मराठी)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
}
const RESULT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    crop: { type: 'STRING' },
    status: { type: 'STRING', enum: ['healthy', 'possibly_diseased', 'unclear'] },
    disease_name: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
    symptoms_seen: { type: 'ARRAY', items: { type: 'STRING' } },
    simple_advice: { type: 'ARRAY', items: { type: 'STRING' } },
    when_to_call_expert: { type: 'STRING' },
  },
  required: ['crop', 'status', 'disease_name', 'confidence', 'symptoms_seen', 'simple_advice', 'when_to_call_expert'],
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

function getClientKey(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown-client'
}

async function allowed(binding, key) {
  const result = await binding.limit({ key })
  return result.success
}

async function readJson(request) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > MAX_JSON_BYTES) throw Object.assign(new Error('Request is too large.'), { status: 413 })

  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > MAX_JSON_BYTES) throw Object.assign(new Error('Request is too large.'), { status: 413 })
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw Object.assign(new Error('A valid JSON request is required.'), { status: 400 })
  }
}

function decodeBase64(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function isBase64(value) {
  return typeof value === 'string' && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
}

function bytesStartWith(bytes, signature) {
  return signature.every((byte, index) => bytes[index] === byte)
}

function ascii(bytes, start, end) {
  return String.fromCharCode(...bytes.subarray(start, end))
}

function hasAudioSignature(bytes, mimeType) {
  if (mimeType === 'audio/webm') return bytesStartWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])
  if (mimeType === 'audio/mp4') return ascii(bytes, 4, 8) === 'ftyp'
  if (mimeType === 'audio/ogg') return ascii(bytes, 0, 4) === 'OggS'
  if (mimeType === 'audio/wav') return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WAVE'
  if (mimeType === 'audio/mpeg') return ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  return bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0
}

function hasImageSignature(bytes, mimeType) {
  if (mimeType === 'image/jpeg') return bytesStartWith(bytes, [0xff, 0xd8, 0xff])
  if (mimeType === 'image/png') return bytesStartWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10])
  return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP'
}

function parseGeminiText(payload) {
  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || ''
}

async function callGemini(env, apiKey, body, timeoutMs = 20_000) {
  const model = env.GEMINI_MODEL || DEFAULT_MODEL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { response, data: await response.json().catch(() => ({})) }
}

async function handleTranscription(request, env) {
  if (!(await allowed(env.TRANSCRIBE_LIMITER, getClientKey(request)))) {
    return json({ error: 'Speech transcription limit reached. Please wait and try again.' }, 429, { 'Retry-After': '60' })
  }
  if (!env.GEMINI_API_KEY) return json({ error: 'Speech transcription is not configured.' }, 503)

  const body = await readJson(request)
  const { audio, mimeType } = body || {}
  const interfaceLanguage = LANGUAGES[body?.language] || 'English'
  const allowedTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/aac']
  if (typeof audio !== 'string' || audio.length > 3_500_000 || !allowedTypes.includes(mimeType) || !isBase64(audio)) {
    return json({ error: 'A supported audio recording is required.' }, 400)
  }

  const audioBytes = decodeBase64(audio)
  if (!audioBytes.length || audioBytes.length > 2_500_000 || !hasAudioSignature(audioBytes, mimeType)) {
    return json({ error: 'The recording is empty, too large, or not a supported audio file.' }, 400)
  }

  try {
    const { response, data } = await callGemini(env, env.GEMINI_API_KEY, {
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: audio } },
          { text: `Transcribe only the crop name clearly spoken in this short audio. The interface language is ${interfaceLanguage}, but the speaker may use any language. Return the words exactly as heard, in the language and script spoken. Do not translate, infer a crop, add explanations, or guess missing words. If no clear crop name is spoken, return an empty response.` },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 80 },
    })
    if (!response.ok) {
      if (response.status === 429) return json({ error: 'Speech transcription limit reached. Please wait and try again.' }, 429)
      if ([401, 403].includes(response.status)) return json({ error: 'Speech transcription service rejected its API key.' }, 502)
      console.error('Crop speech transcription failed:', response.status, data.error?.message || 'No details returned')
      return json({ error: 'Speech transcription service could not process this recording.' }, 502)
    }
    return json({ transcript: parseGeminiText(data).slice(0, 80) })
  } catch (error) {
    console.error('Crop speech transcription failed:', error.message)
    return json({ error: 'Speech transcription service is unavailable.' }, 502)
  }
}

async function handleLeafAnalysis(request, env) {
  if (!(await allowed(env.ANALYZE_LIMITER, getClientKey(request)))) {
    return json({ error: 'Please wait before analyzing another leaf photo.' }, 429, { 'Retry-After': '60' })
  }
  if (!env.GEMINI_API_KEY) return json({ error: 'Gemini is not configured. Add the GEMINI_API_KEY secret in Cloudflare.' }, 503)

  const body = await readJson(request)
  const { image, mimeType, language = 'en' } = body || {}
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (typeof image !== 'string' || image.length > 5_500_000 || !allowedTypes.includes(mimeType) || !isBase64(image)) {
    return json({ error: 'Choose a JPEG, PNG, or WebP leaf photo smaller than 4 MB.' }, 400)
  }
  const imageBytes = decodeBase64(image)
  if (imageBytes.length > 4 * 1024 * 1024 || !hasImageSignature(imageBytes, mimeType)) {
    return json({ error: 'Choose a valid JPEG, PNG, or WebP image smaller than 4 MB.' }, 400)
  }

  try {
    const { response, data } = await callGemini(env, env.GEMINI_API_KEY, {
      systemInstruction: {
        parts: [{
          text: `You are a cautious plant health assistant for Indian farmers. Respond entirely in ${RESPONSE_LANGUAGES[language] || 'English'}, using its native script, including crop and disease names, symptoms, advice, and the expert note. Use simple language. Never claim certainty. If the photo does not clearly show a crop leaf, set status to unclear. Confidence must be a number from 0 to 1. Give practical, safe first steps. Do not recommend pesticides or chemical doses.`,
        }],
      },
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: image } },
          { text: 'Give a careful first check of this crop leaf.' },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: RESULT_SCHEMA, maxOutputTokens: 900, temperature: 0.2 },
    })
    if (!response.ok) {
      console.error('Gemini request failed:', response.status, data.error?.message || 'No details returned')
      if (response.status === 429) return json({ error: 'The free-tier request limit was reached. Wait a while and try again.' }, 429)
      if ([401, 403].includes(response.status)) return json({ error: 'Gemini did not accept the key. Check the GEMINI_API_KEY secret in Cloudflare.' }, 502)
      return json({ error: 'Gemini could not check this photo. Please try again.' }, 502)
    }

    const answerText = parseGeminiText(data)
    if (!answerText) return json({ error: 'Gemini did not return a usable answer. Try a clearer leaf photo.' }, 502)
    const result = JSON.parse(answerText)
    const status = ['healthy', 'possibly_diseased', 'unclear'].includes(result.status) ? result.status : 'unclear'
    return json({
      crop: String(result.crop || ''),
      status,
      disease_name: String(result.disease_name || ''),
      confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0)),
      symptoms_seen: Array.isArray(result.symptoms_seen) ? result.symptoms_seen.map(String).slice(0, 8) : [],
      simple_advice: Array.isArray(result.simple_advice) ? result.simple_advice.map(String).slice(0, 8) : [],
      when_to_call_expert: String(result.when_to_call_expert || ''),
    })
  } catch (error) {
    console.error('Leaf photo analysis failed:', error.message)
    return json({ error: 'The photo check could not finish. Try again with a clear photo in daylight.' }, 502)
  }
}

async function handlePincode(request, pincode) {
  if (!/^\d{6}$/.test(pincode)) return json({ error: 'Enter a valid six-digit Indian PIN code.' }, 400)

  const sources = [
    {
      url: `https://api.pincodeapi.in/api/v1/pincode/${pincode}`,
      parse(payload) {
        if (payload?.success && Array.isArray(payload.data?.post_offices)) {
          return payload.data.post_offices.map((office) => ({
            name: office.office_name, district: office.district, state: office.state, block: '',
            branchType: office.office_type, deliveryStatus: office.delivery_status, latitude: office.latitude, longitude: office.longitude,
          }))
        }
        return null
      },
      notFound(payload) { return payload?.success === false && payload?.error?.status === 404 },
    },
    {
      url: `https://api.postalpincode.in/pincode/${pincode}`,
      parse(payload) {
        const record = Array.isArray(payload) ? payload[0] : null
        if (record?.Status === 'Success' && Array.isArray(record.PostOffice)) {
          return record.PostOffice.map((office) => ({
            name: office.Name, district: office.District, state: office.State, block: office.Block,
            branchType: office.BranchType, deliveryStatus: office.DeliveryStatus, latitude: null, longitude: null,
          }))
        }
        return null
      },
      notFound(payload) { return Array.isArray(payload) && payload[0]?.Status === 'Error' },
    },
  ]

  let foundNotFound = false
  for (const source of sources) {
    try {
      const upstream = await fetch(source.url, { signal: AbortSignal.timeout(7000) })
      if (upstream.status === 404) {
        foundNotFound = true
        continue
      }
      if (!upstream.ok) continue
      const payload = await upstream.json()
      const offices = source.parse(payload)
      if (offices?.length) {
        return json({
          pincode,
          offices: offices.map((office) => ({
            name: String(office.name || ''), district: String(office.district || ''), state: String(office.state || ''),
            block: String(office.block || ''), branchType: String(office.branchType || ''),
            deliveryStatus: String(office.deliveryStatus || ''),
            latitude: Number.isFinite(office.latitude) ? office.latitude : null,
            longitude: Number.isFinite(office.longitude) ? office.longitude : null,
          })),
        })
      }
      if (source.notFound(payload)) foundNotFound = true
    } catch (error) {
      console.warn('A PIN lookup source did not respond:', error.message)
    }
  }
  if (foundNotFound) return json({ error: 'That PIN code was not found. Check all six digits and try again.' }, 404)
  return json({ error: 'Both PIN lookup services are temporarily unavailable. Please try again shortly.' }, 502)
}

async function handleApi(request, env, url) {
  const ip = getClientKey(request)
  if (!(await allowed(env.API_LIMITER, ip))) return json({ error: 'Too many requests. Please wait and try again.' }, 429, { 'Retry-After': '60' })

  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin')
    const headers = origin === url.origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {}
    return new Response(null, { status: 204, headers })
  }
  if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true, service: 'CropSense API' })

  if (request.method === 'GET' && url.pathname === '/api/reverse-geocode') {
    const latitude = Number(url.searchParams.get('latitude'))
    const longitude = Number(url.searchParams.get('longitude'))
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return json({ error: 'Valid coordinates are required.' }, 400)
    }
    const language = Object.hasOwn(LANGUAGES, url.searchParams.get('language')) ? url.searchParams.get('language') : 'en'
    if (!(await allowed(env.LOOKUP_LIMITER, ip))) return json({ error: 'Too many location lookups. Please wait and try again.' }, 429, { 'Retry-After': '60' })
    const id = env.GEO_LOOKUP.idFromName('cropsense-global-geocode')
    const stub = env.GEO_LOOKUP.get(id)
    const target = new URL('https://geocode.internal/reverse')
    target.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), language }).toString()
    return stub.fetch(new Request(target, { method: 'GET' }))
  }

  const pincodeMatch = url.pathname.match(/^\/api\/pincode\/([^/]+)$/)
  if (request.method === 'GET' && pincodeMatch) {
    if (!(await allowed(env.LOOKUP_LIMITER, ip))) return json({ error: 'Too many lookups. Please wait and try again.' }, 429, { 'Retry-After': '60' })
    return handlePincode(request, decodeURIComponent(pincodeMatch[1]))
  }
  if (request.method === 'POST' && url.pathname === '/api/transcribe-crop') return handleTranscription(request, env)
  if (request.method === 'POST' && url.pathname === '/api/analyze-leaf') return handleLeafAnalysis(request, env)
  return json({ error: 'API endpoint not found.' }, 404)
}

function parseRange(header, size) {
  if (!header) return { start: 0, end: size - 1, partial: false }
  const match = header.match(/^bytes=(\d*)-(\d*)$/)
  if (!match || (!match[1] && !match[2])) return null
  let start
  let end
  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!suffixLength) return null
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : size - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return null
    end = Math.min(end, size - 1)
  }
  return { start, end, partial: true }
}

function createVideoStream(env, requestUrl, manifest, start, length) {
  let partIndex = Math.floor(start / manifest.chunkSize)
  let localSkip = start % manifest.chunkSize
  let remaining = length
  let partRemaining = Math.min(manifest.size - partIndex * manifest.chunkSize, manifest.chunkSize) - localSkip
  let reader = null

  return new ReadableStream({
    async pull(controller) {
      try {
        if (remaining <= 0) {
          controller.close()
          return
        }
        while (true) {
          if (!reader) {
            const partPath = manifest.parts[partIndex]
            if (typeof partPath !== 'string' || !partPath.startsWith('/__video_parts/')) throw new Error('Invalid video segment manifest.')
            const partUrl = new URL(partPath, requestUrl)
            const partResponse = await env.ASSETS.fetch(new Request(partUrl))
            if (!partResponse.ok || !partResponse.body) throw new Error('Video segment unavailable.')
            reader = partResponse.body.getReader()
          }

          const result = await reader.read()
          if (result.done) {
            reader.releaseLock()
            reader = null
            partIndex += 1
            localSkip = 0
            if (partIndex >= manifest.parts.length && remaining > 0) throw new Error('Video segment ended unexpectedly.')
            partRemaining = Math.min(manifest.size - partIndex * manifest.chunkSize, manifest.chunkSize)
            continue
          }

          let from = 0
          if (localSkip) {
            const skipped = Math.min(localSkip, result.value.byteLength)
            localSkip -= skipped
            from += skipped
          }
          if (from >= result.value.byteLength) continue

          const count = Math.min(result.value.byteLength - from, remaining, partRemaining)
          if (count > 0) {
            controller.enqueue(result.value.subarray(from, from + count))
            remaining -= count
            partRemaining -= count
          }

          if (partRemaining === 0) {
            await reader.cancel()
            reader.releaseLock()
            reader = null
            partIndex += 1
            localSkip = 0
            partRemaining = Math.min(manifest.size - partIndex * manifest.chunkSize, manifest.chunkSize)
          }
          if (remaining === 0) controller.close()
          return
        }
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel() {
      if (reader) await reader.cancel()
    },
  })
}

async function handleLargeVideo(request, env, url) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed.', { status: 405, headers: { Allow: 'GET, HEAD' } })
  const name = url.pathname.endsWith('/weather.mp4') ? 'weather' : 'yield'
  const manifestUrl = new URL(`/__video_parts/${name}.json`, url)
  const manifestResponse = await env.ASSETS.fetch(new Request(manifestUrl))
  if (!manifestResponse.ok) return new Response('Video not found.', { status: 404 })
  const manifest = await manifestResponse.json()
  if (!Number.isSafeInteger(manifest.size) || !Number.isSafeInteger(manifest.chunkSize) || !Array.isArray(manifest.parts) || !manifest.parts.length) {
    return new Response('Video manifest is invalid.', { status: 500 })
  }

  const range = parseRange(request.headers.get('range'), manifest.size)
  if (!range) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${manifest.size}`, 'Accept-Ranges': 'bytes' } })
  const length = range.end - range.start + 1
  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(length),
    'Cache-Control': 'public, max-age=86400',
  })
  if (range.partial) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${manifest.size}`)
  return new Response(request.method === 'HEAD' ? null : createVideoStream(env, url, manifest, range.start, length), {
    status: range.partial ? 206 : 200,
    headers,
  })
}

function addSecurityHeaders(response, request) {
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=(self)')
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  if (new URL(request.url).protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
  const origin = request.headers.get('origin')
  if (origin && origin === new URL(request.url).origin) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.append('Vary', 'Origin')
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    try {
      let response
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        response = await handleApi(request, env, url)
      } else if (url.pathname === '/videos/features/weather.mp4' || url.pathname === '/videos/features/yield.mp4') {
        response = await handleLargeVideo(request, env, url)
      } else {
        response = await env.ASSETS.fetch(request)
      }
      return addSecurityHeaders(response, request)
    } catch (error) {
      console.error('CropSense request failed:', error.message)
      const status = Number(error.status) || 500
      return addSecurityHeaders(json({ error: status === 413 ? 'Request is too large.' : 'The request could not be completed.' }, status), request)
    }
  },
}

export class GeoLookup {
  constructor(_state, _env) {
    this.cache = new Map()
    this.nextRequestAt = 0
    this.queue = Promise.resolve()
  }

  fetch(request) {
    const url = new URL(request.url)
    const job = this.queue.then(() => this.reverse(url))
    this.queue = job.catch(() => {})
    return job
  }

  async reverse(url) {
    const latitude = Number(url.searchParams.get('latitude'))
    const longitude = Number(url.searchParams.get('longitude'))
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return json({ error: 'Valid coordinates are required.' }, 400)
    }
    const language = Object.hasOwn(LANGUAGES, url.searchParams.get('language')) ? url.searchParams.get('language') : 'en'
    const cacheKey = `v3:${latitude.toFixed(3)}:${longitude.toFixed(3)}:${language}`
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return json(cached.value)

    try {
      const waitMs = Math.max(0, this.nextRequestAt - Date.now())
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs))
      this.nextRequestAt = Date.now() + 1000

      const upstreamUrl = new URL('https://nominatim.openstreetmap.org/reverse')
      upstreamUrl.search = new URLSearchParams({ format: 'jsonv2', lat: String(latitude), lon: String(longitude), zoom: '10', addressdetails: '1' }).toString()
      const upstream = await fetch(upstreamUrl, {
        headers: { 'User-Agent': 'CropSense/1.0 (location display)', 'Accept-Language': language },
        signal: AbortSignal.timeout(7000),
      })
      if (!upstream.ok) throw new Error('Reverse geocoding unavailable')
      const data = await upstream.json()
      const address = data.address || {}
      const validLocality = (value) => typeof value === 'string' && value.trim() && !/(?:^|\s)(?:north|south|east|west)$/i.test(value.trim())
      const localityName = [address.city, address.town, address.village, address.municipality, address.hamlet, address.locality, address.suburb, address.neighbourhood, address.quarter].find(validLocality)
      const placeTypes = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'quarter', 'locality', 'municipality', 'isolated_dwelling'])
      const resultName = placeTypes.has(data.addresstype) && validLocality(data.name) ? data.name.trim() : ''
      const broaderName = [address.city_district, address.state_district, address.district, address.county].find(validLocality)
      const name = localityName || resultName || broaderName
      if (!name) throw new Error('A nearby locality is not available in the map data.')
      const region = [address.state, address.country].filter(Boolean).filter((item, index, all) => all.indexOf(item) === index).join(', ')
      const value = { name, region }
      this.cache.set(cacheKey, { value, expiresAt: Date.now() + 24 * 60 * 60 * 1000 })
      if (this.cache.size > 5000) this.cache.delete(this.cache.keys().next().value)
      return json(value)
    } catch {
      return json({ error: 'Could not resolve your location name.' }, 502)
    }
  }
}
