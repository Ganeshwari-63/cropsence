import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const clientDistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../client/dist'
)
const clientIndexPath = path.join(clientDistPath, 'index.html')

const app = express()
const port = Number(process.env.PORT || 8787)

app.disable('x-powered-by')
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0)
if (Number.isInteger(proxyHops) && proxyHops >= 0) app.set('trust proxy', proxyHops)

app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()')
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  if (process.env.NODE_ENV === 'production') {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    )
  }
  next()
})

const allowedOrigins = new Set(
  (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
)

app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.has(origin))
    },
    credentials: false,
  })
)

const rateBuckets = new Map()
function rateLimit({ scope, limit, windowMs }) {
  return (request, response, next) => {
    const now = Date.now()
    const address = request.ip || request.socket.remoteAddress || 'unknown'
    const key = `${scope}:${address}`
    const times = (rateBuckets.get(key) || []).filter((time) => now - time < windowMs)
    if (times.length >= limit) {
      response.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)))
      return response.status(429).json({ error: 'Too many requests. Please wait and try again.' })
    }
    times.push(now)
    rateBuckets.set(key, times)
    if (rateBuckets.size > 10000) {
      for (const [address, entries] of rateBuckets) {
        if (entries.every((time) => now - time >= windowMs)) rateBuckets.delete(address)
      }
    }
    next()
  }
}

app.use('/api', rateLimit({ scope: 'api', limit: 120, windowMs: 60_000 }))
app.use(express.json({ limit: '6mb' }))
app.use('/api/reverse-geocode', rateLimit({ scope: 'reverse-geocode', limit: 30, windowMs: 60_000 }))
app.use('/api/pincode', rateLimit({ scope: 'pincode', limit: 30, windowMs: 60_000 }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'CropSense API' })
})

app.get('/api/reverse-geocode', async (request, response) => {
  const latitude = Number(request.query.latitude)
  const longitude = Number(request.query.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return response.status(400).json({ error: 'Valid coordinates are required.' })
  }
  const language = ['en','hi','kn','ta','te','ml','bn','mr','pa'].includes(request.query.language) ? request.query.language : 'en'
  const cacheKey = `${latitude.toFixed(3)}:${longitude.toFixed(3)}:${language}`
  const cached = reverseGeocodeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return response.json(cached.value)
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.search = new URLSearchParams({ format: 'jsonv2', lat: String(latitude), lon: String(longitude), zoom: '10', addressdetails: '1' }).toString()
    await queueNominatimRequest()
    const upstream = await fetch(url, { headers: { 'User-Agent': 'CropSense/1.0 (location display)', 'Accept-Language': language }, signal: AbortSignal.timeout(7000) })
    if (!upstream.ok) throw new Error('Reverse geocoding unavailable')
    const data = await upstream.json()
    const address = data.address || {}
    const name = address.village || address.town || address.city || address.municipality || address.suburb || address.county || 'Current location'
    const region = [address.state_district || address.county, address.state, address.country].filter(Boolean).filter((item, index, all) => all.indexOf(item) === index).join(', ')
    const value = { name, region }
    reverseGeocodeCache.set(cacheKey, { value, expiresAt: Date.now() + 24 * 60 * 60 * 1000 })
    if (reverseGeocodeCache.size > 5000) reverseGeocodeCache.delete(reverseGeocodeCache.keys().next().value)
    return response.json(value)
  } catch {
    return response.status(502).json({ error: 'Could not resolve your location name.' })
  }
})

const reverseGeocodeCache = new Map()
let nextNominatimRequestAt = 0
async function queueNominatimRequest() {
  const now = Date.now()
  const waitMs = Math.max(0, nextNominatimRequestAt - now)
  nextNominatimRequestAt = Math.max(now, nextNominatimRequestAt) + 1000
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs))
}

