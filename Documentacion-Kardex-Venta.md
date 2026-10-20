# Documentación — Reporte Kardex de Venta (Next.js, `/ventas/operaciones/kardex-venta`)

> **Qué es este documento.** Describe, con el detalle suficiente para replicarlo 1:1, el módulo **Kardex de Venta** tal como está implementado hoy en este repositorio (no como estaba especificado). Sirve para que otro equipo lo reconstruya en un **sistema Next.js admin distinto que comparte la misma base SQL Server**.
>
> **Regla de oro de este documento.** Todo lo que aparece acá sale de leer el código del repositorio. Las consultas SQL están copiadas **verbatim** del código. Donde algo no se puede determinar leyendo el código se escribe **`a confirmar`** en lugar de inventarlo.
>
> **Fuente de verdad de la migración desde WinForms.** `app/(main)/ventas/operaciones/Documentacion-Reporte-Venta-Excel.md` (en adelante **"el doc legacy"**), que documenta el módulo WinForms `Venta/LiquidacionVenta/VentaPendienteEditar/ReporteVentaExcel`. Este documento cita el doc legacy solo donde aporta semántica de negocio (catálogos, régimen de bugs), y marca explícitamente **qué se corrigió** respecto de él.
>
> **Decisiones de producto.** `odd/tasks/reporte-kardex-venta.md` (en adelante **"el log de decisiones"**). Algunas decisiones del log fueron reemplazadas después (ver §9): el log es historia, el código es la verdad.
>
> **Estado:** documentación de solo lectura. No se modificó ninguna fuente.

---

## Índice

