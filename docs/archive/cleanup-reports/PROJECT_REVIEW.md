# FFmpeg Studio — Ревизия проекта

**Дата:** 2026-06-09  
**Тип:** Read-only анализ (код не изменялся)  
**Сборка:** `npm run build` / `npm run check` — pass

---

## 1. Текущая архитектура

### Electron main / preload / renderer

| Слой | Главные файлы | Роль |
|------|---------------|------|
| **Main** | `src/main/main.ts`, `src/main/ipc.ts`, `src/main/menu.ts`, `src/main/appPaths.ts` | Окно Electron, IPC-хаб, нативное меню, пути userData (proxies, cache) |
| **Preload** | `src/main/preload.ts` | `contextBridge` → `window.ffmpegStudio` (invoke + events) |
| **Renderer** | `index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx` | React UI; `App.tsx` (~4000 строк) — центральный оркестратор |
| **Сборка** | `vite.config.ts`, `electron-builder.json` | Main/preload → `dist-electron/`, renderer → `dist/` |

Связь: renderer → `window.ffmpegStudio.*` → IPC → main → `src/ffmpeg/`, `src/jobs/`, `src/project/`.

### FFmpeg resolver

| Файл | Роль |
|------|------|
| `src/ffmpeg/ffmpegResolver.ts` | Поиск ffmpeg/ffprobe: bundled `resources/bin` → npm `ffmpeg-ffprobe-static` → PATH |
| `src/main/ipc.ts` | `ffmpeg:resolve`, `ffmpeg:test` |
| `src/renderer/hooks/useAppStartup.ts` | Резолв при старте, список фильтров |

### FFmpeg runner / jobs

| Файл | Роль |
|------|------|
| `src/ffmpeg/ffmpegRunner.ts` | Запуск child process, парсинг progress |
| `src/jobs/jobQueue.ts` | Очередь в main: pending → running → done/error/cancelled |
| `src/jobs/jobFactory.ts` | `createProxyJob`, `createCompositionRenderJob`, `createPreviewCacheJob`, … |
| `src/renderer/hooks/useBackgroundJobQueue.ts` | Renderer-side: enqueue, cancel, onJobDone/onJobError |
| `src/main/ipc.ts` | `jobs:enqueue`, `jobs:cancel`, push `job:log/progress/status` |

Типы job: `proxy`, `render`, `preview-cache`, `analysis`, batch.

### Project model

| Файл | Роль |
|------|------|
| `src/shared/project.ts` | `ProjectItem` (footage/composition), `TimelineLayer` |
| `src/shared/projectDocument.ts` | `.ffstudio` schema v1, flat↔snapshot |
| `src/project/projectStore.ts` | Save/load/autosave на диске |
| `src/renderer/hooks/useProjectDocument.ts` | Dirty flag, history API |
| `src/renderer/projectPersistence.ts` | `validateMediaItems`, probe on load |

### Composition model

| Файл | Роль |
|------|------|
| `src/shared/project.ts` | `CompositionMeta`, `createCompositionItem`, `createPrecompLayer` |
| `src/shared/compRuntime.ts` | `CompRuntimeState`, `captureActiveCompRuntime` |
| `src/renderer/App.tsx` | `activeCompositionId`, `compStatesById`, `switchComposition`, `compNavStack` |

Сохранение: каждая comp в `compositions[]` со своими `layers[]`.

### Timeline layers

| Файл | Роль |
|------|------|
| `src/shared/project.ts` | `TimelineLayer` — transform, crop, effects, keyframes, timing |
| `src/renderer/components/TimelineEditor.tsx` | UI: drag, trim, razor, property tree, zoom |
| `src/renderer/commands/layerCommands.ts` | split, duplicate, trim-to-playhead |
| `src/renderer/utils/timelineSnap.ts` | Frame snap |

### Preview system

| Файл | Роль |
|------|------|
| `src/renderer/components/VideoPreview.tsx` | Композитор, playback modes, overlays |
| `src/renderer/components/CompositionPreviewLayer.tsx` | `<video>` на слой |
| `src/renderer/components/PrecompPreviewLayer.tsx` | Рекурсивный nested preview |
| `src/media/mediaCompatibility.ts` | `getSafePreviewPathForItem`, state machine |
| `src/media/previewState.ts` | Labels, debug info |
| `src/renderer/utils/previewPlayback.ts` | video-master vs composition-clock |
| `src/media/previewVideoDebug.ts` | Guards для `<video>` |

