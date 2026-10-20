"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

import { escapeLike } from "../_lib/kardex-venta";

/**
 * Rejects anything that is not a signed-in administrator.
 *
 * The reference document ships these actions with NO access control and flags
 * it as the place to add it (§12.2). This system has roles, so the guard lives
 * here: relying on the proxy matcher alone would leave the financial data of
 * every client readable by any authenticated session.
 *
 * The report stays GLOBAL (all branches) on purpose — parity with the legacy
 * system (BM-5). Only the role is enforced, not the branch.
 */
async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (session?.user?.UsuarioRolId !== 1) {
    throw new Error("No autorizado");
  }
}

const MS_POR_DIA = 86_400_000;

function aFecha(v: unknown): Date {
  return v instanceof Date ? v : new Date(v as string | number);
}

export interface SaldoKardexVentaRow {
  idCliente: number;
  cliente: string;
  ruc: string;
  /** 1 = PRODUCTO POR ENTREGAR (saldo < 0); 0 = POR COBRAR (saldo 0 incluido, BM-9). */
  idTipo: 0 | 1;
  tipo: string;
  /** ABS(saldo): paridad con el legado; el signo vive en `saldo`. */
  total: number;
  /** Saldo con signo. */
  saldo: number;
  /** Última fecha de referencia; GETDATE() del servidor como fallback. */
  fecha: Date;
  /** true cuando no existía fecha de referencia y se usó el fallback GETDATE(). */
  fechaEsHoy: boolean;
  /** |trunc((FECHA − FECHASIS)/86.400.000)| días; 0 cuando `fechaEsHoy`. */
  diasAntiguedad: number;
  /** ≤15 "bajo", 16–30 "medio", >30 "alto"; siempre "bajo" cuando `fechaEsHoy`. */
  nivelAntiguedad: "bajo" | "medio" | "alto";
}

export interface SaldosKardexVentaResult {
  filas: SaldoKardexVentaRow[];
  /** Sumas de TOTAL por idTipo sobre las filas ya filtradas por cliente. */
  totales: { porCobrar: number; porEntregar: number };
}

type RawSaldoRow = {
  idCliente: unknown;
  IDTIPO: unknown;
  CLIENTE: string | null;
  RUC: string | null;
  TIPO: string | null;
  TOTAL: unknown;
  SALDO: unknown;
  FECHA: Date;
  FECHA_ES_HOY: unknown;
  FECHASIS: Date;
};

function mapSaldoRow(r: RawSaldoRow): SaldoKardexVentaRow {
  const fecha = aFecha(r.FECHA);
  const fechaSis = aFecha(r.FECHASIS);
  const fechaEsHoy = Number(r.FECHA_ES_HOY ?? 0) === 1;

  const diasAntiguedad = fechaEsHoy
    ? 0
    : Math.abs(Math.trunc((fecha.getTime() - fechaSis.getTime()) / MS_POR_DIA));
  const nivelAntiguedad: SaldoKardexVentaRow["nivelAntiguedad"] =
    diasAntiguedad <= 15 ? "bajo" : diasAntiguedad <= 30 ? "medio" : "alto";

  return {
    idCliente: Number(r.idCliente),
    cliente: r.CLIENTE ?? "",
    ruc: r.RUC ?? "",
    idTipo: Number(r.IDTIPO ?? 0) === 1 ? 1 : 0,
    tipo: r.TIPO ?? "",
    total: Number(r.TOTAL ?? 0),
    saldo: Number(r.SALDO ?? 0),
    fecha,
    fechaEsHoy,
    diasAntiguedad,
    nivelAntiguedad,
  };
}

