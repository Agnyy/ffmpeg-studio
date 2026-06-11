# Preview Engine Auto-Seek Regression Fix

## Problem

After open, `initialFrame` at pts=0 was drawn, then auto-seek on `compCurrentTime` ran immediately and failed → `engine error: Preview engine seek completed without a display frame`, clearing a working preview.

## Fix

### Engine

- `seekAndHold()` returns `{ frame, warning? }`; restores previous `currentFrame` on decode failure
- `performSeek()` decodes up to 100 extra packets when nearest frame missing
- `previewEngineSeek` returns `frame` in result via shared `toIpcFrame()` (no poll-after-seek)

### UI

- `skipAutoCompSeekRef` — skip comp-time auto-seek until user scrub (`seekToCompTime` clears guard)
- `engineSeekSourceTime()` — draws `seekResult.frame`; failed seek → keep canvas, `seekWarning` in dev diag only
- Removed destructive pre-play drift seek; Play calls `previewEnginePlay()` directly
- Removed `engine error` on seek-without-frame (crash/open fail still error)

## Manual verification

| Check | Result |
|-------|--------|
| First frame stays after import | **manual required** |
| Auto-seek no longer → engine error | code audit ✓ |
| Failed user scrub keeps old frame | code audit ✓ |
| `npm run check` | **pass** |
