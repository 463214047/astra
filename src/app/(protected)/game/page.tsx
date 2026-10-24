import type { Metadata } from "next";
import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";
import GameClient from "./GameClient";

export const metadata: Metadata = {
  title: "游戏",
};

export default async function GamesPage() {
  const session = await auth();
  const email = session.user.email;

  let magic = 16000;
  let pity5 = 0;
  let pity4 = 0;
  let total = 0;
  let history: unknown[] = [];
  let rainbowIds: unknown[] = [];

  if (email) {
    await ensureSchema();
    const users = await query<{
      wish_magic: number;
      wish_pity5: number;
      wish_pity4: number;
      wish_total: number;
    }>(
      `SELECT wish_magic, wish_pity5, wish_pity4, wish_total
       FROM public.account_users WHERE email = $1`,
      [email],
    );
    if (users.length > 0) {
      const u = users[0];
      magic = Number(u.wish_magic) || 16000;
      pity5 = Number(u.wish_pity5) || 0;
      pity4 = Number(u.wish_pity4) || 0;
      total = Number(u.wish_total) || 0;
    }
    const rows = await query<{ history: unknown; rainbow_ids: unknown }>(
      `SELECT history, rainbow_ids FROM public.game_wish_save WHERE user_email = $1`,
      [email],
    );
    if (rows.length > 0) {
      history = Array.isArray(rows[0].history) ? rows[0].history : [];
      rainbowIds = Array.isArray(rows[0].rainbow_ids) ? rows[0].rainbow_ids : [];
    }
  }

  return (
    <GameClient
      initialMagic={magic}
      initialPity5={pity5}
      initialPity4={pity4}
      initialTotal={total}
      initialHistory={history}
      initialRainbowIds={rainbowIds}
    />
  );
}
