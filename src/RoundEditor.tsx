import { useMemo, useState } from 'react'
import { Reorder } from 'motion/react'

import {
  db,
  type GameRound,
  type JimResult,
  type RoundResult,
  type SessionPlayer,
} from './db'

type StandardTieMode =
  | 'none'
  | '23'
  | '34'

type Props = {
  round: GameRound
  sessionPlayers: SessionPlayer[]
  roundResults: RoundResult[]
  jimResult?: JimResult
  getName: (
    playerId: number
  ) => string
  onClose: () => void
}

function inferTieMode(
  results: RoundResult[]
): StandardTieMode {
  const positions =
    results.map(
      (result) =>
        result.position
    )

  const position2Count =
    positions.filter(
      (position) =>
        position === 2
    ).length

  const position3Count =
    positions.filter(
      (position) =>
        position === 3
    ).length

  if (position2Count > 1) {
    return '23'
  }

  if (position3Count > 1) {
    return '34'
  }

  return 'none'
}

async function recalculateSession(
  sessionId: number
) {
  const [
    participants,
    standardResults,
    jimResults,
    penalties,
  ] =
    await Promise.all([
      db.sessionPlayers
        .where('sessionId')
        .equals(sessionId)
        .toArray(),

      db.roundResults
        .where('sessionId')
        .equals(sessionId)
        .toArray(),

      db.jimResults
        .where('sessionId')
        .equals(sessionId)
        .toArray(),

      db.penaltyResults
        .where('sessionId')
        .equals(sessionId)
        .toArray(),
    ])

  const points =
    new Map<number, number>()

  const wins =
    new Map<number, number>()

  const jimWins =
    new Map<number, number>()

  const jimAttempts =
    new Map<number, number>()

  participants.forEach(
    (participant) => {
      points.set(
        participant.playerId,
        0
      )

      wins.set(
        participant.playerId,
        0
      )

      jimWins.set(
        participant.playerId,
        0
      )

      jimAttempts.set(
        participant.playerId,
        0
      )
    }
  )

  standardResults.forEach(
    (result) => {
      points.set(
        result.playerId,
        (points.get(
          result.playerId
        ) ?? 0) +
          result.pointsAwarded
      )

      if (
        result.position === 1
      ) {
        wins.set(
          result.playerId,
          (wins.get(
            result.playerId
          ) ?? 0) + 1
        )
      }
    }
  )

  jimResults.forEach(
    (result) => {
      points.set(
        result.jimPlayerId,
        (points.get(
          result.jimPlayerId
        ) ?? 0) +
          result.jimPointsAwarded
      )

      jimAttempts.set(
        result.jimPlayerId,
        (jimAttempts.get(
          result.jimPlayerId
        ) ?? 0) + 1
      )

      if (result.won) {
        jimWins.set(
          result.jimPlayerId,
          (jimWins.get(
            result.jimPlayerId
          ) ?? 0) + 1
        )
      }

      if (
        result.caughtByPlayerId !==
        undefined
      ) {
        points.set(
          result.caughtByPlayerId,
          (points.get(
            result.caughtByPlayerId
          ) ?? 0) +
            result.catcherPointsAwarded
        )
      }
    }
  )

  penalties.forEach(
    (penalty) => {
      points.set(
        penalty.playerId,
        (points.get(
          penalty.playerId
        ) ?? 0) +
          penalty.pointsAwarded
      )
    }
  )

  await db.sessionPlayers.bulkPut(
    participants.map(
      (participant) => ({
        ...participant,

        points:
          points.get(
            participant.playerId
          ) ?? 0,

        wins:
          wins.get(
            participant.playerId
          ) ?? 0,

        jimWins:
          jimWins.get(
            participant.playerId
          ) ?? 0,

        jimAttempts:
          jimAttempts.get(
            participant.playerId
          ) ?? 0,
      })
    )
  )
}

