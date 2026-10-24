import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }
  return <>{children}</>;
}
