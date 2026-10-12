/**
 * JIMRAMI sampled kendhang soundtrack.
 *
 * Real percussion recordings, arranged by Web Audio. Six progressively more
 * intense stages. Hide plays a reversed acoustic swish ABOVE the drums: it
 * never ducks, stops, restarts or changes the beat.
 *
 * Recordings: Digitópia / Casa da Música's Javanese Gamelan sample library,
 * Artistic License 2.0. Source / licence in JIM-ACOUSTIC-SETUP.md.
 */

type Hit = 'D' | 'd' | 'T' | 't' | 'K' | 'r' | '-'
type SampleName = 'bass' | 'dum' | 'tak' | 'wood' | 'tap'

const SAMPLE_NAMES: readonly SampleName[] = ['bass', 'dum', 'tak', 'wood', 'tap']

// Direct Commons uploads, only used when local copies have not been installed.
// For fully offline PWA / APK use: node scripts/download-jim-drums.mjs
const REMOTE: Record<SampleName, string> = {
  bass: 'Drums_kendhang_ageng_dha_(Casa_da_Musica\'s_Javanese_gamelan).ogg',
  dum: 'Drums_ketipung_small_dhung_(Casa_da_Musica\'s_Javanese_gamelan).ogg',
  tak: 'Drums_ciblon_medium_tak_(Casa_da_Musica\'s_Javanese_gamelan).ogg',
  wood: 'Drums_ciblon_medium_thung_(Casa_da_Musica\'s_Javanese_gamelan).ogg',
  tap: 'Drums_ciblon_medium_tong_(Casa_da_Musica\'s_Javanese_gamelan).ogg',
}

// Wikimedia Commons distributes files by MD5 of the literal file name.
const COMMONS: Record<SampleName, string> = {
  bass: '1/15',
  dum: 'd/d7',
  tak: '7/72',
  wood: '5/54',
  tap: '9/92',
}

const STAGES: readonly { bpm: number; notes: readonly Hit[] }[] = [
  { bpm: 78,  notes: ['D', '-', '-', 't', 'D', '-', 'K', '-'] },
  { bpm: 94,  notes: ['D', '-', 't', '-', 'D', 'K', 'd', 't'] },
  { bpm: 110, notes: ['D', 't', 'd', 'K', 'D', 't', 'K', 't'] },
  { bpm: 128, notes: ['D', 'T', 'd', 'K', 'D', 't', 'd', 'T'] },
  { bpm: 152, notes: ['D', 'T', 'd', 'r', 'D', 'T', 'd', 'r'] },
  { bpm: 178, notes: ['D', 'r', 'd', 'T', 'D', 'r', 'T', 'r'] },
]

export class JimSoundEngine {
  private context: AudioContext | null = null
  private drums: GainNode | null = null
  private effects: GainNode | null = null
  private audio = new Map<SampleName, AudioBuffer>()
  private reversedHide: AudioBuffer | null = null
  private preloadPromise: Promise<void> | null = null
  private timer: number | null = null
  private delayedStart: number | null = null
  private nextStepTime = 0
  private step = 0
  private stage = 1
  private wantPlaying = false
  private playing = false
  private epoch = 0
  private disposed = false
  private sources = new Set<AudioScheduledSourceNode>()
  private applause: AudioBuffer | null = null
  private applausePromise: Promise<void> | null = null

