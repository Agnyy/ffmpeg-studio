# Preview Architecture Audit

**Date:** 2026-06-10  
**Scope:** Read-only audit of all preview-related systems in FFmpeg Studio.  
**Code state:** As of current workspace (post stabilization attempts). No code was modified to produce this document.

---

## Current Summary

The preview stack has **at least six parallel architectures** accumulated over debugging sessions:

1. **Legacy composition preview** (`VideoPreview` → `VideoPreviewChromium` → per-layer `<video>`)
2. **Chromium quarantine / compatibility gate** (`getChromiumVideoSrc`, session blocklist, native preview test)
3. **Proxy preview path** (proxy jobs, `proxy-ready`, overlay UI — mostly dormant in main panel but still in codebase)
4. **node-av main-process decode** (`PreviewService` / `NodeAvPreviewService` + canvas components)
5. **Hard bypass** (`NodeAvBypassPreview` inside `VideoPreview` when `previewBackend === "node-av"`)
6. **Recovery + Simple preview** (`RecoveryPreviewHost`, `SimplePreviewPanel` — feature-flagged)

**What actually renders the preview panel today:**

```
StudioLayout
  └─ SIMPLE_PREVIEW === true  (simplePreviewConfig.ts)
       └─ PreviewErrorBoundary
            └─ SimplePreviewPanel
                 ├─ previewBackend === "node-av"  → RecoveryNodeAvRawCanvas → IPC node-av
                 └─ previewBackend === "chromium-video" → <video controls src={toFileUrl(original)}>
```

`VideoPreview`, `VideoPreviewChromium`, `NodeAvBypassPreview`, and `RecoveryPreviewHost` are **imported but not mounted** while `SIMPLE_PREVIEW = true`.

---

## Active Preview Path

### Scenario A — App start, no media

| Step | What happens |
|------|----------------|
| `StudioLayout` | `SIMPLE_PREVIEW` → `SimplePreviewPanel` |
| `resolveSimplePreviewFootage` | `projectItems.length === 0` |
| Screen | Empty state: **"No project items"** + Import Media button |

No `<video>`, no node-av IPC.

---

### Scenario B — Import normal MP4, `previewBackend = chromium-video` (default)

| Step | Component / function |
|------|----------------------|
| Import | `App.finalizeImportedFootage` → `runNativePreviewCheck` → `testNativeVideoPreview` (hidden `<video>`) |
| On success | `chromiumOkImportPatch` → `native-preview-ok` |
| On fail | `chromiumFailImportPatch` + `markNativePreviewFailed` → `native-preview-failed` |
| Preview panel | `SimplePreviewPanel` → `resolveSimplePreviewFootage` → first/selected footage |
| Display | `<video src={toFileUrl(originalPath)} controls>` |
| Quarantine | **Not used** by SimplePreviewPanel (direct original path) |
| Composition | **Ignored** — no timeline layers required |

Path: `Project item → resolveSimplePreviewFootage → toFileUrl(original) → <video> → screen`

---

### Scenario C — Import problematic MP4 (Chromium `Unsupported pixel format: -1`)

| Step | What happens |
|------|----------------|
| Import (chromium backend) | `testNativeVideoPreview` creates `document.createElement("video")` on **original** → may log pixel format error in DevTools; may set `native-preview-failed` |
| SimplePreviewPanel (chromium) | Still assigns **original** to `<video>` → error can **repeat** in console during preview |
| SimplePreviewPanel (node-av) | `RecoveryNodeAvRawCanvas` → `previewOpen` / `previewDecodeFrame` → canvas (no Chromium `<video>` for panel) |
| Project item state | May show `native-preview-failed`, proxy badges in diagnostics panels |

Path (node-av): `Project item → RecoveryNodeAvRawCanvas → IPC → NodeAvPreviewService → canvas`

Path (chromium): `Project item → <video original> → Chromium decode fail (console + inline error)`

---

### Scenario D — Settings `previewBackend = node-av`

