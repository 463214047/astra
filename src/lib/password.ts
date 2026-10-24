import { scrypt as scryptCb, randomBytes, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

const SALT_LEN = 16;
const KEY_LEN = 64;
// scrypt 参数：N=2^14, r=8, p=1 — 在安全和性能之间取平衡（2^15 在某些机器上内存超限）
const COST = 14;
const BLOCK_SIZE = 8;
const PARALLEL = 1;

/**
 * 使用 Node 内置 scrypt 生成密码哈希（零外部依赖，安全等级与 bcrypt 相当）
 * 输出格式：`scrypt$N$r$p$saltBase64$hashBase64`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derivedKey = await scryptAsync(password, salt, KEY_LEN, {
    cost: 2 ** COST,
    blockSize: BLOCK_SIZE,
    parallelization: PARALLEL,
  });

  const saltB64 = salt.toString("base64");
  const hashB64 = derivedKey.toString("base64");
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLEL}$${saltB64}$${hashB64}`;
}

/** 验证密码是否匹配哈希 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    throw new Error("无效的密码哈希格式");
  }

  const cost = parseInt(parts[1], 10);
  const blockSize = parseInt(parts[2], 10);
  const parallel = parseInt(parts[3], 10);
  const salt = Buffer.from(parts[4], "base64");
  const expectedHash = Buffer.from(parts[5], "base64");

  const derivedKey = await scryptAsync(password, salt, expectedHash.length, {
    cost: 2 ** cost,
    blockSize,
    parallelization: parallel,
  });

  return timingSafeEqual(derivedKey, expectedHash);
}