### Proxy system

| Файл | Роль |
|------|------|
| `src/media/mediaPostImport.ts` | `runNativePreviewCheck` |
| `src/media/nativePreviewTest.ts` | Hidden `<video>` probe |
| `src/media/nativePreviewCache.ts` | In-memory fail cache |
| `src/ffmpeg/previewProxyBuilder.ts` | FFmpeg args для proxy |
| `src/main/appPaths.ts` | `{userData}/proxies/{itemId}_preview_proxy.mp4` |
| `src/renderer/App.tsx` | `finalizeImportedFootage`, `handleCreatePreviewProxy`, job handlers |

### Render system

| Файл | Роль |
|------|------|
| `src/ffmpeg/compositionRenderBuilder.ts` | FFmpeg filter graph, layer inputs |
| `src/ffmpeg/keyframeExpressions.ts` | Animated transform в render |
| `src/jobs/jobFactory.ts` | `createCompositionRenderJob` |
| `src/renderer/App.tsx` | Render UI, enqueue |

### Effects system

| Файл | Роль |
|------|------|
| `src/shared/effects.ts` | `LayerEffect`, built-in types |
| `src/effects/ffmpegEffectCatalog.ts` | FFmpeg filter catalog |
| `src/effects/applyFilterRecipe.ts` | Smart preset execution |
| `src/renderer/components/EffectControlsPanel.tsx` | Per-layer effect UI |
| `src/renderer/utils/effectPreview.ts` | CSS filters для live preview |

### Smart Presets

| Файл | Роль |
|------|------|
| `src/effects/filterRecipes.ts` | 12 recipes |
| `src/effects/applyFilterRecipe.ts` | `buildRecipePlan`, apply |
| `src/renderer/components/ApplyRecipeDialog.tsx` | Confirm dialog |
| `src/renderer/components/EffectsPresetsPanel.tsx` | Tree UI |

### Keyframes

| Файл | Роль |
|------|------|
| `src/keyframes/keyframeTypes.ts` | Transform + effect param model |
| `src/keyframes/layerTransformKeyframes.ts` | Transform ops |
| `src/keyframes/layerEffectKeyframes.ts` | Effect param ops |
| `src/keyframes/keyframeInterpolation.ts` | Easing |
| `src/ffmpeg/keyframeExpressions.ts` | FFmpeg expressions |
| `src/keyframes/keyframeRenderCompat.ts` | supported / preview-only / static |
| `src/renderer/utils/timelinePropertyReveal.ts` | P/S/R/T/A/U reveal |

### Save / Load

| Файл | Роль |
|------|------|
| `src/shared/projectDocument.ts` | `FFmpegStudioProject` v1 |
| `src/project/projectStore.ts` | File I/O |
| `src/renderer/App.tsx` | `buildProjectFile`, `loadProjectData`, autosave 30s |

### Undo / Redo

| Файл | Роль |
|------|------|
| `src/history/historyStore.ts` | Past/present/future, limit 50 |
| `src/renderer/hooks/useProjectDocument.ts` | `recordHistory`, undo/redo |
| `src/shared/projectDocument.ts` | `EditorStateSnapshot` |

---

## 2. Preview / Proxy flow

### Статусы (актуальные)

```
imported → checking-preview → native-preview-ok
                           → native-preview-failed → proxy-generating → proxy-ready
                                                                    → proxy-failed
```

**`proxy-needed`** — только legacy в старых проектах; при load нормализуется в **`proxy-failed`** (`normalizeCompatibilityStatus` в `mediaCompatibility.ts`).

### Import media

| Шаг | Файл:функция |
|-----|--------------|
| Dialog/drop | `App.tsx:importMediaFiles` |
| Filter extensions | `renderer/utils/mediaFiles.ts:filterVideoPaths` |
| FFprobe | `App.tsx:probeFile` → IPC `ffmpeg:probe` |
| Create item | `mediaCompatibility.ts:createFootageProjectItem` → `status: imported` |
| Create layer | `shared/project.ts:createTimelineLayer` → `sourcePath = original` |
| Post-import | `App.tsx:finalizeImportedFootage` + `generateFootageThumbnail` |

