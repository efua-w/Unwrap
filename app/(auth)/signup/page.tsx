import { SignupForm } from "@/features/auth/SignupForm";
import { safeNextOrUndefined } from "@/lib/auth/next-path";
import { redirectIfSignedIn } from "@/lib/auth/session";

type SearchParams = Promise<{ next?: string | string[] }>;

// S03 Sign up (GC-003). `next` is untrusted, so it is sanitised before it goes anywhere.
export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const { next: rawNext } = await searchParams;
  const next = safeNextOrUndefined(rawNext);
  await redirectIfSignedIn(next);
  return <SignupForm next={next} />;
}
