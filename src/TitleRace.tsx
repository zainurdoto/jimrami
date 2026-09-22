import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useLiveQuery } from 'dexie-react-hooks'

import { motion } from 'motion/react'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts'

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
}

const lineColors = [
  '#f2f4f6',
  '#d9ae4b',
  '#6fa8dc',
  '#df7b85',
  '#8dc99a',
  '#ad8bd8',
  '#e19b62',
  '#77c6c3',
]

const PLAYBACK_INTERVAL = 20
const PLAYBACK_MS_PER_ROUND = 1200
const PLAYBACK_SPEEDS = [0.5, 1, 2, 4]

export default function TitleRace({
  session,
  sessionPlayers,
  players,
  onBack,
}: Props) {
  const rounds = useLiveQuery(
    () =>
      db.rounds
        .where('sessionId')
        .equals(session.id)
        .sortBy('roundNumber'),
    [session.id]
  )

  const standardResults = useLiveQuery(
    () =>
      db.roundResults
        .where('sessionId')
        .equals(session.id)
        .toArray(),
    [session.id]
  )

  const jimResults = useLiveQuery(
    () =>
      db.jimResults
        .where('sessionId')
        .equals(session.id)
        .toArray(),
    [session.id]
  )

  /*
    This is our continuously-moving
    position through history.

    2.5 means visually halfway
    between rounds 2 and 3.

    It is ONLY for animation.
    The user never needs to see 2.5.
  */
  const [playhead, setPlayhead] =
    useState(0)

  const [playing, setPlaying] =
    useState(false)

const [playbackSpeed, setPlaybackSpeed] =
  useState(1)

  function getName(playerId: number) {
    return (
      players.find(
        (player) =>
          player.id === playerId
      )?.name ?? 'Unknown'
    )
  }

  /*
    Build the real historical scores.
  */
  const timeline = useMemo(() => {
    if (
      !rounds ||
      !standardResults ||
      !jimResults
    ) {
      return []
    }

    const totals:
      Record<number, number> = {}

    sessionPlayers.forEach(
      (player) => {
        totals[player.playerId] = 0
      }
    )

    const data:
      Record<string, number>[] = []

    function makeRow(
      roundNumber: number
    ) {
      const row:
        Record<string, number> = {
          round: roundNumber,
        }

      sessionPlayers.forEach(
        (player) => {
          row[
            `player-${player.playerId}`
          ] =
            totals[
              player.playerId
            ] ?? 0
        }
      )

      return row
    }

    /*
      Starting line.
    */
    data.push(makeRow(0))

    rounds.forEach((round) => {
      if (
        round.type === 'standard'
      ) {
        const results =
          standardResults.filter(
            (result) =>
              result.roundId ===
              round.id
          )

        results.forEach(
          (result) => {
            totals[
              result.playerId
            ] =
              (totals[
                result.playerId
              ] ?? 0) +
              result.pointsAwarded
          }
        )
      }

      if (round.type === 'jim') {
        const result =
          jimResults.find(
            (jim) =>
              jim.roundId ===
              round.id
          )

        if (result) {
          totals[
            result.jimPlayerId
          ] =
            (totals[
              result.jimPlayerId
            ] ?? 0) +
            result.jimPointsAwarded

          if (
            result.caughtByPlayerId !==
            undefined
          ) {
            totals[
              result.caughtByPlayerId
            ] =
              (totals[
                result
                  .caughtByPlayerId
              ] ?? 0) +
              result
                .catcherPointsAwarded
          }
        }
      }

      data.push(
        makeRow(
          round.roundNumber
        )
      )
    })

    return data
  }, [
    rounds,
    standardResults,
    jimResults,
    sessionPlayers,
  ])

  const lastIndex =
    Math.max(
      timeline.length - 1,
      0
    )

  /*
    Open the page at the latest round.
  */
  useEffect(() => {
    if (timeline.length > 0) {
      setPlayhead(
        timeline.length - 1
      )
    }
  }, [timeline.length])

  /*
    Smooth playback.
  */
useEffect(() => {
  if (!playing) return

  const startingPlayhead = playhead
  const startingTime = performance.now()

  let animationFrame = 0

  function animate(now: number) {
    const elapsed = now - startingTime

const nextPlayhead = Math.min(
  startingPlayhead +
    elapsed /
      (PLAYBACK_MS_PER_ROUND / playbackSpeed),
  lastIndex
)

    setPlayhead(nextPlayhead)

    if (nextPlayhead < lastIndex) {
      animationFrame =
        requestAnimationFrame(animate)
    } else {
      setPlaying(false)
    }
  }

  animationFrame =
    requestAnimationFrame(animate)

  return () => {
    cancelAnimationFrame(animationFrame)
  }
}, [playing, lastIndex, playbackSpeed])


  const completedRound =
    Math.min(
      Math.floor(
        playhead + 0.0001
      ),
      lastIndex
    )

  /*
    Produce one temporary moving
    data point for the chart.
  */
  const visibleData =
    useMemo(() => {
      if (
        timeline.length === 0
      ) {
        return []
      }

      const lowerIndex =
        Math.floor(playhead)

      const fraction =
        playhead - lowerIndex

      const data =
        timeline.slice(
          0,
          lowerIndex + 1
        )

      if (
        fraction === 0 ||
        lowerIndex >= lastIndex
      ) {
        return data
      }

      const current =
        timeline[lowerIndex]

      const next =
        timeline[
          lowerIndex + 1
        ]

      if (!current || !next) {
        return data
      }

      const interpolated:
        Record<string, number> = {
          round: playhead,
        }

      sessionPlayers.forEach(
        (player) => {
          const key =
            `player-${player.playerId}`

          const start =
            current[key] ?? 0

          const finish =
            next[key] ?? start

          interpolated[key] =
            start +
            (finish - start) *
              fraction
        }
      )

      return [
        ...data,
        interpolated,
      ]
    }, [
      timeline,
      playhead,
      lastIndex,
      sessionPlayers,
    ])

  const animatedRow =
    visibleData[
      visibleData.length - 1
    ]

  /*
    Official scoreboard uses only the
    last COMPLETED round.

    Therefore:
    no fake decimals.
  */
  const officialRow =
    timeline[
      completedRound
    ]

  const standings =
    officialRow
      ? sessionPlayers
          .map((player) => ({
            playerId:
              player.playerId,

            name: getName(
              player.playerId
            ),

            points:
              officialRow[
                `player-${player.playerId}`
              ] ?? 0,
          }))
          .sort(
            (a, b) =>
              b.points - a.points ||
              a.name.localeCompare(
                b.name
              )
          )
      : []


const xMaximum =
  Math.max(lastIndex, 1)


const xTicks =
  Array.from(
    {
      length: lastIndex + 1,
    },
    (_, index) => index
  )

const allTimelineValues =
  timeline.flatMap((row) =>
    sessionPlayers.map(
      (player) =>
        row[
          `player-${player.playerId}`
        ] ?? 0
    )
  )

const rawMaximum =
  Math.max(
    0,
    ...allTimelineValues
  )

const rawMinimum =
  Math.min(
    0,
    ...allTimelineValues
  )
  /*
    Padding around the highest and
    lowest visible score.
  */
  const yMaximum =
    Math.max(
      3,
      rawMaximum + 1.2
    )

  const yMinimum =
    Math.min(
      0,
      rawMinimum - 1
    )

  /*
    Integer Y labels.

    Scale can move smoothly underneath,
    but the user sees whole numbers.
  */
  const yStep =
    yMaximum - yMinimum > 20
      ? 5
      : yMaximum - yMinimum > 10
        ? 2
        : 1

  const yTicks: number[] = []

  for (
    let value =
      Math.ceil(
        yMinimum / yStep
      ) * yStep;
    value <= yMaximum;
    value += yStep
  ) {
    yTicks.push(value)
  }

  function togglePlayback() {
    if (playing) {
      setPlaying(false)
      return
    }

    if (
      playhead >= lastIndex
    ) {
      setPlayhead(0)
    }

    setPlaying(true)
  }

  function cycleSpeed() {
  const currentIndex =
    PLAYBACK_SPEEDS.indexOf(playbackSpeed)

  const nextIndex =
    (currentIndex + 1) %
    PLAYBACK_SPEEDS.length

  setPlaybackSpeed(
    PLAYBACK_SPEEDS[nextIndex]
  )
}

  if (
    !rounds ||
    !standardResults ||
    !jimResults
  ) {
    return (
      <main className="app">
        <p>Loading race...</p>
      </main>
    )
  }

  return (
    <main className="app racePage">
      <header className="raceHeader">
        <button
          className="roundBack"
          onClick={onBack}
        >
          ←
        </button>

        <div>
          <span>
            TITLE RACE
          </span>

          <h1>
            Round{' '}
            {completedRound}
          </h1>
        </div>

<div className="raceHeaderActions">
  <button
    className="raceSpeed"
    onClick={cycleSpeed}
  >
    {playbackSpeed}×
  </button>

  <button
    className="racePlay"
    onClick={togglePlayback}
    disabled={lastIndex === 0}
  >
    {playing
      ? 'Pause'
      : playhead >= lastIndex
        ? 'Replay'
        : 'Play'}
  </button>
</div>
      </header>

      {lastIndex === 0 ? (
        <div className="raceEmpty">
          Complete a round to
          start the title race.
        </div>
      ) : (
        <>
          <section className="raceChart">
            <ResponsiveContainer
              width="100%"
              height={500}
            >
              <LineChart
                data={visibleData}
                margin={{
                  top: 25,
                  right: 120,
                  left: 5,
                  bottom: 5,
                }}
              >
                <CartesianGrid
                  stroke="#2a313b"
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="round"
                  type="number"
                  domain={[
                    0,
                    xMaximum,
                  ]}
                  ticks={xTicks}
                  allowDataOverflow
                  allowDecimals={false}
                  stroke="#7f8997"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(
                    value
                  ) =>
                    String(
                      Math.round(
                        Number(
                          value
                        )
                      )
                    )
                  }
                />

                <YAxis
                  type="number"
                  domain={[
                    yMinimum,
                    yMaximum,
                  ]}
                  ticks={yTicks}
                  allowDataOverflow
                  allowDecimals={false}
                  stroke="#7f8997"
                  tickLine={false}
                  axisLine={false}
                />

                <Tooltip
                  contentStyle={{
                    background:
                      '#171c24',

                    border:
                      '1px solid #303844',

                    borderRadius:
                      12,
                  }}
                  labelStyle={{
                    color:
                      '#ffffff',
                  }}
                  labelFormatter={(
                    value
                  ) =>
                    `Round ${Math.round(
                      Number(value)
                    )}`
                  }
                  formatter={(
                    value
                  ) =>
                    Math.round(
                      Number(value)
                    )
                  }
                />

                {sessionPlayers.map(
                  (
                    player,
                    index
                  ) => {
                    const color =
                      lineColors[
                        index %
                          lineColors.length
                      ]

                    return (
                      <Line
                        key={
                          player.playerId
                        }
                        type="linear"
                        dataKey={`player-${player.playerId}`}
                        name={getName(
                          player.playerId
                        )}
                        stroke={color}
                        strokeWidth={4}
                        dot={false}
                        activeDot={{
                          r: 6,
                        }}
                        isAnimationActive={
                          false
                        }
                      />
                    )
                  }
                )}

                {animatedRow &&
                  sessionPlayers.map(
                    (
                      player,
                      index
                    ) => {
                      const color =
                        lineColors[
                          index %
                            lineColors.length
                        ]

                      const key =
                        `player-${player.playerId}`

                      return (
                        <ReferenceDot
                          key={`head-${player.playerId}`}
                          x={playhead}
                          y={
                            animatedRow[
                              key
                            ] ?? 0
                          }
                          r={5}
                          fill={color}
                          stroke="#0d1015"
                          strokeWidth={2}
                          isFront
                          label={{
                            value:
                              getName(
                                player.playerId
                              ),

                            position:
                              'right',

                            fill:
                              color,

                            fontSize:
                              14,

                            fontWeight:
                              800,
                          }}
                        />
                      )
                    }
                  )}
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="raceControls">
            <input
              type="range"
              min="0"
              max={lastIndex}
              step="0.01"
              value={playhead}
              onChange={(
                event
              ) => {
                setPlaying(false)

                setPlayhead(
                  Number(
                    event.target
                      .value
                  )
                )
              }}
            />

            <div className="raceRoundCount">
              Round{' '}
              {completedRound}
              {' / '}
              {lastIndex}
            </div>
          </section>

          <section className="raceStandings">
            {standings.map(
              (
                player,
                index
              ) => (
                <motion.div
                  layout
                  transition={{
                    type: 'spring',
                    stiffness: 450,
                    damping: 38,
                  }}
                  className="raceStanding"
                  key={
                    player.playerId
                  }
                >
                  <span>
                    {index + 1}
                  </span>

                  <strong>
                    {player.name}
                  </strong>

                  <b>
                    {player.points}
                  </b>
                </motion.div>
              )
            )}
          </section>
        </>
      )}
    </main>
  )
}