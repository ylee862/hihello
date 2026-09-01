// entry point.

import { handleCreatePostcard } from './routes/createPostcard.js';
import { handleGetPostcard } from './routes/getPostcard.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const allowedOrigin = env.SITE_URL || '*';

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), allowedOrigin);
    }

    try {
          if (request.method === 'POST' && url.pathname === '/api/postcards') {
            const limited = await checkRateLimit(env.CREATE_LIMITER, request);
            if (limited) return withCors(limited, allowedOrigin);
            return withCors(await handleCreatePostcard(request, env), allowedOrigin);
          }
    
          const postcardMatch = url.pathname.match(/^\/api\/postcards\/([^/]+)$/);
          if (request.method === 'GET' && postcardMatch) {
            const limited = await checkRateLimit(env.READ_LIMITER, request);
            if (limited) return withCors(limited, allowedOrigin);
            return withCors(await handleGetPostcard(request, env, postcardMatch[1]), allowedOrigin);
          }
    
          return withCors(new Response('Not found', { status: 404 }), allowedOrigin);
        } catch (err) {
          console.error('Unhandled error:', err);
          return withCors(
            new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
            allowedOrigin
          );
        }
      },
    };

async function checkRateLimit(limiter, request) {
  if (!limiter) return null; // fail open if the binding is somehow missing, rather than break the whole API
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const { success } = await limiter.limit({ key: ip });
  if (success) return null;

  return new Response(JSON.stringify({ error: 'Too many requests — please slow down and try again shortly.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  });
}

function withCors(response, origin) {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
