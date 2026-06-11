# Preview Engine Phase 2A Report

**Date:** 2026-06-10  
**Scope:** Wire `src/preview-engine/` sequential player into main Preview UI.

---

## Active preview path

```text
StudioLayout
  → PreviewErrorBoundary
    → EnginePreviewPanel
      → IPC previewEngine:*
        → PreviewEngineHost (main)
          → VideoPlayerSession (src/preview-engine/)
```

**Not mounted in active path:**

- `EditorPreviewPanel`
- `CompositionPreviewLayer`
- `NodeAvPreviewCanvas`
- `NodeAvBypassPreview`
- `SimplePreviewPanel`
- `VideoPreview`
- `RecoveryPreviewHost`
- `RecoveryNodeAvRawCanvas`
- Chromium `<video>` in preview panel
- `previewDecodeFrame` / `NodeAvPreviewService.decodeFrameAt` from UI

Legacy files remain in repo; they are not imported by `StudioLayout` preview branch.

---

## Uses `src/preview-engine/`?

**Yes.** Main process `PreviewEngineHost` wraps `VideoPlayerSession`:

| IPC channel | Role |
|-------------|------|
| `previewEngine:open` | Open demuxer/decoder once, prime frame 0 |
| `previewEngine:close` | Tear down session |
| `previewEngine:play` | Start master clock |
| `previewEngine:pause` | Hold playhead |
| `previewEngine:seek` | Command seek + prime (not per-frame) |
| `previewEngine:getState` | Playhead + playing flag |
| `previewEngine:pollFrame` | Pull RGBA from sequential queue |

Old `preview:*` IPC (`decodeFrameAt`) still exists for legacy callers but is **not** used by `EnginePreviewPanel`.

---

## Chromium `<video>` in active path?

**No.** `EnginePreviewPanel` renders a single `<canvas>` inside a transform wrapper. No `<video>` element.

**Note:** Import-time `nativePreviewTest` / `videoSrcTrap` may still run elsewhere in the app; that is outside the active preview panel path. If `Unsupported pixel format` appears only on import probe, not during preview playback, it is from legacy import diagnostics — not from `EnginePreviewPanel`.

---

## Phase 2A features

| Feature | Status |
|---------|--------|
| Single footage layer | Yes — selected layer or first footage layer |
| Sequential decode | Yes — via `VideoPlayerSession` decode loop |
| Play / pause | Yes — engine clock + `PlaybackControls` |
| Scrub / seek | Yes — `previewEngine:seek` on paused comp time changes |
| Transform wrapper | Yes — `getEffectiveLayerTransform(layer, compCurrentTime)` |
| Position / scale / rotation / opacity keyframes | Yes — via effective transform on wrapper |
| Crop | Not applied in Phase 2A (deferred) |
| Multi-layer / precomp | Not in Phase 2A |
| Audio | **Pending** — label: `Video engine preview: audio pending` |

---

## Status messages (replaces “Preview unavailable”)

`EnginePreviewPanel` shows:

- `loading engine`
- `opening file`
- `ready` / `playing` / `paused`
- `engine error: <message>`
- `No footage layer for engine preview` (no layer, not “Preview unavailable”)

---

## New / changed files

| File | Change |
|------|--------|
| `src/renderer/components/preview-engine/EnginePreviewPanel.tsx` | New active preview UI |
| `src/renderer/components/preview-engine/resolveEnginePreviewLayer.ts` | Layer + originalPath resolver |
| `src/preview-engine/PreviewEngineHost.ts` | Main-process singleton |
| `src/preview-engine/ipcTypes.ts` | IPC result types |
| `src/preview-engine/videoPlayerSession.ts` | UI API: `startUi`, `play`, `pause`, `seekAndHold`, `pullDisplayFrame`, RGBA in queue |
| `src/main/ipc.ts` | `previewEngine:*` handlers |
| `src/main/preload.ts` | `previewEngine*` API on `window.ffmpegStudio` |
| `src/renderer/components/StudioLayout.tsx` | `EnginePreviewPanel` replaces `EditorPreviewPanel` |

---

## Automated check

`npm run check` — **pass** (typecheck + build).

---

## Manual UI test

**Not performed in this session** (requires interactive Electron run on user machine).

Checklist for human verification:

| # | Test | Result |
|---|------|--------|
| 1 | App starts | _not verified_ |
| 2 | Import problem MP4 | _not verified_ |
| 3 | Preview shows frame | _not verified_ |
| 4 | Play moves video | _not verified_ |
| 5 | Pause works | _not verified_ |
| 6 | Scrub / seek works | _not verified_ |
| 7 | No “Preview unavailable” | _not verified_ |
| 8 | No Chromium pixel-format in preview panel | _not verified_ |
| 9 | No `seek produced no frame` spam | _not verified_ |
| 10 | Position keyframes move layer | _not verified_ |
| 11 | No crash | _not verified_ |

Do not treat Phase 2A as user-verified until the above pass locally.

---

## Known limitations

1. **Playback rate** — UI control present; engine plays at 1× (rate not applied to master clock yet).
2. **IPC RGBA polling** — every animation frame pulls full buffer; may need shared memory / texture path later.
3. **Layer outside comp block** — placeholder text instead of frame.
4. **Crop** — not composited in engine canvas yet.

---

## Next step

**Phase 2B:** Audio decode + WebAudio + A/V sync in `src/preview-engine/`, then wire mute/volume in `EnginePreviewPanel`.

---

*End of Phase 2A report.*
