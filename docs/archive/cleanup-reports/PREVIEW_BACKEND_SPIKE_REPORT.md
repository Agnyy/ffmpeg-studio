# Preview Backend Spike Report — Phase 0

**Дата:** 2026-06-09  
**Backend:** `node-av` v6.0.0  
**Тестовый файл:** `C:\Users\New User\Videos\2026-06-04 23-03-21.mp4`  
**Скрипт:** `npm run preview:spike` → `scripts/preview-spike/nodeAvSmokeTest.ts`

---

## Summary

Phase 0 spike **успешен**. `node-av` устанавливается на Windows, открывает проблемный MP4 (который ломает Electron `<video>` с `Unsupported pixel format: -1`), читает metadata, делает seek на 1 с, декодирует кадр и сохраняет PNG.

**Рекомендация: continue** — переходить к Phase 1 (`PreviewService` skeleton за feature flag).

Основной проект (`src/`, preview, proxy) **не изменялся**. `npm run build` — **pass**.

---

## node-av install result

| Проверка | Результат |
|----------|-----------|
| `npm install node-av` (devDependency) | **OK** |
| Версия | `node-av@^6.0.0` |
| Windows native binaries | Загружены, модуль импортируется |
| Доп. runner | `tsx@^4.22.4` (devDependency) |

Ошибок установки нет.

---

## Decode result

| Шаг | Результат | Детали |
|-----|-----------|--------|
| Open file | **OK** | `Demuxer.open()` |
| Read metadata | **OK** | `probe()` + stream info |
| Seek 1s | **OK** | `input.seek(1, streamIndex, AVSEEK_FLAG_BACKWARD)` |
| Decode frame | **OK** | `Decoder.create()` + `decoder.frames()` |
| RGBA buffer | **OK** | `Scaler.toBuffer(frame, { format: 'rgba' })` — 3 686 400 bytes (1280×720×4) |

### Metadata

| Поле | Значение |
|------|----------|
| duration | 185.400 s |
| width | 1280 |
| height | 720 |
| fps | 30.000 |
| pixel format | `yuv420p` |
| codec | `h264` |

### Наблюдение

FFprobe/node-av видят `yuv420p` / `h264`, но Chromium `<video>` всё равно падает с `Unsupported pixel format: -1`. Это подтверждает гипотезу: проблема в **Chromium media pipeline**, а не в отсутствии поддержки формата в FFmpeg. Native libav backend обходит это ограничение.

При открытии файла FFmpeg вывел предупреждение (не fatal):

```text
[mov,mp4,m4a,3gp,3g2,mj2] UDTA parsing failed retrying raw
```

Декодирование продолжилось нормально.

---

## Frame output result

| Проверка | Результат |
|----------|-----------|
| PNG saved | **OK** |
| Path | `scripts/preview-spike/out/frame-test.png` |
| File size | 955 997 bytes |
| Source frame | 1280×720 |
| RGBA raw | 3 686 400 bytes |

Кадр на 1 секунде визуально валиден (PNG создан через `Scaler.toPng()`).

---

## Timings

| Операция | Время |
|----------|-------|
| open | 42.3 ms |
| seek 1s | 0.4 ms |
| decode + RGBA + PNG | 242.9 ms |

**Заметки:**

- Seek очень быстрый (keyframe index в MP4).
- Decode 243 ms включает: demux packet → decode → `toBuffer(rgba)` → `toPng(rgb)`.
- Для preview pipeline v1 потребуется downscale (например 960×540) и/или GPU path, чтобы уложиться в 16 ms/frame budget при playback — это задача Phase 1–3, не блокер для выбора backend.

---

## Problems

| # | Проблема | Severity | Комментарий |
|---|----------|----------|-------------|
| 1 | Chromium vs FFmpeg mismatch | Info | Файл декодируется FFmpeg, но не `<video>` — spike подтверждает необходимость смены backend |
| 2 | UDTA parse warning | Low | Не мешает decode; типично для screen-record MP4 |
| 3 | Full-res RGBA = 3.6 MB/frame | Medium | Для realtime preview нужен downscale / shared texture (см. `PREVIEW_BACKEND_RESEARCH.md`) |
| 4 | Spike не тестировал audio / HW decode | Low | Следующий spike-шаг при необходимости |
| 5 | `node-av` — отдельный FFmpeg runtime от `ffmpeg-ffprobe-static` | Low | Ожидаемо; версии нужно пинить в Phase 1 |

Критических блокеров для выбора `node-av` **нет**.

---

## Recommendation

### **continue with node-av**

**Почему:**

1. Проблемный файл открывается и декодируется без proxy.
2. Установка на Windows прошла без native rebuild.
3. High-level API (`Demuxer`, `Decoder`, `Scaler`, `probe`) достаточен для Phase 1.
4. Стыкуется с архитектурой из `PREVIEW_BACKEND_RESEARCH.md`.

**Следующий шаг (Phase 1):**

- `src/main/preview/PreviewService.ts` (изолированно, feature flag)
- IPC `preview:open/play/seek/stepFrame`
- Без изменения `finalizeImportedFootage` / auto proxy до отдельного PR

**Не делать:**

- Не подключать spike к Electron UI
- Не менять proxy logic на основании только Phase 0

---

## Acceptance checklist

| Критерий | Статус |
|----------|--------|
| `npm run preview:spike` запускается отдельно | ✅ |
| `src/` не изменён | ✅ |
| `VideoPreview.tsx` не изменён | ✅ |
| proxy logic не изменена | ✅ |
| Electron UI не затронут | ✅ |
| `frame-test.png` создан при успешном decode | ✅ |
| При fail — понятная причина в логах | ✅ (не применимо — success) |
| `npm run build` проходит | ✅ |

---

## Как повторить

```bash
npm run preview:spike
# или с другим файлом:
npx tsx scripts/preview-spike/nodeAvSmokeTest.ts "D:\path\to\video.mp4"
```

Ожидаемый вывод:

```text
PREVIEW BACKEND SPIKE
backend: node-av
file: ...
open: OK
metadata: duration=..., width=..., height=..., fps=..., pix_fmt=..., codec=...
seek 1s: OK
decode frame: OK
frame size: ...
time open: ...ms
time seek: ...ms
time decode: ...ms
output frame: ...\scripts\preview-spike\out\frame-test.png
```
