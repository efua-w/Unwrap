export type NetworkState = { browserOnline: boolean; requestFailed: boolean };
export type NetworkAction =
  | { type: "browser-online" }
  | { type: "browser-offline" }
  | { type: "network-error" }
  | { type: "network-success" };

export const initialNetworkState: NetworkState = { browserOnline: true, requestFailed: false };

// WHY: offline when the browser says so OR a request failed with a network error; it clears on
// the browser coming back or on the next success (plan §8, GC-029).
export function networkReducer(state: NetworkState, action: NetworkAction): NetworkState {
  switch (action.type) {
    case "browser-online":
      return { browserOnline: true, requestFailed: false };
    case "browser-offline":
      return { ...state, browserOnline: false };
    case "network-error":
      return { ...state, requestFailed: true };
    case "network-success":
      return { ...state, requestFailed: false };
  }
}

export function isOffline(state: NetworkState): boolean {
  return !state.browserOnline || state.requestFailed;
}
