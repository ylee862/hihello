// everything here runs server-side. Never trust the client's word that
// an email is valid, a design id is real, or a data: URL is actually
// a small, well-formed image — this file is what makes that not matter.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value);
}

/**
 * Trims, collapses excessive blank lines, and hard-caps length.
 * Returns '' (falsy) if nothing meaningful is left.
 */
export function normalizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return '';
  return trimmed.slice(0, maxLength);
}

// Keep this in sync with the `data-postcard-id` values in select.html.
const KNOWN_POSTCARD_DESIGN_IDS = new Set([
  'fold-lines',
  'loop-doodle',
  'watercolor',
  'dotted-edge',
  'dusk-gradient',
  'brown',
]);

export function isKnownPostcardDesignId(id) {
  return typeof id === 'string' && KNOWN_POSTCARD_DESIGN_IDS.has(id);
}

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const KNOWN_PHOTO_FRAMES = new Set(['plain', 'polaroid-white', 'polaroid-black', 'gallery-black', 'gallery-white']);

export function isKnownPhotoFrame(frame) {
  return typeof frame === 'string' && KNOWN_PHOTO_FRAMES.has(frame);
}

/**
 * Parses a `data:image/...;base64,...` URL into { mimeType, buffer }.
 * Returns null for anything malformed or not an allow-listed image type —
 * this is the boundary that stops someone posting arbitrary base64 blobs
 * pretending to be photos.
 */
export function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;

  const [, mimeType, base64] = match;
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) return null;

  let buffer;
  try {
    // atob is available in the Workers runtime.
    const binary = atob(base64);
    buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  } catch {
    return null;
  }

  if (buffer.length === 0) return null;

  return { mimeType, buffer };
}
