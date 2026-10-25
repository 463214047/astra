import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureSchema, withTransaction } from "@/lib/db";
import { RAINBOW_ROLES } from "@/lib/rainbow";

let schemaEnsured = false;
async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

/**
 * 使用祈愿获得的「彩虹ID」奖品，兑换成彩虹昵称时长。
 * 已兑换过的奖品通过 rainbow_claimed_ts 水位线去重，可重复调用。
 */
export async function POST() {
  try {
    await ensureOnce();
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });

    const result = await withTransaction(async (q) => {
      const users = await q<{
        role: string;
        rainbow_until: Date | string | null;
        rainbow_claimed_ts: string | number;
      }>(
        `SELECT role, rainbow_until, rainbow_claimed_ts
           FROM public.account_users
          WHERE email = $1
          FOR UPDATE`,
        [email],
      );
      const user = users[0];
      if (!user) return { kind: "missing" as const };

      if (RAINBOW_ROLES.has(user.role)) {
        const until = user.rainbow_until ? new Date(user.rainbow_until).toISOString() : null;
        return { kind: "privileged" as const, until };
      }

      const saves = await q<{ rainbow_ids: unknown }>(
        `SELECT rainbow_ids FROM public.game_wish_save WHERE user_email = $1`,
        [email],
      );
      const prizes = Array.isArray(saves[0]?.rainbow_ids) ? saves[0].rainbow_ids : [];
      const claimedTs = Number(user.rainbow_claimed_ts) || 0;

      let days = 0;
      let maxTs = claimedTs;
      for (const raw of prizes) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as { days?: unknown; ts?: unknown };
        const d = Math.floor(Number(item.days));
        const ts = Number(item.ts);
        if (!Number.isFinite(d) || d <= 0) continue;
        if (!Number.isFinite(ts) || ts <= claimedTs) continue;
        days += d;
        if (ts > maxTs) maxTs = ts;
      }

      if (days === 0) return { kind: "empty" as const };

      const base = Math.max(
        Date.now(),
        user.rainbow_until ? new Date(user.rainbow_until).getTime() : 0,
      );
      const until = new Date(base + days * 24 * 60 * 60 * 1000);

      await q(
        `UPDATE public.account_users
            SET rainbow_until = $2,
                rainbow_claimed_ts = $3,
                rainbow_enabled = TRUE,
                updated_at = NOW()
          WHERE email = $1`,
        [email, until.toISOString(), maxTs],
      );

      return {
        kind: "ok" as const,
        days,
        until: until.toISOString(),
      };
    });

    if (result.kind === "missing") {
      return NextResponse.json({ ok: false, message: "用户不存在" }, { status: 404 });
    }
    if (result.kind === "privileged") {
      return NextResponse.json({
        ok: true,
        privileged: true,
        claimedDays: 0,
        rainbowUntil: result.until,
      });
    }
    if (result.kind === "empty") {
      return NextResponse.json({ ok: false, message: "没有可用的彩虹ID奖品" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      privileged: false,
      claimedDays: result.days,
      rainbowUntil: result.until,
    });
  } catch (err) {
    console.error("[profile/rainbow/claim] 失败:", err);
    return NextResponse.json({ ok: false, message: "服务器内部错误" }, { status: 500 });
  }
}