app.get('/api/pincode/:code', async (request, response) => {
  const pincode = String(request.params.code || '').trim()

  if (!/^\d{6}$/.test(pincode)) {
    return response.status(400).json({
      error: 'Enter a valid six-digit Indian PIN code.',
    })
  }

  const sources = [
    {
      url: `https://api.pincodeapi.in/api/v1/pincode/${pincode}`,
      parse(payload) {
        if (payload?.success && Array.isArray(payload.data?.post_offices)) {
          return payload.data.post_offices.map((office) => ({
            name: office.office_name,
            district: office.district,
            state: office.state,
            block: '',
            branchType: office.office_type,
            deliveryStatus: office.delivery_status,
            latitude: office.latitude,
            longitude: office.longitude,
          }))
        }

        return null
      },
      isNotFound(payload) {
        return payload?.success === false && payload?.error?.status === 404
      },
    },
    {
      url: `https://api.postalpincode.in/pincode/${pincode}`,
      parse(payload) {
        const record = Array.isArray(payload) ? payload[0] : null

        if (record?.Status === 'Success' && Array.isArray(record.PostOffice)) {
          return record.PostOffice.map((office) => ({
            name: office.Name,
            district: office.District,
            state: office.State,
            block: office.Block,
            branchType: office.BranchType,
            deliveryStatus: office.DeliveryStatus,
            latitude: null,
            longitude: null,
          }))
        }

        return null
      },
      isNotFound(payload) {
        return Array.isArray(payload) && payload[0]?.Status === 'Error'
      },
    },
  ]

  let foundNotFoundResponse = false

  for (const source of sources) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 7000)

    try {
      const upstream = await fetch(source.url, { signal: controller.signal })

      if (upstream.status === 404) {
        foundNotFoundResponse = true
        continue
      }

      if (!upstream.ok) continue

      const payload = await upstream.json()
      const offices = source.parse(payload)

      if (offices?.length) {
        return response.json({
          pincode,
          offices: offices.map((office) => ({
            name: String(office.name || ''),
            district: String(office.district || ''),
            state: String(office.state || ''),
            block: String(office.block || ''),
            branchType: String(office.branchType || ''),
            deliveryStatus: String(office.deliveryStatus || ''),
            latitude: Number.isFinite(office.latitude) ? office.latitude : null,
            longitude: Number.isFinite(office.longitude) ? office.longitude : null,
          })),
        })
      }

      if (source.isNotFound(payload)) foundNotFoundResponse = true
    } catch (error) {
      console.warn('A PIN lookup source did not respond:', error.message)
    } finally {
      clearTimeout(timeout)
    }
  }

  if (foundNotFoundResponse) {
    return response.status(404).json({
      error: 'That PIN code was not found. Check all six digits and try again.',
    })
  }

  return response.status(502).json({
    error: 'Both PIN lookup services are temporarily unavailable. Please try again shortly.',
  })
})

const resultSchema = {
  type: 'OBJECT',
  properties: {
    crop: { type: 'STRING' },
    status: {
      type: 'STRING',
      enum: ['healthy', 'possibly_diseased', 'unclear'],
    },
    disease_name: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
    symptoms_seen: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    simple_advice: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    when_to_call_expert: { type: 'STRING' },
  },
  required: [
    'crop',
    'status',
    'disease_name',
    'confidence',
    'symptoms_seen',
    'simple_advice',
    'when_to_call_expert',
  ],
}

