import {
  useState,
} from 'react'

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

export default function Penalty({
  session,
  sessionPlayers,
  players,
  onBack,
  onComplete,
}: Props) {
  const [saving, setSaving] =
    useState(false)


  const [
    selectedPenaltyPlayer,
    setSelectedPenaltyPlayer,
  ] =
    useState<SessionPlayer | null>(
      null
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

  function choosePenaltyPlayer(
    selected: SessionPlayer
  ) {
    if (saving) return

    setSelectedPenaltyPlayer(
      selected
    )
  }

  function cancelPenalty() {
    if (saving) return

    setSelectedPenaltyPlayer(
      null
    )
  }

  async function applyPenalty() {
    const selected =
      selectedPenaltyPlayer

    if (
      saving ||
      !selected
    ) {
      return
    }

    setSaving(true)

    const before =
      sessionPlayers.map(
        (player) => ({
          ...player,
        })
      )

    const after =
      sessionPlayers.map(
        (player) => {
          if (
            player.id !==
            selected.id
          ) {
            return {
              ...player,
            }
          }

          return {
            ...player,

            points:
              player.points - 1,
          }
        }
      )

    /*
      session.roundNumber points to
      the NEXT round.

      Therefore roundNumber - 1 is
      the most recently completed
      round when this penalty occurs.
    */
    const afterRoundNumber =
      Math.max(
        0,
        session.roundNumber - 1
      )

    await db.transaction(
      'rw',

      [
        db.sessionPlayers,
        db.penaltyResults,
      ],

      async () => {
        await db.sessionPlayers.bulkPut(
          after
        )

        await db.penaltyResults.add({
          sessionId:
            session.id,

          playerId:
            selected.playerId,

          roundNumber:
            afterRoundNumber,

          pointsAwarded: -1,

          createdAt:
            new Date(),
        })
      }
    )

    setSaving(false)

    setSelectedPenaltyPlayer(
      null
    )

    onComplete({
      roundNumber:
        session.roundNumber,

      before,

      after,

      changes: [
        {
          sessionPlayerId:
            selected.id,

          amount: -1,
        },
      ],
    })
  }

const orderedPlayers =
  [...sessionPlayers].sort(
    (a, b) =>
      b.points - a.points ||
      a.rotationOrder -
        b.rotationOrder
  )

  return (
    <main className="app">
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
            PENALTY
          </span>

          <h1>
            -1 Point
          </h1>
        </div>
      </header>

      <section className="penaltyPanel">
        <p className="penaltyPrompt">
          Who receives the
          penalty?
        </p>

        <div className="penaltyPlayers">
          {orderedPlayers.map(
            (player) => {
              const playing =
                player.rotationOrder <
                4

              return (
                <button
                  key={player.id}
                  className="penaltyPlayer"
                  disabled={saving}
                  onClick={() =>
                    choosePenaltyPlayer(
                      player
                    )
                  }
                >
                  <div>
                    <strong>
                      {getName(
                        player.playerId
                      )}
                    </strong>

                    <span>
                      {playing
                        ? 'PLAYING'
                        : 'WAITING'}
                    </span>
                  </div>

                  <b>
                    {player.points}
                  </b>
                </button>
              )
            }
          )}
        </div>
      </section>

      {selectedPenaltyPlayer && (
        <div className="penaltyConfirmOverlay">
          <div className="penaltyConfirmDialog">
            <span className="penaltyConfirmLabel">
              PENALTY
            </span>

            <h2>
              Give{' '}
              {getName(
                selectedPenaltyPlayer.playerId
              )}{' '}
              a -1 penalty?
            </h2>

            <div className="penaltyConfirmPoints">
              <div>
                <span>
                  CURRENT
                </span>

                <strong>
                  {
                    selectedPenaltyPlayer.points
                  }
                </strong>
              </div>

              <div className="penaltyConfirmArrow">
                →
              </div>

              <div>
                <span>
                  AFTER
                </span>

                <strong>
                  {
                    selectedPenaltyPlayer.points -
                    1
                  }
                </strong>
              </div>
            </div>

            <div className="penaltyConfirmActions">
              <button
                className="penaltyCancelButton"
                disabled={saving}
                onClick={
                  cancelPenalty
                }
              >
                Cancel
              </button>

              <button
                className="penaltyConfirmButton"
                disabled={saving}
                onClick={
                  applyPenalty
                }
              >
                {saving
                  ? 'Applying...'
                  : 'Confirm -1'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}