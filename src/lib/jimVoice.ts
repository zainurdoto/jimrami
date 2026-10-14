import { db, type Player } from '../db'
import { supabase } from './supabase'

export const JIM_VOICE_BUCKET = 'jim-voices'
export type JimVoiceStorageMode = 'local' | 'cloud'

// Object URLs are local to this running browser tab. The Blobs themselves
// persist in Dexie/IndexedDB and remain available after restarting the app.
const localVoiceUrls = new Map<string, string>()

function localPlayerKey(player: Player) {
  // cloudId is a permanent *player identity*, even in local-only mode.
  // Using it avoids confusing voices if a different JSON backup reuses a
  // numeric Dexie player ID.
  return `local:${player.cloudId || `legacy-player-${player.id}`}`
}

function revokeLocalUrl(key: string) {
  const previous = localVoiceUrls.get(key)
  if (previous) {
    URL.revokeObjectURL(previous)
    localVoiceUrls.delete(key)
  }
}

// Not having a Supabase project, or not being signed in, means local-only.
// A configured deployment can therefore record locally before cloud login.
async function voiceContext(): Promise<
  | { mode: 'local' }
  | { mode: 'cloud'; userId: string }
> {
  if (!supabase) return { mode: 'local' }
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session?.user?.id) return { mode: 'local' }
  return { mode: 'cloud', userId: data.session.user.id }
}

export async function getJimVoiceStorageMode(): Promise<JimVoiceStorageMode> {
  const context = await voiceContext()
  return context.mode
}

function cloudPlayerPath(player: Player, userId: string) {
  if (!player.cloudId) {
    throw new Error('This player needs a cloud ID. Sync game data first.')
  }
  return `${userId}/${player.cloudId}/jim-voice`
}

export async function getJimVoiceUrl(player: Player): Promise<string | null> {
  const context = await voiceContext()

  if (context.mode === 'local') {
    const key = localPlayerKey(player)
    const cached = localVoiceUrls.get(key)
    if (cached) return cached
    const recording = await db.jimVoices.get(key)
    if (!recording?.audio?.size) return null
    const url = URL.createObjectURL(recording.audio)
    localVoiceUrls.set(key, url)
    return url
  }

  const { data, error } = await supabase!.storage.from(JIM_VOICE_BUCKET)
    .createSignedUrl(cloudPlayerPath(player, context.userId), 3600)
  if (error) {
    if (/not found|does not exist|object not found/i.test(error.message)) return null
    throw error
  }
  return data.signedUrl
}

export async function saveJimVoice(player: Player, blob: Blob): Promise<void> {
  if (blob.size > 2 * 1024 * 1024) {
    throw new Error('Recording exceeds 2 MB. Try a shorter shout.')
  }
  const context = await voiceContext()
  if (context.mode === 'local') {
    const key = localPlayerKey(player)
    await db.jimVoices.put({ id: key, audio: blob, updatedAt: new Date() })
    revokeLocalUrl(key)
    return
  }

  const { error } = await supabase!.storage.from(JIM_VOICE_BUCKET)
    .upload(cloudPlayerPath(player, context.userId), blob, {
      contentType: (blob.type || 'audio/webm').split(';')[0],
      upsert: true,
      cacheControl: '0',
    })
  if (error) throw error
}

export async function deleteJimVoice(player: Player): Promise<void> {
  const context = await voiceContext()
  if (context.mode === 'local') {
    const key = localPlayerKey(player)
    await db.jimVoices.delete(key)
    revokeLocalUrl(key)
    return
  }

  const { error } = await supabase!.storage.from(JIM_VOICE_BUCKET)
    .remove([cloudPlayerPath(player, context.userId)])
  if (error) throw error
}


const waveformCache = new Map<string, Promise<number[]>>()
let waveformAudioContext: AudioContext | null = null

function getWaveformAudioContext() {
  if (waveformAudioContext) return waveformAudioContext
  const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return null
  waveformAudioContext = new AudioContextCtor()
  return waveformAudioContext
}

function buildWaveformBars(channelData: Float32Array, barCount: number) {
  if (!channelData.length || barCount <= 0) return []
  const bars: number[] = []
  const samplesPerBar = Math.max(1, Math.floor(channelData.length / barCount))
  for (let index = 0; index < barCount; index += 1) {
    const start = index * samplesPerBar
    const end = index === barCount - 1 ? channelData.length : Math.min(channelData.length, start + samplesPerBar)
    let peak = 0
    for (let sample = start; sample < end; sample += 1) {
      const amplitude = Math.abs(channelData[sample] || 0)
      if (amplitude > peak) peak = amplitude
    }
    bars.push(peak)
  }

  const smoothed = bars.map((value, index) => {
    const previous = bars[index - 1] ?? value
    const next = bars[index + 1] ?? value
    return (previous + value + next) / 3
  })
  const max = Math.max(...smoothed, 0)
  if (max <= 0) return Array.from({ length: barCount }, () => 0.32)

  return smoothed.map(value => {
    const normalized = Math.pow(value / max, 0.72)
    return Math.max(0.16, Math.min(1, normalized))
  })
}

export async function getJimVoiceWaveform(src: string, barCount = 45): Promise<number[]> {
  if (!src || barCount <= 0 || typeof window === 'undefined' || typeof fetch === 'undefined') {
    return []
  }
  const key = `${barCount}:${src}`
  const cached = waveformCache.get(key)
  if (cached) return cached

  const task = (async () => {
    try {
      const response = await fetch(src)
      if (!response.ok) throw new Error(`Waveform fetch failed: ${response.status}`)
      const arrayBuffer = await response.arrayBuffer()
      const audioContext = getWaveformAudioContext()
      if (!audioContext) return []
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))
      const channelData = decoded.numberOfChannels > 1
        ? (() => {
            const left = decoded.getChannelData(0)
            const right = decoded.getChannelData(1)
            const mixed = new Float32Array(Math.min(left.length, right.length))
            for (let i = 0; i < mixed.length; i += 1) mixed[i] = (left[i] + right[i]) / 2
            return mixed
          })()
        : decoded.getChannelData(0)
      return buildWaveformBars(channelData, barCount)
    } catch {
      return []
    }
  })()

  waveformCache.set(key, task)
  return task
}
