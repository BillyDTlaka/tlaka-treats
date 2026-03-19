# Tlaka Treats Admin — Mobile App

Built with Expo (React Native). Requires the API to be running.

## Setup

1. Install deps: `npm install`
2. Copy env: `cp .env.example .env` and set your API URL
3. Start: `npx expo start`
4. Scan QR with Expo Go app on your phone

## Screens

- **Dashboard** — KPI cards, alerts, recent orders
- **Orders** — List with status filter, expand to view details and advance status
- **Stock** — Ingredient levels with traffic-light colouring, tap to adjust
- **People** — Active staff list + pending leave approval
- **Bohlale** — AI chat with streaming responses

## Building for distribution

- Development: `npx expo start`
- Preview APK/IPA: `npx eas build --profile preview`
- Production: `npx eas build --profile production`
