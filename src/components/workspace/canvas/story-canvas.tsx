"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type OnConnect,
  type OnEdgesDelete,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ObjectTokenNode } from "./object-token";
import { InteractionEdge } from "./interaction-edge";
import { InteractionAfterConnectDialog } from "./interaction-after-connect-dialog";
import type { InteractionMeaningContext } from "@/lib/autogenerate-interaction-meaning";

const nodeTypes: NodeTypes = {
  objectToken: ObjectTokenNode,
};

const edgeTypes: EdgeTypes = {
  interaction: InteractionEdge,
};

interface StoryObject {
  _id: string;
  name: string;
  kind: string;
  description: string;
  imageUrl?: string;
  tags?: string[];
}

interface Placement {
  objectId: string;
  x: number;
  y: number;
  scale?: number;
}

/** Active interaction edges at the current playhead — `id` is `interactionId:edgeId`. */
export interface ActiveCanvasInteraction {
  id: string;
  interactionId: string;
  sourceObjectId: string;
  targetObjectId: string;
  label: string;
  style: "solid" | "dashed" | "wavy" | "dotted";
  /** Author note: what this custom (or saved) interaction means in the story. */
  interactionMeaning?: string;
}

interface StoryCanvasProps {
  placements: Placement[];
  activeInteractions: ActiveCanvasInteraction[];
  objects: StoryObject[];
  onPlacementsChange: (placements: Placement[]) => void;
  onCreateInteractionKeyframe: (args: {
    sourceObjectId: string;
    targetObjectId: string;
    label: string;
    style: "solid" | "dashed" | "wavy" | "dotted";
    interactionMeaning?: string;
  }) => void;
  onRemoveInteractionKeyframe: (keyframeId: string) => void;
  /** Used to scope private custom interaction presets (localStorage). */
  customInteractionsUserKey: string;
  /** Scene + canvas context for autogenerating custom interaction descriptions. */
  sceneContext: Omit<InteractionMeaningContext, "interactionLabel">;
}

function buildNodes(
  placements: Placement[],
  objectMap: Map<string, StoryObject>
): Node[] {
  return placements.map((p) => {
    const obj = objectMap.get(p.objectId);
    return {
      id: `obj-${p.objectId}`,
      type: "objectToken",
      position: { x: p.x, y: p.y },
      data: {
        name: obj?.name ?? "Unknown",
        kind: obj?.kind ?? "character",
        imageUrl: obj?.imageUrl,
        description: obj?.description ?? "",
      },
      draggable: true,
    };
  });
}

function buildEdges(interactions: ActiveCanvasInteraction[]): Edge[] {
  return interactions.map((int) => ({
    id: int.id,
    source: `obj-${int.sourceObjectId}`,
    target: `obj-${int.targetObjectId}`,
    type: "interaction",
    data: {
      label: int.label,
      style: int.style,
      meaning: int.interactionMeaning,
    },
    animated: int.style === "wavy",
  }));
}

export function StoryCanvas({
  placements,
  activeInteractions,
  objects,
  onPlacementsChange,
  onCreateInteractionKeyframe,
  onRemoveInteractionKeyframe,
  customInteractionsUserKey,
  sceneContext,
}: StoryCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [pendingLink, setPendingLink] = useState<{
    sourceObjectId: string;
    targetObjectId: string;
  } | null>(null);

  useLayoutEffect(() => {
    const map = new Map(objects.map((o) => [o._id, o]));
    setNodes(buildNodes(placements, map));
  }, [placements, objects, setNodes]);

  useLayoutEffect(() => {
    setEdges(buildEdges(activeInteractions));
  }, [activeInteractions, setEdges]);

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    const sourceId = connection.source?.replace("obj-", "") ?? "";
    const targetId = connection.target?.replace("obj-", "") ?? "";
    if (!sourceId || !targetId || sourceId === targetId) return;
    setPendingLink({
      sourceObjectId: sourceId,
      targetObjectId: targetId,
    });
  }, []);

  const onEdgesDelete: OnEdgesDelete = useCallback(
    (deleted) => {
      deleted.forEach((e) => onRemoveInteractionKeyframe(e.id));
    },
    [onRemoveInteractionKeyframe]
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      const objectId = node.id.replace("obj-", "");
      const updated = placements.map((p) =>
        p.objectId === objectId
          ? { ...p, x: node.position.x, y: node.position.y }
          : p
      );
      onPlacementsChange(updated);
    },
    [placements, onPlacementsChange]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const data = event.dataTransfer.getData("application/storyobject");
      if (!data) return;

      const obj: StoryObject = JSON.parse(data);
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const x = event.clientX - bounds.left - 60;
      const y = event.clientY - bounds.top - 30;

      const alreadyPlaced = placements.find((p) => p.objectId === obj._id);
      if (alreadyPlaced) return;

      onPlacementsChange([
        ...placements,
        { objectId: obj._id, x, y },
      ]);
    },
    [placements, onPlacementsChange]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  return (
    <div ref={reactFlowWrapper} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={onNodeDragStop}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid
        snapGrid={[20, 20]}
        className="bg-white"
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#e5e5e5"
        />
        <Controls
          showInteractive={false}
          className="border border-foreground/20 bg-background shadow-none"
        />
        <MiniMap
          className="border border-foreground/20 bg-background"
          maskColor="rgba(0,0,0,0.05)"
          nodeColor={() => "#0a0a0a"}
        />
        <Panel position="top-right" className="max-w-[13rem]">
          <p className="border border-foreground/20 bg-background/95 p-2 text-[10px] font-mono-face leading-snug text-muted-foreground shadow-sm backdrop-blur-sm">
            Drag from a token’s{" "}
            <span className="text-foreground/85">right</span> handle to another’s{" "}
            <span className="text-foreground/85">left</span> handle. After you
            connect, a dialog opens to set the interaction and direction.
          </p>
        </Panel>
      </ReactFlow>

      <InteractionAfterConnectDialog
        open={pendingLink !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLink(null);
        }}
        sourceObjectId={pendingLink?.sourceObjectId ?? ""}
        targetObjectId={pendingLink?.targetObjectId ?? ""}
        objects={objects}
        userStorageKey={customInteractionsUserKey}
        meaningContextBase={sceneContext}
        onConfirm={onCreateInteractionKeyframe}
      />
    </div>
  );
}
