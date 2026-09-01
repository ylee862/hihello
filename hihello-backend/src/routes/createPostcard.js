// stores the postcard and hands back a link the sender shares themselves

import { readJsonBody } from '../utils/readJsonBody.js';
import { generateToken } from '../utils/token.js';
import { insertPostcard } from '../db.js';
import {
  normalizeText,
  isKnownPostcardDesignId,
  isKnownPhotoFrame,
  parseImageDataUrl,
} from '../security/sanitize.js';

export async function handleCreatePostcard(request, env) {
  const maxRequestBytes = Number(env.MAX_REQUEST_BYTES);
  const maxPhotoBytes = Number(env.MAX_PHOTO_BYTES);
  const maxPhotosPerPostcard = Number(env.MAX_PHOTOS_PER_POSTCARD);
  const messageMaxLength = Number(env.MESSAGE_MAX_LENGTH);
  const sendDelayMs = Number(env.SEND_DELAY_MS);

  let body;
  try {
    body = await readJsonBody(request, maxRequestBytes);
  } catch (err) {
    return json(err.statusCode ?? 400, { error: err.message });
  }

  const message = normalizeText(body.message, messageMaxLength);
  const postcardDesignId = body.postcardDesignId ?? null;
  const photoEntries = Array.isArray(body.photos) ? body.photos.slice(0, maxPhotosPerPostcard) : [];

  const problems = [];
  if (!message) problems.push('message is required');

  const hasDesign = postcardDesignId !== null;
  const hasPhotos = photoEntries.length > 0;
  if (!hasDesign && !hasPhotos) problems.push('either postcardDesignId or at least one photo is required');
  if (hasDesign && !isKnownPostcardDesignId(postcardDesignId)) problems.push('postcardDesignId is not recognized');

  // Photos are decoded
  const validPhotos = [];
  for (const entry of photoEntries) {
    const dataUrl = entry && typeof entry === 'object' ? entry.data : entry;
    const frame = isKnownPhotoFrame(entry?.frame) ? entry.frame : 'plain';

    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed) {
      problems.push('one of the uploaded photos is not a supported image (png/jpeg/webp/gif) or is malformed');
      continue;
    }
    if (parsed.buffer.length > maxPhotoBytes) {
      problems.push(`one of the uploaded photos exceeds the ${Math.round(maxPhotoBytes / 1024)}KB limit`);
      continue;
    }
    validPhotos.push({ data: dataUrl, frame });
  }

  if (problems.length > 0) {
    return json(422, { error: 'Validation failed', problems });
  }

  const token = generateToken();
  const now = Date.now();
  const scheduledAt = now + sendDelayMs;

  await insertPostcard(env, {
    token,
    message,
    postcardDesignId,
    photos: validPhotos,
    createdAt: now,
    scheduledAt,
  });

  return json(201, {
    ok: true,
    token,
    shareUrl: `${env.SITE_URL}/envelope.html?token=${token}`,
    arrivesFor: new Date(scheduledAt).toISOString(),
  });
}

function json(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
