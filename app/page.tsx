import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DemoApp from "./DemoApp";

export const metadata: Metadata = {
  title: "Jaune — Your life, in focus.",
  description:
    "Jaune is the AI operating system for ambitious people — learns your rhythm, tells you what matters today, and turns intention into compounding progress.",
  openGraph: {
    title: "Jaune — Your life, in focus.",
    description: "An AI that learns your rhythm and tells you what matters today.",
  },
};

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_code?: string }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/home");

  const params = await searchParams;
  if (params.error) {
    const isExpired = params.error_code === 'otp_expired';
    redirect(isExpired
      ? '/login?error=link_expired'
      : '/login?error=link_invalid'
    );
  }

  return <DemoApp />;
}
