require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const r1 = await c.query(
    `SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'account_users' AND column_name = 'password_hash'`,
  );
  console.log("password_hash nullable:", r1.rows);

  const r2 = await c.query(`SELECT COUNT(*) AS n FROM public.oauth_accounts`);
  console.log("oauth_accounts count:", r2.rows[0].n);

  try {
    await c.query(`ALTER TABLE public.account_users ALTER COLUMN password_hash DROP NOT NULL`);
    console.log("ALTER OK");
  } catch (e) {
    console.log("ALTER err:", e.message);
  }

  const r4 = await c.query(
    `SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'account_users' AND column_name = 'password_hash'`,
  );
  console.log("after ALTER nullable:", r4.rows);

  const r5 = await c.query(`SELECT * FROM public.oauth_accounts LIMIT 5`);
  console.log("oauth_accounts rows:", JSON.stringify(r5.rows, null, 2));

  await c.end();
})().catch((e) => console.error(e));
