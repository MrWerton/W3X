(() => {
  const DEFAULT_RATE = 1.0;
  const STEP = 0.25;
  const MIN_RATE = 0.25;
  const MAX_RATE = 5.0;
  const EPSILON = 0.0001;
  const OVERLAY_TIMEOUT = 2000;
  const STORAGE_KEYS = {
    rate: "globalRate",
    last: "globalLastNonDefault",
  };

  let lastActiveVideo = null;
  const videoState = new WeakMap();
  let stylesInjected = false;
  let globalRate = DEFAULT_RATE;
  let globalLastNonDefault = null;

  function ensureStyles() {
    if (stylesInjected) return;
    const style = document.createElement("style");
    style.textContent = `
      .speed-video-ui {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 999999;
        display: flex;
        align-items: center;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.65);
        color: #fff;
        font: 12px/1.2 Arial, sans-serif;
        border-radius: 6px;
        pointer-events: none;
        opacity: 0;
        user-select: none;
        max-width: calc(100% - 16px);
        transition: opacity 150ms ease;
      }
      .speed-video-ui.is-visible {
        opacity: 1;
      }
      .speed-video-rate {
        font-weight: 600;
        letter-spacing: 0.2px;
      }
    `;
    document.documentElement.appendChild(style);
    stylesInjected = true;
  }

  function getState(video) {
    let state = videoState.get(video);
    if (!state) {
      state = { ui: null, rateLabel: null, hideTimeout: null, expectedRate: null };
      videoState.set(video, state);
    }
    return state;
  }

  function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (!tag) return false;
    if (target.isContentEditable) return true;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  function isVideoVisible(video) {
    if (!video) return false;
    const rect = video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = getComputedStyle(video);
    if (
      style.visibility === "hidden" ||
      style.display === "none" ||
      style.opacity === "0"
    ) {
      return false;
    }
    const viewWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewHeight =
      window.innerHeight || document.documentElement.clientHeight;
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < viewHeight &&
      rect.left < viewWidth
    );
  }

  function chooseVideo() {
    if (lastActiveVideo && document.contains(lastActiveVideo))
      return lastActiveVideo;
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) return null;

    const visibleVideos = videos.filter(isVideoVisible);
    const candidates = visibleVideos.length ? visibleVideos : videos;

    const playing = candidates.filter((video) => !video.paused && !video.ended);
    if (playing.length === 1) return playing[0];
    if (playing.length > 1) {
      return playing.reduce((best, current) => {
        const bestArea = best.clientWidth * best.clientHeight;
        const currentArea = current.clientWidth * current.clientHeight;
        return currentArea >= bestArea ? current : best;
      });
    }

    return candidates.reduce((best, current) => {
      const bestArea = best.clientWidth * best.clientHeight;
      const currentArea = current.clientWidth * current.clientHeight;
      return currentArea >= bestArea ? current : best;
    });
  }

  function roundToStep(value) {
    return Math.round(value / STEP) * STEP;
  }

  function clampRate(value) {
    return Math.min(MAX_RATE, Math.max(MIN_RATE, value));
  }

  function sanitizeRate(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_RATE;
    return clampRate(num);
  }

  function formatRate(rate) {
    return `${rate.toFixed(2)}x`;
  }

  function ensureUI(video) {
    if (!video) return null;
    ensureStyles();

    const state = getState(video);
    if (state.ui && state.ui.isConnected) return state;

    const parent = video.parentElement;
    if (!parent) return state;

    if (!parent.dataset.speedVideoUiPositioned) {
      const parentStyle = getComputedStyle(parent);
      if (parentStyle.position === "static") {
        parent.style.position = "relative";
      }
      parent.dataset.speedVideoUiPositioned = "true";
    }

    const ui = document.createElement("div");
    ui.className = "speed-video-ui";
    ui.setAttribute("data-speed-video-ui", "");

    const rateLabel = document.createElement("div");
    rateLabel.className = "speed-video-rate";
    rateLabel.textContent = formatRate(globalRate);

    ui.append(rateLabel);
    parent.appendChild(ui);

    state.ui = ui;
    state.rateLabel = rateLabel;
    return state;
  }

  function updateUI(video, rate) {
    const state = ensureUI(video);
    if (!state || !state.rateLabel) return;
    state.rateLabel.textContent = formatRate(rate);
  }

  function showOverlay(video) {
    const state = ensureUI(video);
    if (!state || !state.ui) return;
    state.ui.classList.add("is-visible");
    clearTimeout(state.hideTimeout);
    state.hideTimeout = setTimeout(() => {
      if (state.ui) state.ui.classList.remove("is-visible");
    }, OVERLAY_TIMEOUT);
  }

  function applyRateToVideo(video, rate, options = {}) {
    if (!video) return;
    const { show = false } = options;
    const clamped = clampRate(rate);
    const state = getState(video);
    if (Math.abs(video.playbackRate - clamped) > EPSILON) {
      state.expectedRate = clamped;
      video.playbackRate = clamped;
    }
    if (Math.abs(video.defaultPlaybackRate - clamped) > EPSILON) {
      video.defaultPlaybackRate = clamped;
    }
    updateUI(video, clamped);
    if (show) showOverlay(video);
  }

  function applyRateToAllVideos(rate, options = {}) {
    document
      .querySelectorAll("video")
      .forEach((video) => applyRateToVideo(video, rate, options));
  }

  function setGlobalRate(rate, options = {}) {
    const { persist = true, show = true } = options;
    const clamped = clampRate(rate);
    const prevRate = globalRate;
    globalRate = clamped;

    if (Math.abs(clamped - DEFAULT_RATE) > EPSILON) {
      globalLastNonDefault = clamped;
    } else if (Math.abs(prevRate - DEFAULT_RATE) > EPSILON) {
      globalLastNonDefault = prevRate;
    }

    applyRateToAllVideos(clamped, { show });

    if (persist && chrome?.storage?.local) {
      const payload = { [STORAGE_KEYS.rate]: clamped };
      if (Math.abs(clamped - DEFAULT_RATE) > EPSILON) {
        payload[STORAGE_KEYS.last] = clamped;
      }
      chrome.storage.local.set(payload);
    }
  }

  function nudgeRate(delta) {
    const base = Number.isFinite(globalRate) ? globalRate : DEFAULT_RATE;
    const newRate = roundToStep(base + delta);
    setGlobalRate(newRate);
  }

  function toggleDefaultRate() {
    if (Math.abs(globalRate - DEFAULT_RATE) > EPSILON) {
      setGlobalRate(DEFAULT_RATE);
      return;
    }
    if (
      globalLastNonDefault &&
      Math.abs(globalLastNonDefault - DEFAULT_RATE) > EPSILON
    ) {
      setGlobalRate(globalLastNonDefault);
    }
  }

  function handleKeydown(event) {
    if (event.defaultPrevented) return;
    if (isEditableTarget(event.target)) return;

    const key = event.key.toLowerCase();
    if (key !== "a" && key !== "d" && key !== "s" && key !== "z" && key !== "x")
      return;

    const video = chooseVideo();
    if (!video) return;

    if (key === "d") {
      nudgeRate(STEP);
    } else if (key === "a") {
      nudgeRate(-STEP);
    } else if (key === "s") {
      toggleDefaultRate();
    } else if (key === "z") {
      const target = Math.max(0, (video.currentTime || 0) - 5);
      video.currentTime = target;
    } else if (key === "x") {
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      const next = (video.currentTime || 0) + 5;
      video.currentTime = duration ? Math.min(duration, next) : next;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function bindVideo(video) {
    if (!video || video.__speedVideoBound) return;
    video.__speedVideoBound = true;

    const markActive = () => {
      lastActiveVideo = video;
    };

    ensureUI(video);
    applyRateToVideo(video, globalRate, { show: false });

    video.addEventListener("play", markActive, true);
    video.addEventListener("click", markActive, true);
    video.addEventListener("mouseover", markActive, true);
    video.addEventListener("ratechange", () => {
      const state = getState(video);
      const newRate = sanitizeRate(video.playbackRate);

      if (
        state.expectedRate !== null &&
        Math.abs(newRate - state.expectedRate) <= EPSILON
      ) {
        state.expectedRate = null;
        updateUI(video, newRate);
        return;
      }

      if (Math.abs(newRate - globalRate) > EPSILON) {
        applyRateToVideo(video, globalRate, { show: false });
        return;
      }

      updateUI(video, newRate);
      showOverlay(video);
    });
  }

  function scanVideos() {
    document.querySelectorAll("video").forEach(bindVideo);
  }

  function initStorage() {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get([STORAGE_KEYS.rate, STORAGE_KEYS.last], (data) => {
      const hasRate = Object.prototype.hasOwnProperty.call(
        data,
        STORAGE_KEYS.rate,
      );
      const storedRate = hasRate ? data[STORAGE_KEYS.rate] : DEFAULT_RATE;
      globalRate = sanitizeRate(storedRate);

      const last = Number(data[STORAGE_KEYS.last]);
      globalLastNonDefault = Number.isFinite(last) ? clampRate(last) : null;

      if (!hasRate || storedRate !== globalRate) {
        chrome.storage.local.set({ [STORAGE_KEYS.rate]: globalRate });
      }

      applyRateToAllVideos(globalRate, { show: false });
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[STORAGE_KEYS.rate]) {
        globalRate = sanitizeRate(changes[STORAGE_KEYS.rate].newValue);
        applyRateToAllVideos(globalRate, { show: true });
      }
      if (changes[STORAGE_KEYS.last]) {
        const last = Number(changes[STORAGE_KEYS.last].newValue);
        globalLastNonDefault = Number.isFinite(last) ? clampRate(last) : null;
      }
    });
  }

  function initMessaging() {
    if (!chrome?.runtime?.onMessage) return;
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || !msg.action) return;
      if (msg.action === "getRate") {
        sendResponse({ rate: globalRate });
        return;
      }
      if (msg.action === "setRate") {
        const rate = Number(msg.rate);
        if (!Number.isFinite(rate)) {
          sendResponse({ error: "invalid rate" });
          return;
        }
        setGlobalRate(rate);
        sendResponse({ rate: globalRate });
      }
    });
  }

  const observer = new MutationObserver(() => scanVideos());
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });

  scanVideos();
  initStorage();
  initMessaging();
  window.addEventListener("keydown", handleKeydown, true);
})();
