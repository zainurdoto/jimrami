import {
  useEffect,
  useRef,
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
  /*
    Optional for compatibility with
    the transitions we already built.

    Existing Standard and Jim rounds
    do not need to be changed.
  */
  type?: 'round' | 'penalty'

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

const UPDATE_DELAY = 3200

const ROUND_FINISH_DELAY = 10000

const PENALTY_FINISH_DELAY = 6500

export default function ScoreTransition({
  data,
  players,
  onDone,
}: Props) {
  const [updated, setUpdated] =
    useState(false)

  /*
    Keep the latest onDone function
    without restarting the timers if
    the parent component rerenders.
  */
  const onDoneRef =
    useRef(onDone)

  useEffect(() => {
    onDoneRef.current =
      onDone
  }, [onDone])

  /*
    Current Penalty.tsx sends exactly
    one score change of -1.

    This lets the transition recognise
    penalties immediately without
    requiring changes elsewhere.

    The explicit `type` field also
    leaves us a cleaner option later.
  */
  const isPenalty =
    data.type === 'penalty' ||
    (
      data.changes.length === 1 &&
      data.changes[0]?.amount === -1
    )

  const finishDelay =
    isPenalty
      ? PENALTY_FINISH_DELAY
      : ROUND_FINISH_DELAY

  useEffect(() => {
    setUpdated(false)

    const updateTimer =
      window.setTimeout(() => {
        setUpdated(true)
      }, UPDATE_DELAY)

    const finishTimer =
      window.setTimeout(() => {
        onDoneRef.current()
      }, finishDelay)

    return () => {
      window.clearTimeout(
        updateTimer
      )

      window.clearTimeout(
        finishTimer
      )
    }
  }, [
    data,
    finishDelay,
  ])

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

  /*
    Before 3.2 seconds:
    display old scores/ranking.

    After 3.2 seconds:
    display new scores/ranking.
  */
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
        {isPenalty ? (
          <>
            <span>
              PENALTY
            </span>

            <strong>
              -1
            </strong>
          </>
        ) : (
          <>
            <span>
              ROUND
            </span>

            <strong>
              {data.roundNumber}
            </strong>
          </>
        )}
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
                    transition={{
                      duration: 0.35,
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