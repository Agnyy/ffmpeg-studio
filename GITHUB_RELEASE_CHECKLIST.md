# FFmpeg Studio — Release Checklist

## Required manual checks

- [ ] Import MP4
- [ ] First frame visible
- [ ] Press Play
- [ ] Video moves
- [ ] Audio plays
- [ ] Pause
- [ ] Video pauses
- [ ] Audio pauses
- [ ] Seek to 10s while paused
- [ ] Frame near 10s appears
- [ ] Play from 10s
- [ ] Video/audio continue from 10s
- [ ] Seek to 70s while playing
- [ ] Video/audio jump to 70s
- [ ] Cache ranges visible
- [ ] No engine error
- [ ] No FFmpeg assertion
- [ ] No UDTA spam
- [ ] Render/export window opens
- [ ] Export starts or fails with understandable error

## Known automated status

- `npm run check`: PASS
- `preview:selftest`: PASS
- `preview:crash-test:light`: OOM in headless Electron, not confirmed native crash
