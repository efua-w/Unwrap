// WHY: `next dev` compiles each route on first request. Under parallel workers that compile time
// ate into test timings and made the full run flaky, so the routes are compiled once up front.
export default async function globalSetup(): Promise<void> {
  const port = process.env.E2E_PORT ?? "3100";
  // WHY every route the specs open (T2-1): a first compile blocks `next dev` for seconds, and a
  // timing-sensitive test on the other worker then fails. Signed out, /welcome and /profile redirect
  // to Log in, which still compiles them; /exchanges/1 compiles the not-found page.
  for (const path of [
    "/dev/components",
    "/dev/shell",
    "/dev/shell?back=1",
    "/",
    "/signup",
    "/login",
    "/verify",
    "/home",
    "/welcome",
    "/profile",
    "/wishlists",
    "/wishlists/00000000-0000-4000-8000-000000000000",
    "/exchanges/1",
  ]) {
    const response = await fetch(`http://localhost:${port}${path}`);
    await response.text();
  }
}