| Step | What happens |
|------|----------------|
| Import | `finalizeImportedFootage` skips native preview test → `nodeAvImportPreviewPatch` only |
| Preview panel | `SimplePreviewPanel` → `useNodeAv = true` → `RecoveryNodeAvRawCanvas` |
| IPC | `preview:open` / `preview:decodeFrame` (main always passes `"node-av"`) |
| Timeline / layers | **Not used** for display |
| `NodeAvPreviewCanvas` / `NodeAvBypassPreview` | **Not mounted** (only reachable if `SIMPLE_PREVIEW = false`) |

Path: `Project item → originalPath → RecoveryNodeAvRawCanvas → PreviewService → screen`

---

### Scenario E — Settings `previewBackend = chromium-video` (with `SIMPLE_PREVIEW = false` hypothetically)

If flags were reverted to legacy routing:

```
StudioLayout → VideoPreview
  ├─ previewBackend === "node-av" → NodeAvBypassPreview → NodeAvPreviewCanvas
  └─ else → VideoPreviewChromium
       ├─ CompositionPreviewLayer (per layer, getChromiumVideoSrc gate)
       ├─ PrecompPreviewLayer (nested CompositionPreviewLayer)
       ├─ PreviewCacheVideo (if useCachedPreview)
       └─ proxyOverlayState overlay + MediaPreviewDiagnostics
```

This is the **full legacy path** — currently **disabled** by `SIMPLE_PREVIEW = true`.

---

## Existing Preview Systems

| File / component | Exists | Used in UI now? | Imported by | Mode / flag | Backend | Can assign `<video src>`? |
|------------------|--------|-----------------|-------------|-------------|---------|---------------------------|
| `VideoPreview.tsx` (wrapper) | Yes | **No** (`SIMPLE_PREVIEW`) | `StudioLayout` | `SIMPLE_PREVIEW=false`; delegates to bypass or chromium | Both | Indirectly via children |
| `VideoPreviewChromium` | Yes (inside `VideoPreview.tsx`) | **No** | `VideoPreview` | `previewBackend !== node-av` | Chromium + proxy gate | Yes (layers, cache) |
| `CompositionPreviewLayer.tsx` | Yes | **No** (needs VideoPreviewChromium) | `VideoPreviewChromium`, `PrecompPreviewLayer` | Per timeline layer | Chromium via `assignChromiumVideoSource` | **Yes** — `getChromiumVideoSrc` → original or proxy |
| `PrecompPreviewLayer.tsx` | Yes | **No** | `VideoPreviewChromium` | Precomp nesting | Chromium (child layers) | **Yes** (via CompositionPreviewLayer) |
| `PreviewCacheVideo.tsx` | Yes | **No** | `VideoPreviewChromium` | `useCachedPreview && cachePlayable` | Chromium (cached MP4 file) | **Yes** — `toFileUrl(cachePath)` |
| `NodeAvPreviewCanvas.tsx` | Yes | **No** | `NodeAvBypassPreview` only | `SIMPLE_PREVIEW=false` + `node-av` | node-av canvas | No (canvas); uses `Image.src` for dataUrl fallback |
| `NodeAvBypassPreview.tsx` | Yes | **No** | `VideoPreview` wrapper | `previewBackend === node-av"` + `SIMPLE_PREVIEW=false` | node-av | No |
| `SimplePreviewPanel.tsx` | Yes | **Yes** (main panel) | `StudioLayout` | `SIMPLE_PREVIEW=true` | chromium `<video>` or node-av canvas | **Yes** (chromium mode only) |
| `RecoveryPreviewHost.tsx` | Yes | **No** (`RECOVERY_PREVIEW=false`) | `StudioLayout` (dead branch) | `RECOVERY_PREVIEW=true` | Both raw tabs | **Yes** (Chromium Raw tab) |
| `RecoveryNodeAvRawCanvas.tsx` | Yes | **Yes** (via SimplePreviewPanel) | `SimplePreviewPanel`, `RecoveryPreviewHost` | node-av branch | node-av canvas | No |
| `PreviewErrorBoundary.tsx` | Yes | **Yes** | Wraps `SimplePreviewPanel` | Always when simple preview | N/A | No |
| `resolveSimplePreviewFootage.ts` | Yes | **Yes** | `SimplePreviewPanel` | Footage picker | N/A | No |
| `resolveRecoveryFootage.ts` | Yes | **No** (unless recovery flag) | `RecoveryPreviewHost` | Recovery only | N/A | No |
| `MediaPreviewDiagnostics.tsx` | Yes | **No** (only in VideoPreviewChromium) | `VideoPreviewChromium` | Proxy/unsupported overlay | N/A | No |
| Proxy overlay in `VideoPreview.tsx` | Yes | **No** | Internal to VideoPreviewChromium | `proxyOverlayState` | N/A | No |
| `nativePreviewTest.ts` | Yes | **Yes** (on import) | `mediaPostImport.runNativePreviewCheck` | chromium backend import | Chromium hidden video | **Yes** — `createElement("video")` on original |
| `previewVideoDebug.ts` | Yes | **No** in simple path | `CompositionPreviewLayer`, `nativePreviewTest` | Gate + test | Chromium | **Yes** |
| `mediaCompatibility.ts` (`getChromiumVideoSrc`) | Yes | **No** in simple path; **Yes** in legacy | Layers, timeline `previewPathBySourcePath`, diagnostics | Quarantine gate | Chromium path picker | Indirect |
| `chromiumQuarantine.ts` | Yes | Metadata / import patches | App, mediaPostImport, project load | On fail / retry | N/A | No |
| `chromiumSessionBlocklist.ts` | Yes | Session memory | nativePreviewCache, sync on load | After fail | N/A | No |
| `videoSrcTrap.ts` | Yes | **Always installed** | `renderer/main.tsx` on boot | Global monkey-patch | Logs only | Intercepts all `<video src>` |
| `thumbnailGenerator.ts` | Yes | Timeline thumbnails | `useMediaVisualCache` | Zoom threshold | FFmpeg IPC | **No** Chromium video |
| `fetchProjectItemThumbnailDataUrl` | Yes | Project panel thumbs | `App.generateFootageThumbnail` | On import | FFmpeg IPC | **No** |
| `PreviewService.ts` | Yes | IPC preview | `main/ipc.ts` | `preview:*` handlers | node-av (IPC) | No |
| `ChromiumPreviewService.ts` | Yes | Stub only | `PreviewService` | Never active for IPC | Placeholder | No |
| `previewCache` system | Yes | Legacy VideoPreview only | App, TimelineEditor bar | `useCachedPreview` | Chromium via PreviewCacheVideo | **Yes** when enabled |
| `CommandPreview.tsx` | Yes | FFmpeg command preview | Bottom dock | Render commands | N/A | No |

