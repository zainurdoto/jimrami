import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import type {
  Player,
  SessionPlayer,
} from './db'

export type ScoreTransitionChange = {
  sessionPlayerId: number
  amount: number
}

export type ScoreTransitionData = {
  roundNumber: number
  before: SessionPlayer[]
  after: SessionPlayer[]
  changes: ScoreTransitionChange[]
}

type Props = {
  data: ScoreTransitionData
  players: Player[]
  onDone: () => void
}

const UPDATE_DELAY = 2500
const ROUND_FINISH_DELAY = 8000
const PENALTY_FINISH_DELAY = 4500

// Wait after the point-number animation finishes
// before revealing the new tally / Jim star.
const ACHIEVEMENT_AFTER_POINTS_DELAY = 1250

// How long the +3 / +7 / -1 bubble stays visible.
// This is now the ONLY timing control for that bubble.
const REWARD_BUBBLE_DURATION = 5500


// Smooth count from old points to new points
// when the ranking update starts.
const POINT_COUNT_DURATION = 700

const ROW_HEIGHT = 94
const ROW_GAP = 10

function byScore(
  a: SessionPlayer,
  b: SessionPlayer
) {
  return (
    b.points - a.points ||
    a.rotationOrder -
      b.rotationOrder
  )
}

function Tally({
  count,
  pop = false,
}: {
  count: number
  pop?: boolean
}) {
  if (count <= 0) {
    return null
  }

  const groups =
    Array.from(
      {
        length:
          Math.ceil(
            count / 5
          ),
      },
      (_, index) =>
        Math.min(
          5,
          count -
            index * 5
        )
    )

  return (
    <div
      className={`scoreTally ${
        pop
          ? 'pop'
          : ''
      }`}
      title={`${count} Standard ${
        count === 1
          ? 'win'
          : 'wins'
      }`}
    >
      {groups.map(
        (
          groupSize,
          groupIndex
        ) => (
          <span
            className="scoreTallyGroup"
            key={
              groupIndex
            }
          >
            {Array.from(
              {
                length:
                  Math.min(
                    groupSize,
                    4
                  ),
              },
              (
                _,
                markIndex
              ) => (
                <i
                  className="scoreTallyMark"
                  key={
                    markIndex
                  }
                />
              )
            )}

            {groupSize ===
              5 && (
              <i className="scoreTallyStrike" />
            )}
          </span>
        )
      )}
    </div>
  )
}

function Stars({
  count,
  pop = false,
}: {
  count: number
  pop?: boolean
}) {
  if (count <= 0) {
    return null
  }

  return (
    <div
      className={`scoreJimStars ${
        pop
          ? 'pop'
          : ''
      }`}
      title={`${count} Jim ${
        count === 1
          ? 'win'
          : 'wins'
      }`}
    >
      {Array.from(
        {
          length: count,
        },
        (_, index) => (
          <span key={index}>
            ★
          </span>
        )
      )}
    </div>
  )
}

function AnimatedPoints({
  from,
  to,
  animate,
}: {
  from: number
  to: number
  animate: boolean
}) {
  const [
    value,
    setValue,
  ] =
    useState(from)

  const [
    running,
    setRunning,
  ] =
    useState(false)

  useEffect(
    () => {
      if (!animate) {
        setValue(from)
        setRunning(false)
        return
      }

      if (from === to) {
        setValue(to)
        setRunning(false)
        return
      }

      let frameId = 0
      const startedAt =
        performance.now()

      setRunning(true)

      const tick = (
        now: number
      ) => {
        const progress =
          Math.min(
            1,
            (now - startedAt) /
              POINT_COUNT_DURATION
          )

        /*
          Ease-out cubic:
          moves quickly at first,
          then settles smoothly.
        */
        const eased =
          1 -
          Math.pow(
            1 - progress,
            3
          )

        const nextValue =
          Math.round(
            from +
              (to - from) *
                eased
          )

        setValue(nextValue)

        if (progress < 1) {
          frameId =
            requestAnimationFrame(
              tick
            )
        } else {
          setValue(to)
          setRunning(false)
        }
      }

      frameId =
        requestAnimationFrame(
          tick
        )

      return () => {
        cancelAnimationFrame(
          frameId
        )
      }
    },
    [
      from,
      to,
      animate,
    ]
  )

  const change =
    to - from

  return (
    <strong
      style={{
        display:
          'inline-block',

        color:
          running
            ? change > 0
              ? '#8fd6a3'
              : '#ef99a4'
            : undefined,

        transform:
          running
            ? 'scale(1.08)'
            : 'scale(1)',

        transition:
          'transform 180ms ease, color 220ms ease',
      }}
    >
      {value}
    </strong>
  )
}

