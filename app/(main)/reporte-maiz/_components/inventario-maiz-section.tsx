import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmt, fmtFechaHoraUtc } from "@/lib/fmt";

import type {
  CabeceraCierre,
  FilaInventarioMaiz,
  TotalesInventarioMaiz,
} from "../_lib/tipos";

/**
 * The corn stock **stored** in `Cierre_Producto`. Nothing is recalculated here:
 * this section is a window onto what the closing saved, not a second engine.
 *
 * Mobile first: at 390px six columns are unreadable, so the phone gets one block
 * per branch with label/value pairs and the table starts at `md`. Only one of the
 * two is mounted in the accessibility tree at a time (`display: none` removes it).
 *
 * The three totals are **not** repeated here: they arrive as cards above this
 * card (`components/shared/totales-maiz`), and the `<tfoot>` row belongs to the
 * desktop table only.
 */

type Columna = {
  key: string;
  label: string;
  valor: (fila: FilaInventarioMaiz) => number;
};

const COLUMNAS: Columna[] = [
  { key: "stock", label: "Stock", valor: (f) => f.stock },
  { key: "precio", label: "Precio", valor: (f) => f.precio },
  { key: "inversion", label: "Inversión", valor: (f) => f.inversion },
  { key: "utilidadQQ", label: "Util. QQ", valor: (f) => f.utilidadQQ },
  { key: "utilidadTotal", label: "Util. Total", valor: (f) => f.utilidadTotal },
];

/** `idCierre` alone is not unique: the legacy query can repeat a closing (B-1). */
const claveFila = (fila: FilaInventarioMaiz, indice: number) =>
  `${fila.idCierre}-${fila.producto}-${indice}`;

function Periodo({ cabecera }: { cabecera: CabeceraCierre }) {
  const desde = fmtFechaHoraUtc(cabecera.fechaInicial);
  const hasta = fmtFechaHoraUtc(cabecera.fechaFinal);

  if (!desde && !hasta) return null;

  // Each chunk is `nowrap` and the line wraps between chunks, so a phone never
  // breaks `12/10/2026 22:31` in half or leaves a separator hanging.
  return (
    <p className="text-caption text-fg-faint flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
      {desde ? <span className="whitespace-nowrap">Desde {desde}</span> : null}
      {desde && hasta ? <span aria-hidden="true">·</span> : null}
      {hasta ? <span className="whitespace-nowrap">Hasta {hasta}</span> : null}
      {cabecera.sucursal ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">{cabecera.sucursal}</span>
        </>
      ) : null}
    </p>
  );
}

function Vacio({ mensaje }: { mensaje: string }) {
  return <p className="text-fg-faint py-6 text-center text-sm">{mensaje}</p>;
}

export type InventarioMaizSectionProps = {
  cabecera: CabeceraCierre;
  filas: FilaInventarioMaiz[];
  totales: TotalesInventarioMaiz;
};

export function InventarioMaizSection({
  cabecera,
  filas,
  totales,
}: InventarioMaizSectionProps) {
  return (
    <section aria-labelledby="inventario-maiz-titulo" className="print:break-before-page">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="inventario-maiz-titulo" className="text-h3 text-fg-strong uppercase">
              Inventario de Maíz
            </h2>
          </CardTitle>
          <Periodo cabecera={cabecera} />
        </CardHeader>

        <CardContent>
          {filas.length === 0 ? (
            <Vacio mensaje="Sin inventario de maíz en el cierre." />
          ) : (
            <>
              {/* Phone: one block per branch. */}
              <ul className="flex flex-col md:hidden" aria-label="Inventario de maíz por sucursal">
                {filas.map((fila, i) => (
                  <li
                    key={claveFila(fila, i)}
                    className="border-border/40 flex flex-col gap-2 border-b py-3 first:pt-0 last:border-b-0"
                  >
                    <span className="text-label text-fg-strong font-semibold">
                      {fila.producto}
                    </span>
                    <dl className="flex flex-col gap-1">
                      {COLUMNAS.map((col) => (
                        <div
                          key={col.key}
                          className="flex items-baseline justify-between gap-3"
                        >
                          <dt className="text-caption text-fg-faint">{col.label}</dt>
                          <dd className="text-body text-foreground font-mono tabular-nums">
                            {fmt(col.valor(fila))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>

              {/* From `md`: the six documented columns. */}
              <table className="hidden w-full border-collapse text-sm md:table">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground border-b text-xs uppercase">
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Producto
                    </th>
                    {COLUMNAS.map((col) => (
                      <th
                        key={col.key}
                        scope="col"
                        className="px-3 py-2 text-right font-medium"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-border/40 divide-y">
                  {filas.map((fila, i) => (
                    <tr
                      key={claveFila(fila, i)}
                      className="hover:bg-muted/20 break-inside-avoid"
                    >
                      <td className="text-foreground px-3 py-2">{fila.producto}</td>
                      {COLUMNAS.map((col) => (
                        <td
                          key={col.key}
                          className="text-foreground px-3 py-2 text-right font-mono tabular-nums"
                        >
                          {fmt(col.valor(fila))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-muted/10 border-t font-semibold">
                    <td className="text-fg-strong px-3 py-2 uppercase">TOTAL</td>
                    <td className="text-fg-strong px-3 py-2 text-right font-mono tabular-nums">
                      {fmt(totales.stock)}
                    </td>
                    <td className="text-fg-strong px-3 py-2 text-right font-mono tabular-nums">
                      {fmt(totales.precio)}
                    </td>
                    <td className="text-fg-strong px-3 py-2 text-right font-mono tabular-nums">
                      {fmt(totales.inversion)}
                    </td>
                    {/* No utility totals on purpose: they are already accumulated. */}
                    <td className="px-3 py-2" aria-label="Sin total de utilidad por quintal" />
                    <td className="px-3 py-2" aria-label="Sin total de utilidad total" />
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
