# The Oaks Performance Portal

A progressive web app (PWA) for The Oaks Rugby Team to track pre-season Strength & Conditioning.

## Features

*   **Athlete Portal**: Frictionless login (select name), daily workout tracking, and video guides.
*   **Coach Dashboard**: Team-wide leaderboard, traffic-light completion tracking, and detailed performance metrics.
*   **Offline Capable**: Works via LocalStorage if Firebase is not configured.
*   **Cloud Sync**: Real-time updates via Firebase Firestore.

## Tech Stack

*   React 18 + TypeScript
*   Vite (Build Tool)
*   Tailwind CSS (Styling)
*   Firebase (Auth, Firestore)
*   Lucide React (Icons)

## Setup

1.  **Install dependencies**
    ```bash
    npm install
    ```

2.  **Configure Firebase**
    *   Create a project at [console.firebase.google.com](https://console.firebase.google.com)
    *   Copy your config object
    *   Paste it into `services/db.ts`

3.  **Run Locally**
    ```bash
    npm run dev
    ```

4.  **Build for Production**
    ```bash
    npm run build
    ```
