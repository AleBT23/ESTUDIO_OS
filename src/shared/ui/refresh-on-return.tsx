"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function RefreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    let last = 0;
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - last > 5000 &&
        !document.querySelector('form[data-dirty="true"]')
      ) {
        last = Date.now();
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [router]);
  return null;
}
