import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { logout } from "./_actions/logout";

const APP_NAME = "Comercial Manager";

// SECURITY NOTE: the `proxy.ts` matcher is not an authorization boundary; it
// only keeps anonymous traffic out for convenience. This layout is where
// authentication and the administrator role are actually enforced for every
// page under `(main)`. The role is `UsuarioRolId === 1`, the identifier the
// legacy system uses for administrators; `RolUsuario` is the display name and
// is NOT authoritative.
export default async function MainLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.UsuarioRolId !== 1) {
    redirect("/login?error=forbidden");
  }

  const nombreUsuario = session.user.NombreUsuario ?? "Usuario";
  const local = session.user.Local;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <span className="font-heading text-base font-medium">{APP_NAME}</span>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {nombreUsuario}
            {local ? ` · ${local}` : ""}
          </span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
