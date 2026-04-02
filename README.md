# TradeEngage Frontend

React Native (Expo) web application that provides a **voice-driven checklist** interface for field service technicians to submit job referrals hands-free. This app is specifically optimized and focused for the **Web** platform.

---

## Architecture

```text
┌─────────────────────────────────────────────┐
│  React Native Web App (Expo SDK 54)         │
│                                             │
│  RecordingScreen ──▶ SummaryScreen          │
│       │                   (Online)          │
│       │                                     │
│       └─▶ WaitingScreen ──▶ SuccessScreen   │
│           (Offline)                         │
│                                             │
│       ├─ AudioWebSocketClient  (streaming)  │
│       ├─ useNetworkState       (connectivity)│
│       └─ OfflineStorage        (queue)      │
└─────────────────────────────────────────────┘
           │                          │
      WebSocket                  REST POST
      (online)                   (offline sync)
           │                          │
           ▼                          ▼
       Backend API             Backend API
    ws://host:8000/ws/audio   /api/offline-upload
```

### Key Files

| File / Directory | Purpose |
|---|---|
| `App.tsx` | Navigation container with four screens (`Recording`, `Summary`, `Waiting`, `Success`) |
| `screens/RecordingScreen.tsx` | Camera + audio recording UI, streams audio to backend via WebSocket |
| `screens/SummaryScreen.tsx` | Displays and allows editing of extracted job details (Online flow) |
| `screens/WaitingScreen.tsx` | UI displayed when saving recordings offline temporarily |
| `screens/SuccessScreen.tsx` | Confirmation UI shown after successful submission or offline saving |
| `hooks/useNetworkState.ts` | Monitors connectivity via `@react-native-community/netinfo` with exponential backoff for queue synchronization |
| `services/AudioWebSocketClient.ts` | WebSocket client for streaming audio and receiving tool calls |
| `services/OfflineStorage.ts` | AsyncStorage-based queue for offline payloads ("Store & Forward") |

### How It Works

1. **Recording** — The technician opens the app in a web browser, sees a live camera preview, and presses record. Audio is captured and streamed as base64 PCM chunks over a WebSocket to the backend. This relies on the native `expo-audio` package running via Web Audio APIs.
2. **Real-time Extraction** — As the backend relays Gemini tool calls over the active WebSocket, the checklist fields (name, phone, address, etc.) update live on screen.
3. **Offline Mode** — If connectivity is lost, the app switches to an offline state. Audio recordings and structural metadata are queued locally via `OfflineStorage`. Upon restoration of internet access, exponential backoff retries syncs payloads dynamically with the backend.
4. **Summary & Edit** — After recording, the technician reviews the extracted data and can manually correct any fields before final submission.

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- [TradeEngage Backend](../backend) running locally

### Installation

```bash
# Install dependencies
npm install

# Start the Expo dev server for Web
npm run web
```

### Supported Platforms

- **Web:** Launched using `npm run web`. The app will open automatically in your browser at `http://localhost:8081`. Note: Deployment to iOS/Android native is currently unstable and strictly experimental.

### Connecting to the Backend

By default, the web app restricts connections to the backend at `http://localhost:8000`. 
Ensure your FastAPI backend is running before streaming audio via `ws://localhost:8000/ws/audio`.

---

## Tech Stack

- **React Native Web** via **Expo SDK 54**
- **React Navigation** (Native Stack with `react-native-safe-area-context`)
- **expo-camera** — Live camera preview
- **expo-audio** — Web audio recording and permission handling
- **@react-native-community/netinfo** — Connectivity detection & event listener
- **@react-native-async-storage/async-storage** — Offline payload queue
- **TypeScript**