  unlock(): void {
    if (this.disposed) return
    try {
      if (!this.context) {
        const ctx = new AudioContext()
        const master = ctx.createGain()
        master.gain.value = 0.85
        const limiter = ctx.createDynamicsCompressor()
        limiter.threshold.value = -13
        limiter.ratio.value = 4
        limiter.knee.value = 12
        limiter.attack.value = 0.004
        limiter.release.value = 0.16
        master.connect(limiter)
        limiter.connect(ctx.destination)
        this.drums = ctx.createGain()
        this.drums.connect(master)
        this.effects = ctx.createGain()
        this.effects.connect(master)
        this.context = ctx
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
    } catch { /* Game remains playable if AudioContext is unavailable. */ }
  }

  /** Preloads recordings at JIM-page mount, avoiding a delay on the first tap. */
  preload(): Promise<void> {
    // The crowd is loaded independently: slow network access must never delay
    // the gendang or the player's personal JIM voice.
    void this.preloadApplause()
    if (this.preloadPromise) return this.preloadPromise
    this.unlock()
    const ctx = this.context
    if (!ctx) return Promise.resolve()
    this.preloadPromise = Promise.all(SAMPLE_NAMES.map(async name => {
      const local = `${import.meta.env.BASE_URL}audio/jim/${name}.ogg`
      const file = encodeURIComponent(REMOTE[name]).replace(/%2F/g, '/')
      const remote = `https://upload.wikimedia.org/wikipedia/commons/${COMMONS[name]}/${file}`
      for (const path of [local, remote]) {
        try {
          const response = await fetch(path)
          if (!response.ok) continue
          const bytes = await response.arrayBuffer()
          const buffer = await ctx.decodeAudioData(bytes)
          if (this.disposed) return
          this.audio.set(name, buffer)
          return
        } catch { /* Missing local file or blocked remote fetch: try next. */ }
      }
      console.warn(`JIMRAMI: Could not load acoustic ${name} sample. Run the drum download script.`)
    })).then(() => {
      const src = this.audio.get('wood') ?? this.audio.get('tak')
      if (!src || this.disposed) return
      // Reverse a real drum strike for a soft, organic concealment effect.
      const reversed = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate)
      for (let c = 0; c < src.numberOfChannels; c++) {
        const from = src.getChannelData(c)
        const to = reversed.getChannelData(c)
        for (let i = 0; i < from.length; i++) to[i] = from[from.length - i - 1]
      }
      this.reversedHide = reversed
    })
    return this.preloadPromise
  }

  private track(src: AudioScheduledSourceNode, at: number, duration: number): void {
    this.sources.add(src)
    src.onended = () => { this.sources.delete(src); src.disconnect() }
    src.start(at)
    src.stop(at + duration)
  }

  private sample(name: SampleName, at: number, strength = 1, rate = 1, bus = this.drums): void {
    const ctx = this.context
    const buffer = this.audio.get(name)
    if (!ctx || !buffer || !bus) return
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = rate
    const gain = ctx.createGain()
    // Sound is replayed from the actual recording, with slight human variation.
    const duration = buffer.duration / rate
    const level = Math.min(0.95, 0.45 * strength)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.linearRampToValueAtTime(level, at + 0.004)
    gain.gain.setValueAtTime(level, at + Math.min(duration * 0.60, 0.30))
    gain.gain.linearRampToValueAtTime(0.0001, at + Math.min(duration, 1.7))
    src.connect(gain)
    gain.connect(bus)
    this.track(src, at, duration)
  }

  private strike(at: number, hit: Hit): void {
    const human = 0.91 + Math.random() * 0.18
    const speed = 0.97 + Math.random() * 0.06
    switch (hit) {
      case 'D': this.sample('bass', at, 1.22 * human, speed); break
      case 'd': this.sample('dum', at, 0.92 * human, speed); break
      case 'T': this.sample('tak', at, 1.16 * human, speed); break
      case 't': this.sample('tak', at, 0.75 * human, speed); break
      case 'K': this.sample('wood', at, 0.75 * human, speed); break
      case 'r': {
        const gap = this.stage === 6 ? 0.075 : 0.095
        this.sample('tap', at, 0.65 * human, speed)
        this.sample('tak', at + gap, 0.95 * human, speed * 1.02)
        break
      }
      default: break
    }
  }

  private tick = (): void => {
    const ctx = this.context
    if (!ctx || !this.playing || !this.audio.size) return
    if (this.nextStepTime < ctx.currentTime - 0.20) this.nextStepTime = ctx.currentTime + 0.03
    while (this.nextStepTime < ctx.currentTime + 0.13) {
      const song = STAGES[this.stage - 1]
      this.strike(this.nextStepTime, song.notes[this.step % song.notes.length])
      // Additional off-beat hits give the final stages their relentless roll.
      if (this.stage >= 5 && this.step % 8 === 7) {
        this.sample('tap', this.nextStepTime + 0.075, 0.75)
      }
      this.nextStepTime += 30 / song.bpm
      this.step++
    }
  }

