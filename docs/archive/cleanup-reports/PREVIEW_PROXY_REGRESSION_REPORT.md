# Preview / Proxy Regression Pass

**Date:** 2026-06-09  
**Method:** Code-path audit + pure-logic verification + 2 bug fixes (watchdog race)  
**Build:** `npm run build` — see bottom  
**Manual GUI:** Requires local supported + unsupported MP4 (see checklist below)

---

## Summary

| Acceptance | Code audit | Notes |
|------------|------------|-------|
| Supported MP4 plays original | PASS | `native-preview-ok` → `getSafePreviewPathForItem` → original |
| Unsupported auto-creates proxy | PASS | `finalizeImportedFootage` → `handleCreatePreviewProxy` |
| Proxy used after done | PASS | `proxy-ready` → `getSafePreviewPathForItem` → `proxyPath` |
| No eternal Creating proxy | PASS* | *Fixed watchdog race (see Bugs) |
| No false Preview ready | PASS | `isPreviewPlayable()` gates label |
| Render uses original | PASS | `layer.sourcePath` / `getRenderPathForItem` |
| npm run build | PASS | After fixes |

---

## Scenario A — Supported MP4 (code trace)

| Step | Expected | Implementation | File:function |
|------|----------|----------------|---------------|
| 1 Import | Item + layer created | `importMediaFiles` → probe → `createFootageProjectItem` | `App.tsx`, `mediaCompatibility.ts` |
| 2 Native check | `checking-preview` | `finalizeImportedFootage` | `App.tsx` |
| 3 Native OK | `native-preview-ok`, `previewPath=original` | `runNativePreviewCheck` ok branch | `mediaPostImport.ts` |
| 4 Project Panel | `Media ready · Preview ready` | `projectPanelFootageStatus` | `thumbnailStatus.ts` |
| 5 Preview path | original | `getSafePreviewPathForItem` | `mediaCompatibility.ts` |
| 6 Preview source | `original` | `getPreviewSourceKind` | `mediaCompatibility.ts` |
| 7 `<video>` | Created with original file URL | `CompositionPreviewLayer` | `CompositionPreviewLayer.tsx` |
| 8 Play/Pause/Scrub | video-master or composition-clock | `VideoPreview.tsx`, `previewPlayback.ts` | — |
| 9 Audio | Audible layer volume | `previewAudio.ts:resolveAudibleLayerId` | — |
| 10 Render | original `-i` | `layer.sourcePath` | `compositionRenderBuilder.ts:422` |

### Logic verification (supported)

```
status=native-preview-ok, path=/media/clip.mp4, no failed cache
→ getSafePreviewPathForItem = /media/clip.mp4
→ getPreviewSourceKind = original
→ getFootagePreviewStatusLabel = Preview ready (isPreviewPlayable)
→ projectPanelFootageStatus = "Media ready · Preview ready"
→ getRenderPathForItem = /media/clip.mp4
```

---

## Scenario B — Unsupported MP4 (code trace)

| Step | Expected | Implementation | File:function |
|------|----------|----------------|---------------|
| 1 Import | Same as A | `importMediaFiles` | `App.tsx` |
| 2 Native fail | `native-preview-failed` | `runNativePreviewCheck` fail | `nativePreviewTest.ts` |
| 3 Cache | original blocked | `markNativePreviewFailed` | `nativePreviewCache.ts` |
| 4 Auto proxy | Job enqueued | `settings.autoCreatePreviewProxy` (default ON) → `handleCreatePreviewProxy` | `App.tsx` |
| 5 Status | `proxy-generating` | `handleCreatePreviewProxy` updates item | `App.tsx` |
| 6 Project Panel | `Media ready · Creating preview proxy…` | `getFootagePreviewStatusLabel` | `previewState.ts` |
| 7 Tasks | proxy job visible | `enqueueBackgroundJobs` → Tasks tab | `useBackgroundJobQueue.ts` |
| 8 Job done | verify size > 0 | `getMediaFileStats` in `handleBackgroundJobDone` | `App.tsx` |
| 9 ProjectItem | proxyPath, previewPath, `proxy-ready` | `handleBackgroundJobDone` proxy branch | `App.tsx` |
| 10 Project Panel | `Media ready · Proxy ready` | `getFootagePreviewStatusLabel` | `previewState.ts` |
| 11 Preview | proxy path | `getSafePreviewPathForItem` → `proxyPath` | `mediaCompatibility.ts` |
| 12 Render | still original | `layer.sourcePath` unchanged | `compositionRenderBuilder.ts` |

### Logic verification (unsupported, after proxy-ready)

