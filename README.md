<p align="center">
  <img src="public/Jim_README.png" alt="JIMRAMI" width="300">
</p>

JIMRAMI is a four-player card game derived from "Rummy" or "Gin Rummy", with its own scoring and round rules. This project is a score and session tracker for the game.

It can be used as a **web app** in the browser, or built as an **Android app** with Capacitor.

- [Open the web app](https://zainurdoto.github.io/jimrami/)
- [Download sample data](https://zainurdoto.github.io/jimrami/demo_data.zip)
- [Download the latest Android APK](https://github.com/zainurdoto/jimrami/releases/latest)

## Features

- Standard rounds
- Jim rounds
- Penalty
- Goalpost and Deuce
- Player names and nicknames
- Session history
- Player statistics and awards
- Title Race
- Local backup and restore
- (Optional) Supabase sync between devices 

## Built with

<details>
<summary><strong>Show details</strong></summary>

- React
- TypeScript
- Vite
- Dexie / IndexedDB for local data
- Motion for UI animation
- Capacitor for Android
- Supabase for optional cloud sync
- Github Pages for web hosting


</details>

## Development setup

<details>
<summary><strong>Show details</strong></summary>

Common development tools:

- Node.js
- npm
- VSCodium
- Android Studio for Android builds

VSCodium is optional. Any suitable code editor can be used.

</details>

## Data and backups

<details>
<summary><strong>Show details</strong></summary>

JIMRAMI is **local-first**.

By default, data is stored on the device running the app. No account, server or Supabase project is required for normal use.

Use **Data → Export Backup** to save the players, sessions, rounds and results as a JSON file.

A backup can later be imported on the same device or another device using **Data → Import Backup**.

Importing a backup replaces the JIMRAMI data currently stored on that device.

Sample data is available here:

- [Download sample data](https://zainurdoto.github.io/jimrami/demo_data.zip)

To preview the app with sample data:

1. Download and unzip the sample data.
2. Open **Data** in JIMRAMI.
3. Choose **Import Backup**.
4. Select the JSON file.

</details>

## Run locally

<details>
<summary><strong>Show details</strong></summary>

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

To create a production build:

```bash
npm run build
```

</details>

## Build the Android app

<details>
<summary><strong>Show details</strong></summary>

JIMRAMI uses Capacitor to package the web app as an Android app.

Build the web app:

```bash
npm run build
```

Sync the build to the Android project:

```bash
npx cap sync android
```

Open the Android project:

```bash
npx cap open android
```

Android Studio will open. The APK can then be built from Android Studio.

If Supabase sync is required in the APK, configure Supabase **before** running `npm run build`.

</details>

## Deploy to GitHub Pages

<details>
<summary><strong>Show setup instructions</strong></summary>

GitHub Pages hosts the web version of JIMRAMI.

### First-time setup

1. Push the JIMRAMI repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push a commit to the `main` branch.

That is all that is required for a normal local-only deployment.

GitHub Actions will automatically build JIMRAMI and publish the web app. The `dist` folder does **not** need to be uploaded or committed manually.

The site will normally be available at:

```text
https://USERNAME.github.io/REPOSITORY/
```

For this repository:

https://zainurdoto.github.io/jimrami/

### Optional Supabase setup for GitHub Pages

Only do this if Supabase cloud sync is configured.

1. Open **Settings → Secrets and variables → Actions**.
2. Open the **Variables** tab.
3. Add these 2 variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```
with values obtained from Supabase - **Connect**. See [Optional Supabase cloud sync](#optional-supabase-cloud-sync).

4. Push a new commit to `main`, or rerun the deployment workflow.

If these variables are not configured, JIMRAMI still works normally with local data only.

</details>

## Optional Supabase cloud sync

<details>
<summary><strong>Show setup instructions</strong></summary>

Supabase is optional. JIMRAMI works normally without it.

When configured, Supabase can sync JIMRAMI data between devices.

### 1. Create a Supabase project

Create a project in Supabase.

Open the **SQL Editor** and run:

```text
supabase/schema.sql
```

This creates the tables and database setup used by JIMRAMI.

### 2. Create a user

Open **Authentication** in Supabase and create the user account that will be allowed to connect to the JIMRAMI database.

JIMRAMI does not provide public account registration.

### 3. Get the connection details

In the Supabase project, click **Connect**.

Use the **Framework** client-library setup.

For JIMRAMI:

- Framework: **React**
- Build tool (Variant): **Vite**

Copy the:

- Project URL
- Publishable key

Do not use a service-role or secret key in the app.

### 4. Create `.env.local`

Create a file named:

```text
.env.local
```

Place it in the project root, beside `package.json`.

```text
JIMRAMI/
├─ .env.local
├─ package.json
├─ vite.config.ts
├─ src/
├─ public/
└─ android/
```

Paste inside:

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

For Android, the configured Supabase project is therefore built into the APK.

To use a different Supabase project, change the configuration and build a new APK.

After Supabase is configured, its connection and sync controls are available under **Data** in JIMRAMI.

</details>
