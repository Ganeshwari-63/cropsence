import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from './locales/LanguageContext.jsx'
import { featureText, photoPreviewText } from './locales/featureText.js'

function makeSmallJpeg(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const imageUrl = URL.createObjectURL(file)

    image.onload = () => {
      const maxSide = 1024
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')

      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)

      const context = canvas.getContext('2d')

      if (!context) {
        URL.revokeObjectURL(imageUrl)
        reject(new Error('photo_prepare'))
        return
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(imageUrl)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('photo_resize'))
            return
          }

          const reader = new FileReader()

          reader.onloadend = () => {
            const dataUrl = reader.result

            if (typeof dataUrl !== 'string') {
              reject(new Error('photo_read'))
              return
            }

            resolve(dataUrl.split(',')[1])
          }

          reader.onerror = () => {
            reject(new Error('photo_read'))
          }

          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        0.82
      )
    }

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      reject(new Error('photo_open'))
    }

    image.src = imageUrl
  })
}

export default function DiseasePage() {
  const { language } = useLanguage()
  const t = featureText[language] || featureText.en
  const [file, setFile] = useState(null)
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : '', [file])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function choosePhoto(event) {
    const chosenFile = event.target.files?.[0]

    if (!chosenFile) return

    if (!chosenFile.type.startsWith('image/')) {
      setError(t.photoType)
      setFile(null)
      return
    }

    if (chosenFile.size > 15 * 1024 * 1024) {
      setError(t.photoSize)
      setFile(null)
      return
    }

    setError('')
    setResult(null)
    setFile(chosenFile)
  }

  async function analyzePhoto() {
    if (!file) {
      setError(t.photoFirst)
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const image = await makeSmallJpeg(file)

      const response = await fetch('/api/analyze-leaf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image,
          mimeType: 'image/jpeg',
          language,
        }),
      })

      const responseData = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(t.serviceError)
      }

      setResult(responseData)
    } catch {
      setError(
          t.photoError
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="disease-page">
      <section className="disease-heading">
        <p className="section-label">{t.diseaseTitle}</p>
        <h1>{t.diseaseTitle}</h1>
        <p>{t.diseaseIntro}</p>
      </section>

      <section className="photo-card">
        <div className="photo-buttons">
          <label className="secondary-button" htmlFor="leaf-camera">
            {t.takePhoto}
          </label>

          <input
            className="hidden-file-input"
            id="leaf-camera"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={choosePhoto}
          />

          <label className="secondary-button" htmlFor="leaf-upload">
            {t.choosePhoto}
          </label>

          <input
            className="hidden-file-input"
            id="leaf-upload"
            type="file"
            accept="image/*"
            onChange={choosePhoto}
          />
        </div>

        {previewUrl && (
          <img
            className="leaf-photo-preview"
            src={previewUrl}
            alt={photoPreviewText[language] || photoPreviewText.en}
          />
        )}

        {file && <p className="selected-file-name">{file.name}</p>}

        <button
          className="primary-button"
          type="button"
          onClick={analyzePhoto}
          disabled={!file || loading}
        >
          {loading ? t.analyzing : t.analyze}
        </button>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {result && (
          <section
            className={`analysis-result ${result.status || 'unclear'}`}
            aria-live="polite"
          >
            <p className="section-label">{t.firstResult}</p>
            <h2>{result.disease_name || t.noDisease}</h2>
            <p>
              {t.crop}: {result.crop || t.notIdentified} · {t.status}:{' '}
              {t[result.status || 'unclear'] || t.unclear}
            </p>

            {typeof result.confidence === 'number' && (
              <p>
                {t.confidence}: {Math.round(result.confidence * 100)}%
              </p>
            )}

            {result.symptoms_seen?.length > 0 && (
              <>
                <h3>{t.noticed}</h3>
                <ul>
                  {result.symptoms_seen.map((symptom) => (
                    <li key={symptom}>{symptom}</li>
                  ))}
                </ul>
              </>
            )}

            {result.simple_advice?.length > 0 && (
              <>
                <h3>{t.nextSteps}</h3>
                <ul>
                  {result.simple_advice.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </>
            )}

            <p>{result.when_to_call_expert || t.expert}</p>
          </section>
        )}

        <p className="disease-notice">
          {t.notice}
        </p>
      </section>
    </main>
  )
}
