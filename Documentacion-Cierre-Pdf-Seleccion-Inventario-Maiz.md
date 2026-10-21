# Documentación — `Cierre PDF`: selección del cierre + sección Inventario de Maíz

> **Qué es este documento.** Especifica, con el detalle suficiente para reimplementarlo, **dos piezas** de la ruta `/reportes/contabilidad/cierre-pdf`:
> 1. el **selector de cierre** (cómo se busca, se elige y se propaga el cierre);
> 2. la sección **Inventario de Maíz** (de dónde salen los números, cómo se calculan y cómo se muestran).
>
> **Qué NO es.** No documenta el resto de la ruta (bloque *Circulante* — activos/pasivos/patrimonio, ingresos/egresos y totales —, ni las secciones *Bancos*, *Estado de Producto* y *Producto Embodegado*, ni el botón de impresión general). Se mencionan sólo cuando afectan a las dos piezas documentadas.
>
> **Para quién.** Para llevar estas dos piezas a otro sistema, de uso exclusivamente administrativo. Por eso el documento incluye modelo de datos, SQL real, formatos y un contrato de datos equivalente (§4.7 y §5.9), no sólo una descripción de pantalla.
>
> **Cómo verifiqué.** Todo lo que sigue sale de leer el código listado en §6.3. **No** ejecuté la aplicación contra la base ni medí tiempos reales: lo que depende de datos vivos (por ejemplo, qué sucursales aparecen o cuántas filas trae un cierre concreto) está marcado como *no verificado en ejecución*.

---

## Índice

