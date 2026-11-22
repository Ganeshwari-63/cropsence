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

const recordingLimitMs = 2 * 60 * 1000
const audioLimitBytes = 2.5 * 1024 * 1024

function getRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  return [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ].find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const separator = dataUrl.indexOf(',')
      if (separator < 0) reject(new Error('Audio could not be read.'))
      else resolve(dataUrl.slice(separator + 1))
    }
    reader.onerror = () => reject(new Error('Audio could not be read.'))
    reader.readAsDataURL(blob)
  })
}

export default function CropNameInput({ id, language, value, onChange }) {
  const text = cropInputText[language] || cropInputText.en
  const speechErrors = cropSpeechErrorText[language] || cropSpeechErrorText.en
  const [recording, setRecording] = useState(false)
  const [requestingPermission, setRequestingPermission] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [message, setMessage] = useState('')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timeoutRef = useRef(null)
  const recordingRef = useRef(false)
  const requestingRef = useRef(false)
  const transcribingRef = useRef(false)
  const discardRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      recordingRef.current = false
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      const recorder = recorderRef.current
      if (recorder) {
        recorder.onstop = null
        recorder.onerror = null
        try {
          if (recorder.state !== 'inactive') recorder.stop()
        } catch { /* The recorder may already have ended. */ }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function stopRecording() {
    if (!recordingRef.current) return
    recordingRef.current = false
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  function discardRecording(errorMessage) {
    discardRef.current = true
    recordingRef.current = false
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    const recorder = recorderRef.current
    recorderRef.current = null
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop()
    } catch { /* The recorder may already have ended. */ }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (mountedRef.current) {
      setRecording(false)
      setMessage(errorMessage)
    }
  }

  async function transcribe(blob, mimeType) {
    if (!mountedRef.current) return
    setTranscribing(true)
    transcribingRef.current = true
    setMessage(text.transcribing)

    try {
      if (blob.size > audioLimitBytes) throw new Error('Recording is too large.')
      if (!blob.size) {
        setMessage(text.noSpeech)
        return
      }

      const audio = await blobToBase64(blob)
      const response = await fetch('/api/transcribe-crop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio, mimeType, language }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Transcription failed.')

      const transcript = typeof result.transcript === 'string' ? result.transcript.trim() : ''
      if (!transcript) {
        setMessage(text.noSpeech)
        return
      }

      onChange(transcript.slice(0, 80))
      setMessage(text.done)
    } catch {
      setMessage(text.error)
    } finally {
      transcribingRef.current = false
      if (mountedRef.current) setTranscribing(false)
    }
  }

  async function toggleRecording() {
    if (recordingRef.current) {
      stopRecording()
      return
    }
    if (requestingRef.current || transcribingRef.current) return

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessage(text.unavailable)
      return
    }

    requestingRef.current = true
    setRequestingPermission(true)
    setMessage(text.permissionWait)
    let stream

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const preferredMimeType = getRecordingMimeType()
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      discardRef.current = false
      streamRef.current = stream
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => discardRecording(text.error)
      recorder.onstop = () => {
        if (recorderRef.current === recorder) recorderRef.current = null
        const recordedChunks = chunksRef.current
        chunksRef.current = []
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        if (discardRef.current || !mountedRef.current) return

        const actualMimeType = (recorder.mimeType || preferredMimeType || 'audio/webm').split(';')[0]
        const blob = new Blob(recordedChunks, { type: actualMimeType })
        void transcribe(blob, actualMimeType)
      }

      recorder.start(250)
      recordingRef.current = true
      setRecording(true)
      setMessage(text.listening)
      timeoutRef.current = window.setTimeout(stopRecording, recordingLimitMs)
    } catch (error) {
      recordingRef.current = false
      recorderRef.current = null
      streamRef.current = null
      stream?.getTracks().forEach((track) => track.stop())
      if (mountedRef.current) setRecording(false)
      const errorMessage = error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
        ? speechErrors.permission
        : error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError'
          ? speechErrors.microphone
          : text.error
      setMessage(errorMessage)
    } finally {
      requestingRef.current = false
      if (mountedRef.current) setRequestingPermission(false)
    }
  }

  const isBusy = requestingPermission || transcribing

  return (
    <div className="crop-name-input">
      <label htmlFor={id}>{text.name}</label>
      <div className="crop-name-input-row">
        <input
          id={id}
          type="text"
          lang={speechLocales[language] || 'en-IN'}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            if (message) setMessage('')
          }}
          placeholder={text.placeholder}
          autoComplete="off"
          maxLength={80}
        />
        <button
          className={recording ? 'crop-mic-button is-recording' : 'crop-mic-button'}
          type="button"
          onClick={toggleRecording}
          disabled={isBusy || requestingPermission}
          aria-label={recording ? text.stop : text.speak}
          aria-pressed={recording}
          title={recording ? text.stop : text.speak}
        >
          {transcribing ? (
            <span className="crop-mic-spinner" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
              <path d="M19 11a7 7 0 0 1-14 0M12 18v4m-4 0h8" />
            </svg>
          )}
        </button>
      </div>
      {(message || recording || isBusy) && (
        <small className="crop-speech-status" role="status" aria-live="polite">
          {message || (requestingPermission ? text.permissionWait : text.transcribing)}
        </small>
      )}
      <small className="crop-audio-notice">{text.audioNotice}</small>
    </div>
  )
}
