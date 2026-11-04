import type { Metadata, Viewport } from "next";
import { canReadFinance, canWriteProject } from "@/shared/permissions";
import { cookies } from "next/headers";
import { Shell } from "@/shared/ui/shell";
import { getContext } from "@/shared/auth/context";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "ESTUDIO OS", template: "%s · ESTUDIO OS" },
  description: "El espacio de trabajo de Alejandro Barajas Arquitectura",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getContext();
  const dark = (await cookies()).get("studio-theme")?.value === "dark";
  return (
    <html lang="es" data-theme={dark ? "dark" : "light"}>
      <body>
        <Shell
          darkTheme={dark}
          compactMenu={
            (await cookies()).get("studio-menu-compact")?.value === "1"
          }
          writable={!!ctx?.membership && canWriteProject(ctx.membership.role)}
          finance={!!ctx?.membership && canReadFinance(ctx.membership.role)}
          organization={ctx?.organization?.name}
          email={ctx?.user.email}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
