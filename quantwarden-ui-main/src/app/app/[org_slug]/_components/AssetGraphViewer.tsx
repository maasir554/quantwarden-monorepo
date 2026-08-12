"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Network, Plus, RotateCcw } from "lucide-react";
import { normalizeAssetOpenPorts } from "@/lib/port-discovery";

type AssetGraphViewerProps = {
  org: {
    id: string;
    slug: string;
    name: string;
    assets: AssetRow[];
  };
};

type AssetRow = {
  id: string;
  value: string;
  type?: string | null;
  isRoot?: boolean | null;
  parentId?: string | null;
  verified?: boolean | null;
  resolvedIp?: string | null;
  openPorts?: unknown;
  createdAt?: string | Date | null;
  scanStatus?: string | null;
  portDiscoveryStatus?: string | null;
};

type GraphNodeKind = "domain" | "ip" | "service" | "scanner";

type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  radius: number;
  assetId?: string;
  labelDx?: number;
  labelDy?: number;
  labelAnchor?: "start" | "middle" | "end";
  alwaysLabel?: boolean;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

type PositionedAsset = {
  asset: AssetRow;
  x: number;
  y: number;
  angle: number;
};

type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

type LabelPlacement = {
  dx: number;
  dy: number;
  anchor: "start" | "middle" | "end";
  showSecondary: boolean;
};

type ScreenBox = { left: number; top: number; right: number; bottom: number };

const graphWidth = 1600;
const graphHeight = 1100;
const centerX = graphWidth / 2;
const centerY = graphHeight / 2;
const minZoom = 0.32;
const maxZoom = 3.2;
const graphPadding = 28;

const nodeStyles: Record<GraphNodeKind, { fill: string; stroke: string; text: string }> = {
  domain: { fill: "#2563eb", stroke: "#1d4ed8", text: "#1e3a8a" },
  ip: { fill: "#7c3aed", stroke: "#6d28d9", text: "#4c1d95" },
  service: { fill: "#059669", stroke: "#047857", text: "#065f46" },
  scanner: { fill: "#991b1b", stroke: "#7f1d1d", text: "#7f1d1d" },
};

function truncateLabel(value: string, maxLength = 24) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function clampZoom(value: number) {
  return Math.min(maxZoom, Math.max(minZoom, Number(value.toFixed(2))));
}

function getFitViewport(width: number, height: number): Viewport {
  const availableWidth = Math.max(320, width - graphPadding * 2);
  const availableHeight = Math.max(260, height - graphPadding * 2);
  const zoom = clampZoom(Math.min(availableWidth / graphWidth, availableHeight / graphHeight));

  return {
    zoom,
    x: (width - graphWidth * zoom) / 2,
    y: (height - graphHeight * zoom) / 2,
  };
}

function layoutAssetGroup(group: AssetRow[], baseRing: number, ringGap: number, maxPerRing: number): PositionedAsset[] {
  return group.map((asset, index) => {
    const ringIndex = Math.floor(index / maxPerRing);
    const indexInRing = index % maxPerRing;
    const itemsInRing = Math.min(maxPerRing, group.length - ringIndex * maxPerRing);
    const ring = baseRing + ringIndex * ringGap;
    const ringStagger = ringIndex % 2 === 0 ? 0 : Math.PI / Math.max(itemsInRing, 1);
    const angle =
      group.length <= 1
        ? -Math.PI / 2
        : (indexInRing / itemsInRing) * Math.PI * 2 - Math.PI / 2 + ringStagger;

    return {
      asset,
      x: centerX + Math.cos(angle) * ring,
      y: centerY + Math.sin(angle) * ring,
      angle,
    };
  });
}

function layoutAssetNodes(assets: AssetRow[]) {
  const rootAssets = assets
    .filter((asset) => asset.isRoot || !asset.parentId)
    .sort((left, right) => left.value.localeCompare(right.value));
  const childAssets = assets
    .filter((asset) => !rootAssets.some((root) => root.id === asset.id))
    .sort((left, right) => left.value.localeCompare(right.value));

  return [
    ...layoutAssetGroup(rootAssets, 185, 145, 8),
    ...layoutAssetGroup(childAssets, rootAssets.length > 0 ? 390 : 230, 155, 18),
  ];
}

