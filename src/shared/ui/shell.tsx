"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  HardHat,
  CalendarDays,
  Home,
  BriefcaseBusiness,
  Layers3,
  Wallet,
  BookOpen,
  Settings2,
  Search,
  Sun,
  Moon,
  ArrowUpRight,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { signOut } from "@/shared/auth/actions";
import { RefreshOnReturn } from "./refresh-on-return";
const navigation = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/comercial", label: "Comercial", icon: BriefcaseBusiness },
  { href: "/proyectos", label: "Proyectos y producción", icon: Layers3 },
  { href: "/administracion", label: "Administración", icon: Wallet },
  { href: "/recursos", label: "Recursos del estudio", icon: BookOpen },
];
function routeLabel(segment = "") {
  const labels: Record<string, string> = {
    configuracion: "Configuración",
    buscar: "Búsqueda",
    catalogo: "Catálogo",
    notificaciones: "Notificaciones",
    pipeline: "Oportunidades",
    nueva: "Nueva cotización",
    nuevo: "Nuevo registro",
    presets: "Presets",
  };
  return labels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}
export function Shell({
  children,
  organization,
  email,
  compactMenu,
  darkTheme,
  writable,
  finance,
}: {
  children: React.ReactNode;
  organization?: string;
  email?: string;
  darkTheme?: boolean;
  compactMenu?: boolean;
  writable?: boolean;
  finance?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(!!compactMenu);
  const [dark, setDark] = useState(!!darkTheme);
  const searchLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k" &&
        searchLink.current
      ) {
        event.preventDefault();
        searchLink.current.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const button = menuButton.current;
    document.body.style.overflow = "hidden";
    const links = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a,button:not(:disabled)",
        ) || [],
      );
    links()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const items = links();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
      button?.focus();
    };
  }, [open]);
  if (pathname === "/portal")
    return (
      <main className="portal-main" id="contenido">
        {children}
      </main>
    );
  const parts = pathname.split("/").filter(Boolean);
  const area =
    navigation.find((n) => n.href === "/" + (parts[0] ?? ""))?.label ??
    routeLabel(parts[0]);
  const last = parts.at(-1) ?? "";
  const section = /^[a-f\d-]{36}$/i.test(last)
    ? ({
        tiempo: "Registro de tiempo",
        partidas: "Partida de obra",
        comprobantes: "Comprobante",
        cotizaciones: "Cotización",
        proveedores: "Proveedor",
        operaciones: "Operación",
        clientes: "Cliente",
        proyectos: "Expediente",
      }[parts.at(-2) ?? ""] ?? "Detalle")
    : routeLabel(last);
  return (
    <div className={compact ? "workspace compact-menu" : "workspace"}>
      <RefreshOnReturn />
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <aside
        ref={sidebar}
        id="studio-menu"
        className={`sidebar ${open ? "is-open" : ""}`}
      >
        <Link href="/" className="studio-brand" onClick={() => setOpen(false)}>
          <Image
            src="/marca/logo-ab.png"
            alt="Alejandro Barajas Arquitectura"
            width={90}
            height={30}
          />
          <span>
            ESTUDIO OS<small>Espacio de trabajo</small>
          </span>
        </Link>
        <div className="sidebar-caption">ESTUDIO</div>
        <nav aria-label="Navegación principal">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              title={label}
              aria-label={label}
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`nav-link ${(href === "/" ? pathname === "/" : pathname.startsWith(href)) ? "active" : ""}`}
              aria-current={
                (href === "/" ? pathname === "/" : pathname.startsWith(href))
                  ? "page"
                  : undefined
              }
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        {organization && (
          <nav aria-label="Herramientas del estudio" className="area-shortcuts">
            {writable && (
              <Link
                href="/#crear"
                title="Crear registro"
                aria-label="Crear registro"
                className="nav-link"
                onClick={() => setOpen(false)}
              >
                <Plus size={18} />
                <span>Crear registro</span>
              </Link>
            )}
            <Link
              href="/agenda"
              title="Agenda"
              aria-label="Agenda"
              className="nav-link"
              onClick={() => setOpen(false)}
            >
              <CalendarDays size={18} />
              <span>Agenda</span>
            </Link>
            {finance && (
              <Link
                href="/obras"
                aria-label="Obras"
                title="Obras"
                className="nav-link"
                onClick={() => setOpen(false)}
              >
                <HardHat size={18} />
                <span>Obras</span>
              </Link>
            )}
            {finance && (
              <Link
                href="/administracion/operaciones"
                title="Operaciones financieras"
                aria-label="Operaciones financieras"
                className="nav-link"
                onClick={() => setOpen(false)}
              >
                <Wallet size={18} />
                <span>Operaciones financieras</span>
              </Link>
            )}
          </nav>
        )}
        <div className="sidebar-bottom">
          <Link
            aria-label="Configuración"
            title="Configuración"
            href="/configuracion"
            className="nav-link"
            onClick={() => setOpen(false)}
          >
            <Settings2 size={18} />
            <span>Configuración</span>
          </Link>
          <div className="profile">
            <span className="avatar">AT</span>
            <span className="profile-text">
              {organization || "Tu estudio"}
              <small>{email || "Configuración inicial"}</small>
            </span>
            {email && (
              <form action={signOut}>
                <button className="icon-button" aria-label="Cerrar sesión">
                  <LogOut size={17} />
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="mobile-overlay"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        />
      )}
      <div className="main-wrap">
        <header className="topbar">
          <button
            ref={menuButton}
            className="icon-button menu-toggle"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="studio-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
          <button
            type="button"
            className="icon-button compact-toggle"
            aria-label={
              compact ? "Expandir barra lateral" : "Contraer barra lateral"
            }
            aria-expanded={!compact}
            aria-controls="studio-menu"
            onClick={() => {
              setCompact(!compact);
              document.cookie =
                "studio-menu-compact=" +
                (compact ? "0" : "1") +
                "; Path=/; SameSite=Lax; Max-Age=31536000";
            }}
          >
            <Menu size={18} />
          </button>
          <nav aria-label="Ubicación actual" className="breadcrumb">
            <Link href="/">Mi estudio</Link>
            <span aria-hidden="true">/</span>
            {parts.length > 1 && (
              <>
                <Link href={"/" + parts[0]}>{area}</Link>
                <span aria-hidden="true">/</span>
              </>
            )}
            <strong aria-current="page">
              {parts.length > 1 ? section : area}
            </strong>
          </nav>
          <button
            className="icon-button"
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
            onClick={() => {
              const theme = dark ? "light" : "dark";
              document.documentElement.dataset.theme = theme;
              document.cookie =
                "studio-theme=" +
                theme +
                "; Path=/; SameSite=Lax; Max-Age=31536000";
              setDark(!dark);
            }}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {organization ? (
            <Link
              href="/buscar"
              ref={searchLink}
              className="icon-button"
              aria-label="Buscar en el estudio"
              title="Buscar (Ctrl/⌘ K)"
            >
              <Search size={18} />
            </Link>
          ) : (
            <Link className="topbar-link" href="/comercial">
              Ir a Comercial
              <ArrowUpRight size={15} />
            </Link>
          )}
        </header>
        <main id="contenido" tabIndex={-1}>
          {children}
        </main>
        <footer className="page-footer">
          <span>ESTUDIO OS · Alejandro Barajas Arquitectura</span>
          <span>Hecho para dar espacio a lo importante.</span>
        </footer>
      </div>
    </div>
  );
}
