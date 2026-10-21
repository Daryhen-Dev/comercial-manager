"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import {
  BusquedaCierreDialog,
  type CierreOpcion,
} from "@/components/shared/busqueda-cierre-dialog";
import { Button } from "@/components/ui/button";

import { buscarCierres } from "../_actions";

export type CierreSelectorProps = {
  /** The closing currently rendered, or `null` when there is none. */
  current: { idCierre: number } | null;
};

/**
 * The closing lives in the URL (`?idCierre=`), so reloading re-renders the same
 * report. The label never shows dates, only the closing number.
 */
export function CierreSelector({ current }: CierreSelectorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const confirmar = (cierre: CierreOpcion) => {
    startTransition(() => {
      // Relative: keeps the pathname, replaces the query.
      router.push(`?idCierre=${cierre.idCierre}`);
    });
  };

  return (
    <>
      <Button
        variant="outline"
        className="h-11 w-full justify-start gap-2 sm:w-auto"
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Cargando…
          </>
        ) : (
          <>
            <Search className="size-4" aria-hidden="true" />
            {current ? `Cambiar cierre #${current.idCierre}` : "Seleccionar cierre"}
          </>
        )}
      </Button>

      {/* Mounted only while open: a fresh instance per opening, so no stale
          query, list or selection can survive. */}
      {open ? (
        <BusquedaCierreDialog
          onClose={() => setOpen(false)}
          buscar={buscarCierres}
          onConfirm={confirmar}
        />
      ) : null}
    </>
  );
}
