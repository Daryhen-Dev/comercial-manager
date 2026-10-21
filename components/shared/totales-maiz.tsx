import { CircleDollarSign, Tag, Wheat } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The three totals every maize report leads with: stock, the weighted-average
 * price and the inversion. Values arrive **already formatted** — this is a
 * presentation component and knows nothing about `CsDecimal` or `number`.
 *
 * Shared by `/reportes/cierre/inventario-maiz` (recalculated closing) and
 * `/reporte-maiz` (closing selected by the user) so the same three figures never
 * look different in two places.
 *
 * Two layouts on purpose. On a phone the three cards stacked pushed the table
 * ~330px below the fold, so the phone gets **one** card with three aligned rows,
 * where every figure is visible at once. From `sm` the three labelled cards fit
 * side by side and the separation is worth the space.
 */

type Total = {
  titulo: string;
  valor: string;
  unidad: string;
  icono: typeof Wheat;
};

function TotalFila({ total }: { total: Total }) {
  const Icono = total.icono;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-label text-fg-soft flex items-center gap-2">
        <Icono className="text-fg-faint size-4" aria-hidden="true" />
        {total.titulo}
        <span className="text-caption text-fg-faint">{total.unidad}</span>
      </dt>
      <dd className="text-h2 text-fg-strong font-mono font-semibold tracking-tight tabular-nums">
        {total.valor}
      </dd>
    </div>
  );
}

function TotalCard({ total }: { total: Total }) {
  const Icono = total.icono;
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-label text-fg-soft flex items-center gap-2">
          <Icono className="text-fg-faint size-4" aria-hidden="true" />
          {total.titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-end gap-1">
        <p className="text-h2 text-fg-strong font-mono font-semibold tracking-tight tabular-nums">
          {total.valor}
        </p>
        <p className="text-caption text-fg-faint">{total.unidad}</p>
      </CardContent>
    </Card>
  );
}

export type TotalesMaizProps = {
  stock: string;
  precio: string;
  inversion: string;
};

export function TotalesMaiz({ stock, precio, inversion }: TotalesMaizProps) {
  const totales: Total[] = [
    { titulo: "STOCK", valor: stock, unidad: "qq", icono: Wheat },
    { titulo: "PRECIO", valor: precio, unidad: "$ / qq", icono: Tag },
    { titulo: "INVERSIÓN", valor: inversion, unidad: "$", icono: CircleDollarSign },
  ];

  return (
    <section aria-label="Totales del inventario de maíz">
      <Card size="sm" className="sm:hidden">
        <CardContent>
          <dl className="flex flex-col gap-2.5">
            {totales.map((total) => (
              <TotalFila key={total.titulo} total={total} />
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="hidden gap-3 sm:grid sm:grid-cols-3">
        {totales.map((total) => (
          <TotalCard key={total.titulo} total={total} />
        ))}
      </div>
    </section>
  );
}
