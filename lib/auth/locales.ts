import "server-only";

import { db } from "@/lib/db";

export type Branch = {
  idLocal: number;
  nombre: string;
};

/**
 * Returns every branch (`Local`) ordered by `IDLocal` ascending, for the
 * login form's branch selector. `Local.Local` is nullable in the database,
 * so fall back to a readable synthetic name.
 */
export async function getBranches(): Promise<Branch[]> {
  const rows = await db.local.findMany({
    select: { IDLocal: true, Local: true },
    orderBy: { IDLocal: "asc" },
  });

  return rows.map((row) => ({
    idLocal: row.IDLocal,
    nombre: row.Local ?? `Local ${row.IDLocal}`,
  }));
}
