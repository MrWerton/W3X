const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
const DEFAULT_RATE = 1.0;
const EPSILON = 0.0001;
const STORAGE_KEYS = {
  rate: 'globalRate',
  last: 'globalLastNonDefault',
};

function formatRate(rate) {
  return (
    Number(rate)
      .toFixed(2)
      .replace(/\.?0+$/g, '') + 'x'
  );
}

function sanitizeRate(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : DEFAULT_RATE;
}

function highlight(rate) {
  document
    .querySelectorAll('.btn')
    .forEach((b) => b.classList.toggle('selected', Number(b.dataset.rate) === rate));
}

function updateCurrent(rate) {
  const el = document.getElementById('current');
  el.textContent = rate === null || rate === undefined ? '—' : formatRate(rate);
}

function setGlobalRate(rate) {
  const payload = { [STORAGE_KEYS.rate]: rate };
  if (Math.abs(rate - DEFAULT_RATE) > EPSILON) {
    payload[STORAGE_KEYS.last] = rate;
  }
  chrome.storage.local.set(payload);
}

function renderGrid(currentRate) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  SPEEDS.forEach((rate) => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = formatRate(rate);
    btn.dataset.rate = rate;
    if (currentRate !== null && Math.abs(currentRate - rate) < EPSILON) {
      btn.classList.add('selected');
    }
    btn.addEventListener('click', () => {
      setGlobalRate(rate);
      updateCurrent(rate);
      highlight(rate);
    });
    grid.appendChild(btn);
  });
}

function init() {
  const start = () => {
    chrome.storage.local.get({ [STORAGE_KEYS.rate]: DEFAULT_RATE }, (data) => {
      const rate = sanitizeRate(data[STORAGE_KEYS.rate]);
      updateCurrent(rate);
      renderGrid(rate);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[STORAGE_KEYS.rate]) {
        const rate = sanitizeRate(changes[STORAGE_KEYS.rate].newValue);
        updateCurrent(rate);
        highlight(rate);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}

init();