---

## Feature Flags / Settings

| Flag / setting | Declared | Default | Read by | Effect | Can break preview? |
|----------------|----------|---------|---------|--------|-------------------|
| `SIMPLE_PREVIEW` | `simplePreviewConfig.ts` | **`true`** | `StudioLayout` | Replaces entire preview panel with `SimplePreviewPanel` | **Yes** — bypasses composition, proxy UI, quarantine in panel |
| `RECOVERY_PREVIEW` | `recoveryPreviewConfig.ts`, duplicated in `simplePreviewConfig.ts` | **`false`** | `StudioLayout` (2nd branch) | Shows debug Recovery UI | **Yes** when `true` — replaces normal UX; had footage resolution bugs |
| `previewBackend` | `Settings.previewBackend`, `App` state | **`chromium-video`** | `SimplePreviewPanel`, `App.finalizeImportedFootage`, `SettingsPanel` | Switches simple panel between `<video>` and node-av canvas; skips import native test when `node-av` | **Yes** — wrong backend for file type |
| `FORCE_NODE_AV_PREVIEW` | — | **Not found in codebase** | — | — | — |
| `chromiumPreviewAllowed` | `ProjectItem` field | `true` (implicit) | `getChromiumVideoSrc`, quarantine, load sync | Blocks chromium src when `false` | Legacy path only |
| `chromiumPreviewVerified` | `ProjectItem` field | `false` on create | Mostly metadata now; gate removed from `getChromiumVideoSrc` | Low impact currently | Low |
| `native-preview-failed` | `compatibilityStatus` | Set on import fail | `getChromiumVideoSrc`, `needsManualProxyRetry`, diagnostics | Blocks chromium gate; triggers proxy UI labels | **Yes** in legacy path + diagnostics |
| `hasFailedNativePreview` | `nativePreviewCache` session | After test/preview error | `getChromiumVideoSrc`, trap logs | Blocks chromium original in legacy gate | Legacy only |
| `autoCreatePreviewProxy` | `Settings` | **`true`** | `SettingsPanel` only | **`shouldAutoCreateProxy` is never called** — dead setting | No (currently inert) |
| `useCachedPreview` | `App` state | `false` | `VideoPreviewChromium` only | Cache segment playback | No while `SIMPLE_PREVIEW` |
| `installVideoSrcTrap()` | `main.tsx` | Always on | All renderer `<video>` assignments | Console `[VIDEO_SRC_TRAP]` logs | No (log-only) |

