import {
  cloudConfigured,
  supabase,
} from './supabase'

import {
  migrateLocalDataToSupabase,
} from './migrateToSupabase'

const PENDING_KEY =
  'jimrami-cloud-sync-pending'

const LAST_SYNC_KEY =
  'jimrami-cloud-sync-last'

const DELETE_QUEUE_KEY =
  'jimrami-cloud-delete-queue'

export type CloudTableName =
  | 'players'
  | 'sessions'
  | 'session_players'
  | 'rounds'
  | 'round_results'
  | 'jim_results'
  | 'penalty_results'

type CloudDeletion = {
  table: CloudTableName
  id: string
}

const DELETE_ORDER:
  CloudTableName[] = [
    /*
      Child tables first so foreign-key
      relationships never block a parent
      deletion.
    */
    'round_results',
    'jim_results',
    'penalty_results',
    'rounds',
    'session_players',
    'sessions',
    'players',
  ]

let syncTimer:
  number | undefined

let syncRunning = false
let syncAgain = false

function notifyStatusChanged() {
  window.dispatchEvent(
    new Event(
      'jimrami-cloud-sync-status'
    )
  )
}

function readDeleteQueue():
  CloudDeletion[] {
  const raw =
    localStorage.getItem(
      DELETE_QUEUE_KEY
    )

  if (!raw) {
    return []
  }

  try {
    const parsed =
      JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (
        value
      ): value is CloudDeletion => {
        if (
          typeof value !== 'object' ||
          value === null
        ) {
          return false
        }

        const candidate =
          value as Partial<CloudDeletion>

        return (
          typeof candidate.table ===
            'string' &&
          DELETE_ORDER.includes(
            candidate.table as
              CloudTableName
          ) &&
          typeof candidate.id ===
            'string' &&
          candidate.id.length > 0
        )
      }
    )
  } catch {
    return []
  }
}

function writeDeleteQueue(
  queue: CloudDeletion[]
) {
  if (queue.length === 0) {
    localStorage.removeItem(
      DELETE_QUEUE_KEY
    )
  } else {
    localStorage.setItem(
      DELETE_QUEUE_KEY,
      JSON.stringify(queue)
    )
  }

  notifyStatusChanged()
}

export function getLastCloudSync() {
  return (
    localStorage.getItem(
      LAST_SYNC_KEY
    ) ?? null
  )
}

export function hasPendingCloudSync() {
  return (
    localStorage.getItem(
      PENDING_KEY
    ) === '1'
  )
}

export function getPendingDeletionCount() {
  return readDeleteQueue().length
}

export function queueCloudDeletion(
  table: CloudTableName,
  id: string
) {
  const queue =
    readDeleteQueue()

  const alreadyQueued =
    queue.some(
      (entry) =>
        entry.table === table &&
        entry.id === id
    )

  if (!alreadyQueued) {
    queue.push({
      table,
      id,
    })

    writeDeleteQueue(
      queue
    )
  }
}

async function flushCloudDeletions() {
  if (!supabase) {
    return
  }

  let queue =
    readDeleteQueue()

  if (queue.length === 0) {
    return
  }

  for (
    const table of DELETE_ORDER
  ) {
    const ids =
      [
        ...new Set(
          queue
            .filter(
              (entry) =>
                entry.table ===
                table
            )
            .map(
              (entry) =>
                entry.id
            )
        ),
      ]

    if (ids.length === 0) {
      continue
    }

    const {
      error,
    } =
      await supabase
        .from(table)
        .delete()
        .in(
          'id',
          ids
        )

    if (error) {
      throw new Error(
        `${table} delete: ${error.message}`
      )
    }

    /*
      Remove only deletions that have
      successfully reached Supabase.

      If a later table fails, the
      remaining queue survives for a
      future retry.
    */
    queue =
      queue.filter(
        (entry) =>
          !(
            entry.table ===
              table &&
            ids.includes(
              entry.id
            )
          )
      )

    writeDeleteQueue(
      queue
    )

    console.log(
      `✓ Cloud deleted ${ids.length} from ${table}`
    )
  }
}

export async function runCloudSync() {
  if (
    !cloudConfigured ||
    !supabase
  ) {
    return false
  }

  if (syncRunning) {
    syncAgain = true
    return false
  }

  const {
    data,
  } =
    await supabase.auth
      .getSession()

  if (!data.session) {
    return false
  }

  syncRunning = true

  try {
    /*
      Delete stale cloud rows first,
      then upload the current local
      database state.
    */
    await flushCloudDeletions()

    await migrateLocalDataToSupabase()

    localStorage.removeItem(
      PENDING_KEY
    )

    localStorage.setItem(
      LAST_SYNC_KEY,
      new Date().toISOString()
    )

    notifyStatusChanged()

    return true
  } catch (error) {
    /*
      Cloud failure must never stop
      local JIMRAMI gameplay.

      Keep a small persistent flag so
      we can retry when connectivity
      returns.
    */
    localStorage.setItem(
      PENDING_KEY,
      '1'
    )

    notifyStatusChanged()

    console.warn(
      'JIMRAMI cloud sync pending:',
      error
    )

    return false
  } finally {
    syncRunning = false

    if (syncAgain) {
      syncAgain = false

      scheduleCloudSync(250)
    }
  }
}

export function scheduleCloudSync(
  delay = 1500
) {
  if (
    !cloudConfigured ||
    !supabase
  ) {
    return
  }

  /*
    Mark it pending immediately.

    If the browser closes before the
    upload runs, the flag survives and
    the next app launch can retry.
  */
  localStorage.setItem(
    PENDING_KEY,
    '1'
  )

  notifyStatusChanged()

  if (
    syncTimer !== undefined
  ) {
    window.clearTimeout(
      syncTimer
    )
  }

  syncTimer =
    window.setTimeout(
      () => {
        syncTimer = undefined

        void runCloudSync()
      },
      delay
    )
}

export function installCloudSyncRetry() {
  if (
    !cloudConfigured ||
    !supabase
  ) {
    return
  }

  window.addEventListener(
    'online',
    () => {
      if (
        hasPendingCloudSync() ||
        getPendingDeletionCount() >
          0
      ) {
        scheduleCloudSync(250)
      }
    }
  )

  /*
    If a previous upload failed,
    a deletion is waiting, or the
    browser closed before sync ran,
    retry shortly after startup.
  */
  if (
    hasPendingCloudSync() ||
    getPendingDeletionCount() > 0
  ) {
    scheduleCloudSync(1000)
  }
}
