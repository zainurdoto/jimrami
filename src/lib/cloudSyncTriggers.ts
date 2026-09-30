import type {
  Table,
  Transaction,
} from 'dexie'

import { db } from '../db'

import {
  queueCloudDeletion,
  scheduleCloudSync,
  type CloudTableName,
} from './cloudSync'

import {
  isCloudSyncSuppressed,
} from './cloudSyncGuard'

let installed = false

function scheduleAfterCommit(
  transaction: Transaction
) {
  transaction.on(
    'complete',
    () => {
      scheduleCloudSync()
    }
  )
}

function installTableHooks<
  T extends {
    cloudId?: string
  }
>(
  table: Table<T, number>,
  cloudTable:
    CloudTableName
) {
  table.hook(
    'creating',
    (
      _primaryKey,
      _object,
      transaction
    ) => {
      if (
        isCloudSyncSuppressed()
      ) {
        return
      }

      scheduleAfterCommit(
        transaction
      )
    }
  )

  table.hook(
    'updating',
    (
      _modifications,
      _primaryKey,
      _object,
      transaction
    ) => {
      if (
        isCloudSyncSuppressed()
      ) {
        return
      }

      scheduleAfterCommit(
        transaction
      )
    }
  )

  table.hook(
    'deleting',
    (
      _primaryKey,
      object,
      transaction
    ) => {
      if (
        isCloudSyncSuppressed()
      ) {
        return
      }

      const cloudId =
        object.cloudId

      if (!cloudId) {
        return
      }

      transaction.on(
        'complete',
        () => {
          queueCloudDeletion(
            cloudTable,
            cloudId
          )

          scheduleCloudSync()
        }
      )
    }
  )
}

export function installCloudSyncTriggers() {
  if (installed) {
    return
  }

  installed = true

  installTableHooks(
    db.players,
    'players'
  )

  installTableHooks(
    db.sessions,
    'sessions'
  )

  installTableHooks(
    db.sessionPlayers,
    'session_players'
  )

  installTableHooks(
    db.rounds,
    'rounds'
  )

  installTableHooks(
    db.roundResults,
    'round_results'
  )

  installTableHooks(
    db.jimResults,
    'jim_results'
  )

  installTableHooks(
    db.penaltyResults,
    'penalty_results'
  )
}
