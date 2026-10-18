import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getBranches, type Branch } from "@/lib/auth/locales";
import { LoginForm } from "./_components/login-form";

const APP_NAME = "Comercial Manager";

type ErrorCopy = {
  title: string;
  description: string;
};

const errorCopy: Record<string, ErrorCopy> = {
  forbidden: {
    title: "Acceso restringido",
    description:
      "Tu cuenta no tiene permisos de administrador para ingresar a esta área.",
  },
};

const genericErrorCopy: ErrorCopy = {
  title: "Credenciales inválidas",
  description: "Verificá tu usuario, contraseña y local, e intentá de nuevo.",
};

const databaseErrorCopy: ErrorCopy = {
  title: "Base de datos no disponible",
  description:
    "No se pudo conectar con la base de datos. Intentá de nuevo más tarde.",
};

// The login page reads `searchParams` and the branch list from the database,
// both uncached runtime data; with cacheComponents enabled it must opt out of
// prerendering instead of streaming.
export const instant = false;

export default async function LoginPage(props: PageProps<"/login">) {
  const { error, callbackUrl } = await props.searchParams;

  // searchParams values can be repeated, so `error` may arrive as `string[]`;
  // use the first occurrence when that happens.
  const errorParam = Array.isArray(error) ? error[0] : error;

  // The login page must stay usable even when the database is down: degrade
  // to an empty branch list with a visible notice instead of crashing.
  let branches: Branch[] = [];
  let databaseUnavailable = false;
  try {
    branches = await getBranches();
  } catch {
    databaseUnavailable = true;
  }

  const message = (errorParam && (errorCopy[errorParam] ?? genericErrorCopy)) ?? null;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">{APP_NAME}</CardTitle>
          <CardDescription>
            Área de administradores: ingresá tus credenciales para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {message ? (
            <Alert variant="destructive">
              <AlertTitle>{message.title}</AlertTitle>
              <AlertDescription>{message.description}</AlertDescription>
            </Alert>
          ) : null}
          {databaseUnavailable ? (
            <Alert variant="destructive">
              <AlertTitle>{databaseErrorCopy.title}</AlertTitle>
              <AlertDescription>{databaseErrorCopy.description}</AlertDescription>
            </Alert>
          ) : null}
          <LoginForm
            branches={branches}
            callbackUrl={
              typeof callbackUrl === "string"
                ? callbackUrl
                : Array.isArray(callbackUrl)
                  ? callbackUrl[0]
                  : undefined
            }
          />
        </CardContent>
      </Card>
    </main>
  );
}
