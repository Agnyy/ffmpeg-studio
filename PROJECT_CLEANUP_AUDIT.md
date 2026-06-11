# FFmpeg Studio — Project Cleanup Audit (Phase 1)

**Date:** 2026-06-11  
**Scope:** Read-only audit. No files deleted in this phase.  
**Active preview path:** `EnginePreviewPanel` → `previewEngine:*` IPC → `src/preview-engine/*` (+ `PreviewAudioController` / hidden `<audio>`).

---

## Executive summary

The working preview stack is isolated and healthy. A large **legacy Chromium / proxy / recovery preview UI layer** remains in the tree but is **not mounted** in `StudioLayout` (only `EnginePreviewPanel` is). Supporting infrastructure (quarantine, blocklist, proxy jobs, native preview cache) is still wired through `App.tsx` import flow and project panel status, even though engine preview opens `originalPath` directly.

**Safe Phase 2 targets:** dead preview React components, temporary fix reports, spike scripts, unused config flags, `drawTestPattern`, old `preview:e2e` runner (after confirming `preview:selftest` coverage).  
**Do not touch in Phase 2:** `src/preview-engine/*`, decode mutex, random access decoder, crash-test, render/export, shared project types.

---

## 1. Old preview systems

### 1.1 Active (working) — DO NOT DELETE

| file | used now | safe to delete | reason |
|------|----------|----------------|--------|
| `src/preview-engine/PreviewEngineHost.ts` | yes | no | Main-process engine session host |
| `src/preview-engine/videoPlayerSession.ts` | yes | no | Playback + seek session |
| `src/preview-engine/randomAccessDecoder.ts` | yes | no | Random-access decode path |
| `src/preview-engine/previewDecodeMutex.ts` | yes | no | FFmpeg pthread crash guard |
| `src/preview-engine/previewDecoderConfig.ts` | yes | no | threadCount=1, FF_THREAD_SLICE |
| `src/preview-engine/frameQueue.ts` | yes | no | Playback frame queue |
| `src/preview-engine/ipcTypes.ts` | yes | no | IPC contracts |
| `src/preview-engine/ipcFrame.ts` | yes | no | Frame serialization |
| `src/preview-engine/frameDiagnostics.ts` | yes | no | Dev diag logging (gated) |
| `src/preview-engine/nodeAvLoader.ts` | yes | no | node-av load |
| `src/preview-engine/nodeAvConstants.ts` | yes | no | Constants |
| `src/preview-engine/clock.ts` | yes | no | Playback clock |
| `src/preview-engine/frameTime.ts` | yes | no | Time helpers |
| `src/preview-engine/types.ts` | yes | no | Engine types |
| `src/preview-engine/formatReport.ts` | yes | no | Used by `preview:engine-spike` |
| `src/renderer/components/preview-engine/EnginePreviewPanel.tsx` | yes | no | **Main UI preview panel** |
| `src/renderer/components/preview-engine/usePreviewAudio.ts` | yes | no | Audio sync hook |
| `src/renderer/components/preview-engine/PreviewAudioController.ts` | yes | no | Hidden `<audio>` controller |
| `src/renderer/components/preview-engine/engineCanvasDraw.ts` | yes | no | Canvas draw (see `drawTestPattern` — dead export) |
| `src/renderer/components/videoPreviewHandle.ts` | yes | no | Ref handle type for timeline/controls |
| `src/shared/previewEngineConfig.ts` | yes | no | `PREVIEW_ENGINE_ENABLED = true` |
| `src/shared/previewBufferedRanges.ts` | yes | no | Cache bar ranges |
| `src/shared/ffmpegLogFilter.ts` | yes | no | UDTA log suppression |
| `src/main/ffmpegLogFilter.ts` | yes | no | Main stderr filter |

### 1.2 Legacy UI preview components — not mounted in active layout

`StudioLayout.tsx` imports only `EnginePreviewPanel`. None of the files below are imported by `StudioLayout`, `App.tsx` render tree, or `EnginePreviewPanel`.

