# FFmpeg Studio — Dev Notes

## TODO

- **Project thumbnails v0.2** — separate branch. FFmpeg pipe → `thumbnailDataUrl`, lazy queue, Project Panel `<img>`. Disabled in mainline (Film icon placeholder only).

## Architecture: Per-Layer State

`TimelineLayer` is the single source of truth for editable layer parameters:

- `transform`, `crop`, `cropEnabled`, `aspectRatio`, `uniformScale`, `effects`
- `startTime`, `inPoint`, `outPoint`
- `enabled`, `locked`, `muted`, `solo`

`ProjectItem` stores only source media metadata (path, mediaInfo, thumbnail).

**Deprecated:** `clipEdits[sourcePath]` — legacy per-source edit map. Old `.ffstudio` files are migrated on load via `migrateLegacyClipEditsToLayers()`. New saves write layer state inside `composition.layers` and persist `clipEdits: {}`.

Composition playhead lives in `composition.currentTime` / `FlatEditorState.compCurrentTime`.

Export encoding settings live in `exportSettings` (project-level), not per layer.

## Transform Keyframes v1 — Manual Test Cases

### Test 1 — Position animation

1. Import footage, select layer.
2. Move playhead to 0s, enable Position stopwatch (⏱ or Alt+P).
3. Set Position to center.
4. Move playhead to 5s, change Position X to 200.
5. Scrub preview: layer should move smoothly between 0–5s.

### Test 2 — Scale keyframes

1. Enable Scale stopwatch at 0s (100%).
2. At 3s set Scale to 50%.
3. Preview interpolates scale between keyframes.

### Test 3 — J/K navigation

1. Create keyframes at 2s and 8s.
2. Playhead at 5s → press J → goes to 2s; K → goes to 8s.

### Test 4 — Timeline diamonds

1. Expand layer → expand Transform (click Transform row).
2. Enable animation → diamonds appear on Position row.
3. Drag diamond → time updates with frame snap; Undo restores.

### Test 5 — Save/Load

1. Create Position + Opacity keyframes on a layer.
2. Save, reload → keyframes preserved.

### Render notes (v2)

- Animated **Position** — overlay x/y expressions (all render ranges).
- Animated **Scale** — `scale=eval=frame` with composition-time expressions.
- Animated **Rotation** — `rotate=eval=frame` with angle expressions.
- Animated **Opacity** — `colorchannelmixer=eval=frame` with alpha expressions.
- If a property is preview-only, warnings appear in Layer Controls, Export panel, and Command Preview.

## Transform Keyframes Render Parity

### Test 1 — Position

1. Keyframe Position X: 200 → 900 over 5s.
2. Render Full Composition.
3. Output position track must match preview scrub.

### Test 2 — Scale

1. Keyframe Scale: 100 → 200.
2. Render — output scales up or Export/Command Preview shows explicit warning.

### Test 3 — Rotation

1. Keyframe Rotation: 0 → 45.
2. Render — output rotates or warning visible before render.

### Test 4 — Opacity

1. Keyframe Opacity: 100 → 0.
2. Render — output fades or warning visible before render.

### Test 5 — Work Area

1. Keyframes before and inside work area.
2. Render Work Area — expressions use `renderStart` offset correctly.

## Per-layer state tests

### Test 1 — duplicate same source

1. Import video.
2. Duplicate layer (Ctrl+D).
3. Select duplicate.
4. Scale duplicate to 50%.
5. Original layer must stay 100%.

### Test 2 — split same source

1. Import video.
2. Razor split at 5 sec.
3. Add blur to right part.
4. Left part must not have blur.

### Test 3 — same footage twice

1. Import same footage as one ProjectItem.
2. Add it to timeline twice.
3. Crop layer 1.
4. Layer 2 must not be cropped.

### Test 4 — save/load

1. Create two layers from same source.
2. Different effects on each.
3. Save.
4. Load.
5. Effects remain independent.

## Preview / Render Parity — Manual Test Cases

### Test 1 — One shifted layer

1. Import footage and place layer at `startTime = 10s`.
2. Set render range to **Full Composition**.
3. Preview: 0–10s black canvas, then video visible.
4. Command Preview should show `overlay` with `enable='between(t,10,...)'`.
5. Export: output has black lead-in, then video at 10s.

### Test 2 — Two overlapping layers

