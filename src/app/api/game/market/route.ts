import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, withTransaction, ensureSchema } from "@/lib/db";

type ItemType = "tohru" | "rainbow";
type RainbowItem = { days: number; ts: number };

type Mine = {
  magic: number;
  tohru: number;
  rainbowIds: RainbowItem[];
  /** 彩虹ID 总天数（背包内合并显示用） */
  rainbowDays: number;
};

type UnitPrices = {
  /** 玩家从系统买入的单格价格 */
  buy: number;
  /** 系统收购（玩家卖出）的单格价格 */
  sell: number;
};
type Prices = Record<ItemType, UnitPrices>;

type LegacyListing = {
  id: string;
  seller_email: string;
  item_type: ItemType;
  item_days: number | null;
  earned: number | null;
  paid: number | null;
};

let schemaEnsured = false;

async function ensure() {
  if (!schemaEnsured) {
    await ensureSchema();
    schemaEnsured = true;
  }
}

/* ============ 动态价格模型 ============ */

/** 基准价（魔力/单位）：托尔按张，彩虹ID按天 */
const BASE_UNIT: Record<ItemType, number> = { tohru: 1000, rainbow: 5 };
/** 系统售价 = 基准 × 系数 × 1.08 */
const BUY_MARKUP = 1.08;
/** 系统收购价 = 基准 × 系数 × 0.92 */
const SELL_HAIRCUT = 0.92;
/** 近 7 日净流入多少魔力对应 ±15% 的价格偏移 */
const FLOW_SPAN = 60000;
/** 缓慢漂移：30 天一个周期，幅度 ±5%（即使无人交易价格也会微调） */
const DRIFT_AMPLITUDE = 0.05;
const DRIFT_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
/** 价格系数上下限 */
const FACTOR_MIN = 0.7;
const FACTOR_MAX = 1.3;
/** 单次买卖数量上限 */
const MAX_UNITS = 10000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** 近 7 天玩家净买入额（魔力），买入为正、卖出为负 */
async function recentNetFlow(): Promise<number> {
  const rows = await query<{ direction: string; magic: number }>(
    `SELECT direction, magic
       FROM public.game_market_trades
      WHERE created_at >= NOW() - INTERVAL '7 days'`,
  );
  let net = 0;
  for (const row of rows) {
    net += (row.direction === "buy" ? 1 : -1) * (Number(row.magic) || 0);
  }
  return net;
}

/**
 * 行情系数 = 1 + 近 7 日净流入偏移 + 周期漂移
 * 买入多于卖出 → 价格上浮；卖出多于买入 → 价格下探。
 */
function priceFactor(netFlow: number) {
  const flowTerm = clamp(netFlow / FLOW_SPAN, -0.15, 0.15);
  const drift = DRIFT_AMPLITUDE * Math.sin((Date.now() / DRIFT_PERIOD_MS) * Math.PI * 2);
  return clamp(1 + flowTerm + drift, FACTOR_MIN, FACTOR_MAX);
}

/** 生成买入/卖出价，并保证买卖价差至少 1 魔力 */
function pricesFromFactor(factor: number): Prices {
  const build = (base: number): UnitPrices => {
    const anchor = base * factor;
    const sell = Math.max(1, Math.floor(anchor * SELL_HAIRCUT));
    const buy = Math.max(sell + 1, Math.ceil(anchor * BUY_MARKUP));
    return { buy, sell };
  };
  return { tohru: build(BASE_UNIT.tohru), rainbow: build(BASE_UNIT.rainbow) };
}

async function currentPrices(): Promise<{ prices: Prices; factor: number; netFlow: number }> {
  const netFlow = await recentNetFlow();
  const factor = priceFactor(netFlow);
  return { prices: pricesFromFactor(factor), factor, netFlow };
}

/* ============ 背包读写 ============ */

function normalizeRainbow(value: unknown): RainbowItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item as Partial<RainbowItem>)
    .filter((item) => Number.isFinite(Number(item?.days)) && Number.isFinite(Number(item?.ts)))
    .map((item) => ({ days: Number(item!.days), ts: Number(item!.ts) }));
}