| file | used now | safe to delete | reason |
|------|----------|----------------|--------|
| `src/renderer/components/VideoPreview.tsx` | no | yes* | Old Chromium + NodeAv bypass panel; contains `VideoPreviewChromium`. Not mounted. `App.tsx` imports **type only** from here — replace with `videoPreviewHandle.ts` first. |
| `src/renderer/components/NodeAvBypassPreview.tsx` | no | yes | Only imported by `VideoPreview.tsx` |
| `src/renderer/components/CompositionPreviewLayer.tsx` | no | yes* | Chromium `<video>` layer; only used by dead preview panels + `PrecompPreviewLayer` |
| `src/renderer/components/PrecompPreviewLayer.tsx` | no | yes | Only used by `VideoPreview.tsx` / `EditorPreviewPanel.tsx` |
| `src/renderer/components/NodeAvPreviewCanvas.tsx` | no | yes | Only used by dead preview panels; calls old `previewOpen` IPC via `nodeAvFrameCoordinator` |
| `src/renderer/components/preview/SimplePreviewPanel.tsx` | no | yes | Replaced by `EnginePreviewPanel`; config flag unused |
| `src/renderer/components/preview/EditorPreviewPanel.tsx` | no | yes | Alternate editor preview; not mounted |
| `src/renderer/components/preview/RecoveryPreviewHost.tsx` | no | yes | Dev recovery UI; `RECOVERY_PREVIEW = false`, never imported |
| `src/renderer/components/preview/RecoveryNodeAvRawCanvas.tsx` | no | yes | Only used by Simple/Recovery panels; uses old `previewOpen` IPC |
| `src/renderer/components/preview/resolveSimplePreviewFootage.ts` | no | yes | Only used by `SimplePreviewPanel` |
| `src/renderer/components/preview/resolveRecoveryFootage.ts` | no | yes | Only used by `RecoveryPreviewHost` |
| `src/renderer/components/preview/resolveLayerPreviewMode.ts` | no | yes* | Chromium vs node-av mode; only used by dead `PrecompPreviewLayer` / `EditorPreviewPanel` |
| `src/renderer/components/preview/simplePreviewConfig.ts` | no | yes | `SIMPLE_PREVIEW` / `RECOVERY_PREVIEW` — **not imported anywhere** |
| `src/renderer/components/preview/recoveryPreviewConfig.ts` | no | yes | Duplicate unused flag file |
| `src/renderer/preview/nodeAvFrameCoordinator.ts` | no | yes | Old IPC frame polling; only used by `NodeAvPreviewCanvas` |

\* Delete only after confirming no dynamic import and fixing `App.tsx` type import.

### 1.3 Old main-process preview service (`preview:*` IPC)

Separate from `previewEngine:*`. Still registered in `ipc.ts` and preload.

| file | used now | safe to delete | reason |
|------|----------|----------------|--------|
| `src/preview/PreviewService.ts` | partial | no** | Facade for old `preview:open/seek/decodeFrame` IPC |
| `src/preview/NodeAvPreviewService.ts` | partial | no** | Used by `PreviewService`, `scripts/preview-spike/nodeAvSmokeTest.ts` |
| `src/preview/ChromiumPreviewService.ts` | no | yes* | Stub service; main does not decode Chromium |
| `src/preview/nodeAvFrameDecode.ts` | partial | no** | Used by `NodeAvPreviewService` |
| `src/preview/nodeAvLoader.ts` | partial | no** | Duplicate loader for old service path |
| `src/preview/nodeAvConstants.ts` | partial | no** | Old service constants |
| `src/preview/types.ts` | partial | no** | Old preview types |
| `src/preview/NodeAvPreviewService.ts` (IPC handlers) | no (UI) | no** | IPC still exposed; dead UI called it |

\** Safe only after removing `preview:*` IPC handlers, preload methods, spike script, and verifying no external callers. **Not Phase 2 "obvious" delete** — needs staged removal.

### 1.4 Chromium / proxy / quarantine guard rails — still wired

Even with engine preview, import and safety rails remain active.

