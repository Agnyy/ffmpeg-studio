# Preview Engine Milestone Plan

**Date:** 2026-06-10  
**Decision:** Path C — new preview engine. Chromium-first is **not** returning.  
**Status:** Planning only. No main-UI integration until Phase 1 spike is confirmed.

---

## Project goal

FFmpeg Studio editor preview must:

| # | Requirement |
|---|-------------|
| 1 | Play video |
| 2 | Play audio (Phase 2+) |
| 3 | No Chromium pixel-format ceiling |
| 4 | No auto proxy as preview path |
| 5 | Transforms / keyframes / crop in editor preview |
| 6 | Render always uses **original** via FFmpeg (`getRenderPathForItem`) |

Preview decode and render export are **separate pipelines**. Preview never substitutes proxy for original.

---

## Diagnosis (frozen)

Current `NodeAvPreviewService` is a **still-frame extractor**, not a player:

```text
open → seek(time) → decodeFrameAt(time) → RGBA/PNG → canvas redraw
```

Every scrub/play tick can trigger **seek + full decode**. There is no:

- sequential demux/decode loop;
- frame queue or drop/repeat policy;
- master playback clock;
- audio decoder or WebAudio output;
- A/V sync;
- continuous play loop.

`RecoveryNodeAvRawCanvas` and `NodeAvPreviewCanvas` call this API from React effects. That cannot become smooth playback with small patches.

**Do not** extend `decodeFrameAt` / per-frame seek as a player strategy.

---

## Engine choice

### Compared options

| Criterion | Option 1 — libmpv render API | Option 2 — full node-av player |
|-----------|------------------------------|--------------------------------|
| Video playback | Mature | Must build |
| Audio + A/V sync | Built-in | Must build (WebAudio + clock) |
| FFmpeg/libav decode breadth | Yes | Yes (already proven on problem file) |
| Electron integration | Hard: native lib, render context, no HWND overlay; texture → canvas/WebGL | Medium: already loads in main process; RGBA path exists |
| Multi-layer composition | mpv plays **one** source; compositor still custom | Natural fit: N decoders → one compositor |
| Existing codebase | New native dependency + bindings | `node-av` ^6.0 already in `package.json`; spike + IPC exist |
| Alignment with render | Separate stack from export FFmpeg graph | Same libav family; compositor can mirror render concepts |
| Time to first spike | Faster for single-file play+audio | Slower; video-only spike first |
| Long-term editor fit | Good player, weak compositor story | More work upfront, one backend |

### Selected engine: **full node-av player**

**Why:**

1. **Policy** — Path C explicitly rejects Chromium; project already committed to node-av as decode backend (`node-av` dep, `NodeAvPreviewService`, `preview:spike`).
2. **Problem file** — Smoke test and main-process decode already open the problematic MP4 Chromium rejects. mpv would re-prove decode but not remove the need for a **composition** layer.
3. **Editor preview is a compositor** — Multiple layers, precomps, transforms, keyframes, crop overlays (`EditorPreviewPanel` today). mpv solves single-file play; it does **not** solve multi-layer WYSIWYG. We must build a compositor either way; node-av keeps all layer decoders on one stack.
4. **Electron risk** — mpv render API in Electron (shared GL context, offscreen, Windows packaging) is the highest unknown for **integration**, not for decode. node-av already runs in main with IPC.
5. **No second native stack** — mpv + node-av + FFmpeg CLI = three decode paths. Export stays FFmpeg CLI; preview should stay node-av/libav, not add libmpv lifecycle and licensing/packaging surface.

**mpv remains a fallback** only if Phase 1 node-av sequential spike fails on sync/performance targets (see Risks). Not the default plan.

---

## Architecture (target)

