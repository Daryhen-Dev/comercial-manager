import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Minimal placeholder dashboard: it only proves the enriched session (name,
// branch, role) survives from login through the (main) authorization layout.
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
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Panel de administrador</CardTitle>
          <CardDescription>Sesión iniciada correctamente.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p>
            <span className="text-muted-foreground">Usuario: </span>
            {nombre}
          </p>
          <p>
            <span className="text-muted-foreground">Local: </span>
            {local}
          </p>
          <p>
            <span className="text-muted-foreground">Rol: </span>
            {rol}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