---

## Chromium Video Sources

| Location | Purpose | Src type | Can trigger `Unsupported pixel format: -1`? |
|----------|---------|----------|---------------------------------------------|
| `SimplePreviewPanel.tsx` `<video>` | **Active** main preview (chromium mode) | **original** via `toFileUrl` | **Yes** — problematic MP4 |
| `RecoveryPreviewHost.tsx` `<video>` | Recovery Chromium Raw tab | original | Yes (when `RECOVERY_PREVIEW`) |
| `nativePreviewTest.ts` `createElement("video")` | Import compatibility probe | original `file://` | **Yes** — runs on every chromium-backend import |
| `CompositionPreviewLayer.tsx` | Legacy per-layer preview | original or proxy via gate | Yes (legacy path) |
| `PreviewCacheVideo.tsx` | Cached render segment | cache file path | Unlikely (re-encoded) |
| `previewVideoDebug.assignChromiumVideoSource` | Gate helper for layers | gate result | Yes if original passed |
| `previewVideoDebug.assignNativePreviewTestSource` | Import test | original | Yes |
| `videoSrcTrap.ts` | Monkey-patch `HTMLMediaElement.src` | intercepts all | Does not decode; logs only |
| `NodeAvPreviewCanvas` / `RecoveryNodeAvRawCanvas` `img.src = dataUrl` | PNG fallback draw | data: URL | No |
| `TimelineEditor.tsx` `toFileUrl(previewPath)` | Thumbnail cache key / URL build | preview path (gate) | Only if legacy path active and original assigned elsewhere |

**Note:** `thumbnailGenerator.ts` and `ffmpeg:thumbnailAtTime` use **FFmpeg in main process**, not Chromium `<video>`.

---

## Node-av Integration

| Piece | Spike only? | Main UI? | Props / inputs | On decode fail | Crash risk |
|-------|-------------|----------|----------------|----------------|------------|
| `node-av` npm package | — | dependency | — | — | Native module |
| `scripts/preview-spike/nodeAvSmokeTest.ts` | **Yes** | No | CLI file path | Logs FAIL | Isolated script |
| `NodeAvPreviewService.ts` | No | Main process | file path, time | Returns `{ ok: false, error }` | Uncaught exception possible inside native code |
| `PreviewService.ts` | No | IPC router | backend flag | Delegates errors | Low if IPC wrapped |
| `main/ipc.ts` `preview:*` | No | **Yes** | filePath, timeSec | try/catch → `{ ok: false }` | Reduced after stabilization |
| `RecoveryNodeAvRawCanvas.tsx` | No | **Yes** (via SimplePreviewPanel) | `filePath`, `sourceTimeSec` | UI error text | try/catch in renderer |
| `NodeAvPreviewCanvas.tsx` | No | Only via `NodeAvBypassPreview` | layer, compTime, sourcePath | `onFallback` | Not active now |
| `NodeAvBypassPreview.tsx` | No | Only if `SIMPLE_PREVIEW=false` + node-av | timeline + layer | bypass HUD | Not active now |
| `SettingsPanel` option | No | **Yes** | `previewBackend` | — | — |

