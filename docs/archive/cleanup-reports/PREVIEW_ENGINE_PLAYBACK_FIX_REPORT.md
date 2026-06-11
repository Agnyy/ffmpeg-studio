# Preview Engine Playback Loop Fix Report

## Symptom

First frame visible (`engine frame: ok`, correct RGBA bytes, `draw count = 1`), but video did not play — `draw count` stayed at 1 after pressing Play.

## Root cause: why draw count was 1

Two independent bugs stopped the playback loop:

### 1. Timeline sync re-seek during play (primary)

`EnginePreviewPanel` had an initial-seek `useEffect` with `compCurrentTime` in its dependency array. During playback, the rAF loop calls `propagatePlaybackTime()` → App updates `compCurrentTime` → effect re-ran → `engineSeekSourceTime()` → **`previewEnginePause()` + `previewEngineSeek()`** on every time tick.

That continuously reset the engine to paused and flushed the frame queue after the first draw.

**Loop stopped at:** timeline sync / UI seek wiring.

### 2. Draw dedup used `timeSec` instead of frame identity (secondary)

`shouldRedraw` compared `lastDrawnFrameTimeRef !== frame.timeSec`. Consecutive decoded frames can share the same PTS/timestamp (or round to the same value). Poll returned a new RGBA buffer but draw was skipped → `draw count` did not increment even when the decoder kept producing frames.

**Loop stopped at:** renderer poll/draw (false negative on redraw).

## What was fixed

| Area | Change |
|------|--------|
| Initial seek effect | Removed `compCurrentTime` from deps; guard `isPlayingRef`; use `compTimeRef` for source time |
| Play effect | Removed unconditional seek-before-play; seek only if engine playhead drift > 50 ms; call `previewEnginePlay()` directly |
| Play effect deps | Removed `compCurrentTime` — play transition only, not every React time update |
| Paused scrub sync | Unchanged: `compCurrentTime → engine seek` only when `!isPlaying` |
| Playing sync | Unchanged: `engine time → compCurrentTime` via rAF + `getState()` |
| `drawPollFrame` | Redraw when `frame.isNew === true` or new `frame.sequence`; not by `timeSec` alone |
| `VideoPlayerSession` | `pullDisplayFrame()` returns `{ frame, isNew }`; monotonic `sequence` on queued frames |
| `PreviewEngineHost.pollFrame` | Exposes `sequence`, `isNew`, `queueDepth` over IPC |
| Dev diagnostics | Added playback line: engine status/time, ui isPlaying, poll count, frames received, draw count, queue depth |

Decoder pump (`decodeLoop` filling queue while `clock.isPlaying()`) was already correct; it never ran continuously because play kept getting cancelled by re-seek.

## Manual verification

**Not verified by automated test.** Requires running the app:

1. Import MP4 → first frame visible
2. Press Play → `engine status = playing`, `engine time` rises
3. `poll count`, `frames received`, `draw count`, `queue depth` rise
4. Picture changes visually
5. Pause stops; Play resumes
6. `UDTA parsing failed retrying raw` — non-fatal, ignored

| Check | Result |
|-------|--------|
| draw count grows after Play | **manual required** |
| Video visibly plays | **manual required** |

## Files changed

- `src/preview-engine/types.ts` — `sequence` on `QueuedVideoFrame`
- `src/preview-engine/ipcTypes.ts` — `sequence`, `isNew`, `queueDepth` on IPC results
- `src/preview-engine/videoPlayerSession.ts` — frame sequence, `pullDisplayFrame` isNew, decode prefetch
- `src/preview-engine/PreviewEngineHost.ts` — pollFrame/getState extended
- `src/renderer/components/preview-engine/EnginePreviewPanel.tsx` — play wiring, draw dedup, diagnostics

## Not touched

Chromium, proxy, quarantine, trap, render, effects, keyframes, crop, `EditorPreviewPanel`, `VideoPreview`, `NodeAvPreviewCanvas`.
