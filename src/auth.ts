import NextAuth, { CredentialsSignin } from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { query, ensureSchema } from "@/lib/db";
import { ensureUserPasskey } from "@/lib/passkey";
import { verifyPassword } from "@/lib/password";
import { AUTH_CODES } from "@/lib/auth-codes";
import { verifyCode, decryptSecret } from "@/lib/totp";

// 惰性初始化 schema（避免在构建/编译时连接数据库）
let schemaEnsured = false;
async function ensureSchemaLazy() {
  if (schemaEnsured) return;
  try {
    await ensureSchema();
    schemaEnsured = true;
  } catch (err) {
    console.error("[auth] 初始化 account_users 表失败:", (err as Error).message);
    throw new CredentialsSignin();
  }
}

export const { handlers, auth } = NextAuth({
  providers: [
    GitHub({
      // 必须请求 email scope — 否则 GitHub 不返回用户邮箱
      authorization: { params: { scope: ["read:user", "user:email"] } },
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
        totp: { label: "TOTP", type: "text" },
        remember: { label: "记住我", type: "text" },
      },
      async authorize(credentials) {
        const creds = credentials as Record<string, string> | undefined;

        // 确保表存在
        await ensureSchemaLazy();

        // 输入基础校验
        if (!creds?.email || !creds?.password) {
          throw Object.assign(new CredentialsSignin(), { code: AUTH_CODES.INVALID_CREDENTIALS });
        }

        const email = String(creds.email).trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw Object.assign(new CredentialsSignin(), { code: AUTH_CODES.EMAIL_FORMAT });
        }

        // 查库（同时取回 TOTP 相关字段 + 个人资料）
        const rows = await query<{
          id: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          signature: string | null;
          password_hash: string | null; // OAuth-only 账号为 NULL
          totp_secret_enc: string | null;
          totp_enabled: boolean;
          recovery_codes_enc: string | null;
          last_totp_used: string | null;
        }>(
          `SELECT id, email, name, avatar_url, signature, password_hash,
                  totp_secret_enc, totp_enabled, recovery_codes_enc, last_totp_used
             FROM public.account_users WHERE email = $1 LIMIT 1`,
          [email],
        );

        if (rows.length === 0) {
          // 统一返回无效凭据，防止枚举攻击
          throw Object.assign(new CredentialsSignin(), { code: AUTH_CODES.INVALID_CREDENTIALS });
        }

        const user = rows[0];

        // OAuth-only 账号没有密码哈希 — credentials 登录必然失败
        if (!user.password_hash) {
          throw Object.assign(new CredentialsSignin(), { code: AUTH_CODES.INVALID_CREDENTIALS });
        }

        // 验证密码
        const valid = await verifyPassword(creds.password, user.password_hash);
        if (!valid) {
          throw Object.assign(new CredentialsSignin(), { code: AUTH_CODES.INVALID_CREDENTIALS });
        }

        // ---- TOTP 二次验证 ----
        if (user.totp_enabled && user.totp_secret_enc) {
          // 用户已启用 TOTP 但本次未携带 totp 参数
          if (!creds.totp) {
            throw Object.assign(new CredentialsSignin(), { code: AUTH_CODES.TOTP_REQUIRED });
          }

          const totpInput = creds.totp.trim();
          const secret = decryptSecret(user.totp_secret_enc);
          if (!secret) {
            // 密文无法解密（密钥变更）→ 临时关闭 2FA，允许登录
            console.error("[auth] TOTP secret 解密失败，临时绕过二次验证");
          } else {
            const offset = verifyCode(secret, totpInput);
            if (offset === null) {
              throw Object.assign(new CredentialsSignin(), { code: AUTH_CODES.TOTP_INVALID });
            }
            // 验证成功 —— 写入 last_totp_used 防重放
            await query(
              `UPDATE public.account_users SET last_totp_used = $1, updated_at = NOW() WHERE id = $2`,
              [String(Math.floor(Date.now() / 1000 / 30)), user.id],
            );
          }
        }

        // 通过验证，返回 user 对象（会写入 session）
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.avatar_url ?? undefined,
          signature: user.signature ?? undefined,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24, // 1 天默认
  },
  callbacks: {
    /**
     * OAuth 绑定 / 自动创建 — GitHub 回跳时触发
     *
     * 场景 1：首次用 GitHub 登录 → account_users 自动创建（password_hash=NULL）+ 绑定 oauth_accounts
     * 场景 2：已有 credentials 账号（同 email）→ 自动关联 oauth_accounts（支持后续 GitHub 快捷登录）
     */
    async signIn({ user, account, profile }) {
      if (account?.provider === "github") {
        await ensureSchemaLazy();

        // 多源 fallback 拿 email（GitHub profile.email 可能为 null）
        const ghEmail =
          (profile as { email?: string } | undefined)?.email?.toLowerCase() ||
          (user as { email?: string } | undefined)?.email?.toLowerCase() ||
          (account as unknown as { email?: string } | undefined)?.email?.toLowerCase() ||
          `${(profile as { login?: string } | undefined)?.login ?? "user"}@users.noreply.github.com`;
        const ghId = account.providerAccountId;
        const ghLogin = (profile as { login?: string } | undefined)?.login;
        const ghAvatar = (profile as { avatar_url?: string } | undefined)?.avatar_url;
        const ghName =
          (profile as { name?: string } | undefined)?.name ?? ghLogin ?? ghEmail.split("@")[0];

        console.log("[auth] GitHub signIn callback", { ghEmail, ghId, ghLogin });

        try {
          // 1. 查本地有没有同 email 账号
          const existing = await query<{ email: string }>(
            `SELECT email FROM public.account_users WHERE email = $1 LIMIT 1`,
            [ghEmail],
          );

          if (existing.length === 0) {
            // 新建本地账号（password_hash = NULL，表示只能通过 GitHub 登录）
            await query(
              `INSERT INTO public.account_users (email, name, avatar_url)
               VALUES ($1, $2, $3)`,
              [ghEmail, ghName, ghAvatar ?? null],
            );
          } else {
            // 已存在 → 用 GitHub 的头像/昵称更新一下（如果本地还没设）
            await query(
              `UPDATE public.account_users
                  SET name = COALESCE(NULLIF(name, ''), $2),
                      avatar_url = COALESCE(avatar_url, $3)
                WHERE email = $1`,
              [ghEmail, ghName, ghAvatar ?? null],
            );
          }

          // 2. upsert 绑定关系（支持多次绑定/解绑后重绑）
          await query(
            `INSERT INTO public.oauth_accounts
                (user_email, provider, provider_account_id, provider_name, provider_avatar)
             VALUES ($1, 'github', $2, $3, $4)
             ON CONFLICT (provider, provider_account_id)
             DO UPDATE SET
               user_email = EXCLUDED.user_email,
               provider_name = EXCLUDED.provider_name,
               provider_avatar = EXCLUDED.provider_avatar`,
            [ghEmail, ghId, ghLogin ?? ghEmail, ghAvatar ?? null],
          );

          // 把 user 对象补齐（让 jwt callback 拿到完整字段）
          user.email = ghEmail;
          user.name = ghName;
          (user as { image?: string }).image = ghAvatar ?? undefined;
        } catch (e) {
          console.error("[auth] GitHub signIn 绑定失败:", e instanceof Error ? e.message : e);
          // 绑定失败不影响登录本身 — 静默返回 true，用户之后可在设置里手动绑定
        }
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
        token.image = (user as { image?: string }).image ?? token.image;
        token.signature = (user as { signature?: string }).signature ?? token.signature;

        // 自动确保 passkey 存在（首次登录生成）
        if (user.email) {
          ensureUserPasskey(user.email).catch(() => {
            /* 后台异步，不阻塞登录 */
          });
        }

        // remember me 控制 session 过期
        if (
          account?.provider === "credentials" &&
          (account as unknown as { remember?: string }).remember === "true"
        ) {
          token.maxAge = 60 * 60 * 24 * 7; // 7 天
        } else {
          token.maxAge = 60 * 60 * 24;
        }
      } else {
        // 每次 token 被读取时，也从 DB 同步最新资料（确保头像/昵称/签名实时）
        try {
          const rows = await query<{
            name: string | null;
            avatar_url: string | null;
            signature: string | null;
          }>(
            `SELECT name, avatar_url, signature FROM public.account_users WHERE email = $1 LIMIT 1`,
            [token.email],
          );
          if (rows[0]) {
            token.name = rows[0].name ?? token.name;
            token.image = rows[0].avatar_url ?? token.image;
            token.signature = rows[0].signature ?? token.signature;
          }
        } catch {
          // DB 查询失败就跳过，token 保持原值
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.email = (token.email as string) ?? session.user.email;
        // name / image / signature 已经在 jwt 回调里同步过 DB 最新值
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.image = (token.image as string | undefined) ?? undefined;
        (session.user as { signature?: string }).signature =
          (token.signature as string | undefined) ?? undefined;
      }
      return session;
    },
  },
});