**Conclusion:** node-av works in **main UI** only through `SimplePreviewPanel` → `RecoveryNodeAvRawCanvas` when `previewBackend === "node-av"`. Spike proves decode; UI uses same `NodeAvPreviewService` via IPC.

---

## Proxy Integration

| Location | UI visible now? | Trigger |
|----------|-----------------|---------|
| `ProjectPanel` row button `Create Proxy` | **Hidden** (`showProxyBtn = false` hardcoded) | Was `needsManualProxyRetry` when `native-preview-failed` |
| `ProjectBatchActionsMenu` "Create Proxies" | **Yes** (2+ footage selected) | `handleBatchCreateProxies` |
| `InfoPanel` Create Proxy button | **Removed** from render | Was `needsManualProxyRetry` |
| `LayerControlsPanel` proxy banner | **Removed** from render | Was `needsManualProxyRetry` |
| `VideoPreview` proxy overlay | **Not mounted** (`SIMPLE_PREVIEW`) | `proxyOverlayState` + `getLayerPreviewPlaybackState` |
| `MediaPreviewDiagnostics` | **Not mounted** (inside VideoPreviewChromium) | `needsManualProxyRetry` / `isPreviewUnsupported` |
| `MediaDiagnosticsPanel` (project row) | **Yes** | Shows proxy path text, "proxy needed" label |
| `ProjectItemContextMenu` | **Yes** | "Retry Chromium Preview" when quarantined |
| `SettingsPanel` | **Yes** | `autoCreatePreviewProxy` checkbox (setting unused in code) |
| `App.handleCreatePreviewProxy` | Backend only | Job queue still works |
| `previewState.needsManualProxyRetry` | Logic active | `native-preview-failed` or `proxy-failed` |
| `getChromiumVideoSrc` | Legacy only | Returns `proxyPath` when `proxy-ready` |
| `finalizeImportedFootage` | On import | Does **not** auto-create proxy (manual only) |

**Why proxy UI reappeared:** Earlier sessions re-enabled `needsProxyAction` / diagnostics when import test set `native-preview-failed`. User saw **Create Proxy** from `ProjectPanel` when `showProxyBtn` was driven by `needsManualProxyRetry`. Currently row button is forced off, but **batch menu**, **settings checkbox**, **media diagnostics text**, and **context menu retry** remain.

---

## Recovery / Bypass Systems

| System | Flag | UI today | Purpose |
|--------|------|----------|---------|
| `RecoveryPreviewHost` | `RECOVERY_PREVIEW` (false) | Not shown | Debug dual-mode raw preview + yellow banner |
| `SimplePreviewPanel` | `SIMPLE_PREVIEW` (true) | **Main preview** | Stabilized minimal preview |
| `NodeAvBypassPreview` | `VideoPreview` + `node-av` | Not shown | Hard bypass inside legacy wrapper |
| `PreviewErrorBoundary` | wraps simple panel | Active | Contain React errors |

**Evolution conflict:** Three different "simple" paths (`Recovery`, `Simple`, `Bypass`) share `RecoveryNodeAvRawCanvas` but different footage resolvers and chrome.

---

## Conflicts

### Conflict #1: Multiple preview panel roots

`StudioLayout` chooses among `SimplePreviewPanel`, `RecoveryPreviewHost`, and `VideoPreview` via flags. Only one should exist long-term.

**Effect:** Developers fix one path; another remains broken or stale.

---

### Conflict #2: `SIMPLE_PREVIEW` ignores composition timeline

`SimplePreviewPanel` shows a single footage file, not comp layers, transforms, effects, or precomps.

**Effect:** Preview does not match timeline WYSIWYG; user perception "preview broken" for multi-layer comps.

---

### Conflict #3: Import still runs Chromium test while panel may use node-av

`finalizeImportedFootage` skips test only when settings say `node-av`. If user uses chromium simple preview, import creates hidden `<video>` on original.

**Effect:** `Unsupported pixel format: -1` in console even when investigating node-av.