export default function ScoreTransition({
  data,
  players,
  onDone,
}: Props) {
  const [
    settled,
    setSettled,
  ] =
    useState(false)

  const [
    showReward,
    setShowReward,
  ] =
    useState(true)

  const [
    revealAchievements,
    setRevealAchievements,
  ] =
    useState(false)

  const changeMap =
    useMemo(
      () =>
        new Map(
          data.changes.map(
            (change) => [
              change.sessionPlayerId,
              change.amount,
            ]
          )
        ),
      [data.changes]
    )


  const afterMap =
    useMemo(
      () =>
        new Map(
          data.after.map(
            (player) => [
              player.id,
              player,
            ]
          )
        ),
      [data.after]
    )

  const beforeRanking =
    useMemo(
      () =>
        [...data.before].sort(
          byScore
        ),
      [data.before]
    )

  const afterRanking =
    useMemo(
      () =>
        [...data.after].sort(
          byScore
        ),
      [data.after]
    )

  const isPenalty =
    data.changes.length ===
      1 &&
    data.changes[0].amount <
      0

  const finishDelay =
    isPenalty
      ? PENALTY_FINISH_DELAY
      : ROUND_FINISH_DELAY

  useEffect(
    () => {
      const settleTimer =
        window.setTimeout(
          () =>
            setSettled(true),
          UPDATE_DELAY
        )

      const achievementTimer =
        window.setTimeout(
          () =>
            setRevealAchievements(
              true
            ),
          UPDATE_DELAY +
            POINT_COUNT_DURATION +
            ACHIEVEMENT_AFTER_POINTS_DELAY
        )

      const rewardTimer =
        window.setTimeout(
          () =>
            setShowReward(false),
          UPDATE_DELAY +
            REWARD_BUBBLE_DURATION
        )

      const finishTimer =
        window.setTimeout(
          onDone,
          finishDelay
        )

      return () => {
        window.clearTimeout(
          settleTimer
        )

        window.clearTimeout(
          achievementTimer
        )

        window.clearTimeout(
          rewardTimer
        )

        window.clearTimeout(
          finishTimer
        )
      }
    },
    [
      finishDelay,
      onDone,
    ]
  )

  function getName(
    playerId: number
  ) {
    return (
      players.find(
        (player) =>
          player.id ===
          playerId
      )?.name ??
      'Unknown'
    )
  }

  const rows =
    data.before.map(
      (beforePlayer) => {
        const afterPlayer =
          afterMap.get(
            beforePlayer.id
          ) ??
          beforePlayer

        const beforeIndex =
          beforeRanking.findIndex(
            (player) =>
              player.id ===
              beforePlayer.id
          )

        const afterIndex =
          afterRanking.findIndex(
            (player) =>
              player.id ===
              beforePlayer.id
          )

        return {
          id:
            beforePlayer.id,

          beforePlayer,

          afterPlayer,

          beforeIndex,

          afterIndex,

          amount:
            changeMap.get(
              beforePlayer.id
            ) ?? 0,

          standardDelta:
            (afterPlayer.wins ??
              0) -
            (beforePlayer.wins ??
              0),

          jimDelta:
            (afterPlayer.jimWins ??
              0) -
            (beforePlayer.jimWins ??
              0),
        }
      }
    )

  const boardHeight =
    rows.length *
      ROW_HEIGHT +
    Math.max(
      0,
      rows.length - 1
    ) *
      ROW_GAP

  return (
    <main className="app cleanTransitionPage">
      <header className="cleanTransitionHeader">
        <div>
          <span>
            {isPenalty
              ? 'PENALTY'
              : 'ROUND UPDATE'}
          </span>

          <h1>
            Round{' '}
            {
              data.roundNumber
            }
          </h1>
        </div>

        <button
          onClick={onDone}
        >
          Skip
        </button>
      </header>

      <section
        className="cleanTransitionBoard"
        style={{
          height:
            `${boardHeight}px`,
        }}
      >
        {rows.map(
          (row) => {
            const livePlayer =
              settled
                ? row.afterPlayer
                : row.beforePlayer

            const achievementPlayer =
              revealAchievements
                ? row.afterPlayer
                : row.beforePlayer

            const liveIndex =
              settled
                ? row.afterIndex
                : row.beforeIndex

            const top =
              liveIndex *
              (
                ROW_HEIGHT +
                ROW_GAP
              )

            return (
              <article
                className={`cleanTransitionRow ${
                  settled
                    ? 'settled'
                    : ''
                }`}
                key={
                  row.id
                }
                style={{
                  top:
                    `${top}px`,
                }}
              >
                <div className="cleanTransitionRank">
                  {
                    liveIndex +
                    1
                  }
                </div>

                <div className="cleanTransitionMain">
                  <div className="cleanTransitionNameLine">
                    <h2>
                      {getName(
                        livePlayer.playerId
                      )}
                    </h2>

                  </div>

                  {(achievementPlayer.wins >
                    0 ||
                    (achievementPlayer.jimWins ??
                      0) >
                      0) && (
                    <div className="cleanTransitionMeta">
                      {achievementPlayer.wins >
                        0 && (
                        <Tally
                          count={
                            achievementPlayer.wins
                          }
                          pop={
                            revealAchievements &&
                            row.standardDelta >
                              0
                          }
                        />
                      )}

                      {(achievementPlayer.jimWins ??
                        0) >
                        0 && (
                        <Stars
                          count={
                            achievementPlayer.jimWins ??
                            0
                          }
                          pop={
                            revealAchievements &&
                            row.jimDelta >
                              0
                          }
                        />
                      )}
                    </div>
                  )}
                </div>

                {showReward &&
                  row.amount !==
                    0 && (
                  <div
                    className={`cleanRewardBubble ${
                      row.amount >
                      0
                        ? 'gain'
                        : 'loss'
                    }`}
                    style={{
                      animation:
                        'rewardIn 300ms ease-out',
                    }}
                  >
                    <strong>
                      {row.amount >
                      0
                        ? `+${row.amount}`
                        : row.amount}
                    </strong>

                    {row.standardDelta >
                      0 && (
                      <span className="rewardTally">
                        │
                      </span>
                    )}

                    {row.jimDelta >
                      0 && (
                      <span className="rewardStar">
                        ★
                      </span>
                    )}
                  </div>
                )}

                <div className="cleanTransitionPoints">
                  <AnimatedPoints
                    from={
                      row.beforePlayer.points
                    }
                    to={
                      row.afterPlayer.points
                    }
                    animate={
                      settled
                    }
                  />

                  <span>
                    PTS
                  </span>
                </div>
              </article>
            )
          }
        )}
      </section>
    </main>
  )
}
