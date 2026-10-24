/**
 * Private PT Tracker — BEP-3 announce
 *
 * URL 格式: /announce?passkey=xxx&info_hash=xxx&peer_id=xxx&port=xxx&uploaded=N&downloaded=N&left=N&event=started|stopped|completed
 *
 * 返回: bencoded response（紧凑 peer 列表）
 *
 * 关键设计：
 *   - 活跃 peer 存在内存 Map（info_hash → Map<peerKey, peer>），每分钟过期
 *   - 累计上传下载写入 PG（user_torrent_stats）——异步不阻塞响应
 *   - 只有 whitelist 里的 info_hash + 有效 passkey 才能 announce
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getUserByPasskey } from "@/lib/passkey";
import { query } from "@/lib/db";

// ===== 内存 peer 存储 =====
// key = info_hash, value = Map<peerKey, { ip, port, lastSeen, left }>
// peerKey = email + "|" + peer_id（同一用户可能有多个客户端）
interface PeerEntry {
  ip: string;
  port: number;
  left: number;          // 剩余字节，0 = seed
  lastSeen: number;      // ts
  peerId: string;
  email: string;
}

// Next.js 默认 edge runtime — 但我们依赖全局内存 peerStore + setInterval + fire-and-forget DB 写
// edge runtime 在 response 返回后会冻结进程，fire-and-forget 的异步任务会被掐
export const runtime = "nodejs";

export const peerStore = new Map<string, Map<string, PeerEntry>>();

// 已计入 download_count 的 (user_email, info_hash) 对 — 防止同一用户同一种子重复 +1
// （seeder 每次心跳 left=0 都要 announce，不能每次都加）
export const downloadedPairs = new Set<string>();
function pairKey(email: string, infoHash: string) { return `${email}|${infoHash}`; }

// 每分钟清理过期 peers（15 分钟没 announce = 掉线）
const EXPIRY_MS = 15 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const peers of peerStore.values()) {
    for (const [k, v] of peers) {
      if (now - v.lastSeen > EXPIRY_MS) peers.delete(k);
    }
  }
}, 60_000).unref?.();

function getCompactPeers(peers: Map<string, PeerEntry>, count: number): Buffer {
  // compact 格式: 每 peer 6 字节 — 4 IPv4 + 2 port (big-endian)
  // 过滤掉自己（客户端实现自己排除）
  const out: number[] = [];
  let i = 0;
  for (const p of peers.values()) {
    if (i >= count) break;
    const oct = p.ip.split(".");
    if (oct.length !== 4) continue; // 暂只支持 IPv4
    for (const o of oct) out.push(parseInt(o, 10));
    out.push((p.port >> 8) & 0xff, p.port & 0xff);
    i++;
  }
  return Buffer.from(out);
}

function getPeerStats(infoHash: string): { complete: number; incomplete: number } {
  const peers = peerStore.get(infoHash);
  if (!peers) return { complete: 0, incomplete: 0 };
  let complete = 0;
  let incomplete = 0;
  for (const p of peers.values()) {
    if (p.left === 0) complete++;
    else incomplete++;
  }
  return { complete, incomplete };
}

/* ===== Bencode 简单输出（只支持 tracker 响应用到的类型） ===== */
function bencodeRawBytes(buf: Buffer | Uint8Array): Buffer {
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return Buffer.concat([Buffer.from(`${bytes.length}:`), bytes]);
}

