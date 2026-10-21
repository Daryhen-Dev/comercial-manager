import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { auth } from "@/auth";
import { TotalesMaiz } from "@/components/shared/totales-maiz";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { fmt } from "@/lib/fmt";

import { cargarReporteMaiz } from "./_actions";
import { CierreSelector } from "./_components/cierre-selector";
import { InventarioMaizSection } from "./_components/inventario-maiz-section";
import { resolverIdCierre } from "./_lib/datos/mapeadores";

// The page reads the session and queries the closing, so it must block instead of
// prerendering a shell (`cacheComponents` is enabled).
export const instant = false;

type PageProps = {
  searchParams: Promise<{ idCierre?: string | string[] }>;
};

export default async function ReporteMaizPage({ searchParams }: PageProps) {
  const session = await auth();

  // The `(main)` layout already enforces this; repeating it here keeps the query
  // from ever starting for a non-administrator.
  if (session?.user?.UsuarioRolId !== 1) {
    redirect("/reportes");
  }

  const { idCierre } = await searchParams;
  const id = resolverIdCierre(idCierre);
  const resultado = await cargarReporteMaiz(id);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 text-fg-strong">Maíz por Cierre</h1>
          <p className="text-body text-fg-soft">
            Valores guardados en el cierre de producto, por sucursal.
          </p>
        </div>

        <div className="sm:shrink-0">
          <CierreSelector
            current={resultado.status === "ok" ? { idCierre: resultado.idCierre } : null}
          />
        </div>
      </header>

      {resultado.status === "error" ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{resultado.error}</AlertDescription>
        </Alert>
      ) : null}

      {resultado.status === "sin-cierre" ? (
        <Card>
          <CardContent className="text-fg-soft py-10 text-center text-sm">
            Seleccioná un cierre para ver el reporte.
          </CardContent>
        </Card>
      ) : null}

      {resultado.status === "sin-cabecera" ? (
        <Card>
          <CardContent className="text-fg-soft py-10 text-center text-sm">
            El cierre #{resultado.idCierre} no tiene cabecera contable, así que no hay
            fecha final con la que armar el inventario.
          </CardContent>
        </Card>
      ) : null}

      {resultado.status === "ok" ? (
        <>
          {/* The three figures first: stock, weighted-average price, inversion. */}
          <TotalesMaiz
            stock={fmt(resultado.totales.stock)}
            precio={fmt(resultado.totales.precio)}
            inversion={fmt(resultado.totales.inversion)}
          />

          <InventarioMaizSection
            cabecera={resultado.cabecera}
            filas={resultado.filas}
            totales={resultado.totales}
          />
        </>
      ) : null}
    </div>
  );
}
