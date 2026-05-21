# fusenchat

`fusenchat` is a Tauri desktop app that turns chat-style text input into reusable PNG speech bubbles.

## Features

- Generate one transparent PNG bubble per message
- Save bubbles under the app-managed cache directory
- Embed the original text into PNG metadata
- Drop a generated PNG back into the input area to restore and append its text
- Drag bubble images out of the app as files
- Copy image data, copy file paths, reveal saved files, and delete bubbles

## Stack

- Tauri v2
- React
- TypeScript
- Vite

## Development

Install dependencies:

```bash
npm ci
```

Run the app in development mode:

```bash
npm run tauri dev
```

Build the frontend:

```bash
npm run build
```

Build a desktop bundle:

```bash
npm run tauri build
```

## Release automation

GitHub Actions packaging for Windows and macOS is defined in [.github/workflows/release.yml](./.github/workflows/release.yml).

- Push a tag like `v0.1.0` to trigger a release build
- Windows publishes an NSIS installer
- macOS publishes DMG bundles for Apple Silicon and Intel

More detail is documented in [docs/github_release_workflow.md](./docs/github_release_workflow.md).
