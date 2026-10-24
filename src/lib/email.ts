/**
 * 邮件发送模块
 *
 * 生产环境使用 Resend（需配置 RESEND_API_KEY + RESEND_FROM_EMAIL）
 * 开发环境（未配置 Resend）自动 fallback 到控制台输出验证码
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "no-reply@astrapt.kdns.fr";
const FROM_NAME = process.env.RESEND_FROM_NAME || "Astra PT";

export interface SendEmailResult {
  ok: boolean;
  method: "resend" | "fallback";
  messageId?: string;
  preview?: string; // fallback 时返回验证码方便开发调试
}

/** 发送纯文本/HTML 邮件 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<SendEmailResult> {
  const { to, subject, text, html } = params;

  // ---- Resend 路径 ----
  if (RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [to],
          subject,
          text,
          html,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        return { ok: true, method: "resend", messageId: data.id };
      }

      console.warn("[email] Resend 发送失败:", data);
      // Resend 失败不 fatal — 降级到 fallback
    } catch (err) {
      console.warn("[email] Resend 请求异常:", err);
    }
  }

  // ---- Fallback：控制台打印 + 返回 preview ----
  const preview = text?.substring(0, 200) || "(无文本内容)";
  console.log("\n========== [DEV] 邮件发送 (fallback) ==========");
  console.log(`收件人: ${to}`);
  console.log(`主题:   ${subject}`);
  console.log(`正文预览: ${preview}`);
  console.log("================================================\n");

  return { ok: true, method: "fallback", preview };
}

/** 发送注册验证码（便捷方法） */
export async function sendRegisterCode(email: string, code: string): Promise<SendEmailResult> {
  const subject = "你的 Astra PT 注册验证码";
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 420px; margin: 40px auto;">
      <h2 style="color: #0b1220; margin-bottom: 8px;">Astra PT 注册验证码</h2>
      <p style="color: #64748b; margin-bottom: 20px;">你正在注册 Astra PT 账号，请使用以下验证码完成注册：</p>
      <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2563eb;">
        ${code}
      </div>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 20px;">
        验证码 10 分钟内有效，请勿泄露给他人。
      </p>
    </div>
  `;
  const text = `【Astra PT】你的注册验证码是 ${code}，10 分钟内有效，请勿泄露。`;

  return sendEmail({ to: email, subject, html, text });
}

/** 发送重置密码验证码 */
export async function sendResetCode(email: string, code: string): Promise<SendEmailResult> {
  const subject = "Astra PT 密码重置验证码";
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 420px; margin: 40px auto;">
      <h2 style="color: #0b1220; margin-bottom: 8px;">Astra PT 密码重置</h2>
      <p style="color: #64748b; margin-bottom: 20px;">你正在重置 Astra PT 账号密码，请使用以下验证码完成重置：</p>
      <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2563eb;">
        ${code}
      </div>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 20px;">
        验证码 10 分钟内有效。如非本人操作，请忽略此邮件。
      </p>
    </div>
  `;
  const text = `【Astra PT】你的密码重置验证码是 ${code}，10 分钟内有效，请勿泄露。如非本人操作请忽略。`;

  return sendEmail({ to: email, subject, html, text });
}
