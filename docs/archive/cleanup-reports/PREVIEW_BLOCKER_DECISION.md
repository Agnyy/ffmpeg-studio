# Preview Blocker Decision — STOP REPORT

**Date:** 2026-06-10  
**Status:** Blocked — no further preview patching until Path A / B / C is chosen.  
**Code changes in this step:** none.

---

## Required outcomes (all at once)

| # | Requirement |
|---|-------------|
| 1 | Video plays |
| 2 | Audio plays |
| 3 | Keyframes / transform / crop work |
| 4 | No Chromium `Unsupported pixel format` |
| 5 | No auto proxy as the main path |
| 6 | node-av used as backend |

**Current codebase cannot satisfy all six simultaneously.** Attempts to patch around this (hybrid paths, quarantine, proxy fallbacks, still-frame node-av players) have left the project in a contradictory state with multiple parallel preview architectures.

**Stop rule:** No more changes to preview components, fallback chains, proxy wiring, or hybrid fixes until a path below is explicitly chosen.

---

## 1. Why Chromium returns `Unsupported pixel format`

Chromium preview uses the browser’s built-in media stack (`<video>` → internal FFmpeg/libav). That stack only accepts a **narrow set** of container/codec/pixel-format combinations that Chromium ships and tests.

On some real-world MP4/H.264 files (often high bit depth, unusual chroma subsampling, exotic pixel formats, or metadata/layout edge cases), Chromium’s decoder reaches a frame it cannot map to a renderable surface. It logs:

```
Unsupported pixel format: -1
```

This is **not** an app bug in the strict sense — it is a **hard limit of Chromium’s HTML video decoder**. The app assigns `file://` original paths to `<video>` (e.g. `SimplePreviewPanel` in chromium mode, `nativePreviewTest` on import, and the legacy `CompositionPreviewLayer` path). When the file hits that limit, decode fails in DevTools and/or inline `MEDIA_ERR_DECODE`, regardless of quarantine labels or diagnostics state.

Proxy would avoid Chromium for that file, but **auto proxy is explicitly out of scope** as the primary solution.

---

## 2. Why node-av does not give full video/audio playback today

`NodeAvPreviewService` is a **still-frame decode service**, not a player:

- Opens demuxer + **video** decoder + scaler only (`open` → `video()` stream; no audio stream pipeline).
- API surface: `open` → `seek` → `decodeFrameAt` → returns RGBA/PNG for one timestamp.
- UI (`RecoveryNodeAvRawCanvas` via `SimplePreviewPanel`) redraws canvas on scrub/time change — **no frame queue, no vsync, no continuous decode loop**.
- **No audio decode**, no WebAudio output, no A/V sync clock.

node-av **can** decode problematic video that Chromium rejects (that is why the spike and main-process path exist). But it cannot today replace `<video>` for:

- smooth real-time playback,
- audio,
- composition-clock master sync with layers.

Keyframes / transform / crop also require a **composition preview layer** (`VideoPreview` → `CompositionPreviewLayer`). The active `SIMPLE_PREVIEW` path shows a **single footage file** and does not apply timeline transforms — so even node-av still mode does not meet requirement #3 in the current wiring.

---

## 3. Why hybrid again breaks UX

“Hybrid” here means: mix Chromium for some files/modes, node-av for others, proxy/quarantine gates, import probes, and multiple panel roots (`SimplePreviewPanel`, `RecoveryPreviewHost`, `VideoPreview` / bypass) behind flags.

Observed failure modes:

| Hybrid piece | UX cost |
|--------------|---------|
| Import runs Chromium probe while panel may use node-av | Console errors and `native-preview-failed` on files the user never plays via Chromium |
| Quarantine / `native-preview-failed` vs simple panel playing original | Diagnostics say “unsupported / proxy needed” while preview still tries original |
| `SIMPLE_PREVIEW` vs legacy `VideoPreview` | Composition, keyframes, crop ignored in simple path; legacy path has Chromium pixel-format risk |
| Switching `previewBackend` in settings | Video+audio in chromium mode vs silent still scrub in node-av mode — feels like two different apps |
| Partial proxy UI (batch menu, settings checkbox, diagnostics) | Proxy appears “banned” in policy but still visible in places |
| Multiple node-av surfaces (`RecoveryNodeAvRawCanvas`, `NodeAvPreviewCanvas`, bypass) | Unclear canonical path; session/stale-frame bugs when flags change |

Each hybrid fix addressed one symptom and added another code path. The stack now has **six+ parallel architectures** (see `PREVIEW_ARCHITECTURE_AUDIT.md`). Fixing one path does not fix the others; users see inconsistent behavior depending on flag, backend setting, and file type.

---

## 4. Only three viable paths forward

### Path A — Fast working editor (Chromium-first)

**Idea:** Restore / keep **Chromium composition preview** (`VideoPreview` → `CompositionPreviewLayer`) for normal MP4. Video, audio, playback, keyframes, transform, crop work on files Chromium accepts.

| | |
|---|---|
| **Pros** | Fastest path to a usable editor; minimal new infrastructure; matches how most Electron video apps start |
| **Cons** | Problematic MP4 still hits `Unsupported pixel format`; no node-av as primary backend; requirement #4 and #6 not met for all files |
| **Proxy** | Not used as main path (manual/off by policy) |

**Trade-off:** Accept Chromium limits for “normal” footage; document that some files cannot preview in-app without Path C (or optional manual proxy outside auto flow).

---

### Path B — node-av still preview (scrub-only for hard files)

**Idea:** Chromium (or composition path) for playable files; node-av **only** for frame-at-time / scrub on files that fail Chromium — **no audio, no real-time playback**.

| | |
|---|---|
| **Pros** | Problem file visible on canvas without Chromium decode; node-av proves value for decode-only |
| **Cons** | No audio on node-av branch; no smooth playback; keyframes/crop need extra composition work or stay chromium-only; two UX modes |
| **Proxy** | Not required for the node-av branch |

**Trade-off:** Honest “inspect frame / scrub timeline” for bad files, not a full player. Does not meet requirements #1, #2, #3 together for those files.

---

### Path C — New preview engine (correct long-term fix)

**Idea:** Build a **real** video+audio player backend; node-av (or mpv/libmpv) as the decode/render core.

Two realistic implementations:

1. **mpv / libmpv render API** — GPU texture output + audio out; mature sync.
2. **Full node-av player** — frame queue + audio decode + WebAudio + master clock + A/V sync; composition layers composited in renderer or main.

| | |
|---|---|
| **Pros** | Can satisfy all six requirements; no Chromium pixel-format ceiling; node-av as true backend; single architecture |
| **Cons** | **Separate large milestone** (weeks, not hours); IPC, threading, sync, composition compositing, error handling; not a patch |

**Trade-off:** Stop patching preview; plan milestone, spike sync + audio, then replace panel entry point once — not another hybrid layer.

---

## Decision needed

| Path | Video+audio | Keyframes/crop | No pixel-format error | node-av backend | Effort |
|------|-------------|----------------|----------------------|-----------------|--------|
| **A** Chromium editor | Yes (normal files) | Yes | No (problem files) | No | Low |
| **B** node-av still | Partial / no audio | Partial | Yes (on node-av branch) | Partial | Medium |
| **C** New engine | Yes | Yes (with compositor) | Yes | Yes | High |

**No code changes until Path A, B, or C is chosen.**

---

*Reference audit: `PREVIEW_ARCHITECTURE_AUDIT.md`*
