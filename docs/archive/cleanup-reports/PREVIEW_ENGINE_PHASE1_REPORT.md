# Preview Engine Phase 1 Report

**Date:** 2026-06-10  
**Scope:** Isolated node-av sequential player spike (`scripts/preview-engine-spike/`, `src/preview-engine/`).  
**Main app:** Not modified (`StudioLayout`, preview panels, proxy/quarantine, render unchanged).

---

## Verdict

| Question | Answer |
|----------|--------|
| Sequential decode (not seek-per-frame)? | **Yes** |
| Problem MP4 30 s playback? | **Yes** |
| Seek/reopen per frame? | **No** (`demuxer reopen count: 0`, `seek count: 2` = explicit commands only) |
| Continue with node-av player? | **Yes** — mpv/libmpv spike **not required** at this stage |
| Ready for main UI integration? | **No** — Phase 2 (audio) and Phase 3 (compositor) still required |

---

## How to run

```bash
npm run preview:engine-spike
npm run preview:engine-spike -- "path/to/problem.mp4" "path/to/normal.mp4"
```

---

## Test file A — problem MP4 (Chromium `Unsupported pixel format`)

**File:** `C:\Users\New User\Videos\2026-06-04 23-03-21.mp4`

| Metric | Value |
|--------|-------|
| duration | 185.400 s |
| resolution | 1280×720 |
| fps (metadata) | 30.000 |
| codec / pixel format | h264 / yuv420p |
| decoded frames | 906 |
| displayed frames | 901 |
| dropped frames | 4 |
| queue overflow drops | 0 |
| display underruns | 7 |
| average decode ms/frame | 2.76 |
| max decode ms/frame | 5.63 |
| queue depth avg / max | 3.99 / 4 |
| actual playback fps | **23.70** |
| playback wall time | 38.02 s |
| seek count | 2 |
| demuxer reopen count | **0** |
| memory rss / heap | 120.6 / 12.5 MB |
| CPU rough estimate | 2.4% (1 core avg) |

**Tests:** play 30 s PASS · seek +5 s PASS · seek −5 s PASS · pause/resume PASS

---

## Test file B — normal MP4

**File:** `C:\Users\New User\Videos\2025-11-26 15-13-47.mp4`

| Metric | Value |
|--------|-------|
| duration | 59.667 s |
| resolution | 1280×720 |
| fps (metadata) | 30.000 |
| codec / pixel format | h264 / yuv420p |
| decoded frames | 906 |
| displayed frames | 901 |
| dropped frames | 4 |
| queue overflow drops | 0 |
| display underruns | 7 |
| average decode ms/frame | 3.08 |
| max decode ms/frame | 25.61 |
| queue depth avg / max | 3.99 / 4 |
| actual playback fps | **23.69** |
| playback wall time | 38.04 s |
| seek count | 2 |
| demuxer reopen count | **0** |
| memory rss / heap | 123.4 / 12.9 MB |
| CPU rough estimate | 2.2% (1 core avg) |

**Tests:** play 30 s PASS · seek +5 s PASS · seek −5 s PASS · pause/resume PASS

---

## What was proven

1. **Single open** — demuxer, decoder, and scaler created once per session.
2. **Sequential packet read** — `demuxer.packets()` async iterator; no `decodeFrameAt` play loop.
3. **Bounded frame queue** — max depth 4; overflow drops 0 under test load.
4. **Clock-driven display** — 30 Hz display tick; decode loop fills queue independently.
5. **Command-only seek** — flush queue → `demuxer.seek` → decoder reset → new packet iterator → prime buffer. No demuxer reopen.
6. **Pause/resume** — master clock holds playhead while paused; advances after resume.
7. **Problem MP4** — same file class that triggers Chromium pixel-format errors decodes sequentially for 30 s.

---

## Issues observed (non-blocking for Phase 1)

| Issue | Detail |
|-------|--------|
| Actual playback fps ~24 vs 30 | Display tick 30 Hz; some underruns (7) and stale-frame drops (4). Acceptable for spike; tune queue size / display rate in Phase 2+. |
| Post-seek frame alignment | After seek, keyframe may be before playhead; `primeDecodeUntil` pre-buffers to target time. Works for ±5 s seeks; needs stress test on long seeks. |
| FFmpeg UDTA warnings | `UDTA parsing failed retrying raw` on both files — cosmetic demuxer log, decode unaffected. |
| No audio | By design for Phase 1. |
| No composition / transforms | By design for Phase 1. |

---

## Seek / reopen analysis

| Pattern | Phase 1 spike |
|---------|---------------|
| `seek` every display frame | **Not used** |
| `demuxer.open` per frame | **Not used** (`reopen count: 0`) |
| `decodeFrameAt` as play loop | **Not used** |
| Seek on user command | 2 per test run (+5 s, −5 s) |

---

## mpv / libmpv fallback?

**Not needed yet.**

node-av sequential decode on problem MP4 sustained ~24 effective fps at 720p with ~2.8 ms average decode (including RGBA scale). CPU and memory were low. The remaining work (audio, compositor, IPC, UI) is substantial but orthogonal to decode — mpv would not remove that work and would add Electron native integration risk.

**Revisit mpv only if:** Phase 2+ decode cannot sustain preview fps on 1080p/4K targets after downscale, or native stability issues appear under multi-layer load.

---

## New files (isolated)

```
src/preview-engine/
  clock.ts
  frameQueue.ts
  frameTime.ts
  formatReport.ts
  nodeAvConstants.ts
  nodeAvLoader.ts
  types.ts
  videoPlayerSession.ts

scripts/preview-engine-spike/
  nodeAvPlayerSpike.ts
```

**npm script:** `preview:engine-spike`

**Not imported by:** `StudioLayout`, `App`, `main/ipc.ts`, or any preview panel.

---

## Regression check

`npm run check` — **pass** (typecheck + build).

---

## Recommended next step

**Phase 2:** Audio decode + WebAudio + A/V sync spike in the same isolated folder (no main UI).

---

*End of Phase 1 report.*
