# TypeRush

A playable, browser-local typing racing game built with React, Vite, Tailwind CSS, Lucide icons, and custom animated SVG cars. No account, API key, database, or WebGL required.

For production release and free hosting instructions, see [DEPLOYMENT.md](DEPLOYMENT.md). TypeFight is available at `/#/fight`; game selection is at `/#/games`.

## Run locally

Requires Node.js 22.12+ (or Node.js 24).

```powershell
cd C:\projects\TypeRush
npm ci
npm run dev
```

Open the Local URL printed by Vite. For a production build:

```powershell
npm run build
npm run preview
```

## Play

Choose a mode and difficulty, then select **Start race**. After the countdown, type the passage exactly, including spaces, capitalization, and punctuation. Each correct character moves the car. A mistake locks progress until Backspace clears it. Backspace with no mistake removes the previous validated character. Holding a key, pasting, dropping text, and multi-character replacements cannot complete a passage.

Escape pauses/resumes a race. Switching tabs pauses racing and cancels an unfinished countdown. A refresh abandons the active race; completed results and preferences remain saved. Enable sound using the speaker control. Sound starts only after interaction. Settings includes reduced motion and respects the system preference by default.

### Modes

- **Quick race:** one player and three seeded AI drivers. First across the line ends the race for everyone.
- **Practice:** no opponents or time limit.
- **Time trial:** 15, 30, 60, or 120 seconds; reaching the passage end adds more text.
- **Challenge:** win a race to unlock the next difficulty, up to Expert.
- **Custom race:** choose Short, Medium, or Long text and any AI difficulty.

Nonfinishers are ranked by validated progress at the moment the winner finishes; their positions are not claimed finishing times. The leaderboard is local to this browser, not global.

## Scoring

Time starts at GO and excludes pauses. Every character attempt counts toward total keystrokes. Correct attempts and mistakes are retained even if later removed. Backspace, shortcuts, rejected paste, and held-key repeats do not count as character attempts.

- Gross WPM = `(total character attempts / 5) / elapsed minutes`.
- Net WPM = `max(0, gross WPM - cumulative incorrect attempts / elapsed minutes)`.
- Accuracy = `correct character attempts / total character attempts * 100` (100% before any attempt).
- CPM = `total character attempts / elapsed minutes`.
- Race progress = `current validated prefix length / passage length`.

The cumulative-error net-WPM policy penalizes corrected errors too. Race placement uses validated progress, so deleting/retyping characters cannot advance a car unfairly. Guest statistics are for personal practice; browser-local data is not tamper-proof competitive scoring.

AI uses seeded character events with target WPM, individual accuracy, typing cadence variation, and recovery delays for mistakes. Event order and finish time do not depend on animation frame size. The UI updates at up to 20Hz during racing; CSS interpolates car movement. Visuals use source SVG/CSS/Canvas. Keyboard audio uses CC0 recordings with credits in public/audio/mechanical/CREDITS.md.

## Structure

- `src/engine.js`: independent typing, AI, timer, standings, passage, and scoring logic.
- `src/App.jsx`: game state transitions, accessible controls, modes, results, and statistics.
- `src/Track.jsx`: circuit and custom SVG cars.
- `src/storage.js`: replaceable guest storage service, failure fallback.
- `src/audio.js`: optional synthesized interaction sounds.
- `src/style.css`: responsive visuals and reduced-motion behavior.

## Tests

```powershell
npm test
```

For browser tests, start `npm run dev -- --port 5177` in another terminal, then run:

```powershell
node tests/browser.mjs
```

The browser suite uses an installed Google Chrome and Playwright, tests a complete player win, correction, local persistence, replay, pause/resume, a timed finish, and a mobile viewport. Screenshots are saved under `tests/`. Desktop keyboard behavior is tested; physical iOS/Android keyboards still require device testing.

## Persistence and limits

The `typerush.v1` localStorage record saves best WPM, best accuracy, completed sessions, competitive wins/losses, up to 30 recent sessions, difficulty, sound, and reduced-motion preferences. Storage failures show a notice instead of breaking gameplay. No data is sent to a server.

The app uses lightweight 2D racing visuals, synthesized beeps, and CSS motion. It does not include multiplayer, authentication, engine recordings, or a server-backed leaderboard.

## Play a friend

TypeFight now supports two devices using manually exchanged WebRTC connection codes, with no application backend or database. Open **Play a friend** in TypeFight. See [MULTIPLAYER.md](MULTIPLAYER.md) for connection steps and network limitations. Solo AI modes are unchanged.