function bencodeString(s: string): Buffer {
  return Buffer.from(`${Buffer.byteLength(s)}:${s}`);
}
function bencodeInt(n: number): Buffer {
  // tracker 里 number 通常在 int32 范围，Node Buffer 够用
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

function errorResponse(msg: string): Buffer {
  return bencodeDict({
    "failure reason": bencodeString(msg),
  });
}

function peerKey(email: string, peerId: string): string {
  return `${email}|${peerId}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;

  const passkey = params.get("passkey") || "";
  const peerId = params.get("peer_id") || "";
  const portStr = params.get("port") || "";
  const uploaded = parseInt(params.get("uploaded") || "0", 10);
  const downloaded = parseInt(params.get("downloaded") || "0", 10);
  const left = parseInt(params.get("left") || "0", 10);
  const event = params.get("event") || "";
  const compact = parseInt(params.get("compact") || "1", 10);

  // --- 取 info_hash：只读 torrent URL 里我们自己带的 ih=hex ---
  // BT 客户端也会发 info_hash=20字节二进制，但 Next.js 框架层会把
  // 非 UTF-8 字节替换成 U+FFFD，彻底破坏掉，所以我们完全忽略它
  const infoHashHex = params.get("ih") || "";

  // --- 参数校验 ---
  if (passkey.length !== 32) {
    return new NextResponse(errorResponse("invalid passkey"), {
      headers: { "Content-Type": "text/plain" },
    });
  }
  if (infoHashHex.length !== 40 || !/^[a-f0-9]+$/i.test(infoHashHex)) {
    return new NextResponse(errorResponse("invalid info_hash"), {
      headers: { "Content-Type": "text/plain" },
    });
  }
  if (!peerId) {
    return new NextResponse(errorResponse("missing peer_id"), {
      headers: { "Content-Type": "text/plain" },
    });
  }
  const port = parseInt(portStr, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return new NextResponse(errorResponse("invalid port"), {
      headers: { "Content-Type": "text/plain" },
    });
  }

  // --- passkey → 用户 ---
  const email = await getUserByPasskey(passkey);
  if (!email) {
    return new NextResponse(errorResponse("invalid passkey"), {
      headers: { "Content-Type": "text/plain" },
    });
  }

  // --- whitelist 校验 ---
  const wl = await query<{ post_id: string }>(
    "SELECT post_id FROM public.torrent_whitelist WHERE info_hash = $1",
    [infoHashHex],
  );
  if (wl.length === 0) {
    return new NextResponse(errorResponse("torrent not registered"), {
      headers: { "Content-Type": "text/plain" },
    });
  }

  // --- peer IP ---
  const fwd = req.headers.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0].trim() : req.nextUrl.hostname) || "127.0.0.1";

  // --- 更新内存 store ---
  let peers = peerStore.get(infoHashHex);
  if (!peers) {
    peers = new Map();
    peerStore.set(infoHashHex, peers);
  }

  const key = peerKey(email, peerId);
  const existing = peers.get(key);

  if (event === "stopped") {
    peers.delete(key);
  } else {
    const now = Date.now();
    peers.set(key, {
      ip, port, left, peerId, email,
      lastSeen: now,
    });

    // 下载完成检测：之前 left > 0（在下载），现在 left = 0（做种）
    // 不依赖 BT 客户端发 event=completed — 很多客户端静默变成 seed，不发事件
    if (existing && existing.left > 0 && left === 0) {
      peers.set(key, {
        ip, port, left, peerId, email,
        lastSeen: now + 1, // 标记需要 +1 download_count（用 +1 时间戳）
      });
    }
  }

  // --- 异步写 PG 统计（不阻塞响应）---
  void (async () => {
    try {
      // stopped 事件：peer 已从内存删了，需要刷新 DB seed/leech 计数
      // 但不要写 user_torrent_stats（stopped 不是正常心跳）
      if (event === "stopped") {
        const stats = getPeerStats(infoHashHex);
        await query(
          `UPDATE public.posts SET seed_count = $1, leech_count = $2
           WHERE id = (SELECT post_id FROM public.torrent_whitelist WHERE info_hash = $3)`,
          [stats.complete, stats.incomplete, infoHashHex],
        );
        revalidatePath("/");
        return;
      }

      const isSeeding = left === 0;
      const isLeeching = left > 0;
      // 查上一次状态 — 判断是否刚完成下载
      let justCompleted = false;
      if (existing && existing.left > 0 && left === 0) justCompleted = true;

      await query(
        `INSERT INTO public.user_torrent_stats
           (user_email, info_hash, uploaded, downloaded, is_seeding, is_leeching, last_announce)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_email, info_hash) DO UPDATE
           SET uploaded     = public.user_torrent_stats.uploaded    + (EXCLUDED.uploaded    - public.user_torrent_stats.uploaded),
               downloaded   = public.user_torrent_stats.downloaded  + (EXCLUDED.downloaded  - public.user_torrent_stats.downloaded),
               is_seeding   = EXCLUDED.is_seeding,
               is_leeching  = EXCLUDED.is_leeching,
               last_announce = NOW()`,
        [email, infoHashHex, uploaded, downloaded, isSeeding, isLeeching],
      );
      // 更新 posts 的 seed/leech count（从内存 peerStore 实时统计）
      const stats = getPeerStats(infoHashHex);
      await query(
        `UPDATE public.posts SET seed_count = $1, leech_count = $2
         WHERE id = (SELECT post_id FROM public.torrent_whitelist WHERE info_hash = $3)`,
        [stats.complete, stats.incomplete, infoHashHex],
      );

      // 下载完成 +1 — 同一用户同一种子只计一次
      // 触发条件：BT 客户端发 event=completed，或 peer 从 leech(left>0) 变成 seed(left=0)
      if ((event === "completed" || justCompleted) && !downloadedPairs.has(pairKey(email, infoHashHex))) {
        downloadedPairs.add(pairKey(email, infoHashHex));
        await query(
          `UPDATE public.posts SET download_count = download_count + 1
           WHERE id = (SELECT post_id FROM public.torrent_whitelist WHERE info_hash = $1)`,
          [infoHashHex],
        );
      }
      revalidatePath("/");
    } catch (e) {
      console.error("[tracker] stats write failed:", e);
    }
  })();

  // --- 构造响应 ---
  const stats = getPeerStats(infoHashHex);
  const interval = 300; // 5 分钟

  const response: Record<string, Buffer> = {
    "interval": bencodeInt(interval),
    "complete": bencodeInt(stats.complete),
    "incomplete": bencodeInt(stats.incomplete),
    "tracker id": bencodeString("astra-pt"),
  };

  if (compact === 1) {
    // compact peer 是原始字节，不能走 string 路径
    response["peers"] = bencodeRawBytes(getCompactPeers(peers, 200));
  } else {
    // 非 compact — BEP-3 字典列表（略，tracker 客户端基本都用 compact=1）
    response["peers"] = bencodeString("");
  }

  return new NextResponse(bencodeDict(response), {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store",
    },
  });
}

/*
 * scrape 端点 — 见 /api/scrape/route.ts（Next.js 路由方法限制）
 */
