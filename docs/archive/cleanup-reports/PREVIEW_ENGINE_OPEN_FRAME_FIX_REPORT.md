# Preview Engine Initial Frame Pipeline Fix

## Change

Single synchronous path for first frame:

```text
previewEngineOpen(file)
  → open + decode from file start (no seek)
  → return initialFrame in open result
  → renderer draws initialFrame on canvas mount (no poll rAF race)
```

## Implementation

| Piece | Change |
|-------|--------|
| `primeInitialFrame()` | No `seekToTimeAndDecodeNearestFrame(0)`; reset iterator/decoder; decode packets from start |
| `getCurrentFrame()` | Public accessor on session |
| `ipcFrame.ts` | Shared `toIpcFrame()` for open + pollFrame |
| `PreviewEngineHost.open()` | Returns `{ ok, metadata, hasCurrentFrame, initialFrame }` |
| `EnginePreviewPanel` | `drawIpcFrame()`; draws `openResult.initialFrame` in effect after `sessionReady` |

## Manual verification

| Check | Result |
|-------|--------|
| `previewEngineOpen` returns `initialFrame` | code audit ✓ |
| Renderer draws without `pollFrame` | code audit ✓ (effect after canvas mount) |
| First frame without Play | **manual required** |
| No RGB test pattern | code audit ✓ |
| `pollFrame` after open | unchanged ✓ |
| `npm run check` | **pass** |
