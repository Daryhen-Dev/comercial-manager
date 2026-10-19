import { LoginScreen } from "./_components/login-screen";

// This page reads `searchParams`, which is uncached runtime data; with
// cacheComponents enabled it must opt out of prerendering instead of streaming.
// It does NOT touch the database: the branch is implicit in the auth layer, so
// the sign-in screen stays usable even when SQL Server is unreachable.
export const instant = false;

export default async function LoginPage(props: PageProps<"/login">) {
  const { error, callbackUrl } = await props.searchParams;

  // searchParams values can be repeated, so `error` may arrive as `string[]`.
  const errorParam = Array.isArray(error) ? error[0] : error;
  const callback =
    typeof callbackUrl === "string"
      ? callbackUrl
      : Array.isArray(callbackUrl)
        ? callbackUrl[0]
        : undefined;

  return <LoginScreen errorParam={errorParam} callbackUrl={callback} />;
}
