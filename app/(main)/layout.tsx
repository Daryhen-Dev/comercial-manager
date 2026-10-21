import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Sidebar } from "@/components/app/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { esAdminDeVentanas } from "@/lib/acceso";

// SECURITY NOTE: the `proxy.ts` matcher is not an authorization boundary; it
// only keeps anonymous traffic out for convenience. This layout is where
// authentication and the access rule are actually enforced for every page under
// `(main)`: administrator of branch 1 (`lib/acceso.ts`), the same rule the login
// applies before issuing a session. Here it re-checks every request, so a token
// minted before the rule existed stops working immediately.
export default async function MainLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!esAdminDeVentanas(session.user)) {
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
