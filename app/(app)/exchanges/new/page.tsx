import { StartExchangeFlow } from "@/features/exchanges/components/StartExchangeFlow";
import { requireProfile } from "@/lib/auth/session";

// S26-S28 Start an exchange (GCO-001..003). Signed-in only. Boards: Org-Basics-*, Org-Budget-*,
// Org-Review-*. A full-screen flow: no bottom tabs, Close in the header. Nothing is written until
// Start exchange.
export default async function NewExchangePage() {
  await requireProfile("/exchanges/new");
  return <StartExchangeFlow />;
}
