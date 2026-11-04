// WHY: `next dev` compiles each route on first request. Under parallel workers that compile time
// ate into test timings and made the full run flaky, so the routes are compiled once up front.
export default async function globalSetup(): Promise<void> {
  const port = process.env.E2E_PORT ?? "3100";
  for (const path of ["/dev/components", "/dev/shell", "/dev/shell?back=1"]) {
    const response = await fetch(`http://localhost:${port}${path}`);
    await response.text();
  }
}
