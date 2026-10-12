import { requireSupabase } from './supabase'
import type { Player } from '../db'

export const JIM_VOICE_BUCKET = 'jim-voices'

async function playerPath(player: Player): Promise<string> {
  if (!player.cloudId) throw new Error('This player needs a cloud ID. Run cloud backup/sync first.')
  const client = requireSupabase()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Sign in to Supabase in Data Tools first.')
  return `${data.user.id}/${player.cloudId}/jim-voice`
}

export async function getJimVoiceUrl(player: Player): Promise<string | null> {
  const client = requireSupabase()
  const path = await playerPath(player)
  const { data, error } = await client.storage.from(JIM_VOICE_BUCKET).createSignedUrl(path, 3600)
  if (error) {
    // Missing voice is normal for players who have not recorded one.
    if (/not found|does not exist|object not found/i.test(error.message)) return null
    throw error
  }
  return data.signedUrl
}

export async function saveJimVoice(player: Player, blob: Blob): Promise<void> {
  if (blob.size > 2 * 1024 * 1024) throw new Error('Recording exceeds 2 MB. Try a shorter shout.')
  const client = requireSupabase()
  const path = await playerPath(player)
  const { error } = await client.storage.from(JIM_VOICE_BUCKET).upload(path, blob, {
    contentType: (blob.type || 'audio/webm').split(';')[0],
    upsert: true,
    cacheControl: '0',
  })
  if (error) throw error
}

export async function deleteJimVoice(player: Player): Promise<void> {
  const client = requireSupabase()
  const path = await playerPath(player)
  const { error } = await client.storage.from(JIM_VOICE_BUCKET).remove([path])
  if (error) throw error
}
