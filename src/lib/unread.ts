import { query } from "@/lib/db";

/** 当前用户的总未读数：私信未读 + 通知未读 */
export async function getUnreadTotal(email: string): Promise<number> {
  const [convRows, notifRows] = await Promise.all([
    query<{ unread: string }>(
      `SELECT COALESCE(SUM(
          CASE
            WHEN cr.last_read_at IS NULL THEN 1
            WHEN m.created_at > cr.last_read_at THEN 1
            ELSE 0
          END
        )::text, '0') AS unread
         FROM public.messages m
         JOIN public.conversations c ON c.id = m.conversation_id
         LEFT JOIN public.conversation_reads cr
           ON cr.conversation_id = c.id AND cr.user_email = $1
        WHERE (c.user_a_email = $1 OR c.user_b_email = $1)
          AND m.sender_email != $1
          AND m.content NOT LIKE '[举报违规]%'`,
      [email],
    ),
    query<{ unread: string }>(
      `SELECT COUNT(*)::text AS unread
         FROM public.notifications
        WHERE recipient_email = $1 AND is_read = FALSE`,
      [email],
    ),
  ]);

  return parseInt(convRows[0]?.unread ?? "0", 10) + parseInt(notifRows[0]?.unread ?? "0", 10);
}