async function readMine(email: string): Promise<Mine> {
  const users = await query<{ wish_magic: number; wish_tohru: number }>(
    `SELECT wish_magic, wish_tohru FROM public.account_users WHERE email = $1`,
    [email],
  );
  const saves = await query<{ rainbow_ids: unknown }>(
    `SELECT rainbow_ids FROM public.game_wish_save WHERE user_email = $1`,
    [email],
  );
  const rainbowIds = normalizeRainbow(saves[0]?.rainbow_ids);
  return {
    magic: users.length > 0 ? Number(users[0].wish_magic) || 0 : 0,
    tohru: users.length > 0 ? Number(users[0].wish_tohru) || 0 : 0,
    rainbowIds,
    rainbowDays: rainbowIds.reduce((sum, item) => sum + Math.max(0, item.days), 0),
  };
}

async function writeRainbow(
  run: (sql: string, params?: unknown[]) => Promise<unknown[]>,
  email: string,
  items: RainbowItem[],
) {
  await run(
    `INSERT INTO public.game_wish_save (user_email, rainbow_ids, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_email) DO UPDATE SET rainbow_ids = EXCLUDED.rainbow_ids, updated_at = NOW()`,
    [email, JSON.stringify(items)],
  );
}

/** 从最早获得的彩虹ID 开始扣除天数，返回剩余部分 */
function takeRainbowDays(items: RainbowItem[], days: number) {
  let remain = days;
  const kept: RainbowItem[] = [];
  for (const item of [...items].sort((a, b) => a.ts - b.ts)) {
    if (remain <= 0) {
      kept.push(item);
    } else if (item.days <= remain) {
      remain -= item.days;
    } else {
      kept.push({ days: item.days - remain, ts: item.ts });
      remain = 0;
    }
  }
  return { kept, taken: days - Math.max(0, remain) };
}

/* ============ 旧挂单回收（市场改为系统买卖后执行一次） ============ */

let legacyRefunded = false;

/** 把仍在挂单中的奖品退回背包，未收取的收益按 95% 补发 */
async function refundLegacyListings() {
  if (legacyRefunded) return;
  try {
    const refunded = await withTransaction(async (q) => {
      const rows = await q<LegacyListing>(
        `SELECT id, seller_email, item_type, item_days, earned, paid
           FROM public.game_market_listings
          WHERE status = 'active'
          FOR UPDATE`,
      );
      if (rows.length === 0) return false;
      for (const row of rows) {
        const units = Math.max(0, Number(row.item_days) || 0);
        if (row.item_type === "tohru") {
          if (units > 0) {
            await q(
              `UPDATE public.account_users SET wish_tohru = wish_tohru + $2 WHERE email = $1`,
              [row.seller_email, units],
            );
          }
        } else if (units > 0) {
          const saves = await q<{ rainbow_ids: unknown }>(
            `SELECT rainbow_ids FROM public.game_wish_save WHERE user_email = $1`,
            [row.seller_email],
          );
          const items = normalizeRainbow(saves[0]?.rainbow_ids);
          items.push({ days: units, ts: Date.now() });
          await writeRainbow(q, row.seller_email, items);
        }
        const pending = Math.max(0, (Number(row.earned) || 0) - (Number(row.paid) || 0));
        if (pending > 0) {
          await q(`UPDATE public.account_users SET wish_magic = wish_magic + $2 WHERE email = $1`, [
            row.seller_email,
            Math.max(1, Math.floor(pending * 0.95)),
          ]);
        }
        await q(
          `UPDATE public.game_market_listings
              SET status = 'cancelled', paid = COALESCE(earned, 0)
            WHERE id = $1`,
          [row.id],
        );
      }
      return true;
    });
    if (refunded) legacyRefunded = true;
  } catch (err) {
    console.warn("[market] 旧挂单回收失败:", (err as Error).message);
  }
}

