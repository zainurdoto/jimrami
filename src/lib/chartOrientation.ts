import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * The native ScreenOrientation bridge becomes available after installing:
 * npm install @capacitor/screen-orientation@^8 && npx cap sync android
 *
 * Registration itself does not add a dependency to the web build.
 */
const nativeOrientation = registerPlugin<{
  lock(options: { orientation: 'landscape-primary' }): Promise<void>
  unlock(): Promise<void>
}>('ScreenOrientation')

type BrowserScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>
  unlock?: () => void
}

export async function lockChartLandscape(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      if (!Capacitor.isPluginAvailable('ScreenOrientation')) return false
      await nativeOrientation.lock({ orientation: 'landscape-primary' })
      return true
    }

    const orientation = screen.orientation as BrowserScreenOrientation | undefined
    if (!orientation?.lock) return false
    await orientation.lock('landscape')
    return true
  } catch {
    // Browsers may require fullscreen, or lack orientation-lock support.
    return false
  }
}

export async function unlockChartLandscape(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      if (Capacitor.isPluginAvailable('ScreenOrientation')) {
        await nativeOrientation.unlock()
      }
      return
    }
    ;(screen.orientation as BrowserScreenOrientation | undefined)?.unlock?.()
  } catch {
    // Leaving the chart should never be blocked by an unsupported browser.
  }
}
