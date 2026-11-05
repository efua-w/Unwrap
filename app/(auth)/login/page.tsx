import { LoginForm } from "@/features/auth/LoginForm";
import { safeNextOrUndefined } from "@/lib/auth/next-path";
import { redirectIfSignedIn } from "@/lib/auth/session";

type SearchParams = Promise<{ next?: string | string[] }>;

// S04 Log in (GC-004). `next` is untrusted, so it is sanitised before it goes anywhere.
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next: rawNext } = await searchParams;
  const next = safeNextOrUndefined(rawNext);
  await redirectIfSignedIn(next);
  return <LoginForm next={next} />;
}
