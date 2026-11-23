"use client";

import { useSyncExternalStore } from "react";
import { deviceStore, isHidden, subscribeHidden, type DeviceHidden } from "./storage";

// Whether the giver hid this assignment on this device. WHY useSyncExternalStore: the flag is browser state, so the server
// render and hydration say "pending" (no name, no decision) and the browser's real answer follows without a setState in
// an effect. Hide again and a later Reveal change it for every screen that asks.
export function useDeviceHidden(assignmentId: string): DeviceHidden {
  return useSyncExternalStore<DeviceHidden>(
    subscribeHidden,
    () => (isHidden(deviceStore(), assignmentId) ? "hidden" : "shown"),
    () => "pending",
  );
}
