const DEFAULT_RATE = 1.0;
const STORAGE_KEYS = {
  rate: "globalRate",
};

function formatBadge(rate) {
  let text = Number(rate)
    .toFixed(2)
    .replace(/\.?0+$/g, "");
  if (text.length <= 3) text = `${text}x`;
  if (text.length > 4) text = text.slice(0, 4);
  return text;
}

function updateBadge(rate) {
  try {
    chrome.action.setBadgeBackgroundColor({ color: "#000000" });
    chrome.action.setBadgeText({ text: formatBadge(rate) });
  } catch (e) {
    console.error("Failed to update badge:", e);
  }
}

function sanitizeRate(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : DEFAULT_RATE;
}

function ensureStoredRate() {
  chrome.storage.local.get([STORAGE_KEYS.rate], (data) => {
    if (!Object.prototype.hasOwnProperty.call(data, STORAGE_KEYS.rate)) {
      chrome.storage.local.set({ [STORAGE_KEYS.rate]: DEFAULT_RATE });
      return;
    }
    const rate = sanitizeRate(data[STORAGE_KEYS.rate]);
    if (rate !== data[STORAGE_KEYS.rate]) {
      chrome.storage.local.set({ [STORAGE_KEYS.rate]: rate });
    }
  });
}

function initBadge() {
  chrome.storage.local.get({ [STORAGE_KEYS.rate]: DEFAULT_RATE }, (data) => {
    const rate = sanitizeRate(data[STORAGE_KEYS.rate]);
    updateBadge(rate);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension W3X installed");
  ensureStoredRate();
  initBadge();
});

chrome.runtime.onStartup?.addListener(() => {
  ensureStoredRate();
  initBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEYS.rate]) {
    const next = changes[STORAGE_KEYS.rate].newValue;
    const rate = Number.isFinite(next) ? next : DEFAULT_RATE;
    updateBadge(rate);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "updateBadge" && typeof msg.rate === "number") {
    updateBadge(msg.rate);
  }
});