| file | used now | safe to delete | reason |
|------|----------|----------------|--------|
| `src/media/chromiumQuarantine.ts` | yes | no | Import flow + `App.tsx`; blocks original `<video>` src |
| `src/media/chromiumSessionBlocklist.ts` | yes | no | Session blocklist for failed Chromium paths |
| `src/media/videoSrcTrap.ts` | yes | no | Installed in `main.tsx`; global `<video src>` guard |
| `src/media/previewVideoDebug.ts` | partial | no* | Used by dead `CompositionPreviewLayer` **and** active `nativePreviewTest.ts` |
| `src/media/nativePreviewCache.ts` | yes | no | Import check cache; `App.tsx`, `videoSrcTrap`, diagnostics |
| `src/media/nativePreviewTest.ts` | yes | no | Post-import native preview probe (skipped when `PREVIEW_ENGINE_ENABLED`) |
| `src/media/mediaNativePreviewHints.ts` | yes | no | Skip reasons for native preview check |
| `src/media/mediaCompatibility.ts` | yes | no | Proxy/Chromium compatibility helpers; project panel |
| `src/media/previewState.ts` | yes | no | Proxy status labels, debug info for project panel |
| `src/ffmpeg/previewProxyBuilder.ts` | yes | no | Proxy job creation still in `App.tsx` |
| `src/renderer/utils/previewPlayback.ts` | partial | yes* | Types (`PreviewSyncMode`) still used by `PlaybackControls`; full utils mostly dead-panel |

\* `previewVideoDebug.ts` / `previewPlayback.ts`: trim dead exports later, don't delete whole files until imports audited.

### 1.5 Test pattern / RGB bars

| file | used now | safe to delete | reason |
|------|----------|----------------|--------|
| `engineCanvasDraw.ts` → `drawTestPattern()` | no | yes (function only) | **Defined but never called**; RGB bars debug helper |
| `EnginePreviewPanel` → `EMPTY_FRAME_DIAG.testPattern` | no | unknown | Field exists in diag struct; no UI path sets it true |

### 1.6 Temporary / dev preview debug panels (user-facing)

| file | used now | safe to delete | reason |
|------|----------|----------------|--------|
| `src/renderer/components/DebugDiagnosticsPanel.tsx` | yes (dev) | no | `NODE_ENV !== production` only — keep, gate is correct |
| `src/renderer/components/PreviewDebugBlock.tsx` | yes (dev) | no | Inside `DebugDiagnosticsPanel` only |
| `src/renderer/components/ThumbnailDebugPanel.tsx` | yes | no* | Mounted in `RightDock` always — **user-visible dev panel**; hide behind env flag in Phase 3 |
| `src/renderer/components/PerformancePanel.tsx` | yes (dev) | no | In `InfoPanel`; tracks render counts including dead `"VideoPreview"` label |
| `src/renderer/components/MediaPreviewDiagnostics.tsx` | yes | no | Project/footage status UI; proxy-related labels still shown |

---

## 2. Temporary tests and E2E junk

### 2.1 Active test infrastructure — KEEP

| file | used now | safe to delete | reason |
|------|----------|----------------|--------|
| `src/renderer/previewE2e/previewSelftestRunner.ts` | yes | no | Human-paced regression (seek10/play/pause/seek70) |
| `src/renderer/previewE2e/previewSelftestDriver.ts` | yes | no | Selftest driver exposure |
| `src/renderer/previewE2e/previewCrashTestRunner.ts` | yes | no | FFmpeg crash stress (10 cycles) |
| `src/renderer/previewE2e/previewCrashTestDriver.ts` | yes | no | Crash-test driver |
| `src/renderer/previewE2e/previewE2eDebug.ts` | yes | no | `__FFMPEG_STUDIO_PREVIEW_DEBUG__` API |
| `src/renderer/previewE2e/previewE2eWindow.d.ts` | yes | no | Debug API types |
| `src/renderer/previewE2e/usePreviewE2eBootstrap.ts` | yes | no | Wires drivers in App |
| `src/renderer/previewE2e/previewUiTestActions.ts` | yes | no | Timeline/play UI actions for tests |
| `src/renderer/previewE2e/canvasChecksum.ts` | yes | no | Checksum helper for E2E |
| `src/shared/previewSelftestTypes.ts` | yes | no | Selftest result types |
| `src/shared/previewCrashTestTypes.ts` | yes | no | Crash-test result types |
| `scripts/preview-selftest/runPreviewSelftest.ts` | yes | no | `npm run preview:selftest` |
| `scripts/preview-selftest/formatPreviewSelftestReport.ts` | yes | no | Report formatter |
| `scripts/preview-crash-test/runPreviewCrashTest.ts` | yes | no | `npm run preview:crash-test` |
| `scripts/preview-crash-test/formatPreviewCrashTestReport.ts` | yes | no | Report formatter |
| `scripts/check.mjs` | yes | no | `npm run check` gate |

