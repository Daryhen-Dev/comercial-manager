"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ReportTable, type ReportColumn } from "@/components/shared/report-table";
import { fmt } from "@/lib/fmt";
import { cn } from "@/lib/utils";

import type { MovimientoKardexVentaRow } from "../_actions";
import { formatFechaMovimiento } from "../_lib/kardex-venta";

/** Long free text is capped and its full value lives in the native tooltip. */
function TextoLargo({ texto }: { texto: string }) {
  return (
    <span className="inline-block max-w-[280px] truncate align-bottom" title={texto}>
      {texto}
    </span>
  );
}

function columnas(): ReportColumn<MovimientoKardexVentaRow>[] {
  return [
    { key: "sucursal", label: "Sucursal", render: (r) => r.sucursal },
    {
      key: "fecha",
      label: "Fecha",
      render: (r) => formatFechaMovimiento(r.fechaLiquida, r.fechaSalida),
    },
    { key: "chofer", label: "Chofer", render: (r) => r.chofer },
    { key: "placa", label: "Placa", render: (r) => r.placa },
    {
      key: "concepto",
      label: "Concepto",
      render: (r) => <TextoLargo texto={r.concepto} />,
    },
    { key: "guia", label: "Guía", render: (r) => r.guia },
    { key: "destino", label: "Destino", render: (r) => <TextoLargo texto={r.destino} /> },
    { key: "factura", label: "Factura", render: (r) => r.factura },
    { key: "producto", label: "Producto", render: (r) => r.producto },
    {
      key: "humedad",
      label: "Humedad",
      align: "right",
      render: (r) => (r.humedad !== 0 ? fmt(r.humedad) : ""),
    },
    {
      key: "qq",
      label: "QQ",
      align: "right",
      render: (r) => (r.qq !== 0 ? fmt(r.qq) : ""),
    },
    {
      key: "precio",
      label: "Precio",
      align: "right",
      render: (r) => (r.precio !== 0 ? fmt(r.precio) : ""),
    },
    // Total y Debe siempre se muestran, incluso 0.00.
    { key: "total", label: "Total", align: "right", render: (r) => fmt(r.total) },
    {
      key: "retencion",
      label: "Retención",
      align: "right",
      render: (r) => (r.retencion !== 0 ? fmt(r.retencion) : ""),
    },
    { key: "debe", label: "Debe", align: "right", render: (r) => fmt(r.debe) },
    {
      key: "haber",
      label: "Haber",
      align: "right",
      render: (r) => (r.haber !== 0 ? fmt(r.haber) : ""),
    },
    {
      key: "saldo",
      label: "Saldo",
      align: "right",
      render: (r) => (
        <span
          className={cn(
            "font-semibold",
            r.acumulado > 0
              ? "text-green-600"
              : r.acumulado < 0
                ? "text-destructive"
                : "",
          )}
        >
          {fmt(r.acumulado)}
        </span>
      ),
    },
  ];
}

export function KardexVentaHistorialTabla({
  movimientos,
}: {
  movimientos: MovimientoKardexVentaRow[];
}) {
  const tablaMedicionRef = useRef<HTMLTableElement | null>(null);
  const [anchos, setAnchos] = useState<number[] | null>(null);

  const columns = useMemo(() => columnas(), []);

  /**
   * One representative value per column, taken from the WHOLE dataset rather
   * than from the mounted rows: with virtualization the mounted set changes on
   * scroll and `table-layout: auto` would make the table breathe horizontally.
   */
  const muestraValores = useMemo<ReactNode[]>(() => {
    if (movimientos.length === 0) return [];

    const masLargo = (texto: (r: MovimientoKardexVentaRow) => string) =>
      movimientos.reduce((a, b) => (texto(b).length > texto(a).length ? b : a));
    const masLargoFmt = (valor: (r: MovimientoKardexVentaRow) => string) => {
      const fila = masLargo(valor);
      return valor(fila);
    };

    const fecha = masLargo((r) => formatFechaMovimiento(r.fechaLiquida, r.fechaSalida));

    return [
      masLargo((r) => r.sucursal).sucursal,
      formatFechaMovimiento(fecha.fechaLiquida, fecha.fechaSalida),
      masLargo((r) => r.chofer).chofer,
      masLargo((r) => r.placa).placa,
      <TextoLargo key="c" texto={masLargo((r) => r.concepto).concepto} />,
      masLargo((r) => r.guia).guia,
      <TextoLargo key="d" texto={masLargo((r) => r.destino).destino} />,
      masLargo((r) => r.factura).factura,
      masLargo((r) => r.producto).producto,
      masLargoFmt((r) => (r.humedad !== 0 ? fmt(r.humedad) : "")),
      masLargoFmt((r) => (r.qq !== 0 ? fmt(r.qq) : "")),
      masLargoFmt((r) => (r.precio !== 0 ? fmt(r.precio) : "")),
      masLargoFmt((r) => fmt(r.total)),
      masLargoFmt((r) => (r.retencion !== 0 ? fmt(r.retencion) : "")),
      masLargoFmt((r) => fmt(r.debe)),
      masLargoFmt((r) => (r.haber !== 0 ? fmt(r.haber) : "")),
      masLargoFmt((r) => fmt(r.acumulado)),
    ];
  }, [movimientos]);

  // Measure before paint so the first visible render already has fixed widths.
  useLayoutEffect(() => {
    const tabla = tablaMedicionRef.current;
    if (!tabla || muestraValores.length === 0) {
      setAnchos(null);
      return;
    }
    const fila = tabla.tBodies[0]?.rows[1];
    if (!fila) return;

    const medidos = Array.from(fila.cells).map((celda) => celda.offsetWidth);
    setAnchos(medidos.some((w) => w === 0) ? null : medidos.map((w) => w + 2));
  }, [muestraValores]);

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          visibility: "hidden",
          zIndex: -1,
        }}
      >
        <table ref={tablaMedicionRef} className="text-sm">
          <tbody>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2 text-left whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
            <tr>
              {muestraValores.map((valor, i) => (
                <td
                  key={columns[i].key}
                  className={cn(
                    "px-3 py-1.5 whitespace-nowrap",
                    columns[i].align === "right" && "font-mono tabular-nums",
                  )}
                >
                  {valor}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <ReportTable
        rows={movimientos}
        columns={columns}
        getRowKey={(r) => r.idVentaKardex}
        fill
        paginate={false}
        virtualize
        colWidths={anchos ?? undefined}
        emptyMessage="Sin movimientos visibles para este cliente."
        ariaLabel="Movimientos del kardex del cliente"
      />
    </>
  );
}
