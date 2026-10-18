import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

import { useLiveQuery } from 'dexie-react-hooks'

import {
  db,
  type JimResult,
  type Player,
} from './db'

import TitleRace from './TitleRace'
import RoundEditor from './RoundEditor'


/** One skull = one JIM attempt that ended in a catch / failure. */
export function JimSkullIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.5a8.3 8.3 0 0 0-8.3 8.3c0 3.1 1.4 5.4 3.8 7V20a1.5 1.5 0 0 0 1.5 1.5h6A1.5 1.5 0 0 0 16.5 20v-2.2c2.4-1.6 3.8-3.9 3.8-7A8.3 8.3 0 0 0 12 2.5Z" />
      <circle cx="9" cy="12.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12.5" r="1.4" fill="currentColor" stroke="none" />
      <path d="m12 15.3-1 1.5h2l-1-1.5Z" fill="currentColor" stroke="none" />
      <path d="M10 18.5v2.3M14 18.5v2.3" />
    </svg>
  )
}

function JimFailSkulls({
  failures,
  transition = false,
  pop = false,
}: {
  failures: JimResult[]
  transition?: boolean
  pop?: boolean
}) {
  if (!failures.length) return null

  const orderedFailures = [...failures].sort(
    (a, b) => a.roundId - b.roundId || a.id - b.id
  )

  return (
    <div
      className={`jimFailSkulls${transition ? ' transition' : ''}${pop ? ' pop' : ''}`}
      title={`${failures.length} failed JIM ${failures.length === 1 ? 'attempt' : 'attempts'}`}
      aria-label={`${failures.length} failed JIM ${failures.length === 1 ? 'attempt' : 'attempts'}`}
    >
      {orderedFailures.map((result) => (
        <span
          key={result.id}
          className="jimFailSkull"
          title={`JIM caught after surviving ${result.stepsSurvived} of 6 stages`}
          aria-hidden="true"
        >
          <JimSkullIcon />
        </span>
      ))}
    </div>
  )
}

function HistoryStandardWinTally({
  count,
}: {
  count: number
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
      className="standardWinTally"
      aria-label={`${count} Standard ${
        count === 1
          ? 'win'
          : 'wins'
      }`}
      title={`${count} Standard ${
        count === 1
          ? 'win'
          : 'wins'
      }`}
    >
      <div className="tallyGroups">
        {groups.map(
          (
            groupSize,
            groupIndex
          ) => (
            <span
              className="tallyGroup"
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
                    className="tallyMark"
                    key={
                      markIndex
                    }
                  />
                )
              )}

              {groupSize ===
                5 && (
                <i className="tallyStrike" />
              )}
            </span>
          )
        )}
      </div>
    </div>
  )
}

function HistoryJimWinStars({
  wins,
}: {
  wins: JimResult[]
}) {
  if (wins.length === 0) {
    return null
  }

  const orderedWins =
    [...wins].sort(
      (a, b) =>
        a.roundId -
          b.roundId ||
        a.id - b.id
    )

  return (
    <div
      className="jimWinStars"
      aria-label={`${wins.length} Jim ${
        wins.length === 1
          ? 'win'
          : 'wins'
      }`}
    >
      {orderedWins.map(
        (win) => {
          const usedHide =
            typeof win.hideStage ===
            'number'

          return (
            <span
              className={`jimWinStar ${
                usedHide
                  ? 'usedHide'
                  : 'hideless'
              }`}
              key={win.id}
              aria-label={
                usedHide
                  ? `Jim win, Hide used at Stage ${win.hideStage}`
                  : 'Jim win, no Hide used'
              }
              title={
                usedHide
                  ? `Jim win • Hide used at Stage ${win.hideStage}`
                  : 'Jim win • No Hide'
              }
            >
              ★
            </span>
          )
        }
      )}
    </div>
  )
}

function HistoryJimCatchScissors({
  catches,
}: {
  catches: JimResult[]
}) {
  if (catches.length === 0) {
    return null
  }

  const orderedCatches =
    [...catches].sort(
      (a, b) =>
        a.roundId -
          b.roundId ||
        a.id - b.id
    )

  return (
    <div
      className="jimCatchScissors"
      aria-label={`${catches.length} Jim ${
        catches.length === 1
          ? 'catch'
          : 'catches'
      }`}
    >
      {orderedCatches.map(
        (result) => (
          <span
            className="jimCatchScissor"
            key={result.id}
            title="Caught Jim"
            aria-label="Caught Jim"
          >
            ✂︎
          </span>
        )
      )}
    </div>
  )
}


type Props = {
  players: Player[]
  onBack: () => void
  initialAwardSessionId?: number
}

type Tab =
  | 'sessions'
  | 'players'
  | 'mvp'
  | 'awards'

type PlayerSort =
  | 'total'
  | 'average'
  | 'sessionsPlayed'
  | 'standardWins'
  | 'sessionWins'
  | 'jimWins'
  | 'jimRate'
  | 'jimAttempts'
  | 'jimCatches'
  | 'penakutSessions'
  | 'jimCaught'
  | 'standardRate'
  | 'sessionRate'


type PlayerSortOption = {
  value: PlayerSort
  label: string
}

type PlayerSortGroup = {
  label: string
  options: PlayerSortOption[]
}

const PLAYER_SORT_GROUPS:
  PlayerSortGroup[] = [
    {
      label: 'OVERALL',
      options: [
        {
          value: 'total',
          label: 'Total Points',
        },
        {
          value: 'average',
          label:
            'Average Points / Session',
        },
        {
          value: 'sessionsPlayed',
          label: 'Sessions Played',
        },
      ],
    },
    {
      label: 'WINS',
      options: [
        {
          value: 'standardWins',
          label: 'Total Standard Wins',
        },
        {
          value: 'sessionWins',
          label: 'Total Session Wins',
        },
        {
          value: 'jimWins',
          label: 'Total Jim Wins',
        },
      ],
    },
    {
      label: 'JIM',
      options: [
        {
          value: 'jimRate',
          label: 'Jim Success Rate',
        },
        {
          value: 'jimAttempts',
          label: 'Total Jim Attempts',
        },
        {
          value: 'jimCatches',
          label: 'Total Catches',
        },
        {
          value: 'jimCaught',
          label: 'Total Caught',
        },
        {
          value: 'penakutSessions',
          label: 'Penakut Sessions',
        },
      ],
    },
    {
      label: 'RATES',
      options: [
        {
          value: 'standardRate',
          label: 'Standard Win Rate',
        },
        {
          value: 'sessionRate',
          label: 'Session Win Rate',
        },
      ],
    },
  ]

function getPlayerSortLabel(
  value: PlayerSort
) {
  for (
    const group of
    PLAYER_SORT_GROUPS
  ) {
    const option =
      group.options.find(
        (entry) =>
          entry.value === value
      )

    if (option) {
      return option.label
    }
  }

  return 'Total Points'
}