```text
┌─────────────────────────────────────────────────────────────┐
│  Renderer: EnginePreviewPanel (future)                      │
│    compositor canvas + transform/crop overlays              │
│    playback controls → IPC commands                         │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC (play/pause/seek/state/frames)
┌──────────────────────────▼──────────────────────────────────┐
│  Main: PreviewEngineHost                                    │
│    MasterClock (comp time)                                  │
│    SessionManager (per-footage decoders)                    │
│    VideoDecoderLoop (sequential, per stream)                │
│    AudioDecoderLoop + WebAudio bridge (Phase 2)             │
│    FrameQueue + sync policy                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
│  src/preview-engine/  (new modules)                         │
│    reuse node-av via nodeAvLoader patterns                  │
└─────────────────────────────────────────────────────────────┘

Render export: unchanged → compositionRenderBuilder → FFmpeg → original files
```

---

## Phases

### Phase 0 — Stop patching (now)

- Freeze legacy preview surfaces (see **Do not touch**).
- No hybrid, quarantine, proxy, or Chromium-first fixes.
- No new panels wired in `StudioLayout`.

### Phase 1 — Isolated video player spike (first code)

**Location:** `scripts/preview-engine-spike/` (CLI, like `scripts/preview-spike/nodeAvSmokeTest.ts`).  
**Core modules (when stable):** `src/preview-engine/` — move spike logic here; **not** imported by `StudioLayout` yet.

**Goal:** Prove **sequential decode + clock-driven display** for **one file**, no audio.

| Task | Detail |
|------|--------|
| Open once | Demuxer + video decoder + scaler; no per-frame reopen |
| Decode loop | `read packet → decode → frame` until EOF or pause |
| Frame queue | Bounded queue (e.g. 2–4 frames); drop late frames under load |
| Master clock | `performance.now()`-based playhead; pause/resume |
| Display | Push RGBA to stdout stats or write PNG sequence; optional minimal Electron offscreen window **only in spike**, not main app |
| Seek | Flush decoder, seek demuxer, refill queue — **not** called every display frame |
| Metrics | FPS, decode ms/frame, queue depth, problem MP4 + normal MP4 |

**Exit criteria:**

- Play 30+ s without seek-per-frame.
- Pause/resume and seek ±5 s work.
- Problem MP4 plays smoothly enough for editor scrub (target ≥ 24 fps decode on 1080p file; document actual numbers).

**Not in Phase 1:** audio, composition layers, React UI, IPC to production panel.

### Phase 2 — Audio + A/V sync spike

**Location:** continue in `scripts/preview-engine-spike/` + `src/preview-engine/`.

| Task | Detail |
|------|--------|
| Audio demux/decode | Second stream via node-av |
| WebAudio output | Main process or renderer with shared clock via IPC |
| Sync | Audio master or video master; drift correction (drop/repeat video frame) |
| Volume / mute | API only; UI later |

**Exit criteria:** Single file plays with audible sync within ±40 ms over 60 s.

### Phase 3 — Composition compositor

| Task | Detail |
|------|--------|
| Comp clock | Composition time drives all layer source times |
| Layer sessions | One decoder session per active footage path |
| Stack order | Match `sortLayersForCompositor` / render order |
| Transforms | `getEffectiveLayerTransform` at comp time |
| Crop | Layer crop rect in compositor |
| Precomps | Recursive comp time mapping (mirror `PrecompPreviewLayer` semantics) |
| Effects | CSS/effect preview where render-compat allows; document gaps |

**Exit criteria:** Two-layer comp with transform + crop matches render intent at playhead (visual check + frame grab at t).

### Phase 4 — Editor integration

| Task | Detail |
|------|--------|
| IPC API | `previewEngine:open`, `play`, `pause`, `seek`, `subscribeFrame`, `close` |
| New panel | `EnginePreviewPanel` (or refactor `EditorPreviewPanel` **internals only** behind feature flag — prefer **new** file to respect freeze) |
| `StudioLayout` | Single switch: `PREVIEW_ENGINE_ENABLED` → new panel; old panel not deleted until parity |
| Playback | Wire existing `PlaybackControls`, `compCurrentTime`, `isPlaying` |
| Settings | Remove `previewBackend` chromium/node-av toggle from user-facing UX when engine ships |

