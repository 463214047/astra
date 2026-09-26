import type { Metadata } from "next";
import Navbar from "@/components/navbar";

export const metadata: Metadata = {
  title: "首页",
  description: "Ayaka 首页",
};

export default async function HomePage() {
  return (
   <Navbar />
  );
}