function PlayerSortPicker({
  value,
  onChange,
}: {
  value: PlayerSort
  onChange: (
    value: PlayerSort
  ) => void
}) {
  const [
    open,
    setOpen,
  ] =
    useState(false)

  const rootRef =
    useRef<HTMLDivElement>(
      null
    )

  useEffect(
    () => {
      if (!open) {
        return
      }

      function handlePointerDown(
        event: PointerEvent
      ) {
        if (
          rootRef.current &&
          !rootRef.current.contains(
            event.target as Node
          )
        ) {
          setOpen(false)
        }
      }

      function handleKeyDown(
        event: KeyboardEvent
      ) {
        if (
          event.key === 'Escape'
        ) {
          setOpen(false)
        }
      }

      document.addEventListener(
        'pointerdown',
        handlePointerDown
      )

      document.addEventListener(
        'keydown',
        handleKeyDown
      )

      return () => {
        document.removeEventListener(
          'pointerdown',
          handlePointerDown
        )

        document.removeEventListener(
          'keydown',
          handleKeyDown
        )
      }
    },
    [open]
  )

  return (
    <div
      className="playerSortPicker"
      ref={rootRef}
    >
      <button
        type="button"
        className={`playerSortTrigger ${
          open
            ? 'open'
            : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
      >
        <span>
          {getPlayerSortLabel(
            value
          )}
        </span>

        <b aria-hidden="true">
          {open
            ? '▴'
            : '▾'}
        </b>
      </button>

      {open && (
        <div
          className="playerSortMenu"
          role="listbox"
          aria-label="Rank players by"
        >
          {PLAYER_SORT_GROUPS.map(
            (group) => (
              <section
                className="playerSortGroup"
                key={group.label}
              >
                <span className="playerSortGroupLabel">
                  {group.label}
                </span>

                <div>
                  {group.options.map(
                    (option) => {
                      const selected =
                        option.value ===
                        value

                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={
                            selected
                          }
                          className={`playerSortOption ${
                            selected
                              ? 'selected'
                              : ''
                          }`}
                          key={
                            option.value
                          }
                          onClick={() => {
                            onChange(
                              option.value
                            )

                            setOpen(
                              false
                            )
                          }}
                        >
                          <span className="playerSortCheck">
                            {selected
                              ? '✓'
                              : ''}
                          </span>

                          <strong>
                            {
                              option.label
                            }
                          </strong>
                        </button>
                      )
                    }
                  )}
                </div>
              </section>
            )
          )}
        </div>
      )}
    </div>
  )
}


type PlayerStat = {
  id: number
  name: string

  sessions: number
  completedSessions: number
  sessionWins: number
  sessionWinRate: number | null

  totalPoints: number
  averagePointsPerSession: number | null

  standardRounds: number
  standardWins: number
  standardSecondPlaces: number
  standardWinRate: number | null
  standardLosses: number
  zeroPointRate: number | null

  jimAttempts: number
  jimWins: number
  jimLosses: number
  jimCatches: number
  penakutSessions: number
  jimSuccessRate: number | null
  averageJimSurvived: number | null

  hideUses: number
  hideWins: number
  hideSuccessRate: number | null
  hideStageCounts: Record<number, number>

  penalties: number
}


type MvpStat = {
  playerId: number
  name: string
  score: number
  provisional: boolean

  // All-time = all-time scoring; Recent = last 10 completed player sessions.
  // Overall and radar attributes are the 40% / 60% blend of those two.
  careerScore: number
  recentScore: number
  recentSessions: number
  careerStandardScore: number
  careerJimScore: number
  careerSessionScore: number
  careerSlayerScore: number
  careerConsistencyScore: number
  recentStandardScore: number
  recentJimScore: number
  recentSessionScore: number
  recentSlayerScore: number
  recentConsistencyScore: number

  standardScore: number
  jimScore: number
  sessionScore: number
  slayerScore: number
  consistencyScore: number

  standardWinRate: number
  averageStandardPoints: number
  totalStandardWins: number
  normalizedStandardWins: number
  jimWinRate: number
  totalJimWins: number
  normalizedJimWins: number
  braveryRate: number
  penakutSessions: number
  penakutPenalty: number
  sessionWinRate: number
  totalSessionWins: number
  normalizedSessionWins: number
  totalCatches: number
  normalizedCatchScore: number
  slayerFrequency: number
  nonZeroRate: number
  strongRoundRate: number
  averageSessionStreak: number
  streakScore: number

  sessions: number
  standardRounds: number
  jimAttempts: number
}

// Five radar axes match the five weighted MVP v2 attributes.
// The radar shares the same 0-100 category scores as the leaderboard.
const MVP_RADAR_COLORS = ['#b98421', '#378aaf', '#cc695d', '#8f76ca'] as const
type MvpRadarView = 'hybrid' | 'allTime' | 'recent'
const MVP_RADAR_VIEWS: { key: MvpRadarView; label: string; description: string }[] = [
  { key: 'hybrid', label: 'MVP', description: '40% All-time + 60% Recent' },
  { key: 'allTime', label: 'All-time', description: 'Complete playing history' },
  { key: 'recent', label: 'Recent 10', description: 'Last 10 completed sessions' },
]

const MVP_RADAR_AXES: {
  label: string
  value: (player: MvpStat) => number
  allTime: (player: MvpStat) => number
  recent: (player: MvpStat) => number
}[] = [
  { label: 'Standard', value: p => p.standardScore, allTime: p => p.careerStandardScore, recent: p => p.recentStandardScore },
  { label: 'Jim', value: p => p.jimScore, allTime: p => p.careerJimScore, recent: p => p.recentJimScore },
  { label: 'Session', value: p => p.sessionScore, allTime: p => p.careerSessionScore, recent: p => p.recentSessionScore },
  { label: 'Slayer', value: p => p.slayerScore, allTime: p => p.careerSlayerScore, recent: p => p.recentSlayerScore },
  { label: 'Consistency', value: p => p.consistencyScore, allTime: p => p.careerConsistencyScore, recent: p => p.recentConsistencyScore },
]

type WinStreakPathEvent = {
  type:
    | 'standard'
    | 'jim'
    | 'catch'

  roundNumber: number
  usedHide?: boolean
}

type Award = {
  title: string
  description: string
  winners: string
  value: string
  note?: string
  winnerLines?: {
    name: string
    meta: string
    streakPath?: WinStreakPathEvent[]
  }[]
  hasData: boolean
}


type CombinedAllTimeAward = {
  title: string
  description: string
  total: Award
  rate: Award
  rateLabel: string
}

type SessionRateCandidate = {
  playerId: number
  playerName: string
  sessionId: number
  date: Date
  numerator: number
  denominator: number
  rate: number
}


type CardScoreTriviaRecord = {
  title: string
  value: string
  description: string

  winnerLines: {
    name: string
    meta: string
  }[]
}

function WinStreakPath({
  events,
}: {
  events: WinStreakPathEvent[]
}) {
  if (events.length === 0) {
    return null
  }

  const groups:
    WinStreakPathEvent[][] = []

  events.forEach(
    (event) => {
      const current =
        groups[
          groups.length - 1
        ]

      if (
        current &&
        current[0]?.type ===
          event.type
      ) {
        current.push(event)
      } else {
        groups.push([event])
      }
    }
  )

  return (
    <div
      className="winStreakPath"
      aria-label="Winning streak sequence"
    >
      {groups.map(
        (
          group,
          groupIndex
        ) => (
          <div
            className="winStreakPathStep"
            key={`${group[0].type}-${groupIndex}`}
          >
            {groupIndex > 0 && (
              <span
                className="winStreakPathArrow"
                aria-hidden="true"
              >
                →
              </span>
            )}

            <span
              className={`winStreakPathGroup ${group[0].type}`}
            >
              {group.map(
                (
                  event,
                  eventIndex
                ) => {
                  if (
                    event.type ===
                    'standard'
                  ) {
                    if (
                      eventIndex !== 0
                    ) {
                      return null
                    }

                    const rounds =
                      group.map(
                        (entry) =>
                          entry.roundNumber
                      )

                    const tallyGroups =
                      Array.from(
                        {
                          length:
                            Math.ceil(
                              group.length /
                              5
                            ),
                        },
                        (_, index) =>
                          Math.min(
                            5,
                            group.length -
                              index * 5
                          )
                      )

                    return (
                      <span
                        className="winStreakStandardTallies"
                        key={`standard-${groupIndex}`}
                        title={`Standard wins • Rounds ${rounds.join(', ')}`}
                        aria-label={`${group.length} consecutive Standard wins`}
                      >
                        {tallyGroups.map(
                          (
                            groupSize,
                            tallyIndex
                          ) => (
                            <span
                              className="winStreakTallyGroup"
                              key={
                                tallyIndex
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
                                    className="winStreakTallyMark"
                                    key={
                                      markIndex
                                    }
                                  />
                                )
                              )}

                              {groupSize ===
                                5 && (
                                <i className="winStreakTallyStrike" />
                              )}
                            </span>
                          )
                        )}
                      </span>
                    )
                  }

                  if (
                    event.type ===
                    'catch'
                  ) {
                    return (
                      <span
                        className="winStreakCatch"
                        key={`${event.roundNumber}-${eventIndex}`}
                        title={`Caught Jim • Round ${event.roundNumber}`}
                        aria-label={`Caught Jim, Round ${event.roundNumber}`}
                      >
                        ✂︎
                      </span>
                    )
                  }

                  return (
                    <span
                      className={`winStreakJim ${
                        event.usedHide
                          ? 'usedHide'
                          : 'hideless'
                      }`}
                      key={`${event.roundNumber}-${eventIndex}`}
                      title={
                        event.usedHide
                          ? `Jim win • Hide used • Round ${event.roundNumber}`
                          : `Jim win • No Hide • Round ${event.roundNumber}`
                      }
                      aria-label={
                        event.usedHide
                          ? `Jim win with Hide, Round ${event.roundNumber}`
                          : `Jim win without Hide, Round ${event.roundNumber}`
                      }
                    >
                      ★
                    </span>
                  )
                }
              )}
            </span>
          </div>
        )
      )}
    </div>
  )
}

function AwardTitleInfo({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="awardTitleRow">
      <span className="awardTitleText">
        {title}
      </span>

      <div className="awardInfoWrap">
        <button
          type="button"
          className="awardInfoButton"
          aria-label={`About ${title}`}
        >
          i
        </button>

        <div
          className="awardInfoTooltip"
          role="tooltip"
        >
          {description}
        </div>
      </div>
    </div>
  )
}

function percentage(
  wins: number,
  attempts: number
) {
  if (attempts === 0) {
    return null
  }

  return (
    (wins / attempts) *
    100
  )
}

function displayPercent(
  value: number | null
) {
  if (value === null) {
    return '—'
  }

  return `${value.toFixed(1)}%`
}

function displayNumber(
  value: number | null,
  decimals = 1
) {
  if (value === null) {
    return '—'
  }

  return value.toFixed(decimals)
}


function clamp01(
  value: number
) {
  return Math.max(
    0,
    Math.min(
      1,
      value
    )
  )
}

function formatDate(
  date: Date
) {
  return date.toLocaleDateString(
    undefined,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  )
}

function formatDuration(
  milliseconds: number
) {
  const totalMinutes =
    Math.max(
      0,
      Math.round(
        milliseconds / 60000
      )
    )

  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }

  const hours =
    Math.floor(
      totalMinutes / 60
    )

  const minutes =
    totalMinutes % 60

  if (minutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
}

function getAwardTone(
  title: string
) {
  const tones:
    Record<string, string> = {
      'Tukang Cuci':
        'cuci',

      'Jim Slayer':
        'slayer',

      'Si Tuah':
        'tuah',

      'Si Malang':
        'malang',

      'Raja Standard':
        'standard',

      'Win Streak':
        'streak',

      'Win Streak Record':
        'streak',

      'Classic Arteta':
        'arteta',

      'Raja Session':
        'session',

      'Kaki Jim':
        'jim',

      'Penakut':
        'default',

      'Si Malang Record':
        'malang',

      'Kaki Jim Record':
        'jim',

      'Si Tuah Record':
        'tuah',

      'Paling Berolah':
        'denda',

      'Longest Session':
        'duration',

      'Most Rounds':
        'rounds',

      'Standard Win Rate':
        'standard',

      'Jim Success Rate':
        'tuah',

      'Hide Success Rate':
        'hide',

      'Tukang Cuci Rate':
        'cuci',

      'Lifetime Standard Win Rate':
        'standard',

      'Lifetime Session Win Rate':
        'survivor',

      'Lifetime Jim Success Rate':
        'tuah',

      'Lifetime Hide Success Rate':
        'hide',

      'Lifetime Tukang Cuci Rate':
        'cuci',

      'Jim Slayer Record':
        'slayer',
    }

  return (
    tones[title] ??
    'default'
  )
}

function buildCountAwards(
  stats: PlayerStat[]
): Award[] {
  function makeAward(
    title: string,
    description: string,
    getValue: (
      player: PlayerStat
    ) => number,
    valueLabel: (
      value: number
    ) => string
  ): Award {
    const values =
      stats.map(
        (player) => ({
          player,
          value:
            getValue(player),
        })
      )

    const maximum =
      Math.max(
        0,
        ...values.map(
          (entry) =>
            entry.value
        )
      )

    if (maximum <= 0) {
      return {
        title,
        description,
        winners: '—',
        value: 'No data yet',
        hasData: false,
      }
    }

    const winners =
      values
        .filter(
          (entry) =>
            entry.value ===
            maximum
        )
        .map(
          (entry) =>
            entry.player.name
        )
        .join(' • ')

    return {
      title,
      description,
      winners,

      winnerLines:
        values
          .filter(
            (entry) =>
              entry.value ===
              maximum
          )
          .map(
            (entry) => ({
              name:
                entry.player.name,
              meta: '',
            })
          ),

      value:
        valueLabel(maximum),

      hasData: true,
    }
  }

  return [
    makeAward(
      'Tukang Cuci',
      'Most Standard rounds with 0 round points',
      (player) =>
        player.standardLosses,
      (value) =>
        `${value} zero-point rounds`
    ),

    makeAward(
      'Jim Slayer',
      'Caught Jim the most times',
      (player) =>
        player.jimCatches,
      (value) =>
        `${value} catches`
    ),

    makeAward(
      'Si Tuah',
      'Most Jim wins',
      (player) =>
        player.jimWins,
      (value) =>
        `${value} Jim wins`
    ),

    makeAward(
      'Si Malang',
      'Most Jim attempts that ended in defeat',
      (player) =>
        player.jimLosses,
      (value) =>
        `${value} Jim losses`
    ),

    makeAward(
      'Raja Standard',
      'Most Standard Round wins',
      (player) =>
        player.standardWins,
      (value) =>
        `${value} wins`
    ),

    makeAward(
      'Classic Arteta',
      'Most 2nd-place finishes in Standard rounds',
      (player) =>
        player.standardSecondPlaces,
      (value) =>
        `${value} ${
          value === 1
            ? '2nd place'
            : '2nd places'
        }`
    ),

    makeAward(
      'Raja Session',
      'Most completed sessions won',
      (player) =>
        player.sessionWins,
      (value) =>
        `${value} session wins`
    ),

    makeAward(
      'Kaki Jim',
      'Called Jim the most',
      (player) =>
        player.jimAttempts,
      (value) =>
        `${value} attempts`
    ),

    makeAward(
      'Penakut',
      'Most completed sessions with zero Jim attempts',
      (player) =>
        player.penakutSessions,
      (value) =>
        `${value} Penakut ${
          value === 1
            ? 'session'
            : 'sessions'
        }`
    ),

    makeAward(
      'Paling Berolah',
      'Received the most -1 penalties',
      (player) =>
        player.penalties,
      (value) =>
        `${value} penalties`
    ),
  ]
}

function makeRateRecord(
  title: string,
  description: string,
  candidates:
    SessionRateCandidate[],
  minimumDenominator: number,
  unitLabel: string
): Award {
  const eligible =
    candidates.filter(
      (candidate) =>
        candidate.denominator >=
        minimumDenominator
    )

  if (eligible.length === 0) {
    return {
      title,
      description,
      winners: '—',
      value: 'No eligible session yet',
      note:
        `Minimum ${minimumDenominator} ${unitLabel}`,
      hasData: false,
    }
  }

  const maximum =
    Math.max(
      ...eligible.map(
        (candidate) =>
          candidate.rate
      )
    )

  const winners =
    eligible.filter(
      (candidate) =>
        Math.abs(
          candidate.rate -
            maximum
        ) < 0.0001
    )

  return {
    title,
    description,

    winners:
      winners
        .map(
          (winner) =>
            winner.playerName
        )
        .join(' • '),

    winnerLines:
      winners.map(
        (winner) => ({
          name:
            winner.playerName,

          meta:
            formatDate(
              winner.date
            ),
        })
      ),

    value:
      `${maximum.toFixed(1)}%`,

    note:
      winners
        .map(
          (winner) =>
            `${winner.numerator}/${winner.denominator}`
        )
        .join(' • '),

    hasData: true,
  }
}


function makeLifetimeRateAward(
  title: string,
  description: string,
  stats: PlayerStat[],
  minimumDenominator: number,
  denominatorLabel: string,
  getNumerator: (
    player: PlayerStat
  ) => number,
  getDenominator: (
    player: PlayerStat
  ) => number
): Award {
  const eligible =
    stats
      .map(
        (player) => {
          const numerator =
            getNumerator(player)

          const denominator =
            getDenominator(player)

          return {
            player,
            numerator,
            denominator,

            rate:
              denominator > 0
                ? (
                    numerator /
                    denominator
                  ) * 100
                : null,
          }
        }
      )
      .filter(
        (entry) =>
          entry.denominator >=
            minimumDenominator &&
          entry.rate !== null
      )

  if (eligible.length === 0) {
    return {
      title,
      description,
      winners: '—',
      value: 'No eligible player yet',
      note:
        `Minimum ${minimumDenominator} ${denominatorLabel}`,
      hasData: false,
    }
  }

  const maximum =
    Math.max(
      ...eligible.map(
        (entry) =>
          entry.rate ?? 0
      )
    )

  const winners =
    eligible.filter(
      (entry) =>
        Math.abs(
          (entry.rate ?? 0) -
            maximum
        ) < 0.0001
    )

  return {
    title,
    description,

    winners:
      winners
        .map(
          (winner) =>
            winner.player.name
        )
        .join(' • '),

    winnerLines:
      winners.map(
        (winner) => ({
          name:
            winner.player.name,

          meta:
            `${winner.numerator}/${winner.denominator}`,
        })
      ),

    value:
      `${maximum.toFixed(1)}%`,

    note:
      `min ${minimumDenominator} ${denominatorLabel}`,

    hasData: true,
  }
}


function makeLifetimeAverageAward(
  title: string,
  description: string,
  stats: PlayerStat[],
  minimumDenominator: number,
  denominatorLabel: string,
  getNumerator: (
    player: PlayerStat
  ) => number,
  getDenominator: (
    player: PlayerStat
  ) => number,
  valueSuffix: string
): Award {
  const eligible =
    stats
      .map(
        (player) => {
          const numerator =
            getNumerator(player)

          const denominator =
            getDenominator(player)

          return {
            player,
            numerator,
            denominator,

            rate:
              denominator > 0
                ? numerator /
                  denominator
                : null,
          }
        }
      )
      .filter(
        (entry) =>
          entry.denominator >=
            minimumDenominator &&
          entry.rate !== null
      )

  if (eligible.length === 0) {
    return {
      title,
      description,
      winners: '—',
      value: 'No eligible player yet',
      note:
        `Minimum ${minimumDenominator} ${denominatorLabel}`,
      hasData: false,
    }
  }

  const maximum =
    Math.max(
      ...eligible.map(
        (entry) =>
          entry.rate ?? 0
      )
    )

  const winners =
    eligible.filter(
      (entry) =>
        Math.abs(
          (entry.rate ?? 0) -
            maximum
        ) < 0.0001
    )

  return {
    title,
    description,

    winners:
      winners
        .map(
          (winner) =>
            winner.player.name
        )
        .join(' • '),

    winnerLines:
      winners.map(
        (winner) => ({
          name:
            winner.player.name,

          meta:
            `${winner.numerator}/${winner.denominator}`,
        })
      ),

    value:
      `${maximum.toFixed(2)} ${valueSuffix}`,

    note:
      `min ${minimumDenominator} ${denominatorLabel}`,

    hasData: true,
  }
}

export default function HistoryStats({
  players,
  onBack,
  initialAwardSessionId,
}: Props) {
  const [tab, setTab] =
    useState<Tab>('sessions')

  // The comparison starts with the top MVP player. Additional players are
  // explicitly added and can be hidden without losing their selections.
  const [radarSelection, setRadarSelection] =
    useState<Array<{ playerId: number; visible: boolean }> | null>(null)
  const [radarPickerOpen, setRadarPickerOpen] = useState(false)
  const [radarSingleViews, setRadarSingleViews] = useState<MvpRadarView[]>(['hybrid'])
  const [radarComparisonView, setRadarComparisonView] = useState<MvpRadarView>('hybrid')
  const [mvpScoringOpen, setMvpScoringOpen] = useState(false)
  const scoringCloseRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!mvpScoringOpen) return
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const body = document.body
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = `-${scrollX}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    scoringCloseRef.current?.focus()
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMvpScoringOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.left = previous.left
      body.style.width = previous.width
      body.style.overflow = previous.overflow
      window.scrollTo(scrollX, scrollY)
    }
  }, [mvpScoringOpen])
  const radarPickerRef = useRef<HTMLDivElement>(null)
  const [radarIsMobile, setRadarIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 650px)').matches
  )
  useEffect(() => {
    const media = window.matchMedia('(max-width: 650px)')
    const update = () => setRadarIsMobile(media.matches)
    media.addEventListener('change', update)
    update()
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!radarPickerOpen) return
    const dismissPicker = (event: PointerEvent) => {
      if (!radarPickerRef.current?.contains(event.target as Node)) {
        setRadarPickerOpen(false)
      }
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRadarPickerOpen(false)
    }
    document.addEventListener('pointerdown', dismissPicker)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissPicker)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [radarPickerOpen])

  const [
    playerSort,
    setPlayerSort,
  ] =
    useState<PlayerSort>(
      'total'
    )

  const [collapsedPlayerIds, setCollapsedPlayerIds] = useState<Set<number>>(() => new Set())

  function togglePlayerStats(playerId: number) {
    setCollapsedPlayerIds(previous => {
      const next = new Set(previous)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  const [
    expandedSessionId,
    setExpandedSessionId,
  ] =
    useState<number | null>(
      null
    )


  const [
    sessionPlayerDetail,
    setSessionPlayerDetail,
  ] = useState<{
    sessionId: number
    playerId: number
  } | null>(null)

  const [
    roundDetailsSessionId,
    setRoundDetailsSessionId,
  ] =
    useState<number | null>(
      null
    )

  const [
    editingRoundId,
    setEditingRoundId,
  ] =
    useState<number | null>(
      null
    )

  const [
    raceSessionId,
    setRaceSessionId,
  ] =
    useState<number | null>(
      null
    )

  // Lets Android Back close the expanded Title Race before leaving its page.
  const [raceFullscreenActive, setRaceFullscreenActive] = useState(false)


  const [
    awardSessionId,
    setAwardSessionId,
  ] =
    useState<number | null>(
      initialAwardSessionId ??
        null
    )


  const [
    deleteSessionId,
    setDeleteSessionId,
  ] =
    useState<number | null>(
      null
    )

  const [
    deletingSession,
    setDeletingSession,
  ] =
    useState(false)

  /*
    Keep confirmation modals fixed to the
    visible viewport.

    While the delete confirmation is open,
    freeze the page at its current scroll
    position. Closing the modal restores
    the exact previous scroll position.
  */
  useEffect(
    () => {
      if (deleteSessionId === null) {
        return
      }

      const scrollX =
        window.scrollX
      const scrollY =
        window.scrollY

      const oldPosition =
        document.body.style.position
      const oldTop =
        document.body.style.top
      const oldLeft =
        document.body.style.left
      const oldWidth =
        document.body.style.width
      const oldOverflow =
        document.body.style.overflow

      document.body.style.position =
        'fixed'
      document.body.style.top =
        `-${scrollY}px`
      document.body.style.left =
        `-${scrollX}px`
      document.body.style.width =
        '100%'
      document.body.style.overflow =
        'hidden'

      return () => {
        document.body.style.position =
          oldPosition
        document.body.style.top =
          oldTop
        document.body.style.left =
          oldLeft
        document.body.style.width =
          oldWidth
        document.body.style.overflow =
          oldOverflow

        window.scrollTo(
          scrollX,
          scrollY
        )
      }
    },
    [deleteSessionId]
  )

  /*
    Handle Android Back one level at a time.

    App.tsx dispatches this cancelable event
    before doing its own high-level navigation.
    If HistoryStats has something more local
    to close, preventDefault() tells App.tsx
    that Back has already been handled.
  */
  useEffect(
    () => {
      function handleAndroidBack(
        event: Event
      ) {
        /*
          Modal / temporary UI first.
        */
        if (mvpScoringOpen) {
          setMvpScoringOpen(false)
          event.preventDefault()
          return
        }

        if (
          sessionPlayerDetail !== null
        ) {
          setSessionPlayerDetail(
            null
          )
          event.preventDefault()
          return
        }

        if (
          deleteSessionId !== null
        ) {
          /*
            Do not navigate away while a
            destructive delete is running.
          */
          if (!deletingSession) {
            setDeleteSessionId(
              null
            )
          }

          event.preventDefault()
          return
        }

        if (
          editingRoundId !== null
        ) {
          setEditingRoundId(
            null
          )
          event.preventDefault()
          return
        }

        /*
          Full child pages.
        */
        if (
          awardSessionId !== null
        ) {
          if (
            initialAwardSessionId !==
            undefined
          ) {
            onBack()
          } else {
            setAwardSessionId(
              null
            )
          }

          event.preventDefault()
          return
        }

        if (
          raceSessionId !== null
        ) {
          if (raceFullscreenActive) {
            window.dispatchEvent(new Event('jimrami-title-race-close-expanded'))
            setRaceFullscreenActive(false)
          } else {
            setRaceSessionId(null)
          }
          event.preventDefault()
          return
        }

        /*
          Nested session detail levels.
        */
        if (
          roundDetailsSessionId !==
          null
        ) {
          setEditingRoundId(
            null
          )

          setRoundDetailsSessionId(
            null
          )

          event.preventDefault()
          return
        }

        if (
          expandedSessionId !== null
        ) {
          setExpandedSessionId(
            null
          )
          event.preventDefault()
        }
      }

      window.addEventListener(
        'jimrami-back-request',
        handleAndroidBack
      )

      return () => {
        window.removeEventListener(
          'jimrami-back-request',
          handleAndroidBack
        )
      }
    },
    [
      awardSessionId,
      mvpScoringOpen,
      deleteSessionId,
      deletingSession,
      editingRoundId,
      expandedSessionId,
      initialAwardSessionId,
      onBack,
      raceSessionId,
      raceFullscreenActive,
      roundDetailsSessionId,
      sessionPlayerDetail,
    ]
  )

  const sessions =
    useLiveQuery(
      () =>
        db.sessions.toArray(),
      []
    )

  const sessionPlayers =
    useLiveQuery(
      () =>
        db.sessionPlayers.toArray(),
      []
    )

  const rounds =
    useLiveQuery(
      () =>
        db.rounds.toArray(),
      []
    )

  const roundResults =
    useLiveQuery(
      () =>
        db.roundResults.toArray(),
      []
    )

  const jimResults =
    useLiveQuery(
      () =>
        db.jimResults.toArray(),
      []
    )

  const penaltyResults =
    useLiveQuery(
      () =>
        db.penaltyResults.toArray(),
      []
    )

  const playerNameMap =
    useMemo(
      () =>
        new Map(
          players.map(
            (player) => [
              player.id,
              player.name,
            ]
          )
        ),
      [players]
    )

  function getName(
    playerId: number
  ) {
    return (
      playerNameMap.get(
        playerId
      ) ?? 'Unknown'
    )
  }


  function getSessionName(
    sessionId: number,
    playerId: number
  ) {
    const participant =
      sessionPlayers?.find(
        (entry) =>
          entry.sessionId ===
            sessionId &&
          entry.playerId ===
            playerId
      )

    return (
      participant?.displayName ??
      getName(playerId)
    )
  }


  const cardScoreTrivia =
    useMemo(() => {
      if (
        !roundResults ||
        !rounds ||
        !sessions
      ) {
        return {
          countedRounds: 0,
          records:
            [] as CardScoreTriviaRecord[],
        }
      }

      const sessionMap =
        new Map(
          sessions.map(
            (session) => [
              session.id,
              session,
            ]
          )
        )

      const exactRounds =
        rounds
          .filter(
            (round) =>
              round.type ===
              'standard'
          )
          .map((round) => {
            const results =
              roundResults.filter(
                (result) =>
                  result.roundId ===
                  round.id
              )

            if (
              results.length !== 4 ||
              !results.every(
                (result) =>
                  typeof result.cardScore ===
                  'number'
              )
            ) {
              return null
            }

            const ordered =
              [...results].sort(
                (a, b) =>
                  a.position -
                  b.position
              )

            const session =
              sessionMap.get(
                round.sessionId
              )

            if (
              !session ||
              ordered.length !== 4
            ) {
              return null
            }

            const first =
              ordered[0]
            const second =
              ordered[1]
            const fourth =
              ordered[3]

            const firstScore =
              first.cardScore as number
            const secondScore =
              second.cardScore as number
            const fourthScore =
              fourth.cardScore as number

            return {
              round,
              session,
              first,
              second,
              fourth,

              firstScore,
              secondScore,
              fourthScore,

              winMargin:
                firstScore -
                secondScore,

              tableSpread:
                firstScore -
                fourthScore,
            }
          })
          .filter(
            (
              entry
            ): entry is NonNullable<
              typeof entry
            > =>
              entry !== null
          )

      function roundMeta(
        entry:
          (typeof exactRounds)[number]
      ) {
        return `${formatDate(
          entry.session.startedAt
        )} • Round ${
          entry.round.roundNumber
        }`
      }

      function bestBy(
        title: string,
        description: string,
        selector: (
          entry:
            (typeof exactRounds)[number]
        ) => number,
        direction:
          | 'max'
          | 'min',
        valueLabel: (
          value: number
        ) => string,
        lineBuilder: (
          entry:
            (typeof exactRounds)[number]
        ) => {
          name: string
          meta: string
        }
      ): CardScoreTriviaRecord {
        if (
          exactRounds.length === 0
        ) {
          return {
            title,
            value: '—',
            description,
            winnerLines: [],
          }
        }

        const values =
          exactRounds.map(
            selector
          )

        const target =
          direction === 'max'
            ? Math.max(
                ...values
              )
            : Math.min(
                ...values
              )

        const winners =
          exactRounds.filter(
            (entry) =>
              selector(entry) ===
              target
          )

        return {
          title,
          value:
            valueLabel(target),
          description,
          winnerLines:
            winners.map(
              lineBuilder
            ),
        }
      }

      const records:
        CardScoreTriviaRecord[] =
        [
          bestBy(
            'Biggest Win',
            'Largest card-score margin between 1st and 2nd.',
            (entry) =>
              entry.winMargin,
            'max',
            (value) =>
              `${value} pt margin`,
            (entry) => ({
              name:
                getSessionName(
                  entry.session.id,
                  entry.first.playerId
                ),

              meta:
                `${roundMeta(
                  entry
                )} • ${
                  entry.firstScore
                }–${
                  entry.secondScore
                }`,
            })
          ),

          bestBy(
            'Photo Finish',
            'Smallest card-score margin between 1st and 2nd.',
            (entry) =>
              entry.winMargin,
            'min',
            (value) =>
              `${value} pt margin`,
            (entry) => ({
              name:
                getSessionName(
                  entry.session.id,
                  entry.first.playerId
                ),

              meta:
                `${roundMeta(
                  entry
                )} • ${
                  entry.firstScore
                }–${
                  entry.secondScore
                }`,
            })
          ),

          bestBy(
            'Highest Winning Score',
            'Highest exact card score ever recorded by a Standard-round winner.',
            (entry) =>
              entry.firstScore,
            'max',
            (value) =>
              `${value} pts`,
            (entry) => ({
              name:
                getSessionName(
                  entry.session.id,
                  entry.first.playerId
                ),

              meta:
                roundMeta(entry),
            })
          ),

          bestBy(
            'Lowest Winning Score',
            'Lowest exact card score that was still enough to finish 1st.',
            (entry) =>
              entry.firstScore,
            'min',
            (value) =>
              `${value} pts`,
            (entry) => ({
              name:
                getSessionName(
                  entry.session.id,
                  entry.first.playerId
                ),

              meta:
                roundMeta(entry),
            })
          ),

          bestBy(
            'Biggest Table Spread',
            'Largest gap between 1st and 4th in a fully counted round.',
            (entry) =>
              entry.tableSpread,
            'max',
            (value) =>
              `${value} pts`,
            (entry) => ({
              name:
                `${getSessionName(
                  entry.session.id,
                  entry.first.playerId
                )} vs ${getSessionName(
                  entry.session.id,
                  entry.fourth.playerId
                )}`,

              meta:
                `${roundMeta(
                  entry
                )} • ${
                  entry.firstScore
                }–${
                  entry.fourthScore
                }`,
            })
          ),

          bestBy(
            'Tightest Table',
            'Smallest gap between 1st and 4th in a fully counted round.',
            (entry) =>
              entry.tableSpread,
            'min',
            (value) =>
              `${value} pts`,
            (entry) => ({
              name:
                `${getSessionName(
                  entry.session.id,
                  entry.first.playerId
                )} vs ${getSessionName(
                  entry.session.id,
                  entry.fourth.playerId
                )}`,

              meta:
                `${roundMeta(
                  entry
                )} • ${
                  entry.firstScore
                }–${
                  entry.fourthScore
                }`,
            })
          ),
        ]

      return {
        countedRounds:
          exactRounds.length,
        records,
      }
    }, [
      roundResults,
      rounds,
      sessions,
      sessionPlayers,
      playerNameMap,
    ])

  const orderedSessions =
    useMemo(() => {
      if (!sessions) {
        return []
      }

      return [...sessions].sort(
        (a, b) =>
          b.startedAt.getTime() -
          a.startedAt.getTime()
      )
    }, [sessions])

  const completedSessionWinnerIds =
    useMemo(() => {
      const result =
        new Map<
          number,
          Set<number>
        >()

      if (
        !sessions ||
        !sessionPlayers
      ) {
        return result
      }

      sessions
        .filter(
          (session) =>
            session.status ===
            'ended'
        )
        .forEach(
          (session) => {
            const participants =
              sessionPlayers.filter(
                (entry) =>
                  entry.sessionId ===
                  session.id
              )

            if (
              participants.length ===
              0
            ) {
              return
            }

            const topPoints =
              Math.max(
                ...participants.map(
                  (entry) =>
                    entry.points
                )
              )

            result.set(
              session.id,
              new Set(
                participants
                  .filter(
                    (entry) =>
                      entry.points ===
                      topPoints
                  )
                  .map(
                    (entry) =>
                      entry.playerId
                  )
              )
            )
          }
        )

      return result
    }, [
      sessions,
      sessionPlayers,
    ])

  const playerStats =
    useMemo<PlayerStat[]>(() => {
      if (
        !sessions ||
        !sessionPlayers ||
        !roundResults ||
        !jimResults ||
        !penaltyResults
      ) {
        return []
      }

      return players.map(
        (player) => {
          const participations =
            sessionPlayers.filter(
              (entry) =>
                entry.playerId ===
                player.id
            )

          const completedParticipations =
            participations.filter(
              (entry) =>
                sessions.some(
                  (session) =>
                    session.id ===
                      entry.sessionId &&
                    session.status ===
                      'ended'
                )
            )

          const sessionWins =
            completedParticipations.filter(
              (entry) =>
                completedSessionWinnerIds
                  .get(
                    entry.sessionId
                  )
                  ?.has(
                    player.id
                  )
            ).length

          /* Penakut = zero Jim attempts in a completed session. */
          const penakutSessions =
            completedParticipations.filter(
              (entry) =>
                !jimResults.some(
                  (result) =>
                    result.sessionId === entry.sessionId &&
                    result.jimPlayerId === player.id
                )
            ).length

          const standard =
            roundResults.filter(
              (result) =>
                result.playerId ===
                player.id
            )

          const standardWins =
            standard.filter(
              (result) =>
                result.position ===
                1
            ).length

          const standardSecondPlaces =
            standard.filter(
              (result) =>
                result.position ===
                2
            ).length

          const standardLosses =
            standard.filter(
              (result) =>
                result.pointsAwarded ===
                0
            ).length

          const jimAttempts =
            jimResults.filter(
              (result) =>
                result.jimPlayerId ===
                player.id
            )

          const jimWins =
            jimAttempts.filter(
              (result) =>
                result.won
            ).length

          const jimLosses =
            jimAttempts.length -
            jimWins

          const jimCatches =
            jimResults.filter(
              (result) =>
                result.caughtByPlayerId ===
                player.id
            ).length

          const hideAttempts =
            jimAttempts.filter(
              (result) =>
                typeof result.hideStage ===
                'number'
            )

          const hideWins =
            hideAttempts.filter(
              (result) =>
                result.won
            ).length

          const hideStageCounts:
            Record<number, number> = {
              2: 0,
              3: 0,
              4: 0,
              5: 0,
            }

          hideAttempts.forEach(
            (result) => {
              if (
                result.hideStage !==
                  undefined &&
                hideStageCounts[
                  result.hideStage
                ] !== undefined
              ) {
                hideStageCounts[
                  result.hideStage
                ] += 1
              }
            }
          )

          const averageJimSurvived =
            jimAttempts.length > 0
              ? jimAttempts.reduce(
                  (total, result) =>
                    total +
                    result.stepsSurvived,
                  0
                ) /
                jimAttempts.length
              : null

          const penalties =
            penaltyResults.filter(
              (penalty) =>
                penalty.playerId ===
                player.id
            ).length

          const totalPoints =
            participations.reduce(
              (total, entry) =>
                total +
                entry.points,
              0
            )

          return {
            id: player.id,
            name: player.name,

            sessions:
              participations.length,

            completedSessions:
              completedParticipations.length,

            sessionWins,

            sessionWinRate:
              percentage(
                sessionWins,
                completedParticipations.length
              ),

            totalPoints,

            averagePointsPerSession:
              participations.length >
              0
                ? totalPoints /
                  participations.length
                : null,

            standardRounds:
              standard.length,

            standardWins,

            standardSecondPlaces,

            standardWinRate:
              percentage(
                standardWins,
                standard.length
              ),

            standardLosses,

            zeroPointRate:
              percentage(
                standardLosses,
                standard.length
              ),

            jimAttempts:
              jimAttempts.length,

            jimWins,

            jimLosses,

            jimCatches,

            penakutSessions,

            jimSuccessRate:
              percentage(
                jimWins,
                jimAttempts.length
              ),

            averageJimSurvived,

            hideUses:
              hideAttempts.length,

            hideWins,

            hideSuccessRate:
              percentage(
                hideWins,
                hideAttempts.length
              ),

            hideStageCounts,

            penalties,
          }
        }
      )
    }, [
      players,
      sessions,
      sessionPlayers,
      roundResults,
      jimResults,
      penaltyResults,
      completedSessionWinnerIds,
    ])

  const sortedPlayerStats =
    useMemo(() => {
      function valueFor(
        player: PlayerStat
      ) {
        if (
          playerSort ===
          'total'
        ) {
          return player.totalPoints
        }

        if (
          playerSort ===
          'average'
        ) {
          return (
            player.averagePointsPerSession ??
            -Infinity
          )
        }

        if (
          playerSort ===
          'sessionsPlayed'
        ) {
          return (
            player.completedSessions
          )
        }

        if (
          playerSort ===
          'standardWins'
        ) {
          return player.standardWins
        }

        if (
          playerSort ===
          'sessionWins'
        ) {
          return player.sessionWins
        }

        if (
          playerSort ===
          'jimWins'
        ) {
          return player.jimWins
        }

        if (
          playerSort ===
          'jimAttempts'
        ) {
          return player.jimAttempts
        }

        if (
          playerSort ===
          'jimCatches'
        ) {
          return player.jimCatches
        }

        if (
          playerSort ===
          'jimCaught'
        ) {
          return player.jimLosses
        }

        if (
          playerSort ===
          'penakutSessions'
        ) {
          return player.penakutSessions
        }

        if (
          playerSort ===
          'standardRate'
        ) {
          return (
            player.standardWinRate ??
            -Infinity
          )
        }

        if (
          playerSort ===
          'sessionRate'
        ) {
          return (
            player.sessionWinRate ??
            -Infinity
          )
        }

        return (
          player.jimSuccessRate ??
          -Infinity
        )
      }

      return [
        ...playerStats,
      ].sort(
        (a, b) =>
          valueFor(b) -
            valueFor(a) ||
          b.totalPoints -
            a.totalPoints ||
          a.name.localeCompare(
            b.name
          )
      )
    }, [
      playerStats,
      playerSort,
    ])

  // Hybrid MVP: 40% career achievement + 60% last 10 completed sessions.
  // Individual attribute weights and provisional eligibility remain unchanged.
  const mvpStats = useMemo<MvpStat[]>(() => {
    if (!sessions || !sessionPlayers || !rounds || !roundResults || !jimResults) {
      return []
    }

    const completed = new Set(
      sessions.filter(session => session.status === 'ended').map(session => session.id)
    )
    const highestCatchCount = Math.max(0, ...playerStats.map(player => player.jimCatches))
    const highestJimWins = Math.max(0, ...playerStats.map(player => player.jimWins))
    const highestStandardWins = Math.max(0, ...playerStats.map(player => player.standardWins))
    const highestSessionWins = Math.max(0, ...playerStats.map(player => player.sessionWins))

    // Capture the loaded arrays so TypeScript can safely use them
    // inside longestSessionStreak (a nested function).
    const allRounds = rounds
    const allRoundResults = roundResults
    const allJimResults = jimResults

    // Match Awards streak rules: Standard 1st, Jim victory, Jim catch = win.
    // Recorded non-wins break; waiting and unrecorded rounds pause the streak.
    function longestSessionStreak(sessionId: number, playerId: number): number {
      const ordered = allRounds
        .filter(round => round.sessionId === sessionId)
        .sort((a, b) => a.roundNumber - b.roundNumber || a.id - b.id)
      let current = 0
      let longest = 0
      const won = () => {
        current += 1
        longest = Math.max(longest, current)
      }

      for (const round of ordered) {
        if (round.type === 'standard') {
          const result = allRoundResults.find(
            entry => entry.roundId === round.id && entry.playerId === playerId
          )
          if (!result) continue // Not playing: pause.
          if (result.position === 1) won()
          else current = 0
          continue
        }

        const jim = allJimResults.find(entry => entry.roundId === round.id)
        if (!jim) continue // Penalties and other unrecorded rounds: pause.
        if (jim.jimPlayerId === playerId) {
          if (jim.won) won()
          else current = 0
        } else if (jim.caughtByPlayerId === playerId) {
          won()
        } else if (jim.won && jim.outPlayerId === playerId) {
          current = 0
        }
        // Other Jim defenders: pause (not enough recorded information).
      }
      return longest
    }

    // Keep each player's own latest completed sessions, regardless of whether
    // they were playing or waiting for a particular round in that session.
    // Recent normalization uses wins/catches per completed session rather than
    // the total number of victories in windows of unequal size.
    const completedSessionsById = new Map(
      sessions.filter(session => session.status === 'ended')
        .map(session => [session.id, session] as const)
    )
    const standardRoundSession = new Map(
      rounds.filter(round => round.type === 'standard')
        .map(round => [round.id, round.sessionId] as const)
    )

    const recentSamples = playerStats.map(player => {
      const sessionIds = Array.from(new Set(
        sessionPlayers.filter(entry =>
          entry.playerId === player.id && completedSessionsById.has(entry.sessionId)
        ).map(entry => entry.sessionId)
      )).sort((a, b) =>
        (completedSessionsById.get(b)?.startedAt.getTime() ?? 0) -
        (completedSessionsById.get(a)?.startedAt.getTime() ?? 0) || b - a
      ).slice(0, 10)
      const sessionIdSet = new Set(sessionIds)
      const sessionCount = sessionIds.length
      const standard = roundResults.filter(result =>
        result.playerId === player.id &&
        sessionIdSet.has(standardRoundSession.get(result.roundId) ?? -1)
      )
      const standardWins = standard.filter(result => result.position === 1).length
      const standardPoints = standard.reduce((sum, result) => sum + result.pointsAwarded, 0)
      const nonZeroStandard = standard.filter(result => result.pointsAwarded > 0).length
      const strongStandard = standard.filter(result => result.pointsAwarded >= 2).length
      const jimAttempts = jimResults.filter(result =>
        result.jimPlayerId === player.id && sessionIdSet.has(result.sessionId)
      )
      const jimWins = jimAttempts.filter(result => result.won).length
      const catches = jimResults.filter(result =>
        result.caughtByPlayerId === player.id && sessionIdSet.has(result.sessionId)
      ).length
      const jimSessions = sessionIds.filter(id =>
        jimAttempts.some(result => result.sessionId === id)
      ).length
      const catchSessions = sessionIds.filter(id => jimResults.some(result =>
        result.sessionId === id && result.caughtByPlayerId === player.id
      )).length
      const sessionWins = sessionIds.filter(id =>
        completedSessionWinnerIds.get(id)?.has(player.id)
      ).length
      const averageSessionStreak = sessionCount > 0
        ? sessionIds.reduce((sum, id) => sum + longestSessionStreak(id, player.id), 0) / sessionCount
        : 0

      return {
        playerId: player.id,
        sessionCount,
        standardWinsPerSession: sessionCount ? standardWins / sessionCount : 0,
        jimWinsPerSession: sessionCount ? jimWins / sessionCount : 0,
        sessionWinsPerSession: sessionCount ? sessionWins / sessionCount : 0,
        catchesPerSession: sessionCount ? catches / sessionCount : 0,
        standardWinRate: standard.length ? standardWins / standard.length : 0,
        averageStandardPoints: standard.length ? standardPoints / standard.length : 0,
        jimSuccessRate: jimAttempts.length ? jimWins / jimAttempts.length : 0,
        braveryRate: sessionCount ? jimSessions / sessionCount : 0,
        penakutRate: sessionCount ? (sessionCount - jimSessions) / sessionCount : 0,
        slayerFrequency: sessionCount ? catchSessions / sessionCount : 0,
        nonZeroRate: standard.length ? nonZeroStandard / standard.length : 0,
        strongRoundRate: standard.length ? strongStandard / standard.length : 0,
        streakScore: clamp01(averageSessionStreak / 5),
      }
    })

    // Very small samples (e.g. a newcomer's only completed session) must not
    // set the benchmark for everybody else's Recent rating. The existing MVP
    // minimum of five completed sessions is used for benchmark eligibility.
    const recentBenchmarks = recentSamples.filter(player => player.sessionCount >= 5)
    const benchmarkPool = recentBenchmarks.length > 0 ? recentBenchmarks : recentSamples
    const highestRecentStandardWinsRate = Math.max(0,
      ...benchmarkPool.map(player => player.standardWinsPerSession))
    const highestRecentJimWinsRate = Math.max(0,
      ...benchmarkPool.map(player => player.jimWinsPerSession))
    const highestRecentSessionWinsRate = Math.max(0,
      ...benchmarkPool.map(player => player.sessionWinsPerSession))
    const highestRecentCatchesRate = Math.max(0,
      ...benchmarkPool.map(player => player.catchesPerSession))

    const recentScoresByPlayer = new Map(recentSamples.map(player => {
      const ratio = (value: number, maximum: number) =>
        maximum > 0 ? clamp01(value / maximum) : 0
      const standard = clamp01(
        0.50 * ratio(player.standardWinsPerSession, highestRecentStandardWinsRate) +
        0.30 * player.standardWinRate +
        0.20 * clamp01(player.averageStandardPoints / 3)
      )
      const jim = clamp01(
        0.65 * ratio(player.jimWinsPerSession, highestRecentJimWinsRate) +
        0.25 * player.jimSuccessRate +
        0.10 * player.braveryRate - 0.10 * player.penakutRate
      )
      const session = clamp01(
        0.60 * ratio(player.sessionWinsPerSession, highestRecentSessionWinsRate) +
        0.40 * player.sessionWinsPerSession
      )
      const slayer = clamp01(
        0.70 * ratio(player.catchesPerSession, highestRecentCatchesRate) +
        0.30 * player.slayerFrequency
      )
      const consistency = clamp01(
        0.40 * player.nonZeroRate +
        0.35 * player.strongRoundRate +
        0.25 * player.streakScore
      )
      const score = 100 * (
        0.25 * standard + 0.30 * jim + 0.15 * session +
        0.20 * slayer + 0.10 * consistency
      )
      return [player.playerId, {
        sessions: player.sessionCount, score,
        standard, jim, session, slayer, consistency,
      }] as const
    }))

    return playerStats.map(player => {
      const standardResults = roundResults.filter(result => result.playerId === player.id)
      const standardPoints = standardResults.reduce(
        (total, result) => total + result.pointsAwarded, 0
      )
      const averageStandardPoints = player.standardRounds > 0
        ? standardPoints / player.standardRounds : 0
      const standardWinRate = (player.standardWinRate ?? 0) / 100
      // All-time Standard victories are measured relative to the current leader.
      // A zero-win player pool contributes 0 rather than treating 0/0 as a perfect score.
      const normalizedStandardWins = highestStandardWins > 0
        ? player.standardWins / highestStandardWins : 0
      const standardScore = clamp01(
        0.50 * normalizedStandardWins +
        0.30 * standardWinRate +
        0.20 * clamp01(averageStandardPoints / 3)
      )

      // No 'opportunity' concept: any completed zero-Jim session is Penakut.
      const sessionIds = Array.from(new Set(
        sessionPlayers
          .filter(entry => entry.playerId === player.id && completed.has(entry.sessionId))
          .map(entry => entry.sessionId)
      ))
      const sessionCount = sessionIds.length
      const jimSessions = sessionIds.filter(id => jimResults.some(
        result => result.sessionId === id && result.jimPlayerId === player.id
      )).length
      const braveryRate = sessionCount > 0 ? jimSessions / sessionCount : 0
      const penakutSessions = sessionCount - jimSessions
      const penakutRate = sessionCount > 0 ? penakutSessions / sessionCount : 0
      const jimWinRate = (player.jimSuccessRate ?? 0) / 100
      // Normalize total Jim wins against the all-time leader, same as Slayer.
      const normalizedJimWins = highestJimWins > 0
        ? player.jimWins / highestJimWins : 0
      // Penakut is deliberately counted both through low bravery and as a
      // separate negative. Cap the resulting Jim component at 0..100.
      const penakutPenalty = 0.10 * penakutRate
      const jimScore = clamp01(
        0.65 * normalizedJimWins + 0.25 * jimWinRate +
        0.10 * braveryRate - penakutPenalty
      )

      const sessionWinRate = (player.sessionWinRate ?? 0) / 100
      // All-time completed-session victories are relative to the current leader.
      const normalizedSessionWins = highestSessionWins > 0
        ? player.sessionWins / highestSessionWins : 0
      const sessionScore = clamp01(
        0.60 * normalizedSessionWins + 0.40 * sessionWinRate
      )

      const normalizedCatchScore = highestCatchCount > 0
        ? player.jimCatches / highestCatchCount : 0
      const caughtSessions = sessionIds.filter(id => jimResults.some(
        result => result.sessionId === id && result.caughtByPlayerId === player.id
      )).length
      const slayerFrequency = sessionCount > 0 ? caughtSessions / sessionCount : 0
      const slayerScore = 0.70 * normalizedCatchScore + 0.30 * slayerFrequency

      const zeroPointRate = (player.zeroPointRate ?? 0) / 100
      const nonZeroRate = player.standardRounds > 0 ? 1 - clamp01(zeroPointRate) : 0
      // A strong Standard result is +2 or +3 points. Count it against ALL
      // played Standard rounds, including +0 and +1 results.
      const strongRoundRate = player.standardRounds > 0
        ? standardResults.filter(result => result.pointsAwarded >= 2).length / player.standardRounds
        : 0
      const averageSessionStreak = sessionCount > 0
        ? sessionIds.reduce((sum, id) => sum + longestSessionStreak(id, player.id), 0) / sessionCount
        : 0
      const streakScore = clamp01(averageSessionStreak / 5)
      const consistencyScore = 0.40 * nonZeroRate +
        0.35 * strongRoundRate + 0.25 * streakScore

      const careerScore = 100 * (
        0.25 * standardScore +
        0.30 * jimScore +
        0.15 * sessionScore +
        0.20 * slayerScore +
        0.10 * consistencyScore
      )
      const recent = recentScoresByPlayer.get(player.id)
      const recentScore = recent?.score ?? 0
      const score = 0.40 * careerScore + 0.60 * recentScore
      const blend = (career: number, current: number) =>
        100 * (0.40 * career + 0.60 * current)

      // Qualification affects podium eligibility, not the earned numeric score.
      const provisional = player.completedSessions < 5 ||
        player.standardRounds < 20 || player.jimAttempts < 5

      return {
        playerId: player.id,
        name: player.name,
        score,
        provisional,
        careerScore,
        recentScore,
        recentSessions: recent?.sessions ?? 0,
        careerStandardScore: standardScore * 100,
        careerJimScore: jimScore * 100,
        careerSessionScore: sessionScore * 100,
        careerSlayerScore: slayerScore * 100,
        careerConsistencyScore: consistencyScore * 100,
        recentStandardScore: (recent?.standard ?? 0) * 100,
        recentJimScore: (recent?.jim ?? 0) * 100,
        recentSessionScore: (recent?.session ?? 0) * 100,
        recentSlayerScore: (recent?.slayer ?? 0) * 100,
        recentConsistencyScore: (recent?.consistency ?? 0) * 100,
        standardScore: blend(standardScore, recent?.standard ?? 0),
        jimScore: blend(jimScore, recent?.jim ?? 0),
        sessionScore: blend(sessionScore, recent?.session ?? 0),
        slayerScore: blend(slayerScore, recent?.slayer ?? 0),
        consistencyScore: blend(consistencyScore, recent?.consistency ?? 0),
        standardWinRate: standardWinRate * 100,
        averageStandardPoints,
        totalStandardWins: player.standardWins,
        normalizedStandardWins: normalizedStandardWins * 100,
        jimWinRate: jimWinRate * 100,
        totalJimWins: player.jimWins,
        normalizedJimWins: normalizedJimWins * 100,
        braveryRate: braveryRate * 100,
        penakutSessions,
        penakutPenalty: penakutPenalty * 100,
        sessionWinRate: sessionWinRate * 100,
        totalSessionWins: player.sessionWins,
        normalizedSessionWins: normalizedSessionWins * 100,
        totalCatches: player.jimCatches,
        normalizedCatchScore: normalizedCatchScore * 100,
        slayerFrequency: slayerFrequency * 100,
        nonZeroRate: nonZeroRate * 100,
        strongRoundRate: strongRoundRate * 100,
        averageSessionStreak,
        streakScore: streakScore * 100,
        sessions: player.completedSessions,
        standardRounds: player.standardRounds,
        jimAttempts: player.jimAttempts,
      }
    }).sort((a, b) =>
      Number(a.provisional) - Number(b.provisional) ||
      b.score - a.score ||
      a.name.localeCompare(b.name)
    )
  }, [playerStats, sessions, sessionPlayers, rounds, roundResults, jimResults, completedSessionWinnerIds])

  const qualifiedMvpPlayers = mvpStats.filter(player => !player.provisional)
  const podiumPlayers = [
    qualifiedMvpPlayers[1],
    qualifiedMvpPlayers[0],
    qualifiedMvpPlayers[2],
  ].filter((player): player is MvpStat => Boolean(player))

  const radarSelected = (radarSelection ?? [
    ...(mvpStats[0] ? [{ playerId: mvpStats[0].playerId, visible: true }] : []),
  ]).filter(item => mvpStats.some(player => player.playerId === item.playerId))

  const radarPlayers = radarSelected.map(item =>
    mvpStats.find(player => player.playerId === item.playerId) ?? null
  )

  const visibleRadarPlayers = radarPlayers.filter((player, index) =>
    player !== null && radarSelected[index]?.visible
  )

  function addRadarPlayer(playerId: number) {
    if (radarSelected.length >= 4 || radarSelected.some(item => item.playerId === playerId)) return
    setRadarSelection([...radarSelected, { playerId, visible: true }])
    setRadarPickerOpen(false)
  }

  function toggleRadarPlayer(playerId: number) {
    setRadarSelection(radarSelected.map(item =>
      item.playerId === playerId ? { ...item, visible: !item.visible } : item
    ))
  }

  function removeRadarPlayer(playerId: number) {
    if (radarSelected.length === 1) return
    setRadarSelection(radarSelected.filter(item => item.playerId !== playerId))
  }

  const remainingRadarPlayers = mvpStats.filter(player =>
    !radarSelected.some(item => item.playerId === player.playerId)
  )

  // Base the viewing mode on players actually shown, not saved selections.
  // One visible player can overlay timeframes even with other players hidden.
  // Two or more visible players share a single timeframe for clarity.
  const radarComparison = visibleRadarPlayers.length > 1
  // Draw the bold Hybrid outline last so it stays visible above the other lines.
  const radarActiveViews: MvpRadarView[] = radarComparison
    ? [radarComparisonView]
    : (['allTime', 'recent', 'hybrid'] as MvpRadarView[]).filter(view => radarSingleViews.includes(view))
  const radarValue = (axis: (typeof MVP_RADAR_AXES)[number], player: MvpStat, view: MvpRadarView) =>
    view === 'allTime' ? axis.allTime(player) : view === 'recent' ? axis.recent(player) : axis.value(player)
  const radarData = MVP_RADAR_AXES.map(axis => {
    const row: Record<string, string | number> = { metric: axis.label }
    radarPlayers.forEach((player, slot) => {
      for (const view of MVP_RADAR_VIEWS) {
        const score = player ? radarValue(axis, player, view.key) : 0
        row[`p${slot}_${view.key}`] = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10
      }
    })
    return row
  })
  function toggleRadarSingleView(view: MvpRadarView) {
    setRadarSingleViews(previous => previous.includes(view)
      ? previous.length > 1 ? previous.filter(item => item !== view) : previous
      : [...previous, view])
  }


  // Position the phone labels individually so the pentagon can be larger
  // without chopping off Consistency at the left or Standard at the top.
  function renderRadarMobileTick(props: any) {
    const label = String(props?.payload?.value ?? '')
    const x = Number(props?.x ?? 0)
    const y = Number(props?.y ?? 0)
    let labelX = x
    let labelY = y
    let anchor: 'start' | 'middle' | 'end' = 'middle'

    switch (label) {
      case 'Standard':
        labelY -= 7
        break
      case 'Jim':
        labelX += 5
        anchor = 'start'
        break
      case 'Session':
        labelX += 1
        labelY += 7
        anchor = 'start'
        break
      case 'Slayer':
        labelX -= 1
        labelY += 7
        anchor = 'end'
        break
      case 'Consistency':
        // Full label stays in the beige panel instead of overflowing left.
        labelX = Math.max(12, x - 3)
        labelY -= 19
        anchor = 'start'
        break
    }

    return (
      <text
        x={labelX}
        y={labelY}
        fill="#2b3744"
        textAnchor={anchor}
        fontSize={11.5}
        fontWeight={700}
        stroke="none"
        strokeWidth={0}
      >
        {label}
      </text>
    )
  }

  const classicArtetaAllTimeAward =
    useMemo<Award>(() => {
      const award =
        buildCountAwards(
          playerStats
        ).find(
          (entry) =>
            entry.title ===
            'Classic Arteta'
        )

      return (
        award ?? {
          title:
            'Classic Arteta',
          description:
            'Most 2nd-place finishes in Standard rounds',
          winners: '—',
          value:
            'No 2nd-place finish yet',
          hasData: false,
        }
      )
    }, [
      playerStats,
    ])


  const penakutAllTimeAward =
    useMemo<Award>(() => {
      const award =
        buildCountAwards(
          playerStats
        ).find(
          (entry) =>
            entry.title ===
            'Penakut'
        )

      return (
        award ?? {
          title: 'Penakut',
          description:
            'Most completed sessions with zero Jim attempts',
          winners: '—',
          value: 'No Penakut session yet',
          hasData: false,
        }
      )
    }, [
      playerStats,
    ])

  const allTimeCombinedAwards =
    useMemo<
      CombinedAllTimeAward[]
    >(() => {
      const totals =
        buildCountAwards(
          playerStats
        )

      function totalAward(
        title: string
      ) {
        return (
          totals.find(
            (award) =>
              award.title ===
              title
          ) ?? {
            title,
            description: '',
            winners: '—',
            value: 'No data yet',
            hasData: false,
          }
        )
      }

      return [
        {
          title:
            'Tukang Cuci',

          description:
            'Who collects the most zero-point Standard rounds, and who does it most often relative to rounds played.',

          total:
            totalAward(
              'Tukang Cuci'
            ),

          rate:
            makeLifetimeRateAward(
              'Tukang Cuci Rate',
              'Highest lifetime share of Standard rounds ending with 0 round points',
              playerStats,
              15,
              'Standard rounds',
              (player) =>
                player.standardLosses,
              (player) =>
                player.standardRounds
            ),

          rateLabel:
            'HIGHEST RATE',
        },

        {
          title:
            'Raja Standard',

          description:
            'The biggest Standard winner by both raw wins and lifetime win percentage.',

          total:
            totalAward(
              'Raja Standard'
            ),

          rate:
            makeLifetimeRateAward(
              'Standard Win Rate',
              'Best lifetime Standard win percentage',
              playerStats,
              15,
              'Standard rounds',
              (player) =>
                player.standardWins,
              (player) =>
                player.standardRounds
            ),

          rateLabel:
            'BEST WIN RATE',
        },

        {
          title:
            'Raja Session',

          description:
            'Who wins the most completed sessions, and who converts sessions into wins most efficiently.',

          total:
            totalAward(
              'Raja Session'
            ),

          rate:
            makeLifetimeRateAward(
              'Session Win Rate',
              'Best lifetime completed-session win percentage',
              playerStats,
              3,
              'completed sessions',
              (player) =>
                player.sessionWins,
              (player) =>
                player.completedSessions
            ),

          rateLabel:
            'BEST WIN RATE',
        },

        {
          title:
            'Si Tuah',

          description:
            'The strongest Jim record by total Jim wins and lifetime Jim success percentage.',

          total:
            totalAward(
              'Si Tuah'
            ),

          rate:
            makeLifetimeRateAward(
              'Jim Success Rate',
              'Best lifetime Jim win percentage',
              playerStats,
              5,
              'Jim attempts',
              (player) =>
                player.jimWins,
              (player) =>
                player.jimAttempts
            ),

          rateLabel:
            'BEST SUCCESS RATE',
        },

        {
          title:
            'Si Malang',

          description:
            'The roughest Jim record by total failed attempts and lifetime failure percentage.',

          total:
            totalAward(
              'Si Malang'
            ),

          rate:
            makeLifetimeRateAward(
              'Jim Failure Rate',
              'Highest lifetime share of Jim attempts ending in defeat',
              playerStats,
              5,
              'Jim attempts',
              (player) =>
                player.jimLosses,
              (player) =>
                player.jimAttempts
            ),

          rateLabel:
            'HIGHEST FAILURE RATE',
        },

        {
          title:
            'Jim Slayer',

          description:
            'Who catches Jim the most, plus the strongest catch rate per session played.',

          total:
            totalAward(
              'Jim Slayer'
            ),

          rate:
            makeLifetimeAverageAward(
              'Jim Slayer Rate',
              'Most Jim catches per session played',
              playerStats,
              3,
              'sessions',
              (player) =>
                player.jimCatches,
              (player) =>
                player.sessions,
              'catches/session'
            ),

          rateLabel:
            'BEST CATCH RATE',
        },

        {
          title:
            'Kaki Jim',

          description:
            'Who takes Jim the most, plus how often they take Jim per session played.',

          total:
            totalAward(
              'Kaki Jim'
            ),

          rate:
            makeLifetimeAverageAward(
              'Kaki Jim Rate',
              'Most Jim attempts per session played',
              playerStats,
              3,
              'sessions',
              (player) =>
                player.jimAttempts,
              (player) =>
                player.sessions,
              'attempts/session'
            ),

          rateLabel:
            'HIGHEST RATE',
        },

        {
          title:
            'Paling Berolah',

          description:
            'Who receives the most penalties, plus the highest penalty rate per session played.',

          total:
            totalAward(
              'Paling Berolah'
            ),

          rate:
            makeLifetimeAverageAward(
              'Penalty Rate',
              'Most penalties per session played',
              playerStats,
              3,
              'sessions',
              (player) =>
                player.penalties,
              (player) =>
                player.sessions,
              'penalties/session'
            ),

          rateLabel:
            'HIGHEST RATE',
        },
      ].sort(
        (a, b) => {
          const order = [
            'Raja Standard',
            'Raja Session',
            'Si Tuah',
            'Si Malang',
            'Jim Slayer',
            'Tukang Cuci',
            'Kaki Jim',
            'Paling Berolah',
          ]

          return (
            order.indexOf(
              a.title
            ) -
            order.indexOf(
              b.title
            )
          )
        }
      )
    }, [
      playerStats,
    ])

  const sessionRecordAwards =
    useMemo<Award[]>(() => {
      if (
        !sessions ||
        !rounds ||
        !sessionPlayers ||
        !roundResults ||
        !jimResults
      ) {
        return []
      }

      /*
        Capture the arrays after the guard.
        TypeScript does not preserve the
        outer narrowing inside nested helper
        functions.
      */
      const allRounds =
        rounds

      const allRoundResults =
        roundResults

      const allJimResults =
        jimResults

      const completed =
        sessions.filter(
          (session) =>
            session.status ===
              'ended' &&
            session.endedAt
        )

      const durationAward:
        Award = {
          title:
            'Longest Session',

          description:
            'Longest completed game by elapsed time',

          winners: '—',
          value:
            'No completed session yet',

          hasData: false,
        }

      if (
        completed.length > 0
      ) {
        const durationEntries =
          completed.map(
            (session) => ({
              session,

              value:
                session.endedAt!.getTime() -
                session.startedAt.getTime(),
            })
          )

        const maximum =
          Math.max(
            ...durationEntries.map(
              (entry) =>
                entry.value
            )
          )

        const winners =
          durationEntries.filter(
            (entry) =>
              entry.value ===
              maximum
          )

        durationAward.winners =
          winners
            .map(
              (winner) =>
                formatDate(
                  winner.session
                    .startedAt
                )
            )
            .join(' • ')

        durationAward.value =
          formatDuration(
            maximum
          )

        durationAward.hasData =
          true
      }

      const roundAward:
        Award = {
          title:
            'Most Rounds',

          description:
            'Most Standard + Jim rounds in one completed session',

          winners: '—',
          value:
            'No completed session yet',

          hasData: false,
        }

      if (
        completed.length > 0
      ) {
        const roundEntries =
          completed.map(
            (session) => ({
              session,

              value:
                rounds.filter(
                  (round) =>
                    round.sessionId ===
                    session.id
                ).length,
            })
          )

        const maximum =
          Math.max(
            ...roundEntries.map(
              (entry) =>
                entry.value
            )
          )

        if (maximum > 0) {
          const winners =
            roundEntries.filter(
              (entry) =>
                entry.value ===
                maximum
            )

          roundAward.winners =
            winners
              .map(
                (winner) =>
                  formatDate(
                    winner.session
                      .startedAt
                  )
              )
              .join(' • ')

          roundAward.value =
            `${maximum} rounds`

          roundAward.hasData =
            true
        }
      }

      const winStreakRecord:
        Award = {
          title:
            'Win Streak Record',

          description:
            'Longest run of consecutive wins by one player in a single completed session. Standard wins, successful Jim, and catching Jim count. Waiting and penalties pause the streak.',

          winners: '—',
          value:
            'No 2-win streak yet',

          hasData: false,
        }

      if (
        completed.length > 0
      ) {
        function longestSessionStreak(
          sessionId: number,
          playerId: number
        ) {
          let current:
            WinStreakPathEvent[] = []

          let longest:
            WinStreakPathEvent[] = []

          const orderedRounds =
            allRounds
              .filter(
                (round) =>
                  round.sessionId ===
                  sessionId
              )
              .sort(
                (a, b) =>
                  a.roundNumber -
                    b.roundNumber ||
                  a.id - b.id
              )

          function addWin(
            event:
              WinStreakPathEvent
          ) {
            current = [
              ...current,
              event,
            ]

            if (
              current.length >
              longest.length
            ) {
              longest = [
                ...current,
              ]
            }
          }

          orderedRounds.forEach(
            (round) => {
              if (
                round.type ===
                'standard'
              ) {
                const result =
                  allRoundResults.find(
                    (entry) =>
                      entry.roundId ===
                        round.id &&
                      entry.playerId ===
                        playerId
                  )

                // Waiting / not playing: pause.
                if (!result) {
                  return
                }

                if (
                  result.position === 1
                ) {
                  addWin({
                    type:
                      'standard',

                    roundNumber:
                      round.roundNumber,
                  })
                } else {
                  current = []
                }

                return
              }

              const result =
                allJimResults.find(
                  (entry) =>
                    entry.roundId ===
                    round.id
                )

              if (!result) {
                return
              }

              if (
                result.jimPlayerId ===
                playerId
              ) {
                if (result.won) {
                  addWin({
                    type: 'jim',

                    roundNumber:
                      round.roundNumber,

                    usedHide:
                      typeof result.hideStage ===
                      'number',
                  })
                } else {
                  current = []
                }

                return
              }

              if (
                result.caughtByPlayerId ===
                playerId
              ) {
                addWin({
                  type: 'catch',

                  roundNumber:
                    round.roundNumber,
                })

                return
              }

              if (
                result.won &&
                result.outPlayerId ===
                  playerId
              ) {
                current = []
                return
              }

              // Other Jim players: pause.
            }
          )

          return {
            length:
              longest.length,

            path:
              longest,
          }
        }

        const streakEntries =
          completed.flatMap(
            (session) => {
              const participants =
                sessionPlayers.filter(
                  (entry) =>
                    entry.sessionId ===
                    session.id
                )

              return participants.map(
                (participant) => {
                  const streak =
                    longestSessionStreak(
                      session.id,
                      participant.playerId
                    )

                  return {
                    session,

                    playerId:
                      participant.playerId,

                    value:
                      streak.length,

                    path:
                      streak.path,
                  }
                }
              )
            }
          )

        const maximum =
          Math.max(
            0,
            ...streakEntries.map(
              (entry) =>
                entry.value
            )
          )

        /*
          A single isolated win is not
          treated as a streak.
        */
        if (maximum >= 2) {
          const winners =
            streakEntries.filter(
              (entry) =>
                entry.value ===
                maximum
            )

          winStreakRecord.winners =
            winners
              .map(
                (winner) =>
                  getSessionName(
                    winner.session.id,
                    winner.playerId
                  )
              )
              .join(' • ')

          winStreakRecord.winnerLines =
            winners.map(
              (winner) => ({
                name:
                  getSessionName(
                    winner.session.id,
                    winner.playerId
                  ),

                meta:
                  formatDate(
                    winner.session
                      .startedAt
                  ),

                streakPath:
                  winner.path,
              })
            )

          winStreakRecord.value =
            `${maximum}-win streak`

          winStreakRecord.hasData =
            true
        }
      }

      const jimSlayerAward:
        Award = {
          title:
            'Jim Slayer Record',

          description:
            'Most Jim catches by one player in a single completed session',

          winners: '—',
          value:
            'No catches yet',

          hasData: false,
        }

      if (
        completed.length > 0
      ) {
        const catchEntries =
          completed.flatMap(
            (session) => {
              const participants =
                sessionPlayers.filter(
                  (entry) =>
                    entry.sessionId ===
                    session.id
                )

              return participants.map(
                (participant) => ({
                  session,
                  playerId:
                    participant.playerId,

                  value:
                    jimResults.filter(
                      (result) =>
                        result.sessionId ===
                          session.id &&
                        result.caughtByPlayerId ===
                          participant.playerId
                    ).length,
                })
              )
            }
          )

        const maximum =
          Math.max(
            0,
            ...catchEntries.map(
              (entry) =>
                entry.value
            )
          )

        if (maximum > 0) {
          const winners =
            catchEntries.filter(
              (entry) =>
                entry.value ===
                maximum
            )

          jimSlayerAward.winners =
            winners
              .map(
                (winner) =>
                  getName(
                    winner.playerId
                  )
              )
              .join(' • ')

          jimSlayerAward.winnerLines =
            winners.map(
              (winner) => ({
                name:
                  getName(
                    winner.playerId
                  ),

                meta:
                  formatDate(
                    winner.session
                      .startedAt
                  ),
              })
            )

          jimSlayerAward.value =
            `${maximum} catches`

          jimSlayerAward.hasData =
            true
        }
      }

      const jimSessionEntries =
        completed.flatMap(
          (session) => {
            const participants =
              sessionPlayers.filter(
                (entry) =>
                  entry.sessionId ===
                  session.id
              )

            return participants.map(
              (participant) => {
                const attempts =
                  jimResults.filter(
                    (result) =>
                      result.sessionId ===
                        session.id &&
                      result.jimPlayerId ===
                        participant.playerId
                  )

                const wins =
                  attempts.filter(
                    (result) =>
                      result.won
                  ).length

                return {
                  session,
                  playerId:
                    participant.playerId,
                  attempts:
                    attempts.length,
                  wins,
                  losses:
                    attempts.length -
                    wins,
                }
              }
            )
          }
        )

      function makeJimSessionRecord(
        title: string,
        description: string,
        getValue: (
          entry:
            typeof jimSessionEntries[number]
        ) => number,
        valueLabel: (
          maximum: number
        ) => string,
        emptyValue: string
      ): Award {
        const award:
          Award = {
            title,
            description,
            winners: '—',
            value: emptyValue,
            hasData: false,
          }

        const maximum =
          Math.max(
            0,
            ...jimSessionEntries.map(
              (entry) =>
                getValue(entry)
            )
          )

        if (maximum <= 0) {
          return award
        }

        const winners =
          jimSessionEntries.filter(
            (entry) =>
              getValue(entry) ===
              maximum
          )

        award.winners =
          winners
            .map(
              (winner) =>
                getSessionName(
                  winner.session.id,
                  winner.playerId
                )
            )
            .join(' • ')

        award.winnerLines =
          winners.map(
            (winner) => ({
              name:
                getSessionName(
                  winner.session.id,
                  winner.playerId
                ),

              meta:
                formatDate(
                  winner.session
                    .startedAt
                ),
            })
          )

        award.value =
          valueLabel(
            maximum
          )

        award.hasData =
          true

        return award
      }

      const siMalangRecord =
        makeJimSessionRecord(
          'Si Malang Record',
          'Most failed Jim attempts by one player in a single completed session',
          (entry) =>
            entry.losses,
          (maximum) =>
            `${maximum} Jim ${
              maximum === 1
                ? 'loss'
                : 'losses'
            }`,
          'No Jim losses yet'
        )

      const kakiJimRecord =
        makeJimSessionRecord(
          'Kaki Jim Record',
          'Most Jim attempts by one player in a single completed session',
          (entry) =>
            entry.attempts,
          (maximum) =>
            `${maximum} Jim ${
              maximum === 1
                ? 'attempt'
                : 'attempts'
            }`,
          'No Jim attempts yet'
        )

      const siTuahRecord =
        makeJimSessionRecord(
          'Si Tuah Record',
          'Most Jim wins by one player in a single completed session',
          (entry) =>
            entry.wins,
          (maximum) =>
            `${maximum} Jim ${
              maximum === 1
                ? 'win'
                : 'wins'
            }`,
          'No Jim wins yet'
        )

      return [
        durationAward,
        roundAward,
        winStreakRecord,
        jimSlayerAward,
        siMalangRecord,
        kakiJimRecord,
        siTuahRecord,
      ]
    }, [
      sessions,
      rounds,
      sessionPlayers,
      roundResults,
      jimResults,
      playerNameMap,
    ])

  const singleSessionRateAwards =
    useMemo<Award[]>(() => {
      if (
        !sessions ||
        !sessionPlayers ||
        !roundResults ||
        !jimResults
      ) {
        return []
      }

      const standardCandidates:
        SessionRateCandidate[] = []

      const zeroPointCandidates:
        SessionRateCandidate[] = []

      const jimCandidates:
        SessionRateCandidate[] = []

      const hideCandidates:
        SessionRateCandidate[] = []

      sessions
        .filter(
          (session) =>
            session.status ===
            'ended'
        )
        .forEach(
          (session) => {
            const participants =
              sessionPlayers.filter(
                (entry) =>
                  entry.sessionId ===
                  session.id
              )

            participants.forEach(
              (participant) => {
                const standard =
                  roundResults.filter(
                    (result) =>
                      result.sessionId ===
                        session.id &&
                      result.playerId ===
                        participant.playerId
                  )

                const standardWins =
                  standard.filter(
                    (result) =>
                      result.position ===
                      1
                  ).length

                const zeroPointRounds =
                  standard.filter(
                    (result) =>
                      result.pointsAwarded ===
                      0
                  ).length

                if (
                  standard.length > 0
                ) {
                  standardCandidates.push({
                    playerId:
                      participant.playerId,

                    playerName:
                      getSessionName(
                        session.id,
                        participant.playerId
                      ),

                    sessionId:
                      session.id,

                    date:
                      session.startedAt,

                    numerator:
                      standardWins,

                    denominator:
                      standard.length,

                    rate:
                      (
                        standardWins /
                        standard.length
                      ) * 100,
                  })

                  zeroPointCandidates.push({
                    playerId:
                      participant.playerId,

                    playerName:
                      getSessionName(
                        session.id,
                        participant.playerId
                      ),

                    sessionId:
                      session.id,

                    date:
                      session.startedAt,

                    numerator:
                      zeroPointRounds,

                    denominator:
                      standard.length,

                    rate:
                      (
                        zeroPointRounds /
                        standard.length
                      ) * 100,
                  })
                }

                const jimAttempts =
                  jimResults.filter(
                    (result) =>
                      result.sessionId ===
                        session.id &&
                      result.jimPlayerId ===
                        participant.playerId
                  )

                const jimWins =
                  jimAttempts.filter(
                    (result) =>
                      result.won
                  ).length

                if (
                  jimAttempts.length >
                  0
                ) {
                  jimCandidates.push({
                    playerId:
                      participant.playerId,

                    playerName:
                      getSessionName(
                        session.id,
                        participant.playerId
                      ),

                    sessionId:
                      session.id,

                    date:
                      session.startedAt,

                    numerator:
                      jimWins,

                    denominator:
                      jimAttempts.length,

                    rate:
                      (
                        jimWins /
                        jimAttempts.length
                      ) * 100,
                  })
                }

                const hideAttempts =
                  jimAttempts.filter(
                    (result) =>
                      typeof result.hideStage ===
                      'number'
                  )

                const hideWins =
                  hideAttempts.filter(
                    (result) =>
                      result.won
                  ).length

                if (
                  hideAttempts.length >
                  0
                ) {
                  hideCandidates.push({
                    playerId:
                      participant.playerId,

                    playerName:
                      getSessionName(
                        session.id,
                        participant.playerId
                      ),

                    sessionId:
                      session.id,

                    date:
                      session.startedAt,

                    numerator:
                      hideWins,

                    denominator:
                      hideAttempts.length,

                    rate:
                      (
                        hideWins /
                        hideAttempts.length
                      ) * 100,
                  })
                }
              }
            )
          }
        )

      return [
        makeRateRecord(
          'Standard Win Rate',
          'Best Standard win rate achieved within one completed session',
          standardCandidates,
          5,
          'Standard rounds'
        ),

        makeRateRecord(
          'Jim Success Rate',
          'Best Jim success rate achieved within one completed session',
          jimCandidates,
          2,
          'Jim attempts'
        ),

        makeRateRecord(
          'Hide Success Rate',
          'Best Jim win rate in sessions where Hide was used',
          hideCandidates,
          2,
          'Hide uses'
        ),

        makeRateRecord(
          'Tukang Cuci Rate',
          'Highest share of Standard rounds ending with 0 round points',
          zeroPointCandidates,
          5,
          'Standard rounds'
        ),
      ]
    }, [
      sessions,
      sessionPlayers,
      roundResults,
      jimResults,
      playerNameMap,
    ])


  function buildAwardsForSession(
    sessionId: number
  ): Award[] {
    const participants =
      (sessionPlayers ?? []).filter(
        (entry) =>
          entry.sessionId ===
          sessionId
      )


    const sessionName = (
      playerId: number
    ) =>
      participants.find(
        (entry) =>
          entry.playerId ===
          playerId
      )?.displayName ??
      getName(playerId)

    const standard =
      (roundResults ?? []).filter(
        (result) =>
          result.sessionId ===
          sessionId
      )

    const jim =
      (jimResults ?? []).filter(
        (result) =>
          result.sessionId ===
          sessionId
      )

    const penalties =
      (penaltyResults ?? []).filter(
        (penalty) =>
          penalty.sessionId ===
          sessionId
      )

    const sessionRounds =
      (rounds ?? []).filter(
        (round) =>
          round.sessionId ===
          sessionId
      )

    function statFor(
      playerId: number
    ) {
      const playerStandard =
        standard.filter(
          (result) =>
            result.playerId ===
            playerId
        )

      const standardWins =
        playerStandard.filter(
          (result) =>
            result.position === 1
        ).length

      const zeroRounds =
        playerStandard.filter(
          (result) =>
            result.pointsAwarded ===
            0
        ).length

      const jimAttempts =
        jim.filter(
          (result) =>
            result.jimPlayerId ===
            playerId
        )

      const jimWins =
        jimAttempts.filter(
          (result) =>
            result.won
        ).length

      const jimLosses =
        jimAttempts.length -
        jimWins

      const catches =
        jim.filter(
          (result) =>
            result.caughtByPlayerId ===
            playerId
        ).length

      const hideUses =
        jimAttempts.filter(
          (result) =>
            typeof result.hideStage ===
            'number'
        ).length

      const playerPenalties =
        penalties.filter(
          (penalty) =>
            penalty.playerId ===
            playerId
        ).length

      return {
        standardRounds:
          playerStandard.length,

        standardWins,

        zeroRounds,

        jimAttempts:
          jimAttempts.length,

        jimWins,

        jimLosses,

        catches,

        hideUses,

        penalties:
          playerPenalties,
      }
    }

    const stats =
      participants.map(
        (participant) => ({
          participant,
          stats:
            statFor(
              participant.playerId
            ),
        })
      )

    /*
      WIN STREAK RULES

      Standard 1st = win.
      Successful Jim = win for Jim.
      Catching Jim = win for catcher.
      Waiting / not participating = pause.
      Penalty = pause.
      Recorded non-win = break.
      Successful Jim outPlayer = break.
      Other players in a Jim round = pause,
      because older Jim history does not
      reliably record every defender.
    */
    function longestWinStreak(
      playerId: number
    ) {
      let current:
        WinStreakPathEvent[] = []

      let longest:
        WinStreakPathEvent[] = []

      const orderedRounds =
        [...sessionRounds].sort(
          (a, b) =>
            a.roundNumber -
              b.roundNumber ||
            a.id - b.id
        )

      function addWin(
        event:
          WinStreakPathEvent
      ) {
        current = [
          ...current,
          event,
        ]

        if (
          current.length >
          longest.length
        ) {
          longest = [
            ...current,
          ]
        }
      }

      orderedRounds.forEach(
        (round) => {
          if (
            round.type ===
            'standard'
          ) {
            const result =
              standard.find(
                (entry) =>
                  entry.roundId ===
                    round.id &&
                  entry.playerId ===
                    playerId
              )

            // Waiting / not playing: pause.
            if (!result) {
              return
            }

            if (
              result.position === 1
            ) {
              addWin({
                type:
                  'standard',

                roundNumber:
                  round.roundNumber,
              })
            } else {
              current = []
            }

            return
          }

          const result =
            jim.find(
              (entry) =>
                entry.roundId ===
                  round.id
            )

          if (!result) {
            return
          }

          if (
            result.jimPlayerId ===
            playerId
          ) {
            if (result.won) {
              addWin({
                type: 'jim',

                roundNumber:
                  round.roundNumber,

                usedHide:
                  typeof result.hideStage ===
                  'number',
              })
            } else {
              current = []
            }

            return
          }

          if (
            result.caughtByPlayerId ===
            playerId
          ) {
            addWin({
              type: 'catch',

              roundNumber:
                round.roundNumber,
            })

            return
          }

          if (
            result.won &&
            result.outPlayerId ===
              playerId
          ) {
            current = []
            return
          }

          // Everyone else in Jim: pause.
        }
      )

      return {
        length:
          longest.length,

        path:
          longest,
      }
    }

    const streakStats =
      participants.map(
        (participant) => {
          const streak =
            longestWinStreak(
              participant.playerId
            )

          return {
            participant,

            streak:
              streak.length,

            streakPath:
              streak.path,
          }
        }
      )

    function makeSessionAward(
      title: string,
      description: string,
      getValue: (
        entry:
          typeof stats[number]
      ) => number,
      getMeta: (
        entry:
          typeof stats[number]
      ) => string,
      valueLabel: (
        maximum: number
      ) => string
    ): Award | null {
      if (stats.length === 0) {
        return null
      }

      const maximum =
        Math.max(
          0,
          ...stats.map(
            (entry) =>
              getValue(entry)
          )
        )

      if (maximum <= 0) {
        return null
      }

      const winners =
        stats.filter(
          (entry) =>
            getValue(entry) ===
            maximum
        )

      return {
        title,
        description,

        winners:
          winners
            .map(
              (winner) =>
                sessionName(
                  winner
                    .participant
                    .playerId
                )
            )
            .join(' • '),

        winnerLines:
          winners.map(
            (winner) => ({
              name:
                sessionName(
                  winner
                    .participant
                    .playerId
                ),

              meta:
                getMeta(
                  winner
                ),
            })
          ),

        value:
          valueLabel(
            maximum
          ),

        hasData: true,
      }
    }

    const awards:
      Award[] = []

    if (participants.length > 0) {
      const topPoints =
        Math.max(
          ...participants.map(
            (participant) =>
              participant.points
          )
        )

      const champions =
        participants.filter(
          (participant) =>
            participant.points ===
            topPoints
        )

      awards.push({
        title:
          'Session Champion',

        description:
          'Highest final score in this session',

        winners:
          champions
            .map(
              (champion) =>
                sessionName(
                  champion.playerId
                )
            )
            .join(' • '),

        winnerLines:
          champions.map(
            (champion) => ({
              name:
                sessionName(
                  champion.playerId
                ),

              meta:
                `${champion.points} pts`,
            })
          ),

        value:
          topPoints === 1
            ? '1 point'
            : `${topPoints} points`,

        hasData: true,
      })
    }

    const longestStreak =
      Math.max(
        0,
        ...streakStats.map(
          (entry) =>
            entry.streak
        )
      )

    /*
      One isolated win is not shown as a
      streak. Minimum qualifying streak = 2.
    */
    if (longestStreak >= 2) {
      const streakWinners =
        streakStats.filter(
          (entry) =>
            entry.streak ===
            longestStreak
        )

      awards.push({
        title:
          'Win Streak',

        description:
          'Longest run of consecutive wins in this session. Standard wins, successful Jim, and catching Jim count. Other players in a Jim round do not gain or lose their streak.',

        winners:
          streakWinners
            .map(
              (winner) =>
                sessionName(
                  winner
                    .participant
                    .playerId
                )
            )
            .join(' • '),

        winnerLines:
          streakWinners.map(
            (winner) => ({
              name:
                sessionName(
                  winner
                    .participant
                    .playerId
                ),

              meta:
                `${winner.streak} consecutive wins`,

              streakPath:
                winner.streakPath,
            })
          ),

        value:
          `${longestStreak}-win streak`,

        note:
          'Waiting and penalties pause the streak rather than breaking it.',

        hasData: true,
      })
    }

    const rajaStandard =
      makeSessionAward(
        'Raja Standard',
        'Most Standard Round wins in this session',
        (entry) =>
          entry.stats
            .standardWins,
        (entry) => {
          const total =
            entry.stats
              .standardRounds

          const wins =
            entry.stats
              .standardWins

          const rate =
            percentage(
              wins,
              total
            )

          return rate === null
            ? `${wins}/${total}`
            : `${wins}/${total} • ${displayPercent(
                rate
              )}`
        },
        (maximum) =>
          `${maximum} Standard ${
            maximum === 1
              ? 'win'
              : 'wins'
          }`
      )

    if (rajaStandard) {
      awards.push(
        rajaStandard
      )
    }

    const tukangCuci =
      makeSessionAward(
        'Tukang Cuci',
        'Most Standard rounds with 0 round points in this session',
        (entry) =>
          entry.stats
            .zeroRounds,
        (entry) => {
          const zero =
            entry.stats
              .zeroRounds

          const total =
            entry.stats
              .standardRounds

          const rate =
            percentage(
              zero,
              total
            )

          return rate === null
            ? `${zero}/${total}`
            : `${zero}/${total} • ${displayPercent(
                rate
              )}`
        },
        (maximum) =>
          `${maximum} zero-point ${
            maximum === 1
              ? 'round'
              : 'rounds'
          }`
      )

    if (tukangCuci) {
      awards.push(
        tukangCuci
      )
    }

    const siTuah =
      makeSessionAward(
        'Si Tuah',
        'Most successful Jim wins in this session',
        (entry) =>
          entry.stats
            .jimWins,
        (entry) => {
          const wins =
            entry.stats
              .jimWins

          const attempts =
            entry.stats
              .jimAttempts

          const rate =
            percentage(
              wins,
              attempts
            )

          return rate === null
            ? `${wins}/${attempts}`
            : `${wins}/${attempts} • ${displayPercent(
                rate
              )}`
        },
        (maximum) =>
          `${maximum} Jim ${
            maximum === 1
              ? 'win'
              : 'wins'
          }`
      )

    if (siTuah) {
      awards.push(
        siTuah
      )
    }

    const siMalang =
      makeSessionAward(
        'Si Malang',
        'Most Jim attempts ending in defeat in this session',
        (entry) =>
          entry.stats
            .jimLosses,
        (entry) => {
          const losses =
            entry.stats
              .jimLosses

          const attempts =
            entry.stats
              .jimAttempts

          const rate =
            percentage(
              losses,
              attempts
            )

          return rate === null
            ? `${losses}/${attempts}`
            : `${losses}/${attempts} • ${displayPercent(
                rate
              )}`
        },
        (maximum) =>
          `${maximum} Jim ${
            maximum === 1
              ? 'loss'
              : 'losses'
          }`
      )

    if (siMalang) {
      awards.push(
        siMalang
      )
    }

    const jimSlayer =
      makeSessionAward(
        'Jim Slayer',
        'Caught Jim the most times in this session',
        (entry) =>
          entry.stats
            .catches,
        (entry) => {
          const catches =
            entry.stats
              .catches

          const jimRounds =
            jim.length

          const rate =
            percentage(
              catches,
              jimRounds
            )

          return jimRounds === 0
            ? `${catches} catches`
            : `${catches}/${jimRounds} Jim rounds${
                rate === null
                  ? ''
                  : ` • ${displayPercent(
                      rate
                    )}`
              }`
        },
        (maximum) =>
          `${maximum} ${
            maximum === 1
              ? 'catch'
              : 'catches'
          }`
      )

    if (jimSlayer) {
      awards.push(
        jimSlayer
      )
    }

    const kakiJim =
      makeSessionAward(
        'Kaki Jim',
        'Took Jim the most times in this session',
        (entry) =>
          entry.stats
            .jimAttempts,
        (entry) => {
          const attempts =
            entry.stats
              .jimAttempts

          const totalJimRounds =
            jim.length

          const share =
            percentage(
              attempts,
              totalJimRounds
            )

          return totalJimRounds ===
            0
            ? `${attempts} attempts`
            : `${attempts}/${totalJimRounds} Jim rounds${
                share === null
                  ? ''
                  : ` • ${displayPercent(
                      share
                    )}`
              }`
        },
        (maximum) =>
          `${maximum} ${
            maximum === 1
              ? 'attempt'
              : 'attempts'
          }`
      )

    if (kakiJim) {
      awards.push(
        kakiJim
      )
    }

    // Everyone with zero Jim attempts in this completed session is Penakut.
    {
      const penakutWinners =
        stats.filter(
          (entry) =>
            entry.stats
              .jimAttempts === 0
        )

      if (
        penakutWinners.length > 0
      ) {
        awards.push({
          title:
            'Penakut',

          description:
            'Finished this session without a single Jim attempt',

          winners:
            penakutWinners
              .map(
                (winner) =>
                  sessionName(
                    winner
                      .participant
                      .playerId
                  )
              )
              .join(' • '),

          winnerLines:
            penakutWinners.map(
              (winner) => ({
                name:
                  sessionName(
                    winner
                      .participant
                      .playerId
                  ),

                meta:
                  `0 attempts • ${jim.length} Jim ${
                    jim.length === 1
                      ? 'round'
                      : 'rounds'
                  }`,
              })
            ),

          value:
            '0 Jim attempts',

          hasData: true,
        })
      }
    }

    const palingBerolah =
      makeSessionAward(
        'Paling Berolah',
        'Received the most penalties in this session',
        (entry) =>
          entry.stats
            .penalties,
        (entry) => {
          const count =
            entry.stats
              .penalties

          const totalRounds =
            sessionRounds.length

          return totalRounds === 0
            ? `${count} penalties`
            : `${count}/${totalRounds} rounds`
        },
        (maximum) =>
          `${maximum} ${
            maximum === 1
              ? 'penalty'
              : 'penalties'
          }`
      )

    if (palingBerolah) {
      awards.push(
        palingBerolah
      )
    }

    return awards
  }

  function requestDeleteSession(
    sessionId: number
  ) {
    const session =
      sessions?.find(
        (item) =>
          item.id ===
          sessionId
      )

    if (
      !session ||
      session.status ===
        'active'
    ) {
      return
    }

    setDeleteSessionId(
      sessionId
    )
  }

  function cancelDeleteSession() {
    if (deletingSession) {
      return
    }

    setDeleteSessionId(
      null
    )
  }

  async function confirmDeleteSession() {
    if (
      deletingSession ||
      deleteSessionId ===
        null
    ) {
      return
    }

    const session =
      sessions?.find(
        (item) =>
          item.id ===
          deleteSessionId
      )

    /*
      Active games must be ended
      from the main scoreboard first.
    */
    if (
      !session ||
      session.status ===
        'active'
    ) {
      setDeleteSessionId(
        null
      )

      return
    }

    setDeletingSession(true)

    try {
      await db.transaction(
        'rw',
        [
          db.sessions,
          db.sessionPlayers,
          db.rounds,
          db.roundResults,
          db.jimResults,
          db.penaltyResults,
        ],
        async () => {
          await db.roundResults
            .where(
              'sessionId'
            )
            .equals(
              session.id
            )
            .delete()

          await db.jimResults
            .where(
              'sessionId'
            )
            .equals(
              session.id
            )
            .delete()

          await db.penaltyResults
            .where(
              'sessionId'
            )
            .equals(
              session.id
            )
            .delete()

          await db.rounds
            .where(
              'sessionId'
            )
            .equals(
              session.id
            )
            .delete()

          await db.sessionPlayers
            .where(
              'sessionId'
            )
            .equals(
              session.id
            )
            .delete()

          await db.sessions.delete(
            session.id
          )
        }
      )

      setExpandedSessionId(
        (current) =>
          current ===
          session.id
            ? null
            : current
      )

      setDeleteSessionId(
        null
      )
    } finally {
      setDeletingSession(
        false
      )
    }
  }

  if (
    !sessions ||
    !sessionPlayers ||
    !rounds ||
    !roundResults ||
    !jimResults ||
    !penaltyResults
  ) {
    return (
      <main
        className="app"
        key="history-loading"
      >
        <p>
          Loading history...
        </p>
      </main>
    )
  }

  if (
    awardSessionId !== null
  ) {
    const session =
      sessions.find(
        (item) =>
          item.id ===
          awardSessionId
      )

    if (session) {
      const sessionRounds =
        rounds.filter(
          (round) =>
            round.sessionId ===
            session.id
        )

      const awards =
        buildAwardsForSession(
          session.id
        )

      const duration =
        session.endedAt
          ? formatDuration(
              session.endedAt.getTime() -
                session.startedAt.getTime()
            )
          : 'In progress'

      return (
        <main
          className="app historyPage sessionAwardsPage"
          key={`session-awards-${session.id}`}
        >
          <header className="historyHeader">
            <button
              className="roundBack"
              onClick={() => {
                if (
                  initialAwardSessionId !==
                  undefined
                ) {
                  onBack()
                  return
                }

                setAwardSessionId(
                  null
                )
              }}
            >
              ←
            </button>

            <div>
              <span>
                SESSION AWARDS
              </span>

              <h1>
                {formatDate(
                  session.startedAt
                )}
              </h1>
            </div>
          </header>

          <section className="sessionAwardsSummary">
            <div>
              <span>
                ROUNDS
              </span>

              <strong>
                {
                  sessionRounds.length
                }
              </strong>
            </div>

            <div>
              <span>
                DURATION
              </span>

              <strong>
                {duration}
              </strong>
            </div>
          </section>

          {awards.length === 0 ? (
            <div className="historyEmpty">
              No awards to show yet.
            </div>
          ) : (
            <section className="awardGrid sessionOwnAwardGrid">
              {awards.map(
                (award) => (
                  <article
                    className={`awardCard rateAwardCard awardTone-${getAwardTone(
                      award.title
                    )}`}
                    key={
                      award.title
                    }
                  >
                    <AwardTitleInfo
                      title={
                        award.title
                      }
                      description={
                        award.description
                      }
                    />

                    {award.winnerLines ? (
                      <div className="sessionRecordWinners">
                        {award.winnerLines.map(
                          (
                            winner,
                            index
                          ) => (
                            <div
                              className="sessionRecordWinner"
                              key={`${winner.name}-${winner.meta}-${index}`}
                            >
                              <h3>
                                {
                                  winner.name
                                }
                              </h3>

                              {winner.meta && (
                                <span>
                                  {
                                    winner.meta
                                  }
                                </span>
                              )}

                              {winner.streakPath && (
                                <WinStreakPath
                                  events={
                                    winner.streakPath
                                  }
                                />
                              )}
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <h3>
                        {award.winners}
                      </h3>
                    )}

                    <strong>
                      {award.value}
                    </strong>

                  </article>
                )
              )}
            </section>
          )}
        </main>
      )
    }
  }

  if (
    raceSessionId !== null
  ) {
    const session =
      sessions.find(
        (item) =>
          item.id ===
          raceSessionId
      )

    if (session) {
      const participants =
        sessionPlayers
          .filter(
            (player) =>
              player.sessionId ===
              session.id
          )
          .sort(
            (a, b) =>
              a.rotationOrder -
              b.rotationOrder
          )

      const sessionDisplayPlayers =
        players.map(
          (player) => {
            const participant =
              participants.find(
                (entry) =>
                  entry.playerId ===
                  player.id
              )

            if (
              !participant?.displayName
            ) {
              return player
            }

            return {
              ...player,
              name:
                participant.displayName,
            }
          }
        )

      return (
        <TitleRace
          key={`history-race-${session.id}`}
          session={session}
          sessionPlayers={
            participants
          }
          players={
            sessionDisplayPlayers
          }
          onExpandedChange={setRaceFullscreenActive}
          onBack={() =>
            setRaceSessionId(
              null
            )
          }
        />
      )
    }
  }

  const deleteSession =
    deleteSessionId === null
      ? null
      : sessions.find(
          (session) =>
            session.id ===
            deleteSessionId
        )

  const deleteSessionRoundCount =
    deleteSession
      ? rounds.filter(
          (round) =>
            round.sessionId ===
            deleteSession.id
        ).length
      : 0

  const deleteSessionDuration =
    deleteSession?.endedAt
      ? formatDuration(
          deleteSession.endedAt.getTime() -
            deleteSession.startedAt.getTime()
        )
      : '—'

  const sessionPlayerDetailData =
    sessionPlayerDetail === null
      ? null
      : (() => {
          const session =
            sessions.find(
              (item) =>
                item.id ===
                sessionPlayerDetail.sessionId
            )

          if (!session) {
            return null
          }

          const participants =
            sessionPlayers.filter(
              (player) =>
                player.sessionId ===
                session.id
            )

          const participant =
            participants.find(
              (player) =>
                player.playerId ===
                sessionPlayerDetail.playerId
            )

          if (!participant) {
            return null
          }

          const sessionRounds =
            rounds.filter(
              (round) =>
                round.sessionId ===
                session.id
            )

          const standardResults =
            roundResults.filter(
              (result) =>
                result.sessionId ===
                  session.id &&
                result.playerId ===
                  participant.playerId
            )

          const jimAttempts =
            jimResults.filter(
              (result) =>
                result.sessionId ===
                  session.id &&
                result.jimPlayerId ===
                  participant.playerId
            )

          const jimWins =
            jimAttempts.filter(
              (result) =>
                result.won
            )

          const catches =
            jimResults.filter(
              (result) =>
                result.sessionId ===
                  session.id &&
                result.caughtByPlayerId ===
                  participant.playerId
            )

          const caught =
            jimAttempts.filter(
              (result) =>
                !result.won
            )

          const penalties =
            penaltyResults.filter(
              (penalty) =>
                penalty.sessionId ===
                  session.id &&
                penalty.playerId ===
                  participant.playerId
            )

          const standardWins =
            standardResults.filter(
              (result) =>
                result.position === 1
            ).length

          const standardRate =
            standardResults.length === 0
              ? null
              : standardWins /
                standardResults.length

          const jimRate =
            jimAttempts.length === 0
              ? null
              : jimWins.length /
                jimAttempts.length

          const averageStages =
            jimAttempts.length === 0
              ? null
              : jimAttempts.reduce(
                  (
                    total,
                    result
                  ) =>
                    total +
                    result.stepsSurvived,
                  0
                ) /
                jimAttempts.length

          const hideUses =
            jimAttempts.filter(
              (result) =>
                typeof result.hideStage ===
                'number'
            ).length

          const ranking =
            [...participants].sort(
              (a, b) =>
                b.points -
                  a.points ||
                a.rotationOrder -
                  b.rotationOrder
            )

          const rank =
            ranking.findIndex(
              (player) =>
                player.playerId ===
                participant.playerId
            ) + 1

          /*
            With exactly four session players,
            everyone is active for every round,
            so total rounds played is exact.

            With a waiting queue, older Jim data
            does not store the two passive
            defenders. In that case we show the
            minimum number of recorded rounds
            instead of inventing participation.
          */
          const exactRoundsPlayed =
            participants.length <= 4

          const recordedRoundIds =
            new Set<number>()

          standardResults.forEach(
            (result) =>
              recordedRoundIds.add(
                result.roundId
              )
          )

          jimResults
            .filter(
              (result) =>
                result.sessionId ===
                  session.id &&
                (
                  result.jimPlayerId ===
                    participant.playerId ||
                  result.caughtByPlayerId ===
                    participant.playerId ||
                  result.outPlayerId ===
                    participant.playerId
                )
            )
            .forEach(
              (result) =>
                recordedRoundIds.add(
                  result.roundId
                )
            )

          const roundsPlayed =
            exactRoundsPlayed
              ? sessionRounds.length
              : recordedRoundIds.size

          return {
            session,
            participant,
            playerName:
              getSessionName(
                session.id,
                participant.playerId
              ),
            rank,
            roundsPlayed,
            exactRoundsPlayed,
            standardRounds:
              standardResults.length,
            standardWins,
            standardRate,
            jimAttempts,
            jimWins,
            jimRate,
            averageStages,
            catches,
            caughtFailures: caught,
            caught:
              caught.length,
            penalties:
              penalties.length,
            hideUses,
          }
        })()

  // Keep the 0–100 scale horizontal and clear of the Standard spoke.
  // (The built-in Recharts radial ticks crowded the axis on small screens.)
  function renderRadarRadiusTick(props: any) {
    const x = Number(props?.x)
    const y = Number(props?.y)
    const value = Number(props?.payload?.value)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(value)) {
      return null
    }

    return (
      <text
        x={x + (radarIsMobile ? 22 : 11)}
        y={radarIsMobile ? y + (value === 100 ? 6 : -1) : y - 3}
        textAnchor="start"
        dominantBaseline="central"
        fill="#887e71"
        fontSize={radarIsMobile ? 9 : 12}
        fontWeight={500}
        fontStyle="normal"
        style={radarIsMobile
          ? { pointerEvents: 'none', textShadow: 'none' }
          : {
              pointerEvents: 'none',
              paintOrder: 'stroke',
              stroke: '#f2e9d9',
              strokeWidth: 3,
              strokeLinejoin: 'round',
              textShadow: 'none',
            }}
      >
        {value}
      </text>
    )
  }

  const radarPlot = (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    accessibilityLayer={false}
                    data={radarData}
                    cx="50%"
                    cy="50%"
                    outerRadius={radarIsMobile ? '94%' : '86%'}
                    margin={radarIsMobile
                      ? { top: 32, bottom: 36, left: 14, right: 14 }
                      : { top: 56, bottom: 26, left: 108, right: 108 }}
                  >
                    <PolarGrid gridType="polygon" stroke="#bbae9a" strokeWidth={1.1} />
                    <PolarAngleAxis
                      dataKey="metric"
                      axisLine={false}
                      tick={radarIsMobile
                        ? renderRadarMobileTick
                        : { fill: '#2b3744', stroke: 'none', strokeWidth: 0, fontSize: 15, fontWeight: 700 }}
                      tickSize={radarIsMobile ? 10 : 15}
                      tickLine={false}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tickCount={6}
                      tick={renderRadarRadiusTick}
                      axisLine={false}
                      tickLine={false}
                    />
                    {radarPlayers.flatMap((player, slot) =>
                      player && radarSelected[slot]?.visible
                        ? radarActiveViews.map(view => (
                          <Radar
                            key={`${player.playerId}-${view}`}
                            name={radarComparison ? player.name : `${player.name} · ${MVP_RADAR_VIEWS.find(item => item.key === view)?.label}`}
                            dataKey={`p${slot}_${view}`}
                            stroke={MVP_RADAR_COLORS[slot]}
                            strokeOpacity={1}
                            strokeDasharray={view === 'allTime' ? '1 7' : view === 'recent' ? '9 6' : undefined}
                            strokeLinecap="round"
                            fill={MVP_RADAR_COLORS[slot]}
                            fillOpacity={view === 'hybrid' ? 0.065 : 0}
                            strokeWidth={view === 'hybrid' ? 3.6 : 3}
                            dot={false}
                            isAnimationActive={false}
                          />
                        ))
                        : []
                    )}
                    <Tooltip
                      formatter={(value, name) => [Number(value ?? 0).toFixed(1), name]}
                      contentStyle={{
                        background: '#fffaf1',
                        border: '1px solid #d6c9b5',
                        borderRadius: 12,
                        color: '#1c2b3a',
                        fontSize: 14,
                        boxShadow: '0 8px 30px rgba(10, 20, 40, .18)',
                      }}
                      labelStyle={{ color: '#1c2b3a', fontWeight: 800 }}
                      itemStyle={{ padding: 0 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
  )

  return (
    <main
      className="app historyPage"
      key="history-root"
    >
      <header className="historyHeader">
        <button
          className="roundBack"
          onClick={onBack}
        >
          ←
        </button>

        <div>
          <span>
            JIM RECORDS
          </span>

          <h1>
            History & Stats
          </h1>
        </div>
      </header>

      <nav className="historyTabs">
        <button
          className={
            tab === 'sessions'
              ? 'active'
              : ''
          }
          onClick={() =>
            setTab('sessions')
          }
        >
          Sessions
        </button>

        <button
          className={
            tab === 'players'
              ? 'active'
              : ''
          }
          onClick={() =>
            setTab('players')
          }
        >
          Players
        </button>

        <button
          className={
            tab === 'mvp'
              ? 'active'
              : ''
          }
          onClick={() =>
            setTab('mvp')
          }
        >
          MVP
        </button>

        <button
          className={
            tab === 'awards'
              ? 'active'
              : ''
          }
          onClick={() =>
            setTab('awards')
          }
        >
          Awards
        </button>
      </nav>

      <div
        className="historyTabPage"
        key={tab}
      >
      {tab === 'sessions' && (
        <section className="historySessionList">
          {orderedSessions.length ===
          0 ? (
            <div className="historyEmpty">
              No sessions yet.
            </div>
          ) : (
            orderedSessions.map(
              (session) => {
                const participants =
                  sessionPlayers.filter(
                    (player) =>
                      player.sessionId ===
                      session.id
                  )

                const sessionRounds =
                  rounds.filter(
                    (round) =>
                      round.sessionId ===
                      session.id
                  )

                const standardCount =
                  sessionRounds.filter(
                    (round) =>
                      round.type ===
                      'standard'
                  ).length

                const jimCount =
                  sessionRounds.filter(
                    (round) =>
                      round.type ===
                      'jim'
                  ).length

                const penaltyCount =
                  penaltyResults.filter(
                    (penalty) =>
                      penalty.sessionId ===
                      session.id
                  ).length

                const ranking =
                  [...participants].sort(
                    (a, b) =>
                      b.points -
                        a.points ||
                      a.rotationOrder -
                        b.rotationOrder
                  )

                const topScore =
                  ranking[0]?.points

                const leaders =
                  topScore ===
                  undefined
                    ? []
                    : ranking.filter(
                        (player) =>
                          player.points ===
                          topScore
                      )

                const leaderNames =
                  leaders.length === 0
                    ? '—'
                    : leaders
                        .map(
                          (player) =>
                            getSessionName(
                              session.id,
                              player.playerId
                            )
                        )
                        .join(' • ')

                const duration =
                  session.endedAt
                    ? formatDuration(
                        session.endedAt.getTime() -
                          session.startedAt.getTime()
                      )
                    : 'In progress'

                const expanded =
                  expandedSessionId ===
                  session.id

                const roundDetailsOpen =
                  roundDetailsSessionId ===
                  session.id

                const orderedSessionRounds =
                  [...sessionRounds].sort(
                    (a, b) =>
                      a.roundNumber -
                        b.roundNumber ||
                      a.createdAt.getTime() -
                        b.createdAt.getTime()
                  )

                return (
                  <article
                    className="historySession"
                    key={session.id}
                  >
                    <button
                      className="historySessionSummary"
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedSessionId(
                          expanded
                            ? null
                            : session.id
                        )
                      }
                    >
                      <div>
                        <strong>
                          {formatDate(
                            session.startedAt
                          )}
                        </strong>

                        <span>
                          {session.startedAt.toLocaleTimeString(
                            undefined,
                            {
                              hour:
                                'numeric',
                              minute:
                                '2-digit',
                            }
                          )}
                        </span>
                      </div>

                      <div className="historySessionSummaryRight">
                        <span>
                          {
                            sessionRounds.length
                          }{' '}
                          rounds
                          {' • '}
                          {duration}
                        </span>

                        <b
                          className={
                            session.status ===
                            'active'
                              ? 'active'
                              : ''
                          }
                        >
                          {session.status ===
                          'active'
                            ? 'ACTIVE'
                            : 'ENDED'}
                        </b>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          key="session-details"
                          className="jimHistoryCollapse"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                          style={{ overflow: 'hidden' }}
                        >
                      <div className="historySessionDetails">
                        <div className="historySessionMeta historySessionMetaExpanded">
                          <div>
                            <span>
                              ROUNDS
                            </span>

                            <strong>
                              {
                                sessionRounds.length
                              }
                            </strong>
                          </div>

                          <div>
                            <span>
                              DURATION
                            </span>

                            <strong>
                              {duration}
                            </strong>
                          </div>

                          <div>
                            <span>
                              STANDARD
                            </span>

                            <strong>
                              {standardCount}
                            </strong>
                          </div>

                          <div>
                            <span>
                              JIM
                            </span>

                            <strong>
                              {jimCount}
                            </strong>
                          </div>

                          <div>
                            <span>
                              PENALTIES
                            </span>

                            <strong>
                              {penaltyCount}
                            </strong>
                          </div>

                          <div>
                            <span>
                              LEADER
                            </span>

                            <strong>
                              {leaderNames}
                            </strong>
                          </div>
                        </div>

                        <div className="historyStandings">
                          {ranking.map(
                            (
                              player,
                              index
                            ) => (
                              <div
                                className="historyStanding historyStandingInteractive"
                                key={
                                  player.id
                                }
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  setSessionPlayerDetail({
                                    sessionId:
                                      session.id,
                                    playerId:
                                      player.playerId,
                                  })
                                }
                                onKeyDown={(
                                  event
                                ) => {
                                  if (
                                    event.key ===
                                      'Enter' ||
                                    event.key ===
                                      ' '
                                  ) {
                                    event.preventDefault()

                                    setSessionPlayerDetail({
                                      sessionId:
                                        session.id,
                                      playerId:
                                        player.playerId,
                                    })
                                  }
                                }}
                              >
                                <span>
                                  {index +
                                    1}
                                </span>

                                <div>
                                  <strong>
                                    {getSessionName(
                                      session.id,
                                      player.playerId
                                    )}
                                  </strong>

                                  {(() => {
                                    const playerJimWins =
                                      jimResults.filter(
                                        (result) =>
                                          result.sessionId ===
                                            session.id &&
                                          result.jimPlayerId ===
                                            player.playerId &&
                                          result.won
                                      )

                                    const playerFails =
                                      jimResults.filter(
                                        (result) =>
                                          result.sessionId === session.id &&
                                          result.jimPlayerId === player.playerId &&
                                          !result.won
                                      )

                                    const playerCatches =
                                      jimResults.filter(
                                        (result) =>
                                          result.sessionId ===
                                            session.id &&
                                          result.caughtByPlayerId ===
                                            player.playerId
                                      )

                                    const hasAchievements =
                                      player.wins > 0 ||
                                      playerJimWins.length >
                                        0 ||
                                      playerCatches.length >
                                        0 ||
                                      playerFails.length > 0

                                    return hasAchievements ? (
                                      <div className="historyStandingAchievements">
                                        {player.wins >
                                          0 && (
                                          <HistoryStandardWinTally
                                            count={
                                              player.wins
                                            }
                                          />
                                        )}

                                        {playerJimWins.length >
                                          0 && (
                                          <HistoryJimWinStars
                                            wins={
                                              playerJimWins
                                            }
                                          />
                                        )}

                                        {playerCatches.length >
                                          0 && (
                                          <HistoryJimCatchScissors
                                            catches={
                                              playerCatches
                                            }
                                          />
                                        )}

                                        <JimFailSkulls failures={playerFails} />
                                      </div>
                                    ) : null
                                  })()}
                                </div>

                                <b>
                                  {
                                    player.points
                                  }
                                </b>
                              </div>
                            )
                          )}
                        </div>

                        {sessionRounds.length >
                          0 && (
                          <div className="historySessionActions">
                            <button
                              className="historyAwardsButton"
                              onClick={() =>
                                setAwardSessionId(
                                  session.id
                                )
                              }
                            >
                              View Session Awards
                            </button>

                            <button
                              className="historyRaceButton"
                              onClick={() =>
                                setRaceSessionId(
                                  session.id
                                )
                              }
                            >
                              View Title Race
                            </button>
                          </div>
                        )}

                        <div className="historySessionBottomActions">
                          {sessionRounds.length >
                            0 && (
                            <button
                              className="historyMoreDetailsButton"
                              onClick={() => {
                                if (
                                  roundDetailsOpen
                                ) {
                                  setEditingRoundId(
                                    null
                                  )
                                }

                                setRoundDetailsSessionId(
                                  roundDetailsOpen
                                    ? null
                                    : session.id
                                )
                              }}
                            >
                              {roundDetailsOpen
                                ? 'Hide Round Details'
                                : 'View More Details'}
                            </button>
                          )}

                          {session.status ===
                          'ended' ? (
                            <button
                              className="historyDeleteButton"
                              onClick={() =>
                                requestDeleteSession(
                                  session.id
                                )
                              }
                            >
                              Delete Session
                            </button>
                          ) : (
                            <span className="historyActiveDeleteNote">
                              End this session before deleting it.
                            </span>
                          )}
                        </div>

                        <AnimatePresence initial={false}>
                          {roundDetailsOpen && (
                            <motion.div
                              key="round-details"
                              className="jimHistoryCollapse"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                              style={{ overflow: 'hidden' }}
                            >
                          <section className="historyRoundDetails">
                            <div className="historyRoundDetailsHeader">
                              <div>
                                <span>
                                  ROUND HISTORY
                                </span>

                                <strong>
                                  {
                                    orderedSessionRounds.length
                                  }{' '}
                                  rounds
                                </strong>
                              </div>

                              <small>
                                Oldest to newest
                              </small>
                            </div>

                            <div className="historyRoundList">
                              {orderedSessionRounds.map(
                                (round) => {
                                  if (
                                    round.type ===
                                    'standard'
                                  ) {
                                    const results =
                                      roundResults
                                        .filter(
                                          (result) =>
                                            result.roundId ===
                                            round.id
                                        )
                                        .sort(
                                          (a, b) =>
                                            a.position -
                                              b.position ||
                                            b.pointsAwarded -
                                              a.pointsAwarded
                                        )

                                    return (
                                      <article
                                        className="historyRoundCard standard"
                                        key={
                                          round.id
                                        }
                                      >
                                        <header>
                                          <div>
                                            <span>
                                              ROUND{' '}
                                              {
                                                round.roundNumber
                                              }
                                            </span>

                                            <div className="historyRoundTypeLine">
                                              <b>
                                                STANDARD
                                              </b>

                                              {round.editedAt && (
                                                <em className="historyRoundEditedBadge">
                                                  EDITED
                                                </em>
                                              )}
                                            </div>
                                          </div>

                                          <div className="historyRoundHeaderActions">
                                            <small>
                                              {round.createdAt.toLocaleTimeString(
                                                undefined,
                                                {
                                                  hour:
                                                    'numeric',
                                                  minute:
                                                    '2-digit',
                                                }
                                              )}
                                            </small>

                                            <button
                                              type="button"
                                              className="historyRoundEditButton"
                                              onClick={() =>
                                                setEditingRoundId(
                                                  editingRoundId ===
                                                    round.id
                                                    ? null
                                                    : round.id
                                                )
                                              }
                                            >
                                              {editingRoundId ===
                                              round.id
                                                ? 'Close'
                                                : 'Edit'}
                                            </button>
                                          </div>
                                        </header>

                                        <div className="historyRoundResults">
                                          {results.map(
                                            (
                                              result
                                            ) => (
                                              <div
                                                className="historyRoundResult"
                                                key={
                                                  result.id
                                                }
                                              >
                                                <span>
                                                  {
                                                    result.position
                                                  }
                                                </span>

                                                <strong>
                                                  {getSessionName(
                                                    session.id,
                                                    result.playerId
                                                  )}
                                                </strong>

                                                {typeof result.cardScore ===
                                                  'number' && (
                                                  <small>
                                                    {
                                                      result.cardScore
                                                    }{' '}
                                                    cards
                                                  </small>
                                                )}

                                                <b>
                                                  {result.pointsAwarded >
                                                  0
                                                    ? '+'
                                                    : ''}
                                                  {
                                                    result.pointsAwarded
                                                  }
                                                </b>
                                              </div>
                                            )
                                          )}
                                        </div>

                                        {editingRoundId ===
                                          round.id && (
                                          <RoundEditor
                                            round={
                                              round
                                            }
                                            sessionPlayers={
                                              participants
                                            }
                                            roundResults={
                                              results
                                            }
                                            getName={(
                                              playerId
                                            ) =>
                                              getSessionName(
                                                session.id,
                                                playerId
                                              )
                                            }
                                            onClose={() =>
                                              setEditingRoundId(
                                                null
                                              )
                                            }
                                          />
                                        )}
                                      </article>
                                    )
                                  }

                                  const jimResult =
                                    jimResults.find(
                                      (result) =>
                                        result.roundId ===
                                        round.id
                                    )

                                  if (!jimResult) {
                                    return (
                                      <article
                                        className="historyRoundCard jim"
                                        key={
                                          round.id
                                        }
                                      >
                                        <header>
                                          <div>
                                            <span>
                                              ROUND{' '}
                                              {
                                                round.roundNumber
                                              }
                                            </span>

                                            <b>
                                              JIM
                                            </b>
                                          </div>
                                        </header>

                                        <p className="historyRoundMissing">
                                          No Jim result recorded.
                                        </p>
                                      </article>
                                    )
                                  }

                                  const jimName =
                                    getSessionName(
                                      session.id,
                                      jimResult.jimPlayerId
                                    )

                                  const catcherName =
                                    jimResult.caughtByPlayerId ===
                                    undefined
                                      ? null
                                      : getSessionName(
                                          session.id,
                                          jimResult.caughtByPlayerId
                                        )

                                  return (
                                    <article
                                      className={`historyRoundCard jim ${
                                        jimResult.won
                                          ? 'won'
                                          : 'caught'
                                      }`}
                                      key={
                                        round.id
                                      }
                                    >
                                      <header>
                                        <div>
                                          <span>
                                            ROUND{' '}
                                            {
                                              round.roundNumber
                                            }
                                          </span>

                                          <div className="historyRoundTypeLine">
                                            <b>
                                              JIM
                                            </b>

                                            {round.editedAt && (
                                              <em className="historyRoundEditedBadge">
                                                EDITED
                                              </em>
                                            )}
                                          </div>
                                        </div>

                                        <div className="historyRoundHeaderActions">
                                          <small>
                                            {round.createdAt.toLocaleTimeString(
                                              undefined,
                                              {
                                                hour:
                                                  'numeric',
                                                minute:
                                                  '2-digit',
                                              }
                                            )}
                                          </small>

                                          <button
                                            type="button"
                                            className="historyRoundEditButton"
                                            onClick={() =>
                                              setEditingRoundId(
                                                editingRoundId ===
                                                  round.id
                                                  ? null
                                                  : round.id
                                              )
                                            }
                                          >
                                            {editingRoundId ===
                                            round.id
                                              ? 'Close'
                                              : 'Edit'}
                                          </button>
                                        </div>
                                      </header>

                                      <div className="historyJimSummary">
                                        <strong>
                                          {jimName}
                                        </strong>

                                        <span>
                                          {jimResult.won
                                            ? 'SURVIVED ALL 6 STAGES'
                                            : `CAUGHT${
                                                catcherName
                                                  ? ` BY ${catcherName}`
                                                  : ''
                                              }`}
                                        </span>

                                        <div>
                                          <small>
                                            {jimResult.won
                                              ? '6 stages survived'
                                              : `${jimResult.stepsSurvived} stages survived`}
                                          </small>

                                          {typeof jimResult.hideStage ===
                                            'number' && (
                                            <small>
                                              Hide:{' '}
                                              {
                                                jimResult.hideStage
                                              }
                                            </small>
                                          )}

                                          <b
                                            className={
                                              jimResult.won
                                                ? 'positive'
                                                : 'negative'
                                            }
                                          >
                                            {jimResult.jimPointsAwarded >
                                            0
                                              ? '+'
                                              : ''}
                                            {
                                              jimResult.jimPointsAwarded
                                            }
                                          </b>

                                          {!jimResult.won &&
                                            catcherName && (
                                            <b className="catcherPoint">
                                              Catcher{' '}
                                              {jimResult.catcherPointsAwarded >
                                              0
                                                ? '+'
                                                : ''}
                                              {
                                                jimResult.catcherPointsAwarded
                                              }
                                            </b>
                                          )}
                                        </div>
                                      </div>

                                      {editingRoundId ===
                                        round.id && (
                                        <RoundEditor
                                          round={
                                            round
                                          }
                                          sessionPlayers={
                                            participants
                                          }
                                          roundResults={
                                            []
                                          }
                                          jimResult={
                                            jimResult
                                          }
                                          getName={(
                                            playerId
                                          ) =>
                                            getSessionName(
                                              session.id,
                                              playerId
                                            )
                                          }
                                          onClose={() =>
                                            setEditingRoundId(
                                              null
                                            )
                                          }
                                        />
                                      )}
                                    </article>
                                  )
                                }
                              )}
                            </div>
                          </section>
                            </motion.div>
                          )}
                        </AnimatePresence>

                      </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </article>
                )
              }
            )
          )}
        </section>
      )}

      {tab === 'players' && (
        <>
          <section className="playerSortPanel">
            <div>
              <span>
                RANK PLAYERS BY
              </span>

              <strong>
                Choose a stat
              </strong>
            </div>

            <PlayerSortPicker
              value={playerSort}
              onChange={(next) => {
                setPlayerSort(next)
                setCollapsedPlayerIds(new Set())
              }}
            />
          </section>

          <section className="playerStatsList">
            {sortedPlayerStats.map(
              (
                player,
                index
              ) => (
                <article
                  className="playerStatsCard"
                  key={player.id}
                >
                  <header>
                    <div className="playerStatsIdentity">
                      <span className="playerStatsRank">
                        #{index + 1}
                      </span>

                      <div>
                        <h2>
                          {player.name}
                        </h2>

                        <span>
                          {
                            player.sessions
                          }{' '}
                          sessions
                        </span>
                      </div>
                    </div>

                    <div
                      className={`playerStatsHeadline ${
                        playerSort === 'total'
                          ? 'sortStatHighlight'
                          : ''
                      }`}
                    >
                      <strong>
                        {
                          player.totalPoints
                        }
                      </strong>

                      <span>
                        TOTAL PTS
                      </span>
                    </div>

                    <button
                      type="button"
                      className="playerStatsCollapseButton"
                      aria-expanded={!collapsedPlayerIds.has(player.id)}
                      aria-label={`${collapsedPlayerIds.has(player.id) ? 'Expand' : 'Collapse'} ${player.name} statistics`}
                      onClick={() => togglePlayerStats(player.id)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="21"
                        height="21"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  </header>

                  <AnimatePresence initial={false}>
                    {!collapsedPlayerIds.has(player.id) && (
                      <motion.div
                        className="playerStatsBody"
                        key="statistics"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: 'hidden' }}
                      >

                  <div className="playerStatSectionLabel">
                    SESSION
                  </div>

                  <div className="playerStatGrid">
                    <div
                      className={
                        playerSort ===
                        'sessionsPlayed'
                          ? 'sortStatHighlight'
                          : ''
                      }
                    >
                      <span>
                        PLAYED
                      </span>

                      <strong>
                        {
                          player.completedSessions
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        playerSort ===
                        'sessionWins'
                          ? 'sortStatHighlight'
                          : ''
                      }
                    >
                      <span>
                        WINS
                      </span>

                      <strong>
                        {
                          player.sessionWins
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        playerSort === 'sessionRate'
                          ? 'sortStatHighlight'
                          : ''
                      }
                    >
                      <span>
                        WIN RATE
                      </span>

                      <strong>
                        {displayPercent(
                          player.sessionWinRate
                        )}
                      </strong>
                    </div>

                    <div
                      className={
                        playerSort === 'average'
                          ? 'sortStatHighlight'
                          : ''
                      }
                    >
                      <span>
                        AVG PTS / SESSION
                      </span>

                      <strong>
                        {displayNumber(
                          player.averagePointsPerSession
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="playerStatSectionLabel">
                    STANDARD
                  </div>

                  <div className="playerStatGrid">
                    <div>
                      <span>
                        ROUNDS
                      </span>

                      <strong>
                        {
                          player.standardRounds
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        playerSort ===
                        'standardWins'
                          ? 'sortStatHighlight'
                          : ''
                      }
                    >
                      <span>
                        WINS
                      </span>

                      <strong>
                        {
                          player.standardWins
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        playerSort === 'standardRate'
                          ? 'sortStatHighlight'
                          : ''
                      }
                    >
                      <span>
                        WIN RATE
                      </span>

                      <strong>
                        {displayPercent(
                          player.standardWinRate
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        0-PT ROUNDS
                      </span>

                      <strong>
                        {
                          player.standardLosses
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        0-PT RATE
                      </span>

                      <strong>
                        {displayPercent(
                          player.zeroPointRate
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="playerStatSectionLabel">
                    JIM
                  </div>

                  <div className="playerStatGrid">
                    <div
                      className={
                        playerSort ===
                        'jimAttempts'
                          ? 'sortStatHighlight'
                          : ''
                      }
                    >
                      <span>
                        ATTEMPTS
                      </span>

                      <strong>
                        {
                          player.jimAttempts
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        playerSort ===
                        'jimWins'
                          ? 'sortStatHighlight'
                          : ''
                      }
                    >
                      <span>
                        WINS
                      </span>

                      <strong>
                        {
                          player.jimWins
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        playerSort === 'jimRate'
                          ? 'sortStatHighlight'
                          : ''
                      }
                    >
                      <span>
                        SUCCESS
                      </span>

                      <strong>
                        {displayPercent(
                          player.jimSuccessRate
                        )}
                      </strong>
                    </div>

                    <div
                      className={
                        playerSort ===
                        'jimCatches'
                          ? 'sortStatHighlight'
                          : ''
                      }
                    >
                      <span>
                        CATCHES
                      </span>

                      <strong>
                        {
                          player.jimCatches
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        playerSort ===
                        'penakutSessions'
                          ? 'sortStatHighlight'
                          : ''
                      }
                    >
                      <span>
                        PENAKUT SESSIONS
                      </span>

                      <strong>
                        {player.penakutSessions}
                      </strong>
                    </div>

                    <div>
                      <span>
                        AVG SURVIVED
                      </span>

                      <strong>
                        {displayNumber(
                          player.averageJimSurvived
                        )}
                      </strong>
                    </div>

                    <div
                      className={
                        playerSort ===
                        'jimCaught'
                          ? 'sortStatHighlight'
                          : ''
                      }
                    >
                      <span>
                        CAUGHT
                      </span>

                      <strong>
                        {
                          player.jimLosses
                        }
                      </strong>
                    </div>
                  </div>

                  <div className="playerStatSectionLabel">
                    HIDE & PENALTY
                  </div>

                  <div className="playerStatGrid">
                    <div>
                      <span>
                        HIDE USES
                      </span>

                      <strong>
                        {
                          player.hideUses
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        HIDE WINS
                      </span>

                      <strong>
                        {
                          player.hideWins
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        HIDE SUCCESS
                      </span>

                      <strong>
                        {displayPercent(
                          player.hideSuccessRate
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        PENALTIES
                      </span>

                      <strong>
                        {
                          player.penalties
                        }
                      </strong>
                    </div>
                  </div>

                  {player.hideUses >
                    0 && (
                    <div className="hideStageBreakdown">
                      <span>
                        HIDE STAGES
                      </span>

                      {[2, 3, 4, 5].map(
                        (stage) => (
                          <div
                            key={stage}
                          >
                            <small>
                              S{stage}
                            </small>

                            <strong>
                              {
                                player
                                  .hideStageCounts[
                                  stage
                                ]
                              }
                            </strong>
                          </div>
                        )
                      )}
                    </div>
                  )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </article>
              )
            )}
          </section>
        </>
      )}

      {tab === 'mvp' && (
        <section className="mvpPage">
          <div className="mvpIntro">
            <div>
              <span>
                JIMRAMI MVP
              </span>

              <h2>
                Overall player rating
              </h2>

              <p>
                40% All-time + 60% Recent (last 10 completed sessions). Each attribute is scored from 0 to 100.
              </p>
              <button type="button" className="mvpScoringOpenButton" onClick={() => setMvpScoringOpen(true)}>
                <span aria-hidden="true">ⓘ</span> How MVP scoring works
              </button>
            </div>

            <div className="mvpFormula">
              <span>WEIGHTING</span>
              <strong>25% Standard</strong>
              <strong>30% Jim</strong>
              <strong>15% Session</strong>
              <strong>20% Slayer</strong>
              <strong>10% Consistency</strong>
            </div>
          </div>

          {qualifiedMvpPlayers.length > 0 && (
            <section className="mvpPodiumSection">
              <div className="mvpPodiumHeader">
                <span>
                  MVP PODIUM
                </span>

                <h3>
                  Top 3 overall
                </h3>
              </div>

              <div className="mvpPodium">
                {podiumPlayers.map(
                  (player) => {
                    const rank =
                      qualifiedMvpPlayers.findIndex(
                        (entry) =>
                          entry.playerId ===
                          player.playerId
                      ) + 1

                    return (
                      <article
                        className={`mvpPodiumSlot rank${rank}`}
                        key={
                          player.playerId
                        }
                      >
                        <div className="mvpPodiumPlayer">
                          <span
                            className="mvpMedal"
                            role="img"
                            aria-label={rank === 1 ? 'Gold crown' : rank === 2 ? 'Silver medal' : 'Bronze medal'}
                          >
                            {rank === 1 ? (
                              <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                                focusable="false"
                              >
                                <path d="M2.5 8.2 7.1 11l4.9-7 4.9 7 4.6-2.8-1.7 10.2H4.2L2.5 8.2Z" />
                                <path d="M4.3 20h15.4v1.5H4.3z" />
                              </svg>
                            ) : rank === 2 ? 'Ⅱ' : 'Ⅲ'}
                          </span>

                          <strong>{player.name}</strong>
                        </div>

                        <div className="mvpPodiumScore">
                          <strong>
                            {player.score.toFixed(
                              1
                            )}
                          </strong>
                        </div>

                        <div className="mvpPodiumBlock">
                          <span>
                            #{rank}
                          </span>
                        </div>
                      </article>
                    )
                  }
                )}
              </div>
            </section>
          )}

          {mvpStats.length > 0 && qualifiedMvpPlayers.length === 0 && (
            <div className="mvpMethodNote">
              <strong>NO QUALIFIED MVP YET</strong>
              <p>Players are still scored provisionally. The official podium opens once someone meets all three requirements.</p>
            </div>
          )}

          <div className="mvpEligibility">
            <span>
              FULL MVP STATUS
            </span>

            <p>
              Requires at least
              5 completed sessions,
              20 Standard rounds and
              5 Jim attempts.
              Players below that are
              marked provisional and
              stay off the official podium.
            </p>
          </div>

          {mvpStats.length > 0 && (
            <section className="mvpRadarSection" aria-labelledby="mvp-radar-title">
              <div className="mvpRadarHeader">
                <h3 id="mvp-radar-title">Performance radar</h3>
                <p className="mvpRadarHint">{radarComparison
                  ? 'Compare players using the same scoring view.'
                  : 'Select multiple views to see how this player has changed.'}</p>
              </div>

              <div className="mvpRadarViewControls" role="group" aria-label={radarComparison ? 'Shared radar scoring view' : 'Radar scoring views'}>
                {MVP_RADAR_VIEWS.map(view => {
                  const active = radarComparison
                    ? radarComparisonView === view.key
                    : radarSingleViews.includes(view.key)
                  return (
                    <button
                      key={view.key}
                      type="button"
                      className={`mvpRadarViewButton${active ? ' is-active' : ''}`}
                      aria-pressed={active}
                      data-tooltip={view.description}
                      onClick={() => radarComparison
                        ? setRadarComparisonView(view.key)
                        : toggleRadarSingleView(view.key)}
                    >
                      <span className={`mvpRadarLineSample mvpRadarLineSample--${view.key}`} aria-hidden="true" />
                      {view.label}
                    </button>
                  )
                })}
              </div>

              <div className="mvpRadarControls" aria-label="Players in radar comparison">
                <div className="mvpRadarChips">
                  {radarSelected.map((selection, index) => {
                    const player = radarPlayers[index]
                    if (!player) return null
                    const color = MVP_RADAR_COLORS[index]
                    return (
                      <div
                        className={`mvpRadarChip${selection.visible ? '' : ' is-hidden'}`}
                        key={selection.playerId}
                        style={{ borderColor: `${color}8a` }}
                      >
                        <button
                          type="button"
                          className="mvpRadarVisibility"
                          onClick={() => toggleRadarPlayer(selection.playerId)}
                          aria-label={`${selection.visible ? 'Hide' : 'Show'} ${player.name} on radar`}
                          aria-pressed={selection.visible}
                          data-tooltip={selection.visible ? 'Hide from radar' : 'Show on radar'}
                          style={{ color }}
                        >
                          <span className="mvpRadarChipDot" aria-hidden="true" style={{ backgroundColor: color }} />
                          <span className="mvpRadarChipName">{player.name}</span>
                          <svg className="mvpRadarEye" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {selection.visible ? (
                              <>
                                <path d="M2.5 12s3.7-6 9.5-6 9.5 6 9.5 6-3.7 6-9.5 6-9.5-6-9.5-6Z" />
                                <circle cx="12" cy="12" r="2.7" />
                              </>
                            ) : (
                              <>
                                <path d="M3 3 21 21" />
                                <path d="M10.7 6.1A11 11 0 0 1 12 6c5.8 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.7M6.3 7.4A17 17 0 0 0 2.5 12s3.7 6 9.5 6c1.4 0 2.8-.4 4-1" />
                              </>
                            )}
                          </svg>
                        </button>
                        {radarSelected.length > 1 && (
                          <button
                            type="button"
                            className="mvpRadarRemove"
                            onClick={() => removeRadarPlayer(selection.playerId)}
                            aria-label={`Remove ${player.name} from comparison`}
                            data-tooltip="Remove player"
                          >×</button>
                        )}
                      </div>
                    )
                  })}
                </div>
                {radarSelected.length < 4 && remainingRadarPlayers.length > 0 && (
                  <div className="mvpRadarPicker" ref={radarPickerRef}>
                    <button
                      type="button"
                      className={`mvpRadarAddButton${radarPickerOpen ? ' is-open' : ''}`}
                      onClick={() => setRadarPickerOpen(open => !open)}
                      aria-expanded={radarPickerOpen}
                      aria-haspopup="true"
                    >
                      <span aria-hidden="true">+</span> Add player
                    </button>
                    {radarPickerOpen && (
                      <div className="mvpRadarPickerMenu" role="group" aria-label="Choose player to compare">
                        <div className="mvpRadarPickerList">
                          {remainingRadarPlayers.map(player => (
                            <button
                              type="button"
                              key={player.playerId}
                              onClick={() => addRadarPlayer(player.playerId)}
                            >
                              <span>{player.name}</span>
                              <span className="mvpRadarPickerPlus" aria-hidden="true">+</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div
                className="mvpRadarChart"
                onMouseDownCapture={event => {
                  // Prevent the browser focusing a Recharts SVG shape on mouse click.
                  // Keep mousemove/touch tooltip interactions intact.
                  if (event.target instanceof SVGElement) event.preventDefault()
                }}
                onFocusCapture={event => {
                  // Some Android WebViews focus SVG shapes on tap despite the
                  // CSS reset. Blur the shape, not the player-selection buttons.
                  if (event.target instanceof SVGElement) {
                    (event.target as SVGElement & { blur?: () => void }).blur?.()
                  }
                }}
                onClickCapture={event => {
                  if (event.target instanceof SVGElement) {
                    (event.target as SVGElement & { blur?: () => void }).blur?.()
                  }
                }}
                style={{
                  width: '100%',
                  height: radarIsMobile ? 'clamp(270px, 83vw, 350px)' : 'clamp(410px, 68vw, 660px)',
                  minWidth: 0,
                  background: 'linear-gradient(160deg, #f7f1e4, #ece3d1)',
                  border: '1px solid #d6c9b5',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, .6)',
                }}
                role="img"
                aria-label={`Radar of ${visibleRadarPlayers.map(player => player!.name).join(', ') || 'no visible players'}. ${radarComparison ? `Shared ${radarComparisonView} view` : `Views: ${radarActiveViews.join(', ')}`}. Axes are Standard, Jim, Session, Slayer and Consistency. Values range from 0 to 100.`}
              >
                {radarPlot}
                {visibleRadarPlayers.length === 0 && (
                  <div className="mvpRadarEmpty">Select a player to display.</div>
                )}
              </div>
            </section>
          )}

          <section className="mvpLeaderboardSection">
            <div className="mvpLeaderboardHeader">
              <span>
                FULL LEADERBOARD
              </span>

              <h3>
                Rating breakdown
              </h3>
            </div>

            <div className="mvpLeaderboard">
              {mvpStats.map(
                (
                  player,
                  index
                ) => (
                  <article
                    className={`mvpCard mvpCardCompact ${index === 0 ? 'mvpLeader' : ''}`}
                    key={player.playerId}
                  >
                    <details className="mvpCardDisclosure">
                      <summary className="mvpCardSummary">
                        <div className="mvpCompactHeader">
                          <div className="mvpIdentity">
                            <span>#{index + 1}</span>
                            <div>
                              <h3>{player.name}</h3>
                              <small className={player.provisional ? 'mvpProvisional' : 'mvpQualified'}>
                                {player.provisional ? 'PROVISIONAL' : 'QUALIFIED'}
                              </small>
                            </div>
                          </div>
                          <div className="mvpCompactScoreSide">
                            <div className="mvpScore">
                              <strong>{player.score.toFixed(1)}</strong>
                              <span>MVP</span>
                            </div>
                            <span className="mvpCompactChevron" aria-hidden="true">⌄</span>
                          </div>
                        </div>
                        <div className="mvpCompactQuickStats">
                          <span>All-time <b>{player.careerScore.toFixed(1)}</b></span>
                          <span>Recent 10 <b>{player.recentScore.toFixed(1)}</b></span>
                          <span className="mvpCompactSessionCount">{player.recentSessions}/10 sessions</span>
                          <span className="mvpCompactExpandHint">Details</span>
                        </div>
                      </summary>

                      <div className="mvpCompactDetails">
                        <div className="mvpCompactDetailsHeading">Attribute breakdown <span>Tap an attribute for details</span></div>
                        <div className="mvpCompactAttributes">
                          <details className="mvpCompactAttribute">
                            <summary>
                              <span className="mvpCompactAttributeName">Standard</span>
                              <strong>{player.standardScore.toFixed(1)}</strong>
                              <span className="mvpCompactAttributeChevron" aria-hidden="true">⌄</span>
                            </summary>
                            <div className="mvpCompactAttributeDetail"><small>All-time {player.careerStandardScore.toFixed(1)} · Recent {player.recentStandardScore.toFixed(1)}
                          {' • '}
                          Lifetime: {player.totalStandardWins} Standard wins ({player.normalizedStandardWins.toFixed(1)}% of leader)
                          {' • '}{player.standardWinRate.toFixed(1)}% win rate
                          {' • '}{player.averageStandardPoints.toFixed(2)} avg pts</small></div>
                          </details>
                          <details className="mvpCompactAttribute">
                            <summary>
                              <span className="mvpCompactAttributeName">Jim</span>
                              <strong>{player.jimScore.toFixed(1)}</strong>
                              <span className="mvpCompactAttributeChevron" aria-hidden="true">⌄</span>
                            </summary>
                            <div className="mvpCompactAttributeDetail"><small>All-time {player.careerJimScore.toFixed(1)} · Recent {player.recentJimScore.toFixed(1)}
                          {' • '}
                          Lifetime: {player.totalJimWins} Jim wins ({player.normalizedJimWins.toFixed(1)}% of leader)
                          {' • '}{player.jimWinRate.toFixed(1)}% success
                          {' • '}{player.braveryRate.toFixed(1)}% bravery
                          {' • '}{player.penakutSessions} Penakut (−{player.penakutPenalty.toFixed(1)})</small></div>
                          </details>
                          <details className="mvpCompactAttribute">
                            <summary>
                              <span className="mvpCompactAttributeName">Session</span>
                              <strong>{player.sessionScore.toFixed(1)}</strong>
                              <span className="mvpCompactAttributeChevron" aria-hidden="true">⌄</span>
                            </summary>
                            <div className="mvpCompactAttributeDetail"><small>All-time {player.careerSessionScore.toFixed(1)} · Recent {player.recentSessionScore.toFixed(1)}
                          {' • '}
                          Lifetime: {player.totalSessionWins} session wins ({player.normalizedSessionWins.toFixed(1)}% of leader)
                          {' • '}{player.sessionWinRate.toFixed(1)}% win rate</small></div>
                          </details>
                          <details className="mvpCompactAttribute">
                            <summary>
                              <span className="mvpCompactAttributeName">Slayer</span>
                              <strong>{player.slayerScore.toFixed(1)}</strong>
                              <span className="mvpCompactAttributeChevron" aria-hidden="true">⌄</span>
                            </summary>
                            <div className="mvpCompactAttributeDetail"><small>All-time {player.careerSlayerScore.toFixed(1)} · Recent {player.recentSlayerScore.toFixed(1)}
                          {' • '}Lifetime: {player.totalCatches} catches • {player.slayerFrequency.toFixed(1)}% catch sessions</small></div>
                          </details>
                          <details className="mvpCompactAttribute">
                            <summary>
                              <span className="mvpCompactAttributeName">Consistency</span>
                              <strong>{player.consistencyScore.toFixed(1)}</strong>
                              <span className="mvpCompactAttributeChevron" aria-hidden="true">⌄</span>
                            </summary>
                            <div className="mvpCompactAttributeDetail"><small>All-time {player.careerConsistencyScore.toFixed(1)} · Recent {player.recentConsistencyScore.toFixed(1)}
                          {' • '}
                          All-time: {player.nonZeroRate.toFixed(1)}% non-zero
                          {' • '}{player.strongRoundRate.toFixed(1)}% +2/+3 rounds
                          {' • '}{player.averageSessionStreak.toFixed(2)} avg streak (cap 5)</small></div>
                          </details>
                        </div>
                        <div className="mvpCompactQualification">
                    <div className="mvpSample">
                      <span
                        className={
                          player.sessions >= 5
                            ? 'complete'
                            : ''
                        }
                      >
                        {player.sessions >= 5
                          ? `✓ ${player.sessions} Sessions`
                          : `${player.sessions}/5 Sessions`}
                      </span>

                      <span
                        className={
                          player.standardRounds >= 20
                            ? 'complete'
                            : ''
                        }
                      >
                        {player.standardRounds >= 20
                          ? `✓ ${player.standardRounds} Standard`
                          : `${player.standardRounds}/20 Standard`}
                      </span>

                      <span
                        className={
                          player.jimAttempts >= 5
                            ? 'complete'
                            : ''
                        }
                      >
                        {player.jimAttempts >= 5
                          ? `✓ ${player.jimAttempts} Jim`
                          : `${player.jimAttempts}/5 Jim`}
                      </span>
                    </div>
                        </div>
                      </div>
                    </details>
                  </article>
                )
              )}
            </div>
          </section>


        </section>
      )}

      {tab === 'awards' && (
        <section className="historyAwards">
          <div className="awardsIntro">
            <span>
              FAMILY RECORDS
            </span>

            <h2>
              The Hall of Fame
            </h2>

            <p>
              All-time records track
              lifetime totals and rates. Single-session records capture
              standout performances in
              one game.
            </p>
          </div>

          <section className="awardSection">
            <header className="awardSectionHeader">
              <div>
                <span>
                  ALL-TIME RECORDS
                </span>

                <h3>
                  Lifetime records
                </h3>
              </div>

              <p>
                Most titles show both
                the raw record and its
                lifetime rate. Penakut
                shows the number of
                completed sessions with
                zero Jim attempts.
              </p>
            </header>

            <div className="awardGrid">
              {allTimeCombinedAwards.map(
                (award) => (
                  <article
                    className={`awardCard combinedAwardCard awardTone-${getAwardTone(
                      award.title
                    )}`}
                    key={
                      award.title
                    }
                  >
                    <AwardTitleInfo
                      title={
                        award.title
                      }
                      description={
                        award.description
                      }
                    />

                    <div className="combinedAwardMetrics">
                      <div className="combinedAwardMetric">
                        <small>
                          MOST TOTAL
                        </small>

                        <div className="combinedWinnerList">
                          {award.total.winnerLines
                            ? award.total.winnerLines.map(
                                (
                                  winner,
                                  index
                                ) => (
                                  <div
                                    className="combinedWinnerRow"
                                    key={`${winner.name}-${index}`}
                                  >
                                    <h3>
                                      {
                                        winner.name
                                      }
                                    </h3>
                                  </div>
                                )
                              )
                            : (
                              <div className="combinedWinnerRow">
                                <h3>
                                  {
                                    award.total
                                      .winners
                                  }
                                </h3>
                              </div>
                            )}
                        </div>

                        <strong>
                          {
                            award.total
                              .value
                          }
                        </strong>
                      </div>

                      <div className="combinedAwardMetric">
                        <small>
                          {
                            award.rateLabel
                          }
                        </small>

                        <div className="combinedWinnerList">
                          {award.rate.winnerLines
                            ? award.rate.winnerLines.map(
                                (
                                  winner,
                                  index
                                ) => (
                                  <div
                                    className="combinedWinnerRow"
                                    key={`${winner.name}-${winner.meta}-${index}`}
                                  >
                                    <h3>
                                      {
                                        winner.name
                                      }
                                    </h3>

                                    {winner.meta && (
                                      <span>
                                        {
                                          winner.meta
                                        }
                                      </span>
                                    )}
                                  </div>
                                )
                              )
                            : (
                              <div className="combinedWinnerRow">
                                <h3>
                                  {
                                    award.rate
                                      .winners
                                  }
                                </h3>
                              </div>
                            )}
                        </div>

                        <strong>
                          {
                            award.rate
                              .value
                          }
                        </strong>

                        {award.rate
                          .note && (
                          <em>
                            {
                              award.rate
                                .note
                            }
                          </em>
                        )}
                      </div>
                    </div>
                  </article>
                )
              )}

              <article
                className={`awardCard rateAwardCard awardTone-${getAwardTone(
                  classicArtetaAllTimeAward.title
                )}`}
              >
                <AwardTitleInfo
                  title={
                    classicArtetaAllTimeAward.title
                  }
                  description={
                    classicArtetaAllTimeAward.description
                  }
                />

                {classicArtetaAllTimeAward.winnerLines ? (
                  <div className="sessionRecordWinners">
                    {classicArtetaAllTimeAward.winnerLines.map(
                      (
                        winner,
                        index
                      ) => (
                        <div
                          className="sessionRecordWinner"
                          key={`${winner.name}-${index}`}
                        >
                          <h3>
                            {winner.name}
                          </h3>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <h3>
                    {
                      classicArtetaAllTimeAward.winners
                    }
                  </h3>
                )}

                <strong>
                  {
                    classicArtetaAllTimeAward.value
                  }
                </strong>
              </article>

              <article
                className={`awardCard rateAwardCard awardTone-${getAwardTone(
                  penakutAllTimeAward.title
                )}`}
              >
                <AwardTitleInfo
                  title={
                    penakutAllTimeAward.title
                  }
                  description={
                    penakutAllTimeAward.description
                  }
                />

                {penakutAllTimeAward.winnerLines ? (
                  <div className="sessionRecordWinners">
                    {penakutAllTimeAward.winnerLines.map(
                      (
                        winner,
                        index
                      ) => (
                        <div
                          className="sessionRecordWinner"
                          key={`${winner.name}-${index}`}
                        >
                          <h3>
                            {winner.name}
                          </h3>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <h3>
                    {
                      penakutAllTimeAward.winners
                    }
                  </h3>
                )}

                <strong>
                  {
                    penakutAllTimeAward.value
                  }
                </strong>
              </article>
            </div>
          </section>

          <section className="awardSection">
            <header className="awardSectionHeader">
              <div>
                <span>
                  SINGLE-SESSION RECORDS
                </span>

                <h3>
                  One-game records
                </h3>
              </div>

              <p>
                Includes both raw
                single-session records
                and percentage records.
                Rate records use minimum
                sample sizes.
              </p>
            </header>

            <div className="awardGrid">
              {[
                ...sessionRecordAwards,
                ...singleSessionRateAwards,
              ].map(
                (award) => (
                  <article
                    className={`awardCard rateAwardCard awardTone-${getAwardTone(
                      award.title
                    )}`}
                    key={
                      award.title
                    }
                  >
                    <AwardTitleInfo
                      title={
                        award.title
                      }
                      description={
                        award.description
                      }
                    />

                    {award.winnerLines ? (
                      <div className="sessionRecordWinners">
                        {award.winnerLines.map(
                          (
                            winner,
                            index
                          ) => (
                            <div
                              className="sessionRecordWinner"
                              key={`${winner.name}-${winner.meta}-${index}`}
                            >
                              <h3>
                                {
                                  winner.name
                                }
                              </h3>

                              <span>
                                {
                                  winner.meta
                                }
                              </span>

                              {winner.streakPath && (
                                <WinStreakPath
                                  events={
                                    winner.streakPath
                                  }
                                />
                              )}
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <h3>
                        {award.winners}
                      </h3>
                    )}

                    <strong>
                      {award.value}
                    </strong>

                    {award.note && (
                      <small className="awardRecordNote">
                        {award.note}
                      </small>
                    )}

                  </article>
                )
              )}
            </div>
          </section>


          <section className="awardSection cardTriviaSection">
            <header className="awardSectionHeader">
              <div>
                <span>
                  CARD SCORE TRIVIA
                </span>

                <h3>
                  Counted-card records
                </h3>
              </div>

              <p>
                {
                  cardScoreTrivia.countedRounds
                }{' '}
                fully counted Standard{' '}
                {
                  cardScoreTrivia.countedRounds ===
                  1
                    ? 'round'
                    : 'rounds'
                }{' '}
                on record. Quick Rank
                rounds are not included.
              </p>
            </header>

            {cardScoreTrivia.countedRounds ===
            0 ? (
              <div className="cardTriviaEmpty">
                No exact card-score
                rounds yet. Use Count
                Cards in a Standard
                round and these records
                will appear
                automatically.
              </div>
            ) : (
              <div className="cardTriviaGrid">
                {cardScoreTrivia.records.map(
                  (record) => (
                    <article
                      className="cardTriviaCard"
                      key={
                        record.title
                      }
                    >
                      <span>
                        {record.title}
                      </span>

                      <div className="cardTriviaWinners">
                        {record.winnerLines.map(
                          (
                            winner,
                            index
                          ) => (
                            <div
                              className="cardTriviaWinner"
                              key={`${record.title}-${winner.name}-${winner.meta}-${index}`}
                            >
                              <h3>
                                {
                                  winner.name
                                }
                              </h3>

                              <small>
                                {
                                  winner.meta
                                }
                              </small>
                            </div>
                          )
                        )}
                      </div>

                      <strong>
                        {
                          record.value
                        }
                      </strong>

                      <p>
                        {
                          record.description
                        }
                      </p>
                    </article>
                  )
                )}
              </div>
            )}

            <div className="cardTriviaNote">
              These are trivia records
              only. Because exact card
              scores are usually counted
              for close or unclear
              rounds, they are not used
              for MVP or lifetime win
              rates.
            </div>
          </section>
        </section>
      )}
      </div>

      {sessionPlayerDetailData && (
        <div
          className="sessionPlayerDetailOverlay"
          onClick={() =>
            setSessionPlayerDetail(
              null
            )
          }
        >
          <div
            className="sessionPlayerDetailDialog"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <span className="sessionPlayerDetailLabel">
              SESSION PLAYER
            </span>

            <div className="sessionPlayerDetailHeading">
              <div>
                <h2>
                  {
                    sessionPlayerDetailData.playerName
                  }
                </h2>

                <span>
                  {formatDate(
                    sessionPlayerDetailData.session.startedAt
                  )}
                </span>
              </div>

              <strong>
                #
                {
                  sessionPlayerDetailData.rank
                }
              </strong>
            </div>

            <div className="sessionPlayerDetailAchievements">
              <div>
                <span>
                  STANDARD
                </span>

                {sessionPlayerDetailData.standardWins >
                0 ? (
                  <HistoryStandardWinTally
                    count={
                      sessionPlayerDetailData.standardWins
                    }
                  />
                ) : (
                  <b>0</b>
                )}
              </div>

              <div>
                <span>
                  JIM
                </span>

                {sessionPlayerDetailData.jimWins.length >
                0 ? (
                  <HistoryJimWinStars
                    wins={
                      sessionPlayerDetailData.jimWins
                    }
                  />
                ) : (
                  <b>0</b>
                )}
              </div>

              <div>
                <span>
                  CATCHES
                </span>

                {sessionPlayerDetailData.catches.length >
                0 ? (
                  <HistoryJimCatchScissors
                    catches={
                      sessionPlayerDetailData.catches
                    }
                  />
                ) : (
                  <b>0</b>
                )}
              </div>

              <div>
                <span>JIM FAILED</span>
                {sessionPlayerDetailData.caughtFailures.length > 0 ? (
                  <JimFailSkulls
                    failures={sessionPlayerDetailData.caughtFailures}
                  />
                ) : (
                  <b>0</b>
                )}
              </div>
            </div>

            <section className="sessionPlayerDetailSection">
              <span>
                OVERVIEW
              </span>

              <div className="sessionPlayerDetailGrid">
                <div>
                  <span>
                    POINTS
                  </span>

                  <strong>
                    {
                      sessionPlayerDetailData.participant.points
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    {sessionPlayerDetailData.exactRoundsPlayed
                      ? 'ROUNDS PLAYED'
                      : 'RECORDED ROUNDS'}
                  </span>

                  <strong>
                    {
                      sessionPlayerDetailData.roundsPlayed
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    FINAL RANK
                  </span>

                  <strong>
                    #
                    {
                      sessionPlayerDetailData.rank
                    }
                  </strong>
                </div>
              </div>
            </section>

            <section className="sessionPlayerDetailSection">
              <span>
                STANDARD
              </span>

              <div className="sessionPlayerDetailGrid">
                <div>
                  <span>
                    ROUNDS
                  </span>

                  <strong>
                    {
                      sessionPlayerDetailData.standardRounds
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    WINS
                  </span>

                  <strong>
                    {
                      sessionPlayerDetailData.standardWins
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    WIN RATE
                  </span>

                  <strong>
                    {sessionPlayerDetailData.standardRate ===
                    null
                      ? '—'
                      : `${(
                          sessionPlayerDetailData.standardRate *
                          100
                        ).toFixed(
                          1
                        )}%`}
                  </strong>
                </div>
              </div>
            </section>

            <section className="sessionPlayerDetailSection">
              <span>
                JIM
              </span>

              <div className="sessionPlayerDetailGrid sessionPlayerDetailGridWide">
                <div>
                  <span>
                    ATTEMPTS
                  </span>

                  <strong>
                    {
                      sessionPlayerDetailData.jimAttempts.length
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    WINS
                  </span>

                  <strong>
                    {
                      sessionPlayerDetailData.jimWins.length
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    SUCCESS RATE
                  </span>

                  <strong>
                    {sessionPlayerDetailData.jimRate ===
                    null
                      ? '—'
                      : `${(
                          sessionPlayerDetailData.jimRate *
                          100
                        ).toFixed(
                          1
                        )}%`}
                  </strong>
                </div>

                <div>
                  <span>
                    CAUGHT
                  </span>

                  <strong>
                    {
                      sessionPlayerDetailData.caught
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    CATCHES
                  </span>

                  <strong>
                    {
                      sessionPlayerDetailData.catches.length
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    AVG STAGES
                  </span>

                  <strong>
                    {sessionPlayerDetailData.averageStages ===
                    null
                      ? '—'
                      : sessionPlayerDetailData.averageStages.toFixed(
                          1
                        )}
                  </strong>
                </div>

                <div>
                  <span>
                    HIDES USED
                  </span>

                  <strong>
                    {
                      sessionPlayerDetailData.hideUses
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    PENALTIES
                  </span>

                  <strong>
                    {
                      sessionPlayerDetailData.penalties
                    }
                  </strong>
                </div>
              </div>
            </section>

            {!sessionPlayerDetailData.exactRoundsPlayed && (
              <p className="sessionPlayerDetailNote">
                Waiting-player sessions do not
                store the two passive defenders
                in older Jim-round records, so
                Recorded Rounds is the confirmed
                minimum rather than an estimated
                total.
              </p>
            )}

            <button
              type="button"
              className="sessionPlayerDetailClose"
              onClick={() =>
                setSessionPlayerDetail(
                  null
                )
              }
            >
              Close
            </button>
          </div>
        </div>
      )}


      {mvpScoringOpen && createPortal(
        <div className="mvpScoringOverlay" onMouseDown={event => {
          if (event.target === event.currentTarget) setMvpScoringOpen(false)
        }}>
          <section className="mvpScoringDialog mvpScoringCompact" role="dialog" aria-modal="true" aria-labelledby="mvp-scoring-title" aria-describedby="mvp-scoring-intro">
            <header className="mvpScoringDialogHeader">
              <div>
                <span className="mvpScoringEyebrow">JIMRAMI MVP</span>
                <h2 id="mvp-scoring-title">Scoring guide</h2>
              </div>
              <button ref={scoringCloseRef} type="button" className="mvpScoringClose" aria-label="Close scoring guide" onClick={() => setMvpScoringOpen(false)}>×</button>
            </header>
            <div className="mvpScoringBody">
              <p id="mvp-scoring-intro" className="mvpScoringIntro">Your MVP rating combines your all-time results with your last 10 completed sessions.</p>
              <div className="mvpScoringSplit" aria-label="40 percent all-time, 60 percent recent 10 sessions">
                <div className="mvpScoringSplitAll">ALL-TIME <strong>40%</strong></div>
                <div className="mvpScoringSplitRecent">RECENT 10 <strong>60%</strong></div>
              </div>
              <div className="mvpScoringSectionHeading">
                <h3>Five attributes</h3>
                <small>Tap for formulas</small>
              </div>
              <div className="mvpScoringAttributeList">
                <details>
                  <summary><strong>Standard</strong><span className="mvpScoringTagline">Wins · win rate · points</span><b>25%</b></summary>
                  <p>50% relative Standard wins + 30% win rate + 20% average points ÷ 3.</p>
                </details>
                <details>
                  <summary><strong>Jim</strong><span className="mvpScoringTagline">Wins · success · bravery</span><b>30%</b></summary>
                  <p>65% relative Jim wins + 25% success rate + 10% bravery, minus up to 10 points for Penakut sessions.</p>
                </details>
                <details>
                  <summary><strong>Session</strong><span className="mvpScoringTagline">Wins · win rate</span><b>15%</b></summary>
                  <p>60% relative session wins + 40% session win rate.</p>
                </details>
                <details>
                  <summary><strong>Slayer</strong><span className="mvpScoringTagline">Catches · catch frequency</span><b>20%</b></summary>
                  <p>70% relative Jim catches + 30% of sessions with at least one catch.</p>
                </details>
                <details>
                  <summary><strong>Consistency</strong><span className="mvpScoringTagline">Non-zero · strong rounds · streak</span><b>10%</b></summary>
                  <p>40% non-zero Standard rounds + 35% rounds with +2 or +3 + 25% average session-best streak, capped at 5.</p>
                </details>
              </div>
              <details className="mvpScoringMore">
                <summary>Rules &amp; eligibility</summary>
                <div>
                  <p><b>Relative scores:</b> All-time wins and catches are compared with the all-time leader. Recent wins and catches are compared per session against the best recent rate, using players with at least 5 sessions as the reference where available.</p>
                  <p><b>Recent 10:</b> Uses a player's last 10 completed sessions, or however many they have played.</p>
                  <p><b>Penakut:</b> A session without any Jim attempt. Every Penakut session reduces the Jim rating by up to 10 points across the period.</p>
                  <p><b>Win streak:</b> Standard first places, successful Jim attempts and Jim catches count as wins. Recorded losses break the streak; unplayed rounds pause it.</p>
                  <p><b>Podium:</b> Requires 5 completed sessions, 20 Standard rounds and 5 Jim attempts. Others appear provisionally. Game penalties do not affect the MVP.</p>
                </div>
              </details>
              <p className="mvpScoringRadarNote">Radar: <b>solid</b> MVP · <b>dotted</b> All-time · <b>dashed</b> Recent 10</p>
            </div>
          </section>
        </div>,
        document.body
      )}

      {deleteSession &&
        createPortal(
          <div className="historyDeleteOverlay">
            <div className="historyDeleteDialog">
              <span className="historyDeleteLabel">
                DELETE SESSION
              </span>

              <h2>
                {formatDate(
                  deleteSession.startedAt
                )}
              </h2>

              <p>
                This permanently removes
                this session and all of its
                Standard rounds, Jim
                results, penalties and
                standings.
              </p>

              <div className="historyDeleteSummary">
                <div>
                  <span>
                    ROUNDS
                  </span>

                  <strong>
                    {
                      deleteSessionRoundCount
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    DURATION
                  </span>

                  <strong>
                    {
                      deleteSessionDuration
                    }
                  </strong>
                </div>
              </div>

              <div className="historyDeleteActions">
                <button
                  className="historyDeleteCancel"
                  disabled={
                    deletingSession
                  }
                  onClick={
                    cancelDeleteSession
                  }
                >
                  Cancel
                </button>

                <button
                  className="historyDeleteConfirm"
                  disabled={
                    deletingSession
                  }
                  onClick={
                    confirmDeleteSession
                  }
                >
                  {deletingSession
                    ? 'Deleting...'
                    : 'Delete Session'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </main>
  )
}
