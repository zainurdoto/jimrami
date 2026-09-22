import {
  type ScoreTransitionData,
} from './ScoreTransition'
import { useState } from 'react'
import {
  db,
  type GameSession,
  type Player,
  type SessionPlayer,
} from './db'

type Props = {
  session: GameSession
  sessionPlayers: SessionPlayer[]
  players: Player[]
  onBack: () => void

  onComplete: (
    data: ScoreTransitionData
  ) => void
}

type Phase =
  | 'choose'
  | 'running'
  | 'caught'
  | 'win'

export default function JimRound({
  session,
  sessionPlayers,
  players,
  onBack,
  onComplete,
}: Props) {
  const playing = [...sessionPlayers]
    .filter(
      (player) =>
        player.rotationOrder < 4
    )
    .sort(
      (a, b) =>
        a.rotationOrder -
        b.rotationOrder
    )

  const waiting = [...sessionPlayers]
    .filter(
      (player) =>
        player.rotationOrder >= 4
    )
    .sort(
      (a, b) =>
        a.rotationOrder -
        b.rotationOrder
    )

  const [phase, setPhase] =
    useState<Phase>('choose')

  const [jimPlayerId, setJimPlayerId] =
    useState<number | null>(null)

  const [steps, setSteps] =
    useState(0)

  const [catcherId, setCatcherId] =
    useState<number | null>(null)

  const [outPlayerId, setOutPlayerId] =
    useState<number | null>(null)

  const [saving, setSaving] =
    useState(false)

  function getName(playerId: number) {
    return (
      players.find(
        (player) =>
          player.id === playerId
      )?.name ?? 'Unknown'
    )
  }


  const jimPlayer =
    playing.find(
      (player) =>
        player.id === jimPlayerId
    )

  const otherPlayers =
    playing.filter(
      (player) =>
        player.id !== jimPlayerId
    )

  function chooseJim(
    sessionPlayerId: number
  ) {
    setJimPlayerId(
      sessionPlayerId
    )

    setSteps(0)
    setPhase('running')
  }

  function survivedNext() {
    const next =
      Math.min(steps + 1, 6)

    setSteps(next)

    if (next === 6) {
      setPhase('win')
    }
  }

  function caught() {
    setCatcherId(null)
    setPhase('caught')
  }

  function cancelCaught() {
    setCatcherId(null)
    setPhase('running')
  }

  function rotatePlayers(
    currentPlayers: SessionPlayer[],
    playerGoingOutId: number
  ) {
    if (waiting.length === 0) {
      return currentPlayers
    }

    const ordered =
      [...currentPlayers].sort(
        (a, b) =>
          a.rotationOrder -
          b.rotationOrder
      )

    const currentPlaying =
      ordered.filter(
        (player) =>
          player.rotationOrder < 4
      )

    const currentWaiting =
      ordered.filter(
        (player) =>
          player.rotationOrder >= 4
      )

    const goingOut =
      currentPlaying.find(
        (player) =>
          player.id ===
          playerGoingOutId
      )

    if (!goingOut) {
      return currentPlayers
    }

    const survivors =
      currentPlaying.filter(
        (player) =>
          player.id !==
          playerGoingOutId
      )

    const entering =
      currentWaiting[0]

    const remainingWaiting =
      currentWaiting.slice(1)

    const newOrder = [
      ...survivors,
      entering,
      ...remainingWaiting,
      goingOut,
    ]

    return newOrder.map(
      (player, index) => ({
        ...player,
        rotationOrder: index,
      })
    )
  }

  async function finishLoss() {
    if (
      !jimPlayer ||
      catcherId === null
    ) {
      return
    }

    const catcher =
      playing.find(
        (player) =>
          player.id === catcherId
      )

    if (!catcher) return

    setSaving(true)

    let updated =
      sessionPlayers.map(
        (player) => {
          if (
            player.id ===
            jimPlayer.id
          ) {
            return {
              ...player,

              points:
                player.points - 3,

              jimAttempts:
                (player.jimAttempts ??
                  0) + 1,
            }
          }

          if (
            player.id ===
            catcher.id
          ) {
            return {
              ...player,

              points:
                player.points + 1,
            }
          }

          return { ...player }
        }
      )

    updated = rotatePlayers(
      updated,
      jimPlayer.id
    )

    await db.transaction(
      'rw',
      db.rounds,
      db.jimResults,
      db.sessionPlayers,
      db.sessions,
      async () => {
        const roundId =
          await db.rounds.add({
            sessionId:
              session.id,

            roundNumber:
              session.roundNumber,

            type: 'jim',

            createdAt:
              new Date(),
          })

        await db.jimResults.add({
          roundId,
          sessionId:
            session.id,

          jimPlayerId:
            jimPlayer.playerId,

          caughtByPlayerId:
            catcher.playerId,

          outPlayerId:
            waiting.length > 0
              ? jimPlayer.playerId
              : undefined,

          won: false,

          stepsSurvived:
            steps,

          jimPointsAwarded: -3,
          catcherPointsAwarded: 1,
        })

        await db.sessionPlayers.bulkPut(
          updated
        )

        await db.sessions.update(
          session.id,
          {
            roundNumber:
              session.roundNumber +
              1,
          }
        )
      }
    )

    setSaving(false)

onComplete({
  roundNumber:
    session.roundNumber,

  before:
    sessionPlayers.map(
      (player) => ({
        ...player,
      })
    ),

  after:
    updated.map(
      (player) => ({
        ...player,
      })
    ),

  changes: [
    {
      sessionPlayerId:
        jimPlayer.id,

      amount: -3,
    },

    {
      sessionPlayerId:
        catcher.id,

      amount: 1,
    },
  ],
})
  }

  async function finishWin() {
    if (!jimPlayer) return

    /*
      If somebody is waiting,
      we need to know which of
      the other 3 players goes out.
    */
    if (
      waiting.length > 0 &&
      outPlayerId === null
    ) {
      return
    }

    setSaving(true)

    let updated =
      sessionPlayers.map(
        (player) => {
          if (
            player.id ===
            jimPlayer.id
          ) {
            return {
              ...player,

              points:
                player.points + 7,

              jimWins:
                (player.jimWins ??
                  0) + 1,

              jimAttempts:
                (player.jimAttempts ??
                  0) + 1,
            }
          }

          return { ...player }
        }
      )

    if (
      waiting.length > 0 &&
      outPlayerId !== null
    ) {
      updated = rotatePlayers(
        updated,
        outPlayerId
      )
    }

    const playerGoingOut =
      outPlayerId !== null
        ? playing.find(
            (player) =>
              player.id ===
              outPlayerId
          )
        : undefined

    await db.transaction(
      'rw',
      db.rounds,
      db.jimResults,
      db.sessionPlayers,
      db.sessions,
      async () => {
        const roundId =
          await db.rounds.add({
            sessionId:
              session.id,

            roundNumber:
              session.roundNumber,

            type: 'jim',

            createdAt:
              new Date(),
          })

        await db.jimResults.add({
          roundId,
          sessionId:
            session.id,

          jimPlayerId:
            jimPlayer.playerId,

          outPlayerId:
            waiting.length > 0
              ? playerGoingOut?.playerId
              : undefined,

          won: true,

          stepsSurvived: 6,

          jimPointsAwarded: 7,
          catcherPointsAwarded: 0,
        })

        await db.sessionPlayers.bulkPut(
          updated
        )

        await db.sessions.update(
          session.id,
          {
            roundNumber:
              session.roundNumber +
              1,
          }
        )
      }
    )

    setSaving(false)

onComplete({
  roundNumber:
    session.roundNumber,

  before:
    sessionPlayers.map(
      (player) => ({
        ...player,
      })
    ),

  after:
    updated.map(
      (player) => ({
        ...player,
      })
    ),

  changes: [
    {
      sessionPlayerId:
        jimPlayer.id,

      amount: 7,
    },
  ],
})
  }

  return (
    <main className="app">
      <header className="jimRoundHeader">
        <button
          className="roundBack"
          onClick={onBack}
        >
          ←
        </button>

        <div>
          <span>
            ROUND {session.roundNumber}
          </span>

          <h1>★ Jim Round</h1>
        </div>
      </header>

      {phase === 'choose' && (
        <section>
          <div className="jimSectionTitle">
            <span>WHO IS JIM?</span>
          </div>

          <div className="jimPlayerGrid">
            {playing.map(
              (player) => (
                <button
                  key={player.id}
                  className="jimPlayerChoice"
                  onClick={() =>
                    chooseJim(
                      player.id
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
        </section>
      )}

      {phase === 'running' &&
        jimPlayer && (
          <section className="jimRunCard">
            <span className="jimSmallLabel">
              JIM
            </span>

            <h2>
              {getName(
                jimPlayer.playerId
              )}
            </h2>

            <div className="survivalTrack">
              {[1, 2, 3, 4, 5, 6].map(
                (step) => (
                  <div
                    key={step}
                    className={`survivalStep ${
                      step <= steps
                        ? 'complete'
                        : ''
                    }`}
                  >
                    {step}
                  </div>
                )
              )}
            </div>

            <div className="survivalCount">
              <strong>{steps}</strong>
              <span>/ 6 survived</span>
            </div>

            <div className="jimRunActions">
              <button
                className="jimSurviveButton"
                onClick={survivedNext}
              >
                Survived Next
              </button>

              <button
                className="jimCaughtButton"
                onClick={caught}
              >
                Caught
              </button>
            </div>
          </section>
        )}

      {phase === 'caught' &&
        jimPlayer && (
          <section className="jimResolution">
            <span className="jimResultLoss">
              JIM CAUGHT
            </span>

            <h2>
              {getName(
                jimPlayer.playerId
              )}
            </h2>

            <p>
              Survived {steps} of 6
            </p>

            <div className="jimScoringPreview">
              <strong>
                {getName(
                  jimPlayer.playerId
                )}
              </strong>

              <span>-3</span>
            </div>

            <div className="jimSectionTitle">
              <span>
                WHO CAUGHT JIM?
              </span>
            </div>

            <div className="jimChoiceList">
              {otherPlayers.map(
                (player) => (
                  <button
                    key={player.id}
                    className={
                      catcherId ===
                      player.id
                        ? 'selected'
                        : ''
                    }
                    onClick={() =>
                      setCatcherId(
                        player.id
                      )
                    }
                  >
                    <strong>
                      {getName(
                        player.playerId
                      )}
                    </strong>

                    <span>+1</span>
                  </button>
                )
              )}
            </div>

            {waiting.length > 0 && (
              <p className="jimRotationNote">
                {getName(
                  jimPlayer.playerId
                )}{' '}
                will go to the back of
                the waiting queue.
              </p>
            )}

            <div className="jimResolutionActions">
              <button
                className="jimCancel"
                onClick={
                  cancelCaught
                }
                disabled={saving}
              >
                Back
              </button>

              <button
                className="jimConfirm"
                onClick={
                  finishLoss
                }
                disabled={
                  catcherId ===
                    null ||
                  saving
                }
              >
                {saving
                  ? 'Saving...'
                  : 'Confirm Jim Loss'}
              </button>
            </div>
          </section>
        )}

      {phase === 'win' &&
        jimPlayer && (
          <section className="jimResolution">
            <span className="jimResultWin">
              JIM SURVIVED
            </span>

            <h2>
              {getName(
                jimPlayer.playerId
              )}
            </h2>

            <div className="jimWinScore">
              +7
            </div>

            {waiting.length > 0 ? (
              <>
                <div className="jimSectionTitle">
                  <span>
                    WHO IS OUT?
                  </span>
                </div>

                <div className="jimChoiceList">
                  {otherPlayers.map(
                    (player) => (
                      <button
                        key={
                          player.id
                        }
                        className={
                          outPlayerId ===
                          player.id
                            ? 'selected'
                            : ''
                        }
                        onClick={() =>
                          setOutPlayerId(
                            player.id
                          )
                        }
                      >
                        <strong>
                          {getName(
                            player.playerId
                          )}
                        </strong>

                        <span>OUT</span>
                      </button>
                    )
                  )}
                </div>
              </>
            ) : (
              <p className="jimRotationNote">
                No player is waiting, so
                the table stays unchanged.
              </p>
            )}

            <button
              className="jimConfirm jimWinConfirm"
              onClick={finishWin}
              disabled={
                (waiting.length >
                  0 &&
                  outPlayerId ===
                    null) ||
                saving
              }
            >
              {saving
                ? 'Saving...'
                : 'Confirm Jim Win'}
            </button>
          </section>
        )}

      {waiting.length > 0 &&
        phase !== 'caught' &&
        phase !== 'win' && (
          <div className="jimWaiting">
            <span>NEXT IN</span>

            <strong>
              {getName(
                waiting[0].playerId
              )}
            </strong>
          </div>
        )}
    </main>
  )
}