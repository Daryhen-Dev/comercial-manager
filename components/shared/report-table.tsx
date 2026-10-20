"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import {
  ALTO_CONTENEDOR_FALLBACK,
  ALTO_FILA_FALLBACK,
  UMBRAL_FILAS_VIRTUALIZACION,
  calcularVentanaVirtual,
} from "./virtual-window";
import { useExcelNavigation, type Celda } from "./use-excel-navigation";

export type ReportColumn<T> = {
  key: string;
  /** A ReactNode so a header can carry an affordance (an order arrow). */
  label: ReactNode;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
  headerTitle?: string;
  onHeaderClick?: () => void;
  headClassName?: string;
  cellClassName?: string;
  rowClassName?: string;
};

export type ReportTableProps<T> = {
  rows: T[];
  columns: ReportColumn<T>[];
  getRowKey: (row: T) => string | number;
  /** Take the parent's full height instead of a capped, bordered box. */
  fill?: boolean;
  paginate?: boolean;
  pageSize?: number;
  virtualize?: boolean;
  /** Frozen column widths in px; switches the table to `table-layout: fixed`. */
  colWidths?: number[];
  emptyMessage?: string;
  loading?: boolean;
  /** Let cells wrap instead of one line each. Disables virtualization. */
  wrap?: boolean;
  verticalAlign?: "top" | "middle";
  footer?: ReactNode;
  ariaLabel?: string;
};

