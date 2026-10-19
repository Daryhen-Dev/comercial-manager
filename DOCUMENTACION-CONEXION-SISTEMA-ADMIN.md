# Documentación de Conexión y Estructura — Sistema de Administradores

> **Propósito**: guía del sistema de administradores (`comercial-manager`) sobre
> cómo se conecta a la misma base de datos local y de producción que
> **comercial-web**, y cómo quedó estructurado.
>
> **Origen**: los puntos marcados como "heredado de comercial-web" fueron
> extraídos del código real de ese sistema. Todo lo demás describe lo que está
> **implementado y verificado en este repo** al 2026-10-18. Donde este sistema se
> aparta de comercial-web, se dice explícitamente — ver §8.

---

## 1. Regla de oro: misma base de datos, esquema compartido

Ambos sistemas apuntan a la **misma base SQL Server**: `BDComercial`.

- El esquema es **legacy y se trata como read-only**: NO hay migraciones de
  Prisma ni de ningún ORM. El esquema lo define/dueña el sistema WinForms.
- Prisma se usa **solo para consultas** (`$queryRaw`, `findMany`, etc.), nunca
  `prisma migrate`. Si un cambio de esquema es inevitable, se hace con SQL
  versionado en `scripts/sql/` (convención: `YYYYMMDD-descripcion.sql`) y luego
  `pnpm db:pull && pnpm db:generate` para refrescar el client.
- Consecuencia: **dos aplicaciones escribiendo a la vez** sobre el mismo esquema.
  Toda escritura nueva debe respetar las convenciones de columnas del legacy
  (ids como string en tablas NVarChar, fechas con GETDATE(), etc.) y validarse
  server-side.
- El esquema introspeccionado tiene **311 modelos**. Seis tablas quedaron sin
  modelo porque no tienen identificador único usable, y solo se pueden tocar con
  SQL crudo: `CierreInventarioExcedente`, `Conta_Asiento_Detalle_Tipo`,
  `Conta_Cuenta_Banco_Enlace`, `Conta_Gasto_Factura_Pasivo`, `FechaMeses`,
  `Venta_TipoPago_Conector`.

---

## 2. Cadena de conexión (Prisma 7 + SQL Server)

Este sistema usa **Prisma 7**, que a diferencia de comercial-web ya no trae el
query engine de Rust: SQL Server se alcanza mediante un **driver adapter**.

| Pieza | Versión / paquete |
|---|---|
| CLI | `prisma@7.10.1` (dev) |
| Client | `@prisma/client@7.10.1` |
| Adapter SQL Server | `@prisma/adapter-mssql@7.10.1` (arrastra `mssql@12`) |

> ⚠️ **Nunca instalar `prisma@latest`.** Al día de hoy `prisma@latest` resuelve a
> `8.0.0-rc.23` (un release candidate) mientras `@prisma/client@latest` es
> `7.10.1`. Eso deja un CLI de una major por delante del client. Las tres
> dependencias están pinneadas exactas, sin caret.

### 2.1 Variables de entorno (`.env` y `.env.local` en la raíz)

| Variable | Uso real | Nota |
|---|---|---|
| `DATABASE_URL` | **La consume `prisma.config.ts`** para el CLI y `lib/db.ts` para el adapter | Formato SQL Server, ver §2.2 |
| `AUTH_SECRET` | Firma de sesiones JWT de next-auth | Debe existir o next-auth falla cerrado. Por máquina, nunca en el repo |
| `DB_SERVER`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` | **Definidas en comercial-web pero SIN uso** | No replicarlas acá: son variables muertas |

⚠️ Las credenciales reales viven solo en los `.env` de cada máquina. **Nunca
commitear `.env`.**

> **Trampa verificada:** `prisma.config.ts` importa `dotenv/config`, que lee
> **solo `.env`, no `.env.local`**; Next en cambio lee ambos y con prioridad de
> `.env.local`. Por eso `DATABASE_URL` va en `.env`. Si se pone únicamente en
> `.env.local`, la app funciona y el CLI de Prisma no ve nada.
>
> Segundo detalle: el archivo creado vacío (0 bytes) no da error, simplemente
> `DATABASE_URL` queda `undefined`. Verificar después de crearlo.

### 2.2 Formato de `DATABASE_URL` (local)

```
sqlserver://HOST;port=1433;database=BDComercial;user=USUARIO;password=***;encrypt=false;trustServerCertificate=true
```

Puntos clave (formato heredado de comercial-web, **verificado contra el adapter**):

- Host y puerto van **dentro del string**, separados por `;` (no query params,
  no `&`).
- `encrypt=false` y `trustServerCertificate=true` son necesarios contra el SQL
  Server local/red sin certificado TLS válido.
- **Usar comillas dobles** en el `.env`: `dotenv` corta el valor en el primer `#`,
  y un password con `#` truncaría la URL en silencio.