**Env requirements:**
```bash
PREVIEW_SELFTEST_FILE="D:\path\video.mp4" npm run preview:selftest
PREVIEW_CRASH_TEST_FILE="D:\path\video.mp4" npm run preview:crash-test
```

### 2.2 Older / superseded test paths

| file | used now | safe to delete | reason |
|------|----------|----------------|--------|
| `src/renderer/previewE2e/previewE2eRunner.ts` | yes (e2e only) | yes* | Simpler smoke test; superseded by `previewSelftestRunner` for coverage |
| `src/renderer/previewE2e/previewE2eDriver.ts` | yes (e2e only) | yes* | Driver for old e2e |
| `scripts/preview-e2e/runPreviewE2e.ts` | yes | yes* | `npm run preview:e2e`; writes `tmp/preview-e2e-result.json` |
| `scripts/preview-e2e/formatPreviewE2eReport.ts` | yes | yes* | E2e report |
| `src/shared/previewE2eTypes.ts` | yes (e2e only) | yes* | Types for old e2e |
| `PREVIEW_E2E_TEST.md` | doc | yes (archive) | Documents old e2e script |

\* Keep until `preview:selftest` is confirmed as CI replacement. Overlap: e2e = import + first frame + play checksum; selftest = fuller human flow + audio checks.

### 2.3 Spike / stress scripts (dev-only)

| file | used now | safe to delete | reason |
|------|----------|----------------|--------|
| `scripts/preview-spike/nodeAvSmokeTest.ts` | dev | yes | Uses **old** `NodeAvPreviewService`; hardcoded default path |
| `scripts/preview-engine-spike/nodeAvPlayerSpike.ts` | dev | no* | Uses **new** `VideoPlayerSession` — useful low-level probe |
| `scripts/preview-selftest/seekHoldSmoke.ts` | dev | yes | Ad-hoc CLI; not wired to package.json; hardcoded path |

\* `preview:engine-spike` optional keep for contributors.

### 2.4 Tmp result writers

| path | used now | safe to delete | reason |
|------|----------|----------------|--------|
| `tmp/preview-selftest-result.json` | artifact | n/a | Gitignored; safe to rm locally |
| `tmp/preview-e2e-result.json` | artifact | n/a | Gitignored |
| `tmp/preview-crash-test-result.json` | artifact | n/a | Gitignored |
| `scripts/preview-spike/out/` | artifact | yes (folder) | Spike PNG output if present |

### 2.5 Test IDs

| test id | used now | safe to delete | reason |
|---------|----------|----------------|--------|
| `data-testid="engine-preview-canvas"` | yes | no | Selftest/crash-test canvas checks |
| `data-testid="engine-preview-audio"` | yes | no | Audio element hook |
| `data-testid="preview-play-button"` | yes | no | Selftest play toggle |
| `data-testid="preview-audio-mute-button"` | yes | no | Audio mute |
| `data-testid="timeline-*"` | yes | no | E2E timeline scrubbing |

All test IDs are used by `previewSelftestRunner` / `previewCrashTestRunner` / `previewUiTestActions`. Keep.

### 2.6 Temporary debug APIs

| API | used now | safe to delete | reason |
|-----|----------|----------------|--------|
| `window.__FFMPEG_STUDIO_PREVIEW_DEBUG__` | tests only | no | Gated by e2e/selftest/crash env flags |
| `window.ffmpegStudio.previewE2eEnabled` | e2e | yes* | With old e2e removal |
| `window.ffmpegStudio.previewSelftestEnabled` | selftest | no | Active |
| `window.ffmpegStudio.previewCrashTestEnabled` | crash-test | no | Active |
| `ffmpeg:thumbnailDebugPipe` IPC | yes | no* | Used by thumbnail pipeline (`thumbnailDebugPipe.ts`); misnamed "debug" but production path |

---

## 3. Documentation inventory

### 3.1 keep (GitHub / ongoing dev)

| file | notes |
|------|-------|
| `README.md` | **Outdated** (describes old MVP without timeline). Rewrite in Phase 3. |
| `REGRESSION_CHECKLIST.md` | Manual regression IDs — keep |
| `DEV_NOTES.md` | Architecture + manual test cases — keep (trim later) |
| `QA_CHECKLIST.md` | Keep |
| `THIRD_PARTY_NOTICES.md` | Keep |
| `.cursor/rules/regression-safety.mdc` | Agent rule — keep |
| `PROJECT_CLEANUP_AUDIT.md` | This file — keep through cleanup |

