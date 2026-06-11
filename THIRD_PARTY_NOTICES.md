# Third-Party Notices

FFmpeg Studio uses third-party software. This document lists notable components and their roles.

## FFmpeg / FFprobe

This application invokes **FFmpeg** and **FFprobe** as external command-line tools.

- FFmpeg is a multimedia framework maintained by the FFmpeg project.
- FFmpeg is a trademark of Fabrice Bellard.
- FFmpeg Studio is **not** affiliated with or endorsed by the FFmpeg project.

Depending on your configuration and platform, FFmpeg may be provided by:

1. Binaries bundled with a release build (`resources/bin`)
2. The npm package `ffmpeg-ffprobe-static` (development and fallback)
3. A system installation available on `PATH`
4. A custom path configured in Settings

You are responsible for complying with FFmpeg's license terms when distributing or using FFmpeg binaries.

## Electron

Desktop shell and runtime.

- Website: https://www.electronjs.org/
- License: MIT

## React

User interface library.

- Website: https://react.dev/
- License: MIT

## Vite

Frontend build tool.

- Website: https://vitejs.dev/
- License: MIT

## Lucide React

Icon components used in the timeline and effects browser.

- Website: https://lucide.dev/
- License: ISC

## Other npm dependencies

See `package.json` for the full dependency list and consult each package's license in `node_modules` after installation.
