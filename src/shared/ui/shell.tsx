"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Home,
  BriefcaseBusiness,
  Layers3,
  Wallet,
  BookOpen,
  Settings2,
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
export function Shell({
  children,
  organization,
  email,
}: {
  children: React.ReactNode;
  organization?: string;
  email?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
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
  const current = navigation.find((n) =>
    n.href === "/" ? pathname === "/" : pathname.startsWith(n.href),
  );
  return (
    <div className="workspace">
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
            src="/marca/isotipo.png"
            alt="Alejandro Torres Arquitectura"
            width={38}
            height={38}
          />
          <span>
            ESTUDIO OS<small>Espacio de trabajo</small>
          </span>
        </Link>
        <div className="sidebar-caption">ESTUDIO</div>
        <nav aria-label="Navegación principal">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
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
        <div className="sidebar-note">
          <span className="status-dot" />
          Un estudio. Una visión.
          <p>
            Arquitectura y visualización,
            <br />
            conectadas en un solo lugar.
          </p>
        </div>
        <div className="sidebar-bottom">
          <Link
            href="/configuracion"
            className="nav-link"
            onClick={() => setOpen(false)}
          >
            <Settings2 size={18} />
            Configuración
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
          <div className="breadcrumb">
            <span>Mi estudio</span>
            <span>/</span>
            <strong>
              {current?.label ||
                (pathname === "/acceso" ? "Acceso" : "Configuración")}
            </strong>
          </div>
          <Link className="topbar-link" href="/comercial">
            Ir a Comercial
            <ArrowUpRight size={15} />
          </Link>
        </header>
        <main id="contenido" tabIndex={-1}>
          {children}
        </main>
        <footer className="page-footer">
          <span>ESTUDIO OS · Alejandro Torres Arquitectura</span>
          <span>Hecho para dar espacio a lo importante.</span>
        </footer>
      </div>
    </div>
  );
}
