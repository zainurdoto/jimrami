import {
  useEffect,
  useState,
} from 'react'

import { motion } from 'motion/react'

import {
  type Player,
  type SessionPlayer,
} from './db'

export type ScoreChange = {
  sessionPlayerId: number
  amount: number
}

export type ScoreTransitionData = {
  roundNumber: number
  before: SessionPlayer[]
  after: SessionPlayer[]
  changes: ScoreChange[]
}

type Props = {
  data: ScoreTransitionData
  players: Player[]
  onDone: () => void
}

export default function ScoreTransition({
  data,
  players,
  onDone,
}: Props) {
  const [updated, setUpdated] =
    useState(false)

  useEffect(() => {
    const updateTimer =
      window.setTimeout(() => {
        setUpdated(true)
      }, 3200)

    const finishTimer =
      window.setTimeout(() => {
        onDone()
      }, 10000)

    return () => {
      window.clearTimeout(
        updateTimer
      )

      window.clearTimeout(
        finishTimer
      )
    }
  }, [onDone])

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

  function getChange(
    sessionPlayerId: number
  ) {
    return (
      data.changes.find(
        (change) =>
          change.sessionPlayerId ===
          sessionPlayerId
      )?.amount ?? 0
    )
  }

  const source =
    updated
      ? data.after
      : data.before

  const ranking =
    [...source].sort(
      (a, b) =>
        b.points - a.points ||
        a.rotationOrder -
          b.rotationOrder
    )

  return (
    <main className="app scoreTransitionPage">
      <header className="transitionHeader">
        <span>
          ROUND
        </span>

        <strong>
          {data.roundNumber}
        </strong>
      </header>

      <section className="transitionScoreboard">
        {ranking.map(
          (
            sessionPlayer,
            index
          ) => {
            const change =
              getChange(
                sessionPlayer.id
              )

            const isPlaying =
              sessionPlayer
                .rotationOrder < 4

            return (
              <motion.article
                layout
                key={
                  sessionPlayer.id
                }
                className="transitionPlayer"
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 30,
                }}
              >
                <div className="transitionRank">
                  {index + 1}
                </div>

                <div className="transitionIdentity">
                  <div className="transitionNameRow">
                    <h2>
                      {getName(
                        sessionPlayer.playerId
                      )}
                    </h2>

                    {change !== 0 && (
                      <motion.span
                        className={
                          change > 0
                            ? 'pointDelta positive'
                            : 'pointDelta negative'
                        }
                        initial={{
                          scale: 0.4,
                          opacity: 0,
                        }}
                        animate={{
                          scale: 1,
                          opacity: 1,
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 22,
                        }}
                      >
                        {change > 0
                          ? `+${change}`
                          : change}
                      </motion.span>
                    )}
                  </div>

                  <p>
                    {sessionPlayer.wins}{' '}
                    standard
                    {' • '}
                    ★{' '}
                    {sessionPlayer.jimWins ??
                      0}{' '}
                    Jim

                    {isPlaying && (
                      <>
                        {' • '}
                        playing
                      </>
                    )}
                  </p>
                </div>

                <div className="transitionPoints">
                  <motion.strong
                    key={
                      sessionPlayer.points
                    }
                    initial={{
                      opacity: 0.3,
                      y: 5,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                  >
                    {
                      sessionPlayer.points
                    }
                  </motion.strong>

                  <span>
                    PTS
                  </span>
                </div>
              </motion.article>
            )
          }
        )}
      </section>
    </main>
  )
}