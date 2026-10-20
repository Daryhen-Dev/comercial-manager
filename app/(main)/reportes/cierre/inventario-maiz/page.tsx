import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { cargarInventarioMaiz } from "./_actions/inventario-maiz";
import { InventarioMaizScreen } from "./_components/inventario-maiz-screen";

// The report is a live query (clock and stock of the moment), never static.
// `cacheComponents` is enabled, so the route must block instead of prerendering.
export const instant = false;

export default async function InventarioMaizPage() {
  const session = await auth();

  // Authoritative role field in this system.
  if (session?.user?.UsuarioRolId !== 1) {
    redirect("/reportes");
  }

  const resultado = await cargarInventarioMaiz();
  return <InventarioMaizScreen inicial={resultado} />;
}