/* ============ API ============ */

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }

  await ensure();
  await refundLegacyListings();

  const [mine, market] = await Promise.all([readMine(email), currentPrices()]);

  return NextResponse.json({
    ok: true,
    mine,
    prices: market.prices,
    factor: Math.round(market.factor * 1000) / 1000,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
  }

  await ensure();

  let body: { action?: string; itemType?: string; units?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "无效 JSON" }, { status: 400 });
  }

  const itemType = body.itemType;
  if (itemType !== "tohru" && itemType !== "rainbow") {
    return NextResponse.json({ ok: false, message: "未知奖品类型" }, { status: 400 });
  }

  const units = Math.floor(Number(body.units ?? 1));
  if (!Number.isFinite(units) || units < 1 || units > MAX_UNITS) {
    return NextResponse.json(
      { ok: false, message: `数量需在 1 - ${MAX_UNITS} 之间` },
      { status: 400 },
    );
  }

  const { prices } = await currentPrices();
  const unitName = itemType === "tohru" ? "张" : "天";

  try {
    if (body.action === "buy") {
      const unitPrice = prices[itemType].buy;
      const cost = unitPrice * units;

      const result = await withTransaction(async (q) => {
        const paid = await q<{ wish_magic: number }>(
          `UPDATE public.account_users
              SET wish_magic = wish_magic - $2
            WHERE email = $1 AND wish_magic >= $2
          RETURNING wish_magic`,
          [email, cost],
        );
        if (paid.length === 0) {
          return { error: `魔力不足（需要 ${cost} 魔力）` };
        }

        if (itemType === "tohru") {
          await q(`UPDATE public.account_users SET wish_tohru = wish_tohru + $2 WHERE email = $1`, [
            email,
            units,
          ]);
        } else {
          const saves = await q<{ rainbow_ids: unknown }>(
            `SELECT rainbow_ids FROM public.game_wish_save WHERE user_email = $1`,
            [email],
          );
          const items = normalizeRainbow(saves[0]?.rainbow_ids);
          items.push({ days: units, ts: Date.now() });
          await writeRainbow(q, email, items);
        }

        await q(
          `INSERT INTO public.game_market_trades (user_email, item_type, direction, units, unit_price, magic)
           VALUES ($1, $2, 'buy', $3, $4, $5)`,
          [email, itemType, units, unitPrice, cost],
        );
        return { error: null as string | null };
      });

      if (result.error) {
        return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        mine: await readMine(email),
        prices,
        cost,
      });
    }

    if (body.action === "sell") {
      const unitPrice = prices[itemType].sell;
      const gained = unitPrice * units;

      const result = await withTransaction(async (q) => {
        if (itemType === "tohru") {
          const taken = await q<{ wish_tohru: number }>(
            `UPDATE public.account_users
                SET wish_tohru = wish_tohru - $2
              WHERE email = $1 AND wish_tohru >= $2
            RETURNING wish_tohru`,
            [email, units],
          );
          if (taken.length === 0) {
            return { error: "托尔数量不足" };
          }
        } else {
          const saves = await q<{ rainbow_ids: unknown }>(
            `SELECT rainbow_ids FROM public.game_wish_save WHERE user_email = $1`,
            [email],
          );
          const items = normalizeRainbow(saves[0]?.rainbow_ids);
          const total = items.reduce((sum, item) => sum + Math.max(0, item.days), 0);
          if (total < units) {
            return { error: `彩虹ID 天数不足（当前共 ${total} 天）` };
          }
          const { kept } = takeRainbowDays(items, units);
          await writeRainbow(q, email, kept);
        }

        await q(`UPDATE public.account_users SET wish_magic = wish_magic + $2 WHERE email = $1`, [
          email,
          gained,
        ]);
        await q(
          `INSERT INTO public.game_market_trades (user_email, item_type, direction, units, unit_price, magic)
           VALUES ($1, $2, 'sell', $3, $4, $5)`,
          [email, itemType, units, unitPrice, gained],
        );
        return { error: null as string | null };
      });

      if (result.error) {
        return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        mine: await readMine(email),
        prices,
        gained,
      });
    }

    return NextResponse.json({ ok: false, message: "未知操作" }, { status: 400 });
  } catch (err) {
    console.error("[market] 操作失败:", (err as Error).message);
    return NextResponse.json({ ok: false, message: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
