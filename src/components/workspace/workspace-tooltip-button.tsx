"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ButtonProps = ComponentProps<typeof Button>;
type TooltipSide = ComponentProps<typeof TooltipContent>["side"];

/** Icon or text `Button` with a hover tooltip (workspace chrome). */
export function WorkspaceTooltipButton({
  tooltip,
  tooltipSide = "top",
  children,
  ...buttonProps
}: ButtonProps & { tooltip: string; tooltipSide?: TooltipSide }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(triggerProps) => (
          <Button {...mergeProps(buttonProps, triggerProps)}>{children}</Button>
        )}
      />
      <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
