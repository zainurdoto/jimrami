import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useLiveQuery } from 'dexie-react-hooks'

import {
  db,
  type JimResult,
  type Player,
} from './db'

import TitleRace from './TitleRace'
import RoundEditor from './RoundEditor'


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

  standardScore: number
  jimScore: number
  sessionScore: number
  consistencyScore: number

  standardWinRate: number
  averageStandardPoints: number

  jimWinRate: number
  catchesPerSession: number

  sessionWinRate: number
  zeroPointRate: number
  disciplineScore: number

  sessions: number
  standardRounds: number
  jimAttempts: number
}

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
      'Most completed sessions with zero Jim attempts while at least one Jim round was played',
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

  const [
    playerSort,
    setPlayerSort,
  ] =
    useState<PlayerSort>(
      'total'
    )

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

          /*
            Penakut only counts a completed
            session if at least one Jim round
            happened in that session, but this
            player never took Jim.
          */
          const penakutSessions =
            completedParticipations.filter(
              (entry) => {
                const sessionJim =
                  jimResults.filter(
                    (result) =>
                      result.sessionId ===
                      entry.sessionId
                  )

                return (
                  sessionJim.length > 0 &&
                  !sessionJim.some(
                    (result) =>
                      result.jimPlayerId ===
                      player.id
                  )
                )
              }
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

  const mvpStats =
    useMemo<MvpStat[]>(() => {
      if (
        !sessionPlayers ||
        !roundResults
      ) {
        return []
      }

      return playerStats
        .map(
          (player) => {
            const standardResults =
              roundResults.filter(
                (result) =>
                  result.playerId ===
                  player.id
              )

            const standardPoints =
              standardResults.reduce(
                (total, result) =>
                  total +
                  result.pointsAwarded,
                0
              )

            const averageStandardPoints =
              player.standardRounds > 0
                ? standardPoints /
                  player.standardRounds
                : 0

            const standardWinRate =
              player.standardWinRate ===
              null
                ? 0
                : player.standardWinRate /
                  100

            const standardScore =
              0.5 *
                standardWinRate +
              0.5 *
                clamp01(
                  averageStandardPoints /
                    3
                )

            const jimWinRate =
              player.jimSuccessRate ===
              null
                ? 0
                : player.jimSuccessRate /
                  100

            /*
              Exact historical "catch
              opportunities" are not
              stored for every Jim round,
              because the DB records the
              Jim player and catcher but
              not the other three active
              players.

              For MVP v1, catches are
              therefore normalized by
              sessions played. One catch
              per session reaches the
              full catcher sub-score.
            */
            const catchesPerSession =
              player.sessions > 0
                ? player.jimCatches /
                  player.sessions
                : 0

            const jimScore =
              0.8 *
                jimWinRate +
              0.2 *
                clamp01(
                  catchesPerSession
                )

            const sessionWinRate =
              player.sessionWinRate ===
              null
                ? 0
                : player.sessionWinRate /
                  100

            const sessionScore =
              clamp01(
                sessionWinRate
              )

            const zeroPointRate =
              player.zeroPointRate ===
              null
                ? 0
                : player.zeroPointRate /
                  100

            const disciplineScore =
              player.sessions > 0
                ? clamp01(
                    1 -
                      player.penalties /
                        (
                          2 *
                          player.sessions
                        )
                  )
                : 0

            const consistencyScore =
              0.8 *
                (
                  1 -
                  clamp01(
                    zeroPointRate
                  )
                ) +
              0.2 *
                disciplineScore

            const score =
              100 *
              (
                0.4 *
                  standardScore +
                0.3 *
                  jimScore +
                0.2 *
                  sessionScore +
                0.1 *
                  consistencyScore
              )

            const provisional =
              player.completedSessions <
                5 ||
              player.standardRounds <
                20 ||
              player.jimAttempts <
                5

            return {
              playerId:
                player.id,

              name:
                player.name,

              score,

              provisional,

              standardScore:
                standardScore *
                100,

              jimScore:
                jimScore *
                100,

              sessionScore:
                sessionScore *
                100,

              consistencyScore:
                consistencyScore *
                100,

              standardWinRate:
                standardWinRate *
                100,

              averageStandardPoints,

              jimWinRate:
                jimWinRate *
                100,

              catchesPerSession,

              sessionWinRate:
                sessionWinRate *
                100,

              zeroPointRate:
                zeroPointRate *
                100,

              disciplineScore:
                disciplineScore *
                100,

              sessions:
                player.completedSessions,

              standardRounds:
                player.standardRounds,

              jimAttempts:
                player.jimAttempts,
            }
          }
        )
        .sort(
          (a, b) =>
            Number(
              a.provisional
            ) -
              Number(
                b.provisional
              ) ||
            b.score -
              a.score ||
            a.name.localeCompare(
              b.name
            )
        )
    }, [
      playerStats,
      sessionPlayers,
      roundResults,
    ])

  const podiumPlayers =
    [
      mvpStats[1],
      mvpStats[0],
      mvpStats[2],
    ].filter(
      (
        player
      ): player is MvpStat =>
        Boolean(player)
    )

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
            'Most completed sessions with zero Jim attempts while at least one Jim round was played',
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

    /*
      Penakut = completed the whole
      session without taking Jim at all.
      We only award it when the session
      actually contained at least one
      Jim round.
    */
    if (jim.length > 0) {
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
      <main className="app">
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
        <main className="app historyPage sessionAwardsPage">
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
          session={session}
          sessionPlayers={
            participants
          }
          players={
            sessionDisplayPlayers
          }
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
            caught:
              caught.length,
            penalties:
              penalties.length,
            hideUses,
          }
        })()

  return (
    <main className="app historyPage">
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

                    {expanded && (
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
                                        0

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

                        {roundDetailsOpen && (
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
                        )}


                      </div>
                    )}
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
              onChange={
                setPlayerSort
              }
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
                  </header>

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
                ALL-TIME MVP
              </span>

              <h2>
                Overall player rating
              </h2>

              <p>
                MVP combines Standard
                performance, Jim
                performance, session wins
                and consistency into one
                0–100 score.
              </p>
            </div>

            <div className="mvpFormula">
              <span>
                WEIGHTING
              </span>

              <strong>
                40% Standard
              </strong>

              <strong>
                30% Jim
              </strong>

              <strong>
                20% Session
              </strong>

              <strong>
                10% Consistency
              </strong>
            </div>
          </div>

          {mvpStats.length > 0 && (
            <section className="mvpPodiumSection">
              <div className="mvpPodiumHeader">
                <span>
                  MVP PODIUM
                </span>

                <h3>
                  Top 3 all-time
                </h3>
              </div>

              <div className="mvpPodium">
                {podiumPlayers.map(
                  (player) => {
                    const rank =
                      mvpStats.findIndex(
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
                          <span className="mvpMedal">
                            {rank === 1
                              ? '★'
                              : rank === 2
                                ? 'Ⅱ'
                                : 'Ⅲ'}
                          </span>

                          <strong>
                            {
                              player.name
                            }
                          </strong>

                          <small
                            className={
                              player.provisional
                                ? 'mvpProvisional'
                                : 'mvpQualified'
                            }
                          >
                            {player.provisional
                              ? 'PROVISIONAL'
                              : 'QUALIFIED'}
                          </small>
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
              marked provisional.
            </p>
          </div>

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
                    className={`mvpCard ${
                      index === 0
                        ? 'mvpLeader'
                        : ''
                    }`}
                    key={
                      player.playerId
                    }
                  >
                    <header>
                      <div className="mvpIdentity">
                        <span>
                          #{index + 1}
                        </span>

                        <div>
                          <h3>
                            {
                              player.name
                            }
                          </h3>

                          {player.provisional ? (
                            <small className="mvpProvisional">
                              PROVISIONAL
                            </small>
                          ) : (
                            <small className="mvpQualified">
                              QUALIFIED
                            </small>
                          )}
                        </div>
                      </div>

                      <div className="mvpScore">
                        <strong>
                          {
                            player.score.toFixed(
                              1
                            )
                          }
                        </strong>

                        <span>
                          MVP
                        </span>
                      </div>
                    </header>

                    <div className="mvpComponents">
                      <div>
                        <span>
                          STANDARD
                        </span>

                        <strong>
                          {player.standardScore.toFixed(
                            1
                          )}
                        </strong>

                        <small>
                          {player.standardWinRate.toFixed(
                            1
                          )}
                          % wins •{' '}
                          {player.averageStandardPoints.toFixed(
                            2
                          )}{' '}
                          avg pts
                        </small>
                      </div>

                      <div>
                        <span>
                          JIM
                        </span>

                        <strong>
                          {player.jimScore.toFixed(
                            1
                          )}
                        </strong>

                        <small>
                          {player.jimWinRate.toFixed(
                            1
                          )}
                          % wins •{' '}
                          {player.catchesPerSession.toFixed(
                            2
                          )}{' '}
                          catches/session
                        </small>
                      </div>

                      <div>
                        <span>
                          SESSION
                        </span>

                        <strong>
                          {player.sessionScore.toFixed(
                            1
                          )}
                        </strong>

                        <small>
                          {player.sessionWinRate.toFixed(
                            1
                          )}
                          % session wins
                        </small>
                      </div>

                      <div>
                        <span>
                          CONSISTENCY
                        </span>

                        <strong>
                          {player.consistencyScore.toFixed(
                            1
                          )}
                        </strong>

                        <small>
                          {player.zeroPointRate.toFixed(
                            1
                          )}
                          % zero-point •{' '}
                          {player.disciplineScore.toFixed(
                            1
                          )}
                          % discipline
                        </small>
                      </div>
                    </div>

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
                  </article>
                )
              )}
            </div>
          </section>

          <div className="mvpMethodNote">
            <strong>
              MVP v1
            </strong>

            <p>
              Jim catch opportunity is
              not stored for every
              historical round, so the
              catcher part currently uses
              catches per session. We can
              make this exact later if we
              start storing every active
              player for each Jim round.
            </p>
          </div>
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

      {deleteSession && (
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
        </div>
      )}
    </main>
  )
}