1. [Alcance](#1-alcance)
2. [Mapa de la ruta](#2-mapa-de-la-ruta)
3. [Modelo de datos involucrado](#3-modelo-de-datos-involucrado)
4. [Pieza A — Selección del cierre](#4-pieza-a--selección-del-cierre)
5. [Pieza B — Sección Inventario de Maíz](#5-pieza-b--sección-inventario-de-maíz)
6. [Anexos](#6-anexos)

---

## 1. Alcance

### 1.1 Qué documenta

| Pieza | Archivos | Qué hace |
|---|---|---|
| **A. Selector de cierre** | `_components/cierre-selector.tsx`, `components/shared/busqueda-cierre-dialog.tsx`, `app/(main)/_actions/cierres.ts`, `page.tsx` (`searchParams`) | Buscar cierres por fecha, elegir uno y navegar a `?idCierre=<n>` |
| **B. Inventario de Maíz** | `_actions/inventario-maiz.ts`, `_components/inventario-maiz-section.tsx`, `page.tsx` (gating) | Tabla de stock de maíz por sucursal al cierre seleccionado, con totales |

### 1.2 Qué queda fuera (y por qué importa)

El reporte selecciona también las fechas de la cabecera del cierre (`fechaInicial`, `fechaFinal`) y las usa para alimentar tres secciones más. **La única dependencia relevante para este documento** es que `fechaFinal` es un *parámetro de entrada* de la consulta de Inventario de Maíz:

```text
Conta_Cierre_Caja.fechaFinal  ──►  getInventarioMaizData(fechaFinal, idCierre)
Conta_Cierre_Caja.IdCierreProducto ──►  getInventarioMaizData(fechaFinal, idCierre)
```

Fuera de alcance, pero conviene saber que existen y en qué orden se pintan: `CierrePdfReport` (circulante), `BancosCierreSection`, `EstadoProductoSection`, `InventarioMaizSection`, `ProductoEmbodegadoSection` (§2.2).

---

## 2. Mapa de la ruta

### 2.1 Ruta y entradas

- **URL:** `/reportes/contabilidad/cierre-pdf` (parámetro de query: `idCierre`).
- **Entradas a la ruta en el sistema actual:**
  - tarjeta **"Cierre PDF"** en `/reportes` → `app/(main)/reportes/page.tsx` (categoría *Contabilidad*, `visible: true`);
  - pestaña **"CIERRE CIRCULANTE"** de `/reportes/cierre/reportes` → `app/(main)/cierre/reporte/_lib/tabs.ts` (`href: "/reportes/contabilidad/cierre-pdf"`).
- **Autenticación:** la ruta vive bajo `app/(main)/layout.tsx`, que exige sesión (`if (!session) redirect("/login")`).
- **Autorización por rol:** **esta ruta no valida rol**. No hay guard de `RolUsuario` ni de `IDLocal` en `page.tsx`, en `_components/cierre-selector.tsx` ni en `_actions/inventario-maiz.ts`. Si el sistema destino es *sólo administradores*, esa restricción es **nueva** y debe agregarse explícitamente (§4.7.4 y §5.9.4).

### 2.2 Composición de `page.tsx` (Server Component)

`page.tsx` es un componente de servidor: **no hay fetch en el cliente**; los datos se resuelven en el render.

```text
1. searchParams.idCierre  →  id = Number(idCierre) | null
2. si id  →  getCierrePdfData(id)        (1 llamada: cabecera + detalle + totales)
3. fi = data.cabecera.fechaInicial ; ff = data.cabecera.fechaFinal
4. en paralelo (Promise.all):
     bancos            ← fi && ff
     estadoProducto    ← ff
     inventarioMaiz    ← ff && id        ←  PIEZA B
     productoEmbodegado← ff
5. render:
     header (h1 "Cierre PDF" + subtítulo + <CierreSelector/> + <ImprimirButton/>)  [print:hidden]
     si !data → mensaje "Seleccioná un cierre para ver el reporte."
     si data  → CierrePdfReport
                Bancos           [print:break-before-page]
                EstadoProducto   [print:break-before-page]
                InventarioMaiz   [print:break-before-page]   ←  PIEZA B
                ProductoEmbodegado
```

Consecuencias que hay que respetar al reimplementar:

| Regla | Detalle |
|---|---|
| **Selección obligatoria** | Sin `idCierre` válido no se muestra nada salvo el mensaje de invitación. |
| **El botón de imprimir depende de los datos** | `{data && <ImprimirButton />}`: sólo aparece cuando la cabecera del cierre existe. |
| **Inventario de Maíz exige dos cosas** | `ff` (fecha final de la cabecera) **y** `id` numérico. Si la cabecera no se encontró, no hay sección (aunque el `idCierre` de la URL exista). |
| **La fecha no viaja por la URL** | `fechaFinal` se lee **de la base** (`Conta_Cierre_Caja`), nunca del query string. |
| **El id tampoco es el de la tabla `Cierre`** | La URL trae `Conta_Cierre_Caja.IdCierreProducto` (§3.6). |
| **Sección condicional, no vacía** | Si la consulta devolviera `null` (por falta de fecha/id) la sección **no se renderiza**; si devuelve `[]` sí se renderiza con su mensaje de vacío. |

### 2.3 Flujo completo de datos

```text
[Usuario] pulsa "Seleccionar cierre"
    │
    ├─ BusquedaCierreDialog (client)
    │     ├─ abre        → buscarCierres(idLocal, "")        ← server action
    │     ├─ escribe     → debounce 350 ms → buscarCierres(idLocal, query)
    │     └─ "Aceptar"   → onConfirm(cierre) → router.push(`?idCierre=${idCierre}`)
    │
    └─ page.tsx (server) re-render
          ├─ getCierrePdfData(id)         → cabecera (fechaInicial/fechaFinal/sucursal/usuario)
          └─ getInventarioMaizData(ff, id) → filas de maíz + (en el componente) totales
```

---

## 3. Modelo de datos involucrado

Motor: **SQL Server** vía Prisma (`db.$queryRaw`). Las columnas numéricas del cierre de producto están guardadas como **texto** (`NVarchar(100)`), lo que obliga a parsear en la aplicación (§5.4).

### 3.1 `Conta_Cierre_Caja` — cabecera del cierre contable (fuente del selector y de las fechas)

| Columna | Tipo | Uso en este documento |
|---|---|---|
| `IdCierre` | `Int` (PK, identity) | PK de la cabecera |
| `IdCierreProducto` | `Int?` | **FK lógica a `Cierre.IdCierre`** → es el `idCierre` que viaja en la URL |
| `IdLocal` | `Int?` | Sucursal del cierre |
| `IdUser` | `Int?` | Usuario que cerró (§ sólo lectura, se muestra en el bloque Circulante) |
| `saldoAnterior` | `Decimal(18,2)?` | Fuera de alcance |
| `saldoNuevo` | `Decimal(18,2)?` | Fuera de alcance |
| `fechaInicial` | `DateTime?` | **Entrada de la sección Bancos** |
| `fechaFinal` | `DateTime?` | **Entrada de la consulta de Inventario de Maíz** |

### 3.2 `Cierre` — cierre de inventario (el "cierre producto")

| Columna | Tipo | Uso |
|---|---|---|
| `IdCierre` | `Int` (PK) | Se compara con `Conta_Cierre_Caja.IdCierreProducto` |
| `IdLocal` | `Int?` | Sucursal; **se excluye `IdLocal = 1`** en el cálculo (§5.3) |
| `IdUser` | `Int?` | No se usa aquí |
| `FechaInicial` | `DateTime?` | No se usa aquí |
| `Fecha` | `DateTime?` | **Fecha de cierre**. Es la clave del "último cierre por sucursal" y del join de la consulta |

### 3.3 `Cierre_Producto` — inventario por producto guardado en cada cierre

| Columna | Tipo | Significado / uso |
|---|---|---|
| `IdCierreProducto` | `Int` (PK) | **No se usa** en este reporte (ojo: homónima del campo de `Conta_Cierre_Caja`, distinto significado) |
| `IdCierre` | `Int?` | FK a `Cierre.IdCierre` |
| `IDProducto` | `Int?` | FK a `Producto.IDProducto` |
| `Cantidad` | `NVarChar(100)?` | **STOCK** (quintales) → columna *Stock* |
| `Precio` | `NVarChar(100)?` | Precio unitario → columna *Precio* |
| `Inversion` | `NVarChar(100)?` | Inversión (stock × precio guardado) → columna *Inversión* |
| `UtilidadQQ` | `NVarChar(100)?` | Utilidad por quintal → columna *Util. QQ* |
| `UtilidadTotal` | `NVarChar(100)?` | Utilidad total del período → columna *Util. Total* |
| `PrecioDia`, `Humedad`, `Impureza`, `Automatico` | — | **No se usan** en este reporte |

> **Importante:** la sección **no recalcula** el inventario. Muestra los valores **ya guardados** por el cierre de producto. (El reporte `/reportes/cierre/inventario-maiz` sí recalcula compras/ventas/excedente; éste **no**.)

### 3.4 `Producto`

| Columna | Tipo | Uso |
|---|---|---|
| `IDProducto` | `Int` (PK) | Join con `Cierre_Producto` |
| `IDLocal` | `Int?` | Join con `Local` para armar el nombre mostrado |
| `Descripcion` | `NVarChar(MAX)?` | **Filtro exacto `= 'MAIZ'`** |

### 3.5 `Local`

| Columna | Tipo | Uso |
|---|---|---|
| `IDLocal` | `Int` (PK) | — |
| `Local` | `NVarChar(MAX)?` | Nombre de sucursal; se concatena al producto: `'MAIZ' + ' ' + Local` |

### 3.6 Relaciones y la trampa de los nombres

```text
Conta_Cierre_Caja ──(IdCierreProducto)──► Cierre ──(IdCierre)──► Cierre_Producto ──(IDProducto)──► Producto ──(IDLocal)──► Local
        │                                                                                                 
        └──(IdLocal)──► Local
```

- `Conta_Cierre_Caja.IdCierreProducto` **no** apunta a `Cierre_Producto.IdCierreProducto`: apunta a **`Cierre.IdCierre`**. Está confirmado por el resto del código del repo (p. ej. `app/(main)/cierre/caja/_lib/comun/ultimo-cierre-caja.ts` usa `INNER JOIN Conta_Cierre_Caja CCC ON C.IdCierre = CCC.IdCierreProducto`).
- Por eso el `idCierre` de la URL se usa tal cual en `WHERE C.IdCierre = @idCierre` dentro de la consulta de maíz.
- El nombre de sucursal que aparece en la tabla **sale del `Local` del producto** (`Producto.IDLocal`), no del `Local` del cierre. En la práctica coinciden porque cada sucursal tiene su propio producto `MAIZ`, pero no está garantizado por el join.

---

## 4. Pieza A — Selección del cierre

### 4.1 Componente y estados

`CierreSelector` es un componente cliente. Recibe `current = { idCierre, fechaInicial, fechaFinal } | null` (ya resuelto en el servidor).

| Estado | Disparador | Efecto visual |
|---|---|---|
| Inicial, sin cierre | `current == null` | Botón con icono lupa y texto **"Seleccionar cierre"** |
| Inicial, con cierre | `current != null` | Texto **`Cambiar cierre #<idCierre>`** |
| Navegando | dentro de `startTransition` tras confirmar | Spinner (`Loader2` animado) + texto **"Cargando…"** + botón `disabled` |

Reglas:

- El label **nunca** muestra fechas: sólo el número de cierre (`#123`).
- `isPending` deshabilita el botón para evitar dobles navegaciones.
- El diálogo se controla con estado local (`open`), no con la URL.

### 4.2 El diálogo de búsqueda (`BusquedaCierreDialog`)

Componente compartido (`components/shared/busqueda-cierre-dialog.tsx`), reutilizado por otros módulos. Contrato:

```ts
interface Props {
  open: boolean
  onClose: () => void
  idLocal: number
  onConfirm: (cierre: CierreOption) => void
  /** Fuente alternativa opcional; por defecto usa buscarCierres compartido. */
  buscar?: (idLocal: number, query: string) => Promise<CierreOption[]>
}
```

Comportamiento exacto:

| Aspecto | Regla |
|---|---|
| Título | **"Búsqueda por Cierre"** |
| Input | Placeholder **"Buscar por fecha..."**, `autoFocus`, icono de lupa a la izquierda |
| Carga inicial | Al abrir (`open === true`) se resetean `query` y la selección, y se ejecuta `buscar("")` |
| Debounce | **350 ms** desde la última tecla; cada tecla cancela el timer anterior |
| *Last-wins* | Un contador incremental (`busquedaIdRef`) descarta respuestas viejas: sólo la búsqueda más reciente puede escribir la lista |
| Selección | Click en un resultado selecciona (fila resaltada); **no** confirma |
| Limpieza de selección | Si el cierre seleccionado deja de estar en la lista nueva, la selección se borra |
| Error | `catch` → lista vacía + selección nula ⇒ se muestra **"Sin resultados."** (el diálogo no se rompe) |
| Al cerrar | Se cancela el debounce pendiente y se invalidan las respuestas en vuelo |
| Botonera | **Cancelar** (siempre) y **Aceptar** (deshabilitado mientras no haya selección) |
| Confirmar | `onConfirm(selected)` y luego `onClose()`; el cierre del diálogo lo decide el padre |
| Carga | Spinner centrado mientras `loading` |
| Lista vacía | Texto centrado **"Sin resultados."** |

Render de cada opción (dos líneas):

```text
Desde: 01/09/2025 08:00
Hasta: 30/09/2025 18:30
```

Ambas fechas se formatean con el helper `fechaHora` (§5.5.2). El identificador (`idCierre`) **no** se muestra.

### 4.3 La consulta de búsqueda

Server action `buscarCierres(idLocal, query)` en `app/(main)/_actions/cierres.ts`:

```sql
SELECT C.IdCierre, C.FechaInicial, C.Fecha
FROM Cierre C
WHERE C.IdLocal = @idLocal
  AND CONVERT(NVARCHAR, C.Fecha, 103) LIKE '%' + @query + '%'
ORDER BY C.Fecha DESC
```

Reglas derivadas, todas relevantes para replicar:

| Regla | Detalle |
|---|---|
| Fuente | Tabla **`Cierre`** (cierre de inventario), **no** `Conta_Cierre_Caja` |
| Filtro por sucursal | Obligatorio: `IdLocal = @idLocal`. Un usuario sólo ve cierres de su sucursal |
| Formato de búsqueda | `CONVERT(..., 103)` = **`dd/mm/yyyy`**. El texto se compara con `LIKE '%q%'`, así que `"09/2025"`, `"30/09"`, `"2025"` funcionan |
| Query vacía | `LIKE '%%'` ⇒ devuelve todos los cierres de la sucursal |
| Orden | `Fecha DESC` (más reciente primero) ⇒ la primera opción de la lista abierta es el último cierre |
| Sin `TOP` | Devuelve **todos** los cierres que matchean; el recorte es visual (`max-h-72` con scroll) |
| `CierreOption` | `{ idCierre: number, fechaInicial: Date, fecha: Date }` — `fecha` es el `Cierre.Fecha` (fin del período) y `fechaInicial` el `Cierre.FechaInicial` |

> **Consecuencia de diseño:** el selector muestra el cierre de **inventario** y la URL propaga su `IdCierre`, que es exactamente el `IdCierreProducto` que necesita `Conta_Cierre_Caja`. Si el cierre de inventario no tiene cabecera contable (`Conta_Cierre_Caja`), el reporte se renderiza vacío (cabecera no encontrada) y **no** muestra la sección de maíz.

### 4.4 De dónde sale `idLocal`

```ts
const idLocal = useUserStore((s) => s.IDLocal)   // Zustand, hidratado desde la sesión
```

- La sesión (`auth()`) se inicializa en `app/(main)/layout.tsx` → `UserStoreInitializer` → `useUserStore.setUser({ IDUsuario, UsuarioRolId, IDLocal, NombreUsuario, Local })`.
- `IDLocal` es la sucursal del usuario logueado. **No hay combo de sucursal**: no se puede consultar el cierre de otra sucursal desde esta pantalla.
- En el sistema destino, el `idLocal` debe venir del contexto autenticado del servidor (no de un parámetro que el cliente pueda cambiar).

### 4.5 Confirmación y navegación

```ts
const handleConfirm = (cierre: CierreOption) => {
  startTransition(() => { router.push(`?idCierre=${cierre.idCierre}`) })
}
```

| Regla | Detalle |
|---|---|
| Mecanismo | Navegación de Next (`router.push`) con **sólo** el query `?idCierre=` (ruta relativa: conserva el pathname) |
| Sin estado global | El cierre seleccionado vive en la URL: recargar la página reproduce el mismo reporte |
| Sin `scroll: false` | La navegación hace scroll al tope |
| Lectura en el servidor | `searchParams: Promise<{ idCierre?: string }>` → `Number(idCierre)`; si el valor no es numérico, `Number` da `NaN`, que es *falsy* ⇒ se comporta como "sin selección" |

Degenerados (verificado en código, no en ejecución):

| Entrada | Resultado |
|---|---|
| Sin `idCierre` | Mensaje "Seleccioná un cierre para ver el reporte." |
| `idCierre=abc` | Igual que sin selección (`NaN` es falsy) |
| `idCierre=0` | Igual que sin selección |
| `idCierre` inexistente | `getCierrePdfData` devuelve `{ cabecera: null, detalle: [], totales: null }` ⇒ se renderiza el bloque Circulante con "No se encontró la cabecera del cierre." y **ninguna** sección extra (sin fechas no hay maíz) |

### 4.6 Criterios de aceptación (selector)

1. Abrir el diálogo sin escribir muestra los cierres de la sucursal del usuario, ordenados por fecha descendente.
2. Escribir `30/09` filtra por fecha en formato `dd/mm/yyyy`; con 350 ms de debounce.
3. Escribir rápido y borrar no produce parpadeos de resultados viejos (last-wins).
4. El botón **Aceptar** permanece deshabilitado hasta seleccionar una fila.
5. Confirmar navega a `?idCierre=<id>` y el reporte se re-renderiza desde el servidor.
6. Con cierre cargado, el botón dice `Cambiar cierre #<id>`; durante la navegación dice `Cargando…` y no se puede volver a pulsar.
7. Cerrar el diálogo (Cancelar / Escape / click afuera) cancela búsquedas pendientes y no cambia la URL.
8. Recargar la página con `?idCierre=<id>` reproduce el mismo reporte.

### 4.7 Contrato equivalente para el sistema destino

#### 4.7.1 Endpoint de búsqueda

```http
GET /api/cierres?q=30/09&page=1&pageSize=50
→ 200 [
    { "idCierre": 1234, "fechaInicial": "2025-09-01T08:00:00", "fecha": "2025-09-30T18:30:00" }
  ]
```

Reglas obligatorias:

- La sucursal (`idLocal`) se toma del **contexto autenticado**, nunca de un query param del cliente.
- `q` se compara contra la fecha formateada `dd/MM/yyyy` (equivalente a `CONVERT(...,103) LIKE '%q%'`).
- Orden `fecha DESC`.
- Devolver `idCierre` **siempre**, aunque la UI no lo muestre: es lo que se propaga.

#### 4.7.2 Selección

- Persistir el cierre seleccionado en la URL (`?idCierre=`) o en un estado de la ruta; el requisito es que **recargar reproduzca el reporte**.
- Validar que el `idCierre` recibido pertenece a la sucursal del usuario (hoy **no** se valida; ver §5.8).

#### 4.7.3 Resolución de la cabecera

```sql
SELECT U.NombreUsuario, CCC.fechaInicial, CCC.fechaFinal, CCC.saldoAnterior, CCC.saldoNuevo, L.Local
FROM Conta_Cierre_Caja CCC
INNER JOIN Usuario U ON CCC.IdUser = U.IDUsuario
LEFT  JOIN Local   L ON CCC.IdLocal = L.IDLocal
WHERE CCC.IdCierreProducto = @idCierre
```

- `idCierre` = `Cierre.IdCierre` (el que devolvió el buscador).
- `fechaFinal` es **nullable**: si es `NULL`, no se puede calcular el inventario de maíz.

#### 4.7.4 Autorización (nuevo requisito)

El sistema actual **no** restringe esta ruta por rol. Para un sistema *sólo de administradores*:

- Exigir rol administrador en el endpoint del reporte **y** en el de búsqueda (no sólo en el menú).
- Filtrar cierres por sucursal del usuario salvo que el administrador tenga alcance global explícito.
- No confiar en `idLocal` enviado por el cliente.

---

## 5. Pieza B — Sección Inventario de Maíz

### 5.1 Qué muestra

Una tarjeta con:

- Título **"Inventario de Maíz"** (se pinta en mayúsculas por CSS).
- Tabla de **una fila por producto `MAIZ` de cada sucursal** en el cierre seleccionado, más una fila de **TOTAL**.
- Mensaje de vacío cuando no hay filas.

Columnas (en este orden):

| # | Encabezado | Contenido | Origen | Alineación |
|---|---|---|---|---|
| 1 | `Producto` | `'MAIZ' + ' ' + Local.Local` | `B.Producto` | izquierda |
| 2 | `Stock` | quintales | `Cierre_Producto.Cantidad` | derecha, monoespaciada |
| 3 | `Precio` | precio unitario | `Cierre_Producto.Precio` | derecha, monoespaciada |
| 4 | `Inversión` | stock × precio | `Cierre_Producto.Inversion` | derecha, monoespaciada |
| 5 | `Util. QQ` | utilidad por quintal | `Cierre_Producto.UtilidadQQ` | derecha, monoespaciada |
| 6 | `Util. Total` | utilidad total | `Cierre_Producto.UtilidadTotal` | derecha, monoespaciada |

Filas (`<tr>`) separadas por borde inferior suave; fila de totales con `font-semibold` y fondo `muted/10`.

### 5.2 Cuándo se pide

```ts
ff && id ? getInventarioMaizData(ff, id) : Promise.resolve(null)
```

- `ff` = `Conta_Cierre_Caja.fechaFinal` de la cabecera (no de la URL).
- `id` = `idCierre` de la URL = `Conta_Cierre_Caja.IdCierreProducto` = `Cierre.IdCierre`.
- Si cualquiera falta ⇒ la consulta **no se ejecuta** y la sección **no se renderiza**.
- La consulta corre en paralelo con las otras tres secciones (`Promise.all`).

### 5.3 La consulta (SQL exacto)

```sql
WITH A AS (
  SELECT C.IdLocal, MAX(C.Fecha) Fecha
  FROM Cierre C
  WHERE C.IdLocal != 1 AND
        C.Fecha <= @fechaFinal
  GROUP BY C.IdLocal
  UNION ALL
  SELECT C.IdLocal, C.Fecha
  FROM Cierre C
  WHERE C.IdCierre = @idCierre
), B AS (
  SELECT CP.IdCierre, P.Descripcion + ' ' + L.Local Producto,
         CP.Cantidad stock, CP.Precio precio, CP.Inversion inversion,
         CP.UtilidadQQ, CP.UtilidadTotal, C.Fecha
  FROM Cierre_Producto CP
  INNER JOIN Producto P ON CP.IDProducto = P.IDProducto
  INNER JOIN Cierre C ON CP.IdCierre = C.IdCierre
  INNER JOIN Local L ON P.IDLocal = L.IDLocal
  WHERE P.Descripcion = 'MAIZ'
)
SELECT B.IdCierre, B.Producto, B.stock, B.precio, B.inversion,
       B.UtilidadQQ, B.UtilidadTotal, B.Fecha
FROM A INNER JOIN B ON A.Fecha = B.Fecha
ORDER BY B.Producto ASC
```

Parámetros:

| Parámetro | Tipo | Origen |
|---|---|---|
| `@fechaFinal` | `DateTime` (vinculado directo, sin truncar) | `Conta_Cierre_Caja.fechaFinal` del cierre seleccionado |
| `@idCierre` | `Int` | `idCierre` de la URL (`= Cierre.IdCierre`) |

Lectura paso a paso:

1. **CTE `A` = "cierres vigentes"**. Para cada sucursal **excepto la 1**, toma la **fecha del último cierre** que sea `<= @fechaFinal`. Luego agrega **incondicionalmente** el cierre seleccionado (`UNION ALL`, sin filtro de local ni de fecha). Resultado: una lista de **fechas** (no de pares local+fecha).
2. **CTE `B` = "filas MAIZ con su fecha de cierre"**. Todas las filas de `Cierre_Producto` cuyo producto se llame **exactamente `MAIZ`**, con el nombre compuesto `MAIZ <Local del producto>` y la `Fecha` de su cierre.
3. **Join `A.Fecha = B.Fecha`**: el filtro temporal se aplica **por fecha**, no por sucursal. Entran las filas MAIZ cuya fecha de cierre coincida con alguna de las fechas vigentes.
4. **Orden**: `B.Producto ASC` (alfabético sobre `"MAIZ <Local>"`, colación de SQL Server).

#### Efectos de diseño que hay que conocer

| Comportamiento | Consecuencia |
|---|---|
| `C.IdLocal != 1` | La sucursal **1 (Ventanas / casa central)** nunca entra por la rama del "último cierre"; sólo puede aparecer porque el cierre seleccionado es suyo (rama `UNION ALL`). |
| `UNION ALL` del cierre seleccionado | Permite mostrar el maíz de un cierre **histórico**: no se limita al último cierre de cada sucursal. |
| `UNION ALL` sin `DISTINCT` | Si el cierre seleccionado **es** el último cierre de su sucursal, su fecha queda **duplicada** en `A` ⇒ el join por fecha devuelve **la fila duplicada** (una vez por cada ocurrencia de la fecha). Ver §5.8 (B-1). |
| Join por `Fecha` y no por `IdLocal` | Si dos sucursales cerraron el mismo día, ambas filas entran aunque sólo una sea "vigente". Es el comportamiento actual; puede ser deseado (comparar sucursales) o un falso positivo. |
| Comparación exacta de `DateTime` | `C.Fecha <= @fechaFinal` y `A.Fecha = B.Fecha` comparan **fecha y hora con precisión completa**. En el legacy `Cierre.Fecha` no se normaliza a medianoche: los cierres de corrección se crean con `último cierre + 1 segundo` (ver `app/(main)/cierre/ediciones/nuevo-inventario/Documentacion-Nuevo-Inventario-Cierre.md` §6.1). Cualquier normalización a fecha pura en el sistema destino **cambia el resultado**. |
| Sin `IdLocal` en `A` para el cierre seleccionado | Si el cierre seleccionado es de la sucursal 1, se agrega igual (la condición `!= 1` sólo aplica a la rama `GROUP BY`). |
| Nombre del producto | Sólo `Descripcion = 'MAIZ'` exacto. `MAIZ CLASE B`, `MAIZ B`, `MAIZ C`, `MAIZ QUEMADO` **no** entran. |

### 5.4 Mapeo y parseo numérico

`InventoryMaizRow` (DTO que usa el componente):

```ts
interface InventarioMaizRow {
  idCierre: number      // B.IdCierre
  producto: string      // "MAIZ <Local>"
  stock: number         // Cantidad
  precio: number        // Precio
  inversion: number     // Inversion
  utilidadQQ: number    // UtilidadQQ
  utilidadTotal: number // UtilidadTotal
  // B.Fecha se trae en el SELECT pero NO se mapea ni se muestra
}
```

Conversión texto → número (obligatoria porque las columnas son `NVarchar`):

```ts
function num(v: string | null): number {
  if (!v) return 0
  const n = Number(v.replace(/\s/g, "").replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}
```

Reglas y límites:

| Entrada en DB | Resultado | Nota |
|---|---|---|
| `null`, `""` | `0` | — |
| `"1,234.56"` | `1234.56` | Quita separador de miles con coma |
| `"1 234.56"` | `1234.56` | Quita espacios |
| `"1234.56"` | `1234.56` | — |
| `"1.234,56"` (coma decimal) | `0` | `Number("1.234.56")` ⇒ `NaN` ⇒ **0 silencioso** |
| `"abc"` | `0` | mismo camino |

> **Riesgo de reimplementación:** el parser asume formato inglés (coma de miles, punto decimal) y **no falla**: convierte basura en `0`. Si en el sistema destino se usa `decimal` real, este parseo desaparece y la mejora es automática. Si se mantiene el texto, conviene loguear los valores no parseables en lugar de devolver `0`.

### 5.5 Presentación

#### 5.5.1 Cálculos del pie (`tfoot`)

```ts
stockTotal     = Σ stock
inversionTotal = Σ inversion
precioTotal    = stockTotal !== 0 ? inversionTotal / stockTotal : 0   // promedio ponderado
```

| Celda | Valor |
|---|---|
| `TOTAL` | etiqueta |
| Stock | `stockTotal` |
| Precio | `precioTotal` (**precio promedio ponderado**, no la suma de precios) |
| Inversión | `inversionTotal` |
| Util. QQ | **vacía** (no hay total) |
| Util. Total | **vacía** (no hay total) |

Notas:
- Si `stockTotal == 0`, el precio total es `0` (protección contra división por cero).
- No se calcula total de utilidades a propósito: la utilidad total ya es un acumulado y sumarla entre sucursales no es válido.
- Los totales se calculan **en el componente**, no en SQL.

#### 5.5.2 Formatos numéricos y de fecha

```ts
fmt(n, decimals = 2) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
fechaHora(d)         => new Date(d).toLocaleString("es-EC", { timeZone: "UTC", hourCycle: "h23",
                            day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
```

| Dato | Formato | Ejemplo |
|---|---|---|
| Cualquier número de la tabla de maíz | `#,##0.00` (en-US) | `1234.5` → `1,234.50` |
| Fechas del diálogo de selección | `dd/mm/yyyy hh:mm` (24 h, **UTC**) | `2025-09-30T18:30:00Z` → `30/09/2025 18:30` |

> El uso de `timeZone: "UTC"` en `fechaHora` está **fuera** de la sección de maíz (es del selector), pero es parte de la pieza A y hay que replicarlo si el sistema destino guarda `DateTime` sin zona: formatear en UTC evita corrimientos de un día.

### 5.6 Estado vacío

Si la consulta devuelve `[]` (por ejemplo, el cierre seleccionado no tiene productos `MAIZ`):

```text
Sin inventario de maíz en el cierre.
```

Texto centrado, tamaño `sm`, color atenuado, dentro de la tarjeta pero **sin tabla ni fila de totales**.

### 5.7 Impresión / PDF

| Regla | Detalle |
|---|---|
| Botón | **"Imprimir / PDF"** con icono de impresora; ejecuta `window.print()`. Sólo se renderiza si hay datos del cierre. |
| Salto de página | El contenedor de la sección lleva `print:break-before-page`: empieza en **hoja nueva** al imprimir. |
| Chrome de la app | El encabezado de la página (`h1` + botones) es `print:hidden`; el header y el sidebar del layout también se ocultan en impresión (`app/globals.css`). |
| Tema | En impresión se fuerzan los tokens de tema **claro**, incluso en modo oscuro. |
| Tipografía | `html { font-size: 11px }` en `@media print` (la base en pantalla es 22px). |
| Página | `@page { size: A4 portrait; margin: 10mm }`. |
| Filas | `tr { break-inside: avoid }`: una fila no se parte entre páginas. |
| Flex → block | `[data-slot="sidebar-wrapper"]` y `[data-slot="sidebar-inset"]` pasan a `display:block` en impresión, porque Chrome **ignora** `break-before` dentro de un ancestro flex. En el sistema destino, si el layout usa flex, hay que replicar este paso o los saltos de página no funcionarán. |
| El PDF | No se genera en el servidor: es el diálogo del navegador → "Guardar como PDF". |

### 5.8 Casos borde y riesgos conocidos

| ID | Caso | Comportamiento actual | Qué hacer al reimplementar |
|---|---|---|---|
| **B-1** | El cierre seleccionado **es** el último cierre de su sucursal | La fecha aparece **dos veces** en el CTE `A` ⇒ la fila de esa sucursal puede salir **duplicada** y los totales contar doble | Usar `UNION` en vez de `UNION ALL`, o `DISTINCT` sobre `A`, o deduplicar por `(IdLocal, Fecha)` |
| **B-2** | Dos sucursales cerraron el mismo `Fecha` y sólo una es "vigente" | Entran las filas de **ambas** (el join es por fecha) | Decidir: join por `IdLocal` + `Fecha` si se quiere "una por sucursal" |
| **B-3** | Sucursal 1 (Ventanas) | Nunca entra por `GROUP BY`; sólo si el cierre seleccionado es suyo | Confirmar con negocio si debe participar siempre |
| **B-4** | Sucursal sin cierre previo y sin ser la seleccionada | Simplemente no aparece (a diferencia de `/reportes/cierre/inventario-maiz`, que **bloquea** el reporte entero) | Mantener el criterio: esta sección **degrada**, no bloquea |
| **B-5** | `Conta_Cierre_Caja.fechaFinal` con hora ≠ hora de `Cierre.Fecha` | La rama del último cierre puede no encontrar el cierre del mismo día (`<=` y `=` exactos) | Documentar la precisión; no truncar sin decisión explícita |
| **B-6** | Valores de `Cierre_Producto` con coma decimal | Se parsean como `0` (§5.4) | Validar/parsear explícitamente y registrar anomalías |
| **B-7** | `Local.Local` nulo | `Producto` queda `NULL` en SQL; `producto` se renderiza vacío | Usar `COALESCE(L.Local, 'S/N')` si se quiere trazabilidad |
| **B-8** | Producto `MAIZ` con dos filas en el mismo cierre (dato inconsistente) | Se muestran las dos; la `key` de React es `idCierre` ⇒ **clave duplicada** | Clave compuesta `idCierre + producto` (o el `IdCierreProducto`) |
| **B-9** | Filtro `Descripcion = 'MAIZ'` | Case-insensitive por colación de SQL Server; con colación distinta, `'maiz'` no entraría | Comparar con `UPPER()`/`TRIM()` si el sistema destino cambia de colación |
| **B-10** | `idCierre` de otra sucursal | La consulta **no** valida pertenencia: el `UNION ALL` agrega ese cierre igual | Validar `Cierre.IdLocal` contra la sucursal/autorización del usuario |

### 5.9 Contrato equivalente para el sistema destino

#### 5.9.1 Endpoint sugerido

```http
GET /api/reportes/cierre-pdf/inventario-maiz?idCierre=1234
→ 200
{
  "idCierre": 1234,
  "fechaFinal": "2025-09-30T18:30:00",
  "rows": [
    {
      "idCierre": 1234,
      "producto": "MAIZ Ventanas",
      "stock": 1250.50,
      "precio": 18.30,
      "inversion": 22884.15,
      "utilidadQQ": 0.45,
      "utilidadTotal": 562.72
    }
  ],
  "totales": {
    "stock": 1250.50,
    "precio": 18.30,
    "inversion": 22884.15
  }
}
```

Reglas del contrato:

1. `fechaFinal` se resuelve **en el servidor** desde `Conta_Cierre_Caja` (o del cierre seleccionado); no se acepta como parámetro.
2. `totales` se calculan en el servidor o en el cliente, pero con la misma fórmula: stock = Σ, inversión = Σ, precio = inversión / stock (0 si stock = 0). **No** hay totales de utilidad.
3. Los números viajan como `number` (no formateados). El formato `#,##0.00` es responsabilidad de la vista.
4. `producto` ya viene compuesto (`"MAIZ <Local>"`), listo para mostrar.
5. Si no hay filas: `rows: []` y la vista muestra el mensaje de vacío. Si no hay cierre/cabecera: `404` (o `rows` ausente), y la sección **no** se renderiza.

#### 5.9.2 Reglas de negocio resumidas (checklist)

- [ ] Sólo productos con `Descripcion = 'MAIZ'` exacto.
- [ ] Valores **guardados** en `Cierre_Producto` (no recalcular).
- [ ] El conjunto de fechas = `{último cierre por sucursal con Fecha <= fechaFinal, excluyendo sucursal 1} ∪ {Fecha del cierre seleccionado}`.
- [ ] Filtro por fecha, comparando `DateTime` completo.
- [ ] Orden alfabético por nombre de producto.
- [ ] Una fila por `Cierre_Producto` (ojo duplicados, B-1/B-8).
- [ ] Pie: stock total, precio promedio ponderado, inversión total; utilidades sin total.
- [ ] Números con 2 decimales, formato `en-US`; fechas `dd/mm/yyyy hh:mm` UTC en el selector.
- [ ] Salto de página antes de la sección al imprimir; A4 vertical, márgenes 10 mm.

#### 5.9.3 Casos de prueba (con datos de ejemplo)

Supuesto: cierres de `MAIZ` — Sucursal 2 (Ventanas no aplica) con último cierre 30/09, Sucursal 3 con último cierre 28/09, cierre seleccionado = el del 30/09 de la sucursal 2, `fechaFinal` = 30/09 18:30.

| # | Escenario | Esperado |
|---|---|---|
| 1 | Caso base | 2 filas (`MAIZ Sucursal 2`, `MAIZ Sucursal 3`); fila de TOTAL con Σ stock, Σ inversión y precio ponderado |
| 2 | Cierre seleccionado histórico (15/08) | Entran las filas del cierre del 15/08 **y** las del último cierre de cada sucursal (≤ fechaFinal) |
| 3 | Cierre sin productos MAIZ | Mensaje "Sin inventario de maíz en el cierre." |
| 4 | `fechaFinal` nula | La sección no se renderiza |
| 5 | Sin `idCierre` en la URL | No hay reporte ni sección |
| 6 | `stockTotal` = 0 | Precio total `0.00` (sin excepción de división) |
| 7 | Valor `"1.234,56"` en `Cantidad` | Stock `0.00` (parser actual) |
| 8 | Sucursal 1 en el cierre seleccionado | Aparece sólo por la rama del cierre seleccionado |
| 9 | Impresión | La sección empieza en hoja nueva, sin sidebar ni header, A4 vertical |

---

## 6. Anexos

### 6.1 SQL copiable

**A.1 — Buscar cierres por sucursal y fecha (`dd/mm/yyyy`)**

```sql
SELECT C.IdCierre, C.FechaInicial, C.Fecha
FROM Cierre C
WHERE C.IdLocal = @idLocal
  AND CONVERT(NVARCHAR, C.Fecha, 103) LIKE '%' + @query + '%'
ORDER BY C.Fecha DESC
```

**A.2 — Cabecera del cierre contable (de la que salen `fechaFinal` e `idCierre`)**

```sql
SELECT U.NombreUsuario       AS USUARIO,
       CCC.fechaInicial,
       CCC.fechaFinal,
       CCC.saldoAnterior,
       CCC.saldoNuevo,
       L.Local                AS sucursal
FROM Conta_Cierre_Caja CCC
INNER JOIN Usuario U ON CCC.IdUser  = U.IDUsuario
LEFT  JOIN Local   L ON CCC.IdLocal = L.IDLocal
WHERE CCC.IdCierreProducto = @idCierre
```

**A.3 — Inventario de Maíz (la consulta de la sección)**

```sql
WITH A AS (
  SELECT C.IdLocal, MAX(C.Fecha) Fecha
  FROM Cierre C
  WHERE C.IdLocal != 1 AND
        C.Fecha <= @fechaFinal
  GROUP BY C.IdLocal
  UNION ALL
  SELECT C.IdLocal, C.Fecha
  FROM Cierre C
  WHERE C.IdCierre = @idCierre
), B AS (
  SELECT CP.IdCierre, P.Descripcion + ' ' + L.Local Producto,
         CP.Cantidad stock, CP.Precio precio, CP.Inversion inversion,
         CP.UtilidadQQ, CP.UtilidadTotal, C.Fecha
  FROM Cierre_Producto CP
  INNER JOIN Producto P ON CP.IDProducto = P.IDProducto
  INNER JOIN Cierre C ON CP.IdCierre = C.IdCierre
  INNER JOIN Local L ON P.IDLocal = L.IDLocal
  WHERE P.Descripcion = 'MAIZ'
)
SELECT B.IdCierre, B.Producto, B.stock, B.precio, B.inversion,
       B.UtilidadQQ, B.UtilidadTotal, B.Fecha
FROM A INNER JOIN B ON A.Fecha = B.Fecha
ORDER BY B.Producto ASC
```

### 6.2 Verificaciones manuales útiles

```sql
-- ¿Cuántos MAIZ hay en el cierre seleccionado?
SELECT COUNT(*) FROM Cierre_Producto CP
INNER JOIN Producto P ON CP.IDProducto = P.IDProducto
WHERE CP.IdCierre = @idCierre AND P.Descripcion = 'MAIZ';

-- ¿Hay fechas duplicadas en el CTE A? (riesgo B-1)
SELECT Fecha, COUNT(*) FROM (
  SELECT MAX(Fecha) Fecha FROM Cierre WHERE IdLocal != 1 AND Fecha <= @fechaFinal GROUP BY IdLocal
  UNION ALL
  SELECT Fecha FROM Cierre WHERE IdCierre = @idCierre
) t GROUP BY Fecha HAVING COUNT(*) > 1;

-- ¿El cierre seleccionado tiene cabecera contable? (si no, no habrá fechaFinal)
SELECT * FROM Conta_Cierre_Caja WHERE IdCierreProducto = @idCierre;

-- ¿De qué sucursal es el cierre seleccionado? (validación B-10)
SELECT IdCierre, IdLocal, Fecha FROM Cierre WHERE IdCierre = @idCierre;
```

### 6.3 Archivos y responsabilidades

| Archivo | Rol |
|---|---|
| `app/(main)/reportes/contabilidad/cierre-pdf/page.tsx` | Server Component: lee `searchParams`, pide la cabecera, hace el *gating* de las secciones y arma el layout |
| `_components/cierre-selector.tsx` | Botón + diálogo; navega a `?idCierre=` |
| `components/shared/busqueda-cierre-dialog.tsx` | Diálogo compartido de búsqueda de cierre (debounce, last-wins, selección) |
| `app/(main)/_actions/cierres.ts` | `buscarCierres` + tipo `CierreOption` |
| `_actions/index.ts` | `getCierrePdfData` (cabecera/detalle/totales del circulante) — fuente de `fechaInicial`/`fechaFinal` |
| `_actions/inventario-maiz.ts` | `getInventarioMaizData` + `InventarioMaizRow` + parser `num()` |
| `_components/inventario-maiz-section.tsx` | Tabla, totales del pie y mensaje de vacío |
| `_components/imprimir-button.tsx` | `window.print()` |
| `app/globals.css` (`@media print`) | Tema claro, tipografía 11px, ocultar chrome, `break-before`, A4 10 mm |
| `store/user-store.ts` | `IDLocal` del usuario (fuente de la sucursal en la búsqueda) |
| `app/(main)/layout.tsx` | Exige sesión (único control de acceso actual) |

### 6.4 Glosario

| Término | Significado |
|---|---|
| **Cierre de producto** | Fila de `Cierre` + sus `Cierre_Producto`. Es el "cierre de inventario". |
| **Cierre contable / de caja** | Fila de `Conta_Cierre_Caja`, que apunta al cierre de producto por `IdCierreProducto`. |
| **Cierre seleccionado** | El `idCierre` de la URL = `Cierre.IdCierre` = `Conta_Cierre_Caja.IdCierreProducto`. |
| **Sucursal 1** | Sucursal "Ventanas" / casa central, excluida del cálculo de "último cierre por sucursal". |
| **`fechaFinal`** | Fin del período del cierre contable; límite superior (`<=`) para elegir el último cierre de cada sucursal. |
| **Stock (QQ)** | Quintales de maíz guardados en el cierre (no recalculados). |
| **Precio promedio ponderado** | `inversión total / stock total`; es el "precio" del pie de tabla. |
