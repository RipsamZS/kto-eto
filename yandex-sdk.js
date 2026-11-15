/* Yandex Games SDK adapter for "Кто это?".
 * The game remains playable in a normal browser when the SDK is unavailable.
 * SDK documentation: https://yandex.ru/dev/games/doc/ru/sdk/
 */
(function () {
  "use strict";

  let ysdk = null;
  let initPromise = null;
  let gameplayWanted = false;
  let platformPaused = false;
  let adInProgress = false;
  let lastFullscreenAdAt = 0;

  const AD_COOLDOWN_MS = 60_000;

  function getGameplayApi() {
    return ysdk && ysdk.features && ysdk.features.GameplayAPI;
  }

  function syncGameplayState() {
    const gameplay = getGameplayApi();
    if (!gameplay) return;

    try {
      if (gameplayWanted && !platformPaused && !document.hidden && !adInProgress) {
        gameplay.start();
      } else {
        gameplay.stop();
      }
    } catch (error) {
      console.warn("[Yandex Games] GameplayAPI error:", error);
    }
  }

  async function init() {
    if (initPromise) return initPromise;

    initPromise = (async function () {
      if (!window.YaGames || typeof window.YaGames.init !== "function") {
        console.info("[Yandex Games] SDK not found. Standalone mode enabled.");
        return null;
      }

      try {
        ysdk = await window.YaGames.init();

        if (typeof ysdk.on === "function") {
          ysdk.on("game_api_pause", function () {
            platformPaused = true;
            syncGameplayState();
            window.dispatchEvent(new CustomEvent("yandex-game-pause"));
          });

          ysdk.on("game_api_resume", function () {
            platformPaused = false;
            syncGameplayState();
            window.dispatchEvent(new CustomEvent("yandex-game-resume"));
          });
        }

        // The page calls init after the game interface has been rendered.
        if (ysdk.features && ysdk.features.LoadingAPI) {
          ysdk.features.LoadingAPI.ready();
        }

        syncGameplayState();
        console.info("[Yandex Games] SDK initialized.");
        return ysdk;
      } catch (error) {
        console.warn("[Yandex Games] SDK initialization failed. Standalone mode enabled.", error);
        ysdk = null;
        return null;
      }
    })();

    return initPromise;
  }

  function setGameplayActive(active) {
    gameplayWanted = Boolean(active);
    syncGameplayState();
  }

  function showFullscreenAd() {
    if (!ysdk || !ysdk.adv || typeof ysdk.adv.showFullscreenAdv !== "function") {
      return Promise.resolve(false);
    }

    const now = Date.now();
    if (adInProgress || now - lastFullscreenAdAt < AD_COOLDOWN_MS) {
      return Promise.resolve(false);
    }

    lastFullscreenAdAt = now;
    adInProgress = true;
    syncGameplayState();

    return new Promise(function (resolve) {
      let settled = false;

      function finish(wasShown) {
        if (settled) return;
        settled = true;
        adInProgress = false;
        syncGameplayState();
        resolve(Boolean(wasShown));
      }

      try {
        ysdk.adv.showFullscreenAdv({
          callbacks: {
            onOpen: function () {
              adInProgress = true;
              syncGameplayState();
            },
            onClose: function (wasShown) {
              finish(wasShown);
            },
            onError: function (error) {
              console.warn("[Yandex Games] Fullscreen ad error:", error);
              finish(false);
            }
          }
        });
      } catch (error) {
        console.warn("[Yandex Games] Could not show fullscreen ad:", error);
        finish(false);
      }
    });
  }

  function showRewardedVideo(callbacks) {
    callbacks = callbacks || {};

    if (!ysdk || !ysdk.adv || typeof ysdk.adv.showRewardedVideo !== "function") {
      if (typeof callbacks.onUnavailable === "function") callbacks.onUnavailable();
      return Promise.resolve(false);
    }

    adInProgress = true;
    syncGameplayState();

    return new Promise(function (resolve) {
      let settled = false;
      let rewarded = false;

      function finish() {
        if (settled) return;
        settled = true;
        adInProgress = false;
        syncGameplayState();
        resolve(rewarded);
      }

      try {
        ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: function () {
              adInProgress = true;
              syncGameplayState();
              if (typeof callbacks.onOpen === "function") callbacks.onOpen();
            },
            onRewarded: function () {
              rewarded = true;
              if (typeof callbacks.onRewarded === "function") callbacks.onRewarded();
            },
            onClose: function (wasShown) {
              if (typeof callbacks.onClose === "function") callbacks.onClose(Boolean(wasShown));
              finish();
            },
            onError: function (error) {
              console.warn("[Yandex Games] Rewarded video error:", error);
              if (typeof callbacks.onError === "function") callbacks.onError(error);
              finish();
            }
          }
        });
      } catch (error) {
        console.warn("[Yandex Games] Could not show rewarded video:", error);
        if (typeof callbacks.onError === "function") callbacks.onError(error);
        finish();
      }
    });
  }

  async function getPlayer(options) {
    if (!ysdk || typeof ysdk.getPlayer !== "function") return null;
    try {
      return await ysdk.getPlayer(options || { scopes: false });
    } catch (error) {
      console.warn("[Yandex Games] Player is unavailable:", error);
      return null;
    }
  }

  async function loadPlayerData(keys) {
    const player = await getPlayer({ scopes: false });
    if (!player || typeof player.getData !== "function") return {};
    try {
      return await player.getData(keys);
    } catch (error) {
      console.warn("[Yandex Games] Could not load cloud data:", error);
      return {};
    }
  }

  async function savePlayerData(data) {
    const player = await getPlayer({ scopes: false });
    if (!player || typeof player.setData !== "function") return false;
    try {
      await player.setData(data, true);
      return true;
    } catch (error) {
      console.warn("[Yandex Games] Could not save cloud data:", error);
      return false;
    }
  }

  // Also stop gameplay when the browser tab becomes hidden.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      syncGameplayState();
    } else {
      syncGameplayState();
    }
  });

  window.YandexGame = {
    init: init,
    setGameplayActive: setGameplayActive,
    showFullscreenAd: showFullscreenAd,
    showRewardedVideo: showRewardedVideo,
    getPlayer: getPlayer,
    loadPlayerData: loadPlayerData,
    savePlayerData: savePlayerData,
    getSDK: function () { return ysdk; },
    isAvailable: function () { return Boolean(ysdk); }
  };
})();