**Exit criteria:** Manual regression IDs for play, scrub, keyframed transform, crop, precomp navigation.

### Phase 5 — Cleanup

Remove dead preview stack after Phase 4 parity (see **Files to delete later**). Demote proxy/quarantine/trap to optional diagnostics or delete.

---

## Phase 1 detail (immediate next step)

```text
scripts/preview-engine-spike/
  nodeAvPlayerSpike.ts      # CLI entry: file path, duration, --seek
  README.md                 # how to run, expected output

src/preview-engine/         # created when spike logic stabilizes
  clock.ts                  # MasterClock
  frameQueue.ts             # bounded queue
  videoDecoderLoop.ts       # sequential decode (node-av)
  types.ts                  # PlayerState, VideoFrame
```

**Spike pseudocode (not production):**

```text
open(file)
loop while playing:
  while queue.len < MAX and demuxer.hasPacket:
    frame = decoder.decodeNext()
    queue.push(frame)
  if queue.len > 0:
  clock.tick()
  frame = queue.popForTime(clock.now)
  display(frame)
on seek(t): flush queue, demuxer.seek(t), reset decoder
```

**npm script (future):** `"preview:engine-spike": "tsx scripts/preview-engine-spike/nodeAvPlayerSpike.ts"`

---

## Do not touch (until Phase 4)

| Area | Files / systems |
|------|-----------------|
| Main editor preview panels | `EditorPreviewPanel`, `SimplePreviewPanel`, `VideoPreview`, `CompositionPreviewLayer`, `NodeAvBypassPreview`, `RecoveryPreviewHost` |
| Proxy / quarantine / trap | `previewProxyBuilder`, `chromiumQuarantine`, `videoSrcTrap`, `chromiumSessionBlocklist`, `getChromiumVideoSrc` gates |
| Studio wiring | `StudioLayout` — no new experimental branches |
| Still-frame API | Do not extend `NodeAvPreviewService.decodeFrameAt` as play loop |
| Render | `compositionRenderBuilder`, `getRenderPathForItem`, export jobs |

Allowed before Phase 4: **new** files under `src/preview-engine/` and `scripts/preview-engine-spike/` only.

---

## Files to delete later (Phase 5, after parity)

Delete only when `EnginePreviewPanel` passes regression checklist.

### Renderer (preview UI)

- `src/renderer/components/preview/SimplePreviewPanel.tsx`
- `src/renderer/components/preview/RecoveryPreviewHost.tsx`
- `src/renderer/components/preview/RecoveryNodeAvRawCanvas.tsx`
- `src/renderer/components/preview/resolveSimplePreviewFootage.ts`
- `src/renderer/components/preview/resolveRecoveryFootage.ts`
- `src/renderer/components/preview/simplePreviewConfig.ts`
- `src/renderer/components/preview/recoveryPreviewConfig.ts`
- `src/renderer/components/VideoPreview.tsx` (legacy wrapper)
- `src/renderer/components/NodeAvBypassPreview.tsx`
- `src/renderer/components/NodeAvPreviewCanvas.tsx` (replaced by engine compositor)
- `src/renderer/components/CompositionPreviewLayer.tsx` (chromium `<video>` per layer)
- `src/renderer/components/PreviewCacheVideo.tsx` (if cache preview not reimplemented)
- `src/renderer/components/MediaPreviewDiagnostics.tsx`
- `src/renderer/preview/nodeAvFrameCoordinator.ts`

### Main / preview services (still-frame)

- `src/preview/NodeAvPreviewService.ts` → replaced by `src/preview-engine/`
- `src/preview/nodeAvFrameDecode.ts` (seek-at-time helpers)
- `src/preview/ChromiumPreviewService.ts`
- `src/preview/PreviewService.ts` (rewrite as thin IPC host to preview-engine)

### Media compatibility (chromium preview)

