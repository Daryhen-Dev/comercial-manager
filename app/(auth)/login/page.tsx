import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  description: "Verificá tu usuario y contraseña, e intentá de nuevo.",
};

// This page reads `searchParams`, which is uncached runtime data; with
// cacheComponents enabled it must opt out of prerendering instead of streaming.
// It does NOT touch the database: the branch is implicit in the auth layer, so
// the login form stays usable even when SQL Server is unreachable.
export const instant = false;

export default async function LoginPage(props: PageProps<"/login">) {
  const { error, callbackUrl } = await props.searchParams;

  // searchParams values can be repeated, so `error` may arrive as `string[]`;
  // use the first occurrence when that happens.
  const errorParam = Array.isArray(error) ? error[0] : error;
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
          <LoginForm
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
