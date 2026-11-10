import type { Metadata } from "next";
import RulesClient from "./RulesClient";

export const metadata: Metadata = {
  title: "规则",
};

export default function RulesPage() {
  return <RulesClient />;
}
