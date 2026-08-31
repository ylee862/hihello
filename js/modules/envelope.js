/**
 * reads the token out of
 * the URL, asks the backend whether it's sealed or ready, and renders
 * the matching state. The backend itself withholds the message/photos
 * until the postcard is due, so there's nothing to "hide" here client-
 * side — we're just displaying whatever it gave us.
 */


const API_BASE_URL = 'https://hihello-backend.hi862.workers.dev';

document.addEventListener('DOMContentLoaded', () => {
  const states = {
    loading: document.getElementById('state-loading'),
    notFound: document.getElementById('state-not-found'),
    sealed: document.getElementById('state-sealed'),
    ready: document.getElementById('state-ready'),
    opened: document.getElementById('state-opened'),
  };

  const token = getTokenFromPath();
  if (!token) {
    showState('notFound');
    return;
  }

  fetchPostcard(token);

  async function fetchPostcard(t) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/postcards/${encodeURIComponent(t)}`);
      if (response.status === 404) {
        showState('notFound');
        return;
      }
      if (!response.ok) throw new Error(`Server responded ${response.status}`);

      const data = await response.json();
      if (data.status === 'sealed') {
        showSealed(data.arrivesAt);
      } else if (data.status === 'ready') {
        showReadyThenOpen(data);
      } else {
        showState('notFound');
      }
    } catch {
      showState('notFound');
    }
  }

  function showSealed(arrivesAtIso) {
    const subtext = document.getElementById('sealed-subtext');
    const days = daysUntil(arrivesAtIso);
    subtext.textContent =
      days > 0
        ? `come back in ${days} day${days === 1 ? '' : 's'}.`
        : "it's almost ready — try refreshing in a moment.";
    showState('sealed');
  }

  function showReadyThenOpen(data) {
    showState('ready');
    const openButton = document.getElementById('open-button');
    openButton.addEventListener(
      'click',
      () => {
        renderOpened(data);
        showState('opened');
      },
      { once: true }
    );
  }

  function renderOpened(data) {
    const cardBg = document.getElementById('reveal-card-bg');
    const messageEl = document.getElementById('reveal-message');
    const photosEl = document.getElementById('reveal-photos');

    if (data.postcardDesignId) {
      cardBg.style.backgroundImage = `url('assets/postcards/${designIdToFile(data.postcardDesignId)}')`;
    }
    messageEl.textContent = data.message || '';

    photosEl.innerHTML = '';
    (data.photos || []).forEach((photo, index) => {
      const slot = document.createElement('div');
      slot.className = `photo-slot is-filled photo-slot--${index === 0 ? 'one' : 'two'}`;
      slot.dataset.frame = photo.frame || 'plain';
      const img = document.createElement('img');
      img.src = photo.data;
      img.alt = '';
      slot.appendChild(img);
      photosEl.appendChild(slot);
    });
  }

  function showState(name) {
    Object.entries(states).forEach(([key, el]) => {
      if (el) el.hidden = key !== name;
    });
  }

  function getTokenFromPath() {
    const fromQuery = new URLSearchParams(window.location.search).get('token');
    if (fromQuery) return fromQuery;

    const pathMatch = window.location.pathname.match(/\/e\/([^/]+)\/?$/);
    return pathMatch ? pathMatch[1] : null;
  }

  function daysUntil(isoString) {
    const ms = new Date(isoString).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  function designIdToFile(id) {
    const map = {
      'fold-lines': 'folded_note.png',
      'loop-doodle': 'white_loop.png',
      watercolor: 'sage_watercolor.png',
      'dotted-edge': 'dotted_edge.png',
      'dusk-gradient': 'dusk_gradient.png',
      brown: 'brown_loop.png',
    };
    return map[id] || '';
  }
});