### 3.2 delete / archive (temporary fix reports & plans)

| file | reason |
|------|--------|
| `PREVIEW_ENGINE_PHASE1_REPORT.md` | Historical fix log |
| `PREVIEW_ENGINE_PHASE2A_REPORT.md` | Historical fix log |
| `PREVIEW_ENGINE_PHASE2A_FIX_REPORT.md` | Historical fix log |
| `PREVIEW_ENGINE_BLACK_SCREEN_REPORT.md` | Historical fix log |
| `PREVIEW_ENGINE_PLAYBACK_FIX_REPORT.md` | Historical fix log |
| `PREVIEW_ENGINE_PAUSED_FRAME_FIX_REPORT.md` | Historical fix log |
| `PREVIEW_ENGINE_OPEN_FRAME_FIX_REPORT.md` | Historical fix log |
| `PREVIEW_ENGINE_AUTO_SEEK_FIX_REPORT.md` | Historical fix log |
| `PREVIEW_BACKEND_SPIKE_REPORT.md` | Spike notes |
| `PREVIEW_PROXY_REGRESSION_REPORT.md` | Regression postmortem |
| `PREVIEW_BACKEND_RESEARCH.md` | Research notes |
| `PREVIEW_ARCHITECTURE_AUDIT.md` | Superseded by working engine |
| `PREVIEW_BLOCKER_DECISION.md` | Decision log |
| `PREVIEW_ENGINE_MILESTONE_PLAN.md` | Old plan |
| `PREVIEW_E2E_TEST.md` | Old e2e docs (archive or merge into DEV_NOTES) |
| `PROJECT_REVIEW.md` | Snapshot audit 2026-06-09; superseded |

**Recommendation:** move to `docs/archive/preview/` or delete in Phase 2. None are required for build/run.

---

## 4. Stubs, hacks, and diagnostics

### 4.1 TODO / FIXME / temporary markers

| location | marker | severity | action |
|----------|--------|----------|--------|
| `DEV_NOTES.md` | Project thumbnails v0.2 TODO | info | Keep in dev notes |
| `batch/batchCompositionBuilder.ts` | `createTemporaryLayer*` | false positive | Production batch helper names — keep |
| `simplePreviewConfig.ts` | "Main preview uses SimplePreviewPanel" | stale comment | Delete with file |
| `recoveryPreviewConfig.ts` | dev-only Recovery | stale | Delete with file |
| `previewEngineConfig.ts` | documents engine switch | active | Keep |

No critical `FIXME` / `HACK` in `src/preview-engine/` or `EnginePreviewPanel`.

### 4.2 console.log / console.warn (production noise)

| file | count | gated? | Phase 3 action |
|------|-------|--------|----------------|
| `engineCanvasDraw.ts` | 3 | no | Remove or gate `[ENGINE_DRAW]` logs |
| `EnginePreviewPanel.tsx` | 4 | partial | Gate `[TIMELINE_SEEK_DIRECT]`; keep warn for missing initialFrame |
| `frameDiagnostics.ts` | 2 | yes (`ENGINE_PREVIEW_DEV_DIAG`) | OK |
| `timelineSeekDebug.ts` | 4 | yes (`LOG_TIMELINE_SEEK_DEBUG`) | OK |
| `App.tsx` | 3 | no | `[PROXY_*]` logs — remove or dev-only |
| `chromiumQuarantine.ts` | 1 | no | Dev-only or remove |
| `videoSrcTrap.ts` | 1 | no | Keep (safety warning) |
| `dnd.ts` | 2 | no | Dev-only |
| `preload.ts` / `main.ts` / `ipc.ts` | e2e labels | e2e only | OK |
| `ffmpegLogFilter.ts` | 1 | on suppress | OK |

### 4.3 User-visible dev diagnostics (Phase 3 UI cleanup)