function stableDirection(leftId: string, rightId: string) {
  const value = `${leftId}:${rightId}`;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  const angle = (hash % 360) * (Math.PI / 180);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function collisionDistance(left: GraphNode, right: GraphNode) {
  if (left.kind === "scanner" || right.kind === "scanner") return 132;
  if (left.kind === "domain" && right.kind === "domain") return 100;
  if (left.kind === "domain" || right.kind === "domain") return 84;
  return 68;
}

function applyNodeRepulsion(sourceNodes: GraphNode[]) {
  const nodes = sourceNodes.map((node) => ({ ...node }));
  const origins = new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y }]));

  for (let iteration = 0; iteration < 120; iteration += 1) {
    const cooling = 1 - iteration / 150;

    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const left = nodes[leftIndex];
        const right = nodes[rightIndex];
        let dx = right.x - left.x;
        let dy = right.y - left.y;
        let distance = Math.hypot(dx, dy);
        const requiredDistance = collisionDistance(left, right);
        if (distance >= requiredDistance) continue;

        if (distance < 0.001) {
          const direction = stableDirection(left.id, right.id);
          dx = direction.x;
          dy = direction.y;
          distance = 1;
        }

        const push = ((requiredDistance - distance) * 0.48 * cooling) / distance;
        const pushX = dx * push;
        const pushY = dy * push;
        const leftFixed = left.kind === "scanner";
        const rightFixed = right.kind === "scanner";

        if (!leftFixed) {
          left.x -= pushX * (rightFixed ? 1 : 0.5);
          left.y -= pushY * (rightFixed ? 1 : 0.5);
        }
        if (!rightFixed) {
          right.x += pushX * (leftFixed ? 1 : 0.5);
          right.y += pushY * (leftFixed ? 1 : 0.5);
        }
      }
    }

    nodes.forEach((node) => {
      if (node.kind === "scanner") return;
      const origin = origins.get(node.id);
      if (!origin) return;
      node.x += (origin.x - node.x) * 0.018;
      node.y += (origin.y - node.y) * 0.018;
      node.x = Math.min(graphWidth - 45, Math.max(45, node.x));
      node.y = Math.min(graphHeight - 45, Math.max(45, node.y));
    });
  }

  return nodes;
}

function buildGraph(assets: AssetRow[]) {
  const portRenderLimitPerAsset = assets.length > 800 ? 0 : assets.length > 280 ? 1 : assets.length > 140 ? 2 : 4;
  const visibleAssetIds = new Set(assets.map((asset) => asset.id));
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  nodes.set("scanner", {
    id: "scanner",
    kind: "scanner",
    label: "Asset Scanner",
    sublabel: `${assets.length} asset${assets.length === 1 ? "" : "s"}`,
    x: centerX,
    y: centerY,
    radius: 18,
    alwaysLabel: true,
  });

  for (const { asset, x, y, angle } of layoutAssetNodes(assets)) {
    const assetNodeId = `asset:${asset.id}`;
    const assetKind: GraphNodeKind = asset.type === "ip" ? "ip" : "domain";
    const radialX = Math.cos(angle);
    const radialY = Math.sin(angle);
    const tangentX = -Math.sin(angle);
    const tangentY = Math.cos(angle);

    nodes.set(assetNodeId, {
      id: assetNodeId,
      kind: assetKind,
      label: asset.value,
      sublabel: asset.type === "ip" ? "IP address" : asset.resolvedIp || (asset.isRoot ? "Root domain" : "Discovered asset"),
      x,
      y,
      radius: asset.isRoot ? 14 : 11,
      assetId: asset.id,
      labelDx: radialX * (asset.isRoot ? 45 : 40),
      labelDy: radialY * 40 + (Math.abs(radialY) < 0.3 ? 5 : 0),
      labelAnchor: radialX > 0.24 ? "start" : radialX < -0.24 ? "end" : "middle",
      alwaysLabel: Boolean(asset.isRoot),
    });

    const parentVisible = asset.parentId && visibleAssetIds.has(asset.parentId);
    const source = parentVisible ? `asset:${asset.parentId}` : "scanner";
    edges.set(`${source}->${assetNodeId}`, { id: `${source}->${assetNodeId}`, source, target: assetNodeId });

    if (asset.resolvedIp && asset.type !== "ip") {
      const ipNodeId = `ip:${asset.resolvedIp}`;
      if (!nodes.has(ipNodeId)) {
        nodes.set(ipNodeId, {
          id: ipNodeId,
          kind: "ip",
          label: asset.resolvedIp,
          sublabel: "Resolved IP",
          x: x + radialX * 82,
          y: y + radialY * 82,
          radius: 10,
          labelDx: radialX * 35,
          labelDy: radialY * 35,
          labelAnchor: radialX > 0.24 ? "start" : radialX < -0.24 ? "end" : "middle",
        });
      }
      edges.set(`${assetNodeId}->${ipNodeId}`, { id: `${assetNodeId}->${ipNodeId}`, source: assetNodeId, target: ipNodeId });
    }

    const ports = normalizeAssetOpenPorts(asset.openPorts).slice(0, portRenderLimitPerAsset);
    ports.forEach((port, portIndex) => {
      const portNodeId = `port:${asset.id}:${port.number}:${port.protocol}`;
      const offset = (portIndex - (ports.length - 1) / 2) * 54;
      nodes.set(portNodeId, {
        id: portNodeId,
        kind: "service",
        label: `${port.number}/${port.protocol.toUpperCase()}`,
        sublabel: port.number === 443 ? "TLS" : "Open port",
        x: x + radialX * 128 + tangentX * offset,
        y: y + radialY * 128 + tangentY * offset,
        radius: 8,
        assetId: asset.id,
        labelDx: radialX * 30,
        labelDy: radialY * 30,
        labelAnchor: radialX > 0.24 ? "start" : radialX < -0.24 ? "end" : "middle",
      });
      edges.set(`${assetNodeId}->${portNodeId}`, { id: `${assetNodeId}->${portNodeId}`, source: assetNodeId, target: portNodeId });
    });
  }

  return { nodes: applyNodeRepulsion([...nodes.values()]), edges: [...edges.values()] };
}

