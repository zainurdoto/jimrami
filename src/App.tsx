import JimVoiceRecorder from './JimVoiceRecorder'
import ScoreTransition, {
  type ScoreTransitionData,
} from './ScoreTransition'
import TitleRace from './TitleRace'
import { useEffect, useRef, useState } from 'react'

import { createPortal } from 'react-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  type GameSession,
  type GoalpostEvent,
  type JimResult,
  type SessionPlayer,
} from './db'
import StandardRound from './StandardRound'
import JimRound from './JimRound'
import './index.css'
import DataTools from './DataTools'
import Penalty from './Penalty'
import HistoryStats from './HistoryStats'

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



type GoalpostPrompt =
  | {
      kind: 'deuce'
      target: number
      round: number
      tiedPlayerIds: number[]
    }
  | {
      kind: 'reached'
      event: GoalpostEvent
    }

type GoalpostStanding = {
  playerId: number
  name: string
  points: number

  standardWins: number
  jimWins: JimResult[]
  catches: JimResult[]
  failures: JimResult[]
}

function GoalpostAccolades({ player }: { player: GoalpostStanding }) {
  if (
    player.standardWins <= 0 &&
    player.jimWins.length === 0 &&
    player.catches.length === 0 &&
    player.failures.length === 0
  ) return null

  return (
    <div className="goalpostRankingAccolades" aria-label={`${player.name}'s achievements`}>
      {player.standardWins > 0 && <StandardWinTally count={player.standardWins} />}
      {player.jimWins.length > 0 && <JimWinStars wins={player.jimWins} />}
      {player.catches.length > 0 && <JimCatchScissors catches={player.catches} />}
      <JimFailSkulls failures={player.failures} />
    </div>
  )
}

// The winner has a dedicated result banner, rather than another small row.

function GoalpostWinnerFeature({
  winner,
  label = 'SESSION WINNER',
}: {
  winner: GoalpostStanding
  label?: string
}) {
  return (
    <section className="goalpostWinnerFeature" aria-label={`${label}: ${winner.name}, ${winner.points} points`}>
      <div className="goalpostWinnerRankBlock" aria-label="First place">
        <span>1</span>
      </div>

      <div className="goalpostWinnerIdentity">
        <div className="goalpostFeatureHeadline">
          <span className="goalpostFeatureWinnerTag">{label}</span>
        </div>

        <div className="goalpostFeatureNameLine">
          <h2 className="goalpostFeatureName">{winner.name}</h2>
          <span className="goalpostFeatureCrown" aria-hidden="true">♛</span>
        </div>

        <div className="goalpostWinnerMeta">
          <GoalpostAccolades player={winner} />
        </div>
      </div>

      <div className="goalpostWinnerScoreBlock" aria-label={`${winner.points} points`}>
        <strong>{winner.points}</strong>
        <span>POINTS</span>
      </div>
    </section>
  )
}

