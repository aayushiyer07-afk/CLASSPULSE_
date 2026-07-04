# ClassPulse ⚡

**Proxy-proof classroom attendance & engagement tracker**
IEEE WIE Hackathon · Theme: Smart India Through AI · PS1 (Smart Education) · Team LEADERS

ClassPulse verifies *physical presence* with rotating QR codes + BLE broadcast beacons, and measures *real engagement* with teacher-triggered micro-quizzes — summarised weekly by AI.

## Features

- **Rotating QR attendance** — session codes regenerate every 12 seconds (TOTP-style). Screenshots shared on WhatsApp are dead on arrival; the check-in flow rejects expired tokens.
- **BLE broadcast beacon proximity** — one-way advertisement signal (no pairing, no device caps), scales past 300 students per classroom. *Simulated in this web demo; native support via `react-native-ble-plx` in the planned React Native build.*
- **Continuous presence monitoring** — background BLE checks catch "mark and leave" behaviour.
- **Micro-quizzes** — 1–2 question checkpoints mid-lecture, the primary participation signal.
- **Engagement heatmap** — week x session grid showing exactly when the class disengages.
- **At-risk flags** — auto-flag students below 75% attendance or 50 participation.
- **AI weekly summaries** — LLM-generated per-student narratives (mocked in demo; live LLM API in full build).

## Demo walkthrough

1. **Home** — project overview
2. **Teacher / Live QR** — live rotating QR with countdown ring; scan it with a real phone camera to open the student check-in flow
3. **Student** — dashboard, live micro-quiz, session history, AI summary
4. **Analytics** — engagement heatmap, at-risk list, class roster

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React.js (Vite) → React Native (planned) |
| Backend | Node.js / Express *(planned — demo is client-side)* |
| Database | MongoDB *(planned)* |
| AI/ML | LLM API for weekly summaries *(planned)* |
| BLE | `react-native-ble-plx`, advertisement mode *(planned)* |
| Deployment | Vercel |

## Run locally

```bash
npm install
npm run dev
```

## Deploy

Push to GitHub, then import the repo on vercel.com and deploy. Vite is auto-detected; no config needed.

---

**Team LEADERS** — Aayushi (UPES Dehradun) · Akshobhyaa Venkatesh (IIT Delhi) · Ananay Nimbran (DTU)
