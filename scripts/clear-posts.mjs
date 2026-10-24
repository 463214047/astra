import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // 删除所有帖子（保留表结构）
  const del = await pool.query(`DELETE FROM public.posts`);
  console.log(`已删除 ${del.rowCount} 条帖子`);

  // 重置计数（可选）
  await pool.query(`ALTER SEQUENCE IF EXISTS posts_id_seq RESTART WITH 1`);

  // 验证
  const count = await pool.query(`SELECT count(*) FROM public.posts`);
  console.log(`剩余帖子数: ${count.rows[0].count}`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
