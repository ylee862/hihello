/**
 * postcard flow: picking a design for the first time opens it large,
 * centered, over a dimmed backdrop — that's where the message gets
 * written. "Done" commits the design + message into the small envelope
 * preview. Once something's committed, clicking a *different* design in
 * the gallery just swaps the art directly (no modal, message untouched);
 * clicking the envelope preview (or re-clicking the design already in
 * use) reopens the editor, pre-filled, to change the message.
 *
 * the user can also drop in up to two of their own photos in a chosen
 * frame style, address the postcard, and "send" it (a front-end-only
 * confirmation — wire up a real endpoint in setUpSendForm() when there's
 * a backend to call).
 */

document.addEventListener('DOMContentLoaded', () => {
  setUpPostcardEditor();
  const photoUpload = setUpPhotoUpload();
  setUpPhotoViewer(photoUpload); 
  setUpSendForm();
});

function applyTextTheme(messageEl, postcardBtn) {
  const theme = postcardBtn?.dataset.textTheme === 'light' ? 'light' : 'dark';
  messageEl.classList.toggle('text-theme-light', theme === 'light');
}

/* ==========================================================================
   Postcard picker + editor modal
   ========================================================================== */

function setUpPostcardEditor() {
  const gallery = document.querySelector('[data-postcard-gallery]');
  const previewCard = document.getElementById('preview-card');
  const previewBg = document.getElementById('card-bg');
  const previewMessage = document.getElementById('message-input');

  const backdrop = document.getElementById('modal-backdrop');
  const modalBg = document.getElementById('modal-card-bg');
  const modalMessage = document.getElementById('modal-message');
  const doneBtn = document.getElementById('modal-done');

  if (!gallery || !previewCard || !backdrop) return;

  const cards = Array.from(gallery.querySelectorAll('[data-postcard-id]'));

  const committed = {
    postcardId: null,
    bgImage: '',
    messageHTML: '',
  };

  let activeTriggerEl = null; 
  let editingTriggerId = null; 

  /* ---- gallery interaction ---- */

  gallery.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-postcard-id]');
  if (!btn) return;

  const isCurrentlyCommitted =
    btn.dataset.postcardId === committed.postcardId;

  window.requestAnimationFrame(() => {
    if (committed.postcardId && !isCurrentlyCommitted) {
      swapDesign(btn);
    } else {
      openEditor(btn);
    }
  });
});


  gallery.addEventListener('keydown', (event) => {
    const focusIndex = cards.indexOf(document.activeElement);
    let nextIndex = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = Math.min(cards.length - 1, Math.max(0, focusIndex) + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = Math.max(0, focusIndex - 1);
    }

    if (nextIndex !== null) {
      event.preventDefault();
      cards[nextIndex].focus();
    }
  });

  function swapDesign(btn) {
    committed.postcardId = btn.dataset.postcardId;
    committed.bgImage = btn.style.backgroundImage;
    previewBg.style.backgroundImage = committed.bgImage;
    applyTextTheme(previewMessage, btn); 

    cards.forEach((el) => {
      el.setAttribute('aria-checked', String(el === btn));
    });
  }

  /* ---- envelope card: reopen editor on the current design ---- */

  previewCard.addEventListener('click', () => {
    if (!previewCard.classList.contains('is-active')) return;
    const activeBtn = cards.find((el) => el.dataset.postcardId === committed.postcardId);
    openEditor(activeBtn || previewCard);
  });

  previewCard.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && previewCard.classList.contains('is-active')) {
      event.preventDefault();
      const activeBtn = cards.find((el) => el.dataset.postcardId === committed.postcardId);
      openEditor(activeBtn || previewCard);
    }
  });

  /* ---- the editor itself ---- */

  function openEditor(triggerEl) {
    activeTriggerEl = triggerEl;
    editingTriggerId = triggerEl.dataset.postcardId || committed.postcardId;

    const bgImage = triggerEl.dataset.postcardId
      ? triggerEl.style.backgroundImage
      : committed.bgImage || previewBg.style.backgroundImage;

    const isEditingCommitted = editingTriggerId === committed.postcardId;

    modalBg.style.backgroundImage = bgImage;
    modalMessage.innerHTML = isEditingCommitted ? committed.messageHTML : '';
    updateEmptyState(modalMessage);

    const editingBtn = cards.find((el) => el.dataset.postcardId === editingTriggerId);
    applyTextTheme(modalMessage, editingBtn); 

    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';

    window.requestAnimationFrame(() => modalMessage.focus());
    document.addEventListener('keydown', onModalKeydown);
    backdrop.addEventListener('click', onBackdropClick);
  }

  function closeEditor() {
    backdrop.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onModalKeydown);
    backdrop.removeEventListener('click', onBackdropClick);
    if (activeTriggerEl) activeTriggerEl.focus();
  }

  function onBackdropClick(event) {
    if (event.target === backdrop) closeEditor();
  }

  function onModalKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeEditor();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const other = document.activeElement === modalMessage ? doneBtn : modalMessage;
      other.focus();
    }
  }

  doneBtn.addEventListener('click', () => {
    const activeBtn = cards.find((el) => el.dataset.postcardId === editingTriggerId);
    if (activeBtn) {
      committed.postcardId = activeBtn.dataset.postcardId;
      committed.bgImage = activeBtn.style.backgroundImage;
    }
    committed.messageHTML = modalMessage.innerHTML;

    previewBg.style.backgroundImage = committed.bgImage;
    previewMessage.innerHTML = committed.messageHTML;
    updateEmptyState(previewMessage);
    applyTextTheme(previewMessage, activeBtn); 
    previewCard.classList.add('is-active');
    previewCard.setAttribute('tabindex', '0');

    cards.forEach((el) => {
      el.setAttribute('aria-checked', String(el.dataset.postcardId === committed.postcardId));
    });

    closeEditor();
  });

  modalMessage.addEventListener('input', () => updateEmptyState(modalMessage));

  function updateEmptyState(el) {
    const isEmpty = el.textContent.trim().length === 0;
    el.setAttribute('data-empty', String(isEmpty));
  }
}