### Native preview check

`App.tsx:finalizeImportedFootage`:

1. `compatibilityStatus = checking-preview`
2. `mediaPostImport.ts:runNativePreviewCheck`
   - `shouldAttemptNativePreview` — skip terminal states
   - `mediaNativePreviewHints.ts` — skip ProRes/10-bit по metadata
   - `nativePreviewTest.ts:testNativeVideoPreview` — hidden `<video>`
3. **OK** → `native-preview-ok`, `previewPath = item.path`
4. **Fail** → `native-preview-failed`, `markNativePreviewFailed(path)`
   - если `settings.autoCreatePreviewProxy !== false` (default **ON**) → `handleCreatePreviewProxy`

### Когда создаётся `<video>`

| Место | Условие |
|-------|---------|
| `CompositionPreviewLayer.tsx` | `previewSourcePath` задан, `canUsePathForHtmlVideo(path)` |
| `nativePreviewTest.ts` | Probe при import |
| `PreviewCacheVideo.tsx` | Cached composition playback |

Guards: `previewVideoDebug.ts:guardVideoElementCreate`, `hasFailedNativePreview` блокирует original после fail.

`<video>` **не** создаётся при `checking-preview`, `proxy-generating`, `native-preview-failed`, `proxy-failed` (пока нет playable path).

### Когда `native-preview-ok`

`App.tsx:finalizeImportedFootage` — после успешного `runNativePreviewCheck`.

### Когда `proxy-needed` / `proxy-failed`

| Ситуация | Статус |
|----------|--------|
| Legacy project load | `proxy-needed` → normalized → `proxy-failed` |
| Job error | `handleBackgroundJobError` → `proxy-failed` |
| Invalid output | `handleBackgroundJobDone` verification fail |
| Orphan `proxy-generating` >15s без job | `App.tsx` watchdog `useEffect` |
| Missing proxy file on load | `validateProxyPaths` → `proxy-failed` |
| Enqueue failure | `handleCreatePreviewProxy` catch |

**Новый код не пишет `proxy-needed`.**

### Auto proxy

| Триггер | Файл |
|---------|------|
| Import native fail | `finalizeImportedFootage` → `handleCreatePreviewProxy` |
| Runtime `<video>` error | `handlePreviewError` → то же |
| Setting | `settingsTypes.ts: autoCreatePreviewProxy: true` |

`previewState.ts:shouldAutoCreateProxy` — определена, но **не вызывается** (логика дублирована inline в `App.tsx`).

### Где хранятся пути

На `ProjectItem` (`shared/project.ts`):

| Поле | Значение |
|------|----------|
| `path` / `originalPath` | Original media |
| `proxyPath` | `{userData}/proxies/{id}_preview_proxy.mp4` |
| `previewPath` | Mirror активного preview: original при `native-preview-ok`, proxy при `proxy-ready` |

Persisted в `.ffstudio` → `mediaItems[]`.

### Какой путь использует Preview

**Authoritative:** `mediaCompatibility.ts:getSafePreviewPathForItem`

| Status | Path |
|--------|------|
| `native-preview-ok` | `originalPath ?? path` |
| `proxy-ready` | `proxyPath` |
| остальные | `null` (blocked) |

**Map:** `App.tsx:previewPathBySourcePath` — `map[item.path] = safePath` (ключ = original).

**Consumers:** `VideoPreview.tsx` → `getLayerPreviewPlaybackState` → `CompositionPreviewLayer` → `window.ffmpegStudio.toFileUrl(path)`.

`getPreviewSourceKind` → `original` / `proxy` / `none`.

### Какой путь использует Render

**Всегда original:**

| Функция | Path |
|---------|------|
| `getRenderPathForItem` | `item.path ?? item.originalPath` |
| `createTimelineLayer` | `layer.sourcePath = import path` |
| `compositionRenderBuilder.ts` | `-i` inputs = `layer.sourcePath` |

Proxy **никогда** не участвует в render.

### UI labels (preview status)

