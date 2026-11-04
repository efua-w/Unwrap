"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { initialNetworkState, isOffline, networkReducer } from "./network-status";

type NetworkStatus = {
  online: boolean;
  reportNetworkError: () => void;
  reportNetworkSuccess: () => void;
};

const NetworkStatusContext = createContext<NetworkStatus | null>(null);

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(networkReducer, initialNetworkState);

  useEffect(() => {
    // The server cannot know; sync with the browser after hydration.
    if (!navigator.onLine) dispatch({ type: "browser-offline" });
    const goOnline = () => dispatch({ type: "browser-online" });
    const goOffline = () => dispatch({ type: "browser-offline" });
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const reportNetworkError = useCallback(() => dispatch({ type: "network-error" }), []);
  const reportNetworkSuccess = useCallback(() => dispatch({ type: "network-success" }), []);
  const online = !isOffline(state);
  const value = useMemo(
    () => ({ online, reportNetworkError, reportNetworkSuccess }),
    [online, reportNetworkError, reportNetworkSuccess],
  );

  return <NetworkStatusContext.Provider value={value}>{children}</NetworkStatusContext.Provider>;
}

export function useNetworkStatus(): NetworkStatus {
  const ctx = useContext(NetworkStatusContext);
  if (!ctx) throw new Error("useNetworkStatus must be used inside NetworkStatusProvider");
  return ctx;
}

export function useOnline(): boolean {
  return useNetworkStatus().online;
}
