"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type Celda = { r: number; c: number };

/** True for text that reads as a number once thousands separators are dropped. */
export function esNumerico(texto: string): boolean {
  const limpio = texto.trim();
  if (!limpio) return false;
  return !Number.isNaN(Number(limpio.replace(/,/g, "")));
}

export async function copiarAlPortapapeles(texto: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success("Celda copiada");
  } catch {
    toast.error("No se pudo copiar");
  }
}

export function moverCelda(
  actual: Celda,
  delta: Partial<Celda>,
  rowCount: number,
  colCount: number,
): Celda {
  const r = Math.min(Math.max(actual.r + (delta.r ?? 0), 0), Math.max(rowCount - 1, 0));
  const c = Math.min(Math.max(actual.c + (delta.c ?? 0), 0), Math.max(colCount - 1, 0));
  return { r, c };
}

function estaEnCampoDeTexto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Keyboard navigation over a grid, Excel-style: arrows move a cell, Home/End
 * jump to the row edge, PageUp/PageDown jump by `pageSize`, and Ctrl/Cmd+C
 * copies the active cell's text.
 *
 * Ctrl/Cmd + ←/→ (page jump) is disabled when `paginate` is false, matching the
 * report tables that render everything at once.
 */
export function useExcelNavigation({
  rowCount,
  colCount,
  pageSize = 25,
  paginate = true,
  resetKey,
  containerRef,
  getCellElement,
  onBeforeScrollToCell,
}: {
  rowCount: number;
  colCount: number;
  pageSize?: number;
  paginate?: boolean;
  resetKey?: unknown;
  containerRef: React.RefObject<HTMLElement | null>;
  getCellElement: (celda: Celda) => HTMLElement | null;
  /** Lets a virtualized table scroll the window first, so the cell is mounted. */
  onBeforeScrollToCell?: (celda: Celda) => void;
}) {
  const [activa, setActiva] = useState<Celda>({ r: 0, c: 0 });
  const ctrlRef = useRef(false);

  // Reset the active cell whenever the dataset changes identity.
  useEffect(() => {
    setActiva({ r: 0, c: 0 });
  }, [resetKey]);

  // Keep the active cell mounted and visible.
  useEffect(() => {
    if (rowCount <= 0 || colCount <= 0) return;
    onBeforeScrollToCell?.(activa);
    const el = getCellElement(activa);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activa, rowCount, colCount, getCellElement, onBeforeScrollToCell]);

  const mover = useCallback(
    (delta: Partial<Celda>) => {
      setActiva((actual) => moverCelda(actual, delta, rowCount, colCount));
    },
    [rowCount, colCount],
  );

  const seleccionar = useCallback(
    (celda: Celda) => {
      if (celda.r < 0 || celda.c < 0) return;
      if (celda.r >= rowCount || celda.c >= colCount) return;
      setActiva(celda);
      containerRef.current?.focus();
    },
    [rowCount, colCount, containerRef],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (estaEnCampoDeTexto(e.target)) return;
      const enOtraGrilla =
        e.target instanceof HTMLElement &&
        e.target.closest('[role="grid"]') !== containerRef.current;
      if (enOtraGrilla) return;

      const meta = e.ctrlKey || e.metaKey;

      if (meta && (e.key === "c" || e.key === "C")) {
        const el = getCellElement(activa);
        const texto = el?.textContent?.trim() ?? "";
        if (texto) {
          void copiarAlPortapapeles(texto);
          e.preventDefault();
        }
        return;
      }

      if (meta) {
        if (!paginate) return;
        if (e.key === "ArrowRight") {
          mover({ c: colCount - 1 });
          e.preventDefault();
        } else if (e.key === "ArrowLeft") {
          mover({ c: -colCount });
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          mover({ r: 1 });
          break;
        case "ArrowUp":
          mover({ r: -1 });
          break;
        case "ArrowRight":
          mover({ c: 1 });
          break;
        case "ArrowLeft":
          mover({ c: -1 });
          break;
        case "Home":
          setActiva((a) => ({ ...a, c: 0 }));
          break;
        case "End":
          setActiva((a) => ({ ...a, c: Math.max(colCount - 1, 0) }));
          break;
        case "PageDown":
          mover({ r: pageSize });
          break;
        case "PageUp":
          mover({ r: -pageSize });
          break;
        default:
          return;
      }
      e.preventDefault();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activa, colCount, containerRef, getCellElement, mover, pageSize, paginate]);

  return {
    activa,
    seleccionar,
    esActiva: (r: number, c: number) => activa.r === r && activa.c === c,
    ctrlRef,
  };
}
