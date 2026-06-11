# Preview Engine Paused Frame Fix Report (Phase 2A Critical)

## Symptom

After import/open, paused preview showed test pattern:

```text
engine frame: none
frames received: 0
queue depth: 0
last error: No frame available
```

Canvas worked; preview-engine did not expose a displayable frame until Play.

## Why open/seek did not provide a frame

Three engine-side issues:

### 1. Paused mode consumed the queue on poll

`pullDisplayFrame()` in paused state used `queue.popForTime()` / `popClosestAtOrAfter()`, which **removed** the only decoded frame from the queue. There was no separate held frame. After poll (or if timing did not match playhead), `lastFrame` was null and `pollFrame` returned `No frame available`.

### 2. Paused sequential decode interfered

The decode loop also decoded forward when paused (`targetDepth = 1`), mixing scrub/seek decode with playback prefetch. Seek priming and poll could race; queue state was unreliable for editor scrub.

### 3. Seek was async via pending queue

`seekAndHold()` used `requestSeek()` + `waitForSeek()` through the decode loop instead of a direct **seek → decode nearest → hold** path. IPC seek did not guarantee `currentFrame` before the next `pollFrame`.

## Fix: separate paused vs playing modes

### Paused / scrub

New path:

```text
seekToTimeAndDecodeNearestFrame(time)
  → performSeek (demuxer seek + prime decode)
  → promoteNearestFrameToCurrent(time)
  → currentFrame held (queue drained)
```

`pullDisplayFrame()` when paused:

```text
return currentFrame (isNew tracked by sequence)
```

Queue depth may be 0; `currentFrame` is always available after successful seek/open.

### Playing

Unchanged intent:

```text
decode loop fills frame queue (only while playing)
pullDisplayFrame → queue.shift()
currentFrame fallback on underrun
```

Decode loop **does not** decode when paused.

## UI changes

- Removed RGB test pattern fallback from normal preview.
- Normal states: `loading engine…`, `opening…`, `decoding frame…`, `paused`, `playing`, `engine error: …`
- Dev diagnostics (frame checksum, draw count, poll stats) hidden unless `import.meta.env.DEV && VITE_ENGINE_PREVIEW_DEV_DIAG=1` (collapsed `<details>`).
- Seek failure surfaces as `engine error: Preview engine seek completed without a display frame` instead of test pattern.

## Files changed

- `src/preview-engine/videoPlayerSession.ts` — `currentFrame`, `seekToTimeAndDecodeNearestFrame`, paused/playing poll split, decode loop playing-only
- `src/preview-engine/PreviewEngineHost.ts` — `hasCurrentFrame` in `getState`
- `src/preview-engine/ipcTypes.ts` — `hasCurrentFrame` on state result
- `src/renderer/components/preview-engine/EnginePreviewPanel.tsx` — no test pattern, status labels, dev-only diagnostics

## Manual verification

**Not verified in this session** — requires running the app:

| Check | Expected | Verified |
|-------|----------|----------|
| Import MP4, no Play | First frame visible | manual required |
| `engine frame = ok` (dev diag) | yes | manual required |
| `frames received >= 1` | yes | manual required |
| Timeline scrub paused | Frame updates | manual required |
| Play | Continuous playback | manual required |
| No test pattern in normal UI | yes | code audit ✓ |
| Debug lines hidden in normal UI | yes | code audit ✓ |
| `npm run check` | pass | automated ✓ |

## Not touched

Chromium, proxy, quarantine, trap, render, effects, keyframes, crop, legacy preview panels.
