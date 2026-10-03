import { db } from '../db'

import {
  cloudConfigured,
  supabase,
} from './supabase'

import {
  migrateLocalDataToSupabase,
} from './migrateToSupabase'

import {
  advanceCloudRevision,
  getLocalCloudRevision,
  getOrCreateCloudRevision,
  setLocalCloudRevision,
} from './cloudRevision'

import {
  pullCloudSnapshot,
} from './cloudPull'

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

async function localDatabaseIsEmpty() {
  const counts =
    await Promise.all([
      db.players.count(),
      db.sessions.count(),
      db.sessionPlayers.count(),
      db.rounds.count(),
      db.roundResults.count(),
      db.jimResults.count(),
      db.penaltyResults.count(),
    ])

  return (
    counts.reduce(
      (
        total,
        value
      ) =>
        total + value,
      0
    ) === 0
  )
}

export async function checkForCloudUpdates() {
  if (
    !cloudConfigured ||
    !supabase ||
    !navigator.onLine ||
    syncRunning
  ) {
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
    const cloudRevision =
      await getOrCreateCloudRevision()

    const localRevision =
      getLocalCloudRevision()

    /*
      Fresh empty device:
      cloud has data/revision, local
      has no revision yet.
    */
    if (
      localRevision === null
    ) {
      if (
        cloudRevision === 0
      ) {
        setLocalCloudRevision(
          0
        )

        return false
      }

      if (
        hasPendingCloudSync() ||
        getPendingDeletionCount() >
          0
      ) {
        console.warn(
          'Cloud update available, but this device has pending local changes. Automatic pull skipped.'
        )

        return false
      }

      if (
        await localDatabaseIsEmpty()
      ) {
        await pullCloudSnapshot(
          cloudRevision
        )

        return true
      }

      console.warn(
        `Cloud is revision ${cloudRevision}, but this device has local data and no revision marker. Automatic pull skipped for safety.`
      )

      return false
    }

    /*
      Normal stale-device case.
    */
    if (
      cloudRevision >
      localRevision
    ) {
      if (
        hasPendingCloudSync() ||
        getPendingDeletionCount() >
          0
      ) {
        console.warn(
          `Cloud is newer (revision ${cloudRevision}, local ${localRevision}), but this device has pending local changes. Automatic pull skipped to protect local work.`
        )

        return false
      }

      await pullCloudSnapshot(
        cloudRevision
      )

      return true
    }

    if (
      cloudRevision <
      localRevision
    ) {
      console.warn(
        `Local revision ${localRevision} is ahead of cloud revision ${cloudRevision}. Automatic pull skipped.`
      )
    }

    return false
  } catch (error) {
    console.warn(
      'JIMRAMI cloud update check failed:',
      error
    )

    return false
  } finally {
    syncRunning = false
  }
}

export type CloudSyncResult =
  | {
      status: 'synced'
    }
  | {
      status: 'queued'
    }
  | {
      status: 'unavailable'
      message: string
    }
  | {
      status: 'signedOut'
      message: string
    }
  | {
      status: 'failed'
      message: string
    }

export async function runCloudSync():
  Promise<CloudSyncResult> {
  if (
    !cloudConfigured ||
    !supabase
  ) {
    return {
      status: 'unavailable',
      message:
        'Cloud sync is not configured on this deployment.',
    }
  }

  if (syncRunning) {
    syncAgain = true

    return {
      status: 'queued',
    }
  }

  const {
    data,
  } =
    await supabase.auth
      .getSession()

  if (!data.session) {
    return {
      status: 'signedOut',
      message:
        'You are not signed in to cloud sync.',
    }
  }

  /*
    A second sync can begin while the
    session lookup above is waiting.

    Treat that as queued work instead of
    reporting it as a failure.
  */
  if (syncRunning) {
    syncAgain = true

    return {
      status: 'queued',
    }
  }

  syncRunning = true

  try {
    /*
      Revision protection.

      The cloud revision tells us
      whether another device has
      already uploaded a newer state.

      A brand-new sync_state row starts
      at revision 0. This existing
      device can then establish the
      first tracked cloud revision.
    */
    const cloudRevision =
      await getOrCreateCloudRevision()

    let localRevision =
      getLocalCloudRevision()

    if (
      localRevision === null &&
      cloudRevision === 0
    ) {
      localRevision = 0

      setLocalCloudRevision(
        0
      )
    }

    if (
      localRevision === null
    ) {
      throw new Error(
        `Cloud is newer (revision ${cloudRevision}) and this device has no matching revision yet. Upload stopped to protect cloud data.`
      )
    }

    if (
      cloudRevision >
      localRevision
    ) {
      throw new Error(
        `Cloud is newer (revision ${cloudRevision}, local ${localRevision}). Upload stopped to protect cloud data.`
      )
    }

    if (
      cloudRevision <
      localRevision
    ) {
      throw new Error(
        `Local revision ${localRevision} is ahead of cloud revision ${cloudRevision}. Sync stopped for safety.`
      )
    }

    /*
      Delete stale cloud rows first,
      then upload the current local
      database state.
    */
    await flushCloudDeletions()

    await migrateLocalDataToSupabase()

    /*
      Only after the upload succeeds do
      we advance the shared revision.
    */
    const nextRevision =
      await advanceCloudRevision(
        cloudRevision
      )

    setLocalCloudRevision(
      nextRevision
    )

    localStorage.removeItem(
      PENDING_KEY
    )

    localStorage.setItem(
      LAST_SYNC_KEY,
      new Date().toISOString()
    )

    notifyStatusChanged()

    console.log(
      `✓ Cloud revision: ${nextRevision}`
    )

    return {
      status: 'synced',
    }
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

    return {
      status: 'failed',
      message:
        error instanceof Error
          ? error.message
          : 'Cloud sync failed.',
    }
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

  async function checkAndReload() {
    const pulled =
      await checkForCloudUpdates()

    if (pulled) {
      /*
        Pulling rebuilds local numeric
        Dexie IDs. Reload so every React
        screen starts from the new local
        snapshot cleanly.
      */
      window.location.reload()
    }
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
      } else {
        void checkAndReload()
      }
    }
  )

  window.addEventListener(
    'focus',
    () => {
      if (
        !hasPendingCloudSync() &&
        getPendingDeletionCount() ===
          0
      ) {
        void checkAndReload()
      }
    }
  )

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        document.visibilityState ===
          'visible' &&
        !hasPendingCloudSync() &&
        getPendingDeletionCount() ===
          0
      ) {
        void checkAndReload()
      }
    }
  )

  /*
    If a previous upload failed or a
    deletion is waiting, retry upload.

    Otherwise check whether another
    device has a newer cloud revision.
  */
  if (
    hasPendingCloudSync() ||
    getPendingDeletionCount() > 0
  ) {
    scheduleCloudSync(1000)
  } else {
    window.setTimeout(
      () => {
        void checkAndReload()
      },
      900
    )
  }
}
