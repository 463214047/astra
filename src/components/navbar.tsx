import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";
import NavbarInner from "./navbar-inner";

export default async function Navbar() {
  const session = await auth();
  const user = session?.user;

  let unreadTotal = 0;
  let myUid: number | null = null;
  let userImage: string | null = user?.image ?? null;
  const userName: string | null = user?.name ?? null;
  if (user?.email) {
    try {
      await ensureSchema();

      const uidRows = await query<{ uid: number; avatar_url: string | null }>(
        `SELECT uid, avatar_url FROM public.account_users WHERE email = $1 LIMIT 1`,
        [user.email],
      );
      myUid = uidRows[0]?.uid ?? null;
      // DB 里的头像优先于 OAuth user.image
      if (uidRows[0]?.avatar_url) userImage = uidRows[0].avatar_url;

      const convRows = await query<{ unread: string }>(
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
        [user.email],
      );
      const convUnread = parseInt(convRows[0]?.unread ?? "0", 10);

      const notifRows = await query<{ unread: string }>(
        `SELECT COUNT(*)::text AS unread
           FROM public.notifications
          WHERE recipient_email = $1 AND is_read = FALSE`,
        [user.email],
      );
      const notifUnread = parseInt(notifRows[0]?.unread ?? "0", 10);

      unreadTotal = convUnread + notifUnread;
    } catch {
      unreadTotal = 0;
    }
  }

  return (
    <NavbarInner
      loggedIn={!!user}
      userImage={userImage}
      userName={userName}
      myUid={myUid}
      unreadTotal={unreadTotal}
    />
  );
}