1. Layer A: `startTime=0`, duration 10s.
2. Duplicate or add Layer B: `startTime=5`, duration 10s, higher index (below A in list = on top visually if index 1 is top).
3. Preview between 5–10s: both layers visible, top layer covers bottom where they overlap.
4. Render: `filter_complex` contains chained overlays (`[v0]`, `[v1]`, …).
5. Top layer (lower index number) appears above in output between 5–10s.

### Test 3 — Split layer (Razor)

1. Select Razor tool (G), click clip at 5s to split.
2. Move second part to `startTime=10s`.
3. Preview: gap between 5–10s (no video from that layer).
4. Render full comp: gap preserved; two separate overlay enable ranges.

### Test 4 — Muted audio

1. Mute layer audio in timeline.
2. Render composition.
3. Command Preview notes muted layer; output has no audio from that layer (`-an` if only layer, or omitted from `amix`).

### Test 5 — Two audio layers

1. Two layers with audio, neither muted, overlapping in time.
2. Command Preview: `Audio layers: 2`, filter contains `amix`.
3. Export includes mixed audio.

## Effect Parameter Keyframes v1

### Test 1 — Brightness

1. Add Brightness / Contrast effect.
2. Enable Brightness stopwatch, keyframe 0 at 0s, 0.4 at 5s.
3. Scrub preview — brightness changes.
4. Render — output matches preview or warning visible.

### Test 2 — Saturation

1. Saturation keyframes 1 → 0.
2. Preview becomes desaturated.
3. Render matches or warning visible.

### Test 3 — Blur

1. Blur radius 0 → 10.
2. Preview blurs.
3. Render supported or warning in Export / Command Preview.

### Test 4 — Volume

1. Audio Volume 1 → 0 keyframes.
2. Render fades audio or warning visible.

### Test 5 — Save/Load

1. Animated brightness on a layer.
2. Save, reload — effect keyframes preserved.

### Test 6 — Copy/Paste

1. Select effect param keyframes, Ctrl+C.
2. Move playhead, Ctrl+V into same effect type.
3. Relative timing preserved.

## Keyframe UX v2 / Easy Ease

### Test 1 — Easy Ease preview

1. Position keyframes: 200 → 900 over 5s.
2. Select both diamonds, press F9 (Easy Ease).
3. Scrub timeline — motion should ease in/out, not linear.

### Test 2 — Easy Ease render

1. Same animation as Test 1.
2. Render Full Composition.
3. Output position track must match preview scrub.

### Test 3 — Hold

1. Opacity keyframes: 100 → 0 with Hold on first keyframe.
2. Value should jump at second keyframe, not fade smoothly.

### Test 4 — Copy/Paste

1. Select two Position keyframes, Ctrl+C.
2. Move playhead to 5s, Ctrl+V.
3. New keyframes appear with relative timing preserved.

### Test 5 — Delete selected keyframes

1. Shift+click to select multiple diamonds.
2. Delete — keyframes removed; layer not deleted.
3. Undo restores keyframes.

## Z-Order Rule

- Timeline index **1** = top of stack (AE convention).
- Render overlay chain: bottom layers (higher index) first, top layer (index 1) last.
- Preview CSS `z-index`: lower index → higher z-index.

## Playback / Timeline Regression Tests

### Test 1 — Single video realtime playback

1. Import a normal mp4.
2. Press Play.
3. A 3-minute video should take ~3 minutes at 1x.
4. Audio plays and stays in sync.

### Test 2 — No video seek loop

1. Watch preview for 20 seconds during playback.
2. Preview must not repeat 0.5-second chunks or stutter backward.

### Test 3 — Unsupported pixel format

1. Import a problematic screen recording.
2. If native preview fails, Chromium must not spam `Unsupported pixel format: -1`.
3. Proxy/cache prompt is visible; original file is not reopened via `<video>`.

### Test 4 — Hotkey reveal

1. Press **R** → only Rotation row visible on selected layer.
2. Press **P** → only Position row visible.
3. Press **Shift+S** after P → Position + Scale visible.
4. Press **U** → only changed/animated properties visible.

### Test 5 — Position grouped key

1. Add a Position keyframe (diamond) at current time.
2. One grouped diamond appears on the Position row.
3. Drag moves X/Y together; delete removes both; Undo restores one grouped action.

## FFmpeg Filter Library v1 — Manual Test Cases

### Test 1 — Filter detection

