import {
  Fragment,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  AnimatePresence,
  motion,
  Reorder,
} from 'motion/react'

import {
  type ScoreTransitionData,
} from './ScoreTransition'

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

type Scores =
  Record<number, string>

type TieResolutions =
  Record<string, number[]>

type EntryMode =
  | 'quick'
  | 'count'

type PreparedResult =
  SessionPlayer & {
    cardScore?: number
    position: number
    pointsAwarded: number
  }

const NORMAL_POINTS =
  [3, 2, 1, 0]

export default function StandardRound({
  session,
  sessionPlayers,
  players,
  onBack,
  onComplete,
}: Props) {
  const playing =
    [...sessionPlayers]
      .filter(
        (player) =>
          player.rotationOrder < 4
      )
      .sort(
        (a, b) =>
          a.rotationOrder -
          b.rotationOrder
      )

  const waiting =
    [...sessionPlayers]
      .filter(
        (player) =>
          player.rotationOrder >= 4
      )
      .sort(
        (a, b) =>
          a.rotationOrder -
          b.rotationOrder
      )

  const initialScores:
    Scores = {}

  playing.forEach(
    (player) => {
      initialScores[
        player.id
      ] = ''
    }
  )

  const [
    mode,
    setMode,
  ] =
    useState<EntryMode>(
      'quick'
    )

  const [
    rankedPlayers,
    setRankedPlayers,
  ] =
    useState<
      SessionPlayer[]
    >(playing)

  /*
    tieIndex means the gap AFTER
    this row is connected.

    0 = 1st + 2nd
    1 = 2nd + 3rd
    2 = 3rd + 4th
  */
  const [
    tieIndex,
    setTieIndex,
  ] =
    useState<number | null>(
      null
    )

  const [
    quickNotice,
    setQuickNotice,
  ] =
    useState('')

  const noticeTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null)

  const [
    scores,
    setScores,
  ] =
    useState<Scores>(
      initialScores
    )

  const [
    activePlayerId,
    setActivePlayerId,
  ] =
    useState(
      playing[0]?.id
    )

  const [
    autoPlayerId,
    setAutoPlayerId,
  ] =
    useState<
      number | null
    >(null)

  const [
    message,
    setMessage,
  ] =
    useState('')


  const [
    tieGroups,
    setTieGroups,
  ] =
    useState<number[][]>(
      []
    )

  const [
    tieOrder,
    setTieOrder,
  ] =
    useState<number[]>(
      []
    )

  const [
    tieResolutions,
    setTieResolutions,
  ] =
    useState<TieResolutions>(
      {}
    )

  const [
    dismissedTieSignature,
    setDismissedTieSignature,
  ] =
    useState('')

  useEffect(
    () => {
      return () => {
        if (
          noticeTimer.current
        ) {
          clearTimeout(
            noticeTimer.current
          )
        }
      }
    },
    []
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

  function getSessionPlayerName(
    sessionPlayerId: number
  ) {
    const sessionPlayer =
      playing.find(
        (player) =>
          player.id ===
          sessionPlayerId
      )

    if (!sessionPlayer) {
      return 'Unknown'
    }

    return getName(
      sessionPlayer.playerId
    )
  }

  function showQuickNotice(
    text: string
  ) {
    setQuickNotice(
      text
    )

    if (
      noticeTimer.current
    ) {
      clearTimeout(
        noticeTimer.current
      )
    }

    noticeTimer.current =
      setTimeout(
        () => {
          setQuickNotice('')
        },
        1900
      )
  }

  function awardForQuickSlot(
    index: number
  ) {
    if (
      tieIndex === null
    ) {
      return (
        NORMAL_POINTS[
          index
        ] ?? 0
      )
    }

    if (
      index === tieIndex ||
      index ===
        tieIndex + 1
    ) {
      /*
        Special family rule:
        a bottom 3rd/4th tie
        gives both 0.
      */
      if (
        tieIndex === 2
      ) {
        return 0
      }

      return (
        NORMAL_POINTS[
          tieIndex
        ] ?? 0
      )
    }

    return (
      NORMAL_POINTS[
        index
      ] ?? 0
    )
  }

  function toggleTie(
    index: number
  ) {
    /*
      1st place is always decided
      manually. Only 2nd/3rd or
      3rd/4th may be connected.
    */
    if (index === 0) {
      return
    }

    const removing =
      tieIndex === index

    if (removing) {
      setTieIndex(null)

      showQuickNotice(
        'Tie removed.'
      )

      return
    }

    setTieIndex(index)

    const first =
      rankedPlayers[index]

    const second =
      rankedPlayers[
        index + 1
      ]

    if (
      !first ||
      !second
    ) {
      return
    }

    const points =
      index === 2
        ? 0
        : (
            NORMAL_POINTS[
              index
            ] ?? 0
          )

    showQuickNotice(
      `${getName(
        first.playerId
      )} + ${getName(
        second.playerId
      )} tied • both +${points}`
    )
  }

  function handleReorder(
    next:
      SessionPlayer[]
  ) {
    setRankedPlayers(
      next
    )

    if (
      tieIndex !== null
    ) {
      setTieIndex(null)

      showQuickNotice(
        'Tie cleared after reorder.'
      )
    }
  }

  function prepareQuickResults():
    PreparedResult[] {
    return rankedPlayers.map(
      (
        player,
        index
      ) => {
        let position =
          index + 1

        if (
          tieIndex !== null &&
          (
            index ===
              tieIndex ||
            index ===
              tieIndex + 1
          )
        ) {
          position =
            tieIndex + 1
        }

        return {
          ...player,

          position,

          pointsAwarded:
            awardForQuickSlot(
              index
            ),
        }
      }
    )
  }

  const activePlayer =
    playing.find(
      (player) =>
        player.id ===
        activePlayerId
    )

  const cardTotal =
    playing.reduce(
      (
        total,
        player
      ) =>
        total +
        (
          Number(
            scores[
              player.id
            ]
          ) || 0
        ),
      0
    )

  const allScoresEntered =
    playing.every(
      (player) =>
        scores[
          player.id
        ] !== ''
    )

  const countReady =
    allScoresEntered &&
    cardTotal === 312

  /*
    Counting mode always sorts as soon as the
    four values make a valid 312 total. Equal
    values stay in rotation order until a tie
    resolution says otherwise.
  */
  const countDisplayPlayers =
    countReady
      ? [...playing].sort(
          (a, b) => {
            const aScore =
              Number(scores[a.id])

            const bScore =
              Number(scores[b.id])

            if (aScore !== bScore) {
              return bScore - aScore
            }

            const resolution =
              tieResolutions[
                String(aScore)
              ]

            if (resolution) {
              return (
                resolution.indexOf(a.id) -
                resolution.indexOf(b.id)
              )
            }

            return (
              a.rotationOrder -
              b.rotationOrder
            )
          }
        )
      : playing

  const countTieGroups =
    countReady
      ? (() => {
          const groups:
            Array<{
              score: string
              playerIds: number[]
              startIndex: number
            }> = []

          countDisplayPlayers.forEach(
            (player, index) => {
              const score =
                scores[player.id]

              const previous =
                groups[
                  groups.length - 1
                ]

              if (
                previous &&
                previous.score === score
              ) {
                previous.playerIds.push(
                  player.id
                )
              } else {
                groups.push({
                  score,
                  playerIds: [player.id],
                  startIndex: index,
                })
              }
            }
          )

          return groups.filter(
            (group) =>
              group.playerIds.length > 1
          )
        })()
      : []

  /*
    Ties that can remain visible without a
    decider:
    - 2nd + 3rd share +2
    - 3rd + 4th may share 0 only when both
      card scores are exactly zero
  */
  const countAllowedPassiveTie =
    countTieGroups.find(
      (group) =>
        (
          group.startIndex === 1 &&
          group.playerIds.length === 2
        ) ||
        (
          group.startIndex === 2 &&
          group.playerIds.length === 2 &&
          group.score === '0'
        )
    ) ?? null

  const countManualTieGroups =
    countTieGroups.filter(
      (group) =>
        !(
          (
            group.startIndex === 1 &&
            group.playerIds.length === 2
          ) ||
          (
            group.startIndex === 2 &&
            group.playerIds.length === 2 &&
            group.score === '0'
          )
        )
    )

  const countUnresolvedManualTieGroups =
    countManualTieGroups.filter(
      (group) => {
        const resolution =
          tieResolutions[group.score]

        return !(
          resolution &&
          resolution.length ===
            group.playerIds.length &&
          group.playerIds.every(
            (id) =>
              resolution.includes(id)
          )
        )
      }
    )

  const countAwardsReady =
    countReady &&
    countUnresolvedManualTieGroups.length === 0

  const countScoreSignature =
    countReady
      ? countDisplayPlayers
          .map(
            (player) =>
              `${player.id}:${scores[player.id]}`
          )
          .join('|')
      : ''

  const countTiePromptSignature =
    countReady &&
    countUnresolvedManualTieGroups.length > 0
      ? `${countScoreSignature}::${countUnresolvedManualTieGroups
          .map(
            (group) =>
              `${group.score}:${group.playerIds.join(',')}`
          )
          .join(';')}`
      : ''

  useEffect(
    () => {
      if (
        mode !== 'count' ||
        !countTiePromptSignature ||
        dismissedTieSignature ===
          countTiePromptSignature ||
        tieGroups.length > 0
      ) {
        return
      }

      /* Let the cards finish their short slide first. */
      const timer =
        window.setTimeout(
          () => {
            setTieGroups(
              countUnresolvedManualTieGroups.map(
                (group) => [
                  ...group.playerIds,
                ]
              )
            )

            setTieOrder([])
          },
          320
        )

      return () =>
        window.clearTimeout(timer)
    },
    [
      mode,
      countTiePromptSignature,
      dismissedTieSignature,
      tieGroups.length,
      tieResolutions,
    ]
  )

  function invalidateCountTieState() {
    setTieGroups([])
    setTieOrder([])
    setTieResolutions({})
    setDismissedTieSignature('')
  }

  function closeCountTieDialog() {
    setDismissedTieSignature(
      countTiePromptSignature
    )

    setTieGroups([])
    setTieOrder([])
  }

  function countAwardLabel(
    sessionPlayerId: number
  ) {
    if (!countAwardsReady) {
      return ''
    }

    const index =
      countDisplayPlayers.findIndex(
        (player) =>
          player.id ===
          sessionPlayerId
      )

    const awardedPoints =
      countAllowedPassiveTie?.startIndex === 1
        ? [3, 2, 2, 0]
        : countAllowedPassiveTie?.startIndex === 2 &&
            countAllowedPassiveTie.score === '0'
          ? [3, 2, 0, 0]
          : [3, 2, 1, 0]

    const award =
      awardedPoints[index] ?? 0

    return award > 0
      ? `+${award}`
      : '0'
  }

  function selectPlayer(
    sessionPlayerId:
      number
  ) {
    setActivePlayerId(
      sessionPlayerId
    )

    setMessage('')
  }

  function setPlayerZero(
    sessionPlayerId: number
  ) {
    setMessage('')
    invalidateCountTieState()

    const editingAuto =
      autoPlayerId ===
      sessionPlayerId

    const currentAutoId =
      editingAuto
        ? null
        : autoPlayerId

    if (editingAuto) {
      setAutoPlayerId(
        null
      )
    }

    setActivePlayerId(
      sessionPlayerId
    )

    setScores(
      (current) => {
        const next = {
          ...current,
          [sessionPlayerId]: '0',
        }

        if (
          currentAutoId !==
            null &&
          sessionPlayerId !==
            currentAutoId
        ) {
          const manualTotal =
            playing
              .filter(
                (player) =>
                  player.id !==
                  currentAutoId
              )
              .reduce(
                (
                  total,
                  player
                ) =>
                  total +
                  (
                    Number(
                      next[
                        player.id
                      ]
                    ) || 0
                  ),
                0
              )

          const remainder =
            312 -
            manualTotal

          next[
            currentAutoId
          ] =
            remainder >= 0
              ? String(
                  remainder
                )
              : ''
        }

        return next
      }
    )
  }

  function pressKey(
    key: string
  ) {
    if (
      !activePlayerId
    ) {
      return
    }

    setMessage('')
    invalidateCountTieState()

    const editingAuto =
      autoPlayerId ===
      activePlayerId

    const currentAutoId =
      editingAuto
        ? null
        : autoPlayerId

    if (editingAuto) {
      setAutoPlayerId(
        null
      )
    }

    setScores(
      (current) => {
        const next = {
          ...current,
        }

        const currentValue =
          editingAuto
            ? ''
            : (
                next[
                  activePlayerId
                ] || ''
              )

        let newValue =
          currentValue

        if (
          key === 'clear'
        ) {
          newValue = ''
        } else if (
          key ===
          'backspace'
        ) {
          newValue =
            currentValue.slice(
              0,
              -1
            )
        } else {
          newValue =
            currentValue ===
            '0'
              ? key
              : (
                  currentValue +
                  key
                )

          if (
            newValue.length >
            3
          ) {
            return current
          }

          if (
            Number(
              newValue
            ) > 312
          ) {
            return current
          }
        }

        next[
          activePlayerId
        ] = newValue

        /*
          Keep an AUTO score
          synchronized whenever
          a manual score changes.
        */
        if (
          currentAutoId !==
            null &&
          activePlayerId !==
            currentAutoId
        ) {
          const manualTotal =
            playing
              .filter(
                (player) =>
                  player.id !==
                  currentAutoId
              )
              .reduce(
                (
                  total,
                  player
                ) =>
                  total +
                  (
                    Number(
                      next[
                        player.id
                      ]
                    ) || 0
                  ),
                0
              )

          const remainder =
            312 -
            manualTotal

          next[
            currentAutoId
          ] =
            remainder >= 0
              ? String(
                  remainder
                )
              : ''
        }

        return next
      }
    )
  }

  const filledPlayers =
    playing.filter(
      (player) =>
        scores[
          player.id
        ] !== ''
    )

  const enteredTotal =
    filledPlayers.reduce(
      (
        total,
        player
      ) =>
        total +
        Number(
          scores[
            player.id
          ]
        ),
      0
    )

  const canAutoCalculate =
    autoPlayerId ===
      null &&
    filledPlayers.length ===
      3 &&
    enteredTotal <= 312

  function calculateAutoScore() {
    setMessage('')

    if (
      !canAutoCalculate
    ) {
      return
    }

    const missing =
      playing.find(
        (player) =>
          scores[
            player.id
          ] === ''
      )

    if (!missing) {
      return
    }

    const remainder =
      312 -
      enteredTotal

    invalidateCountTieState()

    setScores(
      (current) => ({
        ...current,

        [missing.id]:
          String(
            remainder
          ),
      })
    )

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
  }

  function prepareCountResults(
    resolutions:
      TieResolutions
  ): PreparedResult[] | null {
    if (
      !allScoresEntered
    ) {
      setMessage(
        'All four scores are required.'
      )

      return null
    }

    if (
      cardTotal !== 312
    ) {
      setMessage(
        `Total must equal 312. Current total: ${cardTotal}.`
      )

      return null
    }

    const ordered =
      playing
        .map(
          (player) => ({
            ...player,

            cardScore:
              Number(
                scores[
                  player.id
                ]
              ),
          })
        )
        .sort(
          (a, b) => {
            if (
              a.cardScore !==
              b.cardScore
            ) {
              return (
                b.cardScore -
                a.cardScore
              )
            }

            const order =
              resolutions[
                String(
                  a.cardScore
                )
              ]

            if (!order) {
              return (
                a.rotationOrder -
                b.rotationOrder
              )
            }

            return (
              order.indexOf(
                a.id
              ) -
              order.indexOf(
                b.id
              )
            )
          }
        )

    const middleTie =
      ordered.length === 4 &&
      ordered[0].cardScore !==
        ordered[1].cardScore &&
      ordered[1].cardScore ===
        ordered[2].cardScore &&
      ordered[2].cardScore !==
        ordered[3].cardScore

    const zeroBottomTie =
      ordered.length === 4 &&
      ordered[2].cardScore === 0 &&
      ordered[3].cardScore === 0 &&
      ordered[1].cardScore !== 0

    const awardedPoints =
      middleTie
        ? [3, 2, 2, 0]
        : zeroBottomTie
          ? [3, 2, 0, 0]
          : [3, 2, 1, 0]

    return ordered.map(
      (
        player,
        index
      ) => ({
        ...player,

        position:
          middleTie &&
          (index === 1 || index === 2)
            ? 2
            : zeroBottomTie &&
                (index === 2 || index === 3)
              ? 3
              : index + 1,

        pointsAwarded:
          awardedPoints[
            index
          ],
      })
    )
  }

  function beginCountTieResolution() {
    if (!allScoresEntered) {
      setMessage(
        'All four scores are required.'
      )

      return false
    }

    if (cardTotal !== 312) {
      setMessage(
        `Total must equal 312. Current total: ${cardTotal}.`
      )

      return false
    }

    if (
      countUnresolvedManualTieGroups.length === 0
    ) {
      return false
    }

    setDismissedTieSignature('')

    setTieGroups(
      countUnresolvedManualTieGroups.map(
        (group) => [
          ...group.playerIds,
        ]
      )
    )

    setTieOrder([])

    return true
  }

  function chooseTiePlayer(
    sessionPlayerId: number
  ) {
    const group =
      tieGroups[0]

    if (!group) {
      return
    }

    const newOrder = [
      ...tieOrder,
      sessionPlayerId,
    ]

    /*
      Once only one player remains,
      their position is known.
    */
    if (
      newOrder.length ===
      group.length - 1
    ) {
      const finalPlayer =
        group.find(
          (id) =>
            !newOrder.includes(
              id
            )
        )

      if (!finalPlayer) {
        return
      }

      const completeOrder = [
        ...newOrder,
        finalPlayer,
      ]

      const score =
        scores[
          group[0]
        ]

      const resolutions = {
        ...tieResolutions,

        [score]:
          completeOrder,
      }

      const remaining =
        tieGroups.slice(
          1
        )

      if (
        remaining.length > 0
      ) {
        setTieResolutions(
          resolutions
        )

        setTieGroups(
          remaining
        )

        setTieOrder(
          []
        )

        return
      }

      setTieGroups([])
      setTieOrder([])
      setTieResolutions(
        resolutions
      )
      setDismissedTieSignature('')

      return
    }

    setTieOrder(
      newOrder
    )
  }


  async function finishRound(
    results:
      PreparedResult[]
  ) {
    let updatedSessionPlayers =
      sessionPlayers.map(
        (
          sessionPlayer
        ) => {
          const result =
            results.find(
              (entry) =>
                entry.id ===
                sessionPlayer.id
            )

          if (!result) {
            return {
              ...sessionPlayer,
            }
          }

          return {
            ...sessionPlayer,

            points:
              sessionPlayer.points +
              result.pointsAwarded,

            wins:
              sessionPlayer.wins +
              (
                result.position ===
                1
                  ? 1
                  : 0
              ),
          }
        }
      )

    /*
      The physical 4th row is
      still the player who goes
      out, even when 3rd/4th are
      connected as a scoring tie.
    */
    if (
      waiting.length > 0
    ) {
      const loser =
        results[
          results.length - 1
        ]

      const orderedPlayers =
        [
          ...updatedSessionPlayers,
        ].sort(
          (a, b) =>
            a.rotationOrder -
            b.rotationOrder
        )

      const currentPlaying =
        orderedPlayers.filter(
          (player) =>
            player.rotationOrder <
            4
        )

      const currentWaiting =
        orderedPlayers.filter(
          (player) =>
            player.rotationOrder >=
            4
        )

      const survivors =
        currentPlaying.filter(
          (player) =>
            player.id !==
            loser.id
        )

      const entering =
        currentWaiting[0]

      const remainingWaiting =
        currentWaiting.slice(
          1
        )

      const newRotation = [
        ...survivors,
        entering,
        ...remainingWaiting,

        orderedPlayers.find(
          (player) =>
            player.id ===
            loser.id
        )!,
      ]

      updatedSessionPlayers =
        newRotation.map(
          (
            player,
            index
          ) => ({
            ...player,

            rotationOrder:
              index,
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
            sessionId:
              session.id,

            roundNumber:
              session.roundNumber,

            type:
              'standard',

            createdAt:
              new Date(),
          })

        await db.roundResults.bulkAdd(
          results.map(
            (result) => {
              const base = {
                roundId,

                sessionId:
                  session.id,

                playerId:
                  result.playerId,

                position:
                  result.position,

                pointsAwarded:
                  result.pointsAwarded,
              }

              if (
                result.cardScore ===
                undefined
              ) {
                return base
              }

              return {
                ...base,

                cardScore:
                  result.cardScore,
              }
            }
          )
        )

        await db.sessionPlayers.bulkPut(
          updatedSessionPlayers
        )

        await db.sessions.update(
          session.id,
          {
            roundNumber:
              session.roundNumber +
              1,
          }
        )
      }
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

      changes:
        results.map(
          (result) => ({
            sessionPlayerId:
              result.id,

            amount:
              result.pointsAwarded,
          })
        ),
    })
  }

  function submitQuickRound() {
    finishRound(
      prepareQuickResults()
    )
  }

  function submitCountRound() {
    setMessage('')

    const hasManualTie =
      beginCountTieResolution()

    if (hasManualTie) {
      return
    }

    const results =
      prepareCountResults(
        tieResolutions
      )

    if (!results) {
      return
    }

    finishRound(
      results
    )
  }

  const currentTie =
    tieGroups[0]

  const remainingTiePlayers =
    currentTie
      ? currentTie.filter(
          (id) =>
            !tieOrder.includes(
              id
            )
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
            STANDARD ROUND
          </span>

          <h1>
            Round {
              session.roundNumber
            }
          </h1>
        </div>
      </header>

      <div className="standardModeBar">
        <div>
          <span>
            {mode === 'quick'
              ? 'QUICK RANK'
              : 'COUNT CARDS'}
          </span>

          <strong>
            {mode === 'quick'
              ? 'Drag players into finishing order'
              : 'Enter exact card scores'}
          </strong>
        </div>

        <button
          className="standardModeButton"
          onClick={() => {
            setMessage('')

            setMode(
              mode === 'quick'
                ? 'count'
                : 'quick'
            )
          }}
        >
          {mode === 'quick'
            ? 'Count Cards'
            : 'Quick Rank'}
        </button>
      </div>

      {mode === 'quick' ? (
        <>
          <section className="quickRankPanel">
            <Reorder.Group
              axis="y"
              values={
                rankedPlayers
              }
              onReorder={
                handleReorder
              }
              className="quickRankList"
              style={{
                touchAction: 'none',
              }}
              onTouchMove={
                (event) => {
                  /*
                    Android browsers can
                    treat a downward drag
                    near the top of the
                    page as pull-to-refresh.
                    Keep the gesture owned
                    by Quick Rank instead.
                  */
                  event.preventDefault()
                }
              }
            >
              {rankedPlayers.map(
                (
                  player,
                  index
                ) => {
                  const tiedWithNext =
                    tieIndex ===
                    index

                  const tiedWithPrevious =
                    tieIndex ===
                    index - 1

                  return (
                    <Reorder.Item
                      value={player}
                      key={
                        player.id
                      }
                      className="quickRankItem"
                      style={{
                        touchAction: 'none',
                      }}
                    >
                      <div
                        className={`quickRankCard ${
                          tiedWithNext
                            ? 'tiedWithNext'
                            : ''
                        } ${
                          tiedWithPrevious
                            ? 'tiedWithPrevious'
                            : ''
                        }`}
                      >
                        <span className="quickRankNumber">
                          {
                            index + 1
                          }
                        </span>

                        <div className="quickRankPlayer">
                          <strong>
                            {getName(
                              player.playerId
                            )}
                          </strong>

                          <span>
                            {tiedWithNext ||
                            tiedWithPrevious
                              ? 'TIED'
                              : `Position ${
                                  index +
                                  1
                                }`}
                          </span>
                        </div>

                        <div className="quickRankPoints">
                          <strong>
                            +{
                              awardForQuickSlot(
                                index
                              )
                            }
                          </strong>

                          <span>
                            PTS
                          </span>
                        </div>

                        <span className="quickRankDrag">
                          ↕
                        </span>
                      </div>

                      {index > 0 &&
                        index < 3 && (
                        <button
                          type="button"
                          className={`rankTieConnector ${
                            tieIndex ===
                            index
                              ? 'active'
                              : ''
                          }`}
                          onPointerDown={
                            (
                              event
                            ) =>
                              event.stopPropagation()
                          }
                          onClick={() =>
                            toggleTie(
                              index
                            )
                          }
                          aria-label={`Toggle tie between positions ${
                            index + 1
                          } and ${
                            index + 2
                          }`}
                        >
                          <span>
                            {tieIndex ===
                            index
                              ? 'TIED'
                              : '='}
                          </span>
                        </button>
                      )}
                    </Reorder.Item>
                  )
                }
              )}
            </Reorder.Group>

            <div className="quickRankHint">
              <span>
                ↕ Drag to reorder
              </span>

              <span>
                = Tie 2nd/3rd or 3rd/4th
              </span>
            </div>

            {quickNotice && (
              <div className="quickRankToast">
                {quickNotice}
              </div>
            )}
          </section>

          <button
            className="saveStandardRound"
            onClick={
              submitQuickRound
            }
          >
            Confirm Round
          </button>
        </>
      ) : (
        <>
          <div className="roundEntryLayout countRoundLayout">
            <section>
              <div
                className={`roundPlayers countRoundPlayers ${
                  countReady
                    ? 'ranked'
                    : ''
                }`}
              >
                {countDisplayPlayers.map(
                  (player) => {
                    const active =
                      player.id ===
                      activePlayerId

                    const automatic =
                      player.id ===
                      autoPlayerId

                    const awardLabel =
                      countAwardLabel(
                        player.id
                      )

                    const displayIndex =
                      countDisplayPlayers.findIndex(
                        (entry) =>
                          entry.id ===
                          player.id
                      )

                    const tiedWithNext =
                      countAllowedPassiveTie !== null &&
                      displayIndex ===
                        countAllowedPassiveTie.startIndex

                    const tiedWithPrevious =
                      countAllowedPassiveTie !== null &&
                      displayIndex ===
                        countAllowedPassiveTie.startIndex + 1

                    return (
                      <Fragment
                        key={player.id}
                      >
                        <motion.div
                          layout
                          className={`roundPlayerCardShell ${
                            countReady
                              ? 'isRanked'
                              : ''
                          }`}
                          transition={{
                            type: 'spring',
                            stiffness: 420,
                            damping: 34,
                          }}
                        >
                          <div
                            className={`roundPlayerCard ${
                              active
                                ? 'active'
                                : ''
                            } ${
                              tiedWithNext
                                ? 'tiedWithNext'
                                : ''
                            } ${
                              tiedWithPrevious
                                ? 'tiedWithPrevious'
                                : ''
                            }`}
                          >
                          <button
                            type="button"
                            className="roundPlayerSelectButton"
                            onClick={() =>
                              selectPlayer(
                                player.id
                              )
                            }
                          >
                            <motion.span
                              className={`roundAwardBadge ${
                                countAwardsReady
                                  ? 'visible'
                                  : ''
                              } ${
                                awardLabel === '0'
                                  ? 'zero'
                                  : ''
                              }`}
                              initial={false}
                              animate={{
                                opacity:
                                  countAwardsReady
                                    ? 1
                                    : 0,
                                scale:
                                  countAwardsReady
                                    ? 1
                                    : 0.86,
                              }}
                              aria-hidden={
                                !countAwardsReady
                              }
                            >
                              {awardLabel}
                            </motion.span>

                            <div className="roundPlayerIdentity">
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

                          <button
                            type="button"
                            className="roundZeroButton"
                            onClick={() =>
                              setPlayerZero(
                                player.id
                              )
                            }
                            aria-label={`Set ${getName(
                              player.playerId
                            )} score to zero`}
                            title="Set score to 0"
                          >
                            0
                          </button>
                        </div>
                      </motion.div>

                      {countAllowedPassiveTie &&
                        displayIndex ===
                          countAllowedPassiveTie.startIndex && (
                          <div
                            className="rankTieConnector active countTieConnector"
                            aria-label={`Positions ${
                              countAllowedPassiveTie.startIndex + 1
                            } and ${
                              countAllowedPassiveTie.startIndex + 2
                            } are tied`}
                          >
                            <span>
                              TIED
                            </span>
                          </div>
                        )}
                      </Fragment>
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
                <span>
                  TOTAL
                </span>

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

            <aside className="numberPadPanel standardCountPad">
              <div className="numberPadPlayer">
                <span>
                  ENTERING
                </span>

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
                ].map(
                  (number) => (
                    <button
                      key={
                        number
                      }
                      onClick={() =>
                        pressKey(
                          number
                        )
                      }
                    >
                      {number}
                    </button>
                  )
                )}

                <button
                  className="numberPadSecondary clearKey"
                  onClick={() =>
                    pressKey(
                      'clear'
                    )
                  }
                >
                  C
                </button>

                <button
                  className="zeroKey"
                  onClick={() =>
                    pressKey(
                      '0'
                    )
                  }
                >
                  0
                </button>

                <button
                  className="numberPadSecondary backspaceKey"
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
                disabled={
                  !canAutoCalculate
                }
                onClick={
                  calculateAutoScore
                }
              >
                AUTO
              </button>
            </aside>
          </div>

          <button
            className="saveStandardRound"
            disabled={
              !allScoresEntered ||
              cardTotal !== 312
            }
            onClick={
              submitCountRound
            }
          >
            Confirm Round
          </button>
        </>
      )}

      <AnimatePresence>
        {currentTie && (
          <motion.div
            className="tieOverlay"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: 0.18,
              ease: 'easeOut',
            }}
          >
            <motion.div
              className="tieDialog"
              initial={{
                opacity: 0,
                y: 18,
                scale: 0.97,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 10,
                scale: 0.985,
              }}
              transition={{
                type: 'spring',
                stiffness: 340,
                damping: 28,
                mass: 0.72,
              }}
            >
              <button
                type="button"
                className="tieCloseButton"
                onClick={
                  closeCountTieDialog
                }
                aria-label="Close tie decider"
                title="Close"
              >
                ×
              </button>

              <span className="tieLabel">
                TIE DECIDER
              </span>

              <h2>
                {scores[
                  currentTie[0]
                ]}{' '}
                points
              </h2>

              <p>
                Choose who ranks higher.
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
