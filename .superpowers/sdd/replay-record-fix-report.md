# Replay Record Fix Report

## Status
Implemented. `replayCurrentTrack()` now records the current track only after `audio.play()` resolves, reusing the same confirmed playback helper as `playTrack()` with token/current track/current URL checks to avoid stale promise recording.

## Files changed
- `C:/Users/wjx/Desktop/Claudio/.claude/worktrees/play-history-page/frontend/js/audio-core.js`
- `C:/Users/wjx/Desktop/Claudio/.claude/worktrees/play-history-page/frontend/js/history-panel.js`
- `C:/Users/wjx/Desktop/Claudio/.claude/worktrees/play-history-page/tests/frontend-polish.test.ts`
- `C:/Users/wjx/Desktop/Claudio/.claude/worktrees/play-history-page/.superpowers/sdd/replay-record-fix-report.md`

## Tests run with exact commands/summaries
- `npx vitest run tests/frontend-polish.test.ts`
  - RED before implementation: failed 1/8 as expected because `recordConfirmedPlayback` did not exist.
- `npx vitest run tests/frontend-polish.test.ts`
  - GREEN after implementation and test alignment: passed 8/8.
- `npx vitest run tests/frontend-polish.test.ts tests/db.test.ts tests/router.test.ts`
  - Passed 3 files, 36 tests. Expected stderr from router error middleware test was present.
- `npm test`
  - Passed 23 files, 141 tests. Expected stderr from negative/error-path tests was present.

## Commit hash(es)
- `c4aec8b`

## Self-review notes
- `playTrack()` behavior is preserved: it still sets `currentTrack`, normalizes and assigns `audio.src`, updates UI/media session immediately, and starts playback immediately.
- History recording has been extracted to `recordConfirmedPlayback(item, token, expectedUrl)` so both initial play and replay share the resolved-play confirmation logic.
- `recordConfirmedPlayback` checks `token === playRequestToken`, `state.currentTrack === item`, and `audio.src === expectedUrl` before recording, which guards stale promises from earlier play/replay attempts.
- `playTrack()` now returns the record completion promise, allowing `history-panel.js` to await recording before refreshing the history panel.
- `recordPlayback()` now returns its fetch promise while preserving the existing catch-and-warn behavior.

## Concerns
- The new regression test follows the existing source-string test style rather than a browser-level behavioral test.
- Full test output includes expected stderr from error-path tests; no test failures were reported.
