import {
  requireSupabase,
} from './supabase'

const LOCAL_REVISION_KEY =
  'jimrami-cloud-revision'

export function getLocalCloudRevision() {
  const raw =
    localStorage.getItem(
      LOCAL_REVISION_KEY
    )

  if (raw === null) {
    return null
  }

  const value =
    Number(raw)

  return Number.isFinite(value)
    ? value
    : null
}

export function setLocalCloudRevision(
  revision: number
) {
  localStorage.setItem(
    LOCAL_REVISION_KEY,
    String(revision)
  )

  window.dispatchEvent(
    new Event(
      'jimrami-cloud-sync-status'
    )
  )
}

async function getUserId() {
  const supabase =
    requireSupabase()

  const {
    data,
    error,
  } =
    await supabase.auth.getUser()

  if (
    error ||
    !data.user
  ) {
    throw new Error(
      'You must be signed into Supabase.'
    )
  }

  return data.user.id
}

export async function getOrCreateCloudRevision() {
  const supabase =
    requireSupabase()

  const userId =
    await getUserId()

  const {
    data: existing,
    error: readError,
  } =
    await supabase
      .from('sync_state')
      .select('revision')
      .eq(
        'owner_id',
        userId
      )
      .maybeSingle()

  if (readError) {
    throw new Error(
      `sync_state read: ${readError.message}`
    )
  }

  if (existing) {
    return Number(
      existing.revision
    )
  }

  const {
    data: created,
    error: createError,
  } =
    await supabase
      .from('sync_state')
      .insert({
        owner_id:
          userId,
        revision: 0,
      })
      .select('revision')
      .single()

  if (createError) {
    /*
      Another tab/device may have
      created the row between the read
      and insert. Read it once more.
    */
    const {
      data: retry,
      error: retryError,
    } =
      await supabase
        .from('sync_state')
        .select('revision')
        .eq(
          'owner_id',
          userId
        )
        .single()

    if (retryError) {
      throw new Error(
        `sync_state create: ${createError.message}`
      )
    }

    return Number(
      retry.revision
    )
  }

  return Number(
    created.revision
  )
}

export async function advanceCloudRevision(
  expectedRevision: number
) {
  const supabase =
    requireSupabase()

  const userId =
    await getUserId()

  const nextRevision =
    expectedRevision + 1

  const {
    data,
    error,
  } =
    await supabase
      .from('sync_state')
      .update({
        revision:
          nextRevision,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'owner_id',
        userId
      )
      .eq(
        'revision',
        expectedRevision
      )
      .select('revision')
      .maybeSingle()

  if (error) {
    throw new Error(
      `sync_state update: ${error.message}`
    )
  }

  if (!data) {
    throw new Error(
      'Cloud revision changed on another device. Sync stopped to protect newer cloud data.'
    )
  }

  return Number(
    data.revision
  )
}
