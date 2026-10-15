import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { lockChartLandscape, unlockChartLandscape } from './lib/chartOrientation'

import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
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
  onExpandedChange?: (expanded: boolean) => void
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
  crowned?: boolean
}

const GOALPOST_GOLD =
  '#c98232'

const GOALPOST_GOLD_LABEL =
  'rgba(201, 130, 50, 0.78)'

const GOALPOST_LINE_OPACITY =
  0.34

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
  crowned = false,
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

      {crowned && (
        <tspan
          dx={6}
          fill={
            GOALPOST_GOLD
          }
          fontSize={17}
          fontWeight={950}
        >
          ♛
        </tspan>
      )}
    </text>
  )
}

export default function TitleRace({
  session,
  sessionPlayers,
  players,
  onBack,
  onExpandedChange,
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

  const penaltyResults =
  useLiveQuery(
    () =>
      db.penaltyResults
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

  const [raceExpanded, setRaceExpanded] = useState(false)
  // Keep a synchronous flag for Android Back events which may arrive before
  // React has painted the expanded overlay.
  const raceExpandedRef = useRef(false)
  const racePlotRef = useRef<HTMLElement | null>(null)
  // Native range dragging is unreliable inside a 90-degree rotated
  // landscape fallback on Android WebView. Track the finger ourselves.
  const expandedScrubPointer = useRef<number | null>(null)

  function changeRaceExpanded(expanded: boolean) {
    raceExpandedRef.current = expanded
    setRaceExpanded(expanded)
    onExpandedChange?.(expanded)
  }
  const [racePlotWidth, setRacePlotWidth] = useState(0)

  // Reserve only the room that endpoint names need. A fixed 120 px
  // margin was squeezing the plot on phones.
  useEffect(() => {
    const element = racePlotRef.current
    if (!element) return

    const update = () => {
      const width = Math.round(element.getBoundingClientRect().width)
      setRacePlotWidth(previous => previous === width ? previous : width)
    }
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [raceExpanded])

  const endpointMargin = racePlotWidth < 450
    ? 74
    : racePlotWidth < 760
      ? 90
      : 120

  useEffect(() => {
    if (!raceExpanded) return
    let active = true
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    void lockChartLandscape().then(locked => {
      if (!active && locked) void unlockChartLandscape()
    })
    return () => {
      active = false
      document.body.style.overflow = previousOverflow
      void unlockChartLandscape()
    }
  }, [raceExpanded])

  // Listen while Title Race is mounted, instead of installing Android Back
  // only after the expansion effect runs. The parent also checks this state
  // as a fallback before navigating back to Sessions.
  useEffect(() => {
    const onBack = (event: Event) => {
      if (!raceExpandedRef.current) return
      changeRaceExpanded(false)
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const onCloseRequest = () => {
      if (raceExpandedRef.current) changeRaceExpanded(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && raceExpandedRef.current) {
        event.preventDefault()
        changeRaceExpanded(false)
      }
    }
    window.addEventListener('jimrami-back-request', onBack, true)
    window.addEventListener('jimrami-title-race-close-expanded', onCloseRequest)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('jimrami-back-request', onBack, true)
      window.removeEventListener('jimrami-title-race-close-expanded', onCloseRequest)
      window.removeEventListener('keydown', onEscape)
    }
  }, [onExpandedChange])

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
  !jimResults ||
  !penaltyResults
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
            const penaltiesAtZero =
            penaltyResults.filter(
                (penalty) =>
                penalty.roundNumber === 0
            )

            penaltiesAtZero.forEach(
            (penalty) => {
                totals[
                penalty.playerId
                ] =
                (totals[
                    penalty.playerId
                ] ?? 0) +
                penalty.pointsAwarded
            }
            )
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
                const penalties =
                penaltyResults.filter(
                    (penalty) =>
                    penalty.roundNumber ===
                    round.roundNumber
                )

                penalties.forEach(
                (penalty) => {
                    totals[
                    penalty.playerId
                    ] =
                    (totals[
                        penalty.playerId
                    ] ?? 0) +
                    penalty.pointsAwarded
                }
                )
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
    penaltyResults,
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

  const goalpostEvents =
    session.goalpostEvents ?? []

  const reachedGoalpostTargets =
    Array.from(
      new Set(
        goalpostEvents.map(
          (event) =>
            event.target
        )
      )
    )

  const currentGoalpost =
    session.goalpostCurrent

  const currentGoalpostReached =
    currentGoalpost !==
      undefined &&
    goalpostEvents.some(
      (event) =>
        event.target ===
        currentGoalpost
    )

  /*
    An unreached future goalpost should
    not flatten an early race.

    It only enters the Y scale when the
    leader is within roughly 25% of it.
  */
  const rawMaximum =
    Math.max(
      0,
      ...allTimelineValues
    )

  const futureGoalpost =
    currentGoalpost !==
      undefined &&
    !currentGoalpostReached &&
    session.status === 'active'
      ? currentGoalpost
      : undefined

  const showFutureGoalpostLine =
    futureGoalpost !==
      undefined &&
    rawMaximum >=
      futureGoalpost * 0.75

  const latestGoalpostEventAtPlayhead =
    goalpostEvents
      .filter(
        (event) =>
          event.roundReached <=
          playhead
      )
      .reduce<
        | (typeof goalpostEvents)[number]
        | undefined
      >(
        (
          latest,
          event
        ) =>
          !latest ||
          event.roundReached >
            latest.roundReached
            ? event
            : latest,
        undefined
      )

  // A completed session may no longer have a "future" goalpost.
  // Still draw its saved initial/current target once the race reaches it.
  const nearbyGoalpostTargets = [
    session.goalpostInitial,
    currentGoalpost,
  ].filter((target): target is number =>
    typeof target === 'number' &&
    Number.isFinite(target) &&
    target > 0 &&
    rawMaximum >= target * 0.75
  )

  const goalpostLineTargets =
    Array.from(
      new Set([
        ...reachedGoalpostTargets,
        ...nearbyGoalpostTargets,
        ...(showFutureGoalpostLine && futureGoalpost !== undefined
          ? [futureGoalpost]
          : []),
      ])
    ).sort((a, b) => a - b)

  const rawMinimum =
    Math.min(
      0,
      ...allTimelineValues
    )

  const goalpostCeiling =
    goalpostLineTargets.length >
    0
      ? Math.max(
          ...goalpostLineTargets
        )
      : 0

  const yMaximum =
    Math.max(
      3,
      rawMaximum + 1.2,
      goalpostCeiling + 1.2
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

  function scrubExpandedRace(
    input: HTMLInputElement,
    clientX: number,
    clientY: number
  ) {
    const bounds = input.getBoundingClientRect()
    if (!bounds.width || !bounds.height || lastIndex === 0) return

    // The portrait fallback rotates the entire chart stage clockwise.
    // A horizontal range then appears vertical in screen coordinates.
    const rotated = bounds.height > bounds.width * 1.5
    const progress = rotated
      ? (clientY - bounds.top) / bounds.height
      : (clientX - bounds.left) / bounds.width
    const nextRound = Math.round(
      Math.max(0, Math.min(1, progress)) * lastIndex * 100
    ) / 100
    setPlaying(false)
    setPlayhead(nextRound)
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
  !jimResults ||
  !penaltyResults
  ) {
    return (
      <main className="app">
        <p>Loading race...</p>
      </main>
    )
  }

  const racePlot = (
          <section
            className="raceChart"
            ref={racePlotRef}
            onMouseDownCapture={event => {
              if (event.target instanceof SVGElement) event.preventDefault()
            }}
            onFocusCapture={event => {
              if (event.target instanceof SVGElement) {
                (event.target as SVGElement & { blur?: () => void }).blur?.()
              }
            }}
            onClickCapture={event => {
              if (event.target instanceof SVGElement) {
                (event.target as SVGElement & { blur?: () => void }).blur?.()
              }
            }}
          >
            <button
              type="button"
              className="jimChartExpandButton jimRaceExpandButton"
              aria-label={raceExpanded ? 'Close landscape view' : 'Expand Title Race in landscape'}
              title={raceExpanded ? 'Exit landscape' : 'Expand landscape'}
              onClick={() => changeRaceExpanded(!raceExpandedRef.current)}
            >
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {raceExpanded ? <path d="M9 3v6H3M15 3v6h6M3 15h6v6M21 15h-6v6" /> : <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />}
              </svg>
            </button>
            {futureGoalpost !==
              undefined &&
              !showFutureGoalpostLine && (
              <div className="raceFutureGoalpostBadge">
                <span>
                  GOALPOST
                </span>

                <strong>
                  {
                    futureGoalpost
                  }
                </strong>
              </div>
            )}

            <ResponsiveContainer
              width="100%"
              height={raceExpanded ? '100%' : CHART_HEIGHT}
            >
              <LineChart
                accessibilityLayer={false}
                data={visibleData}
                margin={{
                  top: 25,
                  right: endpointMargin,
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

                {goalpostLineTargets.map(
                  (target) => (
                    <ReferenceLine
                      key={`goalpost-${target}`}
                      y={target}
                      stroke={
                        GOALPOST_GOLD
                      }
                      strokeOpacity={
                        GOALPOST_LINE_OPACITY
                      }
                      strokeWidth={2}
                      strokeDasharray="7 6"
                      ifOverflow="extendDomain"
                      label={{
                        value:
                          `GOALPOST ${target}`,
                        position:
                          'insideTopLeft',
                        fill:
                          GOALPOST_GOLD_LABEL,
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    />
                  )
                )}

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
                        activeDot={false}
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
                                crowned={
                                  latestGoalpostEventAtPlayhead
                                    ?.winnerPlayerId ===
                                  player.playerId
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
  )

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
          {!raceExpanded && racePlot}
          {createPortal(
            <AnimatePresence>
              {raceExpanded && (
                <motion.div
                  key="title-race-overlay"
                  className="jimChartModalOverlay jimRaceModalOverlay"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Title Race landscape view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="jimRaceLandscapeStage">
                    <div className="jimRaceLandscapeToolbar">
                      <strong>Title Race • Round {completedRound}</strong>
                      <div className="jimChartModalActions jimRaceExpandedActions">
                        <button type="button" className="raceSpeed" onClick={cycleSpeed} aria-label="Change playback speed">{playbackSpeed}×</button>
                        <button type="button" className="racePlay" onClick={togglePlayback} disabled={lastIndex === 0}>
                          {playing ? 'Pause' : playhead >= lastIndex ? 'Replay' : 'Play'}
                        </button>
                      </div>
                    </div>
                    <div className="jimRaceFullscreenChart">{racePlot}</div>
                    <div className="jimRaceLandscapeControls">
                      <input
                        aria-label="Select race round"
                        type="range"
                        style={{ accentColor: '#f2f4f6', touchAction: 'none' }}
                        min="0"
                        max={lastIndex}
                        step="0.01"
                        value={playhead}
                        onPointerDown={event => {
                          if (event.pointerType === 'mouse' && event.button !== 0) return
                          expandedScrubPointer.current = event.pointerId
                          event.currentTarget.setPointerCapture(event.pointerId)
                          scrubExpandedRace(event.currentTarget, event.clientX, event.clientY)
                          event.preventDefault()
                        }}
                        onPointerMove={event => {
                          if (expandedScrubPointer.current !== event.pointerId) return
                          scrubExpandedRace(event.currentTarget, event.clientX, event.clientY)
                          event.preventDefault()
                        }}
                        onPointerUp={event => {
                          if (expandedScrubPointer.current !== event.pointerId) return
                          scrubExpandedRace(event.currentTarget, event.clientX, event.clientY)
                          expandedScrubPointer.current = null
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            event.currentTarget.releasePointerCapture(event.pointerId)
                          }
                        }}
                        onPointerCancel={() => { expandedScrubPointer.current = null }}
                        onLostPointerCapture={() => { expandedScrubPointer.current = null }}
                        onChange={event => {
                          // Keep keyboard and direct-tap changes working.
                          if (expandedScrubPointer.current !== null) return
                          setPlaying(false)
                          setPlayhead(Number(event.target.value))
                        }}
                      />
                      <span>Round {completedRound} / {lastIndex}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>, document.body
          )}

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