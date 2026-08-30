// entry point.

import { handleCreatePostcard } from './routes/createPostcard.js';
import { handleGetPostcard } from './routes/getPostcard.js';

// Fix: lock this down to your real frontend origin once it's deployed —
// '*' is fine for local development only.
const ALLOWED_ORIGIN = '*';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }));
    }

    try {
      if (request.method === 'POST' && url.pathname === '/api/postcards') {
        return withCors(await handleCreatePostcard(request, env));
      }

      const postcardMatch = url.pathname.match(/^\/api\/postcards\/([^/]+)$/);
      if (request.method === 'GET' && postcardMatch) {
        return withCors(await handleGetPostcard(request, env, postcardMatch[1]));
      }

      return withCors(new Response('Not found', { status: 404 }));
    } catch (err) {
      console.error('Unhandled error:', err);
      return withCors(
        new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
  },
};

function withCors(response) {
  response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