---

### Conflict #4: `RecoveryPreviewHost` footage resolver vs Project Panel

`resolveRecoveryFootage` used strict `Boolean(item.path ?? item.originalPath)` without `trim()`. Empty `path` with valid `originalPath` failed `isVideoFootage`.

**Effect:** **"No footage selected"** while Project Panel listed footage (when `RECOVERY_PREVIEW=true`).

`resolveSimplePreviewFootage` fixed trim logic but Recovery resolver unchanged.

---

### Conflict #5: Quarantine state vs SimplePreview direct original

`native-preview-failed` and `hasFailedNativePreview` still set on import. Simple preview **ignores** gate and plays original anyway.

**Effect:** Project diagnostics say "unsupported / proxy needed" while simple preview attempts original; confusing UX.

---

### Conflict #6: `videoSrcTrap` always installed

`main.tsx` calls `installVideoSrcTrap()` globally. Patches `HTMLMediaElement.src` for all video assignments.

**Effect:** Extra indirection/logging; historical confusion with "blocking" trap (now log-only).

---

### Conflict #7: `previewPathBySourcePath` built from `getChromiumVideoSrc`

`App` still computes gated paths for timeline thumbnails. Timeline may skip thumbnails when gate returns null, while simple preview shows file.

**Effect:** Timeline strip empty; preview may work (or vice versa).

---

### Conflict #8: Parallel node-av canvas components

`NodeAvPreviewCanvas` (layer-aware) vs `RecoveryNodeAvRawCanvas` (file + time only). Different feature sets, shared IPC session (single `PreviewService` instance).

**Effect:** Switching components without `previewClose` ordering can cause stale session bugs.

---

### Conflict #9: `VideoPreview` wrapper still contains node-av bypass

If `SIMPLE_PREVIEW` set false and `previewBackend=node-av`, user gets `NodeAvBypassPreview` — fourth node-av UI variant.

**Effect:** Unclear which node-av path is canonical.

---

### Conflict #10: Proxy UI partially hidden, not removed

`showProxyBtn = false` but batch proxy, settings toggle, diagnostics labels, and job infrastructure remain.

**Effect:** Proxy still "appears" via batch menu, settings, status strings, and `MediaDiagnosticsPanel`.

---

## Why Preview Is Broken Now

### 1. Why "No footage selected" while footage exists in Project Panel?

**When `RECOVERY_PREVIEW=true` (earlier state):** `RecoveryPreviewHost` used `resolveRecoveryFootage`, which failed if `item.path` was empty string even with valid `originalPath`, or if selection logic did not fall through to first footage.

**When `SIMPLE_PREVIEW=true` (current):** Message is **"Import video footage to preview"** (not literal "No footage selected"). Still appears if `resolveSimplePreviewFootage` returns null — e.g. all items `missing`, no `path`/`originalPath`, or only compositions in `projectItems` without footage type.

Project Panel and preview share `projectItems` from `App` (`projectItemsWithMedia`). Wiring is correct; **resolver predicates** were the bug for Recovery.

---

### 2. Why "Create Proxy" appeared again?

| Cause | Detail |
|-------|--------|
| Import test failure | `testNativeVideoPreview` → `native-preview-failed` |
| `needsManualProxyRetry()` | Returns true for `native-preview-failed` |
| `ProjectPanel` | Previously `showProxyBtn = needsProxyAction(...)` |
| Stabilization | Row button hardcoded `false`; **batch menu + diagnostics text remain** |

User may still see proxy-related UI from **Batch Actions → Create Proxies**, **Settings → autoCreatePreviewProxy**, **MediaDiagnosticsPanel** ("proxy needed"), or **legacy VideoPreview** if flags reverted.

---

### 3. Why window crash?

| Risk | Mitigation status |
|------|-------------------|
| Uncaught exception in node-av native decode | IPC handlers wrapped in try/catch |
| Renderer throw in preview React tree | `PreviewErrorBoundary` around simple panel |
| Unhandled promise in canvas | try/catch in `RecoveryNodeAvRawCanvas` |
| Native module segfault | **Cannot fully guard** — still possible on bad input |

