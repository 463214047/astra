// 临时脚本：创建独立的 account_users 表（避免与 Supabase auth.users 冲突）
import { Client } from "pg";
import * as fs from "node:fs";

// 手动解析 .env.local
const envText = fs.readFileSync(".env.local", "utf-8");
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  val = val.replace(/^["']|["']$/g, "");
  if (!(key in process.env)) process.env[key] = val;
}

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await c.connect();
    console.log("✅ 已连接数据库");

    // 检查 account_users 是否存在
    const check = await c.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_users')`,
    );

    if (check.rows[0].exists) {
      console.log("account_users 表已存在");
    } else {
      await c.query(`
        CREATE TABLE public.account_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT NOT NULL UNIQUE,
          name TEXT,
          password_hash TEXT NOT NULL,
          totp_secret TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS account_users_email_idx ON public.account_users (email);
      `);
      console.log("✅ account_users 表创建成功");
    }

    // 查看结果
    const cols = await c.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_users' ORDER BY ordinal_position`,
    );
    console.log("\naccount_users 表结构:");
    cols.rows.forEach((r) => console.log(`  ${r.column_name} (${r.data_type})`));
  } catch (err) {
    console.error("❌ 错误:", err.message);
  } finally {
    await c.end();
  }
}

main();
