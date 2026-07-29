"use client";

import { createContext, useContext } from "react";

/** Measured stage canvas height — charts should fill this. */
export const MmStageHeightContext = createContext(420);

export function useMmStageHeight() {
  return useContext(MmStageHeightContext);
}