export async function getSaldosKardexVenta(
  filtro: string,
  soloConSaldo = true,
): Promise<SaldosKardexVentaResult> {
  await requireAdmin();

  const texto = escapeLike(filtro);
  const conSaldo = soloConSaldo ? 1 : 0;

  const raw = await db.$queryRaw<RawSaldoRow[]>`
    WITH K AS (
      SELECT VK.idCliente,
             SUM(VK.debe) - SUM(VK.haber)                               AS SALDO,
             MAX(CASE WHEN VK.idVentaKardexTipo = 1 THEN VK.fecha END)  AS F_PENDIENTE,
             MAX(CASE WHEN VK.idVentaKardexTipo = 2 THEN VK.fecha END)  AS F_PAGO,
             MAX(CASE WHEN VK.idVentaKardexTipo = 3 THEN VK.fecha END)  AS F_ANTICIPO
      FROM Venta_Kardex VK
      GROUP BY VK.idCliente
    )
    SELECT K.idCliente,
           CL.NombreCompleto AS CLIENTE,
           CL.Documento      AS RUC,
           CASE WHEN K.SALDO < 0 THEN 1 ELSE 0 END AS IDTIPO,
           CASE WHEN K.SALDO < 0 THEN 'PRODUCTO POR ENTREGAR'
                ELSE 'PRODUCTO POR COBRAR' END AS TIPO,
           ABS(K.SALDO) AS TOTAL,
           K.SALDO AS SALDO,
           COALESCE(CASE WHEN K.SALDO < 0 THEN K.F_PAGO ELSE K.F_PENDIENTE END,
                    K.F_ANTICIPO, GETDATE()) AS FECHA,
           CASE WHEN COALESCE(CASE WHEN K.SALDO < 0 THEN K.F_PAGO ELSE K.F_PENDIENTE END,
                             K.F_ANTICIPO) IS NULL THEN 1 ELSE 0 END AS FECHA_ES_HOY,
           GETDATE() AS FECHASIS
    FROM K
    INNER JOIN Cliente CL ON CL.IDCliente = K.idCliente
    -- ESCAPE '!': el escape es '!' (no '\') para evitar el citado de backslash
    -- entre JS y SQL. Debe coincidir con escapeLike().
    -- Filtro por cliente O por total (ABS(saldo) como texto, "contiene").
    WHERE (CL.NombreCompleto LIKE N'%' + ${texto} + N'%' ESCAPE N'!'
           OR CAST(ABS(K.SALDO) AS VARCHAR(50)) LIKE N'%' + ${texto} + N'%' ESCAPE N'!')
      AND (${conSaldo} = 0 OR K.SALDO <> 0)
    ORDER BY CL.NombreCompleto, K.idCliente
  `;

  const filas = raw.map(mapSaldoRow);

  const totales = { porCobrar: 0, porEntregar: 0 };
  for (const f of filas) {
    if (f.idTipo === 0) totales.porCobrar += f.total;
    else totales.porEntregar += f.total;
  }

  return { filas, totales };
}

export interface MovimientoKardexVentaRow {
  idVentaKardex: number;
  /** Ocultas en la grilla (paridad) pero presentes en el DTO. */
  tipo: string;
  tipoPago: string;
  sucursal: string;
  fechaLiquida: Date;
  /** null cuando BS.PesoSalida es NULL (sin salida con peso). */
  fechaSalida: Date | null;
  /** Se devuelve pero no se muestra (paridad). */
  codigo: string;
  chofer: string;
  concepto: string;
  placa: string;
  guia: string;
  destino: string;
  factura: string;
  producto: string;
  humedad: number;
  qq: number;
  precio: number;
  retencion: number;
  total: number;
  debe: number;
  haber: number;
  /** Saldo acumulado sobre TODOS los movimientos, incluidos los ocultos (BG-1). */
  acumulado: number;
}

export interface MovimientosKardexVentaResult {
  /** Cabecera desde Cliente, no de la primera fila (BM-1). null = no existe. */
  cliente: { idCliente: number; nombre: string; ruc: string } | null;
  /** SUM(debe - haber) de TODOS los movimientos del cliente, con signo. */
  saldoActual: number;
  /** BM-8: dirección derivada del signo de saldoActual. */
  tipo: string;
  movimientos: MovimientoKardexVentaRow[];
}

type RawMovRow = {
  idVentaKardex: unknown;
  TIPO: string | null;
  TIPOPAGO: string | null;
  SUCURSAL: string | null;
  FECHA_LIQUIDA: Date;
  FECHA_SALIDA: Date | null;
  CODIGO: string | null;
  CHOFER: string | null;
  CONCEPTO: string | null;
  PLACA: string | null;
  GUIA: string | null;
  DESTINO: string | null;
  FACTURA: string | null;
  PRODUCTO: string | null;
  HUMEDAD: unknown;
  QQ: unknown;
  PRECIO: unknown;
  RETENCION: unknown;
  TOTAL: unknown;
  DEBE: unknown;
  HABER: unknown;
  ACUMULADO: unknown;
};

function mapMovRow(r: RawMovRow): MovimientoKardexVentaRow {
  return {
    idVentaKardex: Number(r.idVentaKardex),
    tipo: r.TIPO ?? "",
    tipoPago: r.TIPOPAGO ?? "",
    sucursal: r.SUCURSAL ?? "",
    fechaLiquida: aFecha(r.FECHA_LIQUIDA),
    fechaSalida: r.FECHA_SALIDA == null ? null : aFecha(r.FECHA_SALIDA),
    codigo: r.CODIGO ?? "",
    chofer: r.CHOFER ?? "",
    concepto: r.CONCEPTO ?? "",
    placa: r.PLACA ?? "",
    guia: r.GUIA ?? "",
    destino: r.DESTINO ?? "",
    factura: r.FACTURA ?? "",
    producto: r.PRODUCTO ?? "",
    humedad: Number(r.HUMEDAD ?? 0),
    qq: Number(r.QQ ?? 0),
    precio: Number(r.PRECIO ?? 0),
    retencion: Number(r.RETENCION ?? 0),
    total: Number(r.TOTAL ?? 0),
    debe: Number(r.DEBE ?? 0),
    haber: Number(r.HABER ?? 0),
    acumulado: Number(r.ACUMULADO ?? 0),
  };
}