| State | Label |
|-------|-------|
| imported (probed) | Media ready |
| native-preview-ok | Preview ready |
| proxy-generating | Creating preview proxy… |
| proxy-ready | Proxy ready |
| proxy-failed | Proxy failed / Retry |

Preview ready показывается только если `isPreviewPlayable()` — есть реальный playable path.

### Debug block

`PreviewDebugBlock.tsx` — поля: sourcePath, previewPath, proxyPath, compatibilityStatus, preview source, proxy job status.

---

## 3. Composition / Precompose

### Модель

- **Project panel:** `ProjectItem type=composition` — meta (w×h, fps, duration)
- **Timeline:** `TimelineLayer[]` — единственный source of truth для edits
- **Inactive comps:** `compStatesById[id]` — cached layers/playhead/selection
- **Active comp:** `activeCompositionId` + `timelineLayers`

### New Comp

`App.tsx` → `createCompositionItem` → добавление в `projectItems`, switch via `switchComposition`.

### Active comp

`switchComposition`: save current → `compStatesById`, load target layers/runtime.

### Pre-compose

`App.tsx:handlePrecompose` (Ctrl+Shift+C):

1. Selected layers → nested comp
2. Parent timeline: one `createPrecompLayer`
3. Undo via history

### Precomp layer

`layerKind: "precomp"`, `sourceCompositionId`, `hasVideo: true`, `hasAudio: false`.

### Precomp preview

**Работает:** `PrecompPreviewLayer.tsx` — рекурсия, drill-in (`compNavStack`), breadcrumbs в `VideoPreview.tsx`.

### Precomp render

**Не работает (заглушка):** `compositionRenderBuilder.ts` — precomp layers **skipped** с warning:
> "Precomp render is not fully supported yet"

### Честно vs ограничение

| Работает | Ограничение |
|----------|-------------|
| New/Duplicate comp, switch, drill-in | Precomp render skipped |
| Precomp preview (nested) | Precomp audio не моделируется |
| Undo precompose | Deep nesting render не поддержан |
| Save/load comps | Export settings global, не per-comp |

---

## 4. Timeline / Tools

### Инструменты

Toolbar (`toolState.ts:TOOLBAR_TOOLS`): **Selection (V), Razor (G), Crop (C)**.

Типы `hand`, `transform` есть в `toolTypes.ts`, но **не в toolbar**.

### Selection (V)

- **Timeline:** move clip, trim in/out (`TimelineEditor.tsx`, только `activeTool === "selection"`)
- **Preview:** `LayerTransformOverlay` — move/scale handles

### Razor (G)

- Click на clip → split at X (`handleRazorClick`)
- Ctrl+Shift+D → split selected at playhead (`layer.splitAtPlayhead`)

### Crop (C)

- Preview: `CropOverlay`, full source visible during edit
- Enter → apply + `cropEnabled: true`, Esc → cancel
- **Не меняет** composition size (только `layer.crop`)

### Hand

**Не отдельный tool.** Реализован как **Space hold + drag** (`useSpacePan.ts`):

- Timeline: horizontal pan
- Preview: canvas pan
- Space tap (<400ms): play/pause

### Transform

**Слит с Selection.** `showTransformOverlay` при `activeTool === "selection"`. `tool.transform` — stub (нет shortcut/handler).

### Хоткеи (основные)

| Категория | Keys |
|-----------|------|
| Tools | V, G, C, Esc, Enter |
| Playback | Space, Home/End, ←/→ |
| Layer | Ctrl+D, Ctrl+Shift+D, Ctrl+Shift+C, Delete |
| Reveal | P, S, Shift+S, R, T, A, U |
| Keyframes | J/K, F9, Alt+P/S/R/T, Ctrl+C/V |
| Project | Ctrl+Z/Y, Ctrl+S/O/N |

Полный список: `commands/commandRegistry.ts`.

### Known issues

- QA-006: multi-layer composition-clock sub-frame drift (minor)
- QA-007: audio-only files — no preview audio
- `usePlaybackHotkeys.ts` — dead code (не подключён)
- `tool.hand` / `tool.transform` — types only

---

## 5. Effects & Presets

### Дерево эффектов

`EffectsPresetsPanel.tsx` — два root:

