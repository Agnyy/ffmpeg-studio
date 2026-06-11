# Preview Engine Phase 2A Fix Report

**Date:** 2026-06-10  
**Scope:** Fix active `EnginePreviewPanel` path — playback, timeline seek, disable Chromium/still-frame side paths.

---

## Root causes found

### `Unsupported pixel format: -1`

| Source | File | Trigger |
|--------|------|---------|
| Chromium hidden `<video>` probe on import | `nativePreviewTest.ts` → `testNativeVideoPreview` → `document.createElement("video")` | `App.finalizeImportedFootage` called `runNativePreviewCheck` when `previewBackend` was default `chromium-video` |
| Secondary path | `mediaPostImport.ts` → `runNativePreviewCheck` | Same; only skipped when `previewBackend === "node-av"` |

**Not from** `EnginePreviewPanel` (no `<video>`). `videoSrcTrap` only logs assignments; it does not decode.

### `node-av decode: seek produced no frame`

| Source | File | Trigger |
|--------|------|---------|
| Still-frame decoder | `nodeAvFrameDecode.ts` (warning string) | `NodeAvPreviewService.decodeFrameAt` via `preview:decodeFrame` IPC |
| Coordinator | `nodeAvFrameCoordinator.ts` → `previewDecodeFrame` | Used by `NodeAvPreviewCanvas` / `RecoveryNodeAvRawCanvas` — **not mounted** in active path |

This message appeared when import or legacy still-frame path opened the old `PreviewService` session. With engine mode import skip + no still-frame UI mounted, active path should not call `decodeFrameAt`.

### Static preview frame

| Issue | Fix |
|-------|-----|
| `pullDisplayFrame` used timestamp match while playing; underruns returned frozen `lastFrame` | Playing mode now uses **FIFO** `queue.shift()` — each poll gets next decoded frame |
| RGBA over IPC not always `Uint8Array` in renderer | `rgbaFromIpc.ts` handles Buffer / typed array / `{ data: number[] }` |
| Timeline scrub not wired reliably | Paused: `compCurrentTime` → `getLayerSourceTime` → `previewEngine:seek`; playing: engine clock → `compCurrentTime` via `getState` |
| Session opened at t=0 only | After open, scrub effect seeks to current comp playhead |

---

## Changes made

### 1. Chromium probe disabled in engine mode

- `src/shared/previewEngineConfig.ts` — `PREVIEW_ENGINE_ENABLED = true`
- `App.finalizeImportedFootage` — if enabled: `engineImportPreviewPatch` only (ffprobe metadata + thumbnail path unchanged); **no** `runNativePreviewCheck`
- `mediaPostImport.runNativePreviewCheck` — early return `{ ok: true }` when `PREVIEW_ENGINE_ENABLED`
- `handleRetryChromiumPreview` — blocked with status message

### 2. Playback + timeline sync (`EnginePreviewPanel`)

- **Paused:** `compCurrentTime` → source time → `previewEngine:pause` + `previewEngine:seek` + `pollFrame` + canvas draw
- **Playing:** play transition → seek + `previewEngine:play`; rAF loop polls `getState` (updates App time) + `pollFrame` (draws new frames)
- **Controls:** Play/Pause/step/start/end update `compCurrentTime`; engine follows via effects above
- Status labels: `loading engine` / `opening file` / `buffering` / `playing` / `paused` / `engine error: ...`

### 3. Engine decode (`videoPlayerSession.ts`)

- `pullDisplayFrame()` — FIFO `shift()` when clock playing; timestamp match when paused

### 4. Active path unchanged

```text
StudioLayout → PreviewErrorBoundary → EnginePreviewPanel → previewEngine:* → PreviewEngineHost → VideoPlayerSession
```

No `CompositionPreviewLayer`, `NodeAvPreviewCanvas`, `previewDecodeFrame`, Chromium `<video>` in this path.

---

## Timeline ↔ engine time model

```text
PAUSED:
  Timeline click/drag → App compCurrentTime
    → EnginePreviewPanel engineSeekSourceTime(sourceTime)
    → previewEngine:seek → pollFrame → canvas

PLAYING:
  previewEngine:play → main clock advances
    → poll getState.playheadSec → sourceTimeToCompTime → App compCurrentTime
    → pollFrame (FIFO) → canvas update
```

Single writer to `compCurrentTime` while playing: engine state poll. While paused: App/timeline.

---

## Frames update on Play?

**Expected yes** after FIFO + rAF poll fix. Each play poll calls `shift()` on decode queue; decode loop fills queue while `clock.isPlaying()`.

Manual UI verification still required.

---

## Audio

Unchanged: label `Video engine preview: audio pending` (Phase 2B).

---

## Keyframes

Unchanged: `getEffectiveLayerTransform(layer, liveCompTime)` on canvas wrapper (position / scale / rotation / opacity).

---

## Automated check

`npm run check` — **pass**.

---

## Manual UI test

| # | Test | Result |
|---|------|--------|
| 1 | App starts | _not verified_ |
| 2 | Import problem MP4 | _not verified_ |
| 3 | No `Unsupported pixel format` in console | _not verified_ |
| 4 | No `seek produced no frame` in console | _not verified_ |
| 5 | Preview shows frame | _not verified_ |
| 6 | Play updates frames | _not verified_ |
| 7 | Pause stops | _not verified_ |
| 8 | Timeline click/drag updates frame | _not verified_ |
| 9 | Step frame works | _not verified_ |
| 10 | Position keyframes move wrapper | _not verified_ |
| 11 | No Chromium `<video>` in active path | _code audit: yes_ |
| 12 | `npm run check` pass | **pass** |

---

*End of Phase 2A fix report.*
