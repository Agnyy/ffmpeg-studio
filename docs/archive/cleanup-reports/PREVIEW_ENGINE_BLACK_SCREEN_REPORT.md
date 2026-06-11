# Preview Engine Black Screen Report

**Date:** 2026-06-10  
**Scope:** Black screen diagnostics + targeted draw/IPC/layout fixes only.

---

## Likely root causes addressed

| Suspect | Finding | Fix |
|---------|---------|-----|
| Canvas not mounted | Canvas only rendered when `containerSize > 0` + `displayGeometry` + `layerVisible` — before ResizeObserver fired, no canvas existed (`canvas ref not mounted`) | Canvas mounts whenever `sessionReady`; layout uses `max(container, 320×200)` fallback |
| IPC RGBA | Main sent `Buffer`; renderer `rgbaFromIpc` could fail or alias wrong memory | IPC now sends `Uint8Array.from(...)`; renderer copies to owned `Uint8Array` |
| Alpha channel | node-av RGBA may have A=0 → invisible pixels on canvas | `forceOpaqueAlpha()` sets A=255 before `putImageData` |
| Draw API | `createImageData` + raw `Uint8Array` set | `ImageData` via `createImageData` + `Uint8ClampedArray` with forced alpha |
| Overlay | Placeholder could show instead of canvas during load | Placeholder only when `!sessionReady`; no cover div when session open |
| No first-frame poll | Poll only on seek / play rAF | Initial seek after open + rAF poll until `drawCount > 0` |

---

## Diagnostics added

### UI (`EnginePreviewPanel`)

```text
engine frame: none / ok
w: …  h: …  rgba bytes: …  checksum: …
draw count: …  canvas: …  last error: …
```

### Main process (first frame)

```text
[ENGINE_FRAME_MAIN] width=… height=… rgbaLength=… expected=… checksum=… firstBytes=… pts=…
```

### Renderer (first frame)

```text
[ENGINE_FRAME_RENDERER] width=… height=… rgbaLength=… checksum=… firstBytes=…
```

### Draw

```text
[ENGINE_DRAW] drawn canvas: WxH
```

### Test pattern

If no engine frame within 2.5s after session open → red/green/blue bars (`test pattern`).  
If test pattern visible but video frame not → layout/canvas OK, decode/IPC issue.  
If test pattern also invisible → layout/overlay issue.

---

## How to verify locally

1. `npm run dev`
2. Import problem MP4
3. Open DevTools:
   - Main terminal: `[ENGINE_FRAME_MAIN]` with `rgbaLength === width*height*4`
   - Renderer: `[ENGINE_FRAME_RENDERER]` with **same checksum**
   - `[ENGINE_DRAW] drawn canvas: …`
4. Preview diagnostics: `engine frame: ok`, `draw count >= 1`

| Check | Expected |
|-------|----------|
| Frame in main | `[ENGINE_FRAME_MAIN]` logged |
| Frame in renderer | `[ENGINE_FRAME_RENDERER]` logged |
| Checksum match | main checksum === renderer checksum |
| First frame visible | yes (manual) |
| Black screen gone | yes (manual) |

---

## Report answers (code-level; manual UI not run here)

| Question | Answer |
|----------|--------|
| Frame in main process | **Expected yes** — `PreviewEngineHost.pollFrame` logs first frame |
| Frame in renderer | **Expected yes** — if IPC OK, `logRendererEngineFrame` fires |
| Checksum match | **Expected yes** after `Uint8Array` copy on both sides |
| Problem area | **Likely canvas mount + alpha + Buffer IPC** (fixed in this pass) |
| First frame visible | **not verified** — requires manual Electron run |

---

## Files changed

- `src/preview-engine/frameDiagnostics.ts` — main-side checksum log
- `src/preview-engine/PreviewEngineHost.ts` — copy RGBA + log
- `src/preview-engine/videoPlayerSession.ts` — `Uint8Array.from` on encode
- `src/main/ipc.ts` — send `Uint8Array` not `Buffer`
- `src/renderer/components/preview-engine/engineCanvasDraw.ts` — draw, alpha, test pattern
- `src/renderer/components/preview-engine/rgbaFromIpc.ts` — robust IPC decode
- `src/renderer/components/preview-engine/EnginePreviewPanel.tsx` — diagnostics, layout, canvas mount

---

## Automated check

`npm run check` — **pass**

---

*End of black screen report.*
