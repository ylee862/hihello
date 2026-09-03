/**
 * hi-hello — envelope.js
 * Drives envelope.html — the recipient's link. Reads the token out of
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

    setUpClickToEnlarge();
    setUpSavePdf(data);
  }

  function setUpClickToEnlarge() {
    const backdrop = document.getElementById('reveal-lightbox-backdrop');
    const content = document.getElementById('reveal-lightbox-content');
    const closeBtn = document.getElementById('reveal-lightbox-close');

    const openWith = (sourceEl) => {
      content.innerHTML = '';
      content.appendChild(sourceEl.cloneNode(true));
      backdrop.hidden = false;
    };
    const close = () => {
      backdrop.hidden = true;
      content.innerHTML = '';
    };

    document.getElementById('reveal-card').addEventListener('click', () => {
      openWith(document.getElementById('reveal-card'));
    });
    document.querySelectorAll('#reveal-photos .photo-slot').forEach((slot) => {
      slot.addEventListener('click', () => {
        const img = document.createElement('img');
        img.src = slot.querySelector('img').src;
        img.alt = '';
        content.innerHTML = '';
        content.appendChild(img);
        backdrop.hidden = false;
      });
    });

    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
  }

  function setUpSavePdf(data) {
    const button = document.getElementById('save-pdf-button');
    const label = document.getElementById('save-pdf-label');

    button.onclick = async () => {
      if (typeof html2canvas === 'undefined' || !window.jspdf) {
        label.textContent = "Couldn't load PDF tools \u2014 check your connection";
        return;
      }

      button.disabled = true;
      const originalLabel = label.textContent;

      try {
        label.textContent = 'Preparing PDFs\u2026';

        await saveCardAsPdf('hihello-postcard.pdf');

        const photoImgs = Array.from(document.querySelectorAll('#reveal-photos .photo-slot img'));
        for (let i = 0; i < photoImgs.length; i++) {
          await pause(600);
          await savePhotoAsPdf(photoImgs[i].src, `hihello-photo-${i + 1}.pdf`);
        }

        label.textContent = 'Saved!';
        window.setTimeout(() => {
          label.textContent = originalLabel;
        }, 1800);
      } catch (err) {
        label.textContent = 'Something went wrong \u2014 try again';
        console.error('PDF export failed:', err);
      } finally {
        button.disabled = false;
      }
    };
  }
  async function saveDomAsPdf(element, filename, backgroundColor = null) {
    const canvas = await html2canvas(element, { backgroundColor, scale: 2, useCORS: true });
    addCanvasToPdf(canvas, filename);
  }

  async function saveCardAsPdf(filename) {
    const originalCard = document.getElementById('reveal-card');
    const originalBg = document.getElementById('reveal-card-bg');

    const cardWidthPx = 900;
    const cardHeightPx = Math.round((cardWidthPx * 76.19) / 60);

    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.zIndex = '-9999';
    wrapper.style.pointerEvents = 'none';

    const clone = originalCard.cloneNode(true);
    clone.removeAttribute('id');
    Object.assign(clone.style, {
      position: 'static',
      width: `${cardWidthPx}px`,
      height: `${cardHeightPx}px`,
      aspectRatio: 'auto',
      transform: 'none',
      opacity: '1',
      animation: 'none',
      boxShadow: 'none',
    });

    const messageEl = clone.querySelector('.message-input');
    if (messageEl) {
      messageEl.style.fontSize = '46px';
      messageEl.style.lineHeight = '1.5';
    }

    const cloneBg = clone.querySelector('.card-bg');
    if (cloneBg) cloneBg.removeAttribute('id');

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    const bgImage = originalBg && originalBg.style.backgroundImage;
    if (bgImage && bgImage !== 'none') {
      const url = bgImage.slice(5, -2);
      await loadImage(url).catch(() => {});
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const canvas = await html2canvas(clone, {
      backgroundColor: null,
      scale: 3,
      useCORS: true,
      logging: false,
      width: cardWidthPx,
      height: cardHeightPx,
      windowWidth: cardWidthPx,
      windowHeight: cardHeightPx,
    });
    document.body.removeChild(wrapper);
    addCanvasToPdf(canvas, filename);
  }

  async function savePhotoAsPdf(dataUrl, filename) {
    const img = await loadImage(dataUrl);
    const { jsPDF } = window.jspdf;
    const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    const pdf = new jsPDF({
      orientation: img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait',
      unit: 'px',
      format: [img.naturalWidth, img.naturalHeight],
    });
    pdf.addImage(dataUrl, format, 0, 0, img.naturalWidth, img.naturalHeight);
    pdf.save(filename);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function pause(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function addCanvasToPdf(canvas, filename) {
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(filename);
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