function boxesOverlap(left: ScreenBox, right: ScreenBox, gap = 5) {
  return !(
    left.right + gap <= right.left ||
    left.left >= right.right + gap ||
    left.bottom + gap <= right.top ||
    left.top >= right.bottom + gap
  );
}

function getLabelCandidates(
  node: GraphNode,
  zoom: number,
  screenX: number,
  screenY: number,
  width: number,
  height: number
) {
  const nodeRadius = node.radius;
  const gap = 12;
  const radialX = node.x === centerX && node.y === centerY ? 1 : (node.x - centerX) / Math.hypot(node.x - centerX, node.y - centerY);
  const radialY = node.x === centerX && node.y === centerY ? 0 : (node.y - centerY) / Math.hypot(node.x - centerX, node.y - centerY);

  const candidate = (labelX: number, labelY: number, anchor: LabelPlacement["anchor"]) => {
    const left = anchor === "start" ? labelX : anchor === "end" ? labelX - width : labelX - width / 2;
    return {
      labelX,
      labelY,
      anchor,
      box: { left, top: labelY - 10, right: left + width, bottom: labelY - 10 + height },
    };
  };

  const right = candidate(screenX + nodeRadius + gap, screenY, "start");
  const left = candidate(screenX - nodeRadius - gap, screenY, "end");
  const top = candidate(screenX, screenY - nodeRadius - gap - Math.max(0, height - 20), "middle");
  const bottom = candidate(screenX, screenY + nodeRadius + gap, "middle");

  if (Math.abs(radialX) >= Math.abs(radialY)) {
    return radialX >= 0 ? [right, top, bottom, left] : [left, top, bottom, right];
  }
  return radialY >= 0 ? [bottom, right, left, top] : [top, right, left, bottom];
}

