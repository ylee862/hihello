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

  /**
   * Fix: "Save as PDF" — one PDF of the whole scene as displayed, plus
   * one for the postcard/message alone, plus one per photo. Runs
   * entirely client-side via html2canvas (DOM \u2192 image) + jsPDF
   * (image \u2192 PDF page); nothing touches the backend.
   */
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

        const jobs = [
          { el: document.getElementById('reveal-scene'), filename: 'hihello-envelope.pdf' },
          { el: document.getElementById('reveal-card'), filename: 'hihello-postcard.pdf' },
        ];
        document.querySelectorAll('#reveal-photos .photo-slot').forEach((slot, i) => {
          jobs.push({ el: slot, filename: `hihello-photo-${i + 1}.pdf` });
        });

        // Fix: sequential, not Promise.all — firing several downloads at
        // once in the same tick makes some browsers block all but the
        // first as a suspected pop-up flood. One at a time, each fully
        // finishing before the next starts, avoids that.
        for (const job of jobs) {
          await saveElementAsPdf(job.el, job.filename);
        }

        label.textContent = 'Saved!';
        window.setTimeout(() => {
          label.textContent = originalLabel;
        }, 1800);
      } catch (err) {
        label.textContent = "Something went wrong \u2014 try again";
        console.error('PDF export failed:', err);
      } finally {
        button.disabled = false;
      }
    };
  }

  async function saveElementAsPdf(element, filename) {
    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale: 2, // sharper output than the on-screen resolution
      useCORS: true,
    });
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
