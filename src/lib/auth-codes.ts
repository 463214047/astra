/**
 * 认证相关错误码定义（auth.ts 和前端 LoginForm/RegisterForm 共享）
 *
 * NextAuth CredentialsSignin 通过 `code` 属性把业务错误码传递到前端，
 * 前端根据 code 映射为用户友好的中文消息。
 *
 * ⚠ 安全提示：
 * - INVALID_CREDENTIALS 是登录时的通用错误，避免暴露「邮箱是否注册」
 * - EMAIL_FORMAT 属于格式校验，发生在查库之前，不构成枚举风险
 */

export const AUTH_CODES = {
  /** 邮箱或密码错误（通用登录失败，不暴露具体原因） */
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  /** 邮箱格式不正确 */
  EMAIL_FORMAT: "EMAIL_FORMAT",
  /** 需要 TOTP 二次验证 */
  TOTP_REQUIRED: "TOTP_REQUIRED",
  /** TOTP 验证失败 */
  TOTP_INVALID: "TOTP_INVALID",
  /** 服务器内部错误 */
  SERVER_ERROR: "SERVER_ERROR",
} as const;

export type AuthCode = (typeof AUTH_CODES)[keyof typeof AUTH_CODES];

/**
 * 错误码 → 用户友好中文消息
 * 前端登录/注册页面复用
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  [AUTH_CODES.INVALID_CREDENTIALS]: "邮箱或密码错误",
  [AUTH_CODES.EMAIL_FORMAT]: "邮箱格式不正确",
  [AUTH_CODES.TOTP_REQUIRED]: "需要二次验证",
  [AUTH_CODES.TOTP_INVALID]: "验证码错误，请重新输入",
  [AUTH_CODES.SERVER_ERROR]: "服务器内部错误，请稍后重试",
};

/** 未识别的 NextAuth 错误类型 → 中文通用消息 */
export const NEXTAUTH_ERROR_FALLBACK: Record<string, string> = {
  Configuration: "服务器配置有误，请联系管理员",
  MissingCSRF: "安全校验失败，请刷新页面重试",
  AccessDenied: "访问被拒绝",
  Verification: "验证链接已过期或无效",
  OAuthSignInError: "第三方登录失败",
  OAuthCallbackError: "第三方登录回调错误",
  OAuthAccountNotLinked: "账号未关联",
  SignOutError: "退出登录失败",
};
