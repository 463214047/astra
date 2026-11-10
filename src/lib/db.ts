import { Pool, type PoolConfig } from "pg";

const isDev = process.env.NODE_ENV !== "production";

// Supabase pooler 连接需要额外参数
const config: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Supabase pooler 使用 transaction 模式
  max: isDev ? 5 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// 单例 Pool
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL 环境变量未设置");
    }
    pool = new Pool(config);
    pool.on("error", (err: Error) => {
      console.error("[DB] 连接池错误:", err.message);
    });
  }
  return pool;
}

/** 执行 SQL 查询，返回 result.rows */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const client = getPool();
  const result = await client.query<T>(text, params);
  return result.rows;
}

/** 带事务的执行，传入回调函数内的所有查询会在同一事务中 */
export async function withTransaction<T>(
  fn: (
    q: <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>,
  ) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const runQuery = async <R = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<R[]> => {
      const r = await client.query<R>(sql, params);
      return r.rows;
    };
    const result = await fn(runQuery);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** 初始化 account_users 表（幂等，与 Supabase auth.users 隔离） */
export async function ensureSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS public.account_users (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email             TEXT NOT NULL UNIQUE,
      name              TEXT,
      avatar_url        TEXT,              -- 头像（自设 + OAuth 同步）
      signature         TEXT,              -- 个性签名
      password_hash     TEXT,            -- NULL 表示仅 OAuth 账号（GitHub 等）
      totp_secret       TEXT,           -- 已废弃，保留兼容
      totp_secret_enc   TEXT,           -- AES-256-GCM 加密后的 TOTP secret
      totp_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
      recovery_codes_enc TEXT,          -- 加密后的恢复码（逗号拼接）
      last_totp_used    TEXT,           -- 上次成功验证的 30 秒时间步 counter（防重放）
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS account_users_email_idx ON public.account_users (email);
    -- uid 短数字标识，公开个人主页用
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_users_uid_key') THEN
        ALTER TABLE public.account_users ADD CONSTRAINT account_users_uid_key UNIQUE (uid);
      END IF;
    END $$;

    -- 迁移：老用户的 totp_secret（明文）保持不动，新启用 2FA 的用户写到 totp_secret_enc
    DO $$
    BEGIN
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT;
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS recovery_codes_enc TEXT;
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS last_totp_used TEXT;
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS signature TEXT;
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS uid BIGSERIAL;
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
      -- uid 列创建后立即确保唯一（BIGSERIAL 自带 UNIQUE，但保险起见）
      -- 迁移后所有新注册用户自动分配 uid
      -- OAuth 账号没有 password_hash，允许 NULL
      ALTER TABLE public.account_users ALTER COLUMN password_hash DROP NOT NULL;

      -- 游戏：原神祈愿模拟器（魔力 + 保底 + 累计次数直接挂用户表，避免独立存档表的同步问题）
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS wish_magic  INTEGER NOT NULL DEFAULT 16000;
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS wish_pity5 INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS wish_pity4 INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS wish_total  INTEGER NOT NULL DEFAULT 0;

      -- 做种积分：先建字段，具体累计公式后续再定
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS seed_points INTEGER NOT NULL DEFAULT 0;

      -- 彩虹昵称：个人开关 + 普通用户的限时（角色用户永久可用）
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS rainbow_enabled    BOOLEAN;
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS rainbow_until      TIMESTAMPTZ;
      ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS rainbow_claimed_ts BIGINT NOT NULL DEFAULT 0;
    END $$;

    -- 彩虹昵称开关三态迁移：NULL = 跟随权限自动（角色用户默认开启），TRUE/FALSE = 个人显式选择
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'account_users'
           AND column_name = 'rainbow_enabled'
           AND is_nullable = 'NO'
      ) THEN
        ALTER TABLE public.account_users ALTER COLUMN rainbow_enabled DROP NOT NULL;
        ALTER TABLE public.account_users ALTER COLUMN rainbow_enabled DROP DEFAULT;
        UPDATE public.account_users SET rainbow_enabled = NULL;
      END IF;
    END $$;

    -- uid 从 1000001 开始按注册顺序自增（已有账号的 uid 保持不变）
    DO $$
    DECLARE
      seq_name TEXT;
      seq_last BIGINT;
      max_uid  BIGINT;
    BEGIN
      SELECT pg_get_serial_sequence('public.account_users', 'uid') INTO seq_name;
      IF seq_name IS NOT NULL THEN
        SELECT COALESCE(MAX(uid), 0) INTO max_uid FROM public.account_users;
        EXECUTE format('SELECT last_value FROM %s', seq_name) INTO seq_last;
        IF seq_last < GREATEST(1000000, max_uid) THEN
          PERFORM setval(seq_name, GREATEST(1000000, max_uid));
        END IF;
      END IF;
    END $$;

    -- 会话 + 消息系统（两用户间的 IM）
    CREATE TABLE IF NOT EXISTS public.conversations (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_a_email      TEXT NOT NULL,
      user_b_email      TEXT NOT NULL,
      last_message_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_a_email, user_b_email)
    );
    CREATE INDEX IF NOT EXISTS conversations_user_a_idx ON public.conversations (user_a_email);
    CREATE INDEX IF NOT EXISTS conversations_user_b_idx ON public.conversations (user_b_email);

    CREATE TABLE IF NOT EXISTS public.messages (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id   UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
      sender_email      TEXT NOT NULL,
      content           TEXT NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages (conversation_id, created_at);

    -- 每用户每对话一条已读记录（NULL = 还没读过）
    CREATE TABLE IF NOT EXISTS public.conversation_reads (
      conversation_id   UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
      user_email        TEXT NOT NULL,
      last_read_at      TIMESTAMPTZ,
      PRIMARY KEY (conversation_id, user_email)
    );

    -- OAuth / SSO 账号绑定（GitHub 等）
    CREATE TABLE IF NOT EXISTS public.oauth_accounts (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_email          TEXT NOT NULL REFERENCES public.account_users(email) ON DELETE CASCADE,
      provider            TEXT NOT NULL,               -- 'github' 等
      provider_account_id TEXT NOT NULL,               -- GitHub user id
      provider_name       TEXT,                        -- GitHub login
      provider_avatar     TEXT,                        -- GitHub avatar_url
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider, provider_account_id),          -- 同一个 GitHub 不能绑多个本地账号
      UNIQUE (user_email, provider)                    -- 同一个本地账号不能绑多个同 provider
    );

    -- 通知：系统通知 + 帖子/作品回复通知（独立于用户 IM 对话）
    CREATE TABLE IF NOT EXISTS public.notifications (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient_email TEXT NOT NULL REFERENCES account_users(email) ON DELETE CASCADE,
      type            TEXT NOT NULL CHECK (type IN ('system', 'reply')),
      title           TEXT NOT NULL,
      content         TEXT,
      source_type     TEXT,                          -- 'post' | 'work' | null
      source_id       TEXT,
      source_title    TEXT,
      reply_author    TEXT,
      reply_avatar    TEXT,
      is_read         BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient
      ON public.notifications(recipient_email, is_read, created_at DESC);

    -- 内容发布（游戏/动漫/漫画/影视 等帖子）
    CREATE TABLE IF NOT EXISTS public.posts (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      author_email      TEXT NOT NULL REFERENCES public.account_users(email) ON DELETE CASCADE,
      author_name       TEXT,               -- 冗余作者名（匿名时展示层读 anonymous 即可）
      anonymous         BOOLEAN NOT NULL DEFAULT FALSE,
      category          TEXT NOT NULL,      -- '游戏' | '漫画' | '动漫' | '电影' | '剧集'
      title             TEXT NOT NULL,
      subtitle          TEXT,
      content           TEXT,                -- 正文（介绍），选填
      external_link     TEXT,                -- 外部补充链接（选填）
      tags              TEXT[],
      cover_url         TEXT,
      screenshot_urls   TEXT[],
      torrent_name      TEXT,
      torrent_size      BIGINT,
      download_count    INTEGER NOT NULL DEFAULT 0,   -- 累计下载完成次数
      seed_count        INTEGER NOT NULL DEFAULT 0,   -- 当前做种人数
      leech_count       INTEGER NOT NULL DEFAULT 0,   -- 当前下载中人数
      hot               BOOLEAN NOT NULL DEFAULT FALSE,
      view_count        INTEGER NOT NULL DEFAULT 0,
      like_count        INTEGER NOT NULL DEFAULT 0,
      comment_count     INTEGER NOT NULL DEFAULT 0,
      status            TEXT NOT NULL DEFAULT 'published',  -- 'published' | 'hidden'
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS posts_category_idx ON public.posts(category, created_at DESC);
    CREATE INDEX IF NOT EXISTS posts_author_idx ON public.posts(author_email, created_at DESC);
    CREATE INDEX IF NOT EXISTS posts_status_idx ON public.posts(status, created_at DESC);

    -- 迁移：给已有 posts 表补可选列
    DO $$
    BEGIN
      ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS external_link TEXT;
      ALTER TABLE public.posts ALTER COLUMN content DROP NOT NULL;
      ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS seed_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS leech_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS mediainfo TEXT;
      ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS torrent_info_hash TEXT;
      ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS torrent_data TEXT;  -- .torrent 原始文件 base64
      -- forum 帖共用 posts 表，用 post_type 区分
      ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS favorite_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'torrent';
      ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_adult BOOLEAN NOT NULL DEFAULT FALSE;
      -- forum 帖用 category 存 tag（求助/分享/邀请/讨论/公告）
      CREATE INDEX IF NOT EXISTS posts_type_idx ON public.posts(post_type, category, created_at DESC);
    END $$;

    -- 帖子评论（支持回复）
    CREATE TABLE IF NOT EXISTS public.post_comments (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id         UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
      author_email    TEXT NOT NULL REFERENCES public.account_users(email) ON DELETE CASCADE,
      author_name     TEXT,
      author_avatar   TEXT,
      anonymous       BOOLEAN NOT NULL DEFAULT FALSE,
      parent_id       UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
      reply_to_email  TEXT,                    -- 回复时 @ 的那个用户
      content         TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS post_comments_post_idx
      ON public.post_comments(post_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS post_comments_parent_idx
      ON public.post_comments(parent_id);

    -- 帖子举报
    CREATE TABLE IF NOT EXISTS public.post_reports (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id         UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
      reporter_email  TEXT NOT NULL REFERENCES public.account_users(email) ON DELETE CASCADE,
      reason          TEXT NOT NULL,           -- 举报原因（自由输入）
      detail          TEXT,                    -- 补充说明
      status          TEXT NOT NULL DEFAULT 'pending',  -- pending | resolved | rejected
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (post_id, reporter_email)        -- 每人每帖只能举报一次
    );
    CREATE INDEX IF NOT EXISTS post_reports_post_idx
      ON public.post_reports(post_id);

    -- 邮箱验证码（注册 / 重置密码 等场景）
    CREATE TABLE IF NOT EXISTS public.email_verification_codes (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email        TEXT NOT NULL,
      code         TEXT NOT NULL,                 -- 6 位验证码
      purpose      TEXT NOT NULL CHECK (purpose IN ('register', 'reset_password')),
      used         BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at   TIMESTAMPTZ NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS evc_email_idx
      ON public.email_verification_codes(email, purpose, expires_at DESC);

    -- ====== PT Tracker ======

    -- 用户 Passkey（每个用户唯一）
    CREATE TABLE IF NOT EXISTS public.user_passkeys (
      user_email   TEXT PRIMARY KEY REFERENCES public.account_users(email) ON DELETE CASCADE,
      passkey      TEXT NOT NULL UNIQUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 种子白名单（只有站内发布的种子才能被 announce）
    CREATE TABLE IF NOT EXISTS public.torrent_whitelist (
      info_hash    TEXT PRIMARY KEY,                                    -- torrent info_hash (hex 40 chars)
      post_id      UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
      uploaded_by  TEXT NOT NULL REFERENCES public.account_users(email) ON DELETE CASCADE,
      added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 用户 × 种子 累计统计（上传/下载字节 + 当前状态）
    CREATE TABLE IF NOT EXISTS public.user_torrent_stats (
      user_email   TEXT NOT NULL REFERENCES public.account_users(email) ON DELETE CASCADE,
      info_hash    TEXT NOT NULL REFERENCES public.torrent_whitelist(info_hash) ON DELETE CASCADE,
      uploaded     BIGINT NOT NULL DEFAULT 0,                           -- 累计上传字节
      downloaded   BIGINT NOT NULL DEFAULT 0,                           -- 累计下载字节
      is_seeding   BOOLEAN NOT NULL DEFAULT FALSE,                      -- 当前是否做种
      is_leeching  BOOLEAN NOT NULL DEFAULT FALSE,                      -- 当前是否下载中
      last_announce TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      first_announce TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_email, info_hash)
    );

    CREATE INDEX IF NOT EXISTS uds_email_idx ON public.user_torrent_stats(user_email);
    CREATE INDEX IF NOT EXISTS uds_hash_idx  ON public.user_torrent_stats(info_hash);

    -- 帖子收藏
    CREATE TABLE IF NOT EXISTS public.post_favorites (
      user_email  TEXT NOT NULL REFERENCES public.account_users(email) ON DELETE CASCADE,
      post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_email, post_id)
    );
    CREATE INDEX IF NOT EXISTS pf_post_idx ON public.post_favorites(post_id);

    -- 游戏：原神祈愿模拟器存档
    CREATE TABLE IF NOT EXISTS public.game_wish_save (
      user_email  TEXT PRIMARY KEY REFERENCES public.account_users(email) ON DELETE CASCADE,
      fates       INTEGER NOT NULL DEFAULT 1000,
      magic       INTEGER NOT NULL DEFAULT 16000,
      pity5       INTEGER NOT NULL DEFAULT 0,
      pity4       INTEGER NOT NULL DEFAULT 0,
      total       INTEGER NOT NULL DEFAULT 0,
      history     JSONB NOT NULL DEFAULT '[]'::jsonb,
      rainbow_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE public.game_wish_save ADD COLUMN IF NOT EXISTS magic INTEGER NOT NULL DEFAULT 16000;
    ALTER TABLE public.game_wish_save ADD COLUMN IF NOT EXISTS rainbow_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

    -- 游戏：托尔（五星限定）持有数量
    ALTER TABLE public.account_users ADD COLUMN IF NOT EXISTS wish_tohru INTEGER NOT NULL DEFAULT 0;

    -- 游戏：玩家间奖品交易市场（挂单即扣留奖品，成交/撤单再转移/归还）
    CREATE TABLE IF NOT EXISTS public.game_market_listings (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_email  TEXT NOT NULL REFERENCES public.account_users(email) ON DELETE CASCADE,
      item_type     TEXT NOT NULL CHECK (item_type IN ('tohru', 'rainbow')),
      item_days     INTEGER,               -- 彩虹ID 天数（托尔为 NULL）
      price         INTEGER NOT NULL CHECK (price > 0),
      status        TEXT NOT NULL DEFAULT 'active',   -- active | sold | cancelled
      buyer_email   TEXT REFERENCES public.account_users(email) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sold_at       TIMESTAMPTZ
    );
    -- 挂单进度：总量、已售数量/天数、累计成交魔力
    ALTER TABLE public.game_market_listings
      ADD COLUMN IF NOT EXISTS total_days INTEGER;
    ALTER TABLE public.game_market_listings
      ADD COLUMN IF NOT EXISTS sold_days INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE public.game_market_listings
      ADD COLUMN IF NOT EXISTS earned INTEGER NOT NULL DEFAULT 0;
    -- 已收取的收益：成交后不再自动到账，卖家在「我的出售」手动收取
    ALTER TABLE public.game_market_listings
      ADD COLUMN IF NOT EXISTS paid INTEGER;
    UPDATE public.game_market_listings SET paid = earned WHERE paid IS NULL;
    CREATE INDEX IF NOT EXISTS game_market_status_idx
      ON public.game_market_listings (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS game_market_seller_idx
      ON public.game_market_listings (seller_email, created_at DESC);

    -- ====== 系统市场交易流水（用于动态定价） ======

    CREATE TABLE IF NOT EXISTS public.game_market_trades (
      id          BIGSERIAL PRIMARY KEY,
      user_email  TEXT NOT NULL,
      item_type   TEXT NOT NULL CHECK (item_type IN ('tohru', 'rainbow')),
      direction   TEXT NOT NULL CHECK (direction IN ('buy', 'sell')),
      units       INTEGER NOT NULL,
      unit_price  INTEGER NOT NULL,
      magic       INTEGER NOT NULL,          -- 本次交易涉及的魔力总额
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS game_market_trades_time_idx
      ON public.game_market_trades (created_at DESC);

    -- ====== TMDB 作品介绍缓存 ======

    -- 按「影视」维度持久缓存（movie/tv + id），引用同一部作品的所有种子复用
    CREATE TABLE IF NOT EXISTS public.tmdb_cache (
      media_type  TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
      tmdb_id     BIGINT NOT NULL,
      data        JSONB NOT NULL,               -- TmdbInfo 序列化
      fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (media_type, tmdb_id)
    );
  `);
}
