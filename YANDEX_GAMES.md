# Yandex Games build

This branch contains the standalone HTML5 build of Кто это? prepared for Yandex Games.

## SDK integration
- Loads the official platform loader using the relative /sdk.js path required for games uploaded to Yandex Games.
- Initializes the SDK with YaGames.init().
- Calls LoadingAPI.ready() after the interactive game UI is available.
- Marks gameplay start/stop when entering or leaving the game screen.
- Handles game_api_pause and game_api_resume.
- Requests an interstitial ad only when the player exits an active game session. The game remains playable if the SDK or an ad is unavailable.

## Upload
Create a ZIP from the contents of this branch so that index.html is at the archive root. Do not ZIP the containing folder itself.

## Test
Upload the archive as a draft in the Yandex Games developer console, open it with the debug panel, and verify the loader indicator is IT, Game Ready turns green when the menu is interactive, Gameplay turns green in the game and red in the menu, and pause/resume works when switching tabs or showing platform UI.

The original main branch is unchanged.