export async function getMovimientosKardexVenta(
  idCliente: number,
): Promise<MovimientosKardexVentaResult> {
  await requireAdmin();

  const movRows = await db.$queryRaw<RawMovRow[]>`
    WITH K AS (
      SELECT VK.idVentaKardex,
             SUM(VK.debe - VK.haber) OVER (ORDER BY VK.fecha, VK.idVentaKardex
                                           ROWS UNBOUNDED PRECEDING) AS ACUMULADO
      FROM Venta_Kardex VK
      WHERE VK.idCliente = CAST(${idCliente} AS INT)
    )
    SELECT VK.idVentaKardex,
           VKT.descripcion AS TIPO,
           VKPT.descripcion AS TIPOPAGO,
           L.[Local] AS SUCURSAL,
           VK.fecha AS FECHA_LIQUIDA,
           CASE WHEN BS.PesoSalida IS NULL THEN NULL ELSE BS.FechaHora END AS FECHA_SALIDA,
           CASE WHEN BE.CodSalida IS NULL THEN N'_____' ELSE BE.CodSalida + N' - ' + BE.CodDia END AS CODIGO,
           ISNULL(CH.Nombres, N'_____') AS CHOFER,
           CAD.ConceptoGeneral AS CONCEPTO,
           CASE WHEN BE.CodSalida IS NULL THEN N'_____' ELSE BE.Placa END AS PLACA,
           CASE WHEN BE.CodSalida IS NULL THEN N'_____' ELSE BS.Guia END AS GUIA,
           CASE WHEN BE.CodSalida IS NULL THEN N'_____' ELSE BS.Destino END AS DESTINO,
           CASE WHEN BE.CodSalida IS NULL THEN N'_____' ELSE CCV.Factura END AS FACTURA,
           CASE WHEN BE.CodSalida IS NULL THEN N'_____' ELSE P.Descripcion END AS PRODUCTO,
           CASE WHEN BE.CodSalida IS NULL THEN 0 ELSE BE.Humedad END AS HUMEDAD,
           CASE WHEN BE.CodSalida IS NULL THEN 0 ELSE CCV.PesoPagar END AS QQ,
           CASE WHEN BE.CodSalida IS NULL THEN 0 ELSE CCV.Precio END AS PRECIO,
           VK.retencion AS RETENCION, VK.total AS TOTAL, VK.debe AS DEBE, VK.haber AS HABER,
           K.ACUMULADO
    FROM K
    INNER JOIN Venta_Kardex VK              ON VK.idVentaKardex = K.idVentaKardex
    INNER JOIN Cliente C                    ON VK.idCliente = C.IDCliente
    -- BG-1 (calcado): los INNER JOIN ocultan movimientos que sí suman al saldo.
    INNER JOIN Conta_Asiento_Detalle CAD    ON VK.idMovimiento = CAD.idAsientoDetalle
    INNER JOIN Venta_Kardex_Pago VKP        ON VK.idVentaKardex = VKP.idVentaKardex
    INNER JOIN Venta_Kardex_Tipo VKT        ON VK.idVentaKardexTipo = VKT.idVentaKardexTipo
    INNER JOIN Venta_Kardex_Pago_Tipo VKPT  ON VKP.idVentaKardexPagoTipo = VKPT.idVentaKardexPagoTipo
    INNER JOIN [Local] L                    ON VK.idLocal = L.IDLocal
    LEFT JOIN BoletoEntradaVenta BE         ON VK.idBoletoDetalle = BE.IDBoletoEntradaVenta
    LEFT JOIN Producto P                    ON BE.IDProducto = P.IDProducto
    LEFT JOIN Chofer CH                     ON VK.idChofer = CH.IDChofer
    LEFT JOIN BoletoSalidaVenta BS          ON BE.IDBoletoEntradaVenta = BS.IDBoletoEntradaVenta
    LEFT JOIN CobroComprobanteVenta CCV     ON BE.IDBoletoEntradaVenta = CCV.IDBoletoEntradaVenta
    ORDER BY VK.fecha, VK.idVentaKardex
  `;

  const [headerRows, saldoRows] = await Promise.all([
    db.$queryRaw<{ NombreCompleto: string | null; Documento: string | null }[]>`
      SELECT NombreCompleto, Documento
      FROM Cliente
      WHERE IDCliente = CAST(${idCliente} AS INT)
    `,
    db.$queryRaw<{ SALDO: unknown }[]>`
      SELECT ISNULL(SUM(VK.debe - VK.haber), 0) AS SALDO
      FROM Venta_Kardex VK
      WHERE VK.idCliente = CAST(${idCliente} AS INT)
    `,
  ]);

  const movimientos = movRows.map(mapMovRow);
  const saldoActual = Number(saldoRows[0]?.SALDO ?? 0);

  // BM-8: el TOTAL de cabecera es el valor absoluto; la dirección la da la etiqueta.
  const tipo = saldoActual < 0 ? "PRODUCTO POR ENTREGAR" : "PRODUCTO POR COBRAR";

  const header = headerRows[0];
  const cliente = header
    ? {
        idCliente: Number(idCliente),
        nombre: header.NombreCompleto ?? "",
        ruc: header.Documento ?? "",
      }
    : null;

  return { cliente, saldoActual, tipo, movimientos };
}
