import Link from "next/link";
import { ClipboardList, Wheat } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";

// Reads the session to decide which cards are visible.
export const instant = false;

type ReportCard = {
  title: string;
  description: string;
  href: string;
  icon: typeof Wheat;
  visible: boolean;
};

export default async function ReportesPage() {
  const session = await auth();
  const esAdmin = session?.user?.UsuarioRolId === 1;

  const secciones: { title: string; items: ReportCard[] }[] = [
    {
      title: "Cierre",
      items: [
        {
          title: "Inventario Maíz",
          description: "Stock de maíz de todas las sucursales desde el último cierre",
          href: "/reportes/cierre/inventario-maiz",
          icon: Wheat,
          visible: esAdmin,
        },
      ],
    },
    {
      title: "Ventas",
      items: [
        {
          title: "Kardex de Venta",
          description: "Saldos por cliente y su historial de movimientos",
          href: "/ventas/operaciones/kardex-venta",
          icon: ClipboardList,
          visible: true,
        },
      ],
    },
  ];

  const visibles = secciones
    .map((s) => ({ ...s, items: s.items.filter((i) => i.visible) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4 lg:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-fg-strong">Reportes</h1>
        <p className="text-body text-fg-soft">
          Consultas de solo lectura sobre la base compartida.
        </p>
      </header>

      {visibles.map((seccion) => (
        <section key={seccion.title} className="flex flex-col gap-3">
          <h2 className="text-h3 text-fg-soft">{seccion.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {seccion.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="group">
                  <Card className="hover:border-input h-full transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                      <CardTitle className="text-h3 text-fg-strong">{item.title}</CardTitle>
                      <Icon className="text-fg-faint size-4 shrink-0" aria-hidden="true" />
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-label text-fg-soft">
                        {item.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
