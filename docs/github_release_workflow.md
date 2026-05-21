# GitHub release workflow

This repository includes [`.github/workflows/release.yml`](../.github/workflows/release.yml) for packaging and publishing `fusenchat` with GitHub Actions.

## Trigger

- Push a tag like `v0.1.0`
- Or run `Actions > release > Run workflow`

If the workflow is started manually, it uses the current `package.json` version and publishes/updates tag `v<version>`.

## Published artifacts

- Windows: NSIS installer (`.exe`)
- macOS Intel: DMG (`x86_64`)
- macOS Apple Silicon: DMG (`aarch64`)

Bundle activation and icon configuration live in [src-tauri/tauri.conf.json](../src-tauri/tauri.conf.json). The workflow selects bundle types per platform:

- Windows: `--bundles nsis`
- macOS: `--bundles dmg`

## Required secrets

No extra secret is required for unsigned packaging beyond the built-in `GITHUB_TOKEN`.

## Optional Windows code-signing secrets

- `WINDOWS_CERTIFICATE`
  Base64-encoded `.pfx`
- `WINDOWS_CERTIFICATE_PASSWORD`
  Password for the `.pfx`

If both are set, the workflow imports the certificate on `windows-latest` before running `tauri build`.

## Optional macOS signing and notarization secrets

### Ad-hoc signing

If no Apple certificate is configured, the workflow falls back to ad-hoc signing by setting `APPLE_SIGNING_IDENTITY=-`.

### Developer ID signing

- `APPLE_CERTIFICATE`
  Base64-encoded `.p12`
- `APPLE_CERTIFICATE_PASSWORD`
  Password for the exported `.p12`
- `KEYCHAIN_PASSWORD`
  Temporary keychain password used on the runner

### Notarization

- `APPLE_API_PRIVATE_KEY`
  Base64-encoded App Store Connect `.p8`
- `APPLE_API_KEY`
  App Store Connect Key ID
- `APPLE_API_ISSUER`
  App Store Connect Issuer ID

Alternative Apple ID based notarization is also wired through if these secrets exist:

- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

## Reference

- Tauri GitHub pipeline guide: [v2.tauri.app/ja/distribute/pipelines/github](https://v2.tauri.app/ja/distribute/pipelines/github/)
- Tauri action: [github.com/tauri-apps/tauri-action](https://github.com/tauri-apps/tauri-action)
- macOS signing: [v2.tauri.app/ja/distribute/sign/macos](https://v2.tauri.app/ja/distribute/sign/macos/)
- Windows signing: [v2.tauri.app/ja/distribute/sign/windows](https://v2.tauri.app/ja/distribute/sign/windows/)
