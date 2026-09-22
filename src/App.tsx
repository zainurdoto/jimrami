import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import StandardRound from './StandardRound'
import JimRound from './JimRound'
import './index.css'

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

  const [screen, setScreen] =
    useState<
  'scoreboard' | 'standard' | 'jim'
>('scoreboard')

  const [
    newPlayerName,
    setNewPlayerName,
  ] = useState('')

  const [
    selectedIds,
    setSelectedIds,
  ] = useState<number[]>([])

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
      createdAt: new Date(),
    })

    setNewPlayerName('')
  }

  function togglePlayer(
    id: number
  ) {
    setSelectedIds(
      (current) => {
        if (
          current.includes(id)
        ) {
          return current.filter(
            (playerId) =>
              playerId !== id
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

    await db.players.delete(id)
  }

  async function startSession() {
    if (
      selectedIds.length < 4
    ) {
      return
    }

    await db.transaction(
      'rw',
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
          selectedIds.map(
            (
              playerId,
              index
            ) => ({
              sessionId,
              playerId,

              rotationOrder:
                index,

              points: 0,
              wins: 0,
              jimWins: 0,
              jimAttempts: 0,
            })
          )
        )
      }
    )

    setSelectedIds([])
    setScreen('scoreboard')
  }

  async function endSession() {
    if (!activeSession) {
      return
    }

    const confirmed =
      window.confirm(
        'End this game session?'
      )

    if (!confirmed) return

    await db.sessions.update(
      activeSession.id,
      {
        status: 'ended',
        endedAt: new Date(),
      }
    )

    setScreen('scoreboard')
  }

  function getPlayerName(
    playerId: number
  ) {
    return (
      players?.find(
        (player) =>
          player.id === playerId
      )?.name ?? 'Unknown'
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
          players={players}
          onBack={() =>
            setScreen(
              'scoreboard'
            )
          }
          onComplete={() =>
            setScreen(
              'scoreboard'
            )
          }
          
        />
      )
    }

    if (screen === 'jim') {
  return (
    <JimRound
      session={activeSession}
      sessionPlayers={sessionPlayers}
      players={players}
      onBack={() =>
        setScreen('scoreboard')
      }
      onComplete={() =>
        setScreen('scoreboard')
      }
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
        <header className="gameHeader">
          <div>
            <h1>JIM</h1>

            <span className="gameRound">
              ROUND{' '}
              {
                activeSession.roundNumber
              }
            </span>
          </div>

          <button
            className="endSession"
            onClick={endSession}
          >
            End Session
          </button>
        </header>

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

              return (
                <article
                  className="standingRow"
                  key={
                    sessionPlayer.id
                  }
                >
                  <div className="standingRank">
                    {index + 1}
                  </div>

                  <div className="standingPlayer">
                    <div>
                      <h2>
                        {getPlayerName(
                          sessionPlayer.playerId
                        )}
                      </h2>

                      <p>
                        Round won: [{sessionPlayer.wins}]
                        {'  •  '}
                        Jim: [★{sessionPlayer.jimWins ?? 0}]
                      </p>
                    </div>

                    {isPlaying && (
                      <span className="playingTag">
                        PLAYING
                      </span>
                    )}
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

        <section className="gameWaiting">
          <span>
            WAITING
          </span>

          <strong>
            {waiting.length ===
            0
              ? '—'
              : waiting
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
        </footer>
      </main>
    )
  }

  /* ---------------------------
     NEW SESSION
  ---------------------------- */

  return (
    <main className="app">
      <header className="setupHeader">
        <h1>JIM</h1>

        <span>
          New Session
        </span>
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

                <button
                  className="deletePlayer"
                  onClick={() =>
                    deletePlayer(
                      player.id
                    )
                  }
                >
                  ×
                </button>
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
    </main>
  )
}

export default App