import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/fmt";
import { cn } from "@/lib/utils";

import { getMovimientosKardexVenta, type MovimientosKardexVentaResult } from "../_actions";
import { KardexVentaHistorialTabla } from "../_components/kardex-venta-historial-tabla";

const RUTA_BASE = "/ventas/operaciones/kardex-venta";

// Reads the session and the database at request time; with cacheComponents
// enabled the route must block instead of prerendering a shell.
export const instant = false;

type HistorialData = Omit<MovimientosKardexVentaResult, "cliente"> & {
  cliente: NonNullable<MovimientosKardexVentaResult["cliente"]>;
};

function EstadoVacio() {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm">Cliente sin movimientos visibles</p>
      <Button
        variant="outline"
        size="sm"
        render={<Link href={RUTA_BASE} />}
        nativeButton={false}
      >
        <ArrowLeft className="size-4" /> Volver al listado
      </Button>
    </div>
  );
}

export default async function KardexVentaHistorialPage(
  props: PageProps<"/ventas/operaciones/kardex-venta/[idCliente]">,
) {
  const { idCliente } = await props.params;
  const id = Number(idCliente);

  const data: HistorialData | null =
    Number.isInteger(id) && id > 0
      ? await getMovimientosKardexVenta(id).then((r) =>
          r.cliente ? { ...r, cliente: r.cliente } : null,
        )
      : null;

  if (!data) return <EstadoVacio />;

  const porEntregar = data.tipo === "PRODUCTO POR ENTREGAR";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={RUTA_BASE} />}
          nativeButton={false}
        >
          <ArrowLeft className="size-4" /> Volver al listado
        </Button>
      </div>

      <div className="bg-muted/40 shrink-0 rounded-md border px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span>
            <span className="text-muted-foreground">Cliente:</span>{" "}
            <span className="font-medium">{data.cliente.nombre}</span>
          </span>
          <span>
            <span className="text-muted-foreground">RUC:</span>{" "}
            <span className="font-medium">{data.cliente.ruc}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Total:</span>{" "}
            <span className="font-mono font-semibold">
              {fmt(Math.abs(data.saldoActual))}
            </span>
          </span>
          <Badge
            variant={porEntregar ? "destructive" : "secondary"}
            className={cn(
              !porEntregar && "bg-green-600/10 text-green-600 dark:text-green-500",
            )}
          >
            {data.tipo}
          </Badge>
          <span className="text-muted-foreground ml-auto font-mono">
            {data.movimientos.length} movimientos
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <KardexVentaHistorialTabla movimientos={data.movimientos} />
      </div>
    </div>
  );
}
