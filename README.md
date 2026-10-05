# JIMRAMI

JIMRAMI is a scorekeeper for our family card game. It keeps scores, rounds, player history, stats and awards in one place.

It can be used as a **web app** in the browser, or built as an **Android app** with Capacitor.

- [Open the web app](https://zainurdoto.github.io/jimrami/)
- [Download sample data](https://zainurdoto.github.io/jimrami/demo_data.zip)
- [Download the latest Android APK](https://github.com/zainurdoto/jimrami/releases/latest)

## Built with

- React
- TypeScript
- Vite
- Dexie / IndexedDB for local data
- Motion for UI animation
- Capacitor for Android
- Supabase for optional cloud sync

## Development setup

I developed JIMRAMI using:

- Node.js
- npm
- VSCodium
- Android Studio for Android builds

VSCodium is not required. Any suitable code editor can be used.

## What it does

JIMRAMI supports the parts of the game that we normally need while playing:

- Standard rounds
- Jim rounds
- Penalty rounds
- Goalpost and Deuce
- Player names and nicknames
- Session history
- Player statistics and awards
- Title Race
- Local backup and restore
- Optional Supabase sync between devices

## Try it with sample data

The web app starts with its own local data on your device.

If you want to see the history, statistics and awards pages without playing a full session first:

1. Open the [web app](https://zainurdoto.github.io/jimrami/).
2. Download the [sample data](https://zainurdoto.github.io/jimrami/demo_data.zip).
3. Unzip it.
4. In JIMRAMI, open **Data**.
5. Choose **Import Backup** and select the JSON file.

Importing a backup replaces the JIMRAMI data currently stored on that device, so export your own backup first if you want to keep it.

## Where the data is stored

JIMRAMI is **local-first**.

This means the data is stored on the device you are using. You do not need an account, a server or Supabase to use the app.

Use **Data → Export Backup** to save a copy of the players, sessions, rounds and results as a JSON file.

That backup can later be imported on the same device or another device.

## Run it on your computer

Make sure Node.js and npm are installed.

Install the project packages:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local address shown in the terminal.

To make a production build:

```bash
npm run build
```

## Build the Android app

JIMRAMI uses Capacitor to turn the web app into an Android app.

Build the web app first:

```bash
npm run build
```

Then sync the build to the Android project:

```bash
npx cap sync android
```

Open the Android project:

```bash
npx cap open android
```

Android Studio will open. The APK can then be built from Android Studio.

If Supabase sync is required in the APK, configure Supabase **before** running `npm run build`.

<details>
<summary><strong>Optional Supabase cloud sync</strong></summary>

JIMRAMI works normally without Supabase.

Supabase is only used if you want the same JIMRAMI data to sync between devices.

### 1. Create a Supabase project

Create a project in Supabase.

Then open the **SQL Editor** and run:

```text
supabase/schema.sql
```

This creates the tables and other database setup used by JIMRAMI.

### 2. Create a user

Open **Authentication** in Supabase and create the user that will be allowed to connect to the JIMRAMI database.

JIMRAMI does not provide public account registration.

### 3. Get the connection details

In your Supabase project, click **Connect**.

Use the **Framework** / client-library setup.

JIMRAMI is a **React + Vite** app. It does not use Next.js.

For this setup you need:

- Project URL
- Publishable key

Do not use the service-role or secret key in the app.

### 4. Create `.env.local`

Create a file called:

```text
.env.local
```

Put it in the main JIMRAMI project folder, beside `package.json`.

```text
JIMRAMI/
├─ .env.local
├─ package.json
├─ vite.config.ts
├─ src/
├─ public/
└─ android/
```

Add:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

`.env.local` should not be committed to Git.

### 5. Rebuild JIMRAMI

After changing `.env.local`, rebuild the app:

```bash
npm run build
```

The Supabase project details are added to the app during the build.

For Android, this means the configured Supabase project is built into the APK.

If you want an APK to use another Supabase project, change the configuration and build a new APK.

After Supabase is configured, its connection and sync controls are available under **Data** in JIMRAMI.

</details>

## About this project

JIMRAMI was made for our own family card game, so some rules, names and scoring are specific to how we play.
