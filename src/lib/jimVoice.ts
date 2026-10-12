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