/* ==========================================================================
   Photo upload — up to 2 photos, each with a chosen frame style
   ========================================================================== */

function setUpPhotoUpload() {
  const frameButtons = Array.from(document.querySelectorAll('.frame-slot'));
  const fileInput = document.getElementById('photo-input');
  const hint = document.getElementById('picker-hint');
  const slots = [
    document.getElementById('photo-slot-1'),
    document.getElementById('photo-slot-2'),
  ];
  if (!fileInput || frameButtons.length === 0) return { slots, frameButtons, updateLimitState: () => {} };

  let pendingFrame = null;

  frameButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextSlot = slots.find((slot) => !slot.classList.contains('is-filled'));
      if (!nextSlot) {
        hint.textContent = 'That\u2019s the max — remove one to add another.';
        hint.classList.add('is-limit');
        return;
      }
      pendingFrame = btn.dataset.frame;
      fileInput.value = '';
      fileInput.click();
    });
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file || !pendingFrame) return;

    const nextSlot = slots.find((slot) => !slot.classList.contains('is-filled'));
    if (!nextSlot) return;

    hint.textContent = '\u2022 resizing photo\u2026';

    compressImage(file, { maxDimension: 1400, maxBytes: 400_000 })
      .then((dataUrl) => {
        const img = nextSlot.querySelector('img');
        img.src = dataUrl;
        nextSlot.dataset.frame = pendingFrame;
        nextSlot.classList.add('is-filled');
        nextSlot.disabled = false; 
        updateLimitState();
      })
      .catch(() => {
        hint.textContent = '\u2022 that photo couldn\u2019t be processed — try a different one';
        hint.classList.add('is-limit');
      });
  });

  function updateLimitState() {
    const filledCount = slots.filter((slot) => slot.classList.contains('is-filled')).length;
    const atLimit = filledCount >= slots.length;
    frameButtons.forEach((btn) => btn.classList.toggle('is-disabled', atLimit));
    hint.textContent = atLimit
      ? '• maximum of 2 pictures added'
      : '• you can only add maximum of 2 pictures';
    hint.classList.toggle('is-limit', atLimit);
  }

  return { slots, frameButtons, updateLimitState };
}

function compressImage(file, { maxDimension, maxBytes }) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const qualitySteps = [0.85, 0.7, 0.55, 0.4, 0.25];
      let result = null;

      for (const quality of qualitySteps) {
        const candidate = canvas.toDataURL('image/jpeg', quality);
        if (base64ByteLength(candidate) <= maxBytes) {
          result = candidate;
          break;
        }
        result = candidate; // keep the smallest attempt even if it never hits target
      }

      if (!result) {
        reject(new Error('Could not compress image'));
        return;
      }
      resolve(result);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image'));
    };

    img.src = objectUrl;
  });
}

function base64ByteLength(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4);
}

