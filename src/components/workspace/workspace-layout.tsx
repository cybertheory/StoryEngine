"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable-panels";
import { ReactNode, useEffect, useState } from "react";

interface WorkspaceLayoutProps {
  navigator: ReactNode;
  canvas: ReactNode;
  prose: ReactNode;
  timeline: ReactNode;
}

/**
 * SSR / first paint: `react-resizable-panels` measures the group; if width/height
 * is 0 or numeric `defaultSize` is passed, React can stringify flex-basis as `24px`
 * instead of a ratio — panels collapse. We mount resizers only after layout and
 * use explicit `"NN%"` strings for default sizes.
 */
function WorkspaceLayoutResizable({
  navigator,
  canvas,
  prose,
  timeline,
}: WorkspaceLayoutProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <ResizablePanelGroup
        id="workspace-stack"
        orientation="vertical"
        className="min-h-0 min-w-0 flex-1"
        resizeTargetMinimumSize={{ fine: 12, coarse: 28 }}
      >
        <ResizablePanel
          id="workspace-main"
          defaultSize="68%"
          minSize="42%"
          className="min-h-0 min-w-0"
        >
          <ResizablePanelGroup
            id="workspace-row"
            orientation="horizontal"
            className="h-full min-h-0 min-w-0"
            resizeTargetMinimumSize={{ fine: 12, coarse: 28 }}
          >
            <ResizablePanel
              id="navigator"
              defaultSize="24%"
              minSize="220px"
              maxSize="42%"
              className="min-h-0 min-w-0"
            >
              <div className="h-full min-h-0 min-w-0 overflow-hidden border-r border-foreground/10">
                {navigator}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              id="canvas"
              defaultSize="48%"
              minSize="28%"
              className="min-h-0 min-w-0"
            >
              <div className="h-full min-h-0 min-w-0 overflow-hidden">
                {canvas}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              id="prose"
              defaultSize="28%"
              minSize="240px"
              maxSize="48%"
              className="min-h-0 min-w-0"
            >
              <div className="h-full min-h-0 min-w-0 overflow-hidden border-l border-foreground/10">
                {prose}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle withHandle forVerticalGroup />
        <ResizablePanel
          id="timeline"
          defaultSize="32%"
          minSize="160px"
          maxSize="58%"
          className="min-h-0 min-w-0"
        >
          <div className="h-full min-h-0 min-w-0 overflow-hidden border-t border-foreground/10">
            {timeline}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function WorkspaceLayoutStaticFallback({
  navigator,
  canvas,
  prose,
  timeline,
}: WorkspaceLayoutProps) {
  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[7fr_3fr] bg-background">
      <div className="flex min-h-0 min-w-0">
        <div className="h-full w-[min(26vw,20rem)] min-w-[220px] max-w-[40%] shrink-0 overflow-hidden border-r border-foreground/10">
          {navigator}
        </div>
        <div className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
          {canvas}
        </div>
        <div className="h-full w-[min(30vw,22rem)] min-w-[240px] max-w-[48%] shrink-0 overflow-hidden border-l border-foreground/10">
          {prose}
        </div>
      </div>
      <div className="min-h-[160px] overflow-hidden border-t border-foreground/10">
        {timeline}
      </div>
    </div>
  );
}

export function WorkspaceLayout(props: WorkspaceLayoutProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <WorkspaceLayoutStaticFallback {...props} />;
  }

  return <WorkspaceLayoutResizable {...props} />;
}
