"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileSpreadsheet, LayoutDashboard, LogOut, Menu, Wheat, X } from "lucide-react";

import { logout } from "@/app/(main)/_actions/logout";
import { cn } from "@/lib/utils";

const APP_NAME = "Comercial Manager";

const NAV = [
  { label: "Panel", href: "/", icon: LayoutDashboard },
  // Direct entry: no hub in between.
  {
    label: "Inventario Maíz",
    href: "/reportes/cierre/inventario-maiz",
    icon: Wheat,
  },
  {
    label: "Maíz por Cierre",
    href: "/reporte-maiz",
    icon: FileSpreadsheet,
  },
  {
    label: "Kardex de Venta",
    href: "/ventas/operaciones/kardex-venta",
    icon: ClipboardList,
  },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-1">
      {NAV.map(({ label, href, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-label flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2 transition-colors",
              active
                ? "bg-accent text-fg-strong font-semibold"
                : "text-fg-soft hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  onNavigate,
  userName,
  userLocal,
}: {
  onNavigate?: () => void;
  userName: string;
  userLocal?: string | null;
}) {
  return (
    <div className="flex h-full flex-col gap-6 p-3">
      <div className="px-2 pt-1">
        <p className="text-h3 text-fg-strong">{APP_NAME}</p>
        <p className="text-caption text-fg-faint">Administración</p>
      </div>

      <div className="flex-1">
        <NavList onNavigate={onNavigate} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="border-border border-t px-2 pt-3">
          <p className="text-label text-foreground truncate">{userName}</p>
          {userLocal ? (
            <p className="text-caption text-fg-faint truncate">{userLocal}</p>
          ) : null}
        </div>
        <form action={logout}>
          <button
            type="submit"
            className={cn(
              "text-label text-fg-soft hover:bg-accent/60 hover:text-foreground flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 py-2",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            )}
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            Salir
          </button>
        </form>
      </div>
    </div>
  );
}

export function Sidebar({
  userName,
  userLocal,
}: {
  userName: string;
  userLocal?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on navigation and on Escape; lock body scroll while open.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Mobile: a 3rem bar, so page content can rely on a known header height. */}
      <header className="border-border bg-card flex h-12 shrink-0 items-center gap-2 border-b px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={open}
          className="text-fg-soft hover:text-foreground focus-visible:ring-ring -ml-1 inline-flex size-9 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <p className="text-h3 text-fg-strong">{APP_NAME}</p>
      </header>

      {/* Desktop: persistent rail. */}
      <aside className="border-border bg-card hidden w-60 shrink-0 border-r lg:block">
        <SidebarBody userName={userName} userLocal={userLocal} />
      </aside>

      {/* Mobile drawer. */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/45"
          />
          <div className="border-border bg-card relative flex h-full w-[17rem] max-w-[85vw] flex-col border-r shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="text-fg-soft hover:text-foreground focus-visible:ring-ring absolute top-2.5 right-2.5 inline-flex size-9 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <SidebarBody
              userName={userName}
              userLocal={userLocal}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
