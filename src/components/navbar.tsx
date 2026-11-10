import { auth } from "@/auth";
import { query, ensureSchema } from "@/lib/db";
import { getUnreadTotal } from "@/lib/unread";
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

      unreadTotal = await getUnreadTotal(user.email);
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
