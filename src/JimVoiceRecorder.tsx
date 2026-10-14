import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Player } from './db'
import { deleteJimVoice, getJimVoiceStorageMode, getJimVoiceUrl, getJimVoiceWaveform, saveJimVoice, type JimVoiceStorageMode } from './lib/jimVoice'

type Props = { player: Player; onReady?: (ready: boolean) => void }

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Replaces the browser's white, platform-dependent audio controls.
function VoicePlayback({ src, label }: { src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)
  const [waveform, setWaveform] = useState<number[]>([])

  useEffect(() => {
    let active = true
    setPlaying(false)
    setPosition(0)
    setDuration(0)
    setError(false)
    setWaveform([])
    void getJimVoiceWaveform(src, 45).then(values => {
      if (active) setWaveform(values)
    })
    return () => {
      active = false
      audioRef.current?.pause()
    }
  }, [src])

  async function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) { audio.pause(); return }
    // A saved voice and a new draft should never play over one another.
    document.querySelectorAll<HTMLAudioElement>('audio[data-jim-voice-player]')
      .forEach(other => { if (other !== audio) other.pause() })
    try {
      setError(false)
      await audio.play()
    } catch {
      setError(true)
      setPlaying(false)
    }
  }

  const progress = duration > 0 ? Math.min(100, position / duration * 100) : 0

  return (
    <div className="jimVoicePlayback">
      <span className="jimVoiceClipLabel">{label}</span>
      <div className="jimVoicePlayer">
        <audio
          data-jim-voice-player
          ref={audioRef}
          src={src}
          preload="metadata"
          onLoadedMetadata={event => {
            const length = event.currentTarget.duration
            if (Number.isFinite(length)) setDuration(length)
          }}
          onDurationChange={event => {
            const length = event.currentTarget.duration
            if (Number.isFinite(length)) setDuration(length)
          }}
          onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setPosition(0) }}
          onError={() => { setError(true); setPlaying(false) }}
        />
        <button
          type="button"
          className="jimVoicePlayButton"
          onClick={toggle}
          aria-label={`${playing ? 'Pause' : 'Play'} ${label.toLowerCase()}`}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
              <path d="M8 4.5a1 1 0 0 1 1.5-.86l11 7.5a1 1 0 0 1 0 1.72l-11 7.5A1 1 0 0 1 8 19.5z" />
            </svg>
          )}
        </button>
        <div className="jimVoiceWaveArea">
          <div className="jimVoiceWave" aria-hidden="true">
            {(waveform.length ? waveform : Array.from({ length: 45 }, () => 0.32)).map((value, index, bars) => {
              const height = 18 + value * 82
              const filled = bars.length <= 1 ? progress > 0 : (index / (bars.length - 1)) * 100 <= progress
              return <span key={index} style={{ height: `${height}%` }} className={filled ? 'played' : undefined} />
            })}
          </div>
          <input
            className="jimVoiceSeek"
            type="range"
            min={0}
            max={duration > 0 ? duration : 1}
            step={0.01}
            value={Math.min(position, duration > 0 ? duration : 1)}
            disabled={duration <= 0}
            aria-label={`Seek ${label.toLowerCase()}`}
            onChange={event => {
              const time = Number(event.target.value)
              if (audioRef.current && Number.isFinite(time)) {
                audioRef.current.currentTime = time
                setPosition(time)
              }
            }}
          />
        </div>
        <span className="jimVoiceClock" aria-label="Audio time">
          {formatTime(position)} / {duration > 0 ? formatTime(duration) : '--:--'}
        </span>
      </div>
      {error && <span className="jimVoicePlaybackError" role="status">Could not play this recording. Try refreshing or recording it again.</span>}
    </div>
  )
}

