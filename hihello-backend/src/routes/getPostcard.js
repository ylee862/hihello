// powers the recipient's link (GET /api/postcards/:token)

import { getPostcardByToken } from '../db.js';

export async function handleGetPostcard(request, env, token) {
  if (!token || typeof token !== 'string') {
    return json(400, { error: 'A postcard token is required' });
  }

  const postcard = await getPostcardByToken(env, token);
  if (!postcard) {
    return json(404, { error: 'No postcard found for this link' });
  }

  const now = Date.now();
  const isReady = now >= postcard.scheduled_at;

  if (!isReady) {
    return json(200, {
      status: 'sealed',
      arrivesAt: new Date(postcard.scheduled_at).toISOString(),
    });
  }

  return json(200, {
    status: 'ready',
    message: postcard.message,
    postcardDesignId: postcard.postcard_design_id,
    photos: postcard.photos, // ready-to-use data: URLs
  });
}

function json(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
