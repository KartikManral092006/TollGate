import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CallLab } from "@/features/nexconn/dev/call-lab";
import { devRoutesEnabled } from "@/features/nexconn/server";

export const instant = false;

export const metadata: Metadata = {
  title: "Nexconn lab (T6)",
  robots: { index: false, follow: false },
};

export default async function NexconnLabPage() {
  await connection();
  if (!devRoutesEnabled()) notFound();
  return <CallLab />;
}
