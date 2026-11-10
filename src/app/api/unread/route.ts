import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureSchema } from "@/lib/db";
import { getUnreadTotal } from "@/lib/unread";

let schemaEnsured = false;

async function ensureOnce() {
  if (schemaEnsured) return;
  await ensureSchema();
  schemaEnsured = true;
}

/** 导航栏未读角标轮询接口 */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, total: 0 }, { status: 401 });
  }

  try {
    await ensureOnce();
    const total = await getUnreadTotal(email);
    return NextResponse.json(
      { ok: true, total },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json({ ok: true, total: 0 });
  }
}