- **El adapter acepta este formato tal cual.** `@prisma/adapter-mssql` hace
  internamente `replace(/^sqlserver:\/\//, "")`, así que no hay que convertirlo a
  formato ADO (`Server=...;Database=...`).
- **Local**: host = la PC donde corre el SQL Server. **Producción**: mismo
  formato, cambia el host y las credenciales. El `DATABASE_URL` de producción
  vive en el `.env` del servidor, nunca en el repo.

### 2.3 `prisma.config.ts`

Prisma 7 sacó la URL del `schema.prisma`. Ahora vive acá:

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
```

Se usa `process.env` y **no** el helper `env()` de Prisma a propósito: `env()`
lanza `PrismaConfigEnvError` mientras carga el archivo, lo que impediría
`prisma generate` — y por lo tanto `next build` — en cualquier máquina sin
`.env`. Los comandos que sí se conectan (`db:pull`, `db:studio`) fallan igual,
pero al conectar y con un mensaje que apunta a la variable.

### 2.4 Singleton (`lib/db.ts`)

```ts
import "server-only";

import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. ...");
  }
  return new PrismaClient({ adapter: new PrismaMssql(connectionString) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

Patrón obligatorio en desarrollo para que el hot-reload no agote el pool. El
nombre exportado es **`db`** por convención de todo el código:
`import { db } from "@/lib/db"`.

Diferencias con el singleton de comercial-web: el client se importa del
**output generado** (`@/generated/prisma/client`), no de `@prisma/client`, y se
construye con adapter.

### 2.5 Generación del client

- `prisma/schema.prisma` **se commitea**: así el drift contra la base se ve en
  los diffs y CI puede generar el client sin acceso a la base.
- `generated/` **no se commitea** (17 MB). Se regenera con `pnpm db:generate`.
- Después de clonar, y **antes de buildear**: `pnpm install && pnpm db:generate`.

---

## 3. Ejecución local y producción

| Entorno | Comando | Detalle |
|---|---|---|
| Dev | `pnpm dev` | Next dev server, puerto 3000 |
| Producción | `pnpm build` && `pnpm start` | Puerto a definir |

> **Pendiente, no implementado todavía:** comercial-web usa un `server.js`
> custom que inyecta el header `x-client-ip` (normalizando `::ffff:` de IPv4
> mapped) y corre con PM2 mediante `ecosystem.config.js`. Si este sistema
> necesita registrar IPs, hay que replicarlo. Hoy **no existe** ninguno de los
> dos archivos.

⚠️ Antes de `build`/`start` en cualquier máquina: `pnpm install` y
`pnpm db:generate`.

---

## 4. Autenticación

next-auth **v5**, en su canal beta (`5.0.0-beta.32`). Igual que comercial-web en
la versión, distinto en la forma.

> ⚠️ `next-auth@latest` es la **v4**. La v5 solo se publica bajo el tag `beta`:
> instalar con `next-auth@beta`.

### 4.1 Estrategia

- **Provider Credentials**, sin adapter de base de datos: `session.strategy` es
  JWT, la sesión vive en una cookie firmada con `AUTH_SECRET`.
- **La sucursal es implícita.** El sistema sirve un único local, así que el login
  pide solo usuario y contraseña. `auth.ts` fija `ID_LOCAL_IMPLICITO = 1`.
  Cambiar de sucursal es un cambio de código, no de configuración.
- Match contra la tabla `Usuario`: `NombreUsuario` + `IDLocal` (el `IDLocal` fijo
  es necesario igual, porque un mismo nombre de usuario existe en varias
  sucursales).
- La clave se compara en **texto plano**: `Clave` es una columna legacy
  `NVarChar(Max)` del sistema WinForms. Hashearla dejaría afuera a todos los
  usuarios existentes. Está comentado en el código para que nadie lo "arregle".
- Se rechaza `Estado !== true`. El chequeo es `!== true` y no `=== false` porque
  la columna admite `null`.

### 4.2 Rol de administrador

El gate compara **`UsuarioRolId === 1`**, el identificador que usa el legacy.
`RolUsuario` es solo el nombre para mostrar (`'ADMINISTRADOR'`) y **no es
autoridad**.

Distribución real en la base:

| UsuarioRolId | RolUsuario | Usuarios |
|---|---|---|
| `1` | ADMINISTRADOR | 33 |
| `2` | CAJERO | 81 |
| `null` | ADMINISTRADOR | 2 |
| `null` | CAJERO | 16 |

Consecuencias, medidas y aceptadas a propósito:

- **Solo 7 cuentas pueden iniciar sesión**: los 7 usuarios que tienen a la vez
  `IDLocal = 1` y `UsuarioRolId = 1`. Administradores de otras sucursales
  (26 en total) quedan afuera.
- Los **2 administradores con `UsuarioRolId = null`** también quedan afuera. Se
  eligió el gate estricto por sobre un fallback a `RolUsuario`.
- Dato anómalo: existe 1 usuario con `IDLocal = 0`, que no existe en la tabla
  `Local` (arranca en 1).

### 4.3 Sesión enriquecida

Los callbacks `jwt()` y `session()` copian al token y exponen en `session.user`:
`IDUsuario`, `IDLocal`, `UsuarioRolId`, `RolUsuario`, `NombreUsuario`, `Local`.
Todo el código lee esos campos sin volver a consultar la base. **Los seis son
opcionales y nullables**, porque todas las columnas de origen lo son.

### 4.4 Protección de rutas

- **`proxy.ts`** (Next 16 renombró `middleware.ts`; el export debe llamarse
  `proxy`). Corre en **runtime Node.js** por defecto, y declarar `runtime` en el
  archivo **lanza error**. Protege todo excepto `_next/static`, `_next/image`,
  `favicon.ico` y `api/auth`.
- `auth.config.ts` se mantiene libre de Prisma y es lo único que importa el
  proxy: con estrategia JWT, verificar la cookie no necesita base de datos.
- El matcher **no es una frontera de autorización**. El rol se valida en
  `app/(main)/layout.tsx`, server-side, en cada request.
- Sin sesión → `/login?callbackUrl=...`. Con sesión pero sin rol admin →
  `/login?error=forbidden`.

### 4.5 `trustHost`

La config compartida declara `trustHost: true`. next-auth v5 rechaza hosts que
no puede verificar (`UntrustedHost`) salvo que corra en Vercel. Este sistema es
self-hosted detrás de PM2, así que el host se acepta por contrato de despliegue.

---

## 5. Estructura de proyecto

```
comercial-manager/
├── app/
│   ├── (auth)/login/                 # Login público (credentials)
│   │   ├── page.tsx                  # Server Component
│   │   └── _components/login-form.tsx
│   ├── (main)/                       # Área protegida (gate por UsuarioRolId)
│   │   ├── layout.tsx                # Autorización server-side
│   │   ├── page.tsx                  # Dashboard inicial
│   │   └── _actions/                 # Server Actions ("use server")
│   └── api/auth/[...nextauth]/       # Route handlers de next-auth
├── auth.ts                           # NextAuth con Credentials + Prisma
├── auth.config.ts                    # Config compartida, sin base de datos
├── proxy.ts                          # Protección de rutas (ex middleware)
├── types/next-auth.d.ts              # Augmentation de Session/User/JWT
├── components/ui/                    # shadcn/ui (generado, Base UI)
├── lib/
│   ├── db.ts                         # Singleton Prisma + adapter
│   └── ...
├── prisma/
│   └── schema.prisma                 # Introspeccionado con `pnpm db:pull`
├── generated/prisma/                 # Client generado (gitignored)
├── prisma.config.ts                  # URL de datasource para Prisma 7
├── next.config.ts                    # serverExternalPackages, turbopack, css
├── odd/                              # Registro de trabajo (ODD)
└── .env                              # DATABASE_URL + AUTH_SECRET (nunca en repo)
```

Convención por módulo dentro de `(main)`: `page.tsx` + `_actions/` +
`_components/` + `_lib/`.

---

## 6. Lecciones aprendidas

Heredadas de comercial-web (siguen vigentes):

1. **`"use server"` SOLO en los entrypoints de acciones.** Nunca en libs
   importadas: cada export de un archivo `"use server"` se vuelve un endpoint RPC
   público sin gate de sesión. Libs de servidor usan `import "server-only"`.
2. **Raw queries sobre SQL Server**: los tipos JS no están garantizados (pueden
   llegar `number`, `BigInt` o `Prisma.Decimal`). Declarar las columnas como
   `unknown` en el tipo crudo y normalizar con `Number()` al mapear.
3. **Aliases de SQL**: el mapeo TS debe leer los aliases exactos del SELECT. Un
   mismatch silencioso produce `0`s.
4. **`auth()` antes que nada** en toda acción; sin sesión, throw temprano.
5. **Tokens de acción sensible**: firmar HMAC con `AUTH_SECRET` ligado a
   usuario+sucursal+propósito, TTL corto, en memoria de React, y verificar en
   cada mutación.
6. **Decimal/money**: nunca flotantes para montos; el legacy usa
   `Math.round(x*100)/100` (half-away-from-zero).
7. **Validaciones server-side con los mensajes exactos del negocio**: el client
   pre-valida, el server re-valida todo.

Nuevas, descubiertas en este repo:

8. **`@prisma/adapter-mssql` no está en `serverExternalPackages` por defecto.**
   Next externaliza `@prisma/client` y `prisma`, pero no el adapter. Sin agregar
   `["@prisma/adapter-mssql", "mssql", "tedious"]` en `next.config.ts`, el build
   intenta bundlear la cadena `mssql → tedious → @azure/identity → open →
   powershell-utils` y falla resolviendo `powershell.exe` en Windows.
9. **`cacheComponents: true` marca toda ruta que lee sesión o `searchParams`**
   durante el prerender y rompe el build. Se resuelve con
   `export const instant = false` (API real de Next 16, documentada en
   `authentication-with-cache-components`). Es un opt-out consciente, no un
   parche.
10. **Zod 4 rompe el tipado de `useForm` cuando el schema coacciona.**
    `z.coerce.number()` tiene input `unknown` y output `number`, así que
    `useForm<z.infer<S>>` no compila. Patrón obligatorio:
    `useForm<z.input<S>, unknown, z.output<S>>`. Si el schema no coacciona, un
    solo genérico está bien.
11. **La augmentation de `next-auth/jwt` no cruza el `export *`.** El token
    dentro de los callbacks conserva índice `unknown`; hay que narrowear con
    `typeof` en el callback `session`.
12. **Next 16: `searchParams` es una Promise.** Hay que awaitearla, y el tipo
    global es `PageProps<"/ruta">`. Para layouts, `LayoutProps<"/">`.

---

## 7. Setup rápido

1. Clonar el repo + `pnpm install`.
2. `pnpm db:generate` (el client es generado, no se commitea).
3. Crear `.env` con:
   - `DATABASE_URL` (§2.2, con comillas dobles)
   - `AUTH_SECRET` (generar con
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
4. `pnpm dev` y entrar a `/login`.
5. Si el esquema del legacy cambió: `pnpm db:pull && pnpm db:generate`.

Scripts disponibles:

| Script | Qué hace |
|---|---|
| `pnpm db:pull` | Introspección del esquema legacy |
| `pnpm db:generate` | Genera el client tipado |
| `pnpm db:studio` | Explorador de datos |

---

## 8. Divergencias respecto de comercial-web

Resumen de lo que este sistema hace distinto, para que nadie aplique a ciegas lo
que sabe del otro:

| Tema | comercial-web | comercial-manager |
|---|---|---|
| Prisma | 5/6: `@prisma/client`, `url` en el schema | 7: adapter `mssql`, `prisma.config.ts`, client generado |
| Selección de sucursal | El usuario elige `IDLocal` en el login | Sucursal implícita: `ID_LOCAL_IMPLICITO = 1` |
| Gate de administrador | `UsuarioRolId` / `RolUsuario` | Solo `UsuarioRolId === 1` |
| Protección de rutas | `middleware.ts` (Next previo) | `proxy.ts` (Next 16), runtime Node |
| Host de confianza | no declarado | `trustHost: true` por despliegue self-hosted |
| Server custom (`server.js`) | Sí, inyecta `x-client-ip` | **No implementado todavía** |
| Prerender | no aplica | `instant = false` por `cacheComponents` |