1. Start app with FFmpeg configured.
2. Open **Effects & Presets** (right dock).
3. Confirm categories: Color, Blur & Sharpen, Cleanup, Geometry, Stabilization, Audio.
4. **Simple Stabilization / Deshake** visible if `deshake` filter available.
5. **Advanced Stabilization / VidStab** disabled with Missing badge if `vidstabdetect`/`vidstabtransform` unavailable.

### Test 2 — Simple Deshake

1. Import shaky footage, select layer.
2. Add **Simple Stabilization / Deshake** from Stabilization category.
3. Set Strength / Edge in Effect Controls.
4. Command Preview contains `deshake=`.
5. Render Full Composition — output completes with stabilization applied.

### Test 3 — VidStab unavailable

1. Use FFmpeg build without libvidstab.
2. VidStab effect shows **Missing** badge and disabled in Effects & Presets.
3. Effect Controls shows install hint if effect was saved from another machine.

### Test 4 — VidStab analysis

1. Use FFmpeg with vidstab filters.
2. Add **Advanced Stabilization / VidStab**.
3. Click **Analyze Motion** — analysis runs, status becomes **Analysis ready**.
4. `.trf` file created under userData/analysis/vidstab/.
5. Command Preview shows two-pass vidstabdetect + vidstabtransform.
6. Render uses `vidstabtransform=input=...`.

### Test 5 — Render-only warning

1. Add render-only effect (e.g. Curves, Unsharp, Deshake).
2. Effect stack shows **Render only** badge.
3. Export / Command Preview notes: render-only, may not match live preview.

## Batch Processing v1 — Manual Test Cases

### Test 1 — Multi-select

1. Import 3+ video files.
2. Ctrl+click to select multiple footage rows.
3. Confirm `N items selected` and batch toolbar enabled.

### Test 2 — Batch Apply Preset

1. Select 3 footage items.
2. **Batch → Apply Preset** → **Compress for Telegram**.
3. Confirm dialog lists file count and output naming.
4. **Apply** → switch to Tasks tab; 3 jobs appear.

### Test 3 — Proxies

1. Select multiple unsupported-preview files.
2. **Create Proxies** → one proxy job per file.

### Test 4 — Failure isolation

1. Include one missing/invalid file in selection (if possible).
2. Other files should still enqueue and render.

## Smart Presets / Filter Recipes v1 — Manual Test Cases

### Test 1 — Smart Presets tree

1. Open **Effects & Presets**.
2. Confirm **Smart Presets** section with categories: Stabilization, Cleanup, Audio, Social Media, Compression, Export.
3. **FFmpeg Filters** section below with technical filter catalog.

### Test 2 — Apply dialog

1. Select a layer, click **Apply** on **Quick Deshake**.
2. Confirm dialog lists actions; choose strength; **Apply**.
3. Effect appears in Effect Controls with render-only badge.

### Test 3 — VidStab fallback

1. Without libvidstab, **Stabilize shaky video** shows fallback note or uses Deshake.
2. With VidStab, adds VidStab effect and creates Analyze Motion task in Tasks.

### Test 4 — Social / export recipes

1. **Prepare for YouTube Shorts** sets 1080×1920, fill, export settings.
2. **Compress for Telegram** sets CRF 26 / veryfast / 128k AAC.

### Test 5 — Undo

1. Apply any recipe, press Undo once — all recipe changes revert.

## Unified Background Tasks v1 — Manual Test Cases

### Test 1 — Tasks tab

1. Open bottom dock **Tasks** tab.
2. Create Proxy, Cache Preview, VidStab Analyze, or Render.
3. Each operation appears as a row: Status, Type, Name, Progress, Output, Actions.

### Test 2 — Job detail

1. Click a running or finished job.
2. Detail panel shows log, optional command, Copy log / Copy command.
3. Done jobs with output: **Open output** works.

### Test 3 — Cancel

1. Start proxy or analysis job.
2. Click **Cancel** in Tasks or **Stop** in TopBar.
3. Status becomes Cancelled; log notes user cancel.

### Test 4 — TopBar status

1. While a job runs: `Running 1 task: …` with progress %.
2. When idle: `Idle`.

### Test 5 — Side effects

1. Proxy done → project item `proxyPath`, preview path updated.
2. Cache done → green timeline cache bar, cached playback.
3. Analysis done → effect `analysisStatus: ready`, `analysisPath` set.
4. Save/load: finished paths persist; missing files reset status on load.
