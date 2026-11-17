import { useEffect, useState } from 'react'

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
        reject(new Error('Your browser could not prepare this photo.'))
        return
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(imageUrl)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Your browser could not resize this photo.'))
            return
          }

          const reader = new FileReader()

          reader.onloadend = () => {
            const dataUrl = reader.result

            if (typeof dataUrl !== 'string') {
              reject(new Error('Your browser could not read this photo.'))
              return
            }

            resolve(dataUrl.split(',')[1])
          }

          reader.onerror = () => {
            reject(new Error('Your browser could not read this photo.'))
          }

          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        0.82
      )
    }

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      reject(new Error('This photo could not be opened. Try another image.'))
    }

    image.src = imageUrl
  })
}

export default function DiseasePage() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  function choosePhoto(event) {
    const chosenFile = event.target.files?.[0]

    if (!chosenFile) return

    if (!chosenFile.type.startsWith('image/')) {
      setError('Please choose an image file.')
      setFile(null)
      return
    }

    if (chosenFile.size > 15 * 1024 * 1024) {
      setError('Please choose a photo smaller than 15 MB.')
      setFile(null)
      return
    }

    setError('')
    setResult(null)
    setFile(chosenFile)
  }

  async function analyzePhoto() {
    if (!file) {
      setError('Take or upload a leaf photo first.')
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
        }),
      })

      const responseData = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          responseData?.error ||
            'The leaf analysis service is not connected. We will set it up in the server steps.'
        )
      }

      setResult(responseData)
    } catch (requestError) {
      setError(
        requestError.message ||
          'The photo could not be checked. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="disease-page">
      <section className="disease-heading">
        <p className="section-label">LEAF PHOTO CHECK</p>
        <h1>Check a crop leaf</h1>
        <p>
          Use a clear photo in daylight. This is a first check, not a confirmed
          diagnosis.
        </p>
      </section>

      <section className="photo-card">
        <div className="photo-buttons">
          <label className="secondary-button" htmlFor="leaf-camera">
            Take a photo
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
            Choose a photo
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
            alt="Preview of the selected crop leaf photo"
          />
        )}

        {file && <p className="selected-file-name">{file.name}</p>}

        <button
          className="primary-button"
          type="button"
          onClick={analyzePhoto}
          disabled={!file || loading}
        >
          {loading ? 'Checking the photo…' : 'Analyze leaf photo'}
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
            <p className="section-label">FIRST CHECK RESULT</p>
            <h2>{result.disease_name || 'Leaf check'}</h2>
            <p>
              Crop: {result.crop || 'Not identified'} · Status:{' '}
              {(result.status || 'unclear').replaceAll('_', ' ')}
            </p>

            {typeof result.confidence === 'number' && (
              <p>
                Confidence: {Math.round(result.confidence * 100)}%
              </p>
            )}

            {result.symptoms_seen?.length > 0 && (
              <>
                <h3>What was noticed</h3>
                <ul>
                  {result.symptoms_seen.map((symptom) => (
                    <li key={symptom}>{symptom}</li>
                  ))}
                </ul>
              </>
            )}

            {result.simple_advice?.length > 0 && (
              <>
                <h3>Simple next steps</h3>
                <ul>
                  {result.simple_advice.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </>
            )}

            {result.when_to_call_expert && (
              <p>{result.when_to_call_expert}</p>
            )}
          </section>
        )}

        <p className="disease-notice">
          First check only. Confirm with an agriculture expert before treating
          your crop.
        </p>
      </section>
    </main>
  )
}