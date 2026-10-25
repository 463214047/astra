/**
 * TOTP (RFC 6238) 核心实现 — 纯 Node.js crypto，无需第三方依赖
 *
 * 功能：
 *   - 生成 TOTP secret（base32 编码）
 *   - 验证用户输入的 6 位验证码（±1 时间步容差 = 90 秒）
 *   - AES-256-GCM 加密/解密 secret（防止数据库泄露）
 *   - 生成 otpauth:// URI（供 QR 码使用）
 *   - 生成一次性恢复码（启用 2FA 时展示，用户需保存）
 */

import { createHmac, randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";

/* ======================== 常量 ======================== */

const SECRET_BYTES = 20; // 160-bit = 标准 TOTP secret 长度
const TIME_STEP = 30; // 30 秒
const CODE_DIGITS = 6; // 6 位数字验证码
const VERIFY_WINDOW = 1; // ±1 步容差（处理时钟偏移）
const RECOVERY_COUNT = 8; // 8 个恢复码
const RECOVERY_BYTES = 10; // 每个恢复码 10 字节 base32 → 16 字符

/* ======================== Base32 编解码（RFC 4648） ======================== */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** 字节 → base32 字符串（无 padding） */
function base32Encode(data: Buffer): string {
  let bits = "";
  for (const b of data) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

/** base32 字符串 → 字节（允许空格/换行/大小写容错） */
function base32Decode(s: string): Buffer {
  const clean = s.replace(/[\s\-]/g, "").toUpperCase();
  let bits = "";
  for (const ch of clean) {
    const v = BASE32_ALPHABET.indexOf(ch);
    if (v === -1) throw new Error("Invalid base32 character: " + ch);
    bits += v.toString(2).padStart(5, "0");
  }
  const byteLen = Math.floor(bits.length / 8);
  const buf = Buffer.alloc(byteLen);
  for (let i = 0; i < byteLen; i++) {
    buf[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }
  return buf;
}

/* ======================== TOTP 核心算法 ======================== */

/** 字节 → 8 字节 big-endian counter */
function counterBytes(counter: number): Buffer {
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  return buf;
}

/** HMAC-SHA1 → 字节 */
function hmacSha1(key: Buffer, msg: Buffer): Buffer {
  return createHmac("sha1", key).update(msg).digest();
}

/** dynamic truncation → 4 字节 → 整数 */
function dynamicTruncate(hmac: Buffer): number {
  const offset = hmac[hmac.length - 1] & 0x0f;
  const big =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return big % Math.pow(10, CODE_DIGITS);
}

/** 生成当前时间步的 counter */
function currentCounter(): number {
  return Math.floor(Date.now() / 1000 / TIME_STEP);
}

/* ======================== 公开 API ======================== */

/** 生成 base32 编码的 TOTP secret（20 字节熵 = 160-bit） */
export function generateSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

/** 根据时间 counter 生成 6 位验证码 */
function generateCode(secret: string, counter?: number): string {
  const key = base32Decode(secret);
  const c = counter ?? currentCounter();
  const hmac = hmacSha1(key, counterBytes(c));
  const num = dynamicTruncate(hmac);
  return num.toString().padStart(CODE_DIGITS, "0");
}

/**
 * 验证用户输入的 6 位验证码
 * 允许 ±window 步容差（默认 ±1 = 90 秒）
 * 返回匹配的时间步偏移（0 = 当前步），null = 不匹配
 */
export function verifyCode(secret: string, input: string, window = VERIFY_WINDOW): number | null {
  const trimmed = input.trim();
  if (!/^\d{6}$/.test(trimmed)) return null;

  const counter = currentCounter();
  for (let offset = -window; offset <= window; offset++) {
    if (generateCode(secret, counter + offset) === trimmed) {
      return offset;
    }
  }
  return null;
}

/**
 * 生成 otpauth:// URI（给 QR 码库使用）
 * 格式：otpauth://totp/{issuer}:{label}?secret={secret}&issuer={issuer}
 *        &algorithm=SHA1&digits=6&period=30
 */
export function generateAuthUrl(params: { issuer: string; label: string; secret: string }): string {
  const { issuer, label, secret } = params;
  const path = encodeURIComponent(`${issuer}:${label}`);
  const qs = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(CODE_DIGITS),
    period: String(TIME_STEP),
  });
  return `otpauth://totp/${path}?${qs.toString()}`;
}

/* ======================== AES-256-GCM 加密存储 ======================== */

/**
 * 从 AUTH_SECRET 派生 AES-256 密钥（scrypt, cost=16384）
 * 失败时用硬编码 fallback 避免开发环境崩溃（生产环境必须设置 AUTH_SECRET）
 */
function deriveKey(): Buffer {
  const password = process.env.AUTH_SECRET;
  if (!password) {
    // 开发环境 fallback（生产环境强制设置 AUTH_SECRET）
    return scryptSync("astra-dev-fallback-key-change-in-production", "astra-salt", 32);
  }
  const salt = "astra-totp-salt-v1";
  return scryptSync(password, salt, 32);
}

/**
 * AES-256-GCM 加密 secret
 * 返回格式：base64(nonce).base64(ciphertext).base64(tag)
 */
export function encryptSecret(plain: string): string {
  const key = deriveKey();
  const nonce = randomBytes(12); // GCM 推荐 12 字节
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${nonce.toString("base64")}.${ciphertext.toString("base64")}.${tag.toString("base64")}`;
}

/** 解密 AES-256-GCM 加密的 secret */
export function decryptSecret(stored: string): string | null {
  try {
    const [nonceB64, cipherB64, tagB64] = stored.split(".");
    if (!nonceB64 || !cipherB64 || !tagB64) return null;

    const key = deriveKey();
    const nonce = Buffer.from(nonceB64, "base64");
    const ciphertext = Buffer.from(cipherB64, "base64");
    const tag = Buffer.from(tagB64, "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    // GCM 校验失败（篡改 / 密码不匹配）→ 返回 null
    return null;
  }
}

/* ======================== 恢复码 ======================== */

/**
 * 生成 RECOVERY_COUNT 个一次性恢复码
 * 每个码 10 字节熵 → base32 编码 → 16 字符（无 padding）
 * 返回值：码字符串数组 + 加密存储字符串
 */
export function generateRecoveryCodes(): { codes: string[]; encrypted: string } {
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_COUNT; i++) {
    codes.push(base32Encode(randomBytes(RECOVERY_BYTES)));
  }
  // 用逗号拼接 + 加密存储
  const encrypted = encryptSecret(codes.join(","));
  return { codes, encrypted };
}

/**
 * 验证恢复码并从已存储列表中移除（一次性使用）
 * @returns true = 验证成功，codes = 移除后的剩余码（需要回写数据库）
 */
export function consumeRecoveryCode(
  encrypted: string | null | undefined,
  input: string,
): { valid: boolean; remainingEncrypted: string | null } {
  if (!encrypted) return { valid: false, remainingEncrypted: null };
  const decrypted = decryptSecret(encrypted);
  if (!decrypted) return { valid: false, remainingEncrypted: null };

  const codes = decrypted
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  const cleanInput = input.trim().toUpperCase();
  const idx = codes.indexOf(cleanInput);

  if (idx === -1) return { valid: false, remainingEncrypted: encrypted };

  // 移除已使用的码
  codes.splice(idx, 1);
  const remainingEncrypted = codes.length > 0 ? encryptSecret(codes.join(",")) : null;
  return { valid: true, remainingEncrypted };
}
