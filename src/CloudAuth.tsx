import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from 'react'

import {
  cloudConfigured,
  supabase,
} from './lib/supabase'

type Props = {
  children: ReactNode
}

type AuthMode =
  | 'signIn'
  | 'forgot'
  | 'recovery'

const LOCAL_MODE_KEY =
  'jimrami-local-mode-this-tab'

function isPasswordRecoveryUrl() {
  const hash =
    new URLSearchParams(
      window.location.hash
        .replace(/^#/, '')
    )

  const query =
    new URLSearchParams(
      window.location.search
    )

  return (
    hash.get('type') ===
      'recovery' ||
    query.get('type') ===
      'recovery'
  )
}

function appUrl() {
  return new URL(
    import.meta.env.BASE_URL,
    window.location.origin
  ).toString()
}

export default function CloudAuth({
  children,
}: Props) {
  const [
    checkingSession,
    setCheckingSession,
  ] =
    useState(true)

  const [
    signedIn,
    setSignedIn,
  ] =
    useState(false)

  const [
    mode,
    setMode,
  ] =
    useState<AuthMode>(
      () =>
        isPasswordRecoveryUrl()
          ? 'recovery'
          : 'signIn'
    )

  const [
    localMode,
    setLocalMode,
  ] =
    useState(
      () =>
        sessionStorage.getItem(
          LOCAL_MODE_KEY
        ) === '1'
    )

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [
    newPassword,
    setNewPassword,
  ] =
    useState('')

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState('')

  const [error, setError] =
    useState('')

  const [
    message,
    setMessage,
  ] =
    useState('')

  const [busy, setBusy] =
    useState(false)

  useEffect(() => {
    if (
      !cloudConfigured ||
      !supabase
    ) {
      setCheckingSession(false)
      return
    }

    let active = true

    void supabase.auth
      .getSession()
      .then(
        ({
          data,
        }) => {
          if (!active) {
            return
          }

          setSignedIn(
            Boolean(
              data.session
            )
          )

          setCheckingSession(
            false
          )
        }
      )

    const {
      data:
        authListener,
    } =
      supabase.auth
        .onAuthStateChange(
          (
            event,
            session
          ) => {
            if (!active) {
              return
            }

            if (
              event ===
              'PASSWORD_RECOVERY'
            ) {
              setMode(
                'recovery'
              )

              setError('')
              setMessage('')
            }

            setSignedIn(
              Boolean(session)
            )

            setCheckingSession(
              false
            )
          }
        )

    return () => {
      active = false

      authListener
        .subscription
        .unsubscribe()
    }
  }, [])

  function clearMessages() {
    setError('')
    setMessage('')
  }

  async function signIn(
    event: FormEvent
  ) {
    event.preventDefault()

    if (
      !supabase ||
      busy
    ) {
      return
    }

    const cleanEmail =
      email.trim()

    if (
      !cleanEmail ||
      !password
    ) {
      setError(
        'Enter your email and password.'
      )

      return
    }

    setBusy(true)
    clearMessages()

    const {
      error:
        signInError,
    } =
      await supabase.auth
        .signInWithPassword({
          email:
            cleanEmail,

          password,
        })

    if (signInError) {
      setError(
        signInError.message
      )

      setBusy(false)
      return
    }

    /*
      Reload after login so the normal
      JIMRAMI startup cloud checker runs
      with the authenticated session.
    */
    window.location.replace(
      appUrl()
    )
  }

  async function sendResetEmail(
    event: FormEvent
  ) {
    event.preventDefault()

    if (
      !supabase ||
      busy
    ) {
      return
    }

    const cleanEmail =
      email.trim()

    if (!cleanEmail) {
      setError(
        'Enter your email address.'
      )

      return
    }

    setBusy(true)
    clearMessages()

    const {
      error:
        resetError,
    } =
      await supabase.auth
        .resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              appUrl(),
          }
        )

    if (resetError) {
      setError(
        resetError.message
      )

      setBusy(false)
      return
    }

    setMessage(
      'Password reset email sent. Open the email and tap the reset link.'
    )

    setBusy(false)
  }

  async function saveNewPassword(
    event: FormEvent
  ) {
    event.preventDefault()

    if (
      !supabase ||
      busy
    ) {
      return
    }

    if (
      newPassword.length < 6
    ) {
      setError(
        'Password must be at least 6 characters.'
      )

      return
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        'The two passwords do not match.'
      )

      return
    }

    setBusy(true)
    clearMessages()

    const {
      error:
        updateError,
    } =
      await supabase.auth
        .updateUser({
          password:
            newPassword,
        })

    if (updateError) {
      setError(
        updateError.message
      )

      setBusy(false)
      return
    }

    setMessage(
      'Password updated. Opening JIMRAMI…'
    )

    window.setTimeout(
      () => {
        window.location.replace(
          appUrl()
        )
      },
      650
    )
  }

  function continueLocal() {
    sessionStorage.setItem(
      LOCAL_MODE_KEY,
      '1'
    )

    setLocalMode(true)
  }

  function showForgotPassword() {
    clearMessages()
    setPassword('')
    setMode('forgot')
  }

  function showSignIn() {
    clearMessages()
    setPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setMode('signIn')
  }

  if (
    !cloudConfigured ||
    localMode
  ) {
    return children
  }

  if (checkingSession) {
    return (
      <main className="cloudAuthPage">
        <section className="cloudAuthCard cloudAuthLoading">
          <span className="cloudAuthEyebrow">
            JIMRAMI
          </span>

          <h1>
            Checking Cloud
          </h1>

          <p>
            Looking for your saved
            Supabase session…
          </p>
        </section>
      </main>
    )
  }

  /*
    Recovery must win over signedIn.

    Supabase creates a temporary
    authenticated recovery session when
    the user opens the reset link.
  */
  if (mode === 'recovery') {
    return (
      <main className="cloudAuthPage">
        <section className="cloudAuthCard">
          <header className="cloudAuthHeader">
            <span className="cloudAuthEyebrow">
              JIMRAMI CLOUD
            </span>

            <h1>
              Set New Password
            </h1>

            <p>
              Choose the password you
              want to use when signing
              in to JIMRAMI.
            </p>
          </header>

          <form
            className="cloudAuthForm"
            onSubmit={
              saveNewPassword
            }
          >
            <label>
              <span>
                New Password
              </span>

              <input
                type="password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(
                    event.target.value
                  )
                }
                autoComplete="new-password"
                placeholder="At least 6 characters"
                disabled={busy}
              />
            </label>

            <label>
              <span>
                Confirm Password
              </span>

              <input
                type="password"
                value={
                  confirmPassword
                }
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                autoComplete="new-password"
                placeholder="Enter it again"
                disabled={busy}
              />
            </label>

            {error && (
              <p className="cloudAuthError">
                {error}
              </p>
            )}

            {message && (
              <p className="cloudAuthMessage">
                {message}
              </p>
            )}

            <button
              className="cloudAuthSignIn"
              type="submit"
              disabled={busy}
            >
              {busy
                ? 'Saving…'
                : 'Save Password'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  if (signedIn) {
    return children
  }

  if (mode === 'forgot') {
    return (
      <main className="cloudAuthPage">
        <section className="cloudAuthCard">
          <header className="cloudAuthHeader">
            <span className="cloudAuthEyebrow">
              JIMRAMI CLOUD
            </span>

            <h1>
              Reset Password
            </h1>

            <p>
              Enter your account email.
              Supabase will send you a
              password reset link.
            </p>
          </header>

          <form
            className="cloudAuthForm"
            onSubmit={
              sendResetEmail
            }
          >
            <label>
              <span>
                Email
              </span>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                disabled={busy}
              />
            </label>

            {error && (
              <p className="cloudAuthError">
                {error}
              </p>
            )}

            {message && (
              <p className="cloudAuthMessage">
                {message}
              </p>
            )}

            <button
              className="cloudAuthSignIn"
              type="submit"
              disabled={busy}
            >
              {busy
                ? 'Sending…'
                : 'Send Reset Email'}
            </button>
          </form>

          <button
            className="cloudAuthTextButton"
            type="button"
            onClick={showSignIn}
            disabled={busy}
          >
            ← Back to Sign In
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="cloudAuthPage">
      <section className="cloudAuthCard">
        <header className="cloudAuthHeader">
          <span className="cloudAuthEyebrow">
            JIMRAMI CLOUD
          </span>

          <h1>
            Sign In
          </h1>

          <p>
            Sign in to use your shared
            JIMRAMI cloud data on this
            device.
          </p>
        </header>

        <form
          className="cloudAuthForm"
          onSubmit={signIn}
        >
          <label>
            <span>
              Email
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              disabled={busy}
            />
          </label>

          <label>
            <span>
              Password
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              autoComplete="current-password"
              placeholder="Password"
              disabled={busy}
            />
          </label>

          <button
            className="cloudAuthForgot"
            type="button"
            onClick={
              showForgotPassword
            }
            disabled={busy}
          >
            Forgot password?
          </button>

          {error && (
            <p className="cloudAuthError">
              {error}
            </p>
          )}

          <button
            className="cloudAuthSignIn"
            type="submit"
            disabled={busy}
          >
            {busy
              ? 'Signing In…'
              : 'Sign In'}
          </button>
        </form>

        <div className="cloudAuthDivider">
          <span>
            OR
          </span>
        </div>

        <button
          className="cloudAuthLocal"
          type="button"
          onClick={continueLocal}
          disabled={busy}
        >
          Use Local Mode
        </button>

        <p className="cloudAuthNote">
          Local Mode keeps data only on
          this browser. Cloud sign-in
          uses an existing Supabase
          account.
        </p>
      </section>
    </main>
  )
}
