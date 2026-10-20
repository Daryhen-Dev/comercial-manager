import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Sidebar } from "@/components/app/sidebar";
import { Toaster } from "@/components/ui/sonner";

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

  return (
    <div className="bg-background flex h-svh flex-col overflow-hidden lg:flex-row">
      <Sidebar
        userName={session.user.NombreUsuario ?? "Usuario"}
        userLocal={session.user.Local}
      />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
