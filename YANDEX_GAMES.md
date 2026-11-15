# Yandex Games build

This branch is a separate Yandex Games build. The original `main` branch and the live site are not changed.

## Files

- `index.html` — game interface and game logic.
- `yandex-sdk.js` — isolated adapter for the Yandex Games SDK.
- `online-client.js` — WebSocket multiplayer client for the existing Cloudflare Durable Object server.
- `/sdk.js` — loaded from the Yandex platform; do not download or commit this file.

## SDK integration

The adapter:

- initializes `YaGames.init()` and reports `LoadingAPI.ready()` after the game UI is ready;
- tracks gameplay with `GameplayAPI.start()` and `GameplayAPI.stop()`;
- handles `game_api_pause` and `game_api_resume`, plus browser-tab visibility;
- requests an interstitial when the player exits an active game session;
- exposes an optional rewarded-video helper;
- exposes optional Player/cloud-save helpers: `getPlayer()`, `loadPlayerData()`, and `savePlayerData()`.

The game still works in a regular browser if the Yandex SDK is unavailable. Player data helpers are not automatically used to upload custom packs: image-based packs can exceed the SDK's 200 KB per-player data limit. Existing packs continue to use browser storage. For uploaded ZIP builds, Yandex documents that its SDK wrapper makes `localStorage` reliable.

## Build and upload

1. Download the contents of this branch.
2. Create a ZIP with `index.html`, `yandex-sdk.js`, and all required game assets at the archive root. Do not ZIP the containing folder itself.
3. Upload the ZIP as a draft in the Yandex Games developer console.
4. Test using the Yandex debug panel before submitting for moderation.

## Test checklist

- SDK loader initializes (debug-panel loader indicator).
- Game Ready becomes green once the menu is interactive.
- Gameplay becomes active on the game screen and stops in menus.
- Pause/resume works when switching tabs or when the platform pauses the game.
- Fullscreen ads close correctly and return control to the game/menu.
- The game still opens if SDK initialization or an ad request fails.

## Multiplayer test checklist

- Create a room and share its code with a second device.
- Join the room from that device and confirm both players choose a secret character.
- Test turns, questions, yes/no answers, incorrect and correct guesses, and disconnects.
- Use packs with 20, 30, 40, 50, or 60 characters.
- Room codes are generated with the browser's Web Crypto random number generator.

## Important scope

This branch connects to the existing Cloudflare Worker. It does not deploy or modify the production Worker, the main website, or the `main` branch. Complete the two-device multiplayer test and Yandex debug-panel checks before submitting for moderation.
