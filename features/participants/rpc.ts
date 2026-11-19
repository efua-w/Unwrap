import "server-only";
import type { createClient } from "@/lib/supabase/server";

// The nudge functions (migration 20261118232507_readiness_and_nudges) are called through this one narrow cast
// until lib/supabase/database.types.ts is regenerated after the migration is applied (CLAUDE.md "Database changes"
// 4: the types are never hand-edited). Then delete this file and call supabase.rpc directly.
export type RpcError = { code?: string; hint?: string | null };
type Client = Awaited<ReturnType<typeof createClient>>;

type ReadinessRecord = { member_id: string; display_name: string; is_me: boolean; has_wishlist: boolean; nudged_recently: boolean };
type NudgedRecord = { member_id: string; display_name: string };

type Calls = {
  get_readiness: { args: { p_exchange: string }; data: ReadinessRecord[] };
  send_nudge: { args: { p_exchange: string; p_members: string[] }; data: NudgedRecord[] };
  undo_nudge: { args: { p_exchange: string }; data: number };
};

export function callNudgeRpc<F extends keyof Calls>(
  supabase: Client,
  fn: F,
  args: Calls[F]["args"],
): PromiseLike<{ data: Calls[F]["data"] | null; error: RpcError | null }> {
  const client = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: Calls[F]["data"] | null; error: RpcError | null }>;
  };
  return client.rpc(fn, args);
}