| item | location | issue |
|------|----------|-------|
| `audioStatusLabel` | `EnginePreviewPanel` | Always visible ("Audio: ready/loading/…") — hide when stable or gate behind dev flag |
| `engine-preview-status` badge | `EnginePreviewPanel` | Shows internal engine status — OK for editor, review wording |
| `ThumbnailDebugPanel` | `RightDock` | Always visible tab — should be dev-only |
| `SHOW_ENGINE_DEV_DIAG` block | `EnginePreviewPanel` | Correctly gated by `VITE_ENGINE_PREVIEW_DEV_DIAG=1` |
| `DebugDiagnosticsPanel` | `InfoPanel` | Correctly dev-only |
| Proxy/Chromium labels | `MediaPreviewDiagnostics`, project items | Misleading when engine uses originalPath — soften copy in Phase 3 |

### 4.4 Disabled / dead code blocks

| item | status |
|------|--------|
| `PREVIEW_ENGINE_ENABLED` false branch in `App.tsx` | Dead code path (flag always true) — keep for now or remove in later refactor |
| `VideoPreview` Chromium path | Entire component tree dead |
| `drawTestPattern` | Dead function |
| `simplePreviewConfig` / `recoveryPreviewConfig` | Dead flags |

---

## 5. Package scripts

| script | needed? | temp? | dangerous? | recommendation |
|--------|---------|-------|------------|----------------|
| `dev` | yes | no | no | **Keep** — primary dev entry |
| `typecheck` | yes | no | no | **Keep** |
| `build:bundle` | yes | no | no | **Keep** |
| `build` | yes | no | no | **Keep** |
| `check` | yes | no | no | **Keep** — CI gate |
| `dist` / `dist:portable` / `dist:installer` | yes | no | no | **Keep** — GitHub releases |
| `preview` | optional | no | no | **Keep** — Vite preview |
| `preview:selftest` | yes | no | no | **Keep** — regression |
| `preview:crash-test` | yes | no | no | **Keep** — FFmpeg crash guard |
| `preview:e2e` | optional | yes | no | **Remove or archive** after selftest confirmed |
| `preview:spike` | no | yes | no | **Remove** — old NodeAvPreviewService |
| `preview:engine-spike` | optional | yes | no | **Keep** for low-level dev OR document in DEV_NOTES |

---

## 6. Phase 1 conclusions

### 6.1 Что точно можно удалить (Phase 2 — safe)

**Dead preview UI (after fixing `App.tsx` type import):**
- `src/renderer/components/VideoPreview.tsx`
- `src/renderer/components/NodeAvBypassPreview.tsx`
- `src/renderer/components/CompositionPreviewLayer.tsx`
- `src/renderer/components/PrecompPreviewLayer.tsx`
- `src/renderer/components/NodeAvPreviewCanvas.tsx`
- `src/renderer/components/preview/SimplePreviewPanel.tsx`
- `src/renderer/components/preview/EditorPreviewPanel.tsx`
- `src/renderer/components/preview/RecoveryPreviewHost.tsx`
- `src/renderer/components/preview/RecoveryNodeAvRawCanvas.tsx`
- `src/renderer/components/preview/resolveSimplePreviewFootage.ts`
- `src/renderer/components/preview/resolveRecoveryFootage.ts`
- `src/renderer/components/preview/resolveLayerPreviewMode.ts`
- `src/renderer/components/preview/simplePreviewConfig.ts`
- `src/renderer/components/preview/recoveryPreviewConfig.ts`
- `src/renderer/preview/nodeAvFrameCoordinator.ts`

**Dead code fragments:**
- `drawTestPattern()` in `engineCanvasDraw.ts` (function only)

**Temporary docs (16 files):**
- All `PREVIEW_*_REPORT.md`, `PREVIEW_*_PLAN.md`, `PREVIEW_*_AUDIT.md`, `PREVIEW_BLOCKER_DECISION.md`, `PREVIEW_BACKEND_RESEARCH.md`, `PREVIEW_E2E_TEST.md`, `PROJECT_REVIEW.md`

**Scripts (after confirmation):**
- `scripts/preview-spike/` + `preview:spike` script
- `scripts/preview-e2e/` + `preview:e2e` script + `previewE2eRunner.ts` + `previewE2eDriver.ts` + `previewE2eTypes.ts`
- `scripts/preview-selftest/seekHoldSmoke.ts` (unwired)

### 6.2 Что нельзя трогать

