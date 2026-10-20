import { KardexVentaLista } from "./_components/kardex-venta-lista";

// Reads the session (and the database through a server action) at request time.
// With cacheComponents enabled the route must block instead of prerendering a
// shell, and route segment config only applies to a Server Component module,
// which is why the interactive list lives in its own client component.
export const instant = false;

export default function KardexVentaPage() {
  return <KardexVentaLista />;
}
