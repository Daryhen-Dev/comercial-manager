"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Search } from "lucide-react";

import { ReportTable, type ReportColumn } from "@/components/shared/report-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmt } from "@/lib/fmt";
import { cn } from "@/lib/utils";

import {
  getSaldosKardexVenta,
  type SaldoKardexVentaRow,
  type SaldosKardexVentaResult,
} from "../_actions";
import { formatFechaVenta } from "../_lib/kardex-venta";

const RUTA_BASE = "/ventas/operaciones/kardex-venta";


export function KardexVentaLista() {
  const router = useRouter();

  const [filtro, setFiltro] = useState("");
  const [soloConSaldo, setSoloConSaldo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SaldosKardexVentaResult | null>(null);
  const [ordenTotal, setOrdenTotal] = useState<"asc" | "desc" | null>(null);
  const peticionRef = useRef(0);

  // Debounce 300 ms + latest-wins: a slow response for an older keystroke is
  // discarded entirely instead of overwriting the current result.
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const miPeticion = ++peticionRef.current;
      setLoading(true);
      try {
        const result = await getSaldosKardexVenta(filtro, soloConSaldo);
        if (peticionRef.current !== miPeticion) return;
        setData(result);
        setError(null);
      } catch {
        if (peticionRef.current !== miPeticion) return;
        setError("Error al ejecutar la consulta");
      } finally {
        if (peticionRef.current === miPeticion) setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [filtro, soloConSaldo]);

  const d = data?.filas ?? [];
  const cobrar = d.filter((r) => r.idTipo === 0);
  const entregar = d.filter((r) => r.idTipo === 1);
  const totalCobrar = data?.totales.porCobrar ?? 0;
  const totalEntregar = data?.totales.porEntregar ?? 0;

  const filasOrdenadas = useMemo(() => {
    if (ordenTotal === null) return d;
    const signo = ordenTotal === "asc" ? 1 : -1;
    return [...d].sort((a, b) => {
      const porTotal = (a.total - b.total) * signo;
      if (porTotal !== 0) return porTotal;
      const porCliente = a.cliente.localeCompare(b.cliente);
      if (porCliente !== 0) return porCliente;
      return a.idCliente - b.idCliente;
    });
  }, [d, ordenTotal]);

  function alternarOrdenTotal() {
    setOrdenTotal((prev) => (prev === null ? "asc" : prev === "asc" ? "desc" : null));
  }

  const columns: ReportColumn<SaldoKardexVentaRow>[] = [
    {
      key: "lupa",
      label: "",
      render: (r) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="Ver historial de movimientos"
          aria-label={`Ver historial de ${r.cliente}`}
          onClick={() => router.push(`${RUTA_BASE}/${r.idCliente}`)}
        >
          <Search className="size-4" />
        </Button>
      ),
    },
    { key: "cliente", label: "Cliente", render: (r) => r.cliente },
    { key: "ruc", label: "RUC", render: (r) => r.ruc },
    {
      key: "tipo",
      label: "Tipo",
      render: (r) => (
        <span
          className={cn(
            "text-xs font-medium",
            r.idTipo === 0 ? "text-positive" : "text-destructive",
          )}
        >
          {r.tipo}
        </span>
      ),
    },
    {
      key: "total",
      label: (
        <span className="inline-flex items-center gap-1">
          Total
          {ordenTotal === "asc" && <ArrowUp className="size-3" />}
          {ordenTotal === "desc" && <ArrowDown className="size-3" />}
          {ordenTotal === null && <ArrowUpDown className="size-3" />}
        </span>
      ),
      align: "right",
      headerTitle: "Ordenar por total",
      onHeaderClick: alternarOrdenTotal,
      render: (r) => (
        <span
          className={cn(
            "font-semibold",
            r.idTipo === 0 ? "text-positive" : "text-destructive",
          )}
        >
          {fmt(r.total)}
        </span>
      ),
    },
    {
      key: "fecha",
      label: "Fecha",
      render: (r) => (
        <span
          className={cn(
            "block -mx-3 -my-1.5 px-3 py-1.5",
            r.nivelAntiguedad === "bajo" && "bg-positive/15",
            r.nivelAntiguedad === "medio" && "bg-warning/15",
            r.nivelAntiguedad === "alto" && "bg-destructive/15",
          )}
        >
          {formatFechaVenta(r.fecha)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <div className="shrink-0">
        <h1 className="text-h2 text-fg-strong">Reporte Kardex de Venta</h1>
        <p className="text-label text-fg-soft">
          Saldos de kardex por cliente (todas las sucursales)
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-stretch">
        <Card className="shrink-0 gap-0 rounded-lg border p-3 lg:w-[36rem]">
          {/* Mobile-first: on a phone the label, the field and the selector stack
              at full width. One row only from `sm` up, where there is room. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="filtro-busqueda">Buscar</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Input
                  id="filtro-busqueda"
                  className="h-11 pr-9"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  maxLength={250}
                  placeholder="Filtrar por cliente o total..."
                  autoComplete="off"
                  enterKeyHint="search"
                />
                {loading ? (
                  <Loader2 className="text-muted-foreground absolute top-1/2 right-2 size-4 -translate-y-1/2 animate-spin" />
                ) : null}
              </div>
              <Select
                value={soloConSaldo ? "con-saldo" : "todos"}
                onValueChange={(v) => setSoloConSaldo(v === "con-saldo")}
              >
                <SelectTrigger
                  className="h-11 w-full shrink-0 sm:w-40"
                  aria-label="Clientes a mostrar"
                >
                  <SelectValue>{soloConSaldo ? "Solo con saldo" : "Todos"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="con-saldo">Solo con saldo</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error ? <p className="text-destructive mt-2 text-sm">{error}</p> : null}
        </Card>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-4 py-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Producto por Cobrar
              </p>
              <p className="text-muted-foreground text-xs">{cobrar.length} clientes</p>
            </div>
            <p className="text-positive font-mono text-lg font-bold">
              {fmt(totalCobrar)}
            </p>
          </div>
          <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-4 py-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Producto por Entregar
              </p>
              <p className="text-muted-foreground text-xs">{entregar.length} clientes</p>
            </div>
            <p className="text-destructive font-mono text-lg font-bold">
              {fmt(totalEntregar)}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm">Consultando saldos, puede tardar unos segundos...</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <ReportTable
            rows={filasOrdenadas}
            columns={columns}
            getRowKey={(r) => r.idCliente}
            fill
            paginate={false}
            emptyMessage="Sin resultados para el filtro actual."
            ariaLabel="Saldos de kardex por cliente"
          />
        </div>
      )}
    </div>
  );
}