Crashes likely from **uncaught native errors** before stabilization, or **multiple concurrent `previewOpen` without close**.

---

### 4. Why `Unsupported pixel format: -1` persists?

Chromium internal FFmpeg logs when **original MP4** is assigned to `<video>`. Active sources:

1. **`SimplePreviewPanel`** chromium mode (`<video src=original>`)
2. **`nativePreviewTest`** on import (chromium backend)
3. **Legacy path** if re-enabled (`CompositionPreviewLayer`, etc.)

**Not** from node-av canvas path. Trap only logs; does not cause error.

---

### 5. Which component displays the preview panel today?

**`SimplePreviewPanel`** inside **`PreviewErrorBoundary`**, selected by **`SIMPLE_PREVIEW === true`** in `StudioLayout.tsx`.

---

### 6. Does node-av work in main UI or only spike?

| Context | Works? |
|---------|--------|
| `scripts/preview-spike/nodeAvSmokeTest.ts` | Yes (CLI) |
| Main UI with `previewBackend=node-av` + `SIMPLE_PREVIEW=true` | **Designed to** — `RecoveryNodeAvRawCanvas` |
| `NodeAvPreviewCanvas` / bypass / legacy | Code exists; **not mounted** with current flags |

---

### 7. What can be safely removed/disabled later?

See **Safe Cleanup Plan** below. Do not delete until one canonical path is chosen and manually verified.

---

## What Must Be Removed Later

Priority candidates **after** a single preview architecture is chosen:

1. `RecoveryPreviewHost.tsx` + `recoveryPreviewConfig.ts` (or move entirely to dev-only diagnostics)
2. `NodeAvBypassPreview.tsx` (duplicate of simple/bypass)
3. One of `RecoveryNodeAvRawCanvas` vs `NodeAvPreviewCanvas` (merge raw + layer modes)
4. `videoSrcTrap.ts` install (or dev-only flag)
5. `ChromiumPreviewService.ts` stub if unused
6. Duplicate flags: `SIMPLE_PREVIEW`, `RECOVERY_PREVIEW`, `VideoPreview` node-av branch
7. Dead `shouldAutoCreateProxy` / wire or remove `autoCreatePreviewProxy` setting
8. Aggressive quarantine on project load (`syncFootageChromiumQuarantine`) if simple path ignores it
9. `MediaPreviewDiagnostics` + proxy overlay (if proxy demoted permanently)

**Keep until replacement verified:**

- `PreviewService` / `NodeAvPreviewService` (node-av backend)
- `thumbnailGenerator` (FFmpeg — not Chromium)
- `getRenderPathForItem` / render paths (unaffected)
- `previewProxyBuilder` for optional manual proxy jobs

---

## Safe Cleanup Plan

### Phase 0 — Decision (no code)

1. Pick **one** preview panel entry: recommend extend `SimplePreviewPanel` OR restore `VideoPreviewChromium` — not both.
2. Pick **one** node-av surface: raw canvas vs layer canvas.
3. Document manual test matrix (normal MP4, problem MP4, multi-layer comp).

### Phase 1 — Flag consolidation

1. Single config: `PREVIEW_MODE: 'simple' | 'composition' | 'recovery-dev'`.
2. Remove duplicate `RECOVERY_PREVIEW` from two config files.
3. Delete unreachable branches in `StudioLayout` once mode is stable.

### Phase 2 — Footage / import alignment

1. One resolver: `resolvePreviewFootage()` used by panel + diagnostics display.
2. Import: if `previewBackend=node-av`, never call `testNativeVideoPreview`.
3. If chromium composition mode returns, single gate `getChromiumVideoSrc`.

### Phase 3 — Proxy demotion

1. Remove proxy UI surfaces OR gate behind `ENABLE_PROXY_UI` default false.
2. Keep `handleCreatePreviewProxy` for power users / future.
3. Stop setting `native-preview-failed` from node-av errors.

### Phase 4 — Legacy composition preview