app.post('/api/analyze-leaf', rateLimit({ scope: 'analyze-leaf', limit: 8, windowMs: 60_000 }), async (request, response) => {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return response.status(503).json({
      error: 'Gemini is not configured. Check GEMINI_API_KEY in server/.env.',
    })
  }

  const { image, mimeType, language = 'en' } = request.body || {}
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

  if (
    typeof image !== 'string' ||
    image.length > 5_500_000 ||
    !allowedTypes.includes(mimeType) ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image)
  ) {
    return response.status(400).json({
      error: 'Choose a JPEG, PNG, or WebP leaf photo smaller than 4 MB.',
    })
  }

  const imageBytes = Buffer.from(image, 'base64')
  const validSignature = mimeType === 'image/jpeg'
    ? imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff
    : mimeType === 'image/png'
      ? imageBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : imageBytes.toString('ascii', 0, 4) === 'RIFF' && imageBytes.toString('ascii', 8, 12) === 'WEBP'
  if (imageBytes.length > 4 * 1024 * 1024 || !validSignature) {
    return response.status(400).json({ error: 'Choose a valid JPEG, PNG, or WebP image smaller than 4 MB.' })
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const apiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${model}:generateContent`

  try {
    const responseLanguages = { en: 'English', hi: 'Hindi (हिन्दी)', kn: 'Kannada (ಕನ್ನಡ)', ta: 'Tamil (தமிழ்)', te: 'Telugu (తెలుగు)', ml: 'Malayalam (മലയാളം)', bn: 'Bengali (বাংলা)', mr: 'Marathi (मराठी)', pa: 'Punjabi (ਪੰਜਾਬੀ)' }
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                `You are a cautious plant health assistant for Indian farmers. Respond entirely in ${responseLanguages[language] || 'English'}, using its native script, including crop and disease names, symptoms, advice, and the expert note. ` +
                'Use simple language. Never claim certainty. If the photo does ' +
                'not clearly show a crop leaf, set status to unclear. Confidence ' +
                'must be a number from 0 to 1. Give practical, safe first steps. ' +
                'Do not recommend pesticides or chemical doses.',
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: image,
                },
              },
              {
                text: 'Give a careful first check of this crop leaf.',
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: resultSchema,
          maxOutputTokens: 900,
          temperature: 0.2,
        },
      }),
    })

    const geminiData = await geminiResponse.json().catch(() => ({}))

    if (!geminiResponse.ok) {
      console.error(
        'Gemini request failed:',
        geminiResponse.status,
        geminiData.error?.message || 'No details returned'
      )

      if (geminiResponse.status === 429) {
        return response.status(429).json({
          error:
            'The free-tier request limit was reached. Wait a while and try again.',
        })
      }

      if ([401, 403].includes(geminiResponse.status)) {
        return response.status(502).json({
          error:
            'Gemini did not accept the key. Check GEMINI_API_KEY in server/.env.',
        })
      }

      return response.status(502).json({
        error: 'Gemini could not check this photo. Please try again.',
      })
    }

    const answerText =
      geminiData.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim() || ''

    if (!answerText) {
      return response.status(502).json({
        error:
          'Gemini did not return a usable answer. Try a clearer leaf photo.',
      })
    }

    const result = JSON.parse(answerText)
    const allowedStatuses = ['healthy', 'possibly_diseased', 'unclear']
    const status = allowedStatuses.includes(result.status)
      ? result.status
      : 'unclear'

    response.json({
      crop: String(result.crop || ''),
      status,
      disease_name: String(result.disease_name || ''),
      confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0)),
      symptoms_seen: Array.isArray(result.symptoms_seen)
        ? result.symptoms_seen.map(String).slice(0, 8)
        : [],
      simple_advice: Array.isArray(result.simple_advice)
        ? result.simple_advice.map(String).slice(0, 8)
        : [],
      when_to_call_expert: String(result.when_to_call_expert || ''),
    })
  } catch (error) {
    console.error('Leaf photo analysis failed:', error.message)

    response.status(502).json({
      error:
        'The photo check could not finish. Try again with a clear photo in daylight.',
    })
  }
})

if (existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath))
  app.use((request, response, next) => {
    if (
      request.method !== 'GET' ||
      request.path === '/api' ||
      request.path.startsWith('/api/')
    ) {
      return next()
    }

    response.sendFile(clientIndexPath, (error) => {
      if (error) next(error)
    })
  })
}

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API endpoint not found.' })
})

app.use((error, _request, response, _next) => {
  const status = Number(error.status) || 500
  response.status(status >= 400 && status < 600 ? status : 500).json({
    error: status === 413 ? 'Request is too large.' : 'The request could not be completed.',
  })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`CropSense server is running on port ${port}`)
})
