"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { UniversalSpotlight } from "@/components/layout/universal-spotlight";

type SpotlightContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openSpotlight: () => void;
  closeSpotlight: () => void;
};

const SpotlightContext = createContext<SpotlightContextValue | null>(null);

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openSpotlight = useCallback(() => setOpen(true), []);
  const closeSpotlight = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      openSpotlight,
      closeSpotlight,
    }),
    [open, openSpotlight, closeSpotlight]
  );

  return (
    <SpotlightContext.Provider value={value}>
      {children}
      <UniversalSpotlight open={open} onOpenChange={setOpen} />
    </SpotlightContext.Provider>
  );
}

export function useSpotlight() {
  const ctx = useContext(SpotlightContext);
  if (!ctx) {
    throw new Error("useSpotlight must be used within SpotlightProvider");
  }
  return ctx;
}
