const { Pool } = require("pg");

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    const r = await pool.query(
      `SELECT c.id, c.user_a_email, c.user_b_email, cr.user_email AS reader, cr.last_read_at,
              (SELECT COUNT(*) FROM public.messages m
                WHERE m.conversation_id = c.id
                  AND m.sender_email <> '463214047@qq.com'
                  AND (cr.last_read_at IS NULL OR m.created_at > cr.last_read_at)) AS unread_for_a
         FROM public.conversations c
         LEFT JOIN public.conversation_reads cr ON cr.conversation_id = c.id
        ORDER BY c.last_message_at DESC`,
    );
    console.log(JSON.stringify(r.rows, null, 2));
  } catch (err) {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