export function ReportTable<T>({
  rows,
  columns,
  getRowKey,
  fill = false,
  paginate = true,
  pageSize = 25,
  virtualize = false,
  colWidths,
  emptyMessage = "Sin resultados.",
  loading = false,
  wrap = false,
  verticalAlign = "top",
  footer,
  ariaLabel,
}: ReportTableProps<T>) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const celdasRef = useRef(new Map<string, HTMLTableCellElement>());
  const filaMedicionRef = useRef<HTMLTableRowElement | null>(null);

  const [pagina, setPagina] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const [altoContenedor, setAltoContenedor] = useState(ALTO_CONTENEDOR_FALLBACK);
  const [altoFila, setAltoFila] = useState(ALTO_FILA_FALLBACK);

  const virtualizacionActiva =
    virtualize && !paginate && !wrap && rows.length > UMBRAL_FILAS_VIRTUALIZACION;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const filasPaginadas = useMemo(() => {
    if (!paginate) return rows;
    const desde = (pagina - 1) * pageSize;
    return rows.slice(desde, desde + pageSize);
  }, [rows, paginate, pagina, pageSize]);

  const mostrarTodas = !paginate || virtualizacionActiva;
  const rowCount = mostrarTodas ? rows.length : filasPaginadas.length;

  const ventana = virtualizacionActiva
    ? calcularVentanaVirtual({
        rowCount: rows.length,
        scrollTop,
        containerHeight: altoContenedor,
        rowHeight: altoFila,
      })
    : { primera: 0, ultima: rowCount - 1 };

  const filasVisibles = virtualizacionActiva
    ? rows.slice(ventana.primera, ventana.ultima + 1)
    : filasPaginadas;

  const offsetArriba = virtualizacionActiva ? ventana.primera * altoFila : 0;
  const offsetAbajo = virtualizacionActiva
    ? Math.max(0, (rows.length - 1 - ventana.ultima) * altoFila)
    : 0;

  const getCellElement = useCallback(
    (celda: Celda) => celdasRef.current.get(`${celda.r}:${celda.c}`) ?? null,
    [],
  );

  const onBeforeScrollToCell = useCallback(
    (celda: Celda) => {
      if (!virtualizacionActiva) return;
      const contenedor = contenedorRef.current;
      if (!contenedor) return;
      const destino = Math.max(0, celda.r * altoFila - contenedor.clientHeight * 0.4);
      if (Math.abs(contenedor.scrollTop - destino) > altoFila) {
        contenedor.scrollTop = destino;
      }
    },
    [virtualizacionActiva, altoFila],
  );

  const { activa, seleccionar, esActiva } = useExcelNavigation({
    rowCount,
    colCount: columns.length,
    pageSize,
    paginate,
    resetKey: rows,
    containerRef: contenedorRef,
    getCellElement,
    onBeforeScrollToCell,
  });

  // Reset pagination when the dataset changes identity.
  useLayoutEffect(() => {
    setPagina(1);
    const contenedor = contenedorRef.current;
    if (contenedor) contenedor.scrollTop = 0;
    setScrollTop(0);
    setAltoFila(ALTO_FILA_FALLBACK);
  }, [rows]);

  // Measure the container and the first real row when the dataset changes.
  useLayoutEffect(() => {
    const contenedor = contenedorRef.current;
    if (contenedor && contenedor.clientHeight > 0) {
      setAltoContenedor(contenedor.clientHeight);
    }
    const fila = filaMedicionRef.current;
    if (fila && fila.offsetHeight > 0) {
      setAltoFila(fila.offsetHeight);
    }
  }, [rows, virtualizacionActiva]);

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const contenedor = e.currentTarget;
      setAltoContenedor(contenedor.clientHeight);
      if (!virtualizacionActiva) return;
      const siguiente = calcularVentanaVirtual({
        rowCount: rows.length,
        scrollTop: contenedor.scrollTop,
        containerHeight: contenedor.clientHeight,
        rowHeight: altoFila,
      });
      // Only re-render when the window actually moved.
      if (siguiente.primera !== ventana.primera || siguiente.ultima !== ventana.ultima) {
        setScrollTop(contenedor.scrollTop);
      }
    },
    [virtualizacionActiva, rows.length, altoFila, ventana.primera, ventana.ultima],
  );

  const tablaFija = Boolean(colWidths && colWidths.length === columns.length);

  const tabla = (
    <table
      className={cn("w-full border-collapse text-sm", tablaFija && "table-fixed")}
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={rows.length}
      aria-colcount={columns.length}
    >
      {tablaFija ? (
        <colgroup>
          {colWidths!.map((w, i) => (
            <col key={columns[i]?.key ?? i} style={{ width: `${w}px` }} />
          ))}
        </colgroup>
      ) : null}

      <thead>
        <tr className="bg-muted/60 text-muted-foreground border-b text-xs uppercase">
          {columns.map((col) => (
            <th
              key={col.key}
              scope="col"
              title={col.headerTitle}
              onClick={col.onHeaderClick}
              className={cn(
                "bg-muted sticky top-0 z-10 px-3 py-2 text-left align-bottom font-medium",
                col.onHeaderClick && "hover:text-foreground cursor-pointer select-none",
                col.align === "right" && "text-right",
                col.headClassName,
              )}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-border/40 divide-y">
        {virtualizacionActiva && offsetArriba > 0 ? (
          <tr aria-hidden="true">
            <td
              colSpan={columns.length}
              style={{ height: offsetArriba, padding: 0, border: 0 }}
            />
          </tr>
        ) : null}

        {filasVisibles.map((row, i) => {
          const r = virtualizacionActiva ? ventana.primera + i : i;
          return (
            <tr
              key={getRowKey(row)}
              ref={r === 0 ? filaMedicionRef : undefined}
              className="hover:bg-muted/20"
            >
              {columns.map((col, c) => {
                const activaAqui = esActiva(r, c);
                return (
                  <td
                    key={col.key}
                    role="gridcell"
                    aria-selected={activaAqui}
                    ref={(el) => {
                      if (!el) return;
                      celdasRef.current.set(`${r}:${c}`, el);
                    }}
                    onClick={() => seleccionar({ r, c })}
                    className={cn(
                      "cursor-cell px-3 py-1.5",
                      wrap ? "whitespace-normal" : "whitespace-nowrap",
                      verticalAlign === "top" ? "align-top" : "align-middle",
                      col.align === "right" && "text-right font-mono tabular-nums",
                      activaAqui && "bg-primary text-primary-foreground",
                      tablaFija && "overflow-hidden",
                      col.cellClassName,
                      col.rowClassName,
                    )}
                  >
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                );
              })}
            </tr>
          );
        })}

        {virtualizacionActiva && offsetAbajo > 0 ? (
          <tr aria-hidden="true">
            <td
              colSpan={columns.length}
              style={{ height: offsetAbajo, padding: 0, border: 0 }}
            />
          </tr>
        ) : null}
      </tbody>

      {footer ? (
        <tfoot className="bg-muted/60 border-t text-sm font-medium">{footer}</tfoot>
      ) : null}
    </table>
  );

  const vacio = !loading && rows.length === 0;

  return (
    <div className={cn("flex flex-col gap-3", fill && "h-full")}>
      <div
        ref={contenedorRef}
        role="presentation"
        onScroll={onScroll}
        tabIndex={0}
        className={cn(
          "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
          fill
            ? "min-h-0 flex-1 overflow-auto"
            : "max-h-[80vh] overflow-auto rounded-md border",
        )}
      >
        {loading ? (
          <div
            className={cn(
              "text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm",
              fill && "h-full",
            )}
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Cargando...
          </div>
        ) : vacio ? (
          <div
            className={cn(
              "text-muted-foreground flex items-center justify-center py-8 text-sm",
              fill && "h-full",
            )}
          >
            {emptyMessage}
          </div>
        ) : (
          tabla
        )}
      </div>

      {paginate && totalPages > 1 ? (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={pagina === 1}
                className={pagina === 1 ? "pointer-events-none opacity-50" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setPagina((p) => Math.max(1, p - 1));
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive onClick={(e) => e.preventDefault()}>
                {pagina} / {totalPages}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={pagina === totalPages}
                className={
                  pagina === totalPages ? "pointer-events-none opacity-50" : undefined
                }
                onClick={(e) => {
                  e.preventDefault();
                  setPagina((p) => Math.min(totalPages, p + 1));
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