```
status=proxy-ready, path=/media/bad.mp4, proxyPath=/proxies/id_preview_proxy.mp4
hasFailedNativePreview(original)=true
→ getSafePreviewPathForItem = proxyPath
→ getPreviewSourceKind = proxy
→ getFootagePreviewStatusLabel = Proxy ready
→ getRenderPathForItem = /media/bad.mp4 (original)
```

### Brief UI flicker (not a blocker)

Between native fail and `proxy-generating`, panel may show `Media ready · Preview unsupported` for one frame. Then switches to Creating proxy.

---

## Bugs found and fixed

### BUG-1 — Watchdog false `proxy-failed` after successful proxy (MAJOR)

| Field | Value |
|-------|-------|
| **Scenario** | B — after proxy job done |
| **Expected** | `proxy-ready`, preview plays proxy |
| **Actual** | Watchdog could set `proxy-failed`: "Proxy completed but preview file was not applied." |
| **Cause** | `useEffect` watchdog saw `job.status=done` + `item.proxyPath` empty while `handleBackgroundJobDone` still async (await `getMediaFileStats`) |
| **Files** | `src/renderer/App.tsx` (proxy-generating watchdog) |
| **Fix** | Skip `done && !proxyPath` branch; let `handleBackgroundJobDone` apply paths |

### BUG-2 — Manual Retry Proxy false `proxy-failed` (MINOR)

| Field | Value |
|-------|-------|
| **Scenario** | B — user clicks Retry Proxy after earlier failure |
| **Expected** | `proxy-generating` until job completes |
| **Actual** | Watchdog could set `proxy-failed`: "Proxy job did not start." within 2s |
| **Cause** | `lastPreviewCheckAt` stale (from import); 15s grace expired; job not yet in `jobs` |
| **Files** | `src/renderer/App.tsx:handleCreatePreviewProxy` |
| **Fix** | Set `lastPreviewCheckAt` when starting proxy job |

---

## Manual test checklist (local MP4 required)

Copy this table when testing with real files:

### Scenario A — supported MP4

| # | Check | Pass | Debug block values |
|---|-------|------|-------------------|
| A1 | Import completes | ☐ | compatibilityStatus → native-preview-ok |
| A2 | Panel: `Media ready · Preview ready` | ☐ | |
| A3 | Preview source = original | ☐ | previewPath = sourcePath |
| A4 | Play 10s | ☐ | |
| A5 | Pause + scrub | ☐ | |
| A6 | Audio audible | ☐ | |
| A7 | Render output uses original file | ☐ | job input = sourcePath |

### Scenario B — unsupported MP4

| # | Check | Pass | Debug block values |
|---|-------|------|-------------------|
| B1 | Native fail (no false Preview ready) | ☐ | native-preview-failed |
| B2 | Auto proxy starts | ☐ | proxy-generating |
| B3 | Panel: Creating proxy (not stuck) | ☐ | |
| B4 | Tasks: proxy job + progress/log | ☐ | proxy job status = running |
| B5 | After done: proxy file exists, size > 0 | ☐ | |
| B6 | proxyPath = previewPath = output | ☐ | compatibilityStatus = proxy-ready |
| B7 | Panel: Proxy ready | ☐ | |
| B8 | Preview source = proxy | ☐ | previewPath = proxyPath |
| B9 | Preview plays | ☐ | |
| B10 | Render still uses original | ☐ | |

**Debug block location:** Preview panel bottom + Info tab (selected footage).

---

## Files inspected

```
src/renderer/App.tsx                    — import, proxy handlers, watchdog
src/media/mediaCompatibility.ts         — path resolution, state machine
src/media/previewState.ts               — labels, debug info
src/media/mediaPostImport.ts            — native check orchestration
src/media/nativePreviewTest.ts          — hidden video probe
src/media/nativePreviewCache.ts         — fail cache
src/media/thumbnailStatus.ts            — project panel status string
src/renderer/components/CompositionPreviewLayer.tsx
src/renderer/components/VideoPreview.tsx
src/renderer/hooks/useBackgroundJobQueue.ts
src/ffmpeg/compositionRenderBuilder.ts  — render path (read-only)
```

---

## Regression checklist IDs

- IMP-1, IMP-2, IMP-3
- PRV-1, PRV-2, PRV-3, PRV-4, PRV-5

---

## Task completion template

### Changed
- `App.tsx` — watchdog race fix (BUG-1), `lastPreviewCheckAt` on proxy start (BUG-2)
- `PREVIEW_PROXY_REGRESSION_REPORT.md` — this report

### Not touched
- thumbnails, effects, smart presets, keyframes, composition/precompose, render builder

### Regression checklist verified
- **Automated:** `npm run build` — pass
- **Manual:** not verified (no local MP4 in CI); use checklist above
