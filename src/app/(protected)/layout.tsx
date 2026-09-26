import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/navbar";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <body>
      <Navbar />
      {children}
    </body>
  );
}
