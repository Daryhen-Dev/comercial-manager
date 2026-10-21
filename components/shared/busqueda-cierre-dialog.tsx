"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fmtFechaHoraUtc } from "@/lib/fmt";
import { cn } from "@/lib/utils";

/** The minimum a closing needs to be picked from this dialog and propagated. */
export type CierreOpcion = {
  idCierre: number;
  fechaInicial: string | null;
  fecha: string | null;
};

export type BusquedaCierreDialogProps = {
  onClose: () => void;
  /**
   * Data source. The branch is never a parameter here: the caller's server action
   * reads it from the session, so the client cannot choose another branch.
   */
  buscar: (query: string) => Promise<CierreOpcion[]>;
  onConfirm: (cierre: CierreOpcion) => void;
};

/** The documented debounce: every keystroke cancels the previous timer. */
const DEBOUNCE_MS = 350;

/**
 * The dialog is mounted **open** by its caller and unmounted on close, so every
 * opening starts from a clean state: empty query, empty list, no selection, and
 * an immediate load of every closing of the branch. Resetting through a state
 * effect would be a cascading render; a fresh instance cannot have stale state,
 * and unmounting is also what cancels the pending timer.
 */
export function BusquedaCierreDialog({
  onClose,
  buscar,
  onConfirm,
}: BusquedaCierreDialogProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<CierreOpcion[]>([]);
  const [seleccion, setSeleccion] = useState<CierreOpcion | null>(null);
  const [loading, setLoading] = useState(false);

  // Last-wins: only the newest request may write the list, so a slow answer for
  // an old query can never overwrite a newer one.
  const busquedaIdRef = useRef(0);
  const consultaRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ejecutar = useCallback(
    async (texto: string) => {
      const id = ++busquedaIdRef.current;
      setLoading(true);

      try {
        const lista = await buscar(texto);
        if (id !== busquedaIdRef.current) return;

        setResultados(lista);
        // A selection that no longer exists in the new list is dropped.
        setSeleccion((previa) =>
          previa && lista.some((c) => c.idCierre === previa.idCierre) ? previa : null,
        );
      } catch {
        if (id !== busquedaIdRef.current) return;

        // The documented failure mode: empty list and no selection, so the dialog
        // shows "Sin resultados." instead of breaking.
        setResultados([]);
        setSeleccion(null);
      } finally {
        if (id === busquedaIdRef.current) setLoading(false);
      }
    },
    [buscar],
  );

  // Debounce. The first load after mounting is immediate, the rest wait for the
  // user to stop typing.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const demora = consultaRef.current === null ? 0 : DEBOUNCE_MS;

    timerRef.current = setTimeout(() => {
      consultaRef.current = query;
      void ejecutar(query);
    }, demora);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [query, ejecutar]);

  const confirmar = () => {
    if (!seleccion) return;
    onConfirm(seleccion);
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Búsqueda por Cierre</DialogTitle>
          <DialogDescription>
            Escribí una fecha en formato dd/mm/aaaa. Sin texto se listan todos los
            cierres de tu sucursal.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="text-fg-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            autoFocus
            className="h-11 pl-9"
            placeholder="Buscar por fecha..."
            aria-label="Buscar cierre por fecha"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-72 overflow-auto rounded-md border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10">
              <Loader2 className="text-fg-faint size-4 animate-spin" aria-hidden="true" />
              <span className="text-label text-fg-soft">Buscando…</span>
            </div>
          ) : resultados.length === 0 ? (
            <p className="text-fg-faint py-10 text-center text-sm">Sin resultados.</p>
          ) : (
            <ul aria-label="Cierres encontrados">
              {resultados.map((cierre) => {
                const activa = seleccion?.idCierre === cierre.idCierre;
                return (
                  <li key={cierre.idCierre}>
                    <button
                      type="button"
                      aria-current={activa}
                      onClick={() => setSeleccion(cierre)}
                      className={cn(
                        "border-border/40 flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left last:border-b-0",
                        activa ? "bg-accent" : "hover:bg-muted/40",
                      )}
                    >
                      <span className="text-caption text-fg-soft tabular-nums">
                        Desde: {fmtFechaHoraUtc(cierre.fechaInicial)}
                      </span>
                      <span className="text-body text-foreground tabular-nums">
                        Hasta: {fmtFechaHoraUtc(cierre.fecha)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!seleccion} onClick={confirmar}>
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
