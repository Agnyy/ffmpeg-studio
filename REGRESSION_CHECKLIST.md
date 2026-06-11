# FFmpeg Studio — Regression Checklist

**Purpose:** Mandatory manual scenarios to verify after any non-trivial change.  
**Automated gate:** run `npm run check` before every PR / handoff (typecheck, build, lint/tests when configured).

**Basic flow:**

```text
Import → Preview → Timeline → Composition → Effects → Project (save/load/undo)
```

Mark each item after verification: `☐` not run · `☑` pass · `☒` fail (note repro in commit/PR).

---

## Import

| ID | Scenario | Pass | Notes |
|----|----------|------|-------|
| IMP-1 | Import normal H.264 MP4 | ☐ | File appears in Project, metadata probes, thumbnail starts |
| IMP-2 | Import unsupported / non-native MP4 | ☐ | Status → native fail or proxy path; no broken `<video>` on original |
| IMP-3 | Proxy flow (auto or manual) | ☐ | Creating proxy → proxy-ready → preview plays proxy; failure shows Retry |

---

## Preview

| ID | Scenario | Pass | Notes |
|----|----------|------|-------|
| PRV-1 | Play | ☐ | Playback starts; timecode advances |
| PRV-2 | Pause | ☐ | Frame holds; audio stops |
| PRV-3 | Scrub (playhead / seek) | ☐ | Frame updates while paused |
| PRV-4 | Audio | ☐ | Audible layer plays; mute respected |
| PRV-5 | Proxy playback | ☐ | Unsupported file plays via proxy path after proxy-ready |

---

## Timeline

| ID | Scenario | Pass | Notes |
|----|----------|------|-------|
| TL-1 | Move layer (drag clip) | ☐ | Start time updates; preview follows |
| TL-2 | Trim (in/out handles) | ☐ | Duration and source trim correct |
| TL-3 | Razor split at playhead | ☐ | One layer becomes two at playhead |
| TL-4 | Zoom (H / V / fit) | ☐ | Timeline scales; playhead still accurate |
| TL-5 | Keyframes **P** Position | ☐ | Reveal / diamond only Position |
| TL-6 | Keyframes **S** Scale | ☐ | |
| TL-7 | Keyframes **R** Rotation | ☐ | |
| TL-8 | Keyframes **T** Opacity | ☐ | |
| TL-9 | Keyframes **A** Anchor | ☐ | |
| TL-10 | Keyframes **U** (changed only) | ☐ | Only animated rows visible |

---

## Composition

| ID | Scenario | Pass | Notes |
|----|----------|------|-------|
| CMP-1 | New Comp | ☐ | Item created; opens in timeline |
| CMP-2 | Duplicate composition | ☐ | Copy with new id/name |
| CMP-3 | Precompose selection | ☐ | Layers become precomp layer |
| CMP-4 | Open precomp (drill-in) | ☐ | Breadcrumb / nested timeline works |
| CMP-5 | Render active comp | ☐ | Job completes; output file valid |

---

## Effects

| ID | Scenario | Pass | Notes |
|----|----------|------|-------|
| FX-1 | Add effect to layer | ☐ | Effect appears in Effect Controls |
| FX-2 | Edit effect params | ☐ | Preview or UI reflects change |
| FX-3 | Smart preset apply | ☐ | Preset applies expected params |
| FX-4 | Render with effect | ☐ | Output includes effect (not bypassed) |

---

## Project

| ID | Scenario | Pass | Notes |
|----|----------|------|-------|
| PRJ-1 | Save project | ☐ | `.ffstudio` (or project format) writes without error |
| PRJ-2 | Load project | ☐ | Items, timeline, effects restored |
| PRJ-3 | Undo | ☐ | Last edit reverted |
| PRJ-4 | Redo | ☐ | Undone edit restored |

---

## Automated checks (`npm run check`)

| Step | Command | Required |
|------|---------|----------|
| Typecheck | `tsc --noEmit` | Yes |
| Build | `vite build` (+ electron bundles) | Yes |
| Lint | `npm run lint` | Only if lint script exists |
| Unit tests | `npm run test` | Only if test script exists |

---

## Task completion template (Cursor / PR)

Every non-trivial task must end with:

### Changed
- …

### Not touched
- …

### Regression checklist verified
- Automated: `npm run check` — pass / fail
- Manual (list IDs): e.g. `IMP-1`, `PRV-1`, `TL-1` — or *none* (explain why)

If a checklist area was not exercised, say **not verified** — do not claim pass.
