import { createHash } from "node:crypto";

/**
 * 极简 Bencode 解码器 + 编码器
 *
 * torrent info_hash = SHA1(bencode(info_dict))
 * 关键：byte string 必须原样传递（不能 roundtrip 到 UTF-8 string）
 *   - dict key: 都是 ASCII 字符串 → 用 string 表示 ✓
 *   - dict value / list item: byte string 必须保持原始 Uint8Array
 *     （pieces 二进制、非 ASCII 文件名都包含 >127 的字节）
 */

export type BencodeValue =
  | Uint8Array // byte string（原始 bytes，不转 string！）
  | number // integer
  | BencodeValue[] // list
  | { [key: string]: BencodeValue }; // dict（key 是 ASCII string）

/* ==================== 解码 ==================== */

export function decodeBencode(data: Uint8Array): BencodeValue {
  let pos = 0;

  function decodeValue(): BencodeValue {
    const c = data[pos];
    // integer: i...e
    if (c === 0x69) {
      pos++;
      const start = pos;
      while (data[pos] !== 0x65) pos++;
      const numStr = new TextDecoder().decode(data.slice(start, pos));
      pos++;
      const n = Number(numStr);
      if (!Number.isFinite(n)) throw new Error("invalid integer");
      return n;
    }
    // list: l...e
    if (c === 0x6c) {
      pos++;
      const list: BencodeValue[] = [];
      while (data[pos] !== 0x65) list.push(decodeValue());
      pos++;
      return list;
    }
    // dict: d...e
    if (c === 0x64) {
      pos++;
      const dict: { [key: string]: BencodeValue } = {};
      while (data[pos] !== 0x65) {
        // dict key 用 ASCII string（torrent 规范 key 全是 ASCII）
        const key = decodeAsciiString();
        const val = decodeValue();
        dict[key] = val;
      }
      pos++;
      return dict;
    }
    // byte string: len:bytes — 返回 Uint8Array（原始 bytes）
    if (c >= 0x30 && c <= 0x39) {
      return decodeRawBytes();
    }
    throw new Error(`unexpected bencode byte 0x${c.toString(16)} at pos ${pos}`);
  }

  function decodeRawBytes(): Uint8Array {
    const start = pos;
    while (data[pos] !== 0x3a) pos++;
    const len = Number(new TextDecoder().decode(data.slice(start, pos)));
    pos++; // skip ':'
    const bytes = data.slice(pos, pos + len);
    pos += len;
    return bytes;
  }

  function decodeAsciiString(): string {
    const bytes = decodeRawBytes();
    // dict key 都是 ASCII（< 128），直接 UTF-8 解码安全
    return new TextDecoder("ascii").decode(bytes);
  }

  return decodeValue();
}

/* ==================== 编码 ==================== */

function concatUint8s(arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

function encodeByteString(raw: Uint8Array): Uint8Array {
  const len = new TextEncoder().encode(String(raw.length) + ":");
  return concatUint8s([len, raw]);
}

function encodeInteger(n: number): Uint8Array {
  // torrent 里 single-file length 可能超 int32，但不会超 Number.MAX_SAFE_INTEGER
  const str = "i" + String(n) + "e";
  return new TextEncoder().encode(str);
}

function encodeValue(v: BencodeValue): Uint8Array {
  // Uint8Array → 原样作为 byte string
  if (v instanceof Uint8Array) return encodeByteString(v);

  if (typeof v === "number") return encodeInteger(v);

  if (Array.isArray(v)) {
    const out: Uint8Array[] = [new TextEncoder().encode("l")];
    for (const item of v) out.push(encodeValue(item));
    out.push(new TextEncoder().encode("e"));
    return concatUint8s(out);
  }

  // dict — key 按原始字节序排序（ASCII string 等于字节序）
  const keys = Object.keys(v).sort();
  const out: Uint8Array[] = [new TextEncoder().encode("d")];
  for (const k of keys) {
    const keyBytes = new TextEncoder().encode(k);
    out.push(encodeByteString(keyBytes));
    out.push(encodeValue(v[k]));
  }
  out.push(new TextEncoder().encode("e"));
  return concatUint8s(out);
}

/* ==================== Node.js Buffer 快捷编码 ==================== */

export function encodeBencode(v: BencodeValue): Buffer {
  const u8 = encodeValue(v);
  // 必须传 byteOffset/byteLength，否则如果 Uint8Array 是更大 ArrayBuffer 的 view，
  // Buffer.from(arrayBuffer) 会把多余字节也带进来 — 虽然我们内部都是新建 Uint8Array，
  // 但保持这个写法是 Node.js 官方推荐的安全模式
  return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
}

/* ==================== 工具函数 ==================== */

/** 计算 torrent info_hash — SHA1(bencode(info_dict)) */
export function parseTorrentInfoHash(torrentBytes: Uint8Array | ArrayBuffer | Buffer): string {
  const buf = torrentBytes instanceof Uint8Array ? torrentBytes : new Uint8Array(torrentBytes);
  const root = decodeBencode(buf) as { info?: BencodeValue };
  if (!root.info) throw new Error("torrent missing info dict");
  const infoEncoded = encodeValue(root.info);
  return createHash("sha1").update(infoEncoded).digest("hex");
}

/** 计算 torrent 总大小 */
export function parseTorrentTotalSize(torrentBytes: Uint8Array | ArrayBuffer | Buffer): number {
  const buf = torrentBytes instanceof Uint8Array ? torrentBytes : new Uint8Array(torrentBytes);
  const root = decodeBencode(buf) as {
    info?: {
      length?: number;
      files?: { length?: number }[];
    };
  };
  if (!root.info) throw new Error("torrent missing info dict");
  if (typeof root.info.length === "number") return root.info.length;
  if (Array.isArray(root.info.files)) {
    let total = 0;
    for (const f of root.info.files) {
      if (typeof (f as { length?: number }).length === "number") {
        total += (f as { length: number }).length;
      }
    }
    return total;
  }
  return 0;
}