1. [Propósito y alcance](#1-propósito-y-alcance)
2. [Acceso y seguridad](#2-acceso-y-seguridad)
3. [Modelo de datos](#3-modelo-de-datos)
4. [Server actions](#4-server-actions)
5. [Helpers puros](#5-helpers-puros)
6. [UI pantalla 1 — lista de saldos por cliente](#6-ui-pantalla-1--lista-de-saldos-por-cliente)
7. [UI pantalla 2 — historial de movimientos](#7-ui-pantalla-2--historial-de-movimientos)
8. [Formatos de números y fechas](#8-formatos-de-números-y-fechas)
9. [Diferencias intencionales vs legacy WinForms](#9-diferencias-intencionales-vs-legacy-winforms)
10. [Dependencias a replicar](#10-dependencias-a-replicar)
11. [Checklist de réplica paso a paso](#11-checklist-de-réplica-paso-a-paso)
12. [Limitaciones conocidas, riesgos y pendientes](#12-limitaciones-conocidas-riesgos-y-pendientes)

---

## 1. Propósito y alcance

### 1.1 Qué resuelve

Dos pantallas de **solo consulta** sobre el kardex de venta (`Venta_Kardex`):

| Pantalla | Propósito | Origen en WinForms |
|---|---|---|
| **1. Lista de saldos por cliente** | Una fila por cliente con su saldo de kardex, la dirección del saldo (por cobrar / por entregar), el importe absoluto y una fecha de referencia con escala de antigüedad. | `FrmReporteExcelVentaTotal` ("REPORTE KARDEX DE VENTA") |
| **2. Historial de movimientos de un cliente** | Todos los movimientos visibles de un cliente, en orden cronológico, con un saldo acumulado (`SALDO`), más una cabecera con cliente/RUC/total absoluto/tipo. | `FrmReporteExcelVentaHistorial` (modal en WinForms; **página con URL propia** acá) |

En la pantalla 1 la **lupa** de cada fila navega a la pantalla 2 del mismo cliente. Ese es el único vínculo entre ambas.

**No exporta nada.** El nombre "Excel" del módulo WinForms es histórico: ninguna de las dos pantallas genera archivos (doc legacy §1.2, Bm-7). Tampoco hay exportación en esta implementación.

### 1.2 Mapa de rutas

```text
/ventas/operaciones/kardex-venta               → Pantalla 1 (lista de saldos)
/ventas/operaciones/kardex-venta/[idCliente]   → Pantalla 2 (historial del cliente)
```

`[idCliente]` es un **segmento dinámico de Next.js** y se parsea con `Number(idCliente)` (§4.4).

### 1.3 Archivos de la feature

| Archivo | Tipo | Rol |
|---|---|---|
| `app/(main)/ventas/operaciones/kardex-venta/page.tsx` | `"use client"` | Pantalla 1 completa: filtro, tarjetas de resumen, grilla. |
| `app/(main)/ventas/operaciones/kardex-venta/[idCliente]/page.tsx` | **Server Component** (async) | Pantalla 2: valida el id, llama la action, arma la cabecera y delega la grilla. |
| `app/(main)/ventas/operaciones/kardex-venta/_components/kardex-venta-historial-tabla.tsx` | `"use client"` | Grilla del historial (columnas + medición de anchos + `ReportTable`). Es client porque pasa funciones `render` a `ReportTable`. |
| `app/(main)/ventas/operaciones/kardex-venta/_actions/index.ts` | `"use server"` | Las dos server actions, los DTOs y los mapeadores. |
| `app/(main)/ventas/operaciones/kardex-venta/_lib/kardex-venta.ts` | módulo puro | `escapeLike`, `formatFechaVenta`, `formatFechaMovimiento`. |
| `app/(main)/ventas/operaciones/kardex-venta/_lib/kardex-venta.test.ts` | test | 15 tests unitarios de los helpers (Vitest, entorno `node`). |

### 1.4 Navegación: el tab

El módulo vive dentro del submenú **Ventas · Operaciones**, que es una barra de tabs.

`app/(main)/ventas/operaciones/layout.tsx`:

```tsx
export default function OperacionesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="-m-6 overflow-hidden"
      style={{ height: "calc(100svh - 3rem)", display: "grid", gridTemplateRows: "auto 1fr" }}
    >
      <OperacionesNav />
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
```

- `-m-6` cancela el `p-6` del `<main>` del layout principal.
- `calc(100svh - 3rem)` = viewport menos el header de 12 (`h-12`) del shell.
- Grid de 2 filas: `auto` (tabs) + `1fr` (contenido), con `min-h-0` en la fila de contenido para permitir scroll interno.

El tab se declara en `app/(main)/ventas/operaciones/_components/operaciones-nav.tsx`:

```tsx
const TABS: { label: string; href: string; Icon: LucideIcon }[] = [
  { label: "Operaciones Generales", href: "/ventas/operaciones/generales", Icon: Activity },
  { label: "Pago de Ventas", href: "/ventas/operaciones/pago-ventas", Icon: Wallet },
  { label: "Anticipo Transportista", href: "/ventas/operaciones/anticipo-transportista", Icon: Truck },
  { label: "Kardex de Venta", href: "/ventas/operaciones/kardex-venta", Icon: ClipboardList },
  { label: "Retención", href: "/ventas/operaciones/retencion", Icon: Percent },
]
```

Marcado de activo:

```tsx
const isActive = pathname === href || pathname.startsWith(href + "/")
```

Por eso **el tab sigue activo en la pantalla 2** (`/kardex-venta/40116` hace `startsWith("/ventas/operaciones/kardex-venta/")`).

Notas de réplica:

- `TABS_LOCAL_1` (Ingreso por Ventas, Pago de Comisión, Pérdida) se agrega **solo** cuando `useUserStore((s) => s.IDLocal) === 1`. **Kardex de Venta no depende de esa condición**: está siempre visible.
- Los tabs son `<Link>` de `next/link` con icono Lucide `size-3.5 shrink-0`, texto `text-xs font-semibold tracking-wide uppercase whitespace-nowrap`, barra inferior `border-b-2` (`border-primary` activo / `border-transparent` inactivo).
- `app/(main)/ventas/operaciones/page.tsx` redirige a `/ventas/operaciones/generales` (primer tab). No participa del kardex.

### 1.5 Layout de cada pantalla (patrón de altura fija)

Ambas páginas usan el mismo patrón, necesario porque `ReportTable` con `fill` toma `h-full`:

- Contenedor de página: `flex h-full min-h-0 flex-col gap-4 overflow-hidden p-6`.
- Bloques que **no** son la tabla: `shrink-0`.
- Envoltorio de la tabla: `min-h-0 flex-1`.

Si se omite `min-h-0`, el `h-full` interno de `ReportTable` desborda el `overflow-hidden` de la página y el último registro queda inalcanzable (ajuste registrado en el log de decisiones, fila "T2 ajuste (2026-10-13)").

---

## 2. Acceso y seguridad

### 2.1 Qué exige el código, exactamente

Hay **dos capas de autenticación** y **ninguna de autorización**:

**Capa 1 — proxy/middleware de NextAuth.** `proxy.ts` (en Next 16 el archivo se llama `proxy.ts`, no `middleware.ts`):

```ts
import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

const { auth } = NextAuth(authConfig)

export const proxy = auth

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
}
```

`auth.config.ts` define el callback `authorized`:

```ts
authorized({ auth, request: { nextUrl } }) {
  const isLoggedIn = !!auth?.user
  const isOnLogin = nextUrl.pathname === "/login"

  if (isOnLogin) {
    if (isLoggedIn) return Response.redirect(new URL("/", nextUrl))
    return true
  }

  if (!isLoggedIn) return false
  return true
}
```

Con `return false`, NextAuth redirige a `pages.signIn` = `/login`. El matcher cubre **todas** las rutas salvo `_next/static`, `_next/image`, `favicon.ico` y `api/auth`, es decir: cubre `/ventas/operaciones/kardex-venta` y también los POST de Server Actions sobre esa ruta.

**Capa 2 — layout del grupo `(main)`.** `app/(main)/layout.tsx`:

```tsx
const session = await auth()

if (!session) {
  redirect("/login")
}
```

Esta capa es la que garantiza que los componentes server-rendered de la pantalla 2 nunca se ejecuten sin sesión.

### 2.2 Qué NO hay

| Control | Estado en esta feature |
|---|---|
| Verificación de rol (`RolUsuario`, `UsuarioRolId`) | **No existe.** Ni la página ni las actions leen el rol. |
| Filtro o restricción por sucursal (`IDLocal`) | **No existe, por diseño.** El reporte es global: agrega `Venta_Kardex` de todas las sucursales (`GROUP BY VK.idCliente`, sin `WHERE idLocal`). El doc legacy lo confirma como comportamiento deseado (BM-5, "Resuelto: calcar") y el README del módulo lo repite: "No filtrar por `idLocal`: el reporte es global para todas las sucursales (decisión confirmada, doc §1.1)". |
| Verificación de sesión dentro de las server actions | **No existe.** `getSaldosKardexVenta` y `getMovimientosKardexVenta` no llaman a `auth()` ni validan nada del usuario. |
| Validación de que `idCliente` pertenezca al usuario | No aplica (reporte global), pero el id **sí** se valida como entero positivo (§4.3). |
| Rate limiting / auditoría de acceso | No existe. |

**Bandera para el sistema admin nuevo:** esta feature asume que el shell (proxy + layout) es la única barrera. Si el nuevo sistema expone Server Actions o un endpoint equivalente sin el mismo middleware, cualquier usuario anónimo puede leer saldos y movimientos de todos los clientes. En este repo hay acciones del mismo dominio que **sí** validan sesión y sucursal dentro de la action (p. ej. `obtenerVentasCopiarKardex` en `app/(main)/cierre/reporte/_actions/ventas.ts` usa `usuarioActual()`, `autorizarAccesoSucursal` y verifica pertenencia del cierre). Si el nuevo admin tiene roles o alcance por sucursal, **esta es la feature donde hay que agregarlos**; replicar 1:1 implica replicar también la ausencia de control.

### 2.3 Campos de sesión disponibles (no usados)

`auth.ts` arma el token/sesión con: `IDUsuario`, `IDLocal`, `UsuarioRolId`, `RolUsuario`, `NombreUsuario`, `Local` (tipados en `types/next-auth.d.ts`). El login es `Credentials` (`nombreUsuario`, `clave`, `idLocal`) contra `db.usuario` y valida `Estado !== true` → error "Usuario inactivo".

**Esta feature no consume ninguno de esos campos.** El único consumidor cercano es `OperacionesNav`, que lee `IDLocal` desde un store de Zustand (`useUserStore`) para decidir si muestra `TABS_LOCAL_1`.

### 2.4 Qué pasa sin sesión

1. El proxy intercepta la request y NextAuth redirige a `/login`.
2. Si por alguna razón el proxy no actuara, `app/(main)/layout.tsx` hace `redirect("/login")`.
3. Nunca se llega a ejecutar el SQL.

### 2.5 Superficie de datos

- El SQL es **parametrizado** (tagged templates de Prisma): no hay concatenación de texto del usuario (§4.1). No hay riesgo de inyección por el filtro ni por `idCliente`.
- Los comodines `LIKE` del usuario se escapan (§5.1), lo que además evita que un usuario use `%` para forzar un escaneo con patrón arbitrario.

---

## 3. Modelo de datos

Base: **SQL Server**, accedida con Prisma (`@prisma/client` 5.22 + `db.$queryRaw`), nunca con `$queryRawUnsafe`. Los nombres de tabla/columna son los de la base legacy tal cual (mayúsculas y guiones bajos incluidos).

### 3.1 Tablas y columnas usadas

Tipos tomados de `prisma/schema.prisma` (que refleja la base: `@db.Decimal(18, 2)` = `decimal(18,2)`, `@db.NVarChar(Max)` = `nvarchar(max)`, `@db.DateTime` = `datetime`, `@db.Date` = `date`).

**`Venta_Kardex`** — el kardex propiamente dicho (una fila = un movimiento de cuenta corriente del cliente).

| Columna | Tipo Prisma | Uso en esta feature |
|---|---|---|
| `idVentaKardex` | `Int` PK, autoincrement | Identidad del movimiento; desempate del acumulado y del orden; `key` de fila en la grilla del historial. |
| `idVentaKardexTipo` | `Int?` | 1 = PENDIENTE, 2 = PAGO, 3 = ANTICIPO (usados en la lista para elegir la FECHA); el resto del catálogo se muestra como `TIPO` en el historial. |
| `idMovimiento` | `Int?` | JOIN a `Conta_Asiento_Detalle` (concepto contable). |
| `idBoletoDetalle` | `Int?` | JOIN a `BoletoEntradaVenta` (boleto/guía). |
| `idCliente` | `Int?` | Clave del reporte (`GROUP BY` en la lista, `WHERE` en el historial). |
| `idChofer` | `Int?` | JOIN a `Chofer`. |
| `idLocal` | `Int?` | JOIN a `Local` (nombre de sucursal). **No se usa para filtrar.** |
| `porcenRetencion` | `Decimal(18,2)?` | **No se usa.** |
| `retencion` | `Decimal(18,2)?` | Columna `Retención` del historial. |
| `total` | `Decimal(18,2)?` | Columna `Total` del historial. |
| `debe` | `Decimal(18,2)?` | Sumando positivo del saldo. |
| `haber` | `Decimal(18,2)?` | Sumando negativo del saldo. |
| `fecha` | `DateTime?` | FECHA del movimiento (liquida), eje del acumulado y del orden. |

`Venta_Kardex` **no declara ninguna `@relation` en el schema**: los JOIN son por convención, sin FK. (El doc legacy lo confirma para la base: "No hay FK declaradas en `Venta_Kardex`", §6.2.)

**`Cliente`** — cabecera de cliente.

| Columna | Tipo | Uso |
|---|---|---|
| `IDCliente` | `Int` PK | JOIN y `idCliente` del DTO. |
| `NombreCompleto` | `NVarChar(Max)?` | `CLIENTE` en la lista, `cliente.nombre` en la cabecera del historial, criterio de `ORDER BY` y de `LIKE`. |
| `Documento` | `NVarChar(Max)?` | `RUC`. |

**`Venta_Kardex_Pago`** — pago asociado al movimiento.

| Columna | Tipo | Uso |
|---|---|---|
| `idVentaKardexPago` | `Int` PK | — |
| `idVentaKardexPagoTipo` | `Int?` | JOIN a `Venta_Kardex_Pago_Tipo`. |
| `idVentaKardex` | `Int?` | JOIN al kardex. |

(Otras columnas de la tabla: `idMovimiento`, `idVariable`, `cantidad`, `nDocumento`, `nota`, `fecha` — no se leen.)

**`Venta_Kardex_Tipo`** — catálogo de tipos de movimiento.

| Columna | Tipo | Uso |
|---|---|---|
| `idVentaKardexTipo` | `Int` PK | — |
| `descripcion` | `NVarChar(50)?` | `TIPO` del historial (llega al DTO, **no se muestra**). |

**`Venta_Kardex_Pago_Tipo`** — catálogo de tipos de pago.

| Columna | Tipo | Uso |
|---|---|---|
| `idVentaKardexPagoTipo` | `Int` PK | — |
| `idVentaKardexTipo` | `Int?` | — |
| `descripcion` | `NVarChar(50)?` | `TIPOPAGO` del historial (llega al DTO, **no se muestra**). |

**`Local`** — sucursal.

| Columna | Tipo | Uso |
|---|---|---|
| `IDLocal` | `Int` PK | JOIN. |
| `Local` | `NVarChar(Max)?` | `SUCURSAL` del historial. |

**`Conta_Asiento_Detalle`** — asiento contable.

| Columna | Tipo | Uso |
|---|---|---|
| `idAsientoDetalle` | `Int` PK | JOIN (`VK.idMovimiento`). |
| `ConceptoGeneral` | `NVarChar(250)?` | `CONCEPTO` del historial. |

**`BoletoEntradaVenta`** — boleto de entrada de la romana.

| Columna | Tipo | Uso |
|---|---|---|
| `IDBoletoEntradaVenta` | `Int` PK | JOIN (`VK.idBoletoDetalle`). |
| `CodSalida` | `NVarChar(50)` NOT NULL | Determina el "hay boleto" (`CodSalida IS NULL`): `CODIGO` y todos los placeholders `'_____'`. |
| `CodDia` | `NVarChar(50)?` | `CODIGO` (`CodSalida + ' - ' + CodDia`). |
| `IDProducto` | `Int?` | JOIN a `Producto`. |
| `Placa` | `NVarChar(Max)?` | `PLACA`. |
| `Humedad` | `Decimal(8,2)?` | `HUMEDAD`. |

**`BoletoSalidaVenta`** — salida/guía.

| Columna | Tipo | Uso |
|---|---|---|
| `IDBoletoSalidaVenta` | `Int` PK | — |
| `IDBoletoEntradaVenta` | `Int?` | JOIN al boleto de entrada. |
| `PesoSalida` | `Decimal(10,2)?` | Determina si hay fecha de salida (`PesoSalida IS NULL`). |
| `Guia` | `NVarChar(Max)?` | `GUIA`. |
| `Destino` | `NVarChar(Max)?` | `DESTINO` (llega a 2000+ caracteres: doc legacy §6.2). |
| `FechaHora` | `DateTime?` | `FECHA_SALIDA`. |

**`CobroComprobanteVenta`** — cobro/facturación del boleto.

| Columna | Tipo | Uso |
|---|---|---|
| `IDComprobanteVenta` | `Int` PK | — |
| `IDBoletoEntradaVenta` | `Int?` | JOIN al boleto de entrada. |
| `Factura` | `NVarChar(Max)?` | `FACTURA`. |
| `PesoPagar` | `Decimal(18,2)?` | `QQ`. |
| `Precio` | `Decimal(18,8)?` | `PRECIO`. |

**`Producto`** — producto vendido.

| Columna | Tipo | Uso |
|---|---|---|
| `IDProducto` | `Int` PK | JOIN. |
| `Descripcion` | `NVarChar(Max)?` | `PRODUCTO`. |

**`Chofer`** — transportista.

| Columna | Tipo | Uso |
|---|---|---|
| `IDChofer` | `Int` PK | JOIN (`VK.idChofer`). |
| `Nombres` | `NVarChar(250)?` | `CHOFER` (placeholder `'_____'` si es NULL). |

### 3.2 Joins, tal como están

**Lista (pantalla 1)** — un solo JOIN, porque la lista solo necesita el nombre y el RUC:

```text
Venta_Kardex VK  ──(GROUP BY idCliente, sin joins)──►  K
K  INNER JOIN  Cliente CL  ON CL.IDCliente = K.idCliente
```

`INNER JOIN` (no `LEFT`) ⇒ **si el cliente no existe en `Cliente`, ese saldo desaparece del reporte**. Es intencional (doc legacy §4.2: "El `INNER JOIN Cliente` excluye la fila corrupta con `idCliente NULL`") y además hace que `CLIENTE`/`RUC` nunca sean NULL en la práctica (el DTO igual los coacciona con `?? ""`).

**Historial (pantalla 2)** — el set completo heredado del SP `dbo.REPORTE_VENTA_KARDEX`:

| JOIN | Tabla | Cláusula | Efecto |
|---|---|---|---|
| INNER | `Venta_Kardex VK` | `VK.idVentaKardex = K.idVentaKardex` | Reengancha el CTE con la tabla base. |
| INNER | `Cliente C` | `VK.idCliente = C.IDCliente` | — |
| INNER | `Conta_Asiento_Detalle CAD` | `VK.idMovimiento = CAD.idAsientoDetalle` | **oculta** movimientos sin asiento |
| INNER | `Venta_Kardex_Pago VKP` | `VK.idVentaKardex = VKP.idVentaKardex` | **oculta** movimientos sin fila de pago |
| INNER | `Venta_Kardex_Tipo VKT` | `VK.idVentaKardexTipo = VKT.idVentaKardexTipo` | — |
| INNER | `Venta_Kardex_Pago_Tipo VKPT` | `VKP.idVentaKardexPagoTipo = VKPT.idVentaKardexPagoTipo` | — |
| INNER | `[Local] L` | `VK.idLocal = L.IDLocal` | **oculta** movimientos sin local |
| LEFT | `BoletoEntradaVenta BE` | `VK.idBoletoDetalle = BE.IDBoletoEntradaVenta` | boleto (puede faltar) |
| LEFT | `Producto P` | `BE.IDProducto = P.IDProducto` | producto |
| LEFT | `Chofer CH` | `VK.idChofer = CH.IDChofer` | chofer |
| LEFT | `BoletoSalidaVenta BS` | `BE.IDBoletoEntradaVenta = BS.IDBoletoEntradaVenta` | salida/guía |
| LEFT | `CobroComprobanteVenta CCV` | `BE.IDBoletoEntradaVenta = CCV.IDBoletoEntradaVenta` | cobro/factura |

**Consecuencia crítica (bug BG-1, calcado a propósito):** el acumulado `ACUMULADO` se calcula en el CTE `K` sobre **todos** los movimientos del cliente (`WHERE VK.idCliente = ...`, sin joins), pero la grilla solo muestra los que pasan los `INNER JOIN`. Por eso el `SALDO` visible puede "saltar" sin fila que lo explique. Ejemplo real del doc legacy (§6.3, cliente 40116): 3.ª fila visible con `-13.66` cuando la aritmética de lo visible daría `93.50`. **Se calca a propósito** (decisión del usuario, doc legacy §9 BG-1 y log de decisiones). Arreglarlo (pasar a `LEFT JOIN` + marca "sin asiento") es fase 2.

Nota de cardinalidad: `BoletoSalidaVenta` y `CobroComprobanteVenta` se unen por `IDBoletoEntradaVenta` **sin garantía de unicidad**. Si un boleto tiene 2 cobros, el movimiento aparece 2 veces en la grilla pero el `ACUMULADO` lo cuenta una sola vez (bug BM-6, "Calcar"; hoy latente según el doc legacy).

### 3.3 Semántica de columnas derivadas

#### Lista — cómo se deriva el saldo

| Campo SQL | Regla exacta |
|---|---|
| `SALDO` | `SUM(VK.debe) - SUM(VK.haber)` de **todo** `Venta_Kardex` del cliente, sin filtro de sucursal ni de fecha. |
| `IDTIPO` | `CASE WHEN K.SALDO < 0 THEN 1 ELSE 0 END` → **1 = saldo negativo; 0 = saldo ≥ 0** (saldo 0 cuenta como "por cobrar"). |
| `TIPO` | `1` → `'PRODUCTO POR ENTREGAR'`; `0` → `'PRODUCTO POR COBRAR'`. |
| `TOTAL` | `ABS(K.SALDO)` — el signo se pierde; la dirección la da `TIPO`. |
| `SALDO` (devuelto) | El saldo **con signo** (nuevo respecto del legacy, doc legacy §7.2). |
| `F_PENDIENTE` | `MAX(fecha)` de los movimientos con `idVentaKardexTipo = 1` (PENDIENTE). |
| `F_PAGO` | `MAX(fecha)` con `idVentaKardexTipo = 2` (PAGO). |
| `F_ANTICIPO` | `MAX(fecha)` con `idVentaKardexTipo = 3` (ANTICIPO). |
| `FECHA` | `COALESCE(CASE WHEN SALDO < 0 THEN F_PAGO ELSE F_PENDIENTE END, F_ANTICIPO, GETDATE())`. Es decir: **por entregar → última PAGO; por cobrar → última PENDIENTE; si no hay, última ANTICIPO; si tampoco, el reloj del servidor.** (Regla confirmada por el usuario, doc legacy Bm-3 / §11.) |
| `FECHA_ES_HOY` | `1` cuando el `COALESCE` anterior dio NULL (se usó `GETDATE()`), si no `0`. |
| `FECHASIS` | `GETDATE()` del servidor de base. |

#### Historial — signos y acumulado

| Campo | Regla |
|---|---|
| `ACUMULADO` | `SUM(VK.debe - VK.haber) OVER (ORDER BY VK.fecha, VK.idVentaKardex ROWS UNBOUNDED PRECEDING)`, calculado en el CTE sobre **todos** los movimientos del cliente (incluidos los que los `INNER JOIN` ocultan). |
| `saldoActual` (cabecera) | `ISNULL(SUM(VK.debe - VK.haber), 0)` sobre **todos** los movimientos del cliente, con signo, en una consulta aparte. |
| `tipo` (cabecera) | Derivado **en TypeScript** del signo: `saldoActual < 0` → `"PRODUCTO POR ENTREGAR"`, si no → `"PRODUCTO POR COBRAR"`. |
| `TOTAL` de la cabecera | `Math.abs(saldoActual)` formateado (BM-8: el signo no se muestra, la dirección la da la etiqueta). |

**Convención de color/signo en toda la feature:** verde = a favor del cliente en términos de "producto por cobrar" (`idTipo === 0`, `acumulado > 0`); rojo (`text-destructive`) = "producto por entregar" (`idTipo === 1`, `acumulado < 0`).

#### Catálogo `Venta_Kardex_Tipo` (contexto de negocio, del doc legacy §6.1)

El doc legacy relevó en la base estos valores y el signo con el que se usan: `1 PENDIENTE` (debe), `2 PAGO` (haber), `3 ANTICIPO` (debe), `4 PERDIDA` (haber), `5 AJUSTE` (haber/debe), `6 INGRESO` (debe), `7 NO COBRADO` (mixto), `8 COMISION` (sin uso). **Esta feature solo depende de 1, 2 y 3** (para elegir la FECHA). El resto únicamente aparece como texto en `TIPO` (que además no se muestra). `a confirmar` en el sistema nuevo si se quieren reglas de negocio por tipo: acá no hay ninguna.

#### Diferencia de NULLs entre las dos fórmulas de saldo (riesgo latente)

`debe` y `haber` son **nullable**. Las dos consultas no tratan el NULL igual:

- Lista: `SUM(VK.debe) - SUM(VK.haber)` → `SUM` **ignora** NULLs; una fila con `debe = NULL, haber = 100` aporta `-100`.
- Historial: `SUM(VK.debe - VK.haber)` y el `OVER` → `NULL - 100 = NULL`, y `SUM`/ventana **ignoran la fila completa**; esa fila aporta `0`.

Con datos donde ambas columnas siempre tienen valor, los dos números coinciden. Si existieran filas con una sola columna cargada, la lista y el historial podrían discrepar. **`a confirmar`** contra la base (no se ejecutó SQL en esta revisión).

### 3.4 Índices existentes

Según el doc legacy (§6.2), `Venta_Kardex`, `Venta_Kardex_Pago`, `BoletoSalidaVenta` y `CobroComprobanteVenta` **solo tienen la PK**. En `prisma/schema.prisma` el único índice declarado en las tablas de esta feature es `Conta_Asiento_Detalle.@@index([Fecha], map: "NonClusteredIndex-20240128-231214")`. Los índices propuestos en el doc legacy §7.3 **no están aplicados** en este repo (no hay migración que los cree).

---

## 4. Server actions

Archivo único: `app/(main)/ventas/operaciones/kardex-venta/_actions/index.ts`, con `"use server"` en la primera línea. Dos exports: `getSaldosKardexVenta` y `getMovimientosKardexVenta`.

### 4.1 Ejecución del SQL

- Prisma vía **tagged template** `db.$queryRaw<T[]>` + `` `...` ``. Cada `${...}` se convierte en un **parámetro** (`@P1`, `@P2`, …) del comando; **el texto del usuario nunca se concatena**.
- `db` viene de `lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
```

  Es el patrón singleton para no abrir un pool nuevo en cada hot reload.
- **No se usa `$queryRawUnsafe`, ni `mssql`, ni stored procedures.** Las dos consultas son texto nuevo (doc legacy §7.2); **el SP `dbo.REPORTE_VENTA_KARDEX` no se invoca desde acá** (lo siguen usando WinForms y Crystal según el doc legacy).
- Consecuencia de los tagged templates: los alias SQL llegan a JS con el **case exacto** que se escribió (`CLIENTE`, `IDTIPO`, `FECHA_LIQUIDA`, …), mientras que los identificadores de tabla/columna se escriben con el case de la base. Los tipos `Raw*` del archivo dependen de eso.

### 4.2 Pantalla 1 — `getSaldosKardexVenta`

```ts
export async function getSaldosKardexVenta(
  filtro: string,
  soloConSaldo = true,
): Promise<SaldosKardexVentaResult>
```

**Entradas**

| Parámetro | Tipo | Origen | Validación |
|---|---|---|---|
| `filtro` | `string` | Texto del `Input` (máx. 250 caracteres por `maxLength`) | Se pasa por `escapeLike()`; no se recorta, no se normaliza, no se valida longitud en el servidor. Un `""` devuelve todo. |
| `soloConSaldo` | `boolean` (default `true`) | `Select` "Solo con saldo" / "Todos" | Se convierte a `1`/`0` y se pasa como parámetro. |

**Parámetros dentro del SQL:** `${texto}` = filtro ya escapado (se usa dos veces: nombre y total), `${conSaldo}` = 1 (solo con saldo) / 0 (todos).

**SQL (verbatim del código):**

```sql
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
    -- ESCAPE '!': el doc usa '\' pero '!' es equivalente para Bm-12 y evita
    -- los riesgos de citado de backslash entre JS y SQL.
    -- BM-9 (fase 2): filtro opcional de clientes con saldo <> 0.
    -- Filtro por cliente O por total (ABS(saldo) como texto, "contiene").
    WHERE (CL.NombreCompleto LIKE N'%' + ${texto} + N'%' ESCAPE N'!'
           OR CAST(ABS(K.SALDO) AS VARCHAR(50)) LIKE N'%' + ${texto} + N'%' ESCAPE N'!')
      AND (${conSaldo} = 0 OR K.SALDO <> 0)
    ORDER BY CL.NombreCompleto, K.idCliente
```

**Reglas del `WHERE`, una por una:**

1. `CL.NombreCompleto LIKE N'%' + @texto + N'%'` — coincidencia **"contiene"**, evaluada **en el servidor** para conservar la intercalación de la base (`Modern_Spanish_CI_AS` según el doc legacy §2.3: sin distinguir mayúsculas, pero sí acentos; `Ñ` ≠ `N`). No se usa `LOWER()` ni `COLLATE` explícito en el código: la semántica depende de la collation de la columna.
2. `OR CAST(ABS(K.SALDO) AS VARCHAR(50)) LIKE N'%' + @texto + N'%'` — el **mismo filtro aplicado al importe** para poder buscar clientes por monto. `VARCHAR` sin estilo produce el número **sin separador de miles y con punto decimal** (`287092.92`), no `287,092.92`. Ver §12: esto es una trampa de usabilidad conocida.
3. `ESCAPE N'!'` en ambos `LIKE`, coherente con `escapeLike()` (§5.1). El doc legacy proponía `ESCAPE N'\'`; el código usa `!` (documentado en comentario del archivo y en el log de decisiones).
4. `AND (@conSaldo = 0 OR K.SALDO <> 0)` — **BM-9 (fase 2)**: por defecto (`soloConSaldo = true`) se omiten los clientes con saldo exactamente 0; con `false` se comporta como el legacy / fase 1 (los incluye).

**Orden (BM-3):** `ORDER BY CL.NombreCompleto, K.idCliente` — ascendente por nombre de cliente, con `idCliente` como desempate determinista. El legacy no tenía `ORDER BY`.

**Totales:** se calculan en TypeScript sobre las filas **ya filtradas** (no hay segunda consulta):

```ts
const totales = { porCobrar: 0, porEntregar: 0 }
for (const f of filas) {
  if (f.idTipo === 0) totales.porCobrar += f.total
  else totales.porEntregar += f.total
}
```

- Se suman los `TOTAL` = `ABS(saldo)`, **no** los saldos con signo (paridad legacy: `ClassDgvExcelVentaTotal` sumaba la columna `TOTAL` por `IDTIPO`).
- Cambiar `soloConSaldo` **no cambia los totales**: los clientes en 0 aportan `0`.
- Cambiar el filtro **sí** los cambia (los totales reflejan el filtro actual).

**Tipos del DTO (copiados del código):**

```ts
export interface SaldoKardexVentaRow {
  idCliente: number
  cliente: string
  ruc: string
  /** 1 = PRODUCTO POR ENTREGAR (saldo < 0); 0 = POR COBRAR (saldo 0 incluido, BM-9). */
  idTipo: 0 | 1
  tipo: string
  /** ABS(saldo): paridad con el legado; el signo vive en `saldo`. */
  total: number
  /** Saldo con signo (nuevo en §7.2). */
  saldo: number
  /** Última fecha de referencia; GETDATE() del servidor como fallback. */
  fecha: Date
  /** true cuando no existía fecha de referencia y se usó el fallback GETDATE() (§2.5). */
  fechaEsHoy: boolean
  /**
   * Regla del usuario (2026, reemplazo del salmón binario del legacy §2.4):
   * |trunc((FECHA − FECHASIS)/86_400_000)| días de antigüedad; 0 cuando
   * fechaEsHoy.
   */
  diasAntiguedad: number
  /**
   * Nivel de la escala de antigüedad (regla del usuario, reemplaza el
   * salmón binario del legacy §2.4): ≤15 "bajo", 16–30 "medio", >30 "alto";
   * siempre "bajo" cuando fechaEsHoy.
   */
  nivelAntiguedad: "bajo" | "medio" | "alto"
}

export interface SaldosKardexVentaResult {
  filas: SaldoKardexVentaRow[]
  /** Sumas de TOTAL por idTipo sobre las filas ya filtradas por cliente. */
  totales: { porCobrar: number; porEntregar: number }
}
```

**Fila cruda que devuelve Prisma y mapeo campo por campo:**

```ts
type RawSaldoRow = {
  idCliente: unknown
  IDTIPO: unknown
  CLIENTE: string | null
  RUC: string | null
  TIPO: string | null
  TOTAL: unknown
  SALDO: unknown
  FECHA: Date
  FECHA_ES_HOY: unknown
  FECHASIS: Date
}
```

`aFecha` y `mapSaldoRow` (verbatim):

```ts
const MS_POR_DIA = 86_400_000

function aFecha(v: unknown): Date {
  return v instanceof Date ? v : new Date(v as string | number)
}

function mapSaldoRow(r: RawSaldoRow): SaldoKardexVentaRow {
  const fecha = aFecha(r.FECHA)
  const fechaSis = aFecha(r.FECHASIS)
  const fechaEsHoy = Number(r.FECHA_ES_HOY ?? 0) === 1

  const diasAntiguedad = fechaEsHoy
    ? 0
    : Math.abs(Math.trunc((fecha.getTime() - fechaSis.getTime()) / MS_POR_DIA))
  const nivelAntiguedad: SaldoKardexVentaRow["nivelAntiguedad"] =
    diasAntiguedad <= 15 ? "bajo" : diasAntiguedad <= 30 ? "medio" : "alto"

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
  }
}
```

| DTO | Transformación exacta |
|---|---|
| `idCliente` | `Number(raw.idCliente)`. |
| `cliente` | `raw.CLIENTE ?? ""` (string, sin trim). |
| `ruc` | `raw.RUC ?? ""`. |
| `idTipo` | `Number(raw.IDTIPO ?? 0) === 1 ? 1 : 0` → normaliza a la unión `0 \| 1`. |
| `tipo` | `raw.TIPO ?? ""` → `"PRODUCTO POR COBRAR"` / `"PRODUCTO POR ENTREGAR"` (texto tal cual lo emite el `CASE`). |
| `total` | `Number(raw.TOTAL ?? 0)` — `ABS(saldo)` como `number` (ver §12: no se usa `CsDecimal`). |
| `saldo` | `Number(raw.SALDO ?? 0)` — con signo. |
| `fecha` | `aFecha(raw.FECHA)`; Prisma puede devolver `Date` o el valor tal cual llegó del driver. |
| `fechaEsHoy` | `Number(raw.FECHA_ES_HOY ?? 0) === 1`. |
| `diasAntiguedad` | `fechaEsHoy ? 0 : Math.abs(Math.trunc((fecha − fechaSis) / 86_400_000))`. |
| `nivelAntiguedad` | `≤ 15 → "bajo"`, `≤ 30 → "medio"`, `> 30 → "alto"`. |

**Fórmula exacta de la antigüedad (la que pinta la celda FECHA):**

```text
dias = fechaEsHoy
         ? 0
         : |trunc((FECHA.getTime() − FECHASIS.getTime()) / 86_400_000)|
nivel = dias ≤ 15 → "bajo"
      | dias ≤ 30 → "medio"
      | dias >  30 → "alto"
```

- `trunc` = `Math.trunc` (trunca hacia cero, equivalente a `TimeSpan.Days` del legacy).
- **Valor absoluto**: una FECHA futura también escala (el legacy hacía lo mismo, doc legacy Bm-2).
- `86_400_000` = ms por día. La diferencia se calcula entre dos timestamps que vienen del **mismo reloj** (el servidor SQL), por lo que no hay corrimiento de zona horaria en el cálculo.
- Si `fechaEsHoy`, `dias = 0` y el nivel es siempre `"bajo"` (verde) — se evita alertar a los ~450 clientes sin fecha de referencia (doc legacy BM-9).

> `alertaAntiguedad: boolean` **no existe** en el DTO, aunque el doc legacy §8.1 y el log de decisiones (decisión 4) lo mencionaban. La implementación vigente devuelve `diasAntiguedad` + `nivelAntiguedad` y la UI decide los colores (§6.5).

### 4.3 Pantalla 2 — `getMovimientosKardexVenta`

```ts
export async function getMovimientosKardexVenta(
  idCliente: number,
): Promise<MovimientosKardexVentaResult>
```

**Entrada:** `idCliente: number`. **No valida nada**: la validación (entero positivo y no vacío) ocurre en la página (§4.4). El SQL lo castea explícitamente: `CAST(${idCliente} AS INT)` (en las tres consultas).

**SQL 1 — movimientos (verbatim del código):**

```sql
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
    -- BG-1 (calcar): los INNER JOIN ocultan movimientos que sí suman al saldo.
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
```

**Reglas de esta consulta, punto por punto:**

1. **Ventana / acumulado:** `SUM(VK.debe - VK.haber) OVER (ORDER BY VK.fecha, VK.idVentaKardex ROWS UNBOUNDED PRECEDING)`.
   - `ROWS` (no `RANGE`) ⇒ **desempate explícito por `idVentaKardex`**: con dos movimientos en la misma `fecha`, cada uno recibe su propio acumulado (el SP legacy usaba `RANGE` y les daba el mismo valor). El doc legacy verificó **0 empates** en la base actual, así que no cambia datos; sí hace el resultado determinista.
   - El marco se calcula en el CTE, **antes** de los JOIN, sobre todos los movimientos del cliente.
2. **Orden de salida:** `ORDER BY VK.fecha, VK.idVentaKardex` — siempre cronológico, sin parámetro de orden. No hay forma de pedir otro orden (BM-2).
3. **Placeholders `'_____'`:** cinco placeholders de 5 guiones bajos, exactamente `N'_____'`, cuando **no hay boleto de entrada** (`BE.CodSalida IS NULL`): `CODIGO`, `PLACA`, `GUIA`, `DESTINO`, `FACTURA`, `PRODUCTO`. Además `HUMEDAD`, `QQ` y `PRECIO` valen `0` en ese caso. `CHOFER` usa `ISNULL(CH.Nombres, N'_____')`.
4. **`FECHA_SALIDA`:** `NULL` cuando `BS.PesoSalida IS NULL` (no hay salida con peso), si no `BS.FechaHora`. **No** se usa `BS.Fecha`.
5. **`CODIGO`:** `BE.CodSalida + N' - ' + BE.CodDia` (concatenación de texto; si `CodDia` es NULL el resultado es NULL). **No se muestra** en la grilla.
6. **`TIPO` / `TIPOPAGO`:** descripciones de los catálogos. **Llegan al DTO pero no se muestran** (paridad §8.2.6 del doc legacy).
7. **Nulos de `CONCEPTO`:** `CAD.ConceptoGeneral` se devuelve tal cual; el mapeo lo convierte a `""` si es NULL.
8. **Multiplicación de filas:** ver §3.2 (LEFT JOIN de `BoletoSalidaVenta` y `CobroComprobanteVenta` por `IDBoletoEntradaVenta`).

**SQL 2 y SQL 3 — cabecera y saldo (verbatim):**

```ts
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
  ])
```

- Se ejecutan **en paralelo** (`Promise.all`) con la consulta de movimientos ya resuelta (el `await` de movimientos ocurre antes). Orden real: primero el `await` de movimientos, después el `Promise.all` de cabecera + saldo.
- **BM-1:** la cabecera sale de `Cliente`, **no** de la primera fila de la grilla. Por eso el historial funciona aunque no haya filas visibles.
- `ISNULL(..., 0)` ⇒ `saldoActual` nunca es `NULL`; un cliente sin movimientos da `0`.

**Tipos del DTO (copiados del código):**

```ts
export interface MovimientoKardexVentaRow {
  idVentaKardex: number
  /** Ocultas en la grilla (paridad §8.2.6) pero presentes en el DTO. */
  tipo: string
  tipoPago: string
  sucursal: string
  fechaLiquida: Date
  /** null cuando BS.PesoSalida es NULL (sin salida con peso). */
  fechaSalida: Date | null
  /** Se devuelve pero no se muestra (paridad §5.1/§8.2.6). */
  codigo: string
  chofer: string
  concepto: string
  placa: string
  guia: string
  destino: string
  factura: string
  producto: string
  humedad: number
  qq: number
  precio: number
  retencion: number
  total: number
  debe: number
  haber: number
  /** Saldo acumulado sobre TODOS los movimientos, incluidos los ocultos (BG-1). */
  acumulado: number
}

export interface MovimientosKardexVentaResult {
  /** Cabecera desde Cliente, no de la primera fila (BM-1). null = sin filas visibles. */
  cliente: { idCliente: number; nombre: string; ruc: string } | null
  /** SUM(debe - haber) de TODOS los movimientos del cliente, con signo. */
  saldoActual: number
  /** BM-8: dirección derivada del signo de saldoActual. */
  tipo: string
  movimientos: MovimientoKardexVentaRow[]
}
```

**Mapeo (verbatim):**

```ts
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
  }
}
```

Regla general del mapeo: **texto → `string` con `?? ""`** (nunca `null`), **numérico → `number` con `Number(x ?? 0)`**, **fechas → `Date`** (o `null` explícito en `fechaSalida`). No hay redondeo, ni formateo, ni `CsDecimal` en el servidor: el formateo ocurre en el cliente con `fmt()` (§8).

**Cabecera y `tipo` (verbatim):**

```ts
  const movimientos = movRows.map(mapMovRow)
  const saldoActual = Number(saldoRows[0]?.SALDO ?? 0)

  // BM-8: TOTAL de cabecera = valor absoluto; la dirección la da la etiqueta.
  const tipo =
    saldoActual < 0 ? "PRODUCTO POR ENTREGAR" : "PRODUCTO POR COBRAR"

  const header = headerRows[0]
  const cliente = header
    ? {
        idCliente: Number(idCliente),
        nombre: header.NombreCompleto ?? "",
        ruc: header.Documento ?? "",
      }
    : null

  return { cliente, saldoActual, tipo, movimientos }
```

- `cliente === null` **solo** cuando el `idCliente` no existe en `Cliente`.
- `cliente !== null` con `movimientos = []` es un caso válido: cliente existente sin movimientos visibles.

### 4.4 Validación de entrada de la pantalla 2 (en la página, no en la action)

`app/(main)/ventas/operaciones/kardex-venta/[idCliente]/page.tsx`:

```tsx
const { idCliente } = await params
const id = Number(idCliente)

const data =
  Number.isInteger(id) && id > 0 ? await getMovimientosKardexVenta(id) : null
```

| Entrada | Resultado |
|---|---|
| `"40116"` | `id = 40116` → se ejecuta la action. |
| `"0"`, `"-3"` | `id > 0` falla → `data = null` → estado vacío "Cliente sin movimientos visibles". **No es un 404.** |
| `"abc"` | `Number("abc") = NaN` → `Number.isInteger(NaN) = false` → mismo estado vacío. |
| `"1.5"` | `Number.isInteger` false → estado vacío. |
| `"1e3"` | `Number("1e3") = 1000`, entero positivo → consulta por cliente 1000. |

Nota de Next: `params` es una **`Promise`** (`params: Promise<{ idCliente: string }>`) y se resuelve con `await params`.

### 4.5 Estados vacíos y manejo de errores

**Pantalla 2 (server component).** Hay dos guards, con **el mismo markup** duplicado en el archivo:

```tsx
if (!data) { /* estado vacío */ }
const { cliente } = data
if (cliente === null) { /* estado vacío idéntico */ }
```

El estado vacío es:

```tsx
<div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-muted-foreground">
  <p className="text-sm">Cliente sin movimientos visibles</p>
  <Button asChild variant="outline" size="sm">
    <Link href="/ventas/operaciones/kardex-venta">
      <ArrowLeft className="size-4" /> Volver al listado
    </Link>
  </Button>
</div>
```

- Es el **mismo texto** para "id inválido", "cliente inexistente" y "cliente sin movimientos visibles": no se distingue (BM-1 pide justamente no romper en ese caso).
- Un cliente existente **con** movimientos ocultos por los `INNER JOIN` cae en `cliente !== null` + `movimientos = []`, así que se renderiza la cabecera y la grilla muestra su propio vacío (`"Sin movimientos visibles para este cliente."`, §7.5).
- **No hay `try/catch`.** Si la base falla, el error sube al boundary de Next. En este repo **no existe `app/**/error.tsx` ni `global-error.tsx`** (verificado con `find app -name "error.tsx" -o -name "global-error.tsx"`): el usuario ve la pantalla de error por defecto de Next (HTTP 500).

**Pantalla 1 (client component).** El error se captura y se muestra como texto rojo bajo el filtro:

```tsx
try {
  const result = await getSaldosKardexVenta(filtro, soloConSaldo)
  if (peticionRef.current !== miPeticion) return
  setData(result)
  setError(null)
} catch {
  if (peticionRef.current !== miPeticion) return
  setError("Error al ejecutar la consulta")
} finally {
  if (peticionRef.current === miPeticion) setLoading(false)
}
```

- El mensaje es **genérico y fijo** (`"Error al ejecutar la consulta"`); el error original se descarta (no se loguea, no se muestra).
- En error **no se limpia `data`**: la grilla sigue mostrando el resultado anterior (dato viejo) con el mensaje de error arriba. Ver §12.
- El `catch` no escribe consola: no queda rastro del fallo en el cliente.

### 4.6 Resumen de contratos

| Action | Firma | Devuelve |
|---|---|---|
| `getSaldosKardexVenta` | `(filtro: string, soloConSaldo?: boolean) => Promise<SaldosKardexVentaResult>` | `{ filas: SaldoKardexVentaRow[]; totales: { porCobrar: number; porEntregar: number } }` |
| `getMovimientosKardexVenta` | `(idCliente: number) => Promise<MovimientosKardexVentaResult>` | `{ cliente: { idCliente, nombre, ruc } \| null; saldoActual: number; tipo: string; movimientos: MovimientoKardexVentaRow[] }` |

Ambas **nunca lanzan por datos faltantes** (devuelven `""`, `0`, `null` o arrays vacíos). Solo lanzan si la base falla o si el driver no puede mapear la fila.

Cómo se invocan:

- **Pantalla 1:** desde el cliente, `await getSaldosKardexVenta(...)` dentro de un `setTimeout` (Server Action remota).
- **Pantalla 2:** desde un Server Component, `await getMovimientosKardexVenta(id)` — es una **llamada directa a la función** (mismo proceso), no un round-trip HTTP.

---

## 5. Helpers puros

Archivo: `app/(main)/ventas/operaciones/kardex-venta/_lib/kardex-venta.ts`. Sin acceso a base, sin dependencias externas, testeado con Vitest.

### 5.1 `escapeLike(texto: string): string`

```ts
export function escapeLike(texto: string): string {
  return texto
    .replaceAll("!", "!!")
    .replaceAll("%", "!%")
    .replaceAll("_", "!_")
    .replaceAll("[", "![")
}
```

Reglas:

1. **`!` primero** (duplicado): es el carácter de escape elegido, así que debe escaparse a sí mismo antes que el resto. Si se invirtiera el orden, `"%"` → `"!%"` → `"!!%"`, que ya no matchea el literal.
2. `%`, `_` y `[` se prefijan con `!` (Bm-12 del doc legacy: los comodines del usuario deben tratarse como literales).
3. `]` **no** se escapa (no hace falta en `LIKE` de T-SQL una vez escapado el `[`).
4. No se recorta, no se pasa a mayúsculas, no se desacentúa: la comparación la resuelve la collation del servidor.
5. Se usa junto a `ESCAPE N'!'` en el SQL. **Si se cambia el carácter de escape en un lado, cambia en el otro** (el README del módulo lo advierte explícitamente).

Casos de test (con el valor esperado, tal cual el archivo `.test.ts`):

| Entrada | Salida |
|---|---|
| `"a!b"` | `"a!!b"` |
| `"50%"` | `"50!%"` |
| `"con_suma"` | `"con!_suma"` |
| `"c[oco"` | `"c![oco"` |
| `"CONSUMIDOR FINAL"` | `"CONSUMIDOR FINAL"` |
| `"Ñustes - Pérez"` | `"Ñustes - Pérez"` |
| `""` | `""` |
| `"50%_c[o]!"` | `"50!%!_c![o]!!"` |

### 5.2 `formatFechaVenta(d: Date | string | null | undefined): string`

```ts
export function formatFechaVenta(d: Date | string | null | undefined): string {
  if (!d) return "—"
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return "—"

  const dia = date.getUTCDate()
  const mes = date.getUTCMonth() + 1
  const anio = date.getUTCFullYear()
  const hora = date.getUTCHours()
  const minutos = String(date.getUTCMinutes()).padStart(2, "0")

  return `${dia}/${mes}/${anio} ${hora}:${minutos}`
}
```

Comportamiento exacto:

- Formato `d/M/yyyy H:mm` (día/mes/año, 24 h), armado **a mano** con getters **UTC**.
- **Sin cero inicial** en día, mes ni hora; **minutos siempre a 2 dígitos**.
- `null`, `undefined`, `""` y fechas inválidas → `"—"` (guion largo, U+2014).
- Acepta `string` porque la Server Action serializa `Date` a string.
- Convención del proyecto (documentada en el propio archivo): los `datetime` de la base se tratan como **UTC** (`lib/fmt.ts` hace lo mismo en `fechaHora`). No hay conversión de zona horaria.

Casos de test:

| Entrada | Salida |
|---|---|
| `new Date("2026-08-17T15:47:00.000Z")` | `"17/8/2026 15:47"` |
| `new Date("2026-01-05T09:07:00.000Z")` | `"5/1/2026 9:07"` |
| `new Date("2026-03-12T08:05:00.000Z")` | `"12/3/2026 8:05"` |
| `"2026-08-17T15:47:00.000Z"` (string) | `"17/8/2026 15:47"` |
| `null`, `undefined`, `""` | `"—"` |

> Ojo al replicar: el doc legacy (§8.3) y el log de decisiones (decisión 8) especifican `M/d/yyyy H:mm` (mes primero). **El código implementa `d/M/yyyy H:mm`** a pedido posterior del usuario ("día primero"). Los tests lo fijan. Ver §9.

### 5.3 `formatFechaMovimiento(fechaLiquida, fechaSalida): string`

```ts
export function formatFechaMovimiento(
  fechaLiquida: Date | string | null | undefined,
  fechaSalida: Date | string | null | undefined,
): string {
  const base = formatFechaVenta(fechaLiquida)
  return fechaSalida == null ? base : `${base} · salida ${formatFechaVenta(fechaSalida)}`
}
```

- Con `fechaSalida == null` (o `undefined`) devuelve solo la fecha líquida (BM-4).
- Con salida, agrega el sufijo ` · salida <fecha>` (espacio, punto medio U+00B7, espacio, `salida`, espacio, fecha).
- Si ambas faltan → `"—"` (no `"— · salida —"`, porque el `null` de salida corta antes).

Casos de test:

| Entrada | Salida |
|---|---|
| `(2026-08-17T15:47Z, 2026-08-17T17:10Z)` | `"17/8/2026 15:47 · salida 17/8/2026 17:10"` |
| `(2026-08-17T15:47Z, null)` | `"17/8/2026 15:47"` |
| `(2026-08-17T15:47Z, undefined)` | `"17/8/2026 15:47"` |
| `(null, null)` | `"—"` |

---

## 6. UI pantalla 1 — lista de saldos por cliente

Archivo: `app/(main)/ventas/operaciones/kardex-venta/page.tsx` (`"use client"`).

### 6.1 Estado e imports

Imports efectivos (los que hay que reproducir):

```tsx
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ReportTable, type ReportColumn } from "@/components/shared/report-table"
import { cn } from "@/lib/utils"
import { fmt } from "@/lib/fmt"
import { getSaldosKardexVenta, type SaldoKardexVentaRow, type SaldosKardexVentaResult } from "./_actions"
import { formatFechaVenta } from "./_lib/kardex-venta"
```

Estado:

| Hook | Tipo | Inicial | Rol |
|---|---|---|---|
| `filtro` | `string` | `""` | Texto del input. |
| `soloConSaldo` | `boolean` | `true` | BM-9: por defecto oculta saldos 0. |
| `loading` | `boolean` | `true` | Arranca en `true`: muestra el loader grande antes de la primera respuesta. |
| `error` | `string \| null` | `null` | Mensaje fijo de error. |
| `data` | `SaldosKardexVentaResult \| null` | `null` | Resultado de la action. |
| `ordenTotal` | `"asc" \| "desc" \| null` | `null` | Orden **de presentación** por la columna Total (`null` = orden del servidor). |
| `peticionRef` | `useRef(0)` | `0` | Contador para el "resultado más reciente gana". |

### 6.2 Carga de datos: debounce 300 ms + latest-wins (BM-7)

```tsx
useEffect(() => {
  const timer = window.setTimeout(async () => {
    const miPeticion = ++peticionRef.current
    setLoading(true)
    try {
      const result = await getSaldosKardexVenta(filtro, soloConSaldo)
      if (peticionRef.current !== miPeticion) return
      setData(result)
      setError(null)
    } catch {
      if (peticionRef.current !== miPeticion) return
      setError("Error al ejecutar la consulta")
    } finally {
      if (peticionRef.current === miPeticion) setLoading(false)
    }
  }, 300)

  return () => window.clearTimeout(timer)
}, [filtro, soloConSaldo])
```

Detalles que hay que copiar tal cual:

- **300 ms** de espera (`window.setTimeout`). Cada tecla reinicia el timer (el `return` limpia el anterior).
- El contador se incrementa **dentro** del timeout, no en el `onChange`.
- **Latest-wins:** si al volver la respuesta el contador ya cambió, la respuesta se **descarta entera** (no toca `data`, `error` ni `loading`).
- **No hay `AbortController`**: la petición vieja **igual viaja** al servidor; solo se ignora su resultado. (El doc legacy §8.2 pedía cancelación; ver §9 y §12.)
- La carga inicial también pasa por el debounce: la primera consulta sale ~300 ms después del montaje.
- `loading` se pone en `true` al **disparar** cada consulta, no al tipear: si el usuario tipea rápido, el spinner aparece recién cuando sale la request.
- Dependencias: `[filtro, soloConSaldo]` — cambiar cualquiera de los dos reejecuta la consulta.

### 6.3 Contenedor y encabezado

```tsx
<div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-6">
  <div className="shrink-0">
    <h1 className="text-lg font-semibold">Reporte Kardex de Venta</h1>
    <p className="text-sm text-muted-foreground">
      Saldos de kardex por cliente (todas las sucursales)
    </p>
  </div>
  …
```

- Título `text-lg font-semibold`: **"Reporte Kardex de Venta"**.
- Subtítulo `text-sm text-muted-foreground`: **"Saldos de kardex por cliente (todas las sucursales)"** (comunica explícitamente que no hay filtro de sucursal).
- No hay breadcrumb, ni botón de exportar, ni contador de registros en la cabecera.

### 6.4 Fila de filtro + tarjetas de resumen

```tsx
<div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-stretch">
  <Card className="shrink-0 rounded-lg border p-3 lg:w-[36rem]">
    <div className="flex items-center gap-3">
      <Label htmlFor="filtro-busqueda" className="shrink-0">Buscar</Label>
      <div className="relative min-w-0 flex-1">
        <Input
          id="filtro-busqueda"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          maxLength={250}
          placeholder="Filtrar por cliente o total..."
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute top-1/2 right-2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      <Select
        value={soloConSaldo ? "con-saldo" : "todos"}
        onValueChange={(v) => setSoloConSaldo(v === "con-saldo")}
      >
        <SelectTrigger className="w-36 shrink-0" aria-label="Clientes a mostrar">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="con-saldo">Solo con saldo</SelectItem>
          <SelectItem value="todos">Todos</SelectItem>
        </SelectContent>
      </Select>
    </div>
    {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
  </Card>
  …
```

| Elemento | Detalle exacto |
|---|---|
| `Label` | Texto **"Buscar"**, `htmlFor="filtro-busqueda"`. |
| `Input` | `id="filtro-busqueda"`, controlado por `filtro`, **`maxLength={250}`** (paridad con el `MaxLength = 250` del `TxtCliente` legacy), `placeholder="Filtrar por cliente o total..."`, `autoComplete="off"`. |
| Spinner del input | `Loader2` con `absolute top-1/2 right-2 size-4 -translate-y-1/2 animate-spin text-muted-foreground`, **dentro** del `div.relative` del input. Se muestra mientras `loading`. |
| `Select` | Dos opciones: `value="con-saldo"` → **"Solo con saldo"**; `value="todos"` → **"Todos"**. `SelectTrigger` con `w-36 shrink-0` y `aria-label="Clientes a mostrar"`. Cambiar la opción **dispara nueva consulta** (dependencia del efecto). |
| Error | `<p className="mt-2 text-sm text-destructive">` debajo de la fila de filtro, dentro del `Card`. |
| Card del filtro | `shrink-0 rounded-lg border p-3 lg:w-[36rem]` — ancho fijo en desktop (`36rem` = 576 px), ancho completo en mobile. |

**Búsqueda por monto (importante al replicar):** no hay parseo de números en el cliente. El texto va tal cual al SQL, que lo compara contra `CAST(ABS(K.SALDO) AS VARCHAR(50))`. Consecuencias:

- `287092.9` **sí** matchea `287092.92` (es un `LIKE '%…%'` sobre el texto del número).
- `287,092.92` (como lo muestra la grilla) **no** matchea: el `CAST` no lleva separador de miles.
- `-13.66` **no** matchea: se castea `ABS(saldo)`.
- `0` matchea **todos** los clientes con saldo 0 (y cualquier saldo que contenga el carácter `0`), lo que combinado con "Todos" puede devolver cientos de filas.

Ver §12 para el tratamiento de esto como limitación.

### 6.5 Tarjetas de resumen

Se calculan antes del render, sobre las filas **filtradas** que devolvió el servidor:

```tsx
const d = data?.filas ?? []
const cobrar = d.filter((r) => r.idTipo === 0)
const entregar = d.filter((r) => r.idTipo === 1)
const totalCobrar = data?.totales.porCobrar ?? 0
const totalEntregar = data?.totales.porEntregar ?? 0
```

```tsx
<div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
  <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-4 py-2 text-sm">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Producto por Cobrar
      </p>
      <p className="text-xs text-muted-foreground">{cobrar.length} clientes</p>
    </div>
    <p className="font-mono text-lg font-bold text-green-600">{fmt(totalCobrar)}</p>
  </div>
  <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-4 py-2 text-sm">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Producto por Entregar
      </p>
      <p className="text-xs text-muted-foreground">{entregar.length} clientes</p>
    </div>
    <p className="font-mono text-lg font-bold text-destructive">{fmt(totalEntregar)}</p>
  </div>
</div>
```

| Tarjeta | Etiqueta | Conteo | Importe | Color del importe |
|---|---|---|---|---|
| Por cobrar (`idTipo === 0`) | `Producto por Cobrar` | `{cobrar.length} clientes` (siempre plural, incluso `1 clientes`) | `fmt(totales.porCobrar)` = suma de `ABS(saldo)` | `text-green-600` |
| Por entregar (`idTipo === 1`) | `Producto por Entregar` | `{entregar.length} clientes` | `fmt(totales.porEntregar)` | `text-destructive` |

- Los **conteos** salen de `data.filas` (cliente-side), los **importes** de `data.totales` (calculados en el servidor). Ambos sobre el mismo conjunto filtrado, así que son consistentes.
- El importe va en `font-mono text-lg font-bold`; la etiqueta en `text-xs font-semibold uppercase tracking-wide text-muted-foreground`.
- Los textos son distintos de los del legacy (`P. POR COBRAR` / `P. POR ENTREGAR`): acá se usan los nombres completos en title case.
- No hay tarjeta de total general ni de cantidad de movimientos.

### 6.6 Columnas de la grilla (en orden)

Definición (`ReportColumn<SaldoKardexVentaRow>[]`):

| # | `key` | Header | Campo del DTO | Alineación | Formato | Celda |
|---|---|---|---|---|---|---|
| 1 | `lupa` | *(vacío)* | — | izquierda | — | `Button` `variant="ghost"` `size="icon-sm"` con `title="Ver historial de movimientos"`, icono `Search` (`size-4`), `onClick` → `router.push("/ventas/operaciones/kardex-venta/" + r.idCliente)` |
| 2 | `cliente` | `Cliente` | `cliente` | izquierda | texto | texto plano |
| 3 | `ruc` | `RUC` | `ruc` | izquierda | texto | texto plano |
| 4 | `tipo` | `Tipo` | `tipo` | izquierda | texto | `<span className={cn("text-xs font-medium", idTipo === 0 ? "text-green-600" : "text-destructive")}>` |
| 5 | `total` | `Total` (+ flecha) | `total` | **derecha** | `fmt(total)` | `<span className={cn("font-semibold", idTipo === 0 ? "text-green-600" : "text-destructive")}>` |
| 6 | `fecha` | `Fecha` | `fecha` | izquierda | `formatFechaVenta(fecha)` | `<span className={cn("block -mx-3 -my-1.5 px-3 py-1.5", …nivel)}>` |

Detalles finos:

- **Header de Total** es un `ReactNode`, no un string:

```tsx
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
```

- **La celda de FECHA usa márgenes negativos** (`-mx-3 -my-1.5`) para que el fondo cubra el `px-3 py-1.5` de la celda entera y no solo el texto:

```tsx
<span
  className={cn(
    "block -mx-3 -my-1.5 px-3 py-1.5",
    r.nivelAntiguedad === "bajo" && "bg-green-100 dark:bg-green-900/40",
    r.nivelAntiguedad === "medio" && "bg-yellow-100 dark:bg-yellow-900/40",
    r.nivelAntiguedad === "alto" && "bg-red-200 dark:bg-red-900/40",
  )}
>
  {formatFechaVenta(r.fecha)}
</span>
```

  Escala de antigüedad (reemplaza al "salmón binario" del legacy §2.4):

| Nivel | Días (`diasAntiguedad`) | Fondo claro | Fondo oscuro |
|---|---|---|---|
| `bajo` | 0–15 (incluye `fechaEsHoy`) | `bg-green-100` | `dark:bg-green-900/40` |
| `medio` | 16–30 | `bg-yellow-100` | `dark:bg-yellow-900/40` |
| `alto` | 31+ | `bg-red-200` | `dark:bg-red-900/40` |

- Ninguna columna declara `headClassName`, `cellClassName` ni `rowClassName`; **no hay franjas por fila** (el legacy pintaba `LightBlue` en las pares) ni resaltado por fila. Solo `hover:bg-muted/20` que aporta `ReportTable`.
- `getRowKey={(r) => r.idCliente}`.

### 6.7 Ordenamiento por Total (solo presentación)

```tsx
const filasOrdenadas = useMemo(() => {
  if (ordenTotal === null) return d
  const signo = ordenTotal === "asc" ? 1 : -1
  return [...d].sort((a, b) => {
    const porTotal = (a.total - b.total) * signo
    if (porTotal !== 0) return porTotal
    const porCliente = a.cliente.localeCompare(b.cliente)
    if (porCliente !== 0) return porCliente
    return a.idCliente - b.idCliente
  })
}, [d, ordenTotal])

function alternarOrdenTotal() {
  setOrdenTotal((prev) => (prev === null ? "asc" : prev === "asc" ? "desc" : null))
}
```

| Aspecto | Comportamiento exacto |
|---|---|
| Columnas ordenables | **Solo `Total`**. El resto de los headers es estático (el de FECHA se pinta por la regla de antigüedad, no por "fecha"). |
| Ciclo | `null` → `"asc"` → `"desc"` → `null`. |
| `null` | Orden **del servidor** (`ORDER BY CL.NombreCompleto, K.idCliente`, BM-3). No hay flecha "off": se muestra `ArrowUpDown`. |
| `"asc"` / `"desc"` | Copia ordenada en el cliente sobre `total` (`ABS(saldo)`), con desempate **`cliente.localeCompare`** y luego **`idCliente`** para que el orden sea determinista. |
| Efecto en las tarjetas | **Ninguno.** Las tarjetas usan `d` (orden y totales del servidor). |
| Efecto en la consulta | **Ninguno.** No se re-consulta ni se manda el orden al servidor. |
| Header clickeable | `onHeaderClick` + `headerTitle="Ordenar por total"`; `ReportTable` agrega `cursor-pointer select-none hover:text-foreground` al `th`. |
| `localeCompare` | Usa el locale del navegador (sin locale explícito). `a confirmar` en el admin nuevo si se necesita el mismo criterio que el `ORDER BY` de SQL (no lo es: SQL usa la collation, JS usa ICU del navegador). |

### 6.8 Grilla: `ReportTable` con `fill`, sin paginación

```tsx
<div className="min-h-0 flex-1">
  <ReportTable
    rows={filasOrdenadas}
    columns={columns}
    getRowKey={(r) => r.idCliente}
    fill
    paginate={false}
    emptyMessage="Sin resultados para el filtro actual."
  />
</div>
```

Qué implica cada prop (comportamiento observado en `components/shared/report-table.tsx`):

| Prop | Valor | Efecto |
|---|---|---|
| `fill` | `true` | Contenedor `flex h-full flex-col gap-3`; el scroller es `min-h-0 flex-1` (en vez de `max-h-[80vh] rounded-md border`). **No hay borde propio**: el borde lo aporta el contenedor de la página (acá, ninguno: la grilla queda sin borde exterior). El estado vacío y el de carga usan `flex h-full items-center justify-center`. |
| `paginate` | `false` | Se renderizan **todas** las filas; no hay paginador. El scroll del contenedor reemplaza la paginación. `Ctrl/⌘+←/→` queda deshabilitado (no hay páginas). |
| `virtualize` | *(ausente)* | **No se virtualiza**: con ~498 clientes se montan todas las filas. `ReportTable` igual ignora `virtualize` si el dataset tiene ≤150 filas. |
| `colWidths` | *(ausente)* | `table-layout: auto` (los anchos dependen del contenido montado; estable porque no hay virtualización). |
| `emptyMessage` | `"Sin resultados para el filtro actual."` | Texto del vacío. |
| `loading` | *(ausente)* | `ReportTable` **no** muestra su "Cargando...": el loader lo pinta la página (§6.9). |
| `wrap` | default `false` | Celdas `whitespace-nowrap`: una línea por celda, con scroll horizontal si hace falta. |
| `verticalAlign` | default `"top"` | `align-top` en las celdas. |
| `pageSize` | default `25` | Irrelevante con `paginate={false}` (solo se usa para PageUp/PageDown: 25 filas por salto de teclado). |
| `footer` | *(ausente)* | Sin `<tfoot>`. **No hay fila de totales en la grilla**: los totales viven en las tarjetas. |

### 6.9 Estados de carga, vacío y error

```tsx
{loading ? (
  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
    <Loader2 className="size-8 animate-spin" />
    <p className="text-sm">Consultando saldos, puede tardar unos segundos...</p>
  </div>
) : (
  <div className="min-h-0 flex-1">…ReportTable…</div>
)}
```

| Estado | Qué se ve | Detalle |
|---|---|---|
| **Cargando** | Spinner grande centrado (`Loader2 size-8 animate-spin`) + **"Consultando saldos, puede tardar unos segundos..."** | La grilla **se desmonta** durante la carga (no se muestran filas viejas). El spinner chico del input también gira. |
| **Vacío** | `"Sin resultados para el filtro actual."` centrado (lo pinta `ReportTable` con `fill`) | Ocurre con un filtro que no matchea, o con "Solo con saldo" cuando nadie tiene saldo. |
| **Error** | `"Error al ejecutar la consulta"` en `text-destructive` bajo el filtro | La grilla **sigue mostrando el resultado anterior** (el `catch` no limpia `data`); el loader se apaga. |

- El mensaje de carga está pensado para el costo real de la consulta de saldos (documentado como ~11–30 ms en la base local del doc legacy §7.1, pero potencialmente más lento en producción).
- No hay skeleton ni `Suspense`.

### 6.10 Teclado, selección y estabilidad del scroll

Todo lo aporta `ReportTable` vía `useExcelNavigation` (`components/shared/use-excel-navigation.ts`). **No es específico del kardex, pero forma parte de la UX a replicar:**

| Interacción | Comportamiento |
|---|---|
| Click en una celda | La marca como activa (`bg-primary text-primary-foreground`) y enfoca el contenedor. |
| `↑` / `↓` | Mueve la fila activa; se detiene en los extremos (con `paginate={false}` no cruza de página). |
| `←` / `→` | Mueve la columna activa; se detiene en la primera/última. |
| `Home` / `End` | Primera / última columna. |
| `PageUp` / `PageDown` | Salta `pageSize` (25) filas. |
| `Ctrl/⌘ + ←/→` | **Deshabilitado** con `paginate={false}`. |
| `Ctrl/⌘ + C` | Copia el `textContent.trim()` de la celda activa. Funciona también con el foco fuera de la grilla (listener a nivel `document`), **salvo** que el foco esté en un `input`/`textarea`/`contenteditable` (ahí manda la copia nativa: es el caso del filtro) o dentro de otra grilla (`[role="grid"]`). |
| Feedback de copia | `toast.success("Celda copiada")` / `toast.error("No se pudo copiar")` (Sonner). |
| Scroll a la celda activa | `scrollIntoView({ block: "nearest", inline: "nearest" })`. |
| Reset | Al cambiar el dataset (`resetKey={rows}`), la celda activa vuelve a `{r: 0, c: 0}`. |
| Accesibilidad | Contenedor `role="grid"`, `tabIndex={0}`, celdas `role="gridcell"` + `aria-selected`; `aria-label` **no** se pasa (queda sin nombre accesible). |

Estabilidad visual (sin virtualización, dataset chico):

- El header es **sticky**: `th` con `sticky top-0 z-10 bg-muted px-3 py-2 text-left align-bottom`, dentro de `thead > tr` con `border-b bg-muted/60 text-xs uppercase text-muted-foreground`.
- El contenedor scrollea por dentro (`overflow-auto`), no la página.
- Las filas usan `divide-y divide-border/40` y `hover:bg-muted/20`.
- Las celdas: `cursor-cell px-3 py-1.5`, más `text-right font-mono tabular-nums` en columnas con `align: "right"` (por eso el Total se ve monoespaciado incluso sin declararlo en el `render`).
- Como no hay virtualización ni `colWidths`, el ancho de columna se recalcula con el contenido: es estable porque **todas** las filas están montadas siempre.
- Foco visible: `focus-visible:ring-2 focus-visible:ring-ring/50` en el contenedor.

### 6.11 Responsive

| Breakpoint | Comportamiento |
|---|---|
| `< sm` (mobile) | Filtro y tarjetas se apilan: `flex-col` en la fila de filtro, `grid-cols-1` en las tarjetas. El `Card` del filtro ocupa el ancho disponible. |
| `≥ sm` | Tarjetas en 2 columnas (`sm:grid-cols-2`). |
| `≥ lg` | Fila de filtro horizontal (`lg:flex-row lg:items-stretch`) con el `Card` de ancho fijo `lg:w-[36rem]` y las tarjetas ocupando el resto (`flex-1`, `min-w-0`). |
| Siempre | La grilla scrollea horizontalmente (`whitespace-nowrap` + `overflow-auto`); no hay versión "card list" para mobile. Altura fija al viewport, sin scroll de página. |

---

## 7. UI pantalla 2 — historial de movimientos

Archivos: `[idCliente]/page.tsx` (server) + `_components/kardex-venta-historial-tabla.tsx` (client).

### 7.1 Estructura y encabezado

El server component valida, llama la action, y si hay cliente delega en `HistorialView` con un DTO donde `cliente` ya es no-null:

```tsx
type HistorialData = Omit<MovimientosKardexVentaResult, "cliente"> & {
  cliente: NonNullable<MovimientosKardexVentaResult["cliente"]>
}
```

Markup:

```tsx
<div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-6">
  <div className="flex items-center justify-between gap-3">
    <Button asChild variant="ghost" size="sm">
      <Link href="/ventas/operaciones/kardex-venta">
        <ArrowLeft className="size-4" /> Volver al listado
      </Link>
    </Button>
  </div>

  <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
      <span>
        <span className="text-muted-foreground">Cliente:</span>{" "}
        <span className="font-medium">{data.cliente.nombre}</span>
      </span>
      <span>
        <span className="text-muted-foreground">RUC:</span>{" "}
        <span className="font-medium">{data.cliente.ruc}</span>
      </span>
      <span>
        <span className="text-muted-foreground">Total:</span>{" "}
        <span className="font-mono font-semibold">{fmt(Math.abs(data.saldoActual))}</span>
      </span>
      <Badge
        variant={porEntregar ? "destructive" : "secondary"}
        className={cn(!porEntregar && "bg-green-600/10 text-green-600 dark:text-green-500")}
      >
        {data.tipo}
      </Badge>
      <span className="ml-auto font-mono text-muted-foreground">
        {data.movimientos.length} movimientos
      </span>
    </div>
  </div>

  <div className="min-h-0 flex-1">
    <KardexVentaHistorialTabla data={data} />
  </div>
</div>
```

| Elemento | Detalle exacto |
|---|---|
| Botón volver | `Button asChild variant="ghost" size="sm"` con `<Link href="/ventas/operaciones/kardex-venta">`, icono `ArrowLeft size-4`, texto **"Volver al listado"**. Está **arriba** de la cabecera, en su propia fila. |
| Contenedor de cabecera | `rounded-md border bg-muted/40 px-4 py-3 text-sm`, campos en `flex flex-wrap items-center gap-x-6 gap-y-1`. |
| `Cliente:` | Etiqueta `text-muted-foreground` + valor `font-medium` con `data.cliente.nombre`. |
| `RUC:` | Etiqueta `text-muted-foreground` + valor `font-medium` con `data.cliente.ruc`. |
| `Total:` | Etiqueta `text-muted-foreground` + valor `font-mono font-semibold` = **`fmt(Math.abs(data.saldoActual))`**. |
| Etiqueta de tipo | `Badge` con el texto de `data.tipo` (`"PRODUCTO POR COBRAR"` / `"PRODUCTO POR ENTREGAR"`). |
| Contador | `ml-auto font-mono text-muted-foreground`: `{data.movimientos.length} movimientos` (plural fijo). |

**Lógica del TOTAL de cabecera (BM-8):**

```tsx
const porEntregar = data.tipo === "PRODUCTO POR ENTREGAR"
…
{fmt(Math.abs(data.saldoActual))}
```

- El número es el **valor absoluto** de `saldoActual` (que llega con signo desde el servidor); la **dirección la dice el badge**, no el signo.
- No se usa la prop `Total` que el legacy pasaba desde la fila de la pantalla 1: se recalcula desde la base (corrige BM-8 en el origen).
- El valor puede **no coincidir con el último `SALDO` visible** si hay movimientos ocultos por BG-1: `saldoActual` suma todos; el último `ACUMULADO` visible también suma todos, así que **normalmente coincide** (doc legacy §6.3, test T11). Si el último movimiento del cliente está oculto, el último `ACUMULADO` visible ya no es el saldo final y ahí difieren. `a confirmar` con datos reales (no se ejecutó SQL).

**Color del badge:**

| Tipo | `variant` | Clases extra |
|---|---|---|
| `PRODUCTO POR ENTREGAR` | `destructive` | — (queda `bg-destructive/10 text-destructive`) |
| `PRODUCTO POR COBRAR` | `secondary` | `bg-green-600/10 text-green-600 dark:text-green-500` (sobrescribe el fondo del variant `secondary`) |

`Badge` base: `inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap`.

### 7.2 Columnas de la grilla (en orden de render)

17 columnas visibles. `TIPO`, `TIPOPAGO` y `CODIGO` **no** se renderizan (paridad §8.2.6 del doc legacy) aunque estén en el DTO.

| # | `key` | Header | Campo | Alineación | Formato / regla de celda |
|---|---|---|---|---|---|
| 1 | `sucursal` | `Sucursal` | `sucursal` | izquierda | texto |
| 2 | `fecha` | `Fecha` | `fechaLiquida` + `fechaSalida` | izquierda | `formatFechaMovimiento(fechaLiquida, fechaSalida)` |
| 3 | `chofer` | `Chofer` | `chofer` | izquierda | texto (puede ser `"_____"`) |
| 4 | `placa` | `Placa` | `placa` | izquierda | texto |
| 5 | `concepto` | `Concepto` | `concepto` | izquierda | `<TextoLargo texto={r.concepto} />` |
| 6 | `guia` | `Guía` | `guia` | izquierda | texto (header con tilde: **"Guía"**) |
| 7 | `destino` | `Destino` | `destino` | izquierda | `<TextoLargo texto={r.destino} />` |
| 8 | `factura` | `Factura` | `factura` | izquierda | texto |
| 9 | `producto` | `Producto` | `producto` | izquierda | texto |
| 10 | `humedad` | `Humedad` | `humedad` | derecha | `r.humedad !== 0 ? fmt(r.humedad) : ""` |
| 11 | `qq` | `QQ` | `qq` | derecha | `r.qq !== 0 ? fmt(r.qq) : ""` |
| 12 | `precio` | `Precio` | `precio` | derecha | `r.precio !== 0 ? fmt(r.precio) : ""` |
| 13 | `total` | `Total` | `total` | derecha | `fmt(r.total)` — **siempre** se muestra, incluso `0.00` |
| 14 | `retencion` | `Retención` | `retencion` | derecha | `r.retencion !== 0 ? fmt(r.retencion) : ""` |
| 15 | `debe` | `Debe` | `debe` | derecha | `fmt(r.debe)` — **siempre** se muestra, incluso `0.00` |
| 16 | `haber` | `Haber` | `haber` | derecha | `r.haber !== 0 ? fmt(r.haber) : ""` |
| 17 | `saldo` | `Saldo` | `acumulado` | derecha | `fmt(r.acumulado)` con color según signo (abajo) |

Reglas de celda que hay que copiar sin reinterpretar:

- **Celdas numéricas vacías:** Humedad, QQ, Precio, Retención y Haber muestran `""` cuando el valor es exactamente `0` (el legacy mostraba `0.00`). **Total y Debe sí muestran `0.00`.**
- **Saldo con color:**

```tsx
{
  key: "saldo", label: "Saldo", align: "right",
  render: (r) => (
    <span
      className={cn(
        "font-semibold",
        r.acumulado > 0 ? "text-green-600" : r.acumulado < 0 ? "text-destructive" : "",
      )}
    >
      {fmt(r.acumulado)}
    </span>
  ),
},
```

  `> 0` verde, `< 0` rojo (`text-destructive`), `0` **sin clase de color** (hereda el color de la celda; `font-semibold` se aplica siempre).
- **Sin ordenamiento por columna** (BM-2): ninguna columna define `onHeaderClick` ni `headerTitle`. La única forma de orden es la cronológica del `ORDER BY`.
- `getRowKey={(r) => r.idVentaKardex}`.
- Sin `rowClassName`, sin franjas, sin `footer`, sin `wrap` (default `false` → una línea por celda).
- El header "Guía" y "Retención" llevan tilde; "Sucursal", "Chofer", "Placa", "Concepto", "Destino", "Factura", "Producto", "Humedad", "QQ", "Precio", "Total", "Debe", "Haber", "Saldo" no.

### 7.3 `TextoLargo` (Concepto y Destino)

```tsx
function TextoLargo({ texto }: { texto: string }) {
  return (
    <span className="inline-block max-w-[280px] truncate align-bottom" title={texto}>
      {texto}
    </span>
  )
}
```

- Ancho máximo **280 px** con `truncate` (overflow oculto + elipsis + `whitespace-nowrap` que ya aporta la celda).
- **Tooltip nativo** con `title` = texto completo (Bm-10 del doc legacy: `DESTINO` llega a 2117 caracteres).
- `align-bottom` para que el recorte no desalinee la celda.
- `Destino` puede contener textos larguísimos; el `title` es la única forma de verlos completos (no hay modal ni expand).

### 7.4 Orden cronológico

- Lo garantiza el SQL (`ORDER BY VK.fecha, VK.idVentaKardex`) y **la UI no lo altera**: no hay headers clickeables.
- El `SALDO` es un acumulado, así que **cualquier reordenamiento rompería su significado** (BM-2 del doc legacy: en WinForms todas las columnas eran ordenables y ordenar como texto los números dejaba `"1,202.32" < "200.00"`).
- La grilla no se re-ordena en el cliente en ningún caso; `ReportTable` respeta el array recibido.

### 7.5 Virtualización (hecha a mano, sin librería)

```tsx
<ReportTable
  rows={data.movimientos}
  columns={columns}
  getRowKey={(r) => r.idVentaKardex}
  fill
  paginate={false}
  virtualize
  colWidths={anchos ?? undefined}
  emptyMessage="Sin movimientos visibles para este cliente."
/>
```

**No hay librería de virtualización.** Ni `react-window`, ni `react-virtualized`, ni `@tanstack/react-virtual`: el proyecto tiene `@tanstack/react-table` como dependencia, pero `ReportTable` **no la usa**. La ventana se calcula con una función pura propia y se materializa con espaciadores `<tr>`.

**Condición de activación** (`ReportTable`):

```ts
const virtualizacionActiva =
  virtualize && !paginate && !wrap && rows.length > UMBRAL_FILAS_VIRTUALIZACION
```

| Constante | Valor | Significado |
|---|---|---|
| `UMBRAL_FILAS_VIRTUALIZACION` | `150` | Con ≤150 filas se renderiza todo (la maquinaria no vale la pena). |
| `ALTO_FILA_FALLBACK` | `33` | Alto de fila (px) hasta medir la primera fila real. |
| `OVERSCAN_FILAS` | `4` | Filas extra arriba y abajo de la ventana visible. |
| `ALTO_CONTENEDOR_FALLBACK` | `600` | Alto del contenedor (px) mientras `clientHeight` no es legible. |

**Cálculo de la ventana** (`components/shared/virtual-window.ts`, función pura `calcularVentanaVirtual`):

```ts
if (rowCount <= 0) return { primera: 0, ultima: -1 }
if (containerHeight <= 0 || rowHeight <= 0) return { primera: 0, ultima: rowCount - 1 }

const ultimaFila = rowCount - 1
const primera = clamp(Math.floor(scrollTop / rowHeight) - overscan, 0, ultimaFila)
const ultima = clamp(primera + Math.ceil(containerHeight / rowHeight) + overscan, 0, ultimaFila)
return { primera: clamp(primera, 0, ultima), ultima }
```

Reglas derivadas:

- La ventana **sigue solo el `scrollTop`**; no incorpora la celda activa (eso lo resuelve `ReportTable` con un `useLayoutEffect`).
- Invariante: `0 ≤ primera ≤ ultima ≤ rowCount − 1`.
- Defensivos: dataset vacío → ventana vacía; contenedor o alto de fila inválidos → render completo.
- **Alto de fila**: se mide **una vez por dataset** con `offsetHeight` de la primera fila montada (`refMedicionFila`); hasta entonces se usa `33`. Es uniforme porque `wrap` está en `false` (una línea por celda).
- **Espaciadores**: dos `<tr aria-hidden="true">` con un `<td colSpan={columns.length}>` de alto fijo — `primera * alturaFila` arriba y `(rows.length - 1 - ultima) * alturaFila` abajo, con `padding: 0, border: 0`.
- **`onScroll` barato**: recalcula la ventana y **solo** hace `setState` cuando cambian `primera` o `ultima`; un scroll dentro de la misma ventana no re-renderiza.
- **Reset por dataset**: cuando cambia la referencia de `rows`, se vuelve a `scrollTop 0`, se descarta el alto medido y se re-mide el contenedor (`useLayoutEffect` con dependencia `[rows]`).
- **Celda activa fuera de la ventana**: un `useLayoutEffect` scrollea el contenedor antes del `scrollIntoView` del hook, con destino `Math.max(0, active.r * alturaFila - altura * 0.4)` (la fila queda al 40 % desde arriba). Así la celda destino ya está montada cuando el hook intenta verla.

**Por qué importa acá:** el doc legacy midió un cliente con **1782 movimientos** (cliente 8438, §6.2). Sin virtualización se montan 1782 filas × 17 celdas y el DOM se traba.

### 7.6 Congelado de anchos de columna (`colWidths`)

Problema: con virtualización + `table-layout: auto`, el ancho de cada columna se recalcula con las filas **montadas**; al scrollear cambian las filas y la tabla "respira" horizontalmente.

Solución implementada en `kardex-venta-historial-tabla.tsx`:

1. Se calcula en `useMemo` (dependencia `[data]`) un **valor representativo por columna** = el más largo del **dataset completo** (no de las filas montadas):

```tsx
const masLargo = (texto: (r: MovimientoKardexVentaRow) => string) =>
  filas.reduce((a, b) => (texto(b).length > texto(a).length ? b : a))
const masLargoFmt = (valor: (r: MovimientoKardexVentaRow) => string) =>
  filas.reduce((a, b) => (valor(b).length > valor(a).length ? b : a))
```

   Para las columnas numéricas se compara el **texto ya formateado** (`fmt`), y el valor que se devuelve se vuelve a formatear (`fmt(Number(...))`). Para Concepto y Destino se devuelve un `<TextoLargo>` (así el ancho queda capsado a 280 px, "efecto tamaño fijo").
   Con dataset vacío devuelve `[]` (un `reduce` sin valor inicial lanzaría).

2. Se renderiza una **tabla oculta de medición** con 2 filas (headers + valores más largos):

```tsx
<div aria-hidden="true" style={{ position: "fixed", top: 0, left: 0, visibility: "hidden", zIndex: -1 }}>
  <table ref={tablaMedicionRef} className="text-sm">
    <tbody>
      <tr>{columns.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left">{c.label}</th>)}</tr>
      <tr>{muestraValores.map((valor, i) => (
        <td key={columns[i].key} className={cn("whitespace-nowrap px-3 py-1.5", columns[i].align === "right" && "font-mono tabular-nums")}>{valor}</td>
      ))}</tr>
    </tbody>
  </table>
</div>
```

3. `useLayoutEffect` (dependencia `[muestraValores]`) mide `celda.offsetWidth` de cada columna en esa tabla y guarda **`max + 2`** px (los 2 px cubren el borde del `divide-y`). Si alguna columna mide 0, guarda `null` y no fija anchos.

4. `colWidths={anchos ?? undefined}` → `ReportTable` activa `table-layout: fixed` + `<colgroup><col style={{ width: `${w}px` }} /></colgroup>` y agrega `overflow-hidden` a cada `td` (el contenido que desborda se recorta en vez de invadir la columna vecina).

Notas de réplica:

- Corre en `useLayoutEffect` ⇒ antes del paint: el primer render visible ya sale con anchos fijos (sin "flash" de `auto → fixed`).
- El cálculo es O(n) sobre todo el dataset **una vez por cambio de dataset**; con 1782 filas es trivial comparado con montar todas las filas.
- `align` no afecta el ancho: el `th` de medición siempre es `text-left`; el `td` de medición replica `font-mono tabular-nums` en columnas numéricas para que el ancho medido sea el real.

### 7.7 Estados de la grilla del historial

| Estado | Qué se ve |
|---|---|
| **Sin movimientos visibles** (cliente existente, todo oculto por BG-1) | Cabecera completa + `"Sin movimientos visibles para este cliente."` centrado (`emptyMessage` de `ReportTable` con `fill`). El contador dice `0 movimientos`. |
| **Cliente inexistente o id inválido** | Estado vacío de página (`"Cliente sin movimientos visibles"` + botón volver), sin cabecera (§4.5). |
| **Cargando** | **No existe estado de carga**: la página es un Server Component que llega ya resuelta. El `loading` prop de `ReportTable` no se usa. |
| **Error** | Sin `try/catch`: la pantalla de error por defecto de Next (§4.5). |

### 7.8 Teclado y accesibilidad

Idéntico a la pantalla 1 (§6.10) más lo específico de la virtualización:

- La navegación por flechas funciona sobre el **dataset completo** (`rowCount = rows.length`), no sobre la ventana montada.
- Al saltar a una fila fuera de la ventana, el contenedor scrollea primero y después el hook hace `scrollIntoView` (la celda ya existe).
- `PageUp`/`PageDown` saltan 25 filas (`pageSize` default), independientemente del alto de la ventana visible.
- `Ctrl/⌘+C` copia el texto de la celda activa (toast de Sonner). En celdas `TextoLargo` copia el texto **completo** (`textContent`), no el recortado.
- El `aria-label` del `role="grid"` no se pasa: la grilla no tiene nombre accesible.

---

## 8. Formatos de números y fechas

### 8.1 Números — `fmt` (`lib/fmt.ts`)

```ts
export function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
```

| Regla | Valor |
|---|---|
| Cultura | **`en-US` fija**, no la del navegador. |
| Separador de miles | coma (`,`) |
| Separador decimal | punto (`.`) |
| Decimales | **exactamente 2** (`minimumFractionDigits = maximumFractionDigits = 2`) |
| Negativos | signo menos adelante: `-13.66` |
| Redondeo | el de `Intl` (`toLocaleString`), a 2 decimales |

Ejemplos: `287092.92` → `"287,092.92"`; `-13.66` → `"-13.66"`; `0` → `"0.00"`; `1202.3` → `"1,202.30"`.

Consecuencias:

- `PRECIO` es `Decimal(18,8)` y se muestra con **2 decimales**: si algún día hay precios con más precisión, se redondean (Bm-9 del doc legacy; hoy no hay casos según §6.2 del mismo doc).
- No se usa `CsDecimal` en esta feature (§10): la conversión es `Number(...)` y el formateo `toLocaleString`. `a confirmar` si el sistema nuevo necesita exactitud decimal (los importes llegan a 2 decimales desde la base, así que `number` es seguro en el rango actual; ver §12).

### 8.2 Fechas — `formatFechaVenta` / `formatFechaMovimiento`

| Dónde | Formato | Ejemplo |
|---|---|---|
| Columna `Fecha` de la pantalla 1 | `formatFechaVenta(r.fecha)` → `d/M/yyyy H:mm` | `17/8/2026 15:47` |
| Columna `Fecha` de la pantalla 2, sin salida | `formatFechaMovimiento(fechaLiquida, null)` → `d/M/yyyy H:mm` | `17/8/2026 15:47` |
| Columna `Fecha` de la pantalla 2, con salida | `formatFechaMovimiento(l, s)` → `d/M/yyyy H:mm · salida d/M/yyyy H:mm` | `17/8/2026 15:47 · salida 17/8/2026 17:10` |
| Valor ausente | `"—"` | `—` |

Reglas:

- 24 horas, sin AM/PM.
- Sin ceros a la izquierda en día, mes ni hora; minutos siempre a 2 dígitos.
- Armado con getters **UTC** (`getUTCDate`, `getUTCMonth`, …): la fecha de la base se interpreta como UTC y se muestra sin conversión de zona. **No se usa `Intl.DateTimeFormat` ni `toLocaleString` para fechas.**
- El separador del sufijo es ` · ` (espacio, `U+00B7`, espacio).

---

## 9. Diferencias intencionales vs legacy WinForms

Régimen de bugs del doc legacy §9. Esta tabla dice **qué hace el código nuevo** con cada uno. "Calcar" = se replicó el comportamiento viejo a propósito.

| ID | Legacy | En esta implementación | Estado |
|---|---|---|---|
| **BM-1** | El historial lanzaba `IndexOutOfRangeException` cuando el SP no devolvía filas (`mitabla[0]`), y la cabecera salía de la primera fila. | Cabecera desde `Cliente` (consulta propia) y dos guards de estado vacío (`data === null`, `cliente === null`). Texto: "Cliente sin movimientos visibles". | **Corregido ya** |
| **BM-2** | Todas las columnas del historial eran ordenables como texto → rompía el orden cronológico y el `SALDO`. | El historial **no tiene ninguna columna ordenable**. La lista tiene **una sola** columna ordenable (Total), con orden numérico real y toggle `null → asc → desc → null`. | **Corregido ya** |
| **BM-3** | La consulta de saldos no tenía `ORDER BY` (orden indefinido). | `ORDER BY CL.NombreCompleto, K.idCliente`. | **Corregido ya** |
| **BM-4** | `FECHA` del historial era un texto armado en SQL: mezcla de formatos dependiente del idioma del login, con `' - '` colgando y `'_____'` muerto. | Las fechas viajan **crudas** (`Date`) en el DTO y se formatean en el cliente con `formatFechaMovimiento` (`d/M/yyyy H:mm` + ` · salida …`). | **Corregido ya** |
| **BM-7** | Una consulta **por tecla**, sincrónica, en el hilo de la UI. | Debounce **300 ms** + resultado-más-reciente-gana (contador `peticionRef`). **Sin `AbortController`**: la request vieja no se cancela, se descarta su resultado. | **Corregido parcialmente** (mejora real: 1 request por pausa de tecleo; la cancelación real no se implementó) |
| **BM-8** | El `TOTAL` del historial se pasaba como **texto** desde la celda de la pantalla 1 y se reconvertía con `Convert.ToDecimal` (cultura-dependiente); perdía la dirección. | `saldoActual` se calcula en el servidor **con signo**; la cabecera muestra `fmt(Math.abs(saldoActual))` y un `Badge` con la dirección. No se pasa nada de la pantalla 1 a la 2. | **Corregido ya** |
| **BM-9** | 450 de 498 clientes con saldo 0 ensuciaban la lista (y 448 se pintaban de salmón). Quedaba para fase 2. | **Implementado**: `soloConSaldo = true` por defecto (`AND (@conSaldo = 0 OR K.SALDO <> 0)`) + `Select` "Solo con saldo" / "Todos". | **Corregido (fase 2 adelantada, decisión del usuario)** |
| **Bm-12** | `%`, `_` y `[` del filtro funcionaban como comodines. | `escapeLike()` en TS (`!` como carácter de escape) + `ESCAPE N'!'` en el SQL. | **Corregido ya** |
| **BG-1** | El acumulado suma movimientos que los `INNER JOIN` ocultan: el `SALDO` "salta" sin fila que lo explique (1 caso conocido: cliente 40116 / movimiento 3781). | **Calcado**: los `INNER JOIN` siguen intactos y el acumulado corre sobre todos los movimientos. Comentario explícito en el SQL. | **Calcado** (arreglo en fase 2) |
| **BM-5** | Sin control por sucursal: el reporte es global. | **Calcado**: no hay filtro por `idLocal` ni restricción de sucursal; el subtítulo dice "(todas las sucursales)". | **Calcado (decisión confirmada)** |
| **BM-6** | Duplicación latente si un boleto tiene 2 cobros o 2 salidas. | **Calcado**: los `LEFT JOIN` a `BoletoSalidaVenta` y `CobroComprobanteVenta` no son deterministas. | **Calcado** (arreglo en fase 2) |
| **Bm-1** | Franjas `LightBlue` pintadas sobre los objetos de fila (quedaban desordenadas al ordenar). | **No hay franjas.** El hover (`hover:bg-muted/20`) y la celda activa (`bg-primary text-primary-foreground`) son estados, no decoración por fila. | **Reemplazado** |
| **Bm-2** | Alerta con `TimeSpan.Days` truncado y valor absoluto: una FECHA futura también alertaba; umbral `> 5` días. | Misma aritmética (`Math.trunc` + `Math.abs`) pero **escala de 3 niveles**: ≤15 verde, 16–30 amarillo, >30 rojo. | **Reemplazado por regla de usuario** (el log de decisiones, decisión 4, quedó superada: hablaba de `> 5` días y `bg-orange-200`) |
| **Bm-4** | `TIPO`/`TIPO PAGO` ocultas y `CODIGO` no visible. | **Calcado**: los tres llegan al DTO y no se renderizan. | **Calcado** |
| **Bm-7** | El módulo se llama "Excel" pero no exporta. | Tampoco exporta. | **Calcado** |
| **Bm-13** | `LlenarDgvVentaTotales` / `LlenarDgvVentaTotalesSinCero` duplicados. | Unificado en `soloConSaldo`. | **Corregido** |
| Formato de fecha | El legacy mostraba `M/d/yyyy H:mm` (`8/17/2026 15:47`), confirmado por el usuario en el doc legacy §8.3; el log de decisiones (decisión 8) lo repite. | **El código usa `d/M/yyyy H:mm`** (`17/8/2026 15:47`), pedido posterior del usuario. Los tests fijan el formato nuevo. | **Cambio de producto posterior** |
| Ventana modal | El historial era un modal sobre la lista; se abría con el `idCliente` y el `TOTAL` como texto. | **Página con URL propia** dentro del mismo layout de tabs; el `TOTAL` se recalcula. | **Reemplazado** |
| Textos | `REPORTE KARDEX DE VENTA`, `P. POR COBRAR`, `P. POR ENTREGAR`, `CLIENTE:`, `SALIR`. | `Reporte Kardex de Venta`, `Producto por Cobrar`, `Producto por Entregar`, `Cliente:`, `Volver al listado`. | **Reemplazado (diseño del sitio)** |

---

## 10. Dependencias a replicar

Todo lo que la feature importa, con qué hacer con ello en el sistema nuevo.

### 10.1 Copiar tal cual (código propio del proyecto)

| Ruta | Por qué es indispensable |
|---|---|
| `components/shared/report-table.tsx` | La grilla. Sin él no hay sticky header, navegación tipo Excel, `fill`, `paginate={false}`, virtualización ni `colWidths`. Copiar **completo** (incluye las constantes `UMBRAL_FILAS_VIRTUALIZACION = 150`, `ALTO_FILA_FALLBACK = 33`, `OVERSCAN_FILAS = 4`, `ALTO_CONTENEDOR_FALLBACK = 600`). |
| `components/shared/use-excel-navigation.ts` | Hook de teclado/selección/copia que `ReportTable` usa. Copiar completo (incluye `moverCelda`, `esNumerico`, `copiarAlPortapapeles`). |
| `components/shared/virtual-window.ts` | `calcularVentanaVirtual`, la función pura de la ventana. Copiar completo; el `.test.ts` (11 casos) es la red de seguridad. |
| `lib/fmt.ts` | `fmt()` con `en-US` y 2 decimales fijos. La paridad numérica depende de esto. |
| `lib/db.ts` | Singleton de `PrismaClient`. Reemplazable por el cliente que use el sistema nuevo, siempre que soporte SQL crudo parametrizado. |
| `_lib/kardex-venta.ts` | `escapeLike`, `formatFechaVenta`, `formatFechaMovimiento`. Es de la feature: va con ella. |
| `lib/utils.ts` | `cn()` = `twMerge(clsx(...))`. Lo usan todas las celdas con clases condicionales. |

### 10.2 Componentes shadcn/ui usados

| Componente | Uso en la feature |
|---|---|
| `components/ui/button.tsx` | Lupa (`ghost` + `icon-sm`), "Volver al listado" (`ghost` + `sm` + `asChild`). |
| `components/ui/card.tsx` | Contenedor del filtro. |
| `components/ui/input.tsx` | Filtro. |
| `components/ui/label.tsx` | "Buscar". |
| `components/ui/select.tsx` | "Solo con saldo" / "Todos". |
| `components/ui/badge.tsx` | Etiqueta de tipo en la cabecera del historial. |
| `components/ui/pagination.tsx` | **Lo usa `ReportTable`**, aunque no se vea: con `paginate={false}` el bloque solo se renderiza si `totalPages > 1`, y `totalPages` es `1`. Hay que tenerlo igual para que el componente compile. |

### 10.3 Librerías

| Paquete | Versión en este repo | Uso |
|---|---|---|
| `next` | `16.1.7` | App Router, `params` como `Promise`, `proxy.ts` en lugar de `middleware.ts`, Server Actions. |
| `react` / `react-dom` | `19.2.3` | `useLayoutEffect`, `useMemo`, `useRef`, `useState`. |
| `@prisma/client` / `prisma` | `^5.22.0` | `$queryRaw` con tagged templates. |
| `next-auth` | `^5.0.0-beta.30` | Sesión (solo para el shell/proxy). |
| `lucide-react` | `^0.577.0` | `ArrowLeft`, `ArrowUp`, `ArrowDown`, `ArrowUpDown`, `Loader2`, `Search`, `ClipboardList` (tab). |
| `sonner` | `^2.0.7` | Toasts de copia de celda (`toast.success` / `toast.error`) dentro del hook. |
| `clsx` + `tailwind-merge` | `^2.1.1` / `^3.5.0` | `cn()`. |
| `radix-ui` (`Slot`) | `^1.4.3` | `Button`/`Badge` con `asChild`. |
| `tailwindcss` | `^4` | Clases utilitarias (incluye variantes `dark:`). |
| `vitest` | `4.1.10` | Tests de los helpers (entorno `node`, alias `@/` → raíz). |

**No se usa:** `xlsx` (no hay exportación), `@tanstack/react-table` (la grilla es propia), `zod` (no hay validación de esquema en esta feature), `cs-decimal`, `mssql`.

### 10.4 `lib/cs-decimal` — existe en el repo pero **esta feature no lo usa**

`lib/cs-decimal/cs-decimal.ts` implementa un `CsDecimal` que replica `System.Decimal` de .NET (mantisa BigInt de 96 bits, escala ≤ 28, redondeo half-to-even, `truncateToScale` con semántica de `SqlParameter`). Es la herramienta correcta para paridad decimal exacta en otros módulos (caja, liquidaciones), **pero el Kardex de Venta no la importa**: convierte con `Number(...)` en el mapeo y formatea con `toLocaleString`.

Si el sistema nuevo necesita exactitud decimal (por ejemplo, para sumar miles de movimientos sin acumular error de coma flotante), este es el punto donde habría que introducirla — y sería una **desviación** del comportamiento actual, no una réplica.

---

## 11. Checklist de réplica paso a paso

Orden recomendado. Cada paso dice qué queda funcionando y cómo verificarlo.

### Paso 0 — Prerrequisitos

- [ ] App Next.js (App Router) con el **mismo `PrismaClient` apuntando a la misma base SQL Server** (o un cliente equivalente que permita SQL crudo parametrizado).
- [ ] Shell de la app con layout de altura fija (`h-12` de header) y el grupo de rutas equivalente a `app/(main)`.
- [ ] Auth resuelta en el shell (proxy/middleware + redirect en el layout). **Decidir explícitamente** si se agrega control de rol/sucursal: la feature actual no lo tiene (§2.2).

### Paso 1 — Rutas

- [ ] Crear `ventas/operaciones/kardex-venta/page.tsx` y `ventas/operaciones/kardex-venta/[idCliente]/page.tsx`.
- [ ] Agregar el tab "Kardex de Venta" (`ClipboardList`) al nav, con activo por `pathname === href || pathname.startsWith(href + "/")`.
- [ ] Verificar: el tab queda resaltado también dentro de `[idCliente]`.

### Paso 2 — Librerías compartidas

- [ ] Copiar `report-table.tsx`, `use-excel-navigation.ts`, `virtual-window.ts` (+ su test) y `lib/fmt.ts`, `lib/utils.ts`.
- [ ] Copiar los componentes shadcn usados (`button`, `card`, `input`, `label`, `select`, `badge`, `pagination`).
- [ ] Verificar que `ReportTable` importa `pagination` (aunque no se renderice con `paginate={false}`): si falta, no compila.

### Paso 3 — Helpers puros + tests (primero los tests)

- [ ] Crear `_lib/kardex-venta.ts` con `escapeLike`, `formatFechaVenta`, `formatFechaMovimiento`.
- [ ] Crear `_lib/kardex-venta.test.ts` con los 15 casos de §11.2.
- [ ] Verificar: `pnpm test` (o el runner del proyecto) en verde **antes** de tocar la base.

### Paso 4 — Server actions

- [ ] Crear `_actions/index.ts` con `"use server"`.
- [ ] Pegar los dos DTOs y los dos `Raw*` **tal cual** (§4.2, §4.3): los alias SQL y el case de las claves tienen que coincidir.
- [ ] Pegar el SQL **verbatim**, sin "optimizar" los JOIN (rompe BG-1), sin cambiar `ORDER BY` (rompe BM-2/BM-3) y sin cambiar `ESCAPE` (rompe Bm-12 junto con `escapeLike`).
- [ ] Implementar `mapSaldoRow`, `aFecha`, `MS_POR_DIA`, la escala de antigüedad, el acumulador de totales, y `mapMovRow` + las dos consultas auxiliares + el `tipo` derivado.
- [ ] Verificar contra la base: totales de la lista y cantidad de filas de un cliente conocido (§11.3).

### Paso 5 — Pantalla 1

- [ ] Estado (`filtro`, `soloConSaldo`, `loading`, `error`, `data`, `ordenTotal`, `peticionRef`).
- [ ] Efecto con debounce 300 ms + latest-wins.
- [ ] Fila filtro + tarjetas de resumen con los textos exactos.
- [ ] Columnas en el orden de §6.6, con los colores y la escala de antigüedad.
- [ ] `ReportTable` con `fill`, `paginate={false}`, `emptyMessage="Sin resultados para el filtro actual."`, `getRowKey` por `idCliente`.
- [ ] Envoltorio `min-h-0 flex-1` + bloques `shrink-0` (sin esto se pierde el final de la tabla).
- [ ] Verificar: escribir rápido en el filtro no deja resultados viejos, y el spinner del input aparece/desaparece.

### Paso 6 — Pantalla 2

- [ ] Parsear `idCliente` con `Number.isInteger(id) && id > 0`.
- [ ] Dos guards de estado vacío con el mismo markup y texto.
- [ ] Cabecera con `Cliente:`, `RUC:`, `Total:` (`fmt(Math.abs(saldoActual))`), `Badge` con `data.tipo` y el contador `N movimientos`.
- [ ] Botón "Volver al listado" (`ArrowLeft`) arriba, en su propia fila.
- [ ] Delegar la grilla al client component, dentro de `min-h-0 flex-1`.

### Paso 7 — Grilla del historial

- [ ] 17 columnas en el orden de §7.2, con `TextoLargo` en Concepto y Destino.
- [ ] Regla de "vacío cuando 0" en Humedad, QQ, Precio, Retención, Haber; siempre visible en Total y Debe.
- [ ] Color del Saldo por signo.
- [ ] `virtualize` + `colWidths` + la tabla oculta de medición con `useLayoutEffect`.
- [ ] Verificar con un cliente de 1000+ movimientos: sin virtualizar (para comparar), luego con `virtualize`. El scroll no debe mover las columnas horizontalmente.

### Paso 8 — Formatos y textos

- [ ] Números con `fmt` (2 decimales `en-US`) en **todas** las celdas y tarjetas.
- [ ] Fechas con `formatFechaVenta` / `formatFechaMovimiento` (`d/M/yyyy H:mm`, UTC).
- [ ] Ningún `toLocaleString` de fecha, ningún `Intl.DateTimeFormat` para fecha, ningún locale del navegador para números.

### Paso 9 — Verificación

- [ ] `tsc --noEmit` (o `next build`) sin errores.
- [ ] Runner de tests en verde (helpers + `virtual-window` + `use-excel-navigation` si se copiaron con sus tests).
- [ ] Smoke de solo lectura contra la base: filtro vacío, filtro por nombre, filtro por monto, cliente conocido del historial, cliente inexistente, id inválido.
- [ ] Revisar la lista de "a confirmar" de §12 y resolverla antes de dar la réplica por cerrada.

### 11.2 Tests existentes como casos de aceptación

`_lib/kardex-venta.test.ts` — **15 casos**, todos de funciones puras, sin mocks ni base:

| Grupo | Caso | Esperado |
|---|---|---|
| `escapeLike` (7) | duplica el escape `!` | `"a!b"` → `"a!!b"` |
| | escapa `%` | `"50%"` → `"50!%"` |
| | escapa `_` | `"con_suma"` → `"con!_suma"` |
| | escapa `[` | `"c[oco"` → `"c![oco"` |
| | deja pasar texto plano | `"CONSUMIDOR FINAL"`, `"Ñustes - Pérez"` sin cambios |
| | texto vacío | `""` → `""` |
| | varios comodines juntos | `"50%_c[o]!"` → `"50!%!_c![o]!!"` |
| `formatFechaVenta` (5) | `d/M/yyyy H:mm` sin ceros iniciales | `2026-08-17T15:47Z` → `"17/8/2026 15:47"` |
| | mes/día/hora de un dígito | `2026-01-05T09:07Z` → `"5/1/2026 9:07"` |
| | minutos a 2 dígitos | `2026-03-12T08:05Z` → `"12/3/2026 8:05"` |
| | acepta `string` | `"2026-08-17T15:47:00.000Z"` → `"17/8/2026 15:47"` |
| | `null`/`undefined`/`""` | `"—"` |
| `formatFechaMovimiento` (3) | con salida | `"17/8/2026 15:47 · salida 17/8/2026 17:10"` |
| | sin salida (`null` / `undefined`) | `"17/8/2026 15:47"` |
| | sin ninguna fecha | `"—"` |

Tests de las dependencias copiadas (si se replican): `components/shared/virtual-window.test.ts` (**11 casos**) y `components/shared/use-excel-navigation.test.ts` (**15 casos**).

### 11.3 Casos de paridad legacy que conviene re-verificar contra la base

Del doc legacy §8.4, los relevantes para esta implementación (los números son del snapshot de ese documento y **pueden haber cambiado**):

| # | Caso | Qué mirar |
|---|---|---|
| T1 | Lista con filtro vacío y "Todos" | 498 filas y totales `287,092.92` / `183,249.69` en ese snapshot. |
| T2 | Filtro con mayúsculas, acentos y `Ñ` | Mismo conjunto que `LIKE` con la collation de la base. |
| T3 | Filtro con `%`, `_`, `[` | Comportamiento **nuevo**: literal. Un `%` solo no debe devolver todo. |
| T4 | FECHA a 5 d 23 h / 6 d / futuro | Niveles `bajo` / `bajo` (si ≤15) / escala por valor absoluto. |
| T5 | Cliente sin fecha de referencia | `fechaEsHoy = true`, `diasAntiguedad = 0`, nivel `bajo`. |
| T7 | Cliente 40116 | 3.ª fila visible con `ACUMULADO -13.66` (BG-1 calcado). |
| T9 | Cliente 8438 (1782 filas) | Grilla virtualizada, sin bloquear; columnas estables al scrollear. |
| T10 | Cliente sin filas visibles | Estado vacío, sin error. |
| T11 | Último `SALDO` visible vs `saldoActual` | Coinciden para todos los clientes del snapshot. |

---

## 12. Limitaciones conocidas, riesgos y pendientes

### 12.1 Pendientes funcionales (fase 2 del doc legacy, no implementados)

| Tema | Estado acá |
|---|---|
| Exportación XLSX / PDF | **No existe.** El módulo se llama "Kardex de Venta" pero no exporta (doc legacy §10.1, Bm-7). |
| Corregir BG-1 (`LEFT JOIN` + indicador "sin asiento") | **No.** Se calca el salto del `SALDO` (§3.2). |
| Corregir BM-6 (cobro/salida determinista) | **No.** Puede duplicar filas si un boleto tiene 2 cobros. |
| Mostrar `TIPO`, `TIPOPAGO`, `CODIGO` en el historial | **No.** Llegan al DTO, no se renderizan. |
| Filtro por rango de fechas, drill-down al boleto/asiento | **No.** |
| Filtro por tipo (por cobrar / por entregar) | **No.** Solo el `Select` de "solo con saldo" / "todos". |
| Columna explícita de días de antigüedad | **No.** Solo el color de la celda FECHA; el umbral no es configurable (fijo 15/30). |
| Índices del doc legacy §7.3 | **No aplicados** (no hay migración en el repo). |
| Limpieza del dato (movimiento 3781, fila 4283) | Fuera de alcance de la app. |

### 12.2 Brechas de seguridad (a resolver en el sistema nuevo)

1. **Server Actions sin control propio.** `getSaldosKardexVenta` y `getMovimientosKardexVenta` no verifican sesión, rol ni sucursal. La única barrera es el proxy + el layout del shell (§2.1). En este repo hay acciones del mismo dominio que **sí** validan dentro de la action (`obtenerVentasCopiarKardex`: `usuarioActual()`, `autorizarAccesoSucursal`, pertenencia del cierre). Si el admin nuevo se monta sobre otro mecanismo de auth, o expone las funciones por otro canal, queda un hueco de lectura de datos financieros de **todos** los clientes.
2. **Sin control por sucursal, por diseño** (BM-5). Cualquier usuario autenticado ve el saldo global. Si el negocio del sistema nuevo requiere aislamiento por sucursal, hay que agregar `idLocal` al `WHERE` de las dos consultas y a las dos auxiliares — es un cambio de producto, no una réplica.
3. **`idCliente` enumerable y sin auditoría.** Cualquier id positivo devuelve el historial completo de ese cliente. No hay log de accesos ni rate limit.
4. **El error de la pantalla 1 no deja rastro.** `catch {}` descarta la excepción y muestra un texto fijo: no hay `console.error`, ni captura de telemetría, ni código de correlación.
5. **Sin `error.tsx`/`global-error.tsx` en la app**: un fallo de base en la pantalla 2 termina en la pantalla de error por defecto de Next con stack en desarrollo.

### 12.3 Riesgos y defectos observados en la implementación actual

| # | Hallazgo | Detalle |
|---|---|---|
| R1 | **La búsqueda por monto no acepta lo que la grilla muestra** | El filtro se compara contra `CAST(ABS(K.SALDO) AS VARCHAR(50))` (sin separador de miles, sin signo). Escribir `287,092.92` (tal como se ve en la columna Total) devuelve **0 filas**; `-13.66` tampoco matchea. Además `LIKE '%texto%'` sobre el número produce falsos positivos: `90` matchea `287092.92`. El `placeholder` ("Filtrar por cliente o total...") no advierte nada de esto. |
| R2 | **`data` viejo visible tras un error** | En la pantalla 1, el `catch` no limpia `data`: la grilla sigue mostrando el resultado anterior, con el mensaje de error arriba. Un usuario puede leer importes obsoletos como si fueran actuales. |
| R3 | **No hay cancelación real de requests** | El doc legacy §8.2 pedía `AbortController`; acá solo se descarta la respuesta (contador `peticionRef`). Cada pausa de tecleo dispara una consulta al servidor aunque la anterior siga viajando. |
| R4 | **Totales que suman valores absolutos** | `porCobrar`/`porEntregar` suman `ABS(saldo)` por tipo (paridad legacy). No son un neto y no se compensan entre sí; el "total general" no existe. |
| R5 | **`number` en lugar de decimal** | Toda la cadena usa `Number(...)`. Con `decimal(18,2)` y los volúmenes actuales no hay pérdida práctica, pero se pierde la exactitud que el repo ya tiene resuelta en `lib/cs-decimal` (§10.4). Sumar cientos de `number` puede introducir diferencias de centavos frente a la suma de SQL en casos extremos. `a confirmar` si el admin nuevo exige exactitud. |
| R6 | **Riesgo de zona horaria en la FECHA** | La fecha se muestra con getters UTC, pero el fallback `GETDATE()` devuelve la hora **local del servidor SQL**. Si el servidor no está en UTC, la FECHA de los clientes sin fecha de referencia se muestra corrida por el offset. El cálculo de `diasAntiguedad` no se ve afectado (compara dos timestamps del mismo reloj). `a confirmar` cuál es la convención real de la base. |
| R7 | **Un id inválido se disfraza de "sin movimientos"** | `[idCliente]` con `0`, `-1`, `abc` o `1.5` muestra "Cliente sin movimientos visibles" (no un 404). Es ambiguo para el usuario y para el sistema nuevo (SEO/logs no distinguen). |
| R8 | **`1 clientes`** | El conteo de las tarjetas no pluraliza. |
| R9 | **Estado vacío duplicado** | El markup del estado vacío de la pantalla 2 está copiado dos veces (guard `!data` y guard `cliente === null`). Cosmético, pero se desincroniza fácil. |
| R10 | **`saldo` del DTO sin consumidor** | `SaldoKardexVentaRow.saldo` (el saldo con signo) viaja al cliente y **ninguna columna lo usa**: la UI usa `total` (ABS) y `idTipo`. Es payload muerto hoy, y la columna con signo quedó como mejora futura. |
| R11 | **Grillas sin nombre accesible** | `ReportTable` acepta `ariaLabel` en el hook, pero no lo pasa: `role="grid"` sin etiqueta. |
| R12 | **Costo de la medición de anchos** | El historial recorre todo el dataset en un `reduce` para hallar el valor más largo (por columna) cada vez que cambia `data`, y mide `offsetWidth` de 17 columnas (reflow forzado) en un `useLayoutEffect`. Con 1782 filas es aceptable; con decenas de miles habría que optimizarlo. |
| R13 | **La consulta de saldos escanea `Venta_Kardex` completa** | `GROUP BY VK.idCliente` sin índice útil (`IX_Venta_Kardex_idCliente_fecha` no existe, §3.4) y `LIKE '%…%'` sobre `NombreCompleto`. Hoy son 498 grupos; crece con el negocio. |
| R14 | **`fechaSalida` depende de `PesoSalida`** | Si hay salida registrada sin peso (`PesoSalida` NULL) pero con `FechaHora`, la fecha de salida se descarta. Es paridad con el SP legacy, pero puede sorprender. |
| R15 | **Comentario del archivo desactualizado en el formato de fecha** | El README del módulo todavía documenta `formatFechaVenta` como `M/d/yyyy H:mm` mientras el código y los tests usan `d/M/yyyy H:mm`; el log de decisiones (decisión 8) también quedó viejo. La verdad es el código (§5.2). |

### 12.4 Lista consolidada de "a confirmar"

1. **§3.1 / §3.3** — ¿El sistema nuevo necesita reglas de negocio por `idVentaKardexTipo` (PENDIENTE/PAGO/ANTICIPO/PERDIDA/AJUSTE/INGRESO/NO COBRADO/COMISION)? Acá solo se usan 1, 2 y 3, y solo para elegir la FECHA.
2. **§3.3** — ¿Existen filas de `Venta_Kardex` con `debe` o `haber` en NULL? De eso depende que las dos fórmulas de saldo (`SUM(debe)-SUM(haber)` vs `SUM(debe-haber)`) coincidan siempre. No se ejecutó SQL en esta revisión.
3. **§7.1** — ¿Puede el último movimiento cronológico de un cliente quedar oculto por los `INNER JOIN`? Si sí, el último `ACUMULADO` visible no coincide con `saldoActual` de la cabecera.
4. **§6.7** — ¿Se acepta que el desempate del orden local use `localeCompare` (ICU del navegador) y no la collation de SQL? Hoy pueden diferir en el orden de nombres con acentos/Ñ.
5. **§8.1 / §10.4** — ¿Se requiere exactitud decimal (`CsDecimal`) en lugar de `number`?
6. **§12.3 R6** — ¿Cuál es la convención de zona horaria de los `datetime` de la base y de `GETDATE()`? Hoy se asume "la base guarda UTC" al formatear, pero el fallback es el reloj local del servidor.
7. **§12.3 R5/R1** — ¿El nuevo admin debe replicar el filtro por monto con la misma semántica (texto crudo del `CAST`), o es aceptable normalizar el número y buscar por valor?
8. **§2.2** — ¿El sistema nuevo tiene roles/sucursales que deban aplicarse a este reporte, o se mantiene global sin control (paridad)?

---

## Anexo A — Módulos vecinos que NO son esta feature

Relevados para descartar dependencias compartidas. **No se documentan en profundidad** y **no comparten código ni consultas** con `/ventas/operaciones/kardex-venta`.

| Módulo | Qué es | Relación con esta feature |
|---|---|---|
| `app/(main)/reportes/venta/kardex-totales` | Reporte "totales" (equivalente al `FrmVentaKardexClienteTotal` legacy): el mismo universo de saldos por cliente. | **Ninguna dependencia.** Tiene su **propia copia** de la consulta legacy de 4 CTE (`WITH A … B … C … D`), con `incluirCeros` en lugar de `soloConSaldo` y **sin** el filtro por nombre ni el de monto. No importa nada de `kardex-venta/`. |
| `app/(main)/reportes/venta/kardex-cliente` | Historial por cliente (equivalente al SP `REPORTE_VENTA_KARDEX`). | **Ninguna dependencia.** Reimplementa el SP con el marco `RANGE` (`SUM(SUM(...)) OVER (ORDER BY VK.fecha)`), `FECHA_SALIDA` como **texto** con `FORMAT(... 'en-US')`, `CODIGO`/`CLIENTE`/`RUC` dentro de la misma consulta y `ORDER BY` implícito. Es la versión "legacy verbatim"; **no** es la que usa esta feature. |
| `app/(main)/reportes/venta/kardex` | Kardex de ventas por rango de fechas/sucursal/producto (otro reporte). | **Ninguna.** Consulta distinta (ventas, no cuenta corriente de cliente). |
| `app/(main)/cierre/reporte/_components/ventas/copiar-kardex-ventas.tsx` | Grilla "VENTAS COPIAR KARDEX" del cierre (`FrmDgvCopiarVenta`), alimentada por `obtenerVentasCopiarKardex` de `cierre/reporte/_actions/ventas.ts`. | **Ninguna dependencia**, pero es el **contraejemplo de seguridad** citado en §2.2: esa action sí valida sesión y sucursal. Comparte con esta feature solo `ReportTable`. Tiene 19 columnas propias (`COLUMNAS_KARDEX_VENTA`) y `pageSize={100}`. |

Consecuencia práctica: en el repo conviven **tres implementaciones distintas** de la misma familia de datos (`Venta_Kardex` por cliente). Al replicar el Kardex de Venta hay que llevarse **la de `ventas/operaciones/kardex-venta`** (la que tiene las correcciones BM-1/2/3/4/7/8, Bm-12, la escala de antigüedad y la virtualización), no las otras.
