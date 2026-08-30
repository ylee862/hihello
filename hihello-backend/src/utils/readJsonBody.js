// enforces maxBytes *before* parsing, so a huge payload (someone stuffing
// oversized "photos" into the request) can't make us buffer/parse an
// arbitrarily large string first.

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function readJsonBody(request, maxBytes) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new HttpError(413, `Request body exceeds ${maxBytes} byte limit`);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Request body is required');

  const chunks = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      throw new HttpError(413, `Request body exceeds ${maxBytes} byte limit`);
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const text = new TextDecoder().decode(combined);
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON');
  }
}