  setStage(stage: number): void {
    this.stage = Math.max(1, Math.min(6, Math.floor(stage)))
    // No drum reset on stage changes or after Hide.
  }

  start(stage: number, delayMs = 0): void {
    this.stopAll()
    this.stage = Math.max(1, Math.min(6, Math.floor(stage)))
    this.unlock()
    this.wantPlaying = true
    const id = this.epoch
    const begin = () => {
      this.delayedStart = null
      void this.preload().then(() => {
        if (!this.wantPlaying || this.disposed || id !== this.epoch || !this.context) return
        this.playing = true
        this.step = 0
        this.nextStepTime = this.context.currentTime + 0.045
        this.tick()
        this.timer = window.setInterval(this.tick, 45)
      })
    }
    if (delayMs > 0) this.delayedStart = window.setTimeout(begin, delayMs)
    else begin()
  }

  /** Overlay-only. Does NOT interrupt or restart the gendang. */
  hide(): void {
    const ctx = this.context
    const bus = this.effects
    if (!ctx || !bus || !this.wantPlaying || this.stage < 2 || this.stage > 5) return
    const at = ctx.currentTime + 0.025
    if (this.reversedHide) {
      const src = ctx.createBufferSource()
      src.buffer = this.reversedHide
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1100
      const volume = ctx.createGain()
      const duration = Math.min(1.3, this.reversedHide.duration)
      src.playbackRate.value = this.reversedHide.duration / duration
      volume.gain.setValueAtTime(0.0001, at)
      volume.gain.linearRampToValueAtTime(0.36, at + duration * 0.86)
      volume.gain.linearRampToValueAtTime(0.0001, at + duration)
      src.connect(filter)
      filter.connect(volume)
      volume.connect(bus)
      this.track(src, at, duration)
    }
    // Light, rhythmic footstep-like wooden taps over the same beat.
    this.sample('wood', at + 0.08, 0.75, 1.22, bus)
    this.sample('tap', at + 0.31, 0.56, 1.35, bus)
    this.sample('wood', at + 0.54, 0.42, 1.18, bus)
  }

  private stopDrums(): void {
    this.wantPlaying = false
    this.playing = false
    this.epoch++
    if (this.timer !== null) window.clearInterval(this.timer)
    if (this.delayedStart !== null) window.clearTimeout(this.delayedStart)
    this.timer = null
    this.delayedStart = null
  }

  /** Real audience recording. Keep it separate from the drum-loading promise. */
  private preloadApplause(): Promise<void> {
    if (this.applausePromise) return this.applausePromise
    this.unlock()
    const ctx = this.context
    if (!ctx) return Promise.resolve()
    this.applausePromise = (async () => {
      const urls = [
        `${import.meta.env.BASE_URL}audio/jim/crowd-applause.ogg`,
        'https://upload.wikimedia.org/wikipedia/commons/3/32/Sound_Effects_-_Applause_after_a_concert.ogg',
      ]
      for (const url of urls) {
        try {
          const response = await fetch(url)
          if (!response.ok) continue
          const bytes = await response.arrayBuffer()
          const buffer = await ctx.decodeAudioData(bytes)
          if (!this.disposed) this.applause = buffer
          return
        } catch { /* Try the backup URL; local file recommended for offline use. */ }
      }
      console.warn('JIMRAMI: Crowd applause is missing. Run node scripts/download-jim-applause.mjs')
    })()
    return this.applausePromise
  }

  /** Five-second recording, rising beneath the final acoustic drum flourish. */
  private playApplause(at: number): void {
    const ctx = this.context
    const buffer = this.applause
    if (!ctx || !buffer || !this.effects) return

    // Skip the beginning of the long recording to catch the established applause.
    const offset = buffer.duration > 14 ? 8 : 0
    const length = Math.min(5.2, buffer.duration - offset)
    if (length <= 0) return

    const src = ctx.createBufferSource()
    src.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.linearRampToValueAtTime(0.86, at + Math.min(0.24, length * 0.2))
    gain.gain.setValueAtTime(0.86, at + Math.max(0.25, length - 1.5))
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
    src.connect(gain)
    gain.connect(this.effects)
    this.sources.add(src)
    src.onended = () => { this.sources.delete(src); src.disconnect(); gain.disconnect() }
    src.start(at, offset, length)
    src.stop(at + length)
  }

