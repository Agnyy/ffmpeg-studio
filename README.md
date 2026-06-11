# FFmpeg Studio

**This is an active prototype / work-in-progress editor.** It is not production-stable.

FFmpeg Studio is an unofficial open-source desktop video editor built on Electron, React, and FFmpeg (via [node-av](https://www.npmjs.com/package/node-av)).

This project is **not affiliated with or endorsed by** the FFmpeg project.

## What it is

A desktop studio for importing footage, editing on a timeline, previewing with a native FFmpeg decode engine, and exporting renders through FFmpeg job queues.

Features and APIs change frequently. Expect rough edges, incomplete workflows, and regressions until manual release checks are done.

## Current features

- Import video (drag-and-drop or file picker)
- Project panel and multi-composition timeline
- Layer transforms, crop, effects, and keyframes (work in progress)
- **Preview engine** — node-av / FFmpeg decode in the main process
- **Random-access frame preview** — seek while paused or playing
- Play / pause / scrub with timeline sync
- **Audio preview** — HTML `<audio>` synced to engine playhead
- Preview cache / buffered range indicators on the timeline
- Background FFmpeg jobs — proxy, preview cache, composition render, batch
- **Crash-safe decode** — global decode mutex, single-thread decoder config
- Automated preview regression scripts (selftest, crash-test)

## Tech stack

- **Electron** — desktop shell and IPC
- **React** + **TypeScript** — renderer UI
- **Vite** — dev server and production bundle
- **FFmpeg / ffprobe** — media probe, transcode, render
- **node-av** — native preview decode

## Requirements

- Node.js 18+
- npm
- Windows (primary target; other platforms may work with setup changes)

## Install

```bash
npm install
```

## Development

Start the app with hot reload:

```bash
npm run dev
```

On Windows you can also use `start-dev.bat`.

## Quality checks

Typecheck and production bundle:

```bash
npm run check
```

## Build

```bash
npm run build
```

Windows distributables:

```bash
npm run dist              # portable + installer
npm run dist:portable     # portable .exe only
npm run dist:installer    # NSIS installer only
```

Output appears in `release/`.

## Preview regression tests

These launch Electron headlessly, import a test MP4, exercise preview, and write JSON results under `tmp/`.

**Selftest** (human-paced flow: seek, play, pause, audio checks):

```powershell
$env:PREVIEW_SELFTEST_FILE="C:\path\to\video.mp4"
npm run preview:selftest
```

**Crash test** (stress overlapping decode paths; use light mode for CI / low RAM):

```powershell
$env:PREVIEW_CRASH_TEST_FILE="C:\path\to\video.mp4"
npm run preview:crash-test:light
```

Both require a real local MP4. Do not expect PASS without setting the env variable.

Optional engine dev diagnostics in the UI:

```bash
VITE_ENGINE_PREVIEW_DEV_DIAG=1 npm run dev
```

## FFmpeg resolution

When **Auto** is selected in Settings, FFmpeg is resolved in order:

1. Custom path from Settings
2. Bundled binaries in `resources/bin` (packaged releases)
3. `ffmpeg-ffprobe-static` npm package (development)
4. System `PATH`

Both `ffmpeg` and `ffprobe` are verified with `-version` before use.

## Known limitations

- Crash-test may require enough RAM and a real local MP4; headless Electron can OOM before import completes
- Export pipeline is still under development
- Audio/video sync may need more testing on different files
- Old preview/proxy infrastructure may still exist internally
- Project is under active development — APIs and UI will change

## Documentation

- [GITHUB_RELEASE_CHECKLIST.md](GITHUB_RELEASE_CHECKLIST.md) — manual checks before publishing
- [REGRESSION_CHECKLIST.md](REGRESSION_CHECKLIST.md) — detailed regression scenarios
- [DEV_NOTES.md](DEV_NOTES.md) — contributor architecture notes
- [PROJECT_CLEANUP_AUDIT.md](PROJECT_CLEANUP_AUDIT.md) — cleanup audit (Phase 1)

## License

FFmpeg Studio is licensed under [GNU General Public License v3.0 or later](LICENSE).

## Disclaimer

FFmpeg is a trademark of Fabrice Bellard. FFmpeg Studio is an unofficial GUI project.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party components.
