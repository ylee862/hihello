// the token doubles as the recipient's link (`/view.html?token=...`), so it
// needs to be unguessable — crypto.randomUUID() alone is fine (122 bits of
// randomness), but we strip the dashes to keep the URL a little shorter.

export function generateToken() {
  return crypto.randomUUID().replace(/-/g, '');
}
