import { auth } from "@/auth";

// Minimal placeholder dashboard. It proves two things at once: the enriched
// session (name, branch, role) survives from login through the (main)
// authorization layout, and the workspace tone/type ramp reads as a hierarchy
// rather than as one flat grey.
// Reading the session is inherently dynamic (cookies); with cacheComponents
// enabled this route must opt out of prerendering instead of streaming.
export const instant = false;

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;

  const nombre = user?.NombreUsuario ?? "Usuario";
  const local = user?.Local ?? "Sin local asignado";
  const rol = user?.RolUsuario ?? "Sin rol";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-4 py-8 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-fg-strong">Panel</h1>
        <p className="text-body text-fg-soft">
          Sesión iniciada como {nombre} en {local}.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 text-fg-strong">Tu sesión</h2>
        <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-label text-fg-soft">Usuario</dt>
            <dd className="text-body text-foreground">{nombre}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-label text-fg-soft">Local</dt>
            <dd className="text-body text-foreground">{local}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-label text-fg-soft">Rol</dt>
            <dd className="text-body text-foreground">{rol}</dd>
          </div>
        </dl>
        <p className="text-caption text-fg-faint">
          Los módulos de clientes, productos y ventas se construyen sobre esta
          misma base.
        </p>
      </section>
    </main>
  );
}
