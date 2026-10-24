/**
 * Private PT Tracker — BEP-48 scrape
 * GET /api/scrape?info_hash=xxx&passkey=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserByPasskey } from "@/lib/passkey";
import { query } from "@/lib/db";
import { peerStore } from "@/app/api/announce/route";

function bencodeString(s: string): Buffer {
  return Buffer.from(`${Buffer.byteLength(s)}:${s}`);
}
function bencodeInt(n: number): Buffer {
  return Buffer.from(`i${n}e`);
}
function bencodeDict(obj: Record<string, Buffer>): Buffer {
  const keys = Object.keys(obj).sort();
  const parts: Buffer[] = [Buffer.from("d")];
  for (const k of keys) {
    parts.push(bencodeString(k));
    parts.push(obj[k]);
  }
  parts.push(Buffer.from("e"));
  return Buffer.concat(parts);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;
  const passkey = params.get("passkey") || "";
  // 优先读我们自己注入的 ih=hex（安全），忽略 BT 客户端发的二进制 info_hash
  const infoHash = params.get("ih") || params.get("info_hash") || "";

  if (passkey.length !== 32 || infoHash.length !== 40 || !/^[a-f0-9]+$/i.test(infoHash)) {
    return new NextResponse(
      bencodeDict({ "failure reason": bencodeString("invalid params") }),
      { headers: { "Content-Type": "text/plain" } },
    );
  }
  const email = await getUserByPasskey(passkey);
  if (!email) {
    return new NextResponse(
      bencodeDict({ "failure reason": bencodeString("invalid passkey") }),
      { headers: { "Content-Type": "text/plain" } },
    );
  }

  const peers = peerStore.get(infoHash);
  let complete = 0, incomplete = 0;
  if (peers) {
    for (const p of peers.values()) {
      if (p.left === 0) complete++;
      else incomplete++;
    }
  }

  const dlRows = await query<{ download_count: number }>(
    `SELECT download_count FROM public.posts
     WHERE id = (SELECT post_id FROM public.torrent_whitelist WHERE info_hash = $1)`,
    [infoHash],
  );

  const fileDict: Record<string, Buffer> = {};
  fileDict[infoHash] = bencodeDict({
    complete: bencodeInt(complete),
    incomplete: bencodeInt(incomplete),
    downloaded: bencodeInt(dlRows[0]?.download_count ?? 0),
  });

  return new NextResponse(
    bencodeDict({ files: bencodeDict(fileDict) }),
    { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } },
  );
}
