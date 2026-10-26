import type { Metadata, Viewport } from "next";
import { Shell } from "@/shared/ui/shell";
import { getContext } from "@/shared/auth/context";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "ESTUDIO OS", template: "%s · ESTUDIO OS" },
  description: "El espacio de trabajo de Alejandro Torres Arquitectura",
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
  return (
    <html lang="es">
      <body>
        <Shell organization={ctx?.organization?.name} email={ctx?.user.email}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
