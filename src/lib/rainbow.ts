/** 彩虹昵称：这些角色永久可用，普通用户靠彩虹ID奖品限时使用 */
export const RAINBOW_ROLES = new Set(["admin", "staff", "vip"]);

export type RainbowState = {
  role?: string | null;
  rainbow_enabled?: boolean | null;
  rainbow_until?: string | Date | null;
};

/** 是否拥有彩虹昵称权限（角色永久 / 普通用户限时） */
export function hasRainbowAccess(u: RainbowState, now = Date.now()): boolean {
  if (u.role && RAINBOW_ROLES.has(u.role)) return true;
  if (!u.rainbow_until) return false;
  const t =
    u.rainbow_until instanceof Date
      ? u.rainbow_until.getTime()
      : new Date(u.rainbow_until).getTime();
  return Number.isFinite(t) && t > now;
}

/** 当前昵称是否显示彩虹效果（有权限且未主动关闭；NULL 表示跟随权限自动） */
export function isRainbowName(u: RainbowState, now = Date.now()): boolean {
  const enabled = u.rainbow_enabled == null ? true : u.rainbow_enabled;
  return enabled && hasRainbowAccess(u, now);
}