export default function RoundEditor({
  round,
  sessionPlayers,
  roundResults,
  jimResult,
  getName,
  onClose,
}: Props) {
  const orderedStandard =
    useMemo(
      () =>
        [...roundResults].sort(
          (a, b) =>
            a.position -
              b.position ||
            b.pointsAwarded -
              a.pointsAwarded ||
            a.id - b.id
        ),
      [roundResults]
    )

  const [
    standardOrder,
    setStandardOrder,
  ] =
    useState<number[]>(
      orderedStandard.map(
        (result) =>
          result.playerId
      )
    )

  const [
    tieMode,
    setTieMode,
  ] =
    useState<StandardTieMode>(
      inferTieMode(
        orderedStandard
      )
    )

  const [
    jimPlayerId,
    setJimPlayerId,
  ] =
    useState<number>(
      jimResult?.jimPlayerId ??
        sessionPlayers[0]
          ?.playerId ??
        0
    )

  const [
    jimWon,
    setJimWon,
  ] =
    useState(
      jimResult?.won ?? false
    )

  const [
    catcherPlayerId,
    setCatcherPlayerId,
  ] =
    useState<number | null>(
      jimResult
        ?.caughtByPlayerId ??
        null
    )

  const [
    outPlayerId,
    setOutPlayerId,
  ] =
    useState<number | null>(
      jimResult?.outPlayerId ??
        null
    )

  const [
    stepsSurvived,
    setStepsSurvived,
  ] =
    useState(
      jimResult
        ?.stepsSurvived ?? 0
    )

  const [
    hideStage,
    setHideStage,
  ] =
    useState<number | null>(
      jimResult?.hideStage ??
        null
    )

  const [saving, setSaving] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const selectablePlayers =
    [...sessionPlayers].sort(
      (a, b) =>
        a.rotationOrder -
        b.rotationOrder
    )

  async function saveStandard() {
    if (
      saving ||
      standardOrder.length !==
        roundResults.length
    ) {
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const positionPattern =
        tieMode === '23'
          ? [1, 2, 2, 4]
          : tieMode === '34'
          ? [1, 2, 3, 3]
          : [1, 2, 3, 4]

      const pointPattern =
        tieMode === '23'
          ? [3, 2, 2, 0]
          : tieMode === '34'
          ? [3, 2, 0, 0]
          : [3, 2, 1, 0]

      const updated =
        standardOrder.flatMap(
          (
            playerId,
            index
          ) => {
            const original =
              roundResults.find(
                (result) =>
                  result.playerId ===
                  playerId
              )

            if (!original) {
              return []
            }

            return [
              {
                ...original,

                position:
                  positionPattern[
                    index
                  ],

                pointsAwarded:
                  pointPattern[
                    index
                  ],
              },
            ]
          }
        )

      await db.roundResults.bulkPut(
        updated
      )

      await recalculateSession(
        round.sessionId
      )

      await db.rounds.update(
        round.id,
        {
          editedAt:
            new Date().toISOString(),
        }
      )

      onClose()
    } catch {
      setMessage(
        'Could not save this round.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function saveJim() {
    if (
      saving ||
      !jimResult
    ) {
      return
    }

    if (
      !jimWon &&
      catcherPlayerId === null
    ) {
      setMessage(
        'Choose who caught Jim.'
      )

      return
    }

    if (
      !jimWon &&
      catcherPlayerId ===
        jimPlayerId
    ) {
      setMessage(
        'Jim cannot catch himself.'
      )

      return
    }

    setSaving(true)
    setMessage('')

    try {
      await db.jimResults.update(
        jimResult.id,
        {
          jimPlayerId,

          won: jimWon,

          caughtByPlayerId:
            jimWon
              ? undefined
              : catcherPlayerId ??
                undefined,

          outPlayerId:
            jimWon
              ? outPlayerId ??
                undefined
              : jimPlayerId,

          stepsSurvived:
            jimWon
              ? 6
              : Math.max(
                  0,
                  Math.min(
                    5,
                    stepsSurvived
                  )
                ),

          hideStage:
            hideStage ??
            undefined,

          jimPointsAwarded:
            jimWon
              ? 7
              : -3,

          catcherPointsAwarded:
            jimWon
              ? 0
              : 1,
        }
      )

      await recalculateSession(
        round.sessionId
      )

      await db.rounds.update(
        round.id,
        {
          editedAt:
            new Date().toISOString(),
        }
      )

      onClose()
    } catch {
      setMessage(
        'Could not save this Jim round.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (
    round.type === 'standard'
  ) {
    return (
      <div className="roundEditPanel">
        <div className="roundEditHeading">
          <div>
            <span>
              EDIT ROUND{' '}
              {round.roundNumber}
            </span>

            <strong>
              Standard result
            </strong>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <Reorder.Group
          axis="y"
          values={standardOrder}
          onReorder={(nextOrder) => {
            setStandardOrder(
              nextOrder
            )

            /*
              A tie belongs to positions,
              so dragging clears it just
              like the normal Quick Rank UI.
            */
            setTieMode('none')
          }}
          className="roundEditDragList"
          style={{
            touchAction: 'none',
          }}
          onTouchMove={(event) => {
            event.preventDefault()
          }}
        >
          {standardOrder.map(
            (
              playerId,
              index
            ) => {
              const connectorMode:
                | '23'
                | '34'
                | null =
                index === 1
                  ? '23'
                  : index === 2
                  ? '34'
                  : null

              const tiedWithNext =
                (tieMode === '23' &&
                  index === 1) ||
                (tieMode === '34' &&
                  index === 2)

              const tiedWithPrevious =
                (tieMode === '23' &&
                  index === 2) ||
                (tieMode === '34' &&
                  index === 3)

              return (
                <Reorder.Item
                  value={playerId}
                  key={playerId}
                  className={`roundEditDragItem${
                    connectorMode
                      ? ' hasTieConnector'
                      : ''
                  }`}
                  style={{
                    touchAction: 'none',
                  }}
                >
                  <div
                    className={`roundEditDragRow${
                      tiedWithNext
                        ? ' tiedWithNext'
                        : ''
                    }${
                      tiedWithPrevious
                        ? ' tiedWithPrevious'
                        : ''
                    }`}
                  >
                    <span className="roundEditDragPosition">
                      {index + 1}
                    </span>

                    <strong>
                      {getName(
                        playerId
                      )}
                    </strong>

                    <span
                      className="roundEditDragHandle"
                      aria-hidden="true"
                    >
                      ↕
                    </span>
                  </div>

                  {connectorMode && (
                    <button
                      type="button"
                      className={`roundEditTieConnector${
                        tieMode ===
                        connectorMode
                          ? ' active'
                          : ''
                      }`}
                      aria-label={
                        connectorMode ===
                        '23'
                          ? 'Tie second and third place'
                          : 'Tie third and fourth place'
                      }
                      onPointerDown={(event) => {
                        event.stopPropagation()
                      }}
                      onTouchStart={(event) => {
                        event.stopPropagation()
                      }}
                      onClick={() => {
                        setTieMode(
                          tieMode ===
                            connectorMode
                            ? 'none'
                            : connectorMode
                        )
                      }}
                    >
                      <span>
                        {tieMode ===
                        connectorMode
                          ? 'TIED'
                          : '='}
                      </span>
                    </button>
                  )}
                </Reorder.Item>
              )
            }
          )}
        </Reorder.Group>

        <div className="roundEditDragHint">
          <span>↕ Drag to reorder</span>
          <span>= Tap to tie 2nd/3rd or 3rd/4th</span>
        </div>

        <p className="roundEditNote">
          Saving recalculates the
          session totals and stats.
          Later-round rotation is
          not rewritten.
        </p>

        {message && (
          <p className="roundEditMessage">
            {message}
          </p>
        )}

        <div className="roundEditActions">
          <button
            type="button"
            className="roundEditCancel"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="roundEditSave"
            disabled={saving}
            onClick={
              saveStandard
            }
          >
            {saving
              ? 'Saving...'
              : 'Save Changes'}
          </button>
        </div>
      </div>
    )
  }

  if (!jimResult) {
    return (
      <div className="roundEditPanel">
        <p className="roundEditMessage">
          No Jim result was
          recorded for this round.
        </p>

        <button
          type="button"
          className="roundEditCancel"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="roundEditPanel">
      <div className="roundEditHeading">
        <div>
          <span>
            EDIT ROUND{' '}
            {round.roundNumber}
          </span>

          <strong>
            Jim result
          </strong>
        </div>

        <button
          type="button"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="roundEditChoiceField">
        <span>
          JIM PLAYER
        </span>

        <div className="roundEditChoiceGrid">
          {selectablePlayers.map(
            (player) => (
              <button
                type="button"
                key={player.id}
                className={
                  jimPlayerId ===
                  player.playerId
                    ? 'active'
                    : ''
                }
                onClick={() => {
                  const next =
                    player.playerId

                  setJimPlayerId(
                    next
                  )

                  if (
                    catcherPlayerId ===
                    next
                  ) {
                    setCatcherPlayerId(
                      null
                    )
                  }

                  if (
                    outPlayerId ===
                      next &&
                    jimWon
                  ) {
                    setOutPlayerId(
                      null
                    )
                  }
                }}
              >
                {getName(
                  player.playerId
                )}
              </button>
            )
          )}
        </div>
      </div>

      <div className="roundEditOutcome">
        <span>
          OUTCOME
        </span>

        <div>
          <button
            type="button"
            className={
              !jimWon
                ? 'active caught'
                : ''
            }
            onClick={() =>
              setJimWon(
                false
              )
            }
          >
            Caught
          </button>

          <button
            type="button"
            className={
              jimWon
                ? 'active won'
                : ''
            }
            onClick={() => {
              setJimWon(
                true
              )

              setCatcherPlayerId(
                null
              )
            }}
          >
            Jim Won
          </button>
        </div>
      </div>

      {!jimWon && (
        <>
          <div className="roundEditChoiceField">
            <span>
              CAUGHT BY
            </span>

            <div className="roundEditChoiceGrid">
              {selectablePlayers
                .filter(
                  (player) =>
                    player.playerId !==
                    jimPlayerId
                )
                .map(
                  (player) => (
                    <button
                      type="button"
                      key={player.id}
                      className={
                        catcherPlayerId ===
                        player.playerId
                          ? 'active caught'
                          : ''
                      }
                      onClick={() =>
                        setCatcherPlayerId(
                          player.playerId
                        )
                      }
                    >
                      {getName(
                        player.playerId
                      )}
                    </button>
                  )
                )}
            </div>
          </div>

          <div className="roundEditChoiceField">
            <span>
              STAGES SURVIVED
            </span>

            <div className="roundEditNumberChoices">
              {[0, 1, 2, 3, 4, 5].map(
                (value) => (
                  <button
                    type="button"
                    key={value}
                    className={
                      stepsSurvived ===
                      value
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setStepsSurvived(
                        value
                      )
                    }
                  >
                    {value}
                  </button>
                )
              )}
            </div>
          </div>
        </>
      )}

      {jimWon && (
        <div className="roundEditChoiceField">
          <span>
            PLAYER SENT OUT
          </span>

          <div className="roundEditChoiceGrid">
            <button
              type="button"
              className={
                outPlayerId === null
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setOutPlayerId(
                  null
                )
              }
            >
              None
            </button>

            {selectablePlayers
              .filter(
                (player) =>
                  player.playerId !==
                  jimPlayerId
              )
              .map(
                (player) => (
                  <button
                    type="button"
                    key={player.id}
                    className={
                      outPlayerId ===
                      player.playerId
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setOutPlayerId(
                        player.playerId
                      )
                    }
                  >
                    {getName(
                      player.playerId
                    )}
                  </button>
                )
              )}
          </div>
        </div>
      )}

      <div className="roundEditChoiceField">
        <span>
          HIDE
        </span>

        <div className="roundEditHideChoices">
          <button
            type="button"
            className={
              hideStage === null
                ? 'active'
                : ''
            }
            onClick={() =>
              setHideStage(null)
            }
          >
            No Hide
          </button>

          {[2, 3, 4, 5].map(
            (value) => (
              <button
                type="button"
                key={value}
                className={
                  hideStage === value
                    ? 'active hide'
                    : ''
                }
                onClick={() =>
                  setHideStage(value)
                }
              >
                Stage {value}
              </button>
            )
          )}
        </div>
      </div>

      <p className="roundEditNote">
        Saving recalculates the
        session totals and stats.
        Later-round rotation is
        not rewritten.
      </p>

      {message && (
        <p className="roundEditMessage">
          {message}
        </p>
      )}

      <div className="roundEditActions">
        <button
          type="button"
          className="roundEditCancel"
          disabled={saving}
          onClick={onClose}
        >
          Cancel
        </button>

        <button
          type="button"
          className="roundEditSave"
          disabled={saving}
          onClick={saveJim}
        >
          {saving
            ? 'Saving...'
            : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
