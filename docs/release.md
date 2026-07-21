# Release Guide

Only Windows 10/11 and macOS (Intel and Apple Silicon) are supported. Linux is not a release target.

## Prerequisites

- Node.js 22 and pnpm 10.
- Stable Rust with the platform target installed.
- Tauri v2 operating-system prerequisites and WebView2 on Windows.
- Chromium installed with `pnpm exec playwright install chromium`.
- Windows packaging: WiX/NSIS prerequisites supplied by Tauri CLI.
- macOS packaging: Xcode command-line tools; signing requires an Apple Developer ID certificate.

## Local Gate

Run from the repository root:

```text
pnpm install --frozen-lockfile
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
pnpm playwright test
pnpm build
pnpm tauri build --no-bundle
```

The no-bundle command produces `src-tauri/target/release/flowchart-editor.exe` on Windows and `src-tauri/target/release/flowchart-editor` on macOS. Playwright evidence is under `playwright-report/` and `test-results/`, including `test-results/performance.json`.

## Bundles

- Windows: `pnpm tauri build --bundles nsis,msi` produces NSIS and MSI artifacts under `src-tauri/target/release/bundle/`.
- macOS: `pnpm tauri build --bundles app,dmg` produces app and DMG artifacts under the same target bundle directory.
- Cross-target CI adds the Rust target directory between `target/` and `release/`.

## Signing

Never commit certificates, passwords, private keys, or notarization credentials. CI reads only these secrets:

- Windows: `WINDOWS_CERTIFICATE` (base64 PFX), `WINDOWS_CERTIFICATE_PASSWORD`, `WINDOWS_CERTIFICATE_THUMBPRINT`.
- macOS signing: `APPLE_CERTIFICATE` (base64 P12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`.
- macOS notarization: `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`.

Tag workflows import certificates into temporary runner stores/keychains. If a complete secret set is absent, the workflow explicitly records that signing/notarization was skipped and builds unsigned bundles; it does not report a signed release.

## Artifacts And Rollback

Retain the Playwright HTML report, JSON report, screenshots/videos/traces on failures, performance JSON, native executable, and platform bundles for each release tag. Record checksums outside this repository before distribution.

For rollback, stop distribution of the affected tag, restore the previous signed installer/app/DMG and matching checksums, and publish a new patch tag after the full gate passes. Do not overwrite an existing release artifact or reuse its version.