function setUpPhotoViewer(photoUpload) {
  const backdrop = document.getElementById('photo-viewer-backdrop');
  const viewerImage = document.getElementById('photo-viewer-image');
  const actions = document.getElementById('photo-viewer-actions');
  const confirmPanel = document.getElementById('photo-viewer-confirm');
  const backBtn = document.getElementById('photo-viewer-back');
  const removeBtn = document.getElementById('photo-viewer-remove');
  const cancelBtn = document.getElementById('photo-viewer-cancel');
  const confirmRemoveBtn = document.getElementById('photo-viewer-confirm-remove');
  if (!backdrop || !photoUpload) return;

  const { slots, updateLimitState } = photoUpload;
  let currentSlot = null;

  slots.forEach((slot) => {
    slot.addEventListener('click', () => {
      if (!slot.classList.contains('is-filled')) return;
      openViewer(slot);
    });
  });

  function openViewer(slot) {
    currentSlot = slot;
    viewerImage.src = slot.querySelector('img').src;
    showActions(); 

    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => backBtn.focus());
    document.addEventListener('keydown', onKeydown);
    backdrop.addEventListener('click', onBackdropClick);
  }

  function closeViewer() {
    backdrop.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    backdrop.removeEventListener('click', onBackdropClick);
    if (currentSlot) currentSlot.focus();
    currentSlot = null;
  }

  function showActions() {
    actions.hidden = false;
    confirmPanel.hidden = true;
  }

  function showConfirm() {
    actions.hidden = true;
    confirmPanel.hidden = false;
    window.requestAnimationFrame(() => confirmRemoveBtn.focus());
  }

  function onBackdropClick(event) {
    if (event.target === backdrop) closeViewer();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeViewer();
    }
  }

  backBtn.addEventListener('click', closeViewer);

  removeBtn.addEventListener('click', showConfirm);
  cancelBtn.addEventListener('click', showActions);

  confirmRemoveBtn.addEventListener('click', () => {
    if (!currentSlot) return;
    const img = currentSlot.querySelector('img');
    img.src = '';
    currentSlot.classList.remove('is-filled');
    currentSlot.dataset.frame = 'plain';
    currentSlot.disabled = true;
    updateLimitState();
    closeViewer();
  });
}

/* ==========================================================================
   Send form
   ========================================================================== */

const API_BASE_URL = 'https://hihello-backend.hi862.workers.dev';

function setUpSendForm() {
  const form = document.getElementById('send-form');
  const note = document.getElementById('send-note');
  const messageInput = document.getElementById('message-input');
  const sendButton = form?.querySelector('.send-button');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const hasMessage = messageInput && messageInput.textContent.trim().length > 0;
    const hasPostcard = document.getElementById('preview-card').classList.contains('is-active');

    const problems = [];
    if (!hasPostcard) problems.push('pick a postcard');
    if (!hasMessage) problems.push('write a short message');

    if (problems.length > 0) {
      note.textContent = `Just need you to ${problems.join(', ')}.`;
      note.classList.add('is-visible');
      return;
    }

    note.classList.remove('is-visible');
    setSubmitting(true);

    try {
      const payload = buildSubmissionPayload({ messageInput });
      const response = await fetch(`${API_BASE_URL}/api/postcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.problems?.join(', ') || errorBody.error || `Server responded ${response.status}`);
      }

      const data = await response.json();
      sessionStorage.setItem(
        'hihello:lastSealed',
        JSON.stringify({ shareUrl: data.shareUrl, arrivesFor: data.arrivesFor })
      );
      window.location.href = 'sent.html';
    } catch (err) {
      note.textContent = `That didn't go through — ${err.message}. Please try again.`;
      note.classList.add('is-visible');
      setSubmitting(false);
    }
  });

  function setSubmitting(isSubmitting) {
    if (!sendButton) return;
    sendButton.disabled = isSubmitting;
    sendButton.style.opacity = isSubmitting ? '0.6' : '';
  }
}

function buildSubmissionPayload({ messageInput }) {
  const checkedPostcard = document.querySelector('[data-postcard-gallery] [aria-checked="true"]');
  const photos = [document.getElementById('photo-slot-1'), document.getElementById('photo-slot-2')]
    .filter((slot) => slot && slot.classList.contains('is-filled'))
    .map((slot) => ({ data: slot.querySelector('img').src, frame: slot.dataset.frame || 'plain' }))
    .filter((photo) => photo.data.startsWith('data:'));

  return {
    message: messageInput.textContent.trim(),
    postcardDesignId: checkedPostcard?.dataset.postcardId ?? null,
    photos,
  };
}