1. **Smart Presets** — 6 category folders, 12 recipes
2. **FFmpeg Filters** — catalog + legacy built-in groups

Node types: `folder`, `recipe`, `effect` (`effectPresetRowUtils.ts`).

### Folder expanded states

| Key | Файл |
|-----|------|
| `effectsPresetsExpandedFoldersV3` | `useEffectsTreeExpansion.ts` |

Value: `Record<folderId, true>` (только expanded). Default: **все закрыты**. Legacy keys V1/V2 purged on load.

Дополнительно: `ffmpeg-studio-show-unavailable-filters` в `effectPresetRowUtils.ts`.

### Почему папки могут быть открыты

1. Пользователь раскрыл → сохранено в localStorage V3
2. **Search mode:** non-empty query → auto-expand все matching folders (override saved state)
3. Кнопка Reset folders → clear key

### Search mode

Live substring filter в `EffectsPresetsPanel.tsx:filterTree`. При query ≠ "" → `effectiveExpanded = all folder IDs in filtered tree`. Нет fuzzy/ranking.

### Добавление эффекта

Effect Controls → Add → или Apply из дерева → `layer.effects[]` mutate → `recordHistory`.

### Smart Preset

`filterRecipes.ts` → `buildRecipePlan` → `ApplyRecipeDialog` → `applyFilterRecipe.ts` (add effects, set export, enqueue jobs). Undo — один history push.

---

## 6. Keyframes

### Анимируемые свойства

**Transform:** positionX/Y, scaleX/Y, rotation, opacity (`keyframeTypes.ts`).

**Effect params:** per-effect в `effectKeyframes.ts` (blur, speed, sharpen и др. — с flags `renderSupported`/`previewSupported`).

### Хранение

`TimelineLayer.keyframes` + `layer.effects[].params.keyframes` — в composition.layers, persisted в `.ffstudio`.

### P/S/R/T/A/U

`timelinePropertyReveal.ts` + `commandRegistry.ts`:

- P/S/R/T/A → single-property reveal
- Shift+S → additive
- U → changed-only rows

### F9

`keyframe.easyEase` → `easeInOut` на selected keyframes. Ease In/Out — только context menu (`KeyframeContextMenu.tsx`).

### Right-click interpolation

`KeyframeContextMenu.tsx` — linear, hold, easeIn, easeOut, easeInOut.

### Render support

Transform: все groups `supported` (`keyframeRenderCompat.ts`).

Effects: часть params `preview-only` — render использует value at range start + warning.

### Ограничения

- Anchor point keyframes — preview-only (static in render)
- Animated Speed effect — preview-only
- Keyframe selection / clipboard / reveal mode — **не в undo**
- `property.showEffects` — command ID без shortcut

---

## 7. Что сломано или рискованно

### Blocker

| # | Симптом | Причина | Файлы | Безопасный план |
|---|---------|---------|-------|----------------|
| B1 | Precomp comp не рендерится (слои пропадают) | `compositionRenderBuilder.ts` явно skips precomp | `compositionRenderBuilder.ts`, `App.tsx` render handler | MVP: flatten 1-level precomp в render graph; не трогать preview |

### Major

| # | Симптом | Причина | Файлы | Безопасный план |
|---|---------|---------|-------|----------------|
| M1 | `App.tsx` — любое изменение ломает unrelated | Monolith ~4000 строк, вся state/logic | `App.tsx` | Extract только proxy/import в hook **без** behavior change; тесты по REGRESSION_CHECKLIST |
| M2 | Proxy-generating → false proxy-failed | Race: status до enqueue job; watchdog 15s | `App.tsx` finalize + watchdog useEffect | Частично mitigated; добавить in-flight ref |
| M3 | Multi-layer A/V drift | composition-clock free-run между seeks | `VideoPreview.tsx`, `previewPlayback.ts` | Профилировать QA-006; не менять video-master path |
| M4 | `shouldAutoCreateProxy` dead code | Дублирование логики в App | `previewState.ts`, `App.tsx` | Wire-up или delete (cleanup only) |
| M5 | Jobs не восстанавливаются после load | By design — not persisted | `useBackgroundJobQueue.ts`, `projectDocument.ts` | Document + UI message; не auto-restart proxy |

