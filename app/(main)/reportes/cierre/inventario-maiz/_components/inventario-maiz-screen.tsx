"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CircleDollarSign,
  LoaderCircle,
  Tag,
  Wheat,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { formatoFechaLarga, formatoHora } from "../_lib/formato-fecha";
import type { FilaFaltanteDTO, ResultadoInventarioMaiz } from "../_lib/tipos-dto";
import { GrillaInventario } from "./grilla-inventario";

function suscribirReloj(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(id);
}

/** Empty until mounted, so the server and the client agree. */
function useReloj(): Date | null {
  const segundos = useSyncExternalStore(
    suscribirReloj,
    () => Math.floor(Date.now() / 1000),
    () => 0,
  );
  return segundos === 0 ? null : new Date(segundos * 1000);
}

function TotalCard({
  titulo,
  valor,
  unidad,
  icono: Icono,
}: {
  titulo: string;
  valor: string;
  unidad: string;
  icono: typeof Wheat;
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-label text-fg-soft flex items-center gap-2">
          <Icono className="text-fg-faint size-4" aria-hidden="true" />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-end gap-1">
        <p className="text-h2 text-fg-strong font-mono font-semibold tracking-tight tabular-nums">
          {valor}
        </p>
        <p className="text-caption text-fg-faint">{unidad}</p>
      </CardContent>
    </Card>
  );
}

function FaltantesDialog({
  open,
  onOpenChange,
  faltantes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faltantes: { compras: FilaFaltanteDTO[]; ventas: FilaFaltanteDTO[] };
}) {
  const filas = [
    ...faltantes.compras.map((f) => ({ ...f, clase: "Compra" })),
    ...faltantes.ventas.map((f) => ({ ...f, clase: "Venta" })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Compras o ventas por liquidar</DialogTitle>
          <DialogDescription>
            Estos comprobantes no están liquidados y bloquean el reporte.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground text-left text-xs uppercase">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Sucursal</th>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Cliente</th>
              </tr>
            </thead>
            <tbody className="divide-border/40 divide-y">
              {filas.map((f) => (
                <tr key={`${f.clase}-${f.idBoletoDetalle}`}>
                  <td className="px-3 py-1.5">{f.clase}</td>
                  <td className="px-3 py-1.5">{f.sucursal}</td>
                  <td className="px-3 py-1.5 font-mono tabular-nums">{f.codigo}</td>
                  <td className="px-3 py-1.5">{f.producto}</td>
                  <td className="px-3 py-1.5">{f.cliente}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InventarioMaizScreen({ inicial }: { inicial: ResultadoInventarioMaiz }) {
  const router = useRouter();
  const ahora = useReloj();
  const [faltantesOpen, setFaltantesOpen] = useState(false);

  return (
    <div className="flex h-full flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-h1 text-fg-strong">INVENTARIO MAÍZ</h1>
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-label text-fg-soft">Fecha y hora actual</span>
            <span className="text-body text-foreground font-mono tabular-nums">
              {ahora ? `${formatoFechaLarga(ahora)} ${formatoHora(ahora)}` : ""}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/reportes" />}
            nativeButton={false}
          >
            SALIR
          </Button>
        </div>
      </div>

      {inicial.status === "error" ? (
        <>
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{inicial.error}</AlertDescription>
          </Alert>
          <div className="bg-card text-muted-foreground flex flex-1 items-center justify-center rounded-md border text-sm">
            <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
            Sin datos: la carga falló.
          </div>
        </>
      ) : null}

      {inicial.status === "bloqueado" ? (
        <>
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{inicial.mensaje}</span>
              <Button
                variant="link"
                className="h-auto w-fit p-0 text-lg font-bold"
                onClick={() => setFaltantesOpen(true)}
              >
                {"--> COMPRAS O VENTAS POR LIQUIDAR"}
              </Button>
            </AlertDescription>
          </Alert>
          <FaltantesDialog
            open={faltantesOpen}
            onOpenChange={setFaltantesOpen}
            faltantes={inicial.faltantes}
          />
        </>
      ) : null}

      {inicial.status === "ok" ? (
        <>
          <section
            aria-label="Totales del inventario de maíz"
            className="grid shrink-0 gap-3 sm:grid-cols-3"
          >
            <TotalCard titulo="STOCK" valor={inicial.resumen.stock} unidad="qq" icono={Wheat} />
            <TotalCard
              titulo="PRECIO"
              valor={inicial.resumen.precio}
              unidad="$ / qq"
              icono={Tag}
            />
            <TotalCard
              titulo="INVERSION"
              valor={inicial.resumen.inversion}
              unidad="$"
              icono={CircleDollarSign}
            />
          </section>

          <div className="flex min-h-0 flex-1 flex-col">
            <GrillaInventario
              filas={inicial.filas}
              mensajeVacio="Ninguna sucursal tiene MAIZ en su último cierre."
              ariaLabel="Grilla del inventario de maíz"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