1. Either re-integrate composition into chosen panel or explicitly document "simple preview = single file only".
2. Remove dead `VideoPreviewChromium` only after parity checklist passes.

### Phase 5 — Trap and diagnostics

1. `installVideoSrcTrap` behind `import.meta.env.DEV` or setting.
2. Move `RecoveryPreviewHost` into `DebugDiagnosticsPanel` collapsible section.

---

## Do Not Touch List

Per project constraints (out of preview audit scope):

- Render engine / `compositionRenderBuilder` / export pipeline
- Effects system / keyframes / crop tooling
- `getRenderPathForItem` (always original for render)
- `previewProxyBuilder` / proxy job execution (can hide UI only)
- `node-av` package / `NodeAvPreviewService` decode logic (stabilize callers only)
- Timeline editor core (except preview-specific thumbnail path wiring)
- FFmpeg thumbnail IPC (`ffmpeg:thumbnailAtTime`)

---

## File Index (preview-related)

### Renderer components

- `src/renderer/components/VideoPreview.tsx`
- `src/renderer/components/CompositionPreviewLayer.tsx`
- `src/renderer/components/PrecompPreviewLayer.tsx`
- `src/renderer/components/PreviewCacheVideo.tsx`
- `src/renderer/components/NodeAvPreviewCanvas.tsx`
- `src/renderer/components/NodeAvBypassPreview.tsx`
- `src/renderer/components/preview/SimplePreviewPanel.tsx`
- `src/renderer/components/preview/RecoveryPreviewHost.tsx`
- `src/renderer/components/preview/RecoveryNodeAvRawCanvas.tsx`
- `src/renderer/components/preview/resolveSimplePreviewFootage.ts`
- `src/renderer/components/preview/resolveRecoveryFootage.ts`
- `src/renderer/components/preview/simplePreviewConfig.ts`
- `src/renderer/components/preview/recoveryPreviewConfig.ts`
- `src/renderer/components/PreviewErrorBoundary.tsx`
- `src/renderer/components/MediaPreviewDiagnostics.tsx`
- `src/renderer/components/PreviewDebugBlock.tsx`
- `src/renderer/components/PlaybackControls.tsx`
- `src/renderer/components/TimelinePreviewCacheBar.tsx`
- `src/renderer/components/CommandPreview.tsx`
- `src/renderer/components/StudioLayout.tsx` (routing)

### Media / compatibility

- `src/media/mediaCompatibility.ts`
- `src/media/mediaPostImport.ts`
- `src/media/nativePreviewTest.ts`
- `src/media/nativePreviewCache.ts`
- `src/media/previewVideoDebug.ts`
- `src/media/previewState.ts`
- `src/media/chromiumQuarantine.ts`
- `src/media/chromiumSessionBlocklist.ts`
- `src/media/videoSrcTrap.ts`
- `src/media/thumbnailGenerator.ts`
- `src/media/mediaNativePreviewHints.ts`

### Main / preview services

- `src/preview/PreviewService.ts`
- `src/preview/NodeAvPreviewService.ts`
- `src/preview/ChromiumPreviewService.ts`
- `src/preview/types.ts`
- `src/main/ipc.ts` (`preview:*`, `ffmpeg:thumbnailAtTime`)
- `src/main/preload.ts` (`previewOpen`, `toFileUrl`)

### Scripts

- `scripts/preview-spike/nodeAvSmokeTest.ts`

### Settings

- `src/renderer/components/SettingsPanel.tsx`
- `src/settings/settingsTypes.ts` (`previewBackend`, `autoCreatePreviewProxy`)

---

## Manual UI Test Status

**Not performed as part of this audit.** This document is code-derived only.

Recommended verification before any cleanup:

1. `SIMPLE_PREVIEW=true`, chromium, normal MP4 → video plays
2. `SIMPLE_PREVIEW=true`, node-av, problem MP4 → canvas frame + scrub
3. No yellow RECOVERY banner
4. Project row has no Create Proxy (batch menu may still show Create Proxies)
5. Import problem MP4 with chromium backend → console may log pixel format (expected)
6. Decode error does not close Electron window

---

*End of audit.*
