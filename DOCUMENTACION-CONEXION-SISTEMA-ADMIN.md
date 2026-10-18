# Documentación de Conexión y Estructura — Sistema de Administradores

> **Propósito**: guía para el nuevo sistema (solo administradores) sobre cómo
> conectarse a la misma base de datos local y de producción que **comercial-web**,
> y cómo debe quedar estructurado. Extraído del código real de comercial-web
> (documentado, no especulativo).

---

## 1. Regla de oro: misma base de datos, esquema compartido

Ambos sistemas apuntan a la **misma base SQL Server**: `BDComercial`.

- El esquema es **legacy y se trata como read-only**: NO hay migraciones de
  Prisma ni de ningún ORM. El esquema lo define/dueña el sistema WinForms.
- Prisma se usa **solo para consultas** (`$queryRaw`, `findMany`, etc.), nunca
  `prisma migrate`. Si un cambio de esquema es inevitable, se hace con SQL
  versionado en `scripts/sql/` (convención: `YYYYMMDD-descripcion.sql`) y luego
  `npx prisma db pull && npx prisma generate` para refrescar el client.
- Consecuencia para el nuevo sistema: **dos aplicaciones escribiendo a la vez
  sobre el mismo esquema**. Toda escritura nueva debe respetar las convenciones
  de columnas del legacy (ids como string en tablas NVarChar, fechas con
  GETDATE(), etc.) y validarse server-side.

---

## 2. Cadena de conexión (Prisma + SQL Server)

### 2.1 Variables de entorno (`.env` / `.env.local` en la raíz)

