"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpotlightProvider } from "@/contexts/spotlight-context";
import { AuthProvider } from "@/contexts/auth-context";
import { ReactNode } from "react";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!
);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <AuthProvider>
        <SpotlightProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </SpotlightProvider>
      </AuthProvider>
    </ConvexProvider>
  );
}