function GoalpostRanking({
  ranking,
  winnerPlayerId,
}: {
  ranking: GoalpostStanding[]
  winnerPlayerId?: number
}) {
  // The sole winner is already shown above in the featured banner.
  // When first place is tied, include everybody in the ranking instead.
  const listedPlayers = winnerPlayerId === undefined
    ? ranking
    : ranking.filter(player => player.playerId !== winnerPlayerId)

  if (listedPlayers.length === 0) return null

  return (
    <section className="goalpostRanking" aria-label="Player rankings">
      {winnerPlayerId === undefined && (
        <div className="goalpostRankingHeader">
          <span>STANDINGS</span>
          <span>POINTS</span>
        </div>
      )}

      <div className="goalpostRankingList">
        {listedPlayers.map((player) => {
          // Tied scores share a rank; missing an outright winner is not hidden.
          const rank = ranking.findIndex(entry => entry.points === player.points) + 1
          const tiedFirst = rank === 1 && winnerPlayerId === undefined

          return (
            <div
              key={player.playerId}
              className={`goalpostRankingRow${tiedFirst ? ' tiedFirst' : ''}`}
              aria-label={`${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} place, ${player.name}, ${player.points} points`}
            >
              <span className="goalpostRankingPosition">{rank}</span>
              <div className="goalpostRankingPlayer">
                <div className="goalpostRankingNameLine">
                  <strong>{player.name}</strong>
                  {tiedFirst && <span className="goalpostRankingTieTag">TIED 1ST</span>}
                </div>
                <GoalpostAccolades player={player} />
              </div>
              <strong className="goalpostRankingPoints">{player.points}</strong>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function GoalpostDeuceModal({
  target,
  round,
  tiedPlayers,
  onContinue,
}: {
  target: number
  round: number
  tiedPlayers: GoalpostStanding[]
  onContinue: () => void
}) {
  useViewportModalLock()

  return createPortal(
    <div className="goalpostOverlay goalpostViewportOverlay">
      <div className="goalpostDialog deuce" role="dialog" aria-modal="true" aria-label="Deuce round">
        <span className="goalpostEyebrow">
          DEUCE ROUND
        </span>

        <div className="goalpostHeroMark">
          ⚔
        </div>

        <h2>
          Goalpost {target}
        </h2>

        <p className="goalpostLead">
          First place is tied after
          Round {round}. No winner yet.
        </p>

        <div className="goalpostDeucePlayers">
          {tiedPlayers.map(
            (player) => (
              <div
                key={
                  player.playerId
                }
              >
                <strong>
                  {
                    player.name
                  }
                </strong>

                <b>
                  {
                    player.points
                  }
                </b>
              </div>
            )
          )}
        </div>

        <button
          type="button"
          className="goalpostPrimaryButton"
          onClick={onContinue}
        >
          Continue Deuce
        </button>
      </div>
    </div>,
    document.body
  )
}

function GoalpostReachedModal({
  event,
  ranking,
  onExtend,
  onFinish,
}: {
  event: GoalpostEvent
  ranking: GoalpostStanding[]
  onExtend: (
    target: number
  ) => void
  onFinish: () => void
}) {
  const [
    customOpen,
    setCustomOpen,
  ] = useState(false)

  const [
    customTarget,
    setCustomTarget,
  ] = useState('')

  const [
    pendingExtension,
    setPendingExtension,
  ] = useState<number | null>(
    null
  )

  const [
    confirmFinish,
    setConfirmFinish,
  ] = useState(false)

  const leaderPoints =
    ranking[0]?.points ?? 0

  const extensionFloor =
    Math.max(
      event.target,
      leaderPoints
    )

  const plusTenTarget =
    event.target + 10

  const plusTenValid =
    plusTenTarget >
    extensionFloor

  const presets =
    Array.from(
      {
        length: 20,
      },
      (_, index) =>
        21 + index * 10
    )
      .filter(
        (target) =>
          target >
            extensionFloor &&
          target !==
            plusTenTarget
      )
      .slice(0, 2)

  const customNumber =
    Number(customTarget)

  const customValid =
    Number.isInteger(
      customNumber
    ) &&
    customNumber >
      extensionFloor

  useViewportModalLock()

  return createPortal(
    <div className="goalpostOverlay goalpostViewportOverlay">
      <div className="goalpostDialog reached" role="dialog" aria-modal="true" aria-label="Goalpost reached">
        <span className="goalpostEyebrow">
          {event.deuceStartedRound !==
          undefined
            ? 'DEUCE RESOLVED'
            : 'GOALPOST REACHED'}
        </span>
        <div className="goalpostHeaderTarget">GOALPOST <strong>{event.target}</strong></div>

        {ranking.length > 0 && (
          <GoalpostWinnerFeature
            winner={ranking.find(player => player.playerId === event.winnerPlayerId) ?? ranking[0]}
            label="GOALPOST WINNER"
          />
        )}

        {event.deuceStartedRound !==
          undefined && (
          <p className="goalpostDeuceInfo">
            Deuce began at Round{' '}
            {
              event.deuceStartedRound
            }
            {' • '}
            resolved at Round{' '}
            {
              event.deuceResolvedRound ??
              event.roundReached
            }
          </p>
        )}

        <GoalpostRanking
          ranking={ranking}
          winnerPlayerId={
            event.winnerPlayerId
          }
        />

        <div className="goalpostDecision">
          <span>
            KEEP PLAYING?
          </span>

          {pendingExtension ===
          null ? (
            <>
              <div className="goalpostExtendButtons">
                <button
                  type="button"
                  disabled={
                    !plusTenValid
                  }
                  onClick={() => {
                    if (
                      plusTenValid
                    ) {
                      setPendingExtension(
                        plusTenTarget
                      )
                    }
                  }}
                >
                  +10
                </button>

                {presets.map(
                  (target) => (
                    <button
                      type="button"
                      key={target}
                      onClick={() =>
                        setPendingExtension(
                          target
                        )
                      }
                    >
                      {target}
                    </button>
                  )
                )}

                <button
                  type="button"
                  className={
                    customOpen
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setCustomOpen(
                      (current) =>
                        !current
                    )
                  }
                >
                  Custom
                </button>
              </div>

              {customOpen && (
                <div className="goalpostCustomExtend">
                  <input
                    type="number"
                    min={
                      extensionFloor +
                      1
                    }
                    step="1"
                    placeholder={`Above ${extensionFloor}`}
                    value={
                      customTarget
                    }
                    onChange={(
                      event
                    ) =>
                      setCustomTarget(
                        event.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    disabled={
                      !customValid
                    }
                    onClick={() => {
                      if (
                        customValid
                      ) {
                        setPendingExtension(
                          customNumber
                        )
                      }
                    }}
                  >
                    Choose
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="goalpostExtensionConfirm">
              <div>
                <span>
                  CONFIRM EXTENSION
                </span>

                <strong>
                  {event.target}
                  {' → '}
                  {
                    pendingExtension
                  }
                </strong>

                <small>
                  Continue this session
                  with the new goalpost?
                </small>
              </div>

              <div>
                <button
                  type="button"
                  className="goalpostExtensionBack"
                  onClick={() =>
                    setPendingExtension(
                      null
                    )
                  }
                >
                  Back
                </button>

                <button
                  type="button"
                  className="goalpostExtensionYes"
                  onClick={() =>
                    onExtend(
                      pendingExtension
                    )
                  }
                >
                  Yes, Extend
                </button>
              </div>
            </div>
          )}
        </div>

        {!confirmFinish ? (
          <button
            type="button"
            className="goalpostFinishButton"
            onClick={() => {
              setPendingExtension(
                null
              )

              setConfirmFinish(
                true
              )
            }}
          >
            Finish Session
          </button>
        ) : (
          <div className="goalpostFinishConfirm">
            <div>
              <span>
                CONFIRM FINISH
              </span>

              <strong>
                End this session?
              </strong>

              <small>
                This confirms the current
                standings as the final result.
              </small>
            </div>

            <div>
              <button
                type="button"
                className="goalpostFinishBack"
                onClick={() =>
                  setConfirmFinish(
                    false
                  )
                }
              >
                Back
              </button>

              <button
                type="button"
                className="goalpostFinishYes"
                onClick={onFinish}
              >
                Yes, Finish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// Subtle, one-off gold celebration on the finished-session screen.
// Runs for about five seconds; no dependencies, audio, or stored data.
function SessionGoldFireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    const ctx = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !container || !ctx) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Keep this celebration light enough for Android WebView and older tablets.
    // Positions and lifetimes use real elapsed time, so dropped frames do not
    // stretch five seconds of fireworks into a slow-motion animation.
    type Spark = {
      x: number
      y: number
      vx: number
      vy: number
      size: number
      bornAt: number
      lifetime: number
      color: string
      phase: number
    }

    const golds = ['#f8d582', '#f0b84b', '#fff0b8', '#e2aa4f', '#fff8dd']
    const particles: Spark[] = []
    const burstTimes = [300, 1700, 3400]
    const burstLocations = [[0.42, 0.26], [0.72, 0.24], [0.53, 0.09]]
    let width = 1
    let height = 1
    let raf = 0
    let firstFrame = 0
    let fired = 0
    let stopped = false

    const resize = () => {
      const bounds = container.getBoundingClientRect()
      const nextWidth = Math.max(1, bounds.width)
      const nextHeight = Math.max(1, bounds.height)
      if (nextWidth === width && nextHeight === height) return
      width = nextWidth
      height = nextHeight
      // Rendering at DPR 2 is expensive on mobile for little visual benefit.
      const maxDpr = window.innerWidth <= 720 ? 1 : 1.5
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const burst = (number: number) => {
      const [fx, fy] = burstLocations[number]
      const count = number === 2 ? 28 : 36
      const bornAt = burstTimes[number]
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1.6 + Math.random() * 2.7
        particles.push({
          x: width * fx,
          y: height * fy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.4,
          size: 1.3 + Math.random() * 1.5,
          bornAt,
          lifetime: 1150 + Math.random() * 450,
          color: golds[Math.floor(Math.random() * golds.length)],
          phase: Math.random() * Math.PI * 2,
        })
      }
    }

    const render = (now: number) => {
      if (stopped) return
      if (firstFrame === 0) firstFrame = now
      const elapsed = now - firstFrame
      ctx.clearRect(0, 0, width, height)

      while (fired < burstTimes.length && elapsed >= burstTimes[fired]) {
        burst(fired)
        fired += 1
      }

      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      ctx.shadowBlur = 0 // Avoid expensive per-particle blurred canvas shadows.
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i]
        const age = elapsed - p.bornAt
        const remaining = 1 - age / p.lifetime
        if (remaining <= 0) {
          particles.splice(i, 1)
          continue
        }

        const t = age / 16.67
        const travel = t * Math.exp(-t * 0.009)
        const x = p.x + p.vx * travel
        const y = p.y + p.vy * travel + 0.012 * t * t
        const shimmer = 0.80 + 0.20 * Math.sin(t * 0.28 + p.phase)
        ctx.globalAlpha = Math.min(1, age / 125) * remaining * shimmer
        ctx.strokeStyle = p.color
        ctx.lineWidth = p.size
        ctx.beginPath()
        ctx.moveTo(x - p.vx * 2.5, y - p.vy * 2.5)
        ctx.lineTo(x, y)
        ctx.stroke()

        // A few brighter heads give a sparkling look without costly glow filters.
        if (i % 5 === 0) {
          ctx.fillStyle = p.color
          ctx.fillRect(x - p.size, y - p.size, p.size * 2, p.size * 2)
        }
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      if (elapsed < 5000 && (fired < burstTimes.length || particles.length > 0)) {
        raf = window.requestAnimationFrame(render)
      } else {
        ctx.clearRect(0, 0, width, height)
      }
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    raf = window.requestAnimationFrame(render)

    return () => {
      stopped = true
      window.cancelAnimationFrame(raf)
      observer.disconnect()
      ctx.clearRect(0, 0, width, height)
    }
  }, [])

  return <canvas ref={canvasRef} className="goalpostGoldFireworks" aria-hidden="true" />
}

function GoalpostSessionComplete({
  session,
  ranking,
  showFireworks,
  onAwards,
  onRace,
  onDone,
}: {
  session: GameSession
  ranking: GoalpostStanding[]
  showFireworks: boolean
  onAwards: () => void
  onRace: () => void
  onDone: () => void
}) {
  const finalEvent =
    [...(
      session.goalpostEvents ??
      []
    )]
      .reverse()
      .find(
        (event) =>
          event.outcome ===
          'finished'
      )

  useViewportModalLock()

  const leadingScore = ranking[0]?.points ?? 0
  const topPlayers = ranking.filter(player => player.points === leadingScore)
  const soleWinner = topPlayers.length === 1 ? topPlayers[0] : undefined

  return createPortal(
    <main className="app goalpostPostGamePage goalpostPostGameViewport">
      <section className="goalpostDialog complete" role="dialog" aria-modal="true" aria-label="Session complete">
        {showFireworks && <SessionGoldFireworks />}
        <span className="goalpostEyebrow">
          SESSION COMPLETE
        </span>
        <div className="goalpostHeaderTarget">
          {finalEvent ? <>GOALPOST <strong>{finalEvent.target}</strong></> : 'OPEN GOALPOST'}
        </div>

        {soleWinner ? (
          <GoalpostWinnerFeature winner={soleWinner} />
        ) : (
          <div className="goalpostTieFeature">
            <div className="goalpostHeroMark" aria-hidden="true">⚖</div>
            <span className="goalpostWinnerLabel">TIED FOR FIRST</span>
            <h1>Joint leaders</h1>
            <p className="goalpostWinnerPoints">{leadingScore} POINTS EACH</p>

          </div>
        )}

        {finalEvent?.deuceStartedRound !== undefined && (
          <p className="goalpostDeuceInfo">
            Deuce Round {finalEvent.deuceStartedRound} → {finalEvent.deuceResolvedRound ?? finalEvent.roundReached}
          </p>
        )}

        <GoalpostRanking
          ranking={ranking}
          winnerPlayerId={soleWinner?.playerId}
        />

        <div className="goalpostPostGameActions">
          <button
            type="button"
            className="goalpostAwardsButton"
            onClick={onAwards}
          >
            Session Awards
          </button>

          <button
            type="button"
            className="goalpostRaceButton"
            onClick={onRace}
          >
            Title Race
          </button>

          <button
            type="button"
            className="goalpostDoneButton"
            onClick={onDone}
          >
            Done
          </button>
        </div>
      </section>
    </main>,
    document.body
  )
}

function useViewportModalLock() {
  useEffect(
    () => {
      /*
        Same behaviour as the History delete
        confirmation: freeze the document at its
        exact scroll position while a viewport
        modal is open, then restore it on close.
      */
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
    []
  )
}


// Keep the page behind Edit Player still; the modal itself can scroll.
function PlayerEditorScrollLock() {
  useViewportModalLock()
  return null
}

function EndSessionConfirmModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  useViewportModalLock()

  const [
    secondsLeft,
    setSecondsLeft,
  ] = useState(3)

  useEffect(
    () => {
      if (secondsLeft <= 0) {
        return
      }

      const timer =
        window.setTimeout(
          () => {
            setSecondsLeft(
              (current) =>
                Math.max(
                  0,
                  current - 1
                )
            )
          },
          1000
        )

      return () =>
        window.clearTimeout(
          timer
        )
    },
    [secondsLeft]
  )

  const canConfirm =
    secondsLeft === 0

  return createPortal(
    <div
      className="penaltyConfirmOverlay"
      onClick={onCancel}
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
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="penaltyConfirmButton endSessionConfirmButton"
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) {
                return
              }

              void onConfirm()
            }}
          >
            {canConfirm
              ? 'End Session'
              : `End Session (${secondsLeft})`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}


function BlockedDeletePlayerModal({
  playerName,
  onClose,
}: {
  playerName: string
  onClose: () => void
}) {
  useViewportModalLock()

  return createPortal(
    <div
      className="playerEditorOverlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="playerEditorDialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-blocked-title"
        aria-describedby="delete-blocked-description"
        onClick={(event) =>
          event.stopPropagation()
        }
        style={{
          position: 'relative',
          width: 'min(100%, 430px)',
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            display: 'grid',
            placeItems: 'center',
            width: 34,
            height: 34,
            padding: 0,
            border:
              '1px solid #36404d',
            borderRadius: 10,
            background: '#1c232d',
            color: '#9eabb9',
            fontSize: 20,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <span
          className="playerEditorLabel"
          style={{
            color: '#ef99a4',
          }}
        >
          DELETE BLOCKED
        </span>

        <h2
          id="delete-blocked-title"
          style={{
            marginRight: 42,
          }}
        >
          {playerName}{' '}
          can’t be deleted
        </h2>

        <p
          id="delete-blocked-description"
          className="playerEditorNote"
          style={{
            marginBottom: 22,
            lineHeight: 1.55,
          }}
        >
          This player already has game
          history. Keeping the player
          preserves past sessions,
          statistics and awards.
        </p>

        <div className="playerEditorActions">
          <button
            type="button"
            className="playerEditorSave"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}


function SessionAliasPicker({
  mainName,
  options,
  value,
  onChange,
}: {
  mainName: string
  options: string[]
  value: string
  onChange: (
    value: string
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
          event.key ===
          'Escape'
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

  function isMainName(
    name: string
  ) {
    return (
      name.toLowerCase() ===
      mainName.toLowerCase()
    )
  }

  return (
    <div
      className="sessionAliasPicker"
      ref={rootRef}
    >
      <span className="sessionAliasLabel">
        PLAYING AS
      </span>

      <div className="sessionAliasControl">
        <button
          type="button"
          className={`sessionAliasTrigger ${
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
          <span className="sessionAliasCurrent">
            {value}
          </span>

          <span
            className="sessionAliasChevron"
            aria-hidden="true"
          >
            {open
              ? '▴'
              : '▾'}
          </span>
        </button>

        {open && (
          <div
            className="sessionAliasMenu"
            role="listbox"
            aria-label="Choose session display name"
          >
            {options.map(
              (name) => {
                const selected =
                  name === value

                const main =
                  isMainName(
                    name
                  )

                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={
                      selected
                    }
                    className={`sessionAliasOption ${
                      selected
                        ? 'selected'
                        : ''
                    }`}
                    key={name}
                    onClick={() => {
                      onChange(
                        name
                      )

                      setOpen(
                        false
                      )
                    }}
                  >
                    <span className="sessionAliasCheck">
                      {selected
                        ? '✓'
                        : ''}
                    </span>

                    <strong>
                      {name}
                    </strong>

                    <small>
                      {main
                        ? 'MAIN NAME'
                        : 'NICKNAME'}
                    </small>
                  </button>
                )
              }
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ExitHint({
  visible,
}: {
  visible: boolean
}) {
  if (!visible) {
    return null
  }

  return (
    <div
      className="androidExitHint"
      role="status"
      aria-live="polite"
    >
      Press Back again to exit
    </div>
  )
}

function LaunchIntro() {
  return createPortal(
    <div
      className="launchIntro"
      aria-hidden="true"
    >
      <div className="launchIntroBrand">
        <img
          className="launchIntroCardLogo"
          src={`${import.meta.env.BASE_URL}Jim_Card.svg`}
          alt=""
        />

        <img
          className="launchIntroJawiLogo"
          src={`${import.meta.env.BASE_URL}Jim_Jawi.svg`}
          alt=""
        />

        <strong className="jimramiLatin">
          JIMRAMI
        </strong>
      </div>
    </div>,
    document.body
  )
}

function App() {
  const [
    showLaunchIntro,
    setShowLaunchIntro,
  ] = useState(true)

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


  // Failed JIM attempts belong to the player who called JIM,
  // not to the player awarded scissors for catching them.
  const jimFailResults =
    useLiveQuery(
      async () => {
        if (!activeSession) return []

        const results = await db.jimResults
          .where('sessionId')
          .equals(activeSession.id)
          .toArray()

        return results.filter((result) => !result.won)
      },
      [activeSession?.id, activeSession?.roundNumber]
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
    goalpostChoice,
    setGoalpostChoice,
  ] = useState<
    | 'open'
    | '21'
    | '31'
    | '41'
    | '51'
    | 'custom'
  >('open')

  const [
    customGoalpost,
    setCustomGoalpost,
  ] = useState('61')

  const [
    goalpostPrompt,
    setGoalpostPrompt,
  ] =
    useState<GoalpostPrompt | null>(
      null
    )

  const [
    postGame,
    setPostGame,
  ] = useState<{
    session: GameSession
    sessionPlayers:
      SessionPlayer[]
    jimResults: JimResult[]
  } | null>(null)

  const [
    postGameView,
    setPostGameView,
  ] = useState<
    'summary' |
    'race' |
    'awards'
  >('summary')

  // Fireworks run only on the first view after a session is finished.
  const [celebrationSessionId, setCelebrationSessionId] = useState<number | null>(null)

  // Returning from Awards/Title Race must not restart the celebration.
  useEffect(() => {
    if (postGameView !== 'summary') setCelebrationSessionId(null)
  }, [postGameView])

  const goalpostEvaluationRunning =
    useRef(false)

  /*
    ScoreTransition can be skipped before the
    Dexie live query has repainted App with the
    newly-saved scores. Keep the transition's
    authoritative AFTER snapshot long enough for
    Goalpost / Deuce evaluation to run.
  */
  const [
    goalpostEvaluationPlayers,
    setGoalpostEvaluationPlayers,
  ] = useState<
    SessionPlayer[] | null
  >(null)


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

  // Reveal Edit Player only after its voice storage/recording lookup is complete.
  // Otherwise the newly added voice controls move the centered dialog on entry.
  const [playerEditorReady, setPlayerEditorReady] = useState(false)

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
    blockedDeletePlayer,
    setBlockedDeletePlayer,
  ] = useState<string | null>(
    null
  )

  const [
    showExitHint,
    setShowExitHint,
  ] = useState(false)

  const exitBackDeadline =
    useRef(0)

  const exitHintTimer =
    useRef<number | null>(
      null
    )

  const [
  transitionData,
  setTransitionData,
] =
  useState<
    ScoreTransitionData | null
  >(null)

  const [
    transitionLeaving,
    setTransitionLeaving,
  ] = useState(false)

  const transitionExitRunning =
    useRef(false)

  const transitionExitTimer =
    useRef<number | null>(
      null
    )

  const customGoalpostNumber =
    Number(customGoalpost)

  const customGoalpostValid =
    Number.isInteger(
      customGoalpostNumber
    ) &&
    customGoalpostNumber > 0

  const selectedGoalpost =
    goalpostChoice === 'open'
      ? undefined
      : goalpostChoice ===
          'custom'
        ? customGoalpostValid
          ? customGoalpostNumber
          : undefined
        : Number(
            goalpostChoice
          )

  const goalpostSelectionValid =
    goalpostChoice !==
      'custom' ||
    customGoalpostValid

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

    setPlayerEditorReady(false)
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
    setPlayerEditorReady(false)
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
      const player =
        players?.find(
          (entry) =>
            entry.id === id
        )

      setBlockedDeletePlayer(
        player?.name ??
          'This player'
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
      !players ||
      !goalpostSelectionValid
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

            goalpostInitial:
              selectedGoalpost,

            goalpostCurrent:
              selectedGoalpost,

            goalpostEvents: [],
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
    setGoalpostChoice('open')
    setCustomGoalpost('61')
    setScreen('scoreboard')
  }

  async function endSession() {
    if (!activeSession) {
      return
    }

    // Manual End Session (including an open goalpost)
    // must display the same final standings page as
    // finishing through the goalpost prompt.
    const sessionId = activeSession.id
    const [fresh, finalPlayers, finalJimResults] =
      await Promise.all([
        db.sessions.get(sessionId),
        db.sessionPlayers
          .where('sessionId')
          .equals(sessionId)
          .toArray(),
        db.jimResults
          .where('sessionId')
          .equals(sessionId)
          .toArray(),
      ])

    if (!fresh) {
      return
    }

    const endedAt = new Date()
    const finishedSession: GameSession = {
      ...fresh,
      status: 'ended',
      endedAt,
    }

    await db.sessions.update(sessionId, {
      status: 'ended',
      endedAt,
    })

    setShowEndSessionConfirm(false)
    setGoalpostPrompt(null)
    setCelebrationSessionId(sessionId)
    setPostGame({
      session: finishedSession,
      sessionPlayers: finalPlayers,
      jimResults: finalJimResults,
    })
    setPostGameView('summary')
    setScreen('scoreboard')
  }

  const goalpostScoreSource =
    goalpostEvaluationPlayers ??
    sessionPlayers

  const scoreSignature =
    goalpostScoreSource
      ?.map(
        (player) =>
          `${player.playerId}:${player.points}`
      )
      .join('|') ?? ''

  const goalpostEventSignature =
    activeSession?.goalpostEvents
      ?.map(
        (event) =>
          `${event.target}:${event.roundReached}:${event.outcome ?? 'pending'}:${event.extendedTo ?? ''}`
      )
      .join('|') ?? ''

  useEffect(
    () => {
      if (
        !activeSession ||
        !goalpostScoreSource ||
        screen !==
          'scoreboard' ||
        activeSession.goalpostCurrent ===
          undefined ||
        activeSession.roundNumber <=
          1 ||
        goalpostEvaluationRunning.current
      ) {
        return
      }

      /*
        Capture the values that were narrowed
        by the guard above before entering the
        async function. TypeScript does not keep
        those outer-variable guarantees across
        an async closure.
      */
      const sessionId =
        activeSession.id

      const currentSessionPlayers =
        goalpostScoreSource

      goalpostEvaluationRunning.current =
        true

      let cancelled = false

      async function evaluateGoalpost() {
        try {
          const fresh =
            await db.sessions.get(
              sessionId
            )

          if (
            cancelled ||
            !fresh ||
            fresh.status !==
              'active' ||
            fresh.goalpostCurrent ===
              undefined
          ) {
            return
          }

          const target =
            fresh.goalpostCurrent

          const events =
            fresh.goalpostEvents ??
            []

          const pending =
            [...events]
              .reverse()
              .find(
                (event) =>
                  event.target ===
                    target &&
                  event.outcome ===
                    undefined
              )

          if (pending) {
            setGoalpostPrompt({
              kind: 'reached',
              event: pending,
            })

            return
          }

          const ranking =
            [...currentSessionPlayers]
              .sort(
                (a, b) =>
                  b.points -
                    a.points ||
                  a.rotationOrder -
                    b.rotationOrder
              )

          const topScore =
            ranking[0]?.points ??
            0

          if (
            topScore <
            target
          ) {
            return
          }

          const topPlayers =
            ranking.filter(
              (player) =>
                player.points ===
                topScore
            )

          const completedRound =
            Math.max(
              0,
              fresh.roundNumber -
                1
            )

          const deuceStartedRound =
            fresh.goalpostDeuceStartedRound

          if (
            deuceStartedRound !==
            undefined
          ) {
            /*
              Deuce stays active until a later
              round produces one unique leader.

              If the next round is still tied,
              show the Deuce popup again for
              that new round instead of silently
              continuing.
            */
            if (
              topPlayers.length !==
              1
            ) {
              if (
                completedRound >
                  deuceStartedRound &&
                !cancelled
              ) {
                setGoalpostPrompt({
                  kind: 'deuce',
                  target,
                  round:
                    completedRound,
                  tiedPlayerIds:
                    topPlayers.map(
                      (player) =>
                        player.playerId
                    ),
                })
              }

              return
            }

            if (
              completedRound <=
              deuceStartedRound
            ) {
              return
            }

            const winner =
              topPlayers[0]

            const event:
              GoalpostEvent = {
                target,

                roundReached:
                  completedRound,

                winnerPlayerId:
                  winner.playerId,

                winnerPoints:
                  winner.points,

                deuceStartedRound,

                deuceResolvedRound:
                  completedRound,
              }

            await db.sessions.update(
              fresh.id,
              {
                goalpostEvents: [
                  ...events,
                  event,
                ],

                goalpostDeuceStartedRound:
                  undefined,
              }
            )

            if (
              !cancelled
            ) {
              setGoalpostPrompt({
                kind: 'reached',
                event,
              })
            }

            return
          }

          if (
            topPlayers.length >
            1
          ) {
            await db.sessions.update(
              fresh.id,
              {
                goalpostDeuceStartedRound:
                  completedRound,
              }
            )

            if (
              !cancelled
            ) {
              setGoalpostPrompt({
                kind: 'deuce',
                target,
                round:
                  completedRound,
                tiedPlayerIds:
                  topPlayers.map(
                    (player) =>
                      player.playerId
                  ),
              })
            }

            return
          }

          const winner =
            topPlayers[0]

          if (!winner) {
            return
          }

          const event:
            GoalpostEvent = {
              target,

              roundReached:
                completedRound,

              winnerPlayerId:
                winner.playerId,

              winnerPoints:
                winner.points,
            }

          await db.sessions.update(
            fresh.id,
            {
              goalpostEvents: [
                ...events,
                event,
              ],
            }
          )

          if (
            !cancelled
          ) {
            setGoalpostPrompt({
              kind: 'reached',
              event,
            })
          }
        } finally {
          goalpostEvaluationRunning.current =
            false

          setGoalpostEvaluationPlayers(
            null
          )
        }
      }

      void evaluateGoalpost()

      return () => {
        cancelled = true
      }
    },
    [
      activeSession?.id,
      activeSession?.roundNumber,
      activeSession?.goalpostCurrent,
      activeSession?.goalpostDeuceStartedRound,
      goalpostEventSignature,
      scoreSignature,
      goalpostEvaluationPlayers,
      screen,
    ]
  )

  async function extendGoalpost(
    nextTarget: number
  ) {
    if (
      !activeSession ||
      !sessionPlayers
    ) {
      return
    }

    const fresh =
      await db.sessions.get(
        activeSession.id
      )

    if (!fresh) {
      return
    }

    const events =
      fresh.goalpostEvents ??
      []

    let pendingIndex = -1

    for (
      let index =
        events.length - 1;
      index >= 0;
      index--
    ) {
      const event =
        events[index]

      if (
        event.target ===
          fresh.goalpostCurrent &&
        event.outcome ===
          undefined
      ) {
        pendingIndex =
          index
        break
      }
    }

    if (
      pendingIndex === -1
    ) {
      return
    }

    const topScore =
      Math.max(
        ...sessionPlayers.map(
          (player) =>
            player.points
        )
      )

    if (
      !Number.isInteger(
        nextTarget
      ) ||
      nextTarget <=
        Math.max(
          fresh.goalpostCurrent ??
            0,
          topScore
        )
    ) {
      return
    }

    const nextEvents =
      events.map(
        (event, index) =>
          index === pendingIndex
            ? {
                ...event,
                outcome:
                  'extended' as const,
                extendedTo:
                  nextTarget,
              }
            : event
      )

    await db.sessions.update(
      fresh.id,
      {
        goalpostCurrent:
          nextTarget,

        goalpostEvents:
          nextEvents,

        goalpostDeuceStartedRound:
          undefined,
      }
    )

    setGoalpostPrompt(null)
  }

  async function finishGoalpostSession() {
    if (
      !activeSession ||
      !sessionPlayers
    ) {
      return
    }

    const fresh =
      await db.sessions.get(
        activeSession.id
      )

    if (!fresh) {
      return
    }

    const events =
      fresh.goalpostEvents ??
      []

    let pendingIndex = -1

    for (
      let index =
        events.length - 1;
      index >= 0;
      index--
    ) {
      const event =
        events[index]

      if (
        event.target ===
          fresh.goalpostCurrent &&
        event.outcome ===
          undefined
      ) {
        pendingIndex =
          index
        break
      }
    }

    if (
      pendingIndex === -1
    ) {
      return
    }

    const nextEvents =
      events.map(
        (event, index) =>
          index === pendingIndex
            ? {
                ...event,
                outcome:
                  'finished' as const,
              }
            : event
      )

    const endedAt =
      new Date()

    const allJimResults =
      await db.jimResults
        .where('sessionId')
        .equals(
          fresh.id
        )
        .toArray()

    const finishedSession:
      GameSession = {
        ...fresh,
        status: 'ended',
        endedAt,
        goalpostEvents:
          nextEvents,
        goalpostDeuceStartedRound:
          undefined,
      }

    setCelebrationSessionId(fresh.id)
    setPostGame({
      session:
        finishedSession,

      sessionPlayers:
        sessionPlayers.map(
          (player) => ({
            ...player,
          })
        ),

      jimResults:
        allJimResults,
    })

    setPostGameView(
      'summary'
    )

    setGoalpostPrompt(null)

    await db.sessions.update(
      fresh.id,
      {
        status: 'ended',
        endedAt,

        goalpostEvents:
          nextEvents,

        goalpostDeuceStartedRound:
          undefined,
      }
    )
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

  /*
    Android system Back button.

    Priority:
    1. Close temporary overlays/panels.
    2. Return sub-pages to their parent screen.
    3. Do not interrupt score transitions or a
       required Goalpost decision.
    4. At the root screen, let Back exit the app.
  */
  useEffect(
    () => {
      const timer =
        window.setTimeout(
          () => {
            setShowLaunchIntro(
              false
            )
          },
          1700
        )

      return () => {
        window.clearTimeout(
          timer
        )
      }
    },
    []
  )

  useEffect(
    () => {
      return () => {
        if (
          exitHintTimer.current !==
          null
        ) {
          window.clearTimeout(
            exitHintTimer.current
          )
        }

        if (
          transitionExitTimer.current !==
          null
        ) {
          window.clearTimeout(
            transitionExitTimer.current
          )
        }
      }
    },
    []
  )

  useEffect(
    () => {
      let listener:
        | {
            remove: () =>
              Promise<void>
          }
        | undefined

      void CapacitorApp.addListener(
        'backButton',
        () => {
          /*
            Give the currently mounted child
            screen first chance to handle Back.

            Example:
            Session Awards -> Sessions,
            Round Editor -> Round Details,
            Title Race -> Sessions.

            If a child handles it, it calls
            preventDefault() on this event.
          */
          const childBackEvent =
            new Event(
              'jimrami-back-request',
              {
                cancelable: true,
              }
            )

          window.dispatchEvent(
            childBackEvent
          )

          if (
            childBackEvent.defaultPrevented
          ) {
            return
          }

          if (showDataTools) {
            setShowDataTools(false)
            return
          }

          if (
            editingPlayerId !== null
          ) {
            closePlayerEditor()
            return
          }

          if (
            blockedDeletePlayer !== null
          ) {
            setBlockedDeletePlayer(
              null
            )
            return
          }

          if (
            showEndSessionConfirm
          ) {
            setShowEndSessionConfirm(
              false
            )
            return
          }

          if (goalpostPrompt) {
            /*
              Deuce can safely return to
              the scoreboard because the
              session remains in Deuce.

              A reached Goalpost requires
              a Finish / Extend decision,
              so Back is intentionally
              ignored there.
            */
            if (
              goalpostPrompt.kind ===
              'deuce'
            ) {
              setGoalpostPrompt(null)
            }

            return
          }

          if (postGame) {
            if (
              postGameView !==
              'summary'
            ) {
              setPostGameView(
                'summary'
              )
              return
            }

            setPostGame(null)
            setPostGameView(
              'summary'
            )
            setScreen(
              'scoreboard'
            )
            return
          }

          if (
            screen === 'history'
          ) {
            setScreen('scoreboard')
            return
          }

          if (
            activeSession &&
            (
              screen ===
                'standard' ||
              screen === 'jim' ||
              screen === 'race' ||
              screen ===
                'penalty'
            )
          ) {
            setScreen('scoreboard')
            return
          }

          /*
            Never interrupt the animated
            score transition. It finishes
            itself and returns safely.
          */
          if (
            screen ===
            'transition'
          ) {
            return
          }

          /*
            Root/new-session or active-session
            scoreboard: require two Back presses
            within 2 seconds before exiting.
          */
          const now = Date.now()

          if (
            now <
            exitBackDeadline.current
          ) {
            exitBackDeadline.current = 0

            if (
              exitHintTimer.current !==
              null
            ) {
              window.clearTimeout(
                exitHintTimer.current
              )

              exitHintTimer.current =
                null
            }

            setShowExitHint(false)

            void CapacitorApp.exitApp()
            return
          }

          exitBackDeadline.current =
            now + 2000

          setShowExitHint(true)

          if (
            exitHintTimer.current !==
            null
          ) {
            window.clearTimeout(
              exitHintTimer.current
            )
          }

          exitHintTimer.current =
            window.setTimeout(
              () => {
                setShowExitHint(
                  false
                )

                exitBackDeadline.current =
                  0

                exitHintTimer.current =
                  null
              },
              2000
            )
        }
      ).then((handle) => {
        listener = handle
      })

      return () => {
        if (listener) {
          void listener.remove()
        }
      }
    },
    [
      activeSession,
      blockedDeletePlayer,
      editingPlayerId,
      goalpostPrompt,
      postGame,
      postGameView,
      screen,
      showDataTools,
      showEndSessionConfirm,
    ]
  )

  if (
    postGame &&
    players
  ) {
    const postGameDisplayPlayers =
      players.map(
        (player) => {
          const sessionPlayer =
            postGame.sessionPlayers.find(
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
      )

    const postGameRanking =
      [...postGame.sessionPlayers]
        .sort(
          (a, b) =>
            b.points -
              a.points ||
            a.rotationOrder -
              b.rotationOrder
        )
        .map(
          (player) => ({
            playerId:
              player.playerId,

            name:
              postGameDisplayPlayers.find(
                (entry) =>
                  entry.id ===
                  player.playerId
              )?.name ??
              'Unknown',

            points:
              player.points,

            standardWins:
              player.wins,

            jimWins:
              postGame.jimResults.filter(
                (result) =>
                  result.won &&
                  result.jimPlayerId ===
                    player.playerId
              ),

            catches:
              postGame.jimResults.filter(
                (result) =>
                  result.caughtByPlayerId ===
                    player.playerId
              ),

            failures:
              postGame.jimResults.filter(
                (result) =>
                  !result.won &&
                  result.jimPlayerId === player.playerId
              ),
          })
        )

    if (
      postGameView ===
      'race'
    ) {
      return (
        <TitleRace
          key={`postgame-race-${postGame.session.id}`}
          session={
            postGame.session
          }
          sessionPlayers={
            postGame.sessionPlayers
          }
          players={
            postGameDisplayPlayers
          }
          onBack={() =>
            setPostGameView(
              'summary'
            )
          }
        />
      )
    }

    if (
      postGameView ===
      'awards'
    ) {
      return (
        <HistoryStats
          key={`postgame-awards-${postGame.session.id}`}
          players={players}
          initialAwardSessionId={
            postGame.session.id
          }
          onBack={() =>
            setPostGameView(
              'summary'
            )
          }
        />
      )
    }

    return (
      <GoalpostSessionComplete
        key={`postgame-summary-${postGame.session.id}`}
        session={
          postGame.session
        }
        ranking={
          postGameRanking
        }
        showFireworks={celebrationSessionId === postGame.session.id}
        onAwards={() => {
          setCelebrationSessionId(null)
          setPostGameView('awards')
        }}
        onRace={() => {
          setCelebrationSessionId(null)
          setPostGameView('race')
        }}
        onDone={() => {
          setCelebrationSessionId(null)
          setPostGame(null)
          setPostGameView(
            'summary'
          )
          setScreen(
            'scoreboard'
          )
        }}
      />
    )
  }

  if (
    screen === 'history' &&
    players
  ) {
    return (
      <HistoryStats
        key="history"
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
          key={`standard-${activeSession.id}`}
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
            transitionExitRunning.current =
              false
            setTransitionLeaving(false)
            setTransitionData(data)
            setScreen('transition')
          }}
        />
      )
    }

    if (screen === 'jim') {
  return (
    <JimRound
      key={`jim-${activeSession.id}`}
      session={activeSession}
      sessionPlayers={sessionPlayers}
      players={activeDisplayPlayers}
      onBack={() =>
        setScreen('scoreboard')
      }
       onComplete={(data) => {
      transitionExitRunning.current =
        false
      setTransitionLeaving(false)
      setTransitionData(data)
      setScreen('transition')
  }}
    />
  )
}

if (screen === 'race') {
  return (
    <TitleRace
      key={`race-${activeSession.id}`}
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
    <div
      className={`scoreTransitionShell ${
        transitionLeaving
          ? 'leaving'
          : ''
      }`}
    >
      <ScoreTransition
        key={`transition-${activeSession.id}-${activeSession.roundNumber}`}
        data={transitionData}
        players={activeDisplayPlayers}
        jimWins={jimWinResults}
        jimCatches={jimCatchResults}
        jimFails={jimFailResults}
        onDone={() => {
          if (
            transitionExitRunning.current
          ) {
            return
          }

          transitionExitRunning.current =
            true
          setTransitionLeaving(true)

          const completedData =
            transitionData

          transitionExitTimer.current =
            window.setTimeout(
              () => {
                setGoalpostEvaluationPlayers(
                  completedData.after.map(
                    (player) => ({
                      ...player,
                    })
                  )
                )

                setTransitionData(null)
                setScreen('scoreboard')
                setTransitionLeaving(
                  false
                )

                transitionExitRunning.current =
                  false
                transitionExitTimer.current =
                  null
              },
              160
            )
        }}
      />
    </div>
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
      key={`penalty-${activeSession.id}`}
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
        transitionExitRunning.current =
          false
        setTransitionLeaving(false)

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
      <main
        className="app"
        key={`scoreboard-${activeSession.id}`}
      >
        <header className="gameHeader gameHeaderPolished">
          <div className="gameRoundArea">
            <LiveClock />

            {activeSession.goalpostCurrent !==
              undefined && (
              <div
                className={`gameGoalpostChip ${
                  activeSession.goalpostDeuceStartedRound !==
                  undefined
                    ? 'deuce'
                    : ''
                }`}
              >
                <span>
                  {activeSession.goalpostDeuceStartedRound !==
                  undefined
                    ? 'DEUCE'
                    : 'GOALPOST'}
                </span>

                <strong>
                  {
                    activeSession.goalpostCurrent
                  }
                </strong>
              </div>
            )}

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
      className="jimramiCardLogo"
      src={`${import.meta.env.BASE_URL}Jim_Card.svg`}
      alt=""
    />

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

              const playerJimFails =
                jimFailResults.filter(
                  (result) =>
                    result.jimPlayerId ===
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
                          0 ||
                        playerJimFails.length >
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

                          <JimFailSkulls failures={playerJimFails} />
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
            <span className="gameActionContent">
              <span
                className="gameActionIcon standardActionIcon"
                aria-hidden="true"
              />

              <span className="gameActionLabel">
                Standard Round
              </span>
            </span>
          </button>

          <button
            className="jimAction"
            onClick={() =>
              setScreen('jim')
            }
          >
            <span className="gameActionContent">
              <span
                className="gameActionIcon jimActionIcon"
                aria-hidden="true"
              >
                ★
              </span>

              <span className="gameActionLabel">
                Jim Round
              </span>
            </span>
          </button>

          <button
            className="raceAction"
            onClick={() =>
              setScreen('race')
            }
          >
            <span className="gameActionContent">
              <span
                className="gameActionIcon raceActionIcon"
                aria-hidden="true"
              >
                ⚑
              </span>

              <span className="gameActionLabel">
                Title Race
              </span>
            </span>
          </button>

          <button
            className="penaltyAction"
            onClick={() =>
              setScreen('penalty')
            }
          >
            <span className="gameActionContent">
              <span
                className="gameActionIcon penaltyActionIcon"
                aria-hidden="true"
              >
                −1
              </span>

              <span className="gameActionLabel">
                Penalty
              </span>
            </span>
          </button>
        </footer>
        {goalpostPrompt?.kind ===
          'deuce' && (
          <GoalpostDeuceModal
            target={
              goalpostPrompt.target
            }
            round={
              goalpostPrompt.round
            }
            tiedPlayers={
              ranking
                .filter(
                  (player) =>
                    goalpostPrompt.tiedPlayerIds.includes(
                      player.playerId
                    )
                )
                .map(
                  (player) => ({
                    playerId:
                      player.playerId,

                    name:
                      getPlayerName(
                        player.playerId
                      ),

                    points:
                      player.points,

                    standardWins:
                      player.wins,

                    jimWins:
                      jimWinResults.filter(
                        (result) =>
                          result.jimPlayerId ===
                          player.playerId
                      ),

                    catches:
                      jimCatchResults.filter(
                        (result) =>
                          result.caughtByPlayerId ===
                          player.playerId
                      ),

                    failures:
                      jimFailResults.filter(
                        (result) =>
                          result.jimPlayerId === player.playerId
                      ),
                  })
                )
            }
            onContinue={() =>
              setGoalpostPrompt(
                null
              )
            }
          />
        )}

        {goalpostPrompt?.kind ===
          'reached' && (
          <GoalpostReachedModal
            event={
              goalpostPrompt.event
            }
            ranking={
              ranking.map(
                (player) => ({
                  playerId:
                    player.playerId,

                  name:
                    getPlayerName(
                      player.playerId
                    ),

                  points:
                    player.points,

                  standardWins:
                    player.wins,

                  jimWins:
                    jimWinResults.filter(
                      (result) =>
                        result.jimPlayerId ===
                        player.playerId
                    ),

                  catches:
                    jimCatchResults.filter(
                      (result) =>
                        result.caughtByPlayerId ===
                        player.playerId
                    ),

                  failures:
                    jimFailResults.filter(
                      (result) =>
                        result.jimPlayerId === player.playerId
                    ),
                })
              )
            }
            onExtend={(
              target
            ) =>
              void extendGoalpost(
                target
              )
            }
            onFinish={() =>
              void finishGoalpostSession()
            }
          />
        )}

        {showEndSessionConfirm && (
          <EndSessionConfirmModal
            onCancel={() =>
              setShowEndSessionConfirm(
                false
              )
            }
            onConfirm={endSession}
          />
        )}

        {showDataTools && (
  <DataTools
    onClose={() =>
      setShowDataTools(false)
    }
  />
)}

        {showLaunchIntro && (
          <LaunchIntro />
        )}

        <ExitHint
          visible={showExitHint}
        />
      </main>
    )
  }

  /* ---------------------------
     NEW SESSION
  ---------------------------- */

  return (
    <main
      className="app"
      key="new-session"
    >
     <header className="setupHeader">
<h1 className="jimramiBrandLockup">
  <img
    className="jimramiCardLogo"
    src={`${import.meta.env.BASE_URL}Jim_Card.svg`}
    alt=""
  />

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
                  <SessionAliasPicker
                    mainName={
                      player.name
                    }
                    options={
                      nameOptions
                    }
                    value={
                      sessionName
                    }
                    onChange={
                      (name) =>
                        setSessionDisplayName(
                          player.id,
                          name
                        )
                    }
                  />
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

      <section className="goalpostSetup">
        <div className="goalpostSetupHeader">
          <div>
            <span>
              GOALPOST
            </span>

            <strong>
              {selectedGoalpost ===
              undefined
                ? 'Open Post'
                : `Target ${selectedGoalpost}`}
            </strong>
          </div>

          <small>
            A tied first place at
            the target becomes Deuce.
          </small>
        </div>

        <div className="goalpostPresetGrid">
          <button
            type="button"
            className={
              goalpostChoice ===
              'open'
                ? 'selected'
                : ''
            }
            onClick={() =>
              setGoalpostChoice(
                'open'
              )
            }
          >
            Open
          </button>

          {[
            '21',
            '31',
            '41',
            '51',
          ].map(
            (target) => (
              <button
                type="button"
                className={
                  goalpostChoice ===
                  target
                    ? 'selected'
                    : ''
                }
                key={target}
                onClick={() =>
                  setGoalpostChoice(
                    target as
                      | '21'
                      | '31'
                      | '41'
                      | '51'
                  )
                }
              >
                {target}
              </button>
            )
          )}

          <button
            type="button"
            className={
              goalpostChoice ===
              'custom'
                ? 'selected'
                : ''
            }
            onClick={() =>
              setGoalpostChoice(
                'custom'
              )
            }
          >
            Custom
          </button>
        </div>

        {goalpostChoice ===
          'custom' && (
          <div className="goalpostCustomSetup">
            <span>
              CUSTOM TARGET
            </span>

            <input
              type="number"
              min="1"
              step="1"
              value={
                customGoalpost
              }
              onChange={(
                event
              ) =>
                setCustomGoalpost(
                  event.target.value
                )
              }
            />

            {!customGoalpostValid && (
              <small>
                Enter a whole
                number above 0.
              </small>
            )}
          </div>
        )}
      </section>

      <button
        className="startSession"
        disabled={
          selectedIds.length <
            4 ||
          !goalpostSelectionValid
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
          : !goalpostSelectionValid
            ? 'Enter Goalpost'
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
        <div
          className="playerEditorOverlay"
          style={{
            visibility: playerEditorReady ? 'visible' : 'hidden',
            opacity: playerEditorReady ? 1 : 0,
            transition: 'opacity 140ms ease-out',
          }}
        >
          <PlayerEditorScrollLock />
          <div className="playerEditorDialog">
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

            {players?.find(player => player.id === editingPlayerId) && (
              <JimVoiceRecorder
                key={editingPlayerId}
                player={players.find(player => player.id === editingPlayerId)!}
                onReady={setPlayerEditorReady}
              />
            )}

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

      {blockedDeletePlayer && (
        <BlockedDeletePlayerModal
          playerName={
            blockedDeletePlayer
          }
          onClose={() =>
            setBlockedDeletePlayer(
              null
            )
          }
        />
      )}

      {showLaunchIntro && (
        <LaunchIntro />
      )}

      <ExitHint
        visible={showExitHint}
      />
    </main>
  )
}

export default App