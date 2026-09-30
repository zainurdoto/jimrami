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

const LOCAL_MODE_KEY =
  'jimrami-local-mode-this-tab'

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

  const [error, setError] =
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
            _event,
            session
          ) => {
            if (!active) {
              return
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
    setError('')

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
      Reload after login.

      This lets the normal JIMRAMI
      startup cloud checker run again
      with the new authenticated
      Supabase session.
    */
    window.location.reload()
  }

  function continueLocal() {
    sessionStorage.setItem(
      LOCAL_MODE_KEY,
      '1'
    )

    setLocalMode(true)
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

  if (signedIn) {
    return children
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
