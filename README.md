# Кто это? — Yandex Games build

This branch is kept separate from the production site and the original `main` branch.

## Build

Pushes to `yandex-games-sdk` run the GitHub Actions workflow **Build Yandex Games ZIP**. The workflow validates JavaScript syntax and creates the `yandex-games-build.zip` artifact.

The archive contains only:
- `index.html`
- `yandex-sdk.js`

Yandex provides `/sdk.js` when the archive is uploaded; do not add a downloaded copy.

## Scope

The Yandex archive is currently a standalone single-player build. The existing multiplayer client uses Socket.IO and expects a separately hosted Node.js Socket.IO server. That endpoint has not been configured or verified for this build, so the Socket.IO client is intentionally not loaded in the Yandex ZIP. The demo packs and local custom-pack editor remain available.

The original site, `main` branch, and Cloudflare production resources are not modified.

## Manual release checklist

1. Download the `yandex-games-build` artifact from the successful GitHub Actions run.
2. Upload the ZIP as a draft in the Yandex Games developer console.
3. Test SDK initialization, Game Ready, gameplay start/stop, pause/resume, and ad callbacks in the Yandex debug panel.
4. Complete the game's developer-console metadata, age rating, icon, screenshots, and moderation requirements.
