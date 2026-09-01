// thin D1 access layer

export async function insertPostcard(env, postcard) {
  await env.DB.prepare(
    `INSERT INTO postcards
       (token, message, postcard_design_id, photos, created_at, scheduled_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      postcard.token,
      postcard.message,
      postcard.postcardDesignId,
      JSON.stringify(postcard.photos),
      postcard.createdAt,
      postcard.scheduledAt
    )
    .run();
}

export async function getPostcardByToken(env, token) {
  const row = await env.DB.prepare(`SELECT * FROM postcards WHERE token = ?`).bind(token).first();
  return row ? { ...row, photos: JSON.parse(row.photos || '[]') } : null;
}
