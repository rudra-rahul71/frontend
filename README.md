# TradeEngage Frontend

React Native (Expo) web application that provides a **voice-driven checklist** interface for field service technicians to submit job referrals hands-free.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  React Native Web App (Expo SDK 54)         │
│                                             │
│  RecordingScreen ──▶ SummaryScreen          │
│       │                                     │
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
| `App.tsx` | Navigation container with two screens |
| `screens/RecordingScreen.tsx` | Camera + audio recording UI, streams audio to backend via WebSocket |
| `screens/SummaryScreen.tsx` | Displays and allows editing of extracted job details |
| `hooks/useNetworkState.ts` | Monitors connectivity via `@react-native-community/netinfo` |
| `services/AudioWebSocketClient.ts` | WebSocket client for streaming audio and receiving tool calls |
| `services/OfflineStorage.ts` | AsyncStorage-based queue for offline payloads |

### How It Works

1. **Recording** — The technician opens the app in a web browser, sees a live camera preview, and presses record. Audio is captured and streamed as base64 PCM chunks over a WebSocket to the backend.
2. **Real-time Extraction** — As the backend relays Gemini tool calls, the checklist fields (name, phone, address, etc.) update live on screen.
3. **Offline Mode** — If connectivity is lost, the app switches to offline mode. Recordings and metadata are queued locally and synced when the connection returns.
4. **Summary & Edit** — After recording, the technician reviews the extracted data and can manually correct any fields before final submission.

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- The [TradeEngage Backend](../backend) running locally

### Installation

```bash
# Install dependencies
npm install

# Start the Expo dev server for web
npm run web
```

The app will open in your default browser at `http://localhost:8081`.

### Connecting to the Backend

Ensure the backend is running at `http://localhost:8000`. The WebSocket client connects to `ws://localhost:8000/ws/audio` by default.

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm run web` | Start in web browser |

---

## Tech Stack

- **React Native Web** via **Expo SDK 54**
- **React Navigation** (native stack)
- **expo-camera** — Live camera preview
- **expo-audio** — Audio recording
- **@react-native-community/netinfo** — Connectivity detection
- **@react-native-async-storage/async-storage** — Offline payload queue
- **TypeScript**
