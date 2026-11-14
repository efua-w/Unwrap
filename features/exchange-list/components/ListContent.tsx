import { redirect } from "next/navigation";
import { LoadError } from "@/features/exchanges/components/LoadError";
import { NotAvailable } from "@/features/exchanges/components/NotAvailable";
import { readViewerTimeZone } from "@/lib/dates/viewer-time-zone";
import { formatUpdated } from "@/lib/dates/format-updated";
import { currentRow, LIST_COPY } from "../copy";
import { getExchangeForList, getMyExchangeList, getMyIdeas, getMyPersonalLists } from "../queries";
import type { ListMode } from "../types";
import { YourListPage } from "./YourListPage";

// The data side of Attach list (S11, S49), shared by /list and /my-list. Every refusal is the same
// "This exchange isn't available to you" page (GC-029): not a member, left, cancelled, already drawn, or
// an organiser who is only organising. The organiser's own route is /my-list (owner Q11), so a taking-part
// organiser who opens /list is sent there.
export async function ListContent({
  id,
  viewerId,
  mode,
  fromJoin,
}: {
  id: string;
  viewerId: string;
  mode: ListMode;
  fromJoin: boolean;
}) {
  let loaded;
  try {
    const exchange = await getExchangeForList(id, viewerId);
    loaded = exchange
      ? {
          exchange,
          myList: await getMyExchangeList(id),
          ideas: await getMyIdeas(id, viewerId),
          lists: await getMyPersonalLists(),
        }
      : null;
  } catch {
    return <LoadError>{LIST_COPY.loadError}</LoadError>;
  }

  if (!loaded || !loaded.exchange.takingPart) return <NotAvailable />;
  const { exchange, myList, ideas, lists } = loaded;
  if (mode === "participant" && exchange.isOrganiser) redirect(`/exchanges/${id}/my-list`);
  if (mode === "organiser" && !exchange.isOrganiser) return <NotAvailable />;
  if (!myList) return <LoadError>{LIST_COPY.loadError}</LoadError>;

  const timeZone = await readViewerTimeZone();
  const attached = myList.source === "wishlist" ? lists.find((l) => l.id === myList.wishlistId) : undefined;
  return (
    <YourListPage
      mode={mode}
      fromJoin={fromJoin}
      exchange={{ id: exchange.id, name: exchange.name, tint: exchange.tint, budget: exchange.budget }}
      myList={myList}
      ideas={ideas}
      current={currentRow(myList, attached ? formatUpdated(new Date(attached.updatedAt), new Date(), timeZone) : null)}
      hasWishlists={lists.length > 0}
      currentWishlistId={myList.source === "wishlist" ? myList.wishlistId : null}
      timeZone={timeZone}
    />
  );
}
