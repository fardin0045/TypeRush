# TypeFight

TypeFight is a second game inside the existing TypeRush React/Vite app. The racing implementation is retained. No extra runtime dependencies or accounts are required.

## Start

```powershell
cd C:\projects\TypeRush
npm run dev
```

Use the TypeFight link in the race navigation, or open `/#/fight`. `/#/games` opens game selection; `/#/race` opens TypeRush. Switching games unmounts the old game and cleans up its animation loop, timers, and keyboard handlers.

## Play

1. Choose Quick Fight or Practice and one of four difficulties.
2. Start the fight. After the three-second countdown, type the displayed single lowercase word exactly. Each correct character triggers a punch, alternating left and right hands. Wrong characters and Backspace never trigger attacks.
3. A wrong character blocks progress until Backspace clears it. Holding a key, paste, and text drops cannot complete challenges.
4. The first fighter to complete the word finishes their queued punches and delivers a kick. During the finishing kick and recovery, typing is locked. A new single word follows.
5. Build consecutive completed words to increase damage. Word completions cycle through roundhouse, flying and spinning kicks. Character punches provide immediate animation and sound; health damage remains on the finishing kick.

Tap the challenge panel to focus the native keyboard on mobile. Escape or the pause control pauses/resumes. Switching tabs pauses the match. Sound and reduced-motion preferences are shared with TypeRush. Preferences and completed fight statistics are saved locally.

### Defenses

Choose a stance while a challenge is active; neither requires a letter key, so it does not conflict with typing.

- **Attack:** full damage.
- **Block:** incoming damage is multiplied by 0.4; outgoing damage by 0.75.
- **Dodge:** a seeded 60% chance to evade an incoming attack; outgoing damage is multiplied by 0.65.

The AI chooses from the same stances and uses the same damage/health rules. Higher difficulty increases AI typing WPM, accuracy, defense frequency, and word complexity. The opponent's typing progress is visible. The AI types character events, makes mistakes, and spends time recovering. It cannot deal damage without completing the challenge.

### Damage and metrics

Both fighters begin at 100 HP. Damage is `round(base damage × (1 + min(combo - 1, 5) × 0.23) × accuracy bonus × stance modifier)`, followed by the defender's block/dodge rule. A mistake-free challenge earns a 1.12 accuracy bonus. The losing fighter's combo resets. Base move damage ranges from 11 to 16. If neither fighter finishes before the challenge deadline, both chains reset and a fresh challenge begins without arbitrary damage.

Average typing WPM is correct character attempts / 5 / active typing minutes. It excludes countdowns, pauses, attacks and recovery. Accuracy is correct character attempts / total attempts. Backspace does not count as a character attempt. Results include best combo, challenges won/lost, attacks landed, errors, accuracy, WPM, and match duration. Practice has no AI attacks, deadline, or health depletion.

## Architecture

- `src/GameRouter.jsx`: game selection and lightweight hash routes.
- `src/fight/combat.js`: independent combat state machine, seeded AI, validation, damage and metrics. States: ready → countdown → fighting → attack → recovery; finished follows a knockout. Pausing preserves the previous state.
- `src/fight/moves.js`: word-to-move catalog and shared contact timeline for damage, effects and sound.
- `src/fight/choreography.js`: paired anticipation, strikes, clinches, throws, knockbacks and recovery poses.
- `src/fight/animator.js`: procedural joint poses for distinct attacks, airborne moves, rotation, defense, hit reactions, knockdown, recovery, victory and defeat.
- `src/fight/FightingArena.jsx`: Canvas rooftop renderer, fighters, impact particles and camera feedback.
- `src/fight/TypeFightPage.jsx`: UI, health bars, input, settings, results and persistence.
- `src/fight/fightAudio.js`: synthesized combat cues, gated by sound settings and browser interaction.
- `src/fight/fight.css`: scoped fight and game-selection layouts.

Combat rules accept a mutable state object and elapsed-time increments; rendering never decides winners. Player input first advances the simulation to the input timestamp. If AI completion occurs at or before that timestamp, its already-completed challenge wins. The first resolution locks further attacks until recovery, preventing duplicates.

## Verification

```powershell
npm test
npm run build
```

For the browser integration suite, start the app with `npm run dev -- --port 5177`, then run `npm run test:fight-browser`. The suite requires installed Google Chrome and checks a complete fight, correction, combos, results, replay, local persistence, a complete race after switching games, and mobile Practice controls.

Physical mobile keyboards and audio quality still need device testing. Quick Fight and Practice remain available alongside friend matches. Manual-code WebRTC multiplayer is documented in MULTIPLAYER.md. Story, Survival and unlockable arenas remain future work. `combat.js` isolates the AI decision producer so a future second-player input adapter can be introduced without placing multiplayer logic in the renderer.

Combat audio uses distinct layered noise and body-impact profiles for each move, plus cloth, whoosh, dodge and block cues. Cues follow simulation contact times; pause freezes playback and muted contacts are never replayed. Health changes at the final contact, not word completion. Browser audio still requires a user gesture.

## Play a friend

TypeFight now supports two devices using manually exchanged WebRTC connection codes, with no application backend or database. Open **Play a friend** in TypeFight. See [MULTIPLAYER.md](MULTIPLAYER.md) for connection steps and network limitations. Solo AI modes are unchanged.
