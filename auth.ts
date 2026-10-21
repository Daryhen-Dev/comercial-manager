import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "./auth.config";
import { ID_LOCAL_IMPLICITO, puedeIngresar } from "@/lib/acceso";
import { db } from "@/lib/db";

// This system only serves one branch, so the local is implicit rather than
// chosen at login. A username can repeat across branches, so the lookup still
// has to pin IDLocal. Changing branches is a code change on purpose.
// The rule itself (branch + administrator + enabled) lives in `lib/acceso.ts`
// and is shared with the protected layout.

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        usuario: { label: "Usuario", type: "text" },
        clave: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        try {
          const usuario = credentials?.usuario;
          const clave = credentials?.clave;

          if (
            typeof usuario !== "string" ||
            typeof clave !== "string" ||
            usuario === "" ||
            clave === ""
          ) {
            return null;
          }

          // A username is not unique: the same person can exist twice in the
          // branch (one row with a role, one without), so every candidate is
          // considered instead of trusting `findFirst`'s arbitrary first row.
          const rows = await db.usuario.findMany({
            where: {
              NombreUsuario: usuario,
              IDLocal: ID_LOCAL_IMPLICITO,
            },
            orderBy: { IDUsuario: "asc" },
          });

          if (rows.length === 0) {
            return null;
          }

          // SECURITY NOTE: the password is compared in PLAINTEXT on purpose.
          // `Clave` is a legacy NVarChar(Max) column owned by the WinForms
          // system; hashing it would lock out every existing user. This is a
          // deliberate compatibility constraint that must NOT be "fixed".
          const conLaClaveCorrecta = rows.filter((row) => row.Clave === clave);
          if (conLaClaveCorrecta.length === 0) {
            return null;
          }

          // Enabled + this branch + administrator. Until this check existed, a
          // cashier of branch 1 authenticated fine and was only bounced later by
          // the protected layout, leaving a session behind.
          const row = conLaClaveCorrecta.find(puedeIngresar);
          if (!row) {
            return null;
          }

          // `Usuario` has no branch name, only IDLocal; resolve the display
          // name from `Local`.
          const local = await db.local.findUnique({
            where: { IDLocal: ID_LOCAL_IMPLICITO },
          });

          return {
            id: String(row.IDUsuario),
            name: row.NombreUsuario,
            IDUsuario: row.IDUsuario,
            IDLocal: row.IDLocal,
            UsuarioRolId: row.UsuarioRolId,
            RolUsuario: row.RolUsuario,
            NombreUsuario: row.NombreUsuario,
            Local: local?.Local ?? null,
          };
        } catch {
          // Never let a database error escape authorize; treat it as a failed
          // login.
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.IDUsuario = user.IDUsuario ?? null;
        token.IDLocal = user.IDLocal ?? null;
        token.UsuarioRolId = user.UsuarioRolId ?? null;
        token.RolUsuario = user.RolUsuario ?? null;
        token.NombreUsuario = user.NombreUsuario ?? null;
        token.Local = user.Local ?? null;
      }
      return token;
    },
    session({ session, token }) {
      // The token keeps an `unknown` index signature here: `next-auth/jwt`
      // star-re-exports `@auth/core/jwt`, and module augmentation cannot merge
      // through it (see types/next-auth.d.ts). Narrow explicitly, no casts.
      const num = (value: unknown): number | null =>
        typeof value === "number" ? value : null;
      const str = (value: unknown): string | null =>
        typeof value === "string" ? value : null;

      session.user.IDUsuario = num(token.IDUsuario);
      session.user.IDLocal = num(token.IDLocal);
      session.user.UsuarioRolId = num(token.UsuarioRolId);
      session.user.RolUsuario = str(token.RolUsuario);
      session.user.NombreUsuario = str(token.NombreUsuario);
      session.user.Local = str(token.Local);
      return session;
    },
  },
});
