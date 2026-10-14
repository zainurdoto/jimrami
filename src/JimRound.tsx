import { getJimVoiceUrl, getJimVoiceWaveform } from './lib/jimVoice'
import { getJimSoundEnabled, JimSoundEngine, saveJimSoundEnabled } from './lib/JimSound'
import './jimSound.css'
import { useEffect, useRef, useState } from 'react'

// Start loading AND decoding the JIM emblem when this module is imported.
// App.tsx imports JimRound at startup, so the SVG is normally ready
// before anyone opens the JIM stage screen.
const JIM_MODE_SVG_URL = `${import.meta.env.BASE_URL}Jim_Mode.svg`
const preloadedJimEmblem = typeof Image !== 'undefined' ? new Image() : null
if (preloadedJimEmblem) {
  preloadedJimEmblem.src = JIM_MODE_SVG_URL
  void preloadedJimEmblem.decode?.().catch(() => {
    // Rendering the regular <img> still works if pre-decoding fails.
  })
}

import {
  db,
  type GameSession,
  type Player,
  type SessionPlayer,
} from './db'

import {
  type ScoreTransitionData,
} from './ScoreTransition'

type Props = {
  session: GameSession
  sessionPlayers: SessionPlayer[]
  players: Player[]
  onBack: () => void

  onComplete: (
    data: ScoreTransitionData
  ) => void
}

type Phase =
  | 'choose'
  | 'running'
  | 'caught'
  | 'win'


type JimProgressWheelProps = {
  stepsSurvived: number
  currentStage: number
  hideStage: number | null
  outcome?: 'win' | 'caught'
  caughtTintActive?: boolean
}

function wheelPoint(
  radius: number,
  angleDegrees: number
) {
  const angle =
    ((angleDegrees - 90) *
      Math.PI) /
    180

  return {
    x:
      150 +
      radius * Math.cos(angle),

    y:
      150 +
      radius * Math.sin(angle),
  }
}

function wheelArc(
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start =
    wheelPoint(radius, endAngle)

  const end =
    wheelPoint(radius, startAngle)

  const largeArcFlag =
    endAngle - startAngle <= 180
      ? 0
      : 1

  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ')
}

