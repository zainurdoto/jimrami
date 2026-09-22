import { useState } from 'react'

import {
  db,
  type GameSession,
  type Player,
  type SessionPlayer,
} from './db'

import {
  type ScoreTransitionData,
} from './ScoreTransition'

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
  const [phase, setPhase] =
    useState<Phase>('choose')

  const [
    jimSessionPlayerId,
    setJimSessionPlayerId,
  ] =
    useState<number | null>(null)

  const [
    catcherSessionPlayerId,
    setCatcherSessionPlayerId,
  ] =
    useState<number | null>(null)

  const [
    outSessionPlayerId,
    setOutSessionPlayerId,
  ] =
    useState<number | null>(null)

  const [
    stepsSurvived,
    setStepsSurvived,
  ] =
    useState(0)

  /*
    null = Jim never used Hide.

    Otherwise this stores the stage
    where Hide was used: 2–6.
  */
  const [
    hideStage,
    setHideStage,
  ] =
    useState<number | null>(null)

  const [saving, setSaving] =
    useState(false)

  const playing =
    [...sessionPlayers]
      .filter(
        (player) =>
          player.rotationOrder < 4
      )
      .sort(
        (a, b) =>
          a.rotationOrder -
          b.rotationOrder
      )

  const waiting =
    [...sessionPlayers]
      .filter(
        (player) =>
          player.rotationOrder >= 4
      )
      .sort(
        (a, b) =>
          a.rotationOrder -
          b.rotationOrder
      )

  const jimPlayer =
    jimSessionPlayerId === null
      ? undefined
      : sessionPlayers.find(
          (player) =>
            player.id ===
            jimSessionPlayerId
        )

  /*
    If 0 stages have been survived,
    Jim is currently facing Stage 1.

    If 1 has been survived,
    Jim is currently facing Stage 2.

    etc.
  */
  const currentStage =
    Math.min(
      stepsSurvived + 1,
      6
    )

  function getName(
    playerId: number
  ) {
    return (
      players.find(
        (player) =>
          player.id === playerId
      )?.name ?? 'Unknown'
    )
  }

  function chooseJim(
    player: SessionPlayer
  ) {
    setJimSessionPlayerId(
      player.id
    )

    setStepsSurvived(0)
    setHideStage(null)
    setPhase('running')
  }

  function useHide() {
        if (
          phase !== 'running' ||
          hideStage !== null ||
          currentStage < 2 ||
          currentStage > 5
        ) {
          return
        }

    setHideStage(
      currentStage
    )
  }

  function survivedNext() {
    if (phase !== 'running') {
      return
    }

    /*
      Surviving Stage 6 means
      Jim wins.
    */
    if (currentStage === 6) {
      setStepsSurvived(6)
      setPhase('win')

      return
    }

    setStepsSurvived(
      (value) => value + 1
    )
  }

  /*
    Rotation helper.

    If someone is waiting:
    - selected out player leaves
    - first waiting player enters
    - out player goes to back

    If nobody is waiting:
    nothing rotates.
  */
  function rotatePlayers(
    updatedPlayers:
      SessionPlayer[],

    outId: number
  ) {
    if (waiting.length === 0) {
      return updatedPlayers
    }

    const ordered =
      [...updatedPlayers].sort(
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

    const outPlayer =
      currentPlaying.find(
        (player) =>
          player.id === outId
      )

    const entering =
      currentWaiting[0]

    if (
      !outPlayer ||
      !entering
    ) {
      return updatedPlayers
    }

    const survivors =
      currentPlaying.filter(
        (player) =>
          player.id !== outId
      )

    const remainingWaiting =
      currentWaiting.slice(1)

    const newRotation = [
      ...survivors,
      entering,
      ...remainingWaiting,
      outPlayer,
    ]

    return newRotation.map(
      (player, index) => ({
        ...player,
        rotationOrder: index,
      })
    )
  }

  async function finishLoss() {
    if (
      saving ||
      !jimPlayer ||
      catcherSessionPlayerId ===
        null
    ) {
      return
    }

    const catcher =
      sessionPlayers.find(
        (player) =>
          player.id ===
          catcherSessionPlayerId
      )

    if (!catcher) {
      return
    }

    setSaving(true)

    const before =
      sessionPlayers.map(
        (player) => ({
          ...player,
        })
      )

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

          return {
            ...player,
          }
        }
      )

    /*
      Jim himself leaves the table
      after losing, if somebody is
      waiting.
    */
    updated =
      rotatePlayers(
        updated,
        jimPlayer.id
      )

    await db.transaction(
      'rw',

      [
        db.sessions,
        db.sessionPlayers,
        db.rounds,
        db.jimResults,
      ],

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

          /*
            Jim is the out player
            after a Jim loss.
          */
          outPlayerId:
            jimPlayer.playerId,

          won: false,

          stepsSurvived,

          hideStage:
            hideStage ??
            undefined,

          jimPointsAwarded: -3,

          catcherPointsAwarded:
            1,
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
      type: 'round',

      roundNumber:
        session.roundNumber,

      before,

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
    if (
      saving ||
      !jimPlayer
    ) {
      return
    }

    /*
      If someone is waiting,
      another active player must
      be chosen to leave.
    */
    if (
      waiting.length > 0 &&
      outSessionPlayerId === null
    ) {
      return
    }

    const outPlayer =
      outSessionPlayerId === null
        ? undefined
        : sessionPlayers.find(
            (player) =>
              player.id ===
              outSessionPlayerId
          )

    setSaving(true)

    const before =
      sessionPlayers.map(
        (player) => ({
          ...player,
        })
      )

    let updated =
      sessionPlayers.map(
        (player) => {
          if (
            player.id !==
            jimPlayer.id
          ) {
            return {
              ...player,
            }
          }

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
      )

    if (outPlayer) {
      updated =
        rotatePlayers(
          updated,
          outPlayer.id
        )
    }

    await db.transaction(
      'rw',

      [
        db.sessions,
        db.sessionPlayers,
        db.rounds,
        db.jimResults,
      ],

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
            outPlayer?.playerId,

          won: true,

          stepsSurvived: 6,

          hideStage:
            hideStage ??
            undefined,

          jimPointsAwarded: 7,

          catcherPointsAwarded:
            0,
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
      type: 'round',

      roundNumber:
        session.roundNumber,

      before,

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
    <main className="app jimRoundPage">
      <header className="roundHeader">
        <button
          className="roundBack"
          onClick={onBack}
          disabled={saving}
        >
          ←
        </button>

        <div>
          <span>
            JIM ROUND
          </span>

          <h1>
            Round{' '}
            {session.roundNumber}
          </h1>
        </div>
      </header>

      {phase === 'choose' && (
        <section className="jimPanel">
          <div className="jimSectionTitle">
            <span>
              JIM
            </span>

            <h2>
              Who called Jim?
            </h2>
          </div>

          <div className="jimPlayerChoices">
            {playing.map(
              (player) => (
                <button
                  key={player.id}
                  className="jimPlayerChoice"
                  onClick={() =>
                    chooseJim(
                      player
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
          <section className="jimPanel">
            <div className="jimCurrentPlayer">
              <span>
                JIM
              </span>

              <h2>
                {getName(
                  jimPlayer.playerId
                )}
              </h2>
            </div>

            <div className="jimProgress">
              <div className="jimProgressTop">
                <span>
                  SURVIVED
                </span>

                <strong>
                  {stepsSurvived}
                  {' / '}
                  6
                </strong>
              </div>

              <div className="jimStages">
                {[
                  1,
                  2,
                  3,
                  4,
                  5,
                  6,
                ].map(
                  (stage) => {
                    const survived =
                      stage <=
                      stepsSurvived

                    const current =
                      stage ===
                      currentStage

                    const hidden =
                      stage ===
                      hideStage

                    return (
                      <div
                        key={stage}
                        className={[
                          'jimStage',

                          survived
                            ? 'survived'
                            : '',

                          current
                            ? 'current'
                            : '',

                          hidden
                            ? 'hidden'
                            : '',
                        ]
                          .filter(
                            Boolean
                          )
                          .join(' ')}
                      >
                        <span>
                          {stage}
                        </span>

                        {hidden && (
                          <small>
                            HIDE
                          </small>
                        )}
                      </div>
                    )
                  }
                )}
              </div>
            </div>

            <div className="jimHideArea">
              {hideStage !== null ? (
                <div className="jimHideUsed">
                  <span>
                    HIDE USED
                  </span>

                  <strong>
                    Stage{' '}
                    {hideStage}
                  </strong>
                </div>
              ) : (
                <button
                  className="jimHideButton"
                 disabled={
                  currentStage === 1 ||
                  currentStage === 6 ||
                  saving
                }
                  onClick={useHide}
                >
                  {currentStage === 1
                    ? 'Hide available from Stage 2'
                    : currentStage === 6
                      ? 'Hide unavailable on final stage'
                      : `HIDE • STAGE ${currentStage}`}
                </button>
              )}
            </div>

            <div className="jimMainActions">
              <button
                className="jimSurvivedButton"
                onClick={
                  survivedNext
                }
                disabled={saving}
              >
                Survived Next
              </button>

              <button
                className="jimCaughtButton"
                onClick={() =>
                  setPhase(
                    'caught'
                  )
                }
                disabled={saving}
              >
                Caught
              </button>
            </div>
          </section>
        )}

      {phase === 'caught' &&
        jimPlayer && (
          <section className="jimPanel">
            <div className="jimSectionTitle">
              <span>
                JIM CAUGHT
              </span>

              <h2>
                Who caught{' '}
                {getName(
                  jimPlayer.playerId
                )}
                ?
              </h2>
            </div>

            <div className="jimPlayerChoices">
              {playing
                .filter(
                  (player) =>
                    player.id !==
                    jimPlayer.id
                )
                .map(
                  (player) => (
                    <button
                      key={
                        player.id
                      }
                      className={
                        catcherSessionPlayerId ===
                        player.id
                          ? 'jimPlayerChoice selected'
                          : 'jimPlayerChoice'
                      }
                      onClick={() =>
                        setCatcherSessionPlayerId(
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

            <div className="jimOutcomeSummary">
              <div>
                <span>
                  JIM
                </span>

                <strong>
                  -3
                </strong>
              </div>

              <div>
                <span>
                  CATCHER
                </span>

                <strong>
                  +1
                </strong>
              </div>

              <div>
                <span>
                  SURVIVED
                </span>

                <strong>
                  {
                    stepsSurvived
                  }
                  /6
                </strong>
              </div>

              <div>
                <span>
                  HIDE
                </span>

                <strong>
                  {hideStage ===
                  null
                    ? 'NO'
                    : `S${hideStage}`}
                </strong>
              </div>
            </div>

            <button
              className="jimConfirmButton"
              disabled={
                catcherSessionPlayerId ===
                  null ||
                saving
              }
              onClick={
                finishLoss
              }
            >
              {saving
                ? 'Saving...'
                : 'Confirm Catch'}
            </button>
          </section>
        )}

      {phase === 'win' &&
        jimPlayer && (
          <section className="jimPanel">
            <div className="jimWinTitle">
              <span>
                JIM SURVIVED
              </span>

              <h2>
                {getName(
                  jimPlayer.playerId
                )}
              </h2>

              <strong>
                +7
              </strong>
            </div>

            <div className="jimOutcomeSummary">
              <div>
                <span>
                  SURVIVED
                </span>

                <strong>
                  6/6
                </strong>
              </div>

              <div>
                <span>
                  HIDE
                </span>

                <strong>
                  {hideStage ===
                  null
                    ? 'NO'
                    : `S${hideStage}`}
                </strong>
              </div>
            </div>

            {waiting.length >
            0 ? (
              <>
                <div className="jimSectionTitle">
                  <span>
                    ROTATION
                  </span>

                  <h2>
                    Who is out?
                  </h2>
                </div>

                <div className="jimPlayerChoices">
                  {playing
                    .filter(
                      (player) =>
                        player.id !==
                        jimPlayer.id
                    )
                    .map(
                      (player) => (
                        <button
                          key={
                            player.id
                          }
                          className={
                            outSessionPlayerId ===
                            player.id
                              ? 'jimPlayerChoice selected'
                              : 'jimPlayerChoice'
                          }
                          onClick={() =>
                            setOutSessionPlayerId(
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

                <p className="jimRotationNote">
                  {getName(
                    waiting[0]
                      .playerId
                  )}{' '}
                  will enter.
                </p>
              </>
            ) : (
              <p className="jimRotationNote">
                No waiting player.
                No rotation needed.
              </p>
            )}

            <button
              className="jimConfirmButton jimWinConfirm"
              disabled={
                saving ||
                (
                  waiting.length >
                    0 &&
                  outSessionPlayerId ===
                    null
                )
              }
              onClick={
                finishWin
              }
            >
              {saving
                ? 'Saving...'
                : 'Confirm Jim Win'}
            </button>
          </section>
        )}
    </main>
  )
}