# Contributing

Thanks for contributing to Emdy.

## Local Setup

```bash
git clone https://github.com/ghaida/emdy.git
cd emdy/electron
npm install
```

## Run From Source

```bash
npm start
```

This starts the app with Electron Forge and Vite in dev mode.

Notes:

- Local development does not require `APPLE_ID` or `APPLE_ID_PASSWORD`.
- If you already have the production app installed, quit it before launching the dev app to avoid confusion.
- The local build still uses the app name `Emdy`, so settings and other local app data may be shared with the installed app.

## Build a Local App Bundle

```bash
npm run package
open out/Emdy-darwin-arm64/Emdy.app
```

This creates a local unsigned app bundle for testing. Release signing and notarization are only enabled when both `APPLE_ID` and `APPLE_ID_PASSWORD` are set.

## Checks

Before opening a PR:

```bash
npm run lint
```

## Pull Requests

- Keep changes focused.
- If you change behavior, include a short note on how you tested it.
- If you pick up an open issue, mention it in the PR description.
