// A modal <dialog> opens in the browser top layer, above anything shown earlier. Whoever opens one
// fires this event so top-layer content that must stay visible (the toast) can re-show itself on top.
export const TOP_LAYER_EVENT = "unwrap:top-layer-opened";

export function announceTopLayerOpened(): void {
  window.dispatchEvent(new Event(TOP_LAYER_EVENT));
}
