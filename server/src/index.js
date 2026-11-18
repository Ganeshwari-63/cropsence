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

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  })
)

app.use(express.json({ limit: '6mb' }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'CropSense API' })
})

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

// Allow up to 8 leaf checks per minute from each browser address.
const requestTimes = new Map()

function limitLeafRequests(request, response, next) {
  const now = Date.now()
  const address = request.ip || 'unknown'
  const recentTimes = (requestTimes.get(address) || []).filter(
    (time) => now - time < 60_000
  )

  if (recentTimes.length >= 8) {
    return response.status(429).json({
      error: 'Too many photo checks. Wait a minute, then try again.',
    })
  }

  recentTimes.push(now)
  requestTimes.set(address, recentTimes)
  next()
}

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

app.post('/api/analyze-leaf', limitLeafRequests, async (request, response) => {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return response.status(503).json({
      error: 'Gemini is not configured. Check GEMINI_API_KEY in server/.env.',
    })
  }

  const { image, mimeType } = request.body || {}
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

  if (
    typeof image !== 'string' ||
    image.length > 5_500_000 ||
    !allowedTypes.includes(mimeType)
  ) {
    return response.status(400).json({
      error: 'Choose a JPEG, PNG, or WebP leaf photo smaller than 4 MB.',
    })
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const apiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${model}:generateContent`

  try {
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
                'You are a cautious plant health assistant for Indian farmers. ' +
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
      crop: String(result.crop || 'Not identified'),
      status,
      disease_name: String(result.disease_name || 'Unclear'),
      confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0)),
      symptoms_seen: Array.isArray(result.symptoms_seen)
        ? result.symptoms_seen.map(String).slice(0, 8)
        : [],
      simple_advice: Array.isArray(result.simple_advice)
        ? result.simple_advice.map(String).slice(0, 8)
        : [],
      when_to_call_expert: String(
        result.when_to_call_expert ||
          'Contact a local agriculture expert if the plant continues to worsen.'
      ),
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
app.listen(port, '0.0.0.0', () => {
  console.log(`CropSense server is running on port ${port}`)
})
