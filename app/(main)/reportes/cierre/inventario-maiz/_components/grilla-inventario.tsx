"use client";

import { useCallback, useRef } from "react";

import {
  useExcelNavigation,
  type Celda,
} from "@/components/shared/use-excel-navigation";
import { cn } from "@/lib/utils";

import {
  CELDAS_TOTALES,
  COLUMNAS_GRILLA,
  type CeldaGrilla,
  type ColorCelda,
  type EstiloCelda,
  type FilaGrilla,
} from "../_lib/grilla/tipos";

/** Numeric-looking content is right-aligned; text and null are left. */
const NUMERICO = /^-?(\d+(,\d{3})*(\.\d+)?|\.\d+)$/;

const BACKCOLOR: Record<ColorCelda, string> = {
  LightBlue: "bg-[#ADD8E6] text-black",
  LightGreen: "bg-[#90EE90] text-black",
  LightYellow: "bg-[#FFFFE0] text-black",
};

const visibles = COLUMNAS_GRILLA.filter((c) => c.visible);

function estiloDe(fila: FilaGrilla, columnaVisible: number): EstiloCelda | undefined {
  const indiceLegacy = visibles[columnaVisible].indice;
  return fila.estiloCeldas?.[indiceLegacy] ?? fila.estiloFila;
}

export function GrillaInventario({
  filas,
  mensajeVacio,
  ariaLabel,
}: {
  filas: FilaGrilla[];
  mensajeVacio: string;
  ariaLabel: string;
}) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const celdasRef = useRef(new Map<string, HTMLTableCellElement>());

  const getCellElement = useCallback(
    (celda: Celda) => celdasRef.current.get(`${celda.r}:${celda.c}`) ?? null,
    [],
  );

  const { seleccionar, esActiva } = useExcelNavigation({
    rowCount: filas.length,
    colCount: visibles.length,
    paginate: false,
    resetKey: filas,
    containerRef: contenedorRef,
    getCellElement,
  });

  if (filas.length === 0) {
    return (
      <div
        role="status"
        className="bg-card text-muted-foreground flex flex-1 items-center justify-center rounded-md border text-sm"
      >
        {mensajeVacio}
      </div>
    );
  }

  return (
    <div
      ref={contenedorRef}
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={filas.length}
      aria-colcount={visibles.length}
      tabIndex={0}
      className="bg-card focus-visible:ring-ring/50 min-h-0 flex-1 overflow-auto rounded-md border outline-none focus-visible:ring-2"
    >
      <table className="w-max border-collapse font-mono text-xs tabular-nums">
        <tbody>
          {filas.map((fila, r) => (
            <tr key={r} role="row" className="border-border/40 border-b">
              {visibles.map((columna, c) => {
                const contenido: CeldaGrilla = fila.celdas[columna.indice] ?? null;
                const texto = contenido == null ? "" : String(contenido);
                const numerico = NUMERICO.test(texto);
                const estilo = estiloDe(fila, c);
                const activa = esActiva(r, c);

                return (
                  <td
                    key={columna.name}
                    role="gridcell"
                    aria-selected={activa}
                    data-row={r}
                    data-col={c}
                    ref={(el) => {
                      if (el) celdasRef.current.set(`${r}:${c}`, el);
                    }}
                    onClick={() => seleccionar({ r, c })}
                    style={{ minWidth: columna.width }}
                    className={cn(
                      "cursor-cell px-2 py-1 whitespace-nowrap",
                      numerico ? "text-right" : "text-left",
                      estilo?.bold && "font-bold",
                      estilo?.backColor && BACKCOLOR[estilo.backColor],
                      // Selection is a surface plus a ring, never a colour
                      // inversion: these cells carry their own backgrounds.
                      activa && "bg-accent ring-primary ring-2 ring-inset",
                    )}
                  >
                    {texto}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { CELDAS_TOTALES };
