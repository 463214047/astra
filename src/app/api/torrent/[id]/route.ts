/**
 * 下载 .torrent 文件 —— 自动注入当前用户 passkey 到 announce URL
 * GET /api/torrent/{id}?passkey=xxx
 *
 * 流程:
 *   1. 查 DB 拿 torrent 原始二进制（上传时存的 base64）
 *   2. bencode 解码 → root["announce"] = "/api/announce?passkey=xxx"
 *      同时把 announce-list 全部替换
 *   3. 重新 bencode 编码 → 返回给客户端
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getUserByPasskey } from "@/lib/passkey";
import { decodeBencode, encodeBencode, parseTorrentInfoHash, type BencodeValue } from "@/lib/bencode";

// torrent 的 announce URL 应该指向 /api/announce
// 但 Next.js dev server 端口可能是 3000 — 我们用相对 URL + 让 tracker route 里自己识别 origin
// 更简单的做法：用 NEXT_PUBLIC_TRACKER_URL env，没有就 fallback 到当前 host + /api/announce
function buildAnnounceUrl(passkey: string, infoHashHex: string, req: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_TRACKER_URL || `${req.nextUrl.origin}/api/announce`;
  // 把 info_hash 以 hex 字符串塞进 URL 参数 ih= —— BT 客户端发的二进制 info_hash
  // 会被 Next.js 框架层替换字符破坏（0xD1→%EF%BF%BD），所以我们用自己的安全参数
  return `${base}?passkey=${passkey}&ih=${infoHashHex}`;
}

// torrent 原始二进制需要存在 posts 表里 → 加一个 torrent_data TEXT (base64) 列
// 但这是新增 schema，先假设上传时已经把 base64 存到 torrent_data
// 这里先从 torrent_posts 表查
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 两种认证：登录 cookie 或显式 passkey query param
  let email: string | null = null;
  const url = new URL(req.url);
  const passkeyParam = url.searchParams.get("passkey");

  if (passkeyParam) {
    email = await getUserByPasskey(passkeyParam);
  } else {
    const session = await auth();
    email = session?.user?.email ?? null;
  }

  if (!email) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // 确保有 passkey
  const { ensureUserPasskey } = await import("@/lib/passkey");
  const passkey = await ensureUserPasskey(email);

  // 查 torrent 二进制 + info_hash
  const rows = await query<{ torrent_data: string | null; torrent_name: string | null; torrent_info_hash: string | null }>(
    "SELECT torrent_data, torrent_name, torrent_info_hash FROM public.posts WHERE id = $1",
    [id],
  );
  if (!rows.length) {
    return new NextResponse("Post not found", { status: 404 });
  }
  if (!rows[0].torrent_data) {
    // 旧帖子 —— 没有存 torrent 二进制
    return new NextResponse(
      JSON.stringify({
        ok: false,
        message: "该帖子为旧版本，请编辑帖子重新上传 .torrent 文件",
      }),
      { status: 410, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const torrentBytes = Buffer.from(rows[0].torrent_data, "base64");
    const root = decodeBencode(new Uint8Array(torrentBytes)) as { [k: string]: BencodeValue };

    // info_hash：优先用 DB 存好的，否则从原始 torrent 算
    const infoHashHex = rows[0].torrent_info_hash || parseTorrentInfoHash(torrentBytes);

    // 替换 announce URL —— byte string 必须用 Uint8Array
    const fullAnnounce = buildAnnounceUrl(passkey, infoHashHex, req);
    root.announce = new TextEncoder().encode(fullAnnounce);
    // announce-list: list of list of byte strings —— 必须是完整 URL，BT 客户端不认相对路径
    root["announce-list"] = [
      [new TextEncoder().encode(fullAnnounce)],
    ];

    // 重编码（用新的安全 encodeBencode）
    const outBuf = encodeBencode(root as unknown as BencodeValue);

    const rawName = (rows[0].torrent_name || "download.torrent").replace(/\.torrent$/i, "") + ".torrent";
    // Content-Disposition header 不能包含 > 255 的字符（Node.js 会 throw）
    // RFC 5987 编码: filename="ascii" + filename*=UTF-8''%E9...
    const isAscii = /^[\x00-\x7f]+$/.test(rawName);
    const filenameHeader = isAscii
      ? `filename="${rawName}"`
      : `filename="download.torrent"; filename*=UTF-8''${encodeURIComponent(rawName)}`;
    return new NextResponse(outBuf, {
      headers: {
        "Content-Type": "application/x-bittorrent",
        "Content-Disposition": `attachment; ${filenameHeader}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[torrent] encode error:", e);
    return new NextResponse("Internal error", { status: 500 });
  }
}
