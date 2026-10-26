"use client";
import { createBrowserClient } from "@supabase/ssr";

export function browserDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Configura la conexión al estudio.");
  return createBrowserClient(url, key);
}
