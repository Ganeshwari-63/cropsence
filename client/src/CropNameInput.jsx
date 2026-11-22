import { useEffect, useRef, useState } from 'react'
import { cropInputText } from './locales/cropInputText.js'

const speechLocales = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  pa: 'pa-IN',
}

export default function CropNameInput({ id, language, value, onChange }) {
  const text = cropInputText[language] || cropInputText.en
  const recognitionRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('')
  const SpeechRecognition = typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

  useEffect(() => () => recognitionRef.current?.abort(), [])

  function toggleSpeech() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    if (!SpeechRecognition) {
      setMessage(text.unavailable)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = speechLocales[language] || 'en-IN'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => {
      setListening(true)
      setMessage('')
    }
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim()
      if (transcript) onChange(transcript)
      setMessage('')
    }
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setMessage(text.error)
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
      if (recognitionRef.current === recognition) recognitionRef.current = null
    }
    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch {
      setListening(false)
      setMessage(text.error)
      recognitionRef.current = null
    }
  }

  return (
    <div className="crop-name-input">
      <label htmlFor={id}>{text.name}</label>
      <div className="crop-name-input-row">
        <input
          id={id}
          type="text"
          lang={speechLocales[language] || 'en-IN'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={text.placeholder}
          autoComplete="off"
          maxLength={80}
        />
        <button
          className="secondary-button crop-speech-button"
          type="button"
          onClick={toggleSpeech}
          aria-label={listening ? text.stop : text.speak}
          aria-pressed={listening}
        >
          {listening ? text.stop : text.speak}
        </button>
      </div>
      {(message || listening) && (
        <small className="crop-speech-status" role="status">
          {message || text.listening}
        </small>
      )}
    </div>
  )
}