  /** Flourish uses the same real kendhang samples as the six JIM stages. */
  private victoryDrums(at: number): void {
    const bus = this.effects
    this.sample('bass', at, 1.70, 0.94, bus)
    this.sample('tak', at + 0.18, 0.84, 1.02, bus)
    this.sample('tap', at + 0.32, 0.78, 1.06, bus)
    this.sample('tak', at + 0.43, 0.98, 1.04, bus)
    this.sample('tap', at + 0.52, 0.83, 1.08, bus)
    this.sample('tak', at + 0.60, 1.03, 1.05, bus)
    this.sample('wood', at + 0.67, 0.91, 1.04, bus)
    this.sample('tak', at + 0.73, 1.04, 1.04, bus)
    this.sample('bass', at + 0.83, 1.75, 0.92, bus)
  }

  private tone(hz: number, at: number, duration: number, volume: number,
    type: OscillatorType = 'triangle', endHz = hz): void {
    const ctx = this.context
    if (!ctx || !this.effects) return
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(hz, at)
    if (endHz !== hz) osc.frequency.exponentialRampToValueAtTime(endHz, at + duration)
    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.0001, at)
    envelope.gain.linearRampToValueAtTime(volume, at + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    osc.connect(envelope)
    envelope.connect(this.effects)
    this.track(osc, at, duration + 0.01)
  }

  win(): void {
    this.stopAll()
    this.unlock()
    const ctx = this.context
    if (!ctx) return
    const now = ctx.currentTime
    const at = now + 0.035
    const expectedEpoch = this.epoch
    this.victoryDrums(at)

    // Let the crowd erupt during the final drum strikes. A pending download
    // may finish just after victory; play only if the same victory is still active.
    const playIfCurrent = () => {
      if (!this.disposed && this.epoch === expectedEpoch && this.context === ctx) {
        if (ctx.currentTime < at + 1.8) {
          this.playApplause(Math.max(at + 0.64, ctx.currentTime + 0.02))
        }
      }
    }
    if (this.applause) playIfCurrent()
    else void this.preloadApplause().then(playIfCurrent)
  }

  caught(): void {
    this.stopAll()
    this.unlock()
    if (!this.context) return
    const at = this.context.currentTime + 0.04
    this.tone(145, at, 0.30, 0.29, 'sine', 53)
    this.tone(466.16, at + 0.11, 0.27, 0.17, 'sawtooth', 392)
    this.tone(369.99, at + 0.38, 0.28, 0.16, 'sawtooth', 311.13)
    this.tone(293.66, at + 0.66, 0.28, 0.16, 'sawtooth', 246.94)
    this.tone(196, at + 0.94, 0.65, 0.19, 'triangle', 110)
  }

  stopAll(): void {
    this.stopDrums()
    for (const src of this.sources) {
      try { src.stop() } catch { /* Already stopped */ }
    }
    this.sources.clear()
  }

  dispose(): void {
    this.disposed = true
    this.stopAll()
    if (this.context) void this.context.close().catch(() => {})
    this.context = null
    this.drums = null
    this.effects = null
    this.audio.clear()
    this.reversedHide = null
    this.applause = null
    this.applausePromise = null
  }
}

export const JIM_SOUND_SETTING_KEY = 'jimrami-jim-sound-enabled'
export function getJimSoundEnabled(): boolean {
  try { return window.localStorage.getItem(JIM_SOUND_SETTING_KEY) !== 'false' }
  catch { return true }
}
export function saveJimSoundEnabled(enabled: boolean): void {
  try { window.localStorage.setItem(JIM_SOUND_SETTING_KEY, String(enabled)) }
  catch { /* May be blocked in private browsing. */ }
}