| Variable | Uso real | Nota |
|---|---|---|
| `DATABASE_URL` | **La que usa Prisma** (única referencia en `prisma/schema.prisma`) | Formato SQL Server, ver abajo |
| `AUTH_SECRET` | Firma de sesiones JWT (next-auth) y de tokens HMAC de clave maestra | Sin ella, next-auth y `lib/clave-maestra` fallan cerrado |
| `DB_SERVER`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` | **Definidas pero SIN uso en el código actual** | No las repliques en el nuevo sistema salvo que las vayas a usar; evita variables muertas |

⚠️ Las credenciales reales viven solo en los `.env` de cada máquina. **Nunca
commitear `.env`** ni copiar passwords a documentos/repos.

### 2.2 Formato de `DATABASE_URL` (local)

```
sqlserver://HOST;port=1433;database=BDComercial;user=USUARIO;password=***;encrypt=false;trustServerCertificate=true
```

Puntos clave del formato (Prisma + SQL Server):
- Host y puerto van **dentro del string**, separados por `;` (no query params).
- `encrypt=false` y `trustServerCertificate=true` son necesarios contra el SQL
  Server local/red sin certificado TLS válido.
- **Local**: host = la PC donde corre el SQL Server (ej. `DARYHEN-PC`).
- **Producción**: mismo formato, cambia el host y las credenciales. El
  `DATABASE_URL` de producción **no está en este repo**: vive en el `.env` del
  servidor de producción (`C:\apps\comercial-web\.env`). El nuevo sistema debe
  seguir esa convención: `.env` por máquina, nunca en el repo.

### 2.3 Singleton de Prisma (`lib/db.ts`)

```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
```

Patrón obligatorio en desarrollo para que el hot-reload no agote el pool de
conexiones. El nuevo sistema debe copiar este singleton tal cual (`db` como
nombre exportado es la convención de todo el código: `import { db } from "@/lib/db"`).

---

## 3. Ejecución local y producción

| Entorno | Comando | Detalle |
|---|---|---|
| Dev | `pnpm dev` (→ `node server.js`) | Custom server en puerto **3000** |
| Producción | `pnpm start` (→ `cross-env NODE_ENV=production node server.js`) o PM2 | Puerto **80** |

**¿Por qué un `server.js` custom?** Inyecta `x-client-ip` en cada request
(normaliza `::ffff:` de IPv4-mapped). Si algún módulo necesita la IP real del
cliente, la lee de ese header. El nuevo sistema necesita lo mismo si va a
registrar IPs.

**Producción (PM2)** — `ecosystem.config.js`:
- `cwd: C:\apps\comercial-web` (carpeta de deploy en el servidor Windows)
- `NODE_ENV=production`, `PORT=80`
- Ejecuta `next start` vía `node_modules\.bin\next.cmd`

⚠️ Antes de `build`/`start` en cualquier máquina: `pnpm install` y
`npx prisma generate` (el client de Prisma se genera, no se commitea).

---

## 4. Autenticación (next-auth v5 beta, Credentials)

La conexión **de usuarios** funciona así y el nuevo sistema debe replicarla:

1. **Provider Credentials** contra la tabla `Usuario` de la misma DB:
   match por `NombreUsuario + IDLocal` (el usuario elige sucursal en el login),
   clave comparada en texto plano (así funciona el legacy), rechazo de
   `Estado !== true`.
2. **Sin adapter de DB**: `session.strategy` es JWT (default de next-auth v5).
   La sesión vive en cookie firmada con `AUTH_SECRET`.
3. **Sesión enriquecida**: el callback `jwt()` copia al token `IDUsuario`,
   `IDLocal`, `UsuarioRolId`, `RolUsuario`, `NombreUsuario`, `Local`; el
   callback `session()` los expone en `session.user`. **Todo el código lee
   esos campos**: `auth()` devuelve la sucursal y el rol del usuario sin
   re-consultar la DB.
4. **Middleware/proxy** (`proxy.ts`): matcher que protege todo menos
   `_next/static`, `_next/image`, `favicon.ico` y `api/auth`. Rutas públicas:
   solo `(auth)/login`. Todo lo demás está bajo `(main)` protegido.
5. Para el **sistema de administradores**: el rol viene en
   `session.user.UsuarioRolId/RolUsuario` — el gate de "solo administradores"
   debe validarse **server-side en cada acción** (el middleware solo sabe si
   hay sesión, no el rol) además del check visual.

---

## 5. Estructura de proyecto (convenciones a replicar)

```
nuevo-sistema-admin/
├── app/
│   ├── (auth)/login/                 # Login público (credentials)
│   ├── (main)/                       # Layout protegido (valida rol admin server-side)
│   │   └── <modulo>/
│   │       ├── page.tsx              # Server Component (carga inicial)
│   │       ├── layout.tsx            # (opcional) cancela padding del shell
│   │       ├── _actions/             # Server Actions ("use server")
│   │       ├── _components/          # Client components privados
│   │       └── _lib/                 # Helpers puros + mensajes (sin "use server")
│   └── api/                          # API Routes si hacen falta
├── components/ui/                    # shadcn/ui (generado)
├── components/shared/                # Componentes propios reutilizables
├── lib/
│   ├── db.ts                         # Singleton Prisma (copiar tal cual)
│   └── actions/                      # Composables compartidos entre módulos
├── prisma/schema.prisma              # Generado con `npx prisma db pull`
├── scripts/sql/                      # DDL versionado (si toca tocar el esquema)
├── server.js                         # Custom server (x-client-ip)
├── ecosystem.config.js               # PM2
└── .env                              # DATABASE_URL + AUTH_SECRET (nunca en repo)
```

---

## 6. Lecciones aprendidas (aplicar sí o sí en el nuevo sistema)

1. **`"use server"` SOLO en los entrypoints de acciones.** Nunca en libs
   importadas: cada export de un archivo `"use server"` se vuelve un **endpoint
   RPC público sin gate de sesión** (hallazgo CRÍTICO R1-001 de la review de
   clave maestra). Libs de servidor usan `import "server-only"` como garantía
   fuerte.
2. **Raw queries de Prisma sobre SQL Server**: los tipos JS no están garantizados
   (pueden llegar `number`, `BigInt` o `Prisma.Decimal`). Patrón obligatorio:
   declarar las columnas como `unknown` en el tipo crudo y normalizar con
   `Number()` al mapear.
3. **Aliases de SQL**: el mapeo TS debe leer los **aliases exactos** del SELECT
   (ej: `R.Quintales QQ` se lee como `r.QQ`). Un mismatch silencioso produce 0s
   (bug real corregido en romana).
4. **Auth() antes que nada** en toda acción: `session?.user?.IDUsuario` e
   `IDLocal` resuelven usuario y sucursal; sin sesión, throw temprano.
5. **Tokens de acción sensible** (borrados, clave maestra): firmar HMAC con
   `AUTH_SECRET` ligado a usuario+sucursal+propósito, TTL corto, en memoria de
   React (nunca storage), y verificar **en cada mutación**. Ver
   `lib/clave-maestra/token.ts` y `components/shared/clave-maestra/` como
   precedentes (el botón "EDICION" compartido).
6. **Decimal/money**: nunca flotantes para montos; el legacy usa
   `Math.round(x*100)/100` (half-away-from-zero) — documentar cualquier
   desviación de redondeo.
7. **Validaciones server-side con mensajes exactos del negocio**: el client
   puede pre-validar, pero el server re-valida todo (paridad con el legacy).

---

## 7. Setup rápido del nuevo sistema (checklist)

1. `pnpm init` / clonar base + `pnpm install`.
2. Copiar `lib/db.ts` (singleton) y `prisma/schema.prisma` (o hacer
   `npx prisma db pull` contra `BDComercial` + `npx prisma generate`).
3. Crear `.env` con `DATABASE_URL` (host correspondiente: local o producción)
   y `AUTH_SECRET` (generar uno propio, distinto al de comercial-web si el
   login es independiente).
4. Copiar `server.js` y `ecosystem.config.js` (ajustar `name` y `cwd` de PM2).
5. Replicar auth: `auth.ts` + `auth.config.ts` + `proxy.ts` con Credentials
   contra `Usuario`, JWT, sesión enriquecida, y el gate de rol admin en
   `(main)`.
6. Estructura por módulo: `page.tsx` + `_actions/` + `_components/` + `_lib/`.
7. Validar: `pnpm dev` contra la DB local, y en producción el `.env` del
   servidor apuntando al host de producción antes del `pnpm start`/PM2.
