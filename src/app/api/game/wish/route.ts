import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";

type WishSave = {
  magic: number;
  pity5: number;
  pity4: number;
  total: number;
  tohru: number;
  history: unknown[];
  rainbowIds: unknown[];
};

const DEFAULT_SAVE: WishSave = {
  magic: 16000,
  pity5: 0,
  pity4: 0,
  total: 0,
  tohru: 0,
  history: [],
  rainbowIds: [],
};

let schemaEnsured = false;

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }

  if (!schemaEnsured) {
    await ensureSchema();
    schemaEnsured = true;
  }

  // 魔力/保底/累计 — 直接从 account_users 读（稳，跟账号绑定）
  const users = await query<{
    wish_magic: number;
    wish_pity5: number;
    wish_pity4: number;
    wish_total: number;
    wish_tohru: number;
  }>(
    `SELECT wish_magic, wish_pity5, wish_pity4, wish_total, wish_tohru
     FROM public.account_users WHERE email = $1`,
    [email],
  );

  let magic = DEFAULT_SAVE.magic;
  let pity5 = DEFAULT_SAVE.pity5;
  let pity4 = DEFAULT_SAVE.pity4;
  let total = DEFAULT_SAVE.total;
  let tohru = DEFAULT_SAVE.tohru;

  if (users.length > 0) {
    const u = users[0];
    magic = Number(u.wish_magic) || DEFAULT_SAVE.magic;
    pity5 = Number(u.wish_pity5) || 0;
    pity4 = Number(u.wish_pity4) || 0;
    total = Number(u.wish_total) || 0;
    tohru = Number(u.wish_tohru) || 0;
  }

  // history / rainbow_ids — 继续从 game_wish_save 读（兼容旧数据）
  const rows = await query<{ history: unknown; rainbow_ids: unknown }>(
    `SELECT history, rainbow_ids FROM public.game_wish_save WHERE user_email = $1`,
    [email],
  );

  let history: unknown[] = [];
  let rainbowIds: unknown[] = [];
  if (rows.length > 0) {
    history = Array.isArray(rows[0].history) ? rows[0].history : [];
    rainbowIds = Array.isArray(rows[0].rainbow_ids) ? rows[0].rainbow_ids : [];
  }

  return NextResponse.json({
    ok: true,
    save: { magic, pity5, pity4, total, tohru, history, rainbowIds },
  });
}

export async function PUT(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }

  if (!schemaEnsured) {
    await ensureSchema();
    schemaEnsured = true;
  }

  let body: Partial<WishSave>;
  try {
    body = (await req.json()) as Partial<WishSave>;
  } catch {
    return NextResponse.json({ ok: false, message: "无效 JSON" }, { status: 400 });
  }

  const magic = typeof body.magic === "number" ? body.magic : DEFAULT_SAVE.magic;
  const pity5 = typeof body.pity5 === "number" ? body.pity5 : DEFAULT_SAVE.pity5;
  const pity4 = typeof body.pity4 === "number" ? body.pity4 : DEFAULT_SAVE.pity4;
  const total = typeof body.total === "number" ? body.total : DEFAULT_SAVE.total;
  const history = Array.isArray(body.history) ? body.history : [];
  const rainbowIds = Array.isArray(body.rainbowIds) ? body.rainbowIds : [];
  const tohru =
    typeof body.tohru === "number" && Number.isFinite(body.tohru)
      ? Math.max(0, Math.floor(body.tohru))
      : DEFAULT_SAVE.tohru;

  // 魔力/保底/累计/托尔 — 写 account_users
  await query(
    `UPDATE public.account_users
     SET wish_magic = $2, wish_pity5 = $3, wish_pity4 = $4, wish_total = $5, wish_tohru = $6
     WHERE email = $1`,
    [email, magic, pity5, pity4, total, tohru],
  );

  // history / rainbow_ids — 写 game_wish_save
  await query(
    `INSERT INTO public.game_wish_save (user_email, history, rainbow_ids, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, NOW())
     ON CONFLICT (user_email) DO UPDATE SET
       history = EXCLUDED.history,
       rainbow_ids = EXCLUDED.rainbow_ids,
       updated_at = NOW()`,
    [email, JSON.stringify(history), JSON.stringify(rainbowIds)],
  );

  return NextResponse.json({ ok: true });
}
