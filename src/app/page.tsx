import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "首页",
  description: "Ayaka 首页",
};

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { user } = session;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center gap-4">
        {user?.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "用户头像"}
            width={56}
            height={56}
            className="size-14 rounded-full border border-slate-200 object-cover"
          />
        ) : (
          <div className="grid size-14 place-items-center rounded-full bg-slate-100 text-lg font-semibold text-slate-500">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
        )}

        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {user?.name ?? "用户"}
          </h1>
          <p className="text-sm text-slate-500">{user?.email}</p>
        </div>
      </div>

      <div className="mt-10">
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="outline">
            退出登录
          </Button>
        </form>
      </div>
    </main>
  );
}