- Entire `src/preview-engine/` directory
- `EnginePreviewPanel.tsx`, `usePreviewAudio.ts`, `PreviewAudioController.ts`
- `previewDecodeMutex.ts`, `randomAccessDecoder.ts`, `videoPlayerSession.ts`
- `previewSelftestRunner.ts`, `previewCrashTestRunner.ts` + their drivers/scripts
- `previewE2eDebug.ts`, `usePreviewE2eBootstrap.ts`, `previewUiTestActions.ts`
- Render/export: `src/ffmpeg/compositionRenderBuilder.ts`, job queue, batch
- Effects/keyframes/crop shared types and logic
- Project I/O: `projectPersistence.ts`, `shared/project.ts`, `shared/projectDocument.ts`
- `npm run check`, `npm run preview:crash-test` (keep script even if env file missing)

### 6.3 Что под вопросом

| item | question | risk if wrong |
|------|----------|---------------|
| `src/preview/*` + `preview:*` IPC | Remove old service entirely? | Breaks spike script; any hidden caller of `previewOpen` |
| Chromium quarantine / videoSrcTrap | Still needed without `<video>` preview? | Low-cost safety net — prefer **keep** until proven redundant |
| Proxy job pipeline | Still needed for engine preview? | Engine uses `originalPath`; proxy UI may confuse users but jobs still run |
| `preview:engine-spike` | Keep for contributors? | Low risk |
| `previewPlayback.ts` | Trim vs delete? | `PreviewSyncMode` type still imported |
| `README.md` | Full rewrite vs minimal patch | GitHub first impression |
| `ThumbnailDebugPanel` | Delete vs dev-gate? | User-visible debug |

### 6.4 Что нужно заменить (Phase 3)

| current | replacement |
|---------|-------------|
| `App.tsx` imports `VideoPreviewHandle` from `VideoPreview.tsx` | Import from `videoPreviewHandle.ts` |
| `README.md` MVP-only description | Accurate editor + engine preview docs |
| Visible `Audio: ready` label | Hide or dev-gate when audio works |
| `ThumbnailDebugPanel` in RightDock | Dev flag or remove from production dock |
| `PerformancePanel` "VideoPreview" label | Rename to `EnginePreviewPanel` or remove |
| Stale proxy/Chromium project status copy | "Engine preview uses source file" where applicable |

### 6.5 Scripts to keep for GitHub

```json
"dev", "typecheck", "build", "build:bundle", "check",
"dist", "dist:portable", "dist:installer",
"preview:selftest", "preview:crash-test"
```

Optional dev-only (document in DEV_NOTES, not required for CI):
```json
"preview:engine-spike"
```

### 6.6 Risks

| risk | mitigation |
|------|------------|
| Break working preview | Delete only files with zero imports from active tree; run `npm run check` after each batch |
| FFmpeg crash regression | Keep `preview:crash-test` and mutex code untouched |
| False dead-code deletion | Grep importers before delete; prefer one batch = one subsystem |
| Proxy/Chromium removal breaks import | Do **not** remove quarantine/blocklist in Phase 2 |
| README lies on GitHub | Phase 3 README rewrite before public release |
| Selftest/crash-test need video file | Document env vars; don't claim PASS without file |
| `App.tsx` PREVIEW_ENGINE_ENABLED=false branch | If someone sets false, dead VideoPreview is gone — acceptable if flag stays true |

---

## Appendix A — `.gitignore` / GitHub prep status

| item | status |
|------|--------|
| `.gitignore` | Minimal — covers `node_modules`, `dist`, `tmp`, `release` — **adequate** |
| `LICENSE` | In `package.json` as `GPL-3.0-or-later` — add `LICENSE` file in Phase 3 |
| `screenshots/` | Missing — add placeholder in Phase 3 if desired |
| `README.md` | Exists but **not GitHub-ready** (wrong feature list) |

---

## Appendix B — Suggested Phase 2 deletion order

1. Fix `App.tsx` import → `videoPreviewHandle.ts`
2. Delete dead preview UI folder files (batch 1)
3. Delete temporary markdown reports (batch 2)
4. Remove `drawTestPattern`, `preview:spike`, old `preview:e2e` (batch 3)
5. `npm run check`
6. Optional with env file: `preview:selftest`, `preview:crash-test`

---

*End of Phase 1 audit. No files were modified except creation of this document.*