### Minor

| # | Симптом | Причина | Файлы | Безопасный план |
|---|---------|---------|-------|----------------|
| m1 | Audio-only — нет звука в preview | `resolveAudibleLayerId` requires video | `previewAudio.ts` | QA-007 scoped fix |
| m2 | `usePlaybackHotkeys` unused | Superseded by command system | `usePlaybackHotkeys.ts` | Delete after grep confirm |
| m3 | tool.hand/transform stubs | Toolbar cleanup incomplete | `toolTypes.ts`, `commandTypes.ts` | Remove types or document as Space-pan |
| m4 | Autosave только для saved projects | Guard in App autosave effect | `App.tsx` | UX hint for untitled |
| m5 | `webSecurity: false` | main.ts window config | `main.ts` | Security review before release |
| m6 | Effect keyframes preview-only | render compat flags | `effectKeyframeRenderCompat.ts` | Warnings already shown; extend render per effect |
| m7 | Project thumbnails placeholder | v0.2 branch disabled | `DEV_NOTES.md`, `ProjectItemThumbnail.tsx` | Out of scope until v0.2 |

---

## 8. Что НЕ надо трогать

1. **Preview/proxy state machine** — недавно стабилизирована (`mediaCompatibility.ts`, `previewState.ts`, `App.tsx` proxy handlers)
2. **`getSafePreviewPathForItem` / `getRenderPathForItem`** — контракт preview≠render
3. **`compositionRenderBuilder.ts` core** (footage layers) — working render path
4. **`keyframeExpressions.ts`** — transform render parity v2
5. **`historyStore.ts` + snapshot format** — undo и save/load coupling
6. **`JobQueue` main process** — sequential execution model
7. **Per-layer state model** — `TimelineLayer` as source of truth
8. **Command registry / shortcuts** — P/S/R/T/A/U, tools
9. **Thumbnail pipeline** — отдельная v0.2 ветка
10. **`.ffstudio` v1 schema** — breaking change requires migration

---

## 9. Рекомендованный следующий план (3–5 маленьких задач)

1. **Manual regression: Preview/Proxy** — прогнать `REGRESSION_CHECKLIST.md` IMP-1..3, PRV-1..5 с supported + unsupported MP4; зафиксировать в `QA_CHECKLIST.md`.

2. **Precomp render MVP (1 level)** — flatten single precomp в `compositionRenderBuilder.ts` без изменения preview/precompose UI.

3. **Proxy flow hardening (minimal)** — in-flight ref для proxy enqueue; убрать дублирование `shouldAutoCreateProxy` vs inline App logic.

4. **Dead code cleanup** — удалить `usePlaybackHotkeys.ts`, неиспользуемые tool command stubs (grep-first).

5. **QA-006 investigation** — измерить drift в multi-layer composition-clock; patch только если >1 frame без затрагивания video-master.

---

## Итог

```
Current status:
  v0.1 feature-complete for single-layer workflow; preview/proxy state machine stabilized;
  precomp preview works, precomp render does not; QA-001..005 fixed, QA-006/007 open minor.

Stable parts:
  Import + probe, native preview check, auto proxy flow, proxy-ready playback,
  footage render, transform keyframes render, timeline tools (V/G/C), AE hotkeys P/S/R/T/A/U,
  effects + smart presets, save/load v1, undo/redo (50 steps), command shortcut system,
  npm run check / build pipeline.

Unstable parts:
  Precomp render (skipped), App.tsx monolith, proxy-generating race edge cases,
  multi-layer composition-clock drift (QA-006), audio-only preview (QA-007),
  some effect keyframe render parity (preview-only params).

Recommended next task:
  Manual regression pass IMP/PRV (supported + unsupported MP4) per REGRESSION_CHECKLIST.md,
  then Precomp render MVP (single-level flatten only).

Files to inspect first:
  src/renderer/App.tsx
  src/media/mediaCompatibility.ts
  src/media/previewState.ts
  src/ffmpeg/compositionRenderBuilder.ts
  src/renderer/components/VideoPreview.tsx
  src/renderer/components/CompositionPreviewLayer.tsx
  REGRESSION_CHECKLIST.md
  QA_CHECKLIST.md
```