export default function JimVoiceRecorder({ player, onReady }: Props) {
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const [storageMode, setStorageMode] = useState<JimVoiceStorageMode | null>(null)
  const [recording, setRecording] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const draft = useRef<Blob | null>(null)
  const timeout = useRef<number | null>(null)
  const previewRef = useRef<string | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let mounted = true
    setSavedUrl(null)
    setMessage('')
    setStorageMode(null)
    void Promise.all([getJimVoiceStorageMode(), getJimVoiceUrl(player)])
      .then(([mode, url]) => {
        if (mounted) {
          setStorageMode(mode)
          setSavedUrl(url)
          onReady?.(true)
        }
      })
      .catch(err => {
        if (mounted) {
          setMessage(String(err.message || err))
          onReady?.(true)
        }
      })
    return () => { mounted = false }
  }, [player.id, player.cloudId, onReady])

  useEffect(() => () => {
    if (timeout.current !== null) window.clearTimeout(timeout.current)
    if (recorder.current?.state === 'recording') recorder.current.stop()
    stream.current?.getTracks().forEach(track => track.stop())
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
  }, [])

  useEffect(() => {
    if (!confirmDelete) return
    cancelDeleteRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        event.stopPropagation()
        setConfirmDelete(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [confirmDelete, busy])

  function setPreview(url: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setPreviewUrl(url)
  }

  async function begin() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessage('Microphone recording is unavailable. Check permissions and use HTTPS or a supported Android WebView.')
      return
    }
    try {
      setMessage('')
      document.querySelectorAll<HTMLAudioElement>('audio[data-jim-voice-player]')
        .forEach(audio => audio.pause())
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = mic
      const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
      const format = candidates.find(type => MediaRecorder.isTypeSupported(type))
      const media = new MediaRecorder(mic, format ? { mimeType: format } : undefined)
      recorder.current = media
      chunks.current = []
      media.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data) }
      media.onstop = () => {
        mic.getTracks().forEach(track => track.stop())
        stream.current = null
        const blob = new Blob(chunks.current, { type: media.mimeType || 'audio/webm' })
        if (blob.size) {
          draft.current = blob
          setPreview(URL.createObjectURL(blob))
        }
        setRecording(false)
        if (timeout.current !== null) window.clearTimeout(timeout.current)
      }
      media.start()
      setRecording(true)
      timeout.current = window.setTimeout(() => media.state === 'recording' && media.stop(), 5000)
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Microphone access failed.') }
  }

  function stop() { if (recorder.current?.state === 'recording') recorder.current.stop() }

  async function save() {
    if (!draft.current) return
    setBusy(true)
    try {
      await saveJimVoice(player, draft.current)
      setSavedUrl(await getJimVoiceUrl(player))
      draft.current = null
      setPreview(null)
      const mode = await getJimVoiceStorageMode()
      setStorageMode(mode)
      setMessage(mode === 'local' ? 'JIM voice saved on this device.' : 'JIM voice saved to Supabase!')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Upload failed. Your previous voice is still saved.') }
    finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteJimVoice(player)
      setSavedUrl(null)
      setConfirmDelete(false)
      setMessage('Saved JIM voice deleted.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Delete failed.') }
    finally { setBusy(false) }
  }

  return <section className="jimVoiceEditor">
    <strong>PERSONAL JIM VOICE</strong>
    <p>Record a JIIIIIM! shout (up to 5 seconds).</p>
    {savedUrl && <VoicePlayback key={`saved-${savedUrl}`} src={savedUrl} label="Saved voice" />}
    {previewUrl && <VoicePlayback key={`draft-${previewUrl}`} src={previewUrl} label="New recording preview" />}
    <div className="jimVoiceButtons">
      <button type="button" disabled={busy} onClick={recording ? stop : begin}>{recording ? '■ Stop recording' : savedUrl ? '🎙 Re-record' : '🎙 Record JIM'}</button>
      {previewUrl && <button type="button" disabled={busy || recording} onClick={save}>{busy ? 'Saving...' : 'Save voice'}</button>}
      {savedUrl && <button type="button" disabled={busy || recording} onClick={() => setConfirmDelete(true)}>Delete voice</button>}
    </div>
    {recording && (
      <p className="jimVoiceRecordingStatus" aria-live="polite">
        <span className="jimVoiceRecordingDot" aria-hidden="true" />
        <span>Recording… shout JIM! Automatically stops after 5 seconds.</span>
      </p>
    )}
    {message && <p role="status">{message}</p>}
    {storageMode === 'local' ? (
      <div className="playerEditorNote" role="note">
        Local-only voice: saved on this device, not included in data backups.
        It won't transfer to another device, and clearing app data may erase it.
      </div>
    ) : storageMode === 'cloud' ? (
      <div className="playerEditorNote" role="note">
        Saved to Supabase for this account. Voice recordings are not included in JSON backups.
      </div>
    ) : null}

    {confirmDelete && createPortal(
      <div className="jimVoiceConfirmBackdrop" onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) setConfirmDelete(false)
      }}>
        <div className="jimVoiceConfirmDialog" role="alertdialog" aria-modal="true" aria-labelledby="jim-voice-delete-title" aria-describedby="jim-voice-delete-description">
          <span className="jimVoiceConfirmEyebrow">DELETE RECORDING</span>
          <h3 id="jim-voice-delete-title">Delete JIM voice?</h3>
          <p id="jim-voice-delete-description">Remove the saved JIM shout for <strong>{player.name}</strong>? This cannot be undone. Their game history will not change.</p>
          <div className="jimVoiceConfirmActions">
            <button ref={cancelDeleteRef} type="button" className="jimVoiceKeepButton" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button type="button" className="jimVoiceDeleteButton" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete voice'}</button>
          </div>
        </div>
      </div>, document.body
    )}
  </section>
}
