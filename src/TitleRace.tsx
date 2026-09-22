import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'

import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

type LabelViewBox = {
  x?: number
  y?: number
  width?: number
  height?: number
  cx?: number
  cy?: number
}

type EndpointLabelProps = {
  viewBox?: LabelViewBox
  name: string
  color: string
  offsetY: number
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

const PLAYBACK_MS_PER_ROUND = 1200
const PLAYBACK_SPEEDS = [0.5, 1, 2, 4]

const CHART_HEIGHT = 500
const PLOT_TOP = 25
const PLOT_BOTTOM = 35
const PLOT_HEIGHT =
  CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM

/*
  Custom endpoint label.

  Recharts still decides where the real
  dot belongs.

  We only move the TEXT vertically when
  names would overlap.
*/
function EndpointLabel({
  viewBox,
  name,
  color,
  offsetY,
}: EndpointLabelProps) {
  if (!viewBox) {
    return null
  }

  const x =
    viewBox.cx ??
    (viewBox.x ?? 0) +
      (viewBox.width ?? 0) / 2

  const y =
    viewBox.cy ??
    (viewBox.y ?? 0) +
      (viewBox.height ?? 0) / 2

  return (
    <text
      x={x + 12}
      y={y + offsetY}
      fill={color}
      fontSize={14}
      fontWeight={850}
      dominantBaseline="middle"
    >
      {name}
    </text>
  )
}

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
    playhead can contain decimals internally.

    2.5 means the animation is halfway
    between Round 2 and Round 3.

    The user-facing UI still only shows
    completed whole rounds.
  */
  const [playhead, setPlayhead] =
    useState(0)

  const [playing, setPlaying] =
    useState(false)

  const [
    playbackSpeed,
    setPlaybackSpeed,
  ] = useState(1)

  function getName(playerId: number) {
    return (
      players.find(
        (player) =>
          player.id === playerId
      )?.name ?? 'Unknown'
    )
  }

  /*
    Build the actual historical
    cumulative points timeline.
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

    sessionPlayers.forEach((player) => {
      totals[player.playerId] = 0
    })

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
      Everyone begins at zero.
    */
    data.push(makeRow(0))

    rounds.forEach((round) => {
      /*
        STANDARD ROUND
      */
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

      /*
        JIM ROUND
      */
      if (round.type === 'jim') {
        const result =
          jimResults.find(
            (jim) =>
              jim.roundId ===
              round.id
          )

        if (result) {
          /*
            Jim:
            win  = +7
            loss = -3
          */
          totals[
            result.jimPlayerId
          ] =
            (totals[
              result.jimPlayerId
            ] ?? 0) +
            result.jimPointsAwarded

          /*
            Catcher gets +1
            if Jim loses.
          */
          if (
            result.caughtByPlayerId !==
            undefined
          ) {
            totals[
              result.caughtByPlayerId
            ] =
              (totals[
                result.caughtByPlayerId
              ] ?? 0) +
              result.catcherPointsAwarded
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
    When Title Race is opened,
    begin at the latest round.
  */
  useEffect(() => {
    if (timeline.length > 0) {
      setPlayhead(
        timeline.length - 1
      )
    }
  }, [timeline.length])

  /*
    Smooth playback using
    requestAnimationFrame.

    This synchronises the animation
    with the browser's drawing cycle.
  */
  useEffect(() => {
    if (!playing) return

    const startingPlayhead =
      playhead

    const startingTime =
      performance.now()

    let animationFrame = 0

    function animate(now: number) {
      const elapsed =
        now - startingTime

      const durationPerRound =
        PLAYBACK_MS_PER_ROUND /
        playbackSpeed

      const nextPlayhead =
        Math.min(
          startingPlayhead +
            elapsed /
              durationPerRound,
          lastIndex
        )

      setPlayhead(nextPlayhead)

      if (
        nextPlayhead <
        lastIndex
      ) {
        animationFrame =
          requestAnimationFrame(
            animate
          )
      } else {
        setPlaying(false)
      }
    }

    animationFrame =
      requestAnimationFrame(
        animate
      )

    return () => {
      cancelAnimationFrame(
        animationFrame
      )
    }
  }, [
    playing,
    lastIndex,
    playbackSpeed,
  ])

  /*
    Only completed rounds count
    toward the official displayed
    standings.

    Therefore no fake scores like 4.7.
  */
  const completedRound =
    Math.min(
      Math.floor(
        playhead + 0.0001
      ),
      lastIndex
    )

  /*
    Build the moving temporary endpoint.

    Example:
    halfway between 3 and 10 points
    becomes 6.5 internally.

    That value is used only to animate
    the line.
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
    Official standings use the most
    recently COMPLETED round.
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
              b.points -
                a.points ||
              a.name.localeCompare(
                b.name
              )
          )
      : []

  /*
    FIXED X AXIS

    This was the big smoothness fix.

    The chart itself no longer grows
    during playback.
  */
  const xMaximum =
    Math.max(
      lastIndex,
      1
    )

  const xTicks =
    Array.from(
      {
        length:
          lastIndex + 1,
      },
      (_, index) => index
    )

  /*
    FIXED Y AXIS

    Find every score that occurs
    throughout the whole session.
  */
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
    Whole-number Y axis labels.
  */
  const yRange =
    yMaximum - yMinimum

  const yStep =
    yRange > 20
      ? 5
      : yRange > 10
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

  /*
    ENDPOINT NAME COLLISION SYSTEM

    This works in PIXELS rather than
    checking whether scores are equal.

    Therefore scores such as:

    3
    3
    2.8
    2.6

    can still have readable names.
  */
  const labelOffsets =
    useMemo(() => {
      const offsets:
        Record<number, number> = {}

      if (!animatedRow) {
        return offsets
      }

      const minimumGap = 20

      const minimumY =
        PLOT_TOP + 6

      const maximumY =
        PLOT_TOP +
        PLOT_HEIGHT -
        6

      const labels =
        sessionPlayers
          .map((player) => {
            const key =
              `player-${player.playerId}`

            const score =
              animatedRow[key] ?? 0

            const normalized =
              (yMaximum - score) /
              (yMaximum -
                yMinimum)

            const desiredY =
              PLOT_TOP +
              normalized *
                PLOT_HEIGHT

            return {
              playerId:
                player.playerId,

              desiredY,

              finalY:
                desiredY,
            }
          })
          .sort(
            (a, b) =>
              a.desiredY -
              b.desiredY
          )

      /*
        First pass:
        push overlapping labels downward.
      */
      for (
        let index = 1;
        index < labels.length;
        index++
      ) {
        const previous =
          labels[index - 1]

        const current =
          labels[index]

        if (
          current.finalY -
            previous.finalY <
          minimumGap
        ) {
          current.finalY =
            previous.finalY +
            minimumGap
        }
      }

      /*
        If the lowest label went outside
        the chart, move it back up and
        work backwards.
      */
      if (
        labels.length > 0 &&
        labels[
          labels.length - 1
        ].finalY > maximumY
      ) {
        labels[
          labels.length - 1
        ].finalY = maximumY

        for (
          let index =
            labels.length - 2;
          index >= 0;
          index--
        ) {
          const current =
            labels[index]

          const below =
            labels[index + 1]

          current.finalY =
            Math.min(
              current.finalY,
              below.finalY -
                minimumGap
            )
        }
      }

      /*
        Protect the top boundary too.
      */
      if (
        labels.length > 0 &&
        labels[0].finalY <
          minimumY
      ) {
        labels[0].finalY =
          minimumY

        for (
          let index = 1;
          index < labels.length;
          index++
        ) {
          const previous =
            labels[index - 1]

          const current =
            labels[index]

          current.finalY =
            Math.max(
              current.finalY,
              previous.finalY +
                minimumGap
            )
        }
      }

      /*
        Convert final positions into
        simple vertical offsets from
        each player's real endpoint.
      */
      labels.forEach((label) => {
        offsets[label.playerId] =
          label.finalY -
          label.desiredY
      })

      return offsets
    }, [
      animatedRow,
      sessionPlayers,
      yMaximum,
      yMinimum,
    ])

  function togglePlayback() {
    if (playing) {
      setPlaying(false)
      return
    }

    /*
      Replay from the beginning if
      already at the latest round.
    */
    if (
      playhead >= lastIndex
    ) {
      setPlayhead(0)
    }

    setPlaying(true)
  }

  function cycleSpeed() {
    const currentIndex =
      PLAYBACK_SPEEDS.indexOf(
        playbackSpeed
      )

    const nextIndex =
      (currentIndex + 1) %
      PLAYBACK_SPEEDS.length

    setPlaybackSpeed(
      PLAYBACK_SPEEDS[
        nextIndex
      ]
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
            onClick={
              togglePlayback
            }
            disabled={
              lastIndex === 0
            }
          >
            {playing
              ? 'Pause'
              : playhead >=
                  lastIndex
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
              height={CHART_HEIGHT}
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
                  allowDecimals={
                    false
                  }
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
                  allowDecimals={
                    false
                  }
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
                      Number(
                        value
                      )
                    )}`
                  }
                  formatter={(
                    value
                  ) =>
                    Math.round(
                      Number(
                        value
                      )
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
                        >
                          <Label
                            content={
                              <EndpointLabel
                                name={getName(
                                  player.playerId
                                )}
                                color={
                                  color
                                }
                                offsetY={
                                  labelOffsets[
                                    player.playerId
                                  ] ?? 0
                                }
                              />
                            }
                          />
                        </ReferenceDot>
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
                    type:
                      'spring',

                    stiffness:
                      450,

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