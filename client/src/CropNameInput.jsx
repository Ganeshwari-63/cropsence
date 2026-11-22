import { useEffect, useRef, useState } from 'react'
import { cropInputText, cropSpeechErrorText } from './locales/cropInputText.js'

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
  const speechErrors = cropSpeechErrorText[language] || cropSpeechErrorText.en
  const recognitionRef = useRef(null)
  const shouldListenRef = useRef(false)
  const restartTimerRef = useRef(null)
  const committedTextRef = useRef(value.trim())
  const baseTextRef = useRef(value.trim())
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('')
  const SpeechRecognition = typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

  useEffect(() => () => {
    shouldListenRef.current = false
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current)
    recognitionRef.current?.abort()
  }, [])

  function stopListening(nextMessage = '') {
    shouldListenRef.current = false
    setListening(false)
    setMessage(nextMessage)
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
    const recognition = recognitionRef.current
    recognitionRef.current = null
    try { recognition?.stop() } catch { /* Recognition may have already stopped. */ }
  }

  function startRecognition() {
    if (!shouldListenRef.current) return

    const recognition = new SpeechRecognition()
    recognition.lang = speechLocales[language] || 'en-IN'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    baseTextRef.current = committedTextRef.current || value.trim()

    recognition.onstart = () => {
      if (!shouldListenRef.current) return
      setListening(true)
      setMessage(text.listening)
    }
    recognition.onresult = (event) => {
      const finalSegments = []
      const interimSegments = []
      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript?.trim()
        if (!transcript) continue
        if (event.results[index].isFinal) finalSegments.push(transcript)
        else interimSegments.push(transcript)
      }

      const finalized = [baseTextRef.current, finalSegments.join(' ')].filter(Boolean).join(' ').trim()
      if (finalSegments.length) committedTextRef.current = finalized
      const currentText = [finalized, interimSegments.join(' ')].filter(Boolean).join(' ').trim()
      if (currentText) onChange(currentText)
    }
    recognition.onnomatch = () => {
      if (shouldListenRef.current) setMessage(text.listening)
    }
    recognition.onerror = (event) => {
      if (event.error === 'aborted') return
      if (event.error === 'no-speech') {
        // Some browsers end a silent listening session quickly. Keep waiting for speech.
        if (shouldListenRef.current) setMessage(text.listening)
        return
      }

      const nextMessage = event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? speechErrors.permission
        : event.error === 'audio-capture'
          ? speechErrors.microphone
          : text.error
      shouldListenRef.current = false
      setListening(false)
      setMessage(nextMessage)
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null
      if (!shouldListenRef.current) return

      // Speech services may disconnect after silence even when continuous mode is enabled.
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null
        if (shouldListenRef.current) startRecognition()
      }, 350)
    }
    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch {
      shouldListenRef.current = false
      setListening(false)
      setMessage(text.error)
      recognitionRef.current = null
    }
  }

  function toggleSpeech() {
    if (shouldListenRef.current) {
      stopListening()
      return
    }

    if (!SpeechRecognition) {
      setMessage(text.unavailable)
      return
    }

    committedTextRef.current = value.trim()
    baseTextRef.current = value.trim()
    shouldListenRef.current = true
    setListening(true)
    setMessage(text.listening)
    startRecognition()
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