function JimProgressWheel({
  stepsSurvived,
  currentStage,
  hideStage,
  outcome,
  caughtTintActive = false,
}: JimProgressWheelProps) {
  /*
    Stage 1 begins at the upper-left
    and the sequence travels around
    the Jim emblem toward Stage 6.
  */
  const stageAngles = [
    -60,
    -120,
    180,
    120,
    60,
    0,
  ]

  const progressLabel =
    outcome === 'win'
      ? 'JIM SURVIVED'
      : outcome === 'caught'
        ? 'JIM CAUGHT'
        : 'SURVIVED'

  return (
    <div className="jimWheelWrap">
      <div
        className={[
          'jimWheel',
          outcome === 'win'
            ? 'outcome-win'
            : '',
          outcome === 'caught'
            ? 'outcome-caught'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={
          outcome === 'win'
            ? 'Jim survived all 6 stages'
            : outcome === 'caught'
              ? `Jim was caught at Stage ${currentStage} after surviving ${stepsSurvived} stages`
              : `Jim survived ${stepsSurvived} of 6 stages`
        }
      >
        <svg
          className="jimWheelRing"
          viewBox="0 0 300 300"
          aria-hidden="true"
        >
          {/* Draw all six arcs first. Only survival makes a segment gold. */}
          {stageAngles.map((centerAngle, index) => {
            const stage = index + 1
            const survived = stage <= stepsSurvived
            const hidden = stage === hideStage
            const failed = outcome === 'caught' && stage === currentStage

            return (
              <g key={`arc-${stage}`}>
                {hidden && (
                  <path
                    className="jimWheelHideOutline"
                    d={wheelArc(118, centerAngle - 23.2, centerAngle + 23.2)}
                  />
                )}
                <path
                  className={[
                    'jimWheelSegment',
                    survived ? 'survived' : '',
                    failed ? 'failed' : '',
                  ].filter(Boolean).join(' ')}
                  d={wheelArc(118, centerAngle - 22, centerAngle + 22)}
                />
              </g>
            )
          })}

          {/* Labels render AFTER the arcs so the active number stays visible.
              The underline, not the segment colour, marks the current stage. */}
          {stageAngles.map((centerAngle, index) => {
            const stage = index + 1
            const survived = stage <= stepsSurvived
            const hidden = stage === hideStage
            const failed = outcome === 'caught' && stage === currentStage
            const active = stage === currentStage && !outcome
            // Position every stage number at the same distance from the
            // wheel center, including Stage 3 at the bottom.
            const labelRadius = 152
            const label = wheelPoint(labelRadius, centerAngle)

            return (
              <g key={`label-${stage}`}>
                <text
                  className={[
                    'jimWheelNumber',
                    survived ? 'survived' : '',
                    hidden ? 'hidden' : '',
                    failed ? 'failed' : '',
                  ].filter(Boolean).join(' ')}
                  x={label.x}
                  y={label.y}
                >
                  {stage}
                </text>
                {active && (
                  <line
                    className="jimWheelActiveUnderline"
                    x1={label.x - 6}
                    y1={label.y + 11}
                    x2={label.x + 6}
                    y2={label.y + 11}
                    stroke="#9aa6b5"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                )}
              </g>
            )
          })}
        </svg>

        <div
          className="jimModeEmblem"
          aria-hidden="true"
        >
          <img
            className="jimModeLogo jimModeLogoGhost"
            src={JIM_MODE_SVG_URL}
            alt=""
          />

          {Array.from(
            {
              length: stepsSurvived,
            },
            (_, index) => {
              const bandTop =
                100 -
                (index + 1) *
                  (100 / 6)

              const bandBottom =
                index * (100 / 6)

              return (
                <div key={index}>
                  <img
                    className="jimModeLogo jimModeLogoBand"
                    src={JIM_MODE_SVG_URL}
                    alt=""
                    style={{
                      clipPath:
                        `inset(${bandTop}% 0 ${bandBottom}% 0)`,
                    }}
                  />

                  {outcome === 'caught' && (
                    <span
                      className={[
                        'jimModeCaughtBandFade',
                        caughtTintActive
                          ? 'active'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <img
                        className="jimModeLogo jimModeLogoCaughtBand"
                        src={JIM_MODE_SVG_URL}
                        alt=""
                        style={{
                          clipPath:
                            `inset(${bandTop}% 0 ${bandBottom}% 0)`,
                        }}
                      />
                    </span>
                  )}
                </div>
              )
            }
          )}

          {outcome === 'win' && (
            <img
              className="jimModeLogo jimModeLogoWinTint"
              src={JIM_MODE_SVG_URL}
              alt=""
            />
          )}
        </div>
      </div>

      <div
        className={[
          'jimWheelProgress',
          outcome === 'win'
            ? 'win'
            : '',
          outcome === 'caught'
            ? 'caught'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span>
          {progressLabel}
        </span>

        <strong>
          {stepsSurvived}
          {' / '}
          6
        </strong>

        {outcome === 'win' && (
          <b className="jimWheelAward win">
            +7
          </b>
        )}

        {outcome === 'caught' && (
          <b className="jimWheelAward caught">
            -3
          </b>
        )}
      </div>
    </div>
  )
}


export default function JimRound({
  session,
  sessionPlayers,
  players,
  onBack,
  onComplete,
}: Props) {
  const [phase, setPhase] =
    useState<Phase>('choose')

  const [
    jimSessionPlayerId,
    setJimSessionPlayerId,
  ] =
    useState<number | null>(null)

  const [
    catcherSessionPlayerId,
    setCatcherSessionPlayerId,
  ] =
    useState<number | null>(null)

  const [
    outSessionPlayerId,
    setOutSessionPlayerId,
  ] =
    useState<number | null>(null)

  const [
    stepsSurvived,
    setStepsSurvived,
  ] =
    useState(0)

  /*
    null = Jim never used Hide.

    Otherwise this stores the stage
    where Hide was used: 2–6.
  */
  const [
    hideStage,
    setHideStage,
  ] =
    useState<number | null>(null)

  const [saving, setSaving] =
    useState(false)

  // Muting affects both the personal JIM shout and generated sound effects.
  // Persist only on this device: players can choose their own preferred volume.
  const [soundEnabled, setSoundEnabled] = useState(getJimSoundEnabled)

  // Show a cinematic intro only for a player who has a saved JIM recording.
  const [introPlayerId, setIntroPlayerId] = useState<number | null>(null)
  const [introNeedsTap, setIntroNeedsTap] = useState(false)
  const [introWaveform, setIntroWaveform] = useState<number[]>([])
  const [introProgress, setIntroProgress] = useState(0)
  const introPlayerRef = useRef<number | null>(null)
  const introAudio = useRef<HTMLAudioElement | null>(null)
  const introTimeout = useRef<number | null>(null)
  const introProgressFrame = useRef<number | null>(null)

  function stopIntroProgress() {
    if (introProgressFrame.current !== null) {
      cancelAnimationFrame(introProgressFrame.current)
      introProgressFrame.current = null
    }
  }

  function trackIntroProgress(recording: HTMLAudioElement) {
    stopIntroProgress()
    const update = () => {
      if (introAudio.current !== recording || introPlayerRef.current === null) return
      const duration = recording.duration
      if (Number.isFinite(duration) && duration > 0) {
        setIntroProgress(Math.max(0, Math.min(1, recording.currentTime / duration)))
      }
      if (!recording.paused && !recording.ended) {
        introProgressFrame.current = requestAnimationFrame(update)
      } else {
        introProgressFrame.current = null
      }
    }
    update()
  }

  const soundEngine = useRef<JimSoundEngine | null>(null)

  function engine() {
    if (!soundEngine.current) soundEngine.current = new JimSoundEngine()
    return soundEngine.current
  }

  // Download and decode drum recordings before the first JIM press.
  useEffect(() => {
    void engine().preload()
  }, [])

  // Stop all sound when navigating away, including in React Strict Mode.
  useEffect(() => () => {
    // Clear any pending intro callback if the round is closed mid-recording.
    if (introTimeout.current !== null) window.clearTimeout(introTimeout.current)
    if (introProgressFrame.current !== null) cancelAnimationFrame(introProgressFrame.current)
    introProgressFrame.current = null
    if (introAudio.current) {
      introAudio.current.onended = null
      introAudio.current.onerror = null
      introAudio.current.onplay = null
      introAudio.current.onpause = null
      introAudio.current.pause()
      introAudio.current = null
    }
    introPlayerRef.current = null
    soundEngine.current?.dispose()
    soundEngine.current = null
  }, [])

  const [
    caughtTintActive,
    setCaughtTintActive,
  ] =
    useState(false)

  /*
    Enter the caught screen first in its
    normal white state, then flip this
    flag on a moment later. That gives
    CSS a real before/after state to
    transition between.
  */
  useEffect(() => {
    if (phase !== 'caught') {
      setCaughtTintActive(false)
      return
    }

    setCaughtTintActive(false)

    const timer =
      window.setTimeout(
        () => {
          setCaughtTintActive(true)
        },
        90
      )

    return () =>
      window.clearTimeout(timer)
  }, [phase])

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

  const jimPlayer =
    jimSessionPlayerId === null
      ? undefined
      : sessionPlayers.find(
          (player) =>
            player.id ===
            jimSessionPlayerId
        )

  /*
    If 0 stages have been survived,
    Jim is currently facing Stage 1.

    If 1 has been survived,
    Jim is currently facing Stage 2.

    etc.
  */
  const currentStage =
    Math.min(
      stepsSurvived + 1,
      6
    )

  function getName(
    playerId: number
  ) {
    return (
      players.find(
        (player) =>
          player.id === playerId
      )?.name ?? 'Unknown'
    )
  }

  // A Supabase signed-URL lookup is asynchronous. Keep the pending promises,
  // not only the loaded audio, so a player selected immediately after opening
  // JIM waits for their actual recording instead of being mistaken for silent.
  const jimSounds = useRef<Map<number, HTMLAudioElement>>(new Map())
  const voiceLookups = useRef<Map<number, Promise<HTMLAudioElement | null>>>(new Map())
  const voicePlayerKey = players.map(player => `${player.id}:${player.cloudId ?? ''}`).join('|')
  useEffect(() => {
    let cancelled = false
    const cache = jimSounds.current
    const pending = voiceLookups.current
    cache.clear()
    pending.clear()
    players.forEach(player => {
      const lookup = getJimVoiceUrl(player).then(url => {
        if (cancelled || !url) return null
        const audio = new Audio(url)
        audio.preload = 'auto'
        // Decode the high-resolution waveform while the player is being selected.
        // Playback never waits on the visualization.
        void getJimVoiceWaveform(url, 60)
        cache.set(player.id, audio)
        return audio
      }).catch(() => null) // Offline/missing sound: proceed without a shout.
      pending.set(player.id, lookup)
    })
    return () => {
      cancelled = true
      cache.forEach(audio => audio.pause())
      cache.clear()
      pending.clear()
    }
  }, [voicePlayerKey])

  function pausePersonalVoices() {
    jimSounds.current.forEach(sound => {
      sound.pause()
      sound.currentTime = 0
    })
  }

  function clearIntro() {
    // Remove handlers BEFORE pausing, so a skipped recording cannot advance twice.
    introPlayerRef.current = null
    if (introTimeout.current !== null) window.clearTimeout(introTimeout.current)
    introTimeout.current = null
    stopIntroProgress()
    const audio = introAudio.current
    introAudio.current = null
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.onplay = null
      audio.onpause = null
      audio.pause()
      audio.currentTime = 0
    }
    setIntroPlayerId(null)
    setIntroNeedsTap(false)
    setIntroWaveform([])
    setIntroProgress(0)
  }

  function beginStages(withSound: boolean) {
    clearIntro()
    setPhase('running')
    if (withSound) engine().start(1)
  }

  function toggleSound() {
    const enabled = !soundEnabled
    setSoundEnabled(enabled)
    saveJimSoundEnabled(enabled)
    if (!enabled) {
      if (introPlayerRef.current !== null) beginStages(false)
      pausePersonalVoices()
      soundEngine.current?.stopAll()
    } else if (phase === 'running') {
      // This button tap also unlocks audio on mobile browsers / APK WebViews.
      engine().start(currentStage)
    }
  }

  function chooseJim(player: SessionPlayer) {
    if (introPlayerRef.current !== null) return

    pausePersonalVoices()
    soundEngine.current?.stopAll()
    setJimSessionPlayerId(player.id)
    setStepsSurvived(0)
    setHideStage(null)

    if (!soundEnabled) {
      beginStages(false)
      return
    }

    const cachedAudio = jimSounds.current.get(player.playerId)
    let pendingAudio = voiceLookups.current.get(player.playerId)
    if (!cachedAudio && !pendingAudio) {
      // Extra safeguard if the user taps before the preloading effect runs.
      const profile = players.find(p => p.id === player.playerId)
      if (profile) {
        pendingAudio = getJimVoiceUrl(profile).then(url => {
          if (!url) return null
          const audio = new Audio(url)
          audio.preload = 'auto'
          void getJimVoiceWaveform(url, 60)
          jimSounds.current.set(player.playerId, audio)
          return audio
        }).catch(() => null)
        voiceLookups.current.set(player.playerId, pendingAudio)
      }
    }
    if (!cachedAudio && !pendingAudio) {
      beginStages(true)
      return
    }

    // Unlock the drum engine on the actual player tap. Waiting for Supabase
    // must not be mistaken for "this player has no saved voice".
    engine().unlock()
    introPlayerRef.current = player.id
    setIntroPlayerId(player.id)
    setIntroNeedsTap(false)
    setIntroWaveform([])
    setIntroProgress(0)

    const done = () => {
      if (introPlayerRef.current === player.id) beginStages(true)
    }

    const playShout = (recording: HTMLAudioElement | null) => {
      if (introPlayerRef.current !== player.id) return // User skipped or left.
      if (!recording) {
        done() // Confirmed no saved recording.
        return
      }
      introAudio.current = recording
      void getJimVoiceWaveform(recording.src, 60).then(values => {
        if (introPlayerRef.current === player.id) setIntroWaveform(values)
      })
      recording.currentTime = 0
      recording.onended = done
      recording.onerror = done
      // Follow actual media playback, including a second tap on Android.
      recording.onplay = () => trackIntroProgress(recording)
      recording.onpause = stopIntroProgress
      void recording.play().then(() => {
        if (introPlayerRef.current === player.id) setIntroNeedsTap(false)
      }).catch((error: unknown) => {
        if (introPlayerRef.current !== player.id) return
        // Mobile WebViews can reject play() after an asynchronous cloud lookup.
        // Offer an explicit tap instead of silently discarding the JIM shout.
        if ((error as { name?: string } | null)?.name === 'NotAllowedError') {
          setIntroNeedsTap(true)
        } else {
          done()
        }
      })
    }

    // Failsafe for a stalled network. The modal also has a Skip button.
    introTimeout.current = window.setTimeout(done, 15000)
    if (cachedAudio) playShout(cachedAudio) // Synchronous user gesture.
    else void pendingAudio?.then(playShout, done)
  }

  function useHide() {
        if (
          phase !== 'running' ||
          hideStage !== null ||
          currentStage < 2 ||
          currentStage > 5
        ) {
          return
        }

    // Hide overlays an acoustic stealth cue; the gendang never stops.
    if (soundEnabled) engine().hide()
    setHideStage(
      currentStage
    )
  }

  function survivedNext() {
    if (phase !== 'running') {
      return
    }

    /*
      Surviving Stage 6 means
      Jim wins.
    */
    if (currentStage === 6) {
      pausePersonalVoices()
      if (soundEnabled) engine().win()
      else soundEngine.current?.stopAll()
      setStepsSurvived(6)
      setPhase('win')

      return
    }

    if (soundEnabled) soundEngine.current?.setStage(currentStage + 1)
    setStepsSurvived(
      (value) => value + 1
    )
  }

  function caughtJim() {
    if (phase !== 'running') return
    pausePersonalVoices()
    if (soundEnabled) engine().caught()
    else soundEngine.current?.stopAll()
    setPhase('caught')
  }

  function leaveJimRound() {
    clearIntro()
    pausePersonalVoices()
    soundEngine.current?.stopAll()
    onBack()
  }

  /*
    Rotation helper.

    If someone is waiting:
    - selected out player leaves
    - first waiting player enters
    - out player goes to back

    If nobody is waiting:
    nothing rotates.
  */
  function rotatePlayers(
    updatedPlayers:
      SessionPlayer[],

    outId: number
  ) {
    if (waiting.length === 0) {
      return updatedPlayers
    }

    const ordered =
      [...updatedPlayers].sort(
        (a, b) =>
          a.rotationOrder -
          b.rotationOrder
      )

    const currentPlaying =
      ordered.filter(
        (player) =>
          player.rotationOrder < 4
      )

    const currentWaiting =
      ordered.filter(
        (player) =>
          player.rotationOrder >= 4
      )

    const outPlayer =
      currentPlaying.find(
        (player) =>
          player.id === outId
      )

    const entering =
      currentWaiting[0]

    if (
      !outPlayer ||
      !entering
    ) {
      return updatedPlayers
    }

    const survivors =
      currentPlaying.filter(
        (player) =>
          player.id !== outId
      )

    const remainingWaiting =
      currentWaiting.slice(1)

    const newRotation = [
      ...survivors,
      entering,
      ...remainingWaiting,
      outPlayer,
    ]

    return newRotation.map(
      (player, index) => ({
        ...player,
        rotationOrder: index,
      })
    )
  }

  async function finishLoss() {
    if (
      saving ||
      !jimPlayer ||
      catcherSessionPlayerId ===
        null
    ) {
      return
    }

    const catcher =
      sessionPlayers.find(
        (player) =>
          player.id ===
          catcherSessionPlayerId
      )

    if (!catcher) {
      return
    }

    setSaving(true)

    const before =
      sessionPlayers.map(
        (player) => ({
          ...player,
        })
      )

    let updated =
      sessionPlayers.map(
        (player) => {
          if (
            player.id ===
            jimPlayer.id
          ) {
            return {
              ...player,

              points:
                player.points - 3,

              jimAttempts:
                (player.jimAttempts ??
                  0) + 1,
            }
          }

          if (
            player.id ===
            catcher.id
          ) {
            return {
              ...player,

              points:
                player.points + 1,
            }
          }

          return {
            ...player,
          }
        }
      )

    /*
      Jim himself leaves the table
      after losing, if somebody is
      waiting.
    */
    updated =
      rotatePlayers(
        updated,
        jimPlayer.id
      )

    await db.transaction(
      'rw',

      [
        db.sessions,
        db.sessionPlayers,
        db.rounds,
        db.jimResults,
      ],

      async () => {
        const roundId =
          await db.rounds.add({
            sessionId:
              session.id,

            roundNumber:
              session.roundNumber,

            type: 'jim',

            createdAt:
              new Date(),
          })

        await db.jimResults.add({
          roundId,

          sessionId:
            session.id,

          jimPlayerId:
            jimPlayer.playerId,

          caughtByPlayerId:
            catcher.playerId,

          /*
            Jim is the out player
            after a Jim loss.
          */
          outPlayerId:
            jimPlayer.playerId,

          won: false,

          stepsSurvived,

          hideStage:
            hideStage ??
            undefined,

          jimPointsAwarded: -3,

          catcherPointsAwarded:
            1,
        })

        await db.sessionPlayers.bulkPut(
          updated
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

    setSaving(false)

    onComplete({
      roundNumber:
        session.roundNumber,

      before,

      after:
        updated.map(
          (player) => ({
            ...player,
          })
        ),

      changes: [
        {
          sessionPlayerId:
            jimPlayer.id,

          amount: -3,
        },

        {
          sessionPlayerId:
            catcher.id,

          amount: 1,
        },
      ],
    })
  }

  async function finishWin() {
    if (
      saving ||
      !jimPlayer
    ) {
      return
    }

    /*
      If someone is waiting,
      another active player must
      be chosen to leave.
    */
    if (
      waiting.length > 0 &&
      outSessionPlayerId === null
    ) {
      return
    }

    const outPlayer =
      outSessionPlayerId === null
        ? undefined
        : sessionPlayers.find(
            (player) =>
              player.id ===
              outSessionPlayerId
          )

    setSaving(true)

    const before =
      sessionPlayers.map(
        (player) => ({
          ...player,
        })
      )

    let updated =
      sessionPlayers.map(
        (player) => {
          if (
            player.id !==
            jimPlayer.id
          ) {
            return {
              ...player,
            }
          }

          return {
            ...player,

            points:
              player.points + 7,

            jimWins:
              (player.jimWins ??
                0) + 1,

            jimAttempts:
              (player.jimAttempts ??
                0) + 1,
          }
        }
      )

    if (outPlayer) {
      updated =
        rotatePlayers(
          updated,
          outPlayer.id
        )
    }

    await db.transaction(
      'rw',

      [
        db.sessions,
        db.sessionPlayers,
        db.rounds,
        db.jimResults,
      ],

      async () => {
        const roundId =
          await db.rounds.add({
            sessionId:
              session.id,

            roundNumber:
              session.roundNumber,

            type: 'jim',

            createdAt:
              new Date(),
          })

        await db.jimResults.add({
          roundId,

          sessionId:
            session.id,

          jimPlayerId:
            jimPlayer.playerId,

          outPlayerId:
            outPlayer?.playerId,

          won: true,

          stepsSurvived: 6,

          hideStage:
            hideStage ??
            undefined,

          jimPointsAwarded: 7,

          catcherPointsAwarded:
            0,
        })

        await db.sessionPlayers.bulkPut(
          updated
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

    setSaving(false)

    onComplete({
      roundNumber:
        session.roundNumber,

      before,

      after:
        updated.map(
          (player) => ({
            ...player,
          })
        ),

      changes: [
        {
          sessionPlayerId:
            jimPlayer.id,

          amount: 7,
        },
      ],
    })
  }

  return (
    <main className="app jimRoundPage">
      <header className="roundHeader">
        <button
          className="roundBack"
          onClick={leaveJimRound}
          disabled={saving}
        >
          ←
        </button>

        <div>
          <span>
            JIM ROUND
          </span>

          <h1>
            Round{' '}
            {session.roundNumber}
          </h1>
        </div>

        <button
          type="button"
          className="jimSoundToggle"
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Mute JIM sounds' : 'Unmute JIM sounds'}
          aria-pressed={!soundEnabled}
          title={soundEnabled ? 'Mute JIM sounds' : 'Enable JIM sounds'}
        >
          <span aria-hidden="true">{soundEnabled ? '🔊' : '🔇'}</span>
          <span>{soundEnabled ? 'Sound on' : 'Muted'}</span>
        </button>
      </header>

      <div
        className="jimPhasePage"
        key={phase}
      >
      {phase === 'choose' && (
        <section className="jimPanel">
          <div className="jimSectionTitle">
            <span>
              JIM
            </span>

            <h2>
              Who called Jim?
            </h2>
          </div>

          <div className="jimPlayerChoices jimCallerChoices">
            {playing.map((player) => (
              <button
                key={player.id}
                className="jimPlayerChoice jimCallerChoice"
                disabled={introPlayerId !== null}
                onClick={() => chooseJim(player)}
              >
                {getName(player.playerId)}
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === 'running' &&
        jimPlayer && (
          <section className="jimPanel">
            <div className="jimCurrentPlayer">
              <span>
                JIM
              </span>

              <h2>{getName(jimPlayer.playerId)}</h2>
            </div>

            <div className="jimProgress jimProgressWheelCard">
              <JimProgressWheel
                stepsSurvived={stepsSurvived}
                currentStage={currentStage}
                hideStage={hideStage}
              />
            </div>

            <div className="jimHideArea">
              {hideStage !== null ? (
                <div className="jimHideUsed">
                  <span>
                    HIDE USED
                  </span>

                  <strong>
                    Stage{' '}
                    {hideStage}
                  </strong>
                </div>
              ) : (
                <button
                  className="jimHideButton"
                 disabled={
                  currentStage === 1 ||
                  currentStage === 6 ||
                  saving
                }
                  onClick={useHide}
                >
                  {currentStage === 1
                    ? 'Hide available from Stage 2'
                    : currentStage === 6
                      ? 'Hide unavailable on final stage'
                      : `HIDE • STAGE ${currentStage}`}
                </button>
              )}
            </div>

            <div className="jimMainActions">
              <button
                className="jimSurvivedButton"
                onClick={
                  survivedNext
                }
                disabled={saving}
              >
                Survived Next
              </button>

              <button
                className="jimCaughtButton"
                onClick={caughtJim}
                disabled={saving}
              >
                Caught
              </button>
            </div>
          </section>
        )}

      {phase === 'caught' &&
        jimPlayer && (
          <section className="jimPanel">
            <div className="jimCurrentPlayer">
              <span>
                JIM CAUGHT
              </span>

              <h2>
                {getName(
                  jimPlayer.playerId
                )}
              </h2>
            </div>

            <div className="jimProgress jimProgressWheelCard">
              <JimProgressWheel
                stepsSurvived={stepsSurvived}
                currentStage={currentStage}
                hideStage={hideStage}
                outcome="caught"
                caughtTintActive={
                  caughtTintActive
                }
              />
            </div>

            <div className="jimSectionTitle jimCaughtPrompt">
              <span>
                CATCHER
              </span>

              <h2>
                Who caught{' '}
                {getName(
                  jimPlayer.playerId
                )}
                ?
              </h2>
            </div>

            <div className="jimPlayerChoices jimCaughtChoices">
              {playing
                .filter(
                  (player) =>
                    player.id !==
                    jimPlayer.id
                )
                .map(
                  (player) => (
                    <button
                      key={
                        player.id
                      }
                      className={
                        catcherSessionPlayerId ===
                        player.id
                          ? 'jimPlayerChoice selected caughtSelected'
                          : 'jimPlayerChoice'
                      }
                      onClick={() =>
                        setCatcherSessionPlayerId(
                          player.id
                        )
                      }
                    >
                      {getName(
                        player.playerId
                      )}
                    </button>
                  )
                )}
            </div>

            {catcherSessionPlayerId !==
              null && (
              <div className="jimCaughtReward">
                <span>
                  CATCHER
                </span>

                <strong>
                  +1
                </strong>

                <small>
                  {getName(
                    sessionPlayers.find(
                      (player) =>
                        player.id ===
                        catcherSessionPlayerId
                    )?.playerId ??
                      -1
                  )}
                </small>
              </div>
            )}

            <button
              className="jimConfirmButton jimCaughtConfirm"
              disabled={
                catcherSessionPlayerId ===
                  null ||
                saving
              }
              onClick={
                finishLoss
              }
            >
              {saving
                ? 'Saving...'
                : 'Confirm Catch'}
            </button>
          </section>
        )}

      {phase === 'win' &&
        jimPlayer && (
          waiting.length > 0 ? (
            <section className="jimPanel">
              <div className="jimWinTitle">
                <span>
                  JIM SURVIVED
                </span>

                <h2>
                  {getName(
                    jimPlayer.playerId
                  )}
                </h2>

                <strong>
                  +7
                </strong>
              </div>

              <div className="jimOutcomeSummary">
                <div>
                  <span>
                    SURVIVED
                  </span>

                  <strong>
                    6/6
                  </strong>
                </div>

                <div>
                  <span>
                    HIDE
                  </span>

                  <strong>
                    {hideStage ===
                    null
                      ? 'NO'
                      : `S${hideStage}`}
                  </strong>
                </div>
              </div>

              <div className="jimSectionTitle">
                <span>
                  ROTATION
                </span>

                <h2>
                  Who is out?
                </h2>
              </div>

              <div className="jimPlayerChoices">
                {playing
                  .filter(
                    (player) =>
                      player.id !==
                      jimPlayer.id
                  )
                  .map(
                    (player) => (
                      <button
                        key={
                          player.id
                        }
                        className={
                          outSessionPlayerId ===
                          player.id
                            ? 'jimPlayerChoice selected'
                            : 'jimPlayerChoice'
                        }
                        onClick={() =>
                          setOutSessionPlayerId(
                            player.id
                          )
                        }
                      >
                        {getName(
                          player.playerId
                        )}
                      </button>
                    )
                  )}
              </div>

              <p className="jimRotationNote">
                {getName(
                  waiting[0]
                    .playerId
                )}{' '}
                will enter.
              </p>

              <button
                className="jimConfirmButton jimWinConfirm"
                disabled={
                  saving ||
                  outSessionPlayerId ===
                    null
                }
                onClick={
                  finishWin
                }
              >
                {saving
                  ? 'Saving...'
                  : 'Confirm Jim Win'}
              </button>
            </section>
          ) : (
            <section className="jimPanel jimWinWheelPanel">
              <div className="jimCurrentPlayer">
                <span>
                  JIM SURVIVED
                </span>

                <h2>
                  {getName(
                    jimPlayer.playerId
                  )}
                </h2>
              </div>

              <div className="jimProgress jimProgressWheelCard jimProgressWin">
                <JimProgressWheel
                  stepsSurvived={6}
                  currentStage={6}
                  hideStage={hideStage}
                  outcome="win"
                />
              </div>

              <button
                className="jimConfirmButton jimWinConfirm jimWinWheelConfirm"
                disabled={saving}
                onClick={
                  finishWin
                }
              >
                {saving
                  ? 'Saving...'
                  : 'Confirm Jim Win'}
              </button>
            </section>
          )
        )}
      </div>

      {phase === 'choose' && introPlayerId !== null && (
        <div className="jimIntroOverlay">
          <div
            className="jimIntroModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="jimIntroPlayerName"
          >
            <h2 id="jimIntroPlayerName">
              {getName(sessionPlayers.find(p => p.id === introPlayerId)?.playerId ?? -1)}
            </h2>
            <div
              className="jimIntroWave"
              aria-hidden="true"
              style={{
                width: 'min(100%, 330px)',
                height: '60px',
                gap: '2px',
                overflow: 'hidden',
              }}
            >
              {(introWaveform.length ? introWaveform : Array.from({ length: 60 }, () => 0.34)).map((value, index, bars) => {
                // The audio progress is updated with requestAnimationFrame, so
                // bars rise one at a time rather than appearing all at once.
                const playhead = introProgress * bars.length
                const reveal = Math.max(0, Math.min(1, (playhead - index) * 1.8))
                // The leading few bars glow brighter, like a traveling spark.
                const glow = Math.max(0, 1 - Math.abs(playhead - index - 0.5) / 4)
                return (
                  <span
                    key={index}
                    style={{
                      flex: '1 1 0',
                      width: 'auto',
                      minWidth: 0,
                      maxWidth: '4px',
                      height: `${14 + value * 82}%`,
                      opacity: reveal * (0.76 + glow * 0.24),
                      transform: `scaleY(${0.18 + reveal * 0.82})`,
                      transformOrigin: 'center',
                      background: glow > 0.4 ? '#ffe09a' : '#e8b75e',
                      boxShadow: glow > 0.45
                        ? `0 0 ${3 + glow * 7}px rgba(255, 200, 93, ${0.12 + glow * 0.38})`
                        : 'none',
                      animation: 'none',
                    }}
                  />
                )
              })}
            </div>
            {introNeedsTap && (
              <button
                className="jimIntroSkip"
                type="button"
                onClick={() => {
                  const recording = introAudio.current
                  if (!recording) return
                  // This second, direct tap satisfies Android/iOS autoplay rules.
                  void recording.play().then(() => setIntroNeedsTap(false)).catch(() => {
                    beginStages(soundEnabled)
                  })
                }}
              >
                Play shout
              </button>
            )}
            <button
              className="jimIntroSkip"
              type="button"
              autoFocus={!introNeedsTap}
              onClick={() => beginStages(soundEnabled)}
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </main>
  )
}