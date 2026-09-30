# Alien Kada: Gali No. 10

A 3D alien-transformation game inspired by Ben 10, with original characters, set on an Indian street. Built with Three.js, runs in the browser, and is packaged for Android with Capacitor.

## Run (web)
```bash
npm install
npm run dev        # opens on http://localhost:5173 (and your LAN IP, so you can test on a phone)
npm run build      # production build -> dist/
```

## Android
- Ready-made debug APK: `AlienKada-debug.apk` (enable "Install unknown apps" on the phone).
- Rebuild: `npm run android:sync`, then `cd android && ./gradlew assembleDebug`, or open the `android/` folder in Android Studio.

## Controls
| | PC | Mobile |
|---|---|---|
| Move / run | WASD, Shift | Left joystick (push all the way = run) |
| Camera | Mouse (click to lock) | Swipe on the right side |
| Jump / fly | Space (hold for Garuda/Chhaya) | JUMP |
| Power | Left click / F | POWER |
| Kada wheel | Q / Tab, or 1-0 to pick directly | Green Kada button |
| Back to human | R | HUMAN |

## The 10 aliens
Agni (fireball), Vajra (4 arms, ground slam), Vega (super-speed dash), Hima (ice shards that freeze), Vidyut (chain lightning), Garuda (flight + tornado), Pashan (throws boulders), Chhaya (ghost telekinesis, grab and throw), Tarang (sonic blast), Anu (shrink ray + double jump).

## Code map
`src/world.js` street, buildings, props and physics · `src/characters.js` procedural models and animation · `src/player.js` movement and transformation · `src/combat.js` powers · `src/drones.js` enemies · `src/camera.js` third-person camera · `src/effects.js` particles · `src/ui.js` HUD and wheel · `tools/smoke-test.mjs` headless test.
