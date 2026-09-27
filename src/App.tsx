import ScoreTransition, {
  type ScoreTransitionData,
} from './ScoreTransition'
import TitleRace from './TitleRace'
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type JimResult } from './db'
import StandardRound from './StandardRound'
import JimRound from './JimRound'
import './index.css'
import DataTools from './DataTools'
import Penalty from './Penalty'
import HistoryStats from './HistoryStats'

function StandardWinTally({
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

function JimWinStars({
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
        a.roundId - b.roundId ||
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


function JimCatchScissors({
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
        a.roundId - b.roundId ||
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


function LiveClock() {
  const [
    now,
    setNow,
  ] =
    useState(
      () => new Date()
    )

  useEffect(
    () => {
      const timer =
        window.setInterval(
          () =>
            setNow(
              new Date()
            ),
          1000
        )

      return () =>
        window.clearInterval(
          timer
        )
    },
    []
  )

  const hours24 =
    now.getHours()

  const period =
    hours24 >= 12
      ? 'PM'
      : 'AM'

  const hours12 =
    hours24 % 12 || 12

  const hours =
    String(
      hours12
    ).padStart(
      2,
      '0'
    )

  const minutes =
    String(
      now.getMinutes()
    ).padStart(
      2,
      '0'
    )

  const seconds =
    String(
      now.getSeconds()
    ).padStart(
      2,
      '0'
    )

  return (
    <div
      className="roundLiveClock"
      title="Current device time"
      aria-label={`Current time ${hours}:${minutes}:${seconds} ${period}`}
    >
      <strong>
        {hours}:{minutes}:{seconds}
      </strong>

      <span>
        {period}
      </span>
    </div>
  )
}

function SessionElapsed({
  startedAt,
}: {
  startedAt: Date
}) {
  const [
    now,
    setNow,
  ] =
    useState(
      () => Date.now()
    )

  useEffect(
    () => {
      const timer =
        window.setInterval(
          () =>
            setNow(
              Date.now()
            ),
          1000
        )

      return () =>
        window.clearInterval(
          timer
        )
    },
    []
  )

  const totalSeconds =
    Math.max(
      0,
      Math.floor(
        (
          now -
          startedAt.getTime()
        ) / 1000
      )
    )

  const hours =
    Math.floor(
      totalSeconds / 3600
    )

  const minutes =
    Math.floor(
      (
        totalSeconds % 3600
      ) / 60
    )

  const seconds =
    totalSeconds % 60

  const elapsed = [
    String(hours).padStart(
      2,
      '0'
    ),
    String(minutes).padStart(
      2,
      '0'
    ),
    String(seconds).padStart(
      2,
      '0'
    ),
  ].join(':')

  return (
    <div
      className="sessionElapsedMini"
      title="Time elapsed since this session started"
    >
      <span>
        ELAPSED
      </span>

      <strong>
        {elapsed}
      </strong>
    </div>
  )
}

function App() {
  const players = useLiveQuery(
    () =>
      db.players
        .orderBy('createdAt')
        .toArray(),
    []
  )

  
  const activeSession = useLiveQuery(
    () =>
      db.sessions
        .where('status')
        .equals('active')
        .first(),
    []
  )

  const sessionPlayers = useLiveQuery(
    async () => {
      if (!activeSession) {
        return []
      }

      return db.sessionPlayers
        .where('sessionId')
        .equals(activeSession.id)
        .sortBy('rotationOrder')
    },
    [activeSession?.id]
  )

  /*
    The scoreboard needs each individual
    Jim win so it can show whether Hide
    was used for that specific win.
  */
  const jimWinResults =
    useLiveQuery(
      async () => {
        if (!activeSession) {
          return []
        }

        const results =
          await db.jimResults
            .where('sessionId')
            .equals(
              activeSession.id
            )
            .toArray()

        return results.filter(
          (result) =>
            result.won
        )
      },
      [
        activeSession?.id,
        activeSession?.roundNumber,
      ]
    ) ?? []


  /*
    Keep each caught-Jim result so one
    scissors icon can represent one catch.
  */
  const jimCatchResults =
    useLiveQuery(
      async () => {
        if (!activeSession) {
          return []
        }

        const results =
          await db.jimResults
            .where('sessionId')
            .equals(
              activeSession.id
            )
            .toArray()

        return results.filter(
          (result) =>
            result.caughtByPlayerId !==
            undefined
        )
      },
      [
        activeSession?.id,
        activeSession?.roundNumber,
      ]
    ) ?? []


  const previousRoundWinner =
    useLiveQuery(
      async () => {
        if (!activeSession) {
          return null
        }

        const sessionRounds =
          await db.rounds
            .where(
              'sessionId'
            )
            .equals(
              activeSession.id
            )
            .toArray()

        if (
          sessionRounds.length ===
          0
        ) {
          return null
        }

        const latestRound =
          [...sessionRounds].sort(
            (a, b) =>
              b.roundNumber -
                a.roundNumber ||
              b.createdAt.getTime() -
                a.createdAt.getTime()
          )[0]

        if (
          latestRound.type ===
          'standard'
        ) {
          const results =
            await db.roundResults
              .where(
                'roundId'
              )
              .equals(
                latestRound.id
              )
              .toArray()

          const winner =
            results.find(
              (result) =>
                result.position ===
                1
            )

          if (!winner) {
            return null
          }

          return {
            roundNumber:
              latestRound.roundNumber,

            type:
              'standard' as const,

            winnerPlayerId:
              winner.playerId,

            detail:
              'STANDARD',
          }
        }

        const jimResult =
          await db.jimResults
            .where(
              'roundId'
            )
            .equals(
              latestRound.id
            )
            .first()

        if (!jimResult) {
          return null
        }

        const winnerPlayerId =
          jimResult.won
            ? jimResult.jimPlayerId
            : jimResult.caughtByPlayerId

        if (
          winnerPlayerId ===
          undefined
        ) {
          return null
        }

        return {
          roundNumber:
            latestRound.roundNumber,

          type:
            'jim' as const,

          winnerPlayerId,

          detail:
            jimResult.won
              ? 'JIM WON'
              : 'CAUGHT JIM',

          jimWon:
            jimResult.won,

          hideStage:
            jimResult.hideStage,
        }
      },
      [
        activeSession?.id,
        activeSession?.roundNumber,
      ]
    )

  const [screen, setScreen] =
useState<
  'scoreboard' |
  'standard' |
  'jim' |
  'race' |
  'history' |
  'transition' |
  'penalty'
>('scoreboard')

  const [
    newPlayerName,
    setNewPlayerName,
  ] = useState('')

  const [
    selectedIds,
    setSelectedIds,
  ] = useState<number[]>([])


  const [
    selectedDisplayNames,
    setSelectedDisplayNames,
  ] = useState<
    Record<number, string>
  >({})

  const [
    editingPlayerId,
    setEditingPlayerId,
  ] = useState<number | null>(
    null
  )

  const [
    editPlayerName,
    setEditPlayerName,
  ] = useState('')

  const [
    editNicknames,
    setEditNicknames,
  ] = useState<string[]>([])

  const [
    newNickname,
    setNewNickname,
  ] = useState('')

    const [
    showDataTools,
    setShowDataTools,
  ] = useState(false)

  const [
    showEndSessionConfirm,
    setShowEndSessionConfirm,
  ] = useState(false)

  const [
  transitionData,
  setTransitionData,
] =
  useState<
    ScoreTransitionData | null
  >(null)

  async function addPlayer() {
    const name =
      newPlayerName.trim()

    if (!name) return

    const duplicate =
      players?.some(
        (player) =>
          player.name.toLowerCase() ===
          name.toLowerCase()
      )

    if (duplicate) return

    await db.players.add({
      name,
      nicknames: [],
      lastUsedDisplayName: name,
      createdAt: new Date(),
    })

    setNewPlayerName('')
  }

  function getPlayerOptions(
    player: {
      name: string
      nicknames?: string[]
    }
  ) {
    const raw = [
      player.name,
      ...(player.nicknames ?? []),
    ]

    const seen =
      new Set<string>()

    return raw.filter(
      (name) => {
        const trimmed =
          name.trim()

        const key =
          trimmed.toLowerCase()

        if (
          !trimmed ||
          seen.has(key)
        ) {
          return false
        }

        seen.add(key)
        return true
      }
    )
  }

  function getDefaultDisplayName(
    player: {
      name: string
      nicknames?: string[]
      lastUsedDisplayName?: string
    }
  ) {
    const options =
      getPlayerOptions(player)

    if (
      player.lastUsedDisplayName &&
      options.some(
        (name) =>
          name.toLowerCase() ===
          player.lastUsedDisplayName!
            .toLowerCase()
      )
    ) {
      return (
        options.find(
          (name) =>
            name.toLowerCase() ===
            player.lastUsedDisplayName!
              .toLowerCase()
        ) ?? player.name
      )
    }

    return player.name
  }

  function openPlayerEditor(
    playerId: number
  ) {
    const player =
      players?.find(
        (entry) =>
          entry.id === playerId
      )

    if (!player) {
      return
    }

    setEditingPlayerId(
      player.id
    )

    setEditPlayerName(
      player.name
    )

    setEditNicknames(
      [...(player.nicknames ?? [])]
    )

    setNewNickname('')
  }

  function closePlayerEditor() {
    setEditingPlayerId(
      null
    )

    setEditPlayerName('')
    setEditNicknames([])
    setNewNickname('')
  }

  function addNickname() {
    const nickname =
      newNickname.trim()

    if (!nickname) {
      return
    }

    const canonical =
      editPlayerName
        .trim()
        .toLowerCase()

    const duplicate =
      nickname.toLowerCase() ===
        canonical ||
      editNicknames.some(
        (existing) =>
          existing.toLowerCase() ===
          nickname.toLowerCase()
      )

    if (duplicate) {
      setNewNickname('')
      return
    }

    setEditNicknames(
      (current) => [
        ...current,
        nickname,
      ]
    )

    setNewNickname('')
  }

  function removeNickname(
    nickname: string
  ) {
    setEditNicknames(
      (current) =>
        current.filter(
          (entry) =>
            entry !== nickname
        )
    )
  }

  async function savePlayerEditor() {
    if (
      editingPlayerId === null
    ) {
      return
    }

    const name =
      editPlayerName.trim()

    if (!name) {
      return
    }

    const duplicateCanonical =
      players?.some(
        (player) =>
          player.id !==
            editingPlayerId &&
          player.name.toLowerCase() ===
            name.toLowerCase()
      )

    if (duplicateCanonical) {
      window.alert(
        'Another player already uses that main name.'
      )

      return
    }

    const cleanedNicknames:
      string[] = []

    const seen =
      new Set<string>([
        name.toLowerCase(),
      ])

    editNicknames.forEach(
      (nickname) => {
        const trimmed =
          nickname.trim()

        const key =
          trimmed.toLowerCase()

        if (
          trimmed &&
          !seen.has(key)
        ) {
          seen.add(key)

          cleanedNicknames.push(
            trimmed
          )
        }
      }
    )

    const player =
      players?.find(
        (entry) =>
          entry.id ===
          editingPlayerId
      )

    if (!player) {
      return
    }

    const validNames = [
      name,
      ...cleanedNicknames,
    ]

    const previousDefault =
      player.lastUsedDisplayName

    const nextDefault =
      previousDefault &&
      validNames.some(
        (entry) =>
          entry.toLowerCase() ===
          previousDefault.toLowerCase()
      )
        ? (
            validNames.find(
              (entry) =>
                entry.toLowerCase() ===
                previousDefault.toLowerCase()
            ) ?? name
          )
        : name

    await db.players.update(
      editingPlayerId,
      {
        name,
        nicknames:
          cleanedNicknames,
        lastUsedDisplayName:
          nextDefault,
      }
    )

    setSelectedDisplayNames(
      (current) => {
        if (
          !selectedIds.includes(
            editingPlayerId
          )
        ) {
          return current
        }

        const currentName =
          current[
            editingPlayerId
          ]

        const stillValid =
          currentName &&
          validNames.some(
            (entry) =>
              entry.toLowerCase() ===
              currentName.toLowerCase()
          )

        return {
          ...current,

          [editingPlayerId]:
            stillValid
              ? currentName
              : name,
        }
      }
    )

    closePlayerEditor()
  }

  function setSessionDisplayName(
    playerId: number,
    displayName: string
  ) {
    setSelectedDisplayNames(
      (current) => ({
        ...current,
        [playerId]:
          displayName,
      })
    )
  }

  function togglePlayer(
    id: number
  ) {
    setSelectedIds(
      (current) => {
        if (
          current.includes(id)
        ) {
          setSelectedDisplayNames(
            (names) => {
              const next = {
                ...names,
              }

              delete next[id]

              return next
            }
          )

          return current.filter(
            (playerId) =>
              playerId !== id
          )
        }

        const player =
          players?.find(
            (entry) =>
              entry.id === id
          )

        if (player) {
          setSelectedDisplayNames(
            (names) => ({
              ...names,

              [id]:
                getDefaultDisplayName(
                  player
                ),
            })
          )
        }

        return [
          ...current,
          id,
        ]
      }
    )
  }

  async function deletePlayer(
    id: number
  ) {
    const previousGames =
      await db.sessionPlayers
        .where('playerId')
        .equals(id)
        .count()

    if (previousGames > 0) {
      window.alert(
        'This player already has game history and cannot be deleted.'
      )

      return
    }

    setSelectedIds(
      (current) =>
        current.filter(
          (playerId) =>
            playerId !== id
        )
    )

    setSelectedDisplayNames(
      (current) => {
        const next = {
          ...current,
        }

        delete next[id]

        return next
      }
    )

    await db.players.delete(id)
  }

  async function startSession() {
    if (
      selectedIds.length < 4 ||
      !players
    ) {
      return
    }

    const selectedPlayers =
      selectedIds.flatMap(
        (playerId) => {
          const player =
            players.find(
              (entry) =>
                entry.id ===
                playerId
            )

          return player
            ? [player]
            : []
        }
      )

    await db.transaction(
      'rw',
      db.players,
      db.sessions,
      db.sessionPlayers,
      async () => {
        const sessionId =
          await db.sessions.add({
            startedAt:
              new Date(),

            status: 'active',

            roundNumber: 1,
          })

        await db.sessionPlayers.bulkAdd(
          selectedPlayers.map(
            (
              player,
              index
            ) => {
              const options =
                getPlayerOptions(
                  player
                )

              const requested =
                selectedDisplayNames[
                  player.id
                ]

              const displayName =
                options.find(
                  (name) =>
                    name.toLowerCase() ===
                    requested?.toLowerCase()
                ) ??
                getDefaultDisplayName(
                  player
                )

              return {
                sessionId,

                playerId:
                  player.id,

                displayName,

                rotationOrder:
                  index,

                points: 0,
                wins: 0,
                jimWins: 0,
                jimAttempts: 0,
              }
            }
          )
        )

        await db.players.bulkPut(
          selectedPlayers.map(
            (player) => ({
              ...player,

              lastUsedDisplayName:
                selectedDisplayNames[
                  player.id
                ] ??
                getDefaultDisplayName(
                  player
                ),
            })
          )
        )
      }
    )

    setSelectedIds([])
    setSelectedDisplayNames({})
    setScreen('scoreboard')
  }

  async function endSession() {
    if (!activeSession) {
      return
    }

    await db.sessions.update(
      activeSession.id,
      {
        status: 'ended',
        endedAt: new Date(),
      }
    )

    setShowEndSessionConfirm(
      false
    )

    setScreen('scoreboard')
  }

  const activeDisplayPlayers =
    players?.map(
      (player) => {
        const sessionPlayer =
          sessionPlayers?.find(
            (entry) =>
              entry.playerId ===
              player.id
          )

        if (
          !sessionPlayer?.displayName
        ) {
          return player
        }

        return {
          ...player,
          name:
            sessionPlayer.displayName,
        }
      }
    ) ?? []

  function getPlayerName(
    playerId: number
  ) {
    const sessionPlayer =
      sessionPlayers?.find(
        (player) =>
          player.playerId ===
          playerId
      )

    if (
      sessionPlayer?.displayName
    ) {
      return (
        sessionPlayer.displayName
      )
    }

    return (
      players?.find(
        (player) =>
          player.id === playerId
      )?.name ?? 'Unknown'
    )
  }

  if (
    screen === 'history' &&
    players
  ) {
    return (
      <HistoryStats
        players={players}
        onBack={() =>
          setScreen('scoreboard')
        }
      />
    )
  }

  /* ---------------------------
     ACTIVE SESSION
  ---------------------------- */

  if (
    activeSession &&
    players &&
    sessionPlayers
  ) {
    if (screen === 'standard') {
      return (
        <StandardRound
          session={activeSession}
          sessionPlayers={
            sessionPlayers
          }
          players={activeDisplayPlayers}
          onBack={() =>
            setScreen(
              'scoreboard'
            )
          }
          onComplete={(data) => {
          setTransitionData(data)
          setScreen('transition')
        }}
        />
      )
    }

    if (screen === 'jim') {
  return (
    <JimRound
      session={activeSession}
      sessionPlayers={sessionPlayers}
      players={activeDisplayPlayers}
      onBack={() =>
        setScreen('scoreboard')
      }
       onComplete={(data) => {
      setTransitionData(data)
      setScreen('transition')
  }}
    />
  )
}

if (screen === 'race') {
  return (
    <TitleRace
      session={activeSession}
      sessionPlayers={sessionPlayers}
      players={activeDisplayPlayers}
      onBack={() =>
        setScreen('scoreboard')
      }
    />
  )
}

if (
  screen === 'transition' &&
  transitionData
) {
  return (
    <ScoreTransition
      data={transitionData}
      players={activeDisplayPlayers}
      jimWins={jimWinResults}
      jimCatches={jimCatchResults}
      onDone={() => {
        setTransitionData(null)
        setScreen('scoreboard')
      }}
    />
  )
}

if (
  screen === 'penalty' &&
  activeSession &&
  sessionPlayers &&
  players
) {
  return (
    <Penalty
      session={activeSession}
      sessionPlayers={
        sessionPlayers
      }
      players={activeDisplayPlayers}
      onBack={() =>
        setScreen(
          'scoreboard'
        )
      }
      onComplete={(data) => {
        setTransitionData(
          data
        )

        setScreen(
          'transition'
        )
      }}
    />
  )
}

    const playing =
      sessionPlayers.filter(
        (player) =>
          player.rotationOrder <
          4
      )

    const waiting =
      sessionPlayers.filter(
        (player) =>
          player.rotationOrder >=
          4
      )

    const ranking = [
      ...sessionPlayers,
    ].sort(
      (a, b) =>
        b.points - a.points ||
        a.rotationOrder -
          b.rotationOrder
    )

    return (
      <main className="app">
        <header className="gameHeader gameHeaderPolished">
          <div className="gameRoundArea">
            <LiveClock />

            <div className="gameRoundHero">
              <span>
                ROUND
              </span>

              <strong>
                {
                  activeSession.roundNumber
                }
              </strong>
            </div>
          </div>

<div className="gameBrand">
  <h1 className="jimramiBrandLockup">
    <img
      className="jimramiLogo"
      src={`${import.meta.env.BASE_URL}Jim_Jawi.svg`}
      alt=""
    />

    <span className="jimramiLatin">
      JIMRAMI
    </span>
  </h1>
</div>

          <div className="gameHeaderTools">
            <div className="gameHeaderActions">
              <button
                className="dataButton"
                onClick={() =>
                  setScreen('history')
                }
              >
                History
              </button>

              <button
                className="dataButton"
                onClick={() =>
                  setShowDataTools(true)
                }
              >
                Data
              </button>

              <button
                className="endSession"
                onClick={() =>
                  setShowEndSessionConfirm(
                    true
                  )
                }
              >
                End Session
              </button>
            </div>

            <SessionElapsed
              startedAt={
                activeSession.startedAt
              }
            />
          </div>
        </header>

        {previousRoundWinner && (
          <section className="previousWinnerBar">
            <div className="previousWinnerLabel">
              <span>
                PREVIOUS WINNER
              </span>

              <small>
                {previousRoundWinner.detail}
                {' • '}
                ROUND{' '}
                {
                  previousRoundWinner.roundNumber
                }
              </small>
            </div>

            <strong>
              {getPlayerName(
                previousRoundWinner.winnerPlayerId
              )}
            </strong>

            <span
              className={`previousWinnerIcon ${
                previousRoundWinner.type
              } ${
                previousRoundWinner.type ===
                  'jim' &&
                previousRoundWinner.jimWon &&
                typeof previousRoundWinner.hideStage ===
                  'number'
                  ? 'usedHide'
                  : ''
              } ${
                previousRoundWinner.type ===
                  'jim' &&
                !previousRoundWinner.jimWon
                  ? 'caught'
                  : ''
              }`}
              title={
                previousRoundWinner.type ===
                'jim'
                  ? previousRoundWinner.jimWon
                    ? typeof previousRoundWinner.hideStage ===
                      'number'
                      ? `Jim round • Hide used at Stage ${previousRoundWinner.hideStage}`
                      : 'Jim round • No Hide'
                    : 'Caught Jim'
                  : 'Standard round'
              }
              aria-hidden="true"
            >
              {previousRoundWinner.type ===
              'jim'
                ? previousRoundWinner.jimWon
                  ? '★'
                  : '✂︎'
                : '✓'}
            </span>
          </section>
        )}

        <section className="gameScoreboard">
          {ranking.map(
            (
              sessionPlayer,
              index
            ) => {
              const isPlaying =
                playing.some(
                  (player) =>
                    player.id ===
                    sessionPlayer.id
                )

              const playerJimWins =
                jimWinResults.filter(
                  (result) =>
                    result.jimPlayerId ===
                    sessionPlayer.playerId
                )

              const playerJimCatches =
                jimCatchResults.filter(
                  (result) =>
                    result.caughtByPlayerId ===
                    sessionPlayer.playerId
                )

              return (
                <article
                  className={`standingRow ${
                    index === 0
                      ? 'leader'
                      : ''
                  }`}
                  key={
                    sessionPlayer.id
                  }
                >
                  <div className="standingRank">
                    {index + 1}
                  </div>

                  <div className="standingPlayer">
                    <div>
                      <div className="standingNameLine">
                        <h2>
                          {getPlayerName(
                            sessionPlayer.playerId
                          )}
                        </h2>

                        <span
                          className={`playerStatusTag ${
                            isPlaying
                              ? 'playing'
                              : 'waiting'
                          }`}
                        >
                          {isPlaying
                            ? 'PLAYING'
                            : 'WAITING'}
                        </span>
                      </div>

                      {(sessionPlayer.wins >
                        0 ||
                        playerJimWins.length >
                          0 ||
                        playerJimCatches.length >
                          0) && (
                        <div className="standingAchievements">
                          {sessionPlayer.wins >
                            0 && (
                            <StandardWinTally
                              count={
                                sessionPlayer.wins
                              }
                            />
                          )}

                          {playerJimWins.length >
                            0 && (
                            <JimWinStars
                              wins={
                                playerJimWins
                              }
                            />
                          )}

                          {playerJimCatches.length >
                            0 && (
                            <JimCatchScissors
                              catches={
                                playerJimCatches
                              }
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="standingPoints">
                    <strong>
                      {
                        sessionPlayer.points
                      }
                    </strong>

                    <span>
                      PTS
                    </span>
                  </div>
                </article>
              )
            }
          )}
        </section>

        {waiting.length > 0 && (
          <section className="gameWaiting">
            <span>
              WAITING QUEUE
            </span>

            <strong>
              {waiting
                .map(
                  (player) =>
                    getPlayerName(
                      player.playerId
                    )
                )
                .join(
                  '  •  '
                )}
            </strong>
          </section>
        )}

        <footer className="gameActions">
          <button
            onClick={() =>
              setScreen(
                'standard'
              )
            }
          >
            Standard Round
          </button>

          <button
              className="jimAction"
             onClick={() =>
             setScreen('jim')
              }
>
              ★ Jim Round
          </button>

          <button
             className="raceAction"
             onClick={() =>
             setScreen('race')
            }
>
  Title Race
</button>

<button
  className="penaltyAction"
  onClick={() =>
    setScreen('penalty')
  }
>
  Penalty -1
</button>

        </footer>
        {showEndSessionConfirm && (
          <div
            className="penaltyConfirmOverlay"
            onClick={() =>
              setShowEndSessionConfirm(
                false
              )
            }
          >
            <div
              className="penaltyConfirmDialog endSessionConfirmDialog"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <span className="penaltyConfirmLabel">
                END SESSION
              </span>

              <h2>
                End this game session?
              </h2>

              <p className="endSessionConfirmNote">
                The completed session will
                be saved to History.
              </p>

              <div className="penaltyConfirmActions">
                <button
                  type="button"
                  className="penaltyCancelButton"
                  onClick={() =>
                    setShowEndSessionConfirm(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="penaltyConfirmButton endSessionConfirmButton"
                  onClick={endSession}
                >
                  End Session
                </button>
              </div>
            </div>
          </div>
        )}

        {showDataTools && (
  <DataTools
    onClose={() =>
      setShowDataTools(false)
    }
  />
)}
      </main>
    )
  }

  /* ---------------------------
     NEW SESSION
  ---------------------------- */

  return (
    <main className="app">
     <header className="setupHeader">
<h1 className="jimramiBrandLockup">
  <img
    className="jimramiLogo"
    src={`${import.meta.env.BASE_URL}Jim_Jawi.svg`}
    alt=""
  />

  <span className="jimramiLatin">
    JIMRAMI
  </span>
</h1>

  <div className="setupHeaderActions">
    <span>
      New Session
    </span>

    <button
      className="dataButton"
      onClick={() =>
        setScreen('history')
      }
    >
      History
    </button>

    <button
      className="dataButton"
      onClick={() =>
        setShowDataTools(true)
      }
    >
      Data
    </button>
  </div>
</header>

      <section className="addPlayer">
        <input
          type="text"
          placeholder="Player name"
          value={
            newPlayerName
          }
          onChange={(event) =>
            setNewPlayerName(
              event.target.value
            )
          }
          onKeyDown={(event) => {
            if (
              event.key ===
              'Enter'
            ) {
              addPlayer()
            }
          }}
        />

        <button
          onClick={addPlayer}
        >
          Add Player
        </button>
      </section>

      <section className="playerLibrary">
        {!players && (
          <p className="emptyPlayers">
            Loading...
          </p>
        )}

        {players?.length ===
          0 && (
          <p className="emptyPlayers">
            Add your first
            player.
          </p>
        )}

        {players?.map(
          (player) => {
            const position =
              selectedIds.indexOf(
                player.id
              )

            const selected =
              position !== -1

            const nameOptions =
              getPlayerOptions(
                player
              )

            const sessionName =
              selectedDisplayNames[
                player.id
              ] ??
              getDefaultDisplayName(
                player
              )

            return (
              <article
                className={`playerSelect ${
                  selected
                    ? 'selected'
                    : ''
                }`}
                key={player.id}
              >
                <button
                  className="playerSelectMain"
                  onClick={() =>
                    togglePlayer(
                      player.id
                    )
                  }
                >
                  <div className="selectionNumber">
                    {selected
                      ? position +
                        1
                      : ''}
                  </div>

                  <strong>
                    {
                      player.name
                    }
                  </strong>

                  <span>
                    {selected
                      ? position <
                        4
                        ? 'PLAYING'
                        : 'WAITING'
                      : 'SELECT'}
                  </span>
                </button>

                <div className="playerSelectActions">
                  <button
                    className="editPlayer"
                    onClick={() =>
                      openPlayerEditor(
                        player.id
                      )
                    }
                    aria-label={`Edit ${player.name}`}
                  >
                    ✎
                  </button>

                  <button
                    className="deletePlayer"
                    onClick={() =>
                      deletePlayer(
                        player.id
                      )
                    }
                    aria-label={`Delete ${player.name}`}
                  >
                    ×
                  </button>
                </div>

                {selected &&
                  nameOptions.length >
                    1 && (
                  <div className="sessionAliasPicker">
                    <span>
                      PLAYING AS
                    </span>

                    <select
                      value={
                        sessionName
                      }
                      onChange={
                        (event) =>
                          setSessionDisplayName(
                            player.id,
                            event.target.value
                          )
                      }
                    >
                      {nameOptions.map(
                        (name) => (
                          <option
                            key={
                              name
                            }
                            value={
                              name
                            }
                          >
                            {name}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                )}
              </article>
            )
          }
        )}
      </section>

      <section className="sessionSummary">
        <div>
          <span>
            SELECTED
          </span>

          <strong>
            {
              selectedIds.length
            }
          </strong>
        </div>

        <div>
          <span>
            PLAYING
          </span>

          <strong>
            {Math.min(
              selectedIds.length,
              4
            )}
          </strong>
        </div>

        <div>
          <span>
            WAITING
          </span>

          <strong>
            {Math.max(
              selectedIds.length -
                4,
              0
            )}
          </strong>
        </div>
      </section>

      <button
        className="startSession"
        disabled={
          selectedIds.length <
          4
        }
        onClick={
          startSession
        }
      >
        {selectedIds.length <
        4
          ? `Select ${
              4 -
              selectedIds.length
            } more`
          : 'Start Session'}
      </button>

      {showDataTools && (
  <DataTools
    onClose={() =>
      setShowDataTools(false)
    }
  />
)}

      {editingPlayerId !== null && (
        <div className="playerEditorOverlay">
          <div className="playerEditorDialog">
            <span className="playerEditorLabel">
              PLAYER ID #{editingPlayerId}
            </span>

            <h2>
              Edit Player
            </h2>

            <label className="playerEditorField">
              <span>
                MAIN NAME
              </span>

              <input
                type="text"
                value={
                  editPlayerName
                }
                onChange={
                  (event) =>
                    setEditPlayerName(
                      event.target.value
                    )
                }
              />
            </label>

            <div className="playerEditorNicknames">
              <span>
                SAVED NICKNAMES
              </span>

              {editNicknames.length ===
              0 ? (
                <p>
                  No nicknames yet.
                </p>
              ) : (
                <div className="nicknameChipList">
                  {editNicknames.map(
                    (nickname) => (
                      <div
                        className="nicknameChip"
                        key={
                          nickname
                        }
                      >
                        <strong>
                          {nickname}
                        </strong>

                        <button
                          onClick={() =>
                            removeNickname(
                              nickname
                            )
                          }
                          aria-label={`Remove ${nickname}`}
                        >
                          ×
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="nicknameAddRow">
                <input
                  type="text"
                  placeholder="Add nickname"
                  value={
                    newNickname
                  }
                  onChange={
                    (event) =>
                      setNewNickname(
                        event.target.value
                      )
                  }
                  onKeyDown={
                    (event) => {
                      if (
                        event.key ===
                        'Enter'
                      ) {
                        event.preventDefault()
                        addNickname()
                      }
                    }
                  }
                />

                <button
                  onClick={
                    addNickname
                  }
                >
                  Add
                </button>
              </div>
            </div>

            <p className="playerEditorNote">
              All names above belong to
              the same permanent player
              ID. Stats and MVP stay
              together.
            </p>

            <div className="playerEditorActions">
              <button
                className="playerEditorCancel"
                onClick={
                  closePlayerEditor
                }
              >
                Cancel
              </button>

              <button
                className="playerEditorSave"
                onClick={
                  savePlayerEditor
                }
              >
                Save Player
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App