# Preview E2E Test

Automated smoke test for the **active** engine preview path (`EnginePreviewPanel` → `previewEngine:*` IPC).

## Run

```bash
npm run preview:e2e
```

Optional file override:

```bash
PREVIEW_E2E_FILE="D:\path\to\video.mp4" npm run preview:e2e
# or
npm run preview:e2e -- "D:\path\to\video.mp4"
```

Default problem file (if present): `C:\Users\New User\Videos\2026-06-04 23-03-21.mp4`

## What it does

1. Builds production bundle (`npm run build:bundle`)
2. Launches Electron with `PREVIEW_E2E=1`
3. Auto-imports test MP4 and creates composition layer
4. Waits for first canvas frame (checksum + draw count)
5. Toggles Play, waits 2s
6. Asserts canvas checksum changed
7. Writes `tmp/preview-e2e-result.json`
8. Prints PASS/FAIL report and exits

## PASS criteria

```text
first frame visible: yes
canvas checksum at 0s: non-zero
canvas checksum after play: non-zero
checksum changed after play: yes
preview error visible: no
app crashed: no
```

## Debug API (E2E mode only)

In renderer when `PREVIEW_E2E=1`:

```js
window.__FFMPEG_STUDIO_PREVIEW_DEBUG__.getCanvasChecksum()
window.__FFMPEG_STUDIO_PREVIEW_DEBUG__.getDrawCount()
window.__FFMPEG_STUDIO_PREVIEW_DEBUG__.getEngineState()
window.__FFMPEG_STUDIO_PREVIEW_DEBUG__.getLastError()
window.__FFMPEG_STUDIO_PREVIEW_DEBUG__.getVisibleError()
```

Not shown in normal UI.

## Next step

Only after this test reports **FAIL** with a clear reason should preview seek/playback code be changed.
