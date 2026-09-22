import {
  type ScoreTransitionData,
} from './ScoreTransition'
import { useState } from 'react'
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

  onComplete: (
    data: ScoreTransitionData
  ) => void
}

type Scores = Record<number, string>
type TieResolutions = Record<string, number[]>

export default function StandardRound({
  session,
  sessionPlayers,
  players,
  onBack,
  onComplete,
}: Props) {
  const playing = [...sessionPlayers]
    .filter((player) => player.rotationOrder < 4)
    .sort((a, b) => a.rotationOrder - b.rotationOrder)

  const waiting = [...sessionPlayers]
    .filter((player) => player.rotationOrder >= 4)
    .sort((a, b) => a.rotationOrder - b.rotationOrder)

  const initialScores: Scores = {}

  playing.forEach((player) => {
    initialScores[player.id] = ''
  })

  const [scores, setScores] =
    useState<Scores>(initialScores)

  const [activePlayerId, setActivePlayerId] =
    useState(playing[0]?.id)

  const [autoPlayerId, setAutoPlayerId] =
    useState<number | null>(null)

  const [message, setMessage] =
    useState('')

  const [tieGroups, setTieGroups] =
    useState<number[][]>([])

  const [tieOrder, setTieOrder] =
    useState<number[]>([])

  const [tieResolutions, setTieResolutions] =
    useState<TieResolutions>({})

  function getName(playerId: number) {
    return (
      players.find(
        (player) => player.id === playerId
      )?.name ?? 'Unknown'
    )
  }

  function getSessionPlayerName(
    sessionPlayerId: number
  ) {
    const sessionPlayer = playing.find(
      (player) =>
        player.id === sessionPlayerId
    )

    if (!sessionPlayer) {
      return 'Unknown'
    }

    return getName(sessionPlayer.playerId)
  }

  const activePlayer = playing.find(
    (player) =>
      player.id === activePlayerId
  )

  const cardTotal = playing.reduce(
    (total, player) =>
      total +
      (Number(scores[player.id]) || 0),
    0
  )

  const allScoresEntered =
    playing.every(
      (player) =>
        scores[player.id] !== ''
    )

  function selectPlayer(
    sessionPlayerId: number
  ) {
    setActivePlayerId(sessionPlayerId)
    setMessage('')
  }

  function pressKey(key: string) {
    if (!activePlayerId) return

    setMessage('')

    const editingAuto =
      autoPlayerId === activePlayerId

    const currentAutoId =
      editingAuto
        ? null
        : autoPlayerId

    if (editingAuto) {
      setAutoPlayerId(null)
    }

    setScores((current) => {
      const next = { ...current }

      let currentValue =
        editingAuto
          ? ''
          : next[activePlayerId] || ''

      let newValue = currentValue

      if (key === 'clear') {
        newValue = ''
      } else if (
        key === 'backspace'
      ) {
        newValue =
          currentValue.slice(0, -1)
      } else {
        newValue =
          currentValue === '0'
            ? key
            : currentValue + key

        if (newValue.length > 3) {
          return current
        }

        if (Number(newValue) > 312) {
          return current
        }
      }

      next[activePlayerId] =
        newValue

      /*
        If one player was previously
        auto-calculated, keep updating
        that value whenever one of the
        manual scores changes.
      */
      if (
        currentAutoId !== null &&
        activePlayerId !== currentAutoId
      ) {
        const manualTotal =
          playing
            .filter(
              (player) =>
                player.id !==
                currentAutoId
            )
            .reduce(
              (total, player) =>
                total +
                (Number(
                  next[player.id]
                ) || 0),
              0
            )

        const remainder =
          312 - manualTotal

        next[currentAutoId] =
          remainder >= 0
            ? String(remainder)
            : ''
      }

      return next
    })
  }

  function nextPlayer() {
    if (!activePlayer) return

    setMessage('')

    if (
      scores[activePlayer.id] === ''
    ) {
      setMessage(
        `Enter ${getName(
          activePlayer.playerId
        )}'s score first.`
      )

      return
    }

    /*
      Once three players have a score,
      calculate the fourth automatically.
    */
    if (autoPlayerId === null) {
      const filled =
        playing.filter(
          (player) =>
            scores[player.id] !== ''
        )

      if (filled.length === 3) {
        const missing =
          playing.find(
            (player) =>
              scores[player.id] === ''
          )

        if (missing) {
          const enteredTotal =
            filled.reduce(
              (total, player) =>
                total +
                Number(
                  scores[player.id]
                ),
              0
            )

          const remainder =
            312 - enteredTotal

          if (remainder < 0) {
            setMessage(
              'The entered scores already exceed 312.'
            )

            return
          }

          setScores((current) => ({
            ...current,
            [missing.id]:
              String(remainder),
          }))

          setAutoPlayerId(
            missing.id
          )

          setActivePlayerId(
            missing.id
          )

          setMessage(
            `${getName(
              missing.playerId
            )} automatically calculated as ${remainder}.`
          )

          return
        }
      }
    }

    const nextEmpty =
      playing.find(
        (player) =>
          player.id !==
            activePlayer.id &&
          scores[player.id] === ''
      )

    if (nextEmpty) {
      setActivePlayerId(
        nextEmpty.id
      )

      return
    }

    const currentIndex =
      playing.findIndex(
        (player) =>
          player.id ===
          activePlayer.id
      )

    const nextIndex =
      (currentIndex + 1) %
      playing.length

    setActivePlayerId(
      playing[nextIndex].id
    )
  }

  function submitRound() {
    if (!allScoresEntered) {
      setMessage(
        'All four scores are required.'
      )
      return
    }

    if (cardTotal !== 312) {
      setMessage(
        `Total must equal 312. Current total: ${cardTotal}.`
      )
      return
    }

    const scoreGroups:
      Record<string, number[]> = {}

    playing.forEach((player) => {
      const score =
        scores[player.id]

      if (!scoreGroups[score]) {
        scoreGroups[score] = []
      }

      scoreGroups[score].push(
        player.id
      )
    })

    const ties =
          Object.entries(
            scoreGroups
          )
            .filter(
              ([score, group]) =>
                group.length > 1 &&
                score !== '0'
            )
            .map(
              ([, group]) => group
            )

    if (ties.length > 0) {
      setTieGroups(ties)
      setTieOrder([])
      setTieResolutions({})
      return
    }

    finishRound({})
  }

  function chooseTiePlayer(
    sessionPlayerId: number
  ) {
    const group = tieGroups[0]

    if (!group) return

    const newOrder = [
      ...tieOrder,
      sessionPlayerId,
    ]

    /*
      Once only one remains,
      its position is automatically known.
    */
    if (
      newOrder.length ===
      group.length - 1
    ) {
      const finalPlayer =
        group.find(
          (id) =>
            !newOrder.includes(id)
        )

      if (!finalPlayer) return

      const completeOrder = [
        ...newOrder,
        finalPlayer,
      ]

      const score =
        scores[group[0]]

      const resolutions = {
        ...tieResolutions,
        [score]: completeOrder,
      }

      const remaining =
        tieGroups.slice(1)

      if (remaining.length > 0) {
        setTieResolutions(
          resolutions
        )

        setTieGroups(
          remaining
        )

        setTieOrder([])

        return
      }

      setTieGroups([])
      setTieOrder([])
      setTieResolutions({})

      finishRound(resolutions)
      return
    }

    setTieOrder(newOrder)
  }

  async function finishRound(
  resolutions: TieResolutions
) {
  const results = playing
    .map((player) => ({
      ...player,
      cardScore: Number(scores[player.id]),
    }))
    .sort((a, b) => {
      if (a.cardScore !== b.cardScore) {
        return b.cardScore - a.cardScore
      }

      const order =
        resolutions[String(a.cardScore)]

      if (!order) return 0

      return (
        order.indexOf(a.id) -
        order.indexOf(b.id)
      )
    })

  const zeroBottomTie =
  results.length === 4 &&
  results[2].cardScore === 0 &&
  results[3].cardScore === 0

  const awardedPoints =
  zeroBottomTie
    ? [3, 2, 0, 0]
    : [3, 2, 1, 0]

  /*
    First calculate everybody's
    updated cumulative score.
  */
  let updatedSessionPlayers =
    sessionPlayers.map((sessionPlayer) => {
      const resultIndex =
        results.findIndex(
          (result) =>
            result.id === sessionPlayer.id
        )

      if (resultIndex === -1) {
        return { ...sessionPlayer }
      }

      return {
        ...sessionPlayer,

        points:
          sessionPlayer.points +
          awardedPoints[resultIndex],

        wins:
          sessionPlayer.wins +
          (resultIndex === 0 ? 1 : 0),
      }
    })

  /*
    Now calculate the NEW table
    and waiting queue.

    Example:

    BEFORE
    0 Haji
    1 Beruis
    2 Jaki
    3 Thomann
    4 Bejan
    5 Pais

    If Thomann loses:

    AFTER
    0 Haji
    1 Beruis
    2 Jaki
    3 Bejan
    4 Pais
    5 Thomann
  */
  if (waiting.length > 0) {
    const loser =
      results[results.length - 1]

    const orderedPlayers =
      [...updatedSessionPlayers].sort(
        (a, b) =>
          a.rotationOrder -
          b.rotationOrder
      )

    const currentPlaying =
      orderedPlayers.filter(
        (player) =>
          player.rotationOrder < 4
      )

    const currentWaiting =
      orderedPlayers.filter(
        (player) =>
          player.rotationOrder >= 4
      )

    const survivingPlayers =
      currentPlaying.filter(
        (player) =>
          player.id !== loser.id
      )

    const enteringPlayer =
      currentWaiting[0]

    const remainingWaiting =
      currentWaiting.slice(1)

    const newRotation = [
      ...survivingPlayers,
      enteringPlayer,
      ...remainingWaiting,
      orderedPlayers.find(
        (player) =>
          player.id === loser.id
      )!,
    ]

    updatedSessionPlayers =
      newRotation.map(
        (player, index) => ({
          ...player,
          rotationOrder: index,
        })
      )
  }

  await db.transaction(
    'rw',
    db.rounds,
    db.roundResults,
    db.sessionPlayers,
    db.sessions,
    async () => {
      const roundId =
        await db.rounds.add({
          sessionId: session.id,
          roundNumber:
            session.roundNumber,
          type: 'standard',
          createdAt: new Date(),
        })

      await db.roundResults.bulkAdd(
        results.map(
          (result, index) => ({
            roundId,
            sessionId: session.id,
            playerId:
              result.playerId,
            cardScore:
              result.cardScore,
            position: index + 1,
            pointsAwarded:
              awardedPoints[index],
          })
        )
      )

      /*
        Save points, wins AND rotation
        together.
      */
      await db.sessionPlayers.bulkPut(
        updatedSessionPlayers
      )

      await db.sessions.update(
        session.id,
        {
          roundNumber:
            session.roundNumber + 1,
        }
      )
    }
  )

  const changes =
  results.map(
    (result, index) => ({
      sessionPlayerId:
        result.id,

      amount:
        awardedPoints[index],
    })
  )

onComplete({
  roundNumber:
    session.roundNumber,

  before:
    sessionPlayers.map(
      (player) => ({
        ...player,
      })
    ),

  after:
    updatedSessionPlayers.map(
      (player) => ({
        ...player,
      })
    ),

  changes,
})
}

  const currentTie =
    tieGroups[0]

  const remainingTiePlayers =
    currentTie
      ? currentTie.filter(
          (id) =>
            !tieOrder.includes(id)
        )
      : []

  return (
    <main className="app">
      <header className="roundEntryHeader">
        <button
          className="roundBack"
          onClick={onBack}
        >
          ←
        </button>

        <div>
          <span>
            ROUND {session.roundNumber}
          </span>

          <h1>Standard Round</h1>
        </div>
      </header>

      <div className="roundEntryLayout">
        <section>
          <div className="roundPlayers">
            {playing.map(
              (player) => {
                const active =
                  player.id ===
                  activePlayerId

                const automatic =
                  player.id ===
                  autoPlayerId

                return (
                  <button
                    key={player.id}
                    className={`roundPlayerCard ${
                      active
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      selectPlayer(
                        player.id
                      )
                    }
                  >
                    <div>
                      <strong>
                        {getName(
                          player.playerId
                        )}
                      </strong>

                      {automatic && (
                        <span className="autoScore">
                          AUTO
                        </span>
                      )}
                    </div>

                    <span className="roundPlayerScore">
                      {scores[
                        player.id
                      ] || '—'}
                    </span>
                  </button>
                )
              }
            )}
          </div>

          <div
            className={`cardTotal ${
              cardTotal === 312 &&
              allScoresEntered
                ? 'valid'
                : ''
            }`}
          >
            <span>TOTAL</span>

            <strong>
              {cardTotal}
              <small>
                {' '}
                / 312
              </small>
            </strong>
          </div>

          {message && (
            <p className="roundMessage">
              {message}
            </p>
          )}
        </section>

        <aside className="numberPadPanel">
          <div className="numberPadPlayer">
            <span>ENTERING</span>

            <strong>
              {activePlayer
                ? getName(
                    activePlayer.playerId
                  )
                : '—'}
            </strong>
          </div>

          <div className="numberPad">
            {[
              '1',
              '2',
              '3',
              '4',
              '5',
              '6',
              '7',
              '8',
              '9',
            ].map((number) => (
              <button
                key={number}
                onClick={() =>
                  pressKey(number)
                }
              >
                {number}
              </button>
            ))}

            <button
              className="numberPadSecondary"
              onClick={() =>
                pressKey('clear')
              }
            >
              C
            </button>

            <button
              onClick={() =>
                pressKey('0')
              }
            >
              0
            </button>

            <button
              className="numberPadSecondary"
              onClick={() =>
                pressKey(
                  'backspace'
                )
              }
            >
              ⌫
            </button>
          </div>

          <button
            className="nextScorePlayer"
            onClick={nextPlayer}
          >
            Next Player
          </button>
        </aside>
      </div>

      <button
        className="saveStandardRound"
        disabled={
          !allScoresEntered ||
          cardTotal !== 312
        }
        onClick={submitRound}
      >
        Submit Round
      </button>

      {currentTie && (
        <div className="tieOverlay">
          <div className="tieDialog">
            <span className="tieLabel">
              TIE
            </span>

            <h2>
              {scores[
                currentTie[0]
              ]}{' '}
              points
            </h2>

            <p>
              Who ranks higher?
            </p>

            <div className="tieChoices">
              {remainingTiePlayers.map(
                (
                  sessionPlayerId
                ) => (
                  <button
                    key={
                      sessionPlayerId
                    }
                    onClick={() =>
                      chooseTiePlayer(
                        sessionPlayerId
                      )
                    }
                  >
                    {getSessionPlayerName(
                      sessionPlayerId
                    )}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}