- `src/media/nativePreviewTest.ts`
- `src/media/chromiumQuarantine.ts`
- `src/media/chromiumSessionBlocklist.ts`
- `src/media/videoSrcTrap.ts`
- `src/media/previewVideoDebug.ts`
- `src/media/nativePreviewCache.ts`
- `src/media/mediaNativePreviewHints.ts` (if only used for chromium probe)

### Scripts

- `scripts/preview-spike/nodeAvSmokeTest.ts` (superseded by engine spike)

### Keep

- `src/media/thumbnailGenerator.ts` — FFmpeg thumbnails, not preview player
- `src/ffmpeg/previewProxyBuilder.ts` — manual proxy jobs only; not auto preview path
- `src/renderer/components/preview/EditorPreviewPanel.tsx` — **shell** may survive if refactored to host `EnginePreviewPanel`; or replace file wholesale in Phase 4
- `src/renderer/components/PrecompPreviewLayer.tsx`, transform/crop overlays — reuse compositor UI patterns
- `src/renderer/utils/previewPlayback.ts`, `previewAudio.ts` — adapt to engine clock

---

## Restoring editor preview on the new engine

1. **Phase 1–2:** Main app preview panel may show placeholder or frozen legacy UI; no user-facing regression from engine work.
2. **Phase 3:** Standalone compositor test window (optional spike) — still not `StudioLayout`.
3. **Phase 4:** Introduce `EnginePreviewPanel` with same props surface as `EditorPreviewPanel` today (`timelineLayers`, `compCurrentTime`, `isPlaying`, crop/transform callbacks, precomp navigation).
4. **Compositor mapping:**

   | Legacy (`EditorPreviewPanel`) | New engine |
   |-------------------------------|------------|
   | `CompositionPreviewLayer` + `<video>` | Compositor blit from `VideoFrame` textures |
   | `NodeAvPreviewCanvas` still frames | Same decoder loop, no seek-per-frame |
   | `resolveLayerPreviewMode` hybrid | **Removed** — all layers `node-av` engine |
   | `LayerTransformOverlay` / `CropOverlay` | Unchanged DOM overlays on compositor canvas |
   | `getEffectiveLayerTransform` | Called at comp time in compositor |
   | Chromium audio via `<video>` | Engine audio bus (Phase 2) |

5. **`StudioLayout`:** One line change when ready: render `EnginePreviewPanel` instead of `EditorPreviewPanel` (feature flag `PREVIEW_ENGINE_ENABLED`).
6. **Settings:** Deprecate `previewBackend: chromium-video | node-av`; single engine setting if any (quality / max decode threads).

Render path unchanged: layers still reference `originalPath`; export uses `getRenderPathForItem`.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Sequential node-av cannot sustain 24+ fps on 4K | Downscale in scaler (already `MAX_PREVIEW_WIDTH` pattern); drop frames; preview resolution cap |
| Main-thread decode blocks IPC | Worker thread or dedicated decode loop with async queue; measure in Phase 1 |
| Audio sync hard in Electron | Phase 2 isolated spike before composition |
| Native crash in node-av | Session boundaries, try/catch at IPC, single decoder per path |
| Phase 1 fails → reconsider mpv | Run parallel **one-week** mpv render spike; only switch if node-av loop cannot hit exit criteria |
| Scope creep (effects, cache preview) | Phase 3 = transform/crop/keyframes only; effects = documented gap |

---

## References

- `PREVIEW_BLOCKER_DECISION.md` — why patching stopped
- `PREVIEW_ARCHITECTURE_AUDIT.md` — inventory of legacy paths
- `scripts/preview-spike/nodeAvSmokeTest.ts` — decode proof on problem file
- `src/preview/NodeAvPreviewService.ts` — current still-frame API (do not extend)

---

## Awaiting confirmation

Do **not** start Phase 1 coding until confirmed.

**Recommended engine:** full **node-av player** (`src/preview-engine/` + `scripts/preview-engine-spike/`).  
**Phase 1:** CLI sequential video decode loop, frame queue, master clock, no audio, no main UI.  
**Risks:** decode throughput on large files; building A/V sync ourselves; multi-layer compositor is Phase 3, not Phase 1.