export default function AssetGraphViewer({ org }: AssetGraphViewerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressCanvasClickRef = useRef(false);
  const fittedOrgRef = useRef<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 720 });
  const [viewport, setViewport] = useState<Viewport>(() => getFitViewport(1200, 720));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedNodeId(null);
        setHoveredNodeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const graph = useMemo(() => buildGraph(org.assets || []), [org.assets]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const activeNodeId = hoveredNodeId || selectedNodeId;
  const connectedNodeIds = useMemo(() => {
    const connected = new Set<string>();
    if (!activeNodeId) return connected;
    connected.add(activeNodeId);
    graph.edges.forEach((edge) => {
      if (edge.source === activeNodeId) connected.add(edge.target);
      if (edge.target === activeNodeId) connected.add(edge.source);
    });
    return connected;
  }, [activeNodeId, graph.edges]);
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : null;
  const portCount = org.assets.reduce((sum, asset) => sum + normalizeAssetOpenPorts(asset.openPorts).length, 0);
  const isDenseGraph = graph.nodes.length > 220;
  const isHugeGraph = graph.nodes.length > 700;

  const worldBounds = useMemo(() => {
    const left = (-viewport.x / viewport.zoom) - 120;
    const top = (-viewport.y / viewport.zoom) - 120;
    const right = left + viewportSize.width / viewport.zoom + 240;
    const bottom = top + viewportSize.height / viewport.zoom + 240;
    return { left, top, right, bottom };
  }, [viewport, viewportSize]);

  const visibleNodes = useMemo(
    () =>
      graph.nodes.filter(
        (node) =>
          node.x >= worldBounds.left &&
          node.x <= worldBounds.right &&
          node.y >= worldBounds.top &&
          node.y <= worldBounds.bottom
      ),
    [graph.nodes, worldBounds]
  );
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => graph.edges.filter((edge) => visibleNodeIds.has(edge.source) || visibleNodeIds.has(edge.target)),
    [graph.edges, visibleNodeIds]
  );

  const labelPlacements = useMemo(() => {
    const placements = new Map<string, LabelPlacement>();
    const occupied: ScreenBox[] = visibleNodes.map((node) => {
      const x = viewport.x + node.x * viewport.zoom;
      const y = viewport.y + node.y * viewport.zoom;
      const radius = node.radius + 7;
      return { left: x - radius, top: y - radius, right: x + radius, bottom: y + radius };
    });

    const candidates = visibleNodes
      .filter((node) => {
        if (node.id === activeNodeId || node.id === selectedNodeId || node.alwaysLabel) return true;
        if (viewport.zoom >= 1.08) return true;
        if (viewport.zoom >= 0.82) return node.kind === "domain" || node.kind === "ip";
        if (viewport.zoom >= 0.62) return node.kind === "domain";
        return false;
      })
      .sort((left, right) => {
        const priority = (node: GraphNode) =>
          node.id === activeNodeId ? 0 : node.id === selectedNodeId ? 1 : node.kind === "scanner" ? 2 : node.alwaysLabel ? 3 : node.kind === "domain" ? 4 : node.kind === "ip" ? 5 : 6;
        return priority(left) - priority(right);
      });

    candidates.forEach((node) => {
      const isFocused = node.id === activeNodeId || node.id === selectedNodeId;
      const showSecondary = isFocused && Boolean(node.sublabel);
      const label = truncateLabel(node.label, isDenseGraph ? 20 : 28);
      const sublabel = showSecondary ? truncateLabel(node.sublabel || "", 20) : "";
      const width = Math.max(label.length * 7.4, sublabel.length * 6.2) + 8;
      const height = showSecondary ? 38 : 20;
      const screenX = viewport.x + node.x * viewport.zoom;
      const screenY = viewport.y + node.y * viewport.zoom;
      const options = getLabelCandidates(node, viewport.zoom, screenX, screenY, width, height);
      const chosen = options.find((option) => occupied.every((box) => !boxesOverlap(option.box, box)));

      if (!chosen) return;
      occupied.push(chosen.box);
      placements.set(node.id, {
        dx: (chosen.labelX - screenX) / viewport.zoom,
        dy: (chosen.labelY - screenY) / viewport.zoom,
        anchor: chosen.anchor,
        showSecondary,
      });
    });

    return placements;
  }, [activeNodeId, isDenseGraph, selectedNodeId, viewport, visibleNodes]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const updateSize = () => {
      const nextSize = {
        width: Math.max(320, element.clientWidth),
        height: Math.max(360, element.clientHeight),
      };
      setViewportSize(nextSize);
      if (fittedOrgRef.current !== org.id) {
        fittedOrgRef.current = org.id;
        setViewport(getFitViewport(nextSize.width, nextSize.height));
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [org.id]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const intensity = event.shiftKey ? 0.2 : 0.12;
      setViewportZoom(
        viewport.zoom + (event.deltaY > 0 ? -intensity : intensity),
        event.clientX,
        event.clientY
      );
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [viewport.zoom]);

  function setViewportZoom(nextZoom: number, anchorClientX?: number, anchorClientY?: number) {
    const element = viewportRef.current;
    const clampedZoom = clampZoom(nextZoom);

    if (!element || anchorClientX === undefined || anchorClientY === undefined) {
      setViewport((current) => ({ ...current, zoom: clampedZoom }));
      return;
    }

    const rect = element.getBoundingClientRect();
    const relativeX = anchorClientX - rect.left;
    const relativeY = anchorClientY - rect.top;

    setViewport((current) => {
      const worldX = (relativeX - current.x) / current.zoom;
      const worldY = (relativeY - current.y) / current.zoom;
      return {
        zoom: clampedZoom,
        x: relativeX - worldX * clampedZoom,
        y: relativeY - worldY * clampedZoom,
      };
    });
  }

  function updateZoom(delta: number) {
    setViewport((current) => ({ ...current, zoom: clampZoom(current.zoom + delta) }));
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[560px] min-w-0 flex-col gap-3 overflow-hidden">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[#3d200a]">Asset discoveries</h1>
        <p className="mt-1 text-sm text-[#8a5d33]">Infrastructure relationships derived from discovery and port scans.</p>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Network topology</h2>
            <p className="text-xs text-slate-500">
              {graph.nodes.length} nodes, {graph.edges.length} links, {portCount} tracked open ports.
            </p>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-600">
              {[
                ["domain", "Web/Domain"],
                ["ip", "IP Address"],
                ["service", "Open Service"],
                ["scanner", "Scanner"],
              ].map(([kind, label]) => (
                <span key={kind} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full border"
                    style={{
                      background: nodeStyles[kind as GraphNodeKind].fill,
                      borderColor: nodeStyles[kind as GraphNodeKind].stroke,
                    }}
                  />
                  {label}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => updateZoom(-0.12)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-white hover:text-slate-950"
                aria-label="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-12 text-center text-xs font-semibold tabular-nums text-slate-600">
                {Math.round(viewport.zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => updateZoom(0.12)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-white hover:text-slate-950"
                aria-label="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewport(getFitViewport(viewportSize.width, viewportSize.height))}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-white hover:text-slate-950"
                aria-label="Reset zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={viewportRef}
          className="relative min-h-0 flex-1 overflow-hidden bg-slate-50"
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            dragStateRef.current = {
              startX: event.clientX,
              startY: event.clientY,
              originX: viewport.x,
              originY: viewport.y,
              moved: false,
            };
          }}
          onMouseMove={(event) => {
            if (!dragStateRef.current) return;
            const dx = event.clientX - dragStateRef.current.startX;
            const dy = event.clientY - dragStateRef.current.startY;
            if (Math.hypot(dx, dy) > 4) dragStateRef.current.moved = true;
            setViewport((current) => ({
              ...current,
              x: dragStateRef.current ? dragStateRef.current.originX + dx : current.x,
              y: dragStateRef.current ? dragStateRef.current.originY + dy : current.y,
            }));
          }}
          onMouseUp={() => {
            suppressCanvasClickRef.current = Boolean(dragStateRef.current?.moved);
            dragStateRef.current = null;
          }}
          onMouseLeave={() => {
            dragStateRef.current = null;
          }}
        >
          {org.assets.length === 0 ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[8px] bg-[#8B0000]/10">
                <Network className="h-8 w-8 text-[#8B0000]" />
              </div>
              <h3 className="mt-5 text-xl font-black text-[#3d200a]">No assets discovered yet</h3>
              <p className="mt-2 max-w-md text-sm font-semibold text-[#8a5d33]">
                Add a root domain or IP address, then run discovery to build the topology.
              </p>
              <Link
                href={`/app/${org.slug}/asset`}
                className="mt-5 rounded-[8px] bg-[#8B0000] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#730000]"
              >
                Manage Assets
              </Link>
            </div>
          ) : (
            <>
              <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 shadow-sm backdrop-blur">
                Drag to pan · Scroll to zoom
              </div>
              {(isDenseGraph || isHugeGraph) ? (
                <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 shadow-sm backdrop-blur">
                  {isHugeGraph
                    ? "Dense mode: service nodes and most labels are reduced until you zoom in."
                    : "Large graph: labels fade in as you zoom."}
                </div>
              ) : null}
              <svg
                className="block h-full w-full bg-slate-50"
                onClick={() => {
                  if (suppressCanvasClickRef.current) {
                    suppressCanvasClickRef.current = false;
                    return;
                  }
                  setSelectedNodeId(null);
                }}
              >
                <rect width="100%" height="100%" fill="#f8fafc" />
                <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
                  {visibleEdges.map((edge) => {
                    const source = nodeById.get(edge.source);
                    const target = nodeById.get(edge.target);
                    if (!source || !target) return null;
                    const isActive = Boolean(activeNodeId && connectedNodeIds.has(source.id) && connectedNodeIds.has(target.id));
                    return (
                      <line
                        key={edge.id}
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={isActive ? "#64748b" : "#cbd5e1"}
                        strokeWidth={isActive ? 2.5 : isHugeGraph ? 0.8 : 1.4}
                        opacity={isHugeGraph ? 0.55 : 0.9}
                      />
                    );
                  })}

                  {visibleNodes.map((node) => {
                    const style = nodeStyles[node.kind];
                    const isActive = activeNodeId === node.id;
                    const isDimmed = Boolean(activeNodeId && !connectedNodeIds.has(node.id));
                    const labelPlacement = labelPlacements.get(node.id);
                    const primaryFontSize = (node.kind === "service" ? 12 : 14) / viewport.zoom;
                    const secondaryFontSize = 11 / viewport.zoom;
                    const primaryStrokeWidth = 6 / viewport.zoom;
                    const secondaryStrokeWidth = 5 / viewport.zoom;

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x},${node.y})`}
                        className="cursor-pointer"
                        opacity={isDimmed ? 0.28 : 1}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (suppressCanvasClickRef.current) {
                            suppressCanvasClickRef.current = false;
                            return;
                          }
                          setSelectedNodeId((current) => (current === node.id ? null : node.id));
                        }}
                      >
                        <circle r={(node.radius + 8) / viewport.zoom} fill="transparent" />
                        <circle
                          r={node.radius / viewport.zoom}
                          fill={style.fill}
                          stroke={style.stroke}
                          strokeWidth={(isActive ? 4 : 2) / viewport.zoom}
                        />
                        {labelPlacement ? (
                          <text
                            x={labelPlacement.dx}
                            y={labelPlacement.dy}
                            textAnchor={labelPlacement.anchor}
                            dominantBaseline="middle"
                            fontSize={primaryFontSize}
                            fontWeight="650"
                            fill={style.text}
                            stroke="#f8fafc"
                            strokeWidth={primaryStrokeWidth}
                            paintOrder="stroke"
                            strokeLinejoin="round"
                            style={{ pointerEvents: "none", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
                          >
                            {truncateLabel(node.label, isDenseGraph ? 20 : 28)}
                          </text>
                        ) : null}
                        {node.sublabel && labelPlacement?.showSecondary ? (
                          <text
                            x={labelPlacement.dx}
                            y={labelPlacement.dy + 17 / viewport.zoom}
                            textAnchor={labelPlacement.anchor}
                            dominantBaseline="middle"
                            fontSize={secondaryFontSize}
                            fontWeight="500"
                            fill="#475569"
                            stroke="#f8fafc"
                            strokeWidth={secondaryStrokeWidth}
                            paintOrder="stroke"
                            style={{ pointerEvents: "none", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
                          >
                            {truncateLabel(node.sublabel, 20)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              </svg>

              {selectedNode ? (
                <div className="absolute left-3 top-3 z-20 flex max-w-[min(28rem,calc(100%-1.5rem))] items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-sm text-slate-600 shadow-md backdrop-blur">
                  <span className="font-semibold" style={{ color: nodeStyles[selectedNode.kind].text }}>
                    {selectedNode.label}
                  </span>
                  {selectedNode.sublabel ? <span className="truncate">{selectedNode.sublabel}</span> : null}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {selectedNode.kind}
                  </span>
                  {selectedNode.assetId ? (
                    <Link href={`/app/${org.slug}/asset/${selectedNode.assetId}`} className="ml-auto shrink-0 font-medium text-blue-700 hover:text-blue-900">
                      Open asset
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
