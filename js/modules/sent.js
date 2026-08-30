/**
 * reads the just-created postcard's link from
 * sessionStorage (set by compose.js right after a successful send),
 * shows it, and handles the copy-to-clipboard interaction.
 */

document.addEventListener('DOMContentLoaded', () => {
  const hint = document.getElementById('share-link-hint');
  const input = document.getElementById('share-link-input');
  const copyButton = document.getElementById('copy-link-button');
  const copyLabel = document.getElementById('copy-link-label');
  if (!input || !copyButton) return;

  const raw = sessionStorage.getItem('hihello:lastSealed');
  let sealed = null;
  try {
    sealed = raw ? JSON.parse(raw) : null;
  } catch {
    sealed = null;
  }

  if (!sealed || !sealed.shareUrl) {
    window.location.href = 'select.html';
    return;
  }

  input.value = sealed.shareUrl;

  if (sealed.arrivesFor) {
    const days = daysUntil(sealed.arrivesFor);
    hint.textContent = days > 0 ? `it'll open for them in ${days} day${days === 1 ? '' : 's'}` : "it's ready to open now";
  }

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(sealed.shareUrl);
    } catch {
      input.select();
      document.execCommand('copy');
    }
    showCopied();
  });

  function showCopied() {
    copyButton.classList.add('is-copied');
    copyLabel.textContent = 'Copied!';
    window.setTimeout(() => {
      copyButton.classList.remove('is-copied');
      copyLabel.textContent = 'Copy Link';
    }, 1800);
  }

  function daysUntil(isoString) {
    const ms = new Date(isoString).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }
});
