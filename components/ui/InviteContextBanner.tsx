import { ExchangeTag, type ExchangeTint } from "./ExchangeTag";

// GC-003, GC-004: "You're joining {exchange}" above the title on Sign up, Log in and Verify when an
// invite is pending. Boards: Entry-Signup-invite, Entry-Login-invite, Entry-Verify-invite. It carries
// the exchange's name and tint only: nothing about who has joined (core security rule).
export function InviteContextBanner({ exchangeName, tint }: { exchangeName: string; tint: ExchangeTint }) {
  return (
    <div className="flex flex-col gap-12 pb-4">
      <ExchangeTag name={exchangeName} tint={tint} size="header" />
      <p className="break-words text-body-base-semibold">You&apos;re joining {exchangeName}</p>
    </div>
  );
}
