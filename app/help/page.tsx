import type { Metadata } from "next";
import HelpCenter from "@/components/help/help-center";

export const metadata: Metadata = { title: "Help Center", description: "คู่มือการใช้งานและ Workflow ของ MA Next" };
export default function HelpCenterPage() { return <HelpCenter />; }
