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

const graphWidth = 1600;
const graphHeight = 1100;
const centerX = graphWidth / 2;
const centerY = graphHeight / 2;
const minZoom = 0.18;
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
    radius: 32,
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
      radius: asset.isRoot ? 27 : 23,
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
          radius: 20,
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
        radius: 17,
        assetId: asset.id,
        labelDx: radialX * 30,
        labelDy: radialY * 30,
        labelAnchor: radialX > 0.24 ? "start" : radialX < -0.24 ? "end" : "middle",
      });
      edges.set(`${assetNodeId}->${portNodeId}`, { id: `${assetNodeId}->${portNodeId}`, source: assetNodeId, target: portNodeId });
    });
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export default function AssetGraphViewer({ org }: AssetGraphViewerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 720 });
  const [viewport, setViewport] = useState<Viewport>(() => getFitViewport(1200, 720));

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
  const activeNode = activeNodeId ? nodeById.get(activeNodeId) : null;
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

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const updateSize = () => {
      setViewportSize({
        width: Math.max(320, element.clientWidth),
        height: Math.max(360, element.clientHeight),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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

  useEffect(() => {
    setViewport(getFitViewport(viewportSize.width, viewportSize.height));
  }, [org.id, viewportSize.width, viewportSize.height]);

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
            };
          }}
          onMouseMove={(event) => {
            if (!dragStateRef.current) return;
            const dx = event.clientX - dragStateRef.current.startX;
            const dy = event.clientY - dragStateRef.current.startY;
            setViewport((current) => ({
              ...current,
              x: dragStateRef.current ? dragStateRef.current.originX + dx : current.x,
              y: dragStateRef.current ? dragStateRef.current.originY + dy : current.y,
            }));
          }}
          onMouseUp={() => {
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
              <svg className="block h-full w-full bg-slate-50">
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
                    const showPrimaryLabel =
                      isActive ||
                      selectedNodeId === node.id ||
                      node.alwaysLabel ||
                      (viewport.zoom >= 0.62 && node.kind === "domain") ||
                      (viewport.zoom >= 0.82 && node.kind === "ip") ||
                      viewport.zoom >= 1.08;
                    const showSecondaryLabel = isActive || viewport.zoom >= 1.05;
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
                        onClick={() => setSelectedNodeId((current) => (current === node.id ? null : node.id))}
                      >
                        <circle
                          r={Math.max(4, node.radius + (isActive ? 5 : 0))}
                          fill={style.fill}
                          stroke={style.stroke}
                          strokeWidth={isActive ? 3 : 2}
                        />
                        {showPrimaryLabel ? (
                          <text
                            x={node.labelDx ?? 0}
                            y={node.labelDy ?? node.radius + 20}
                            textAnchor={node.labelAnchor ?? "middle"}
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
                        {node.sublabel && showSecondaryLabel ? (
                          <text
                            x={node.labelDx ?? 0}
                            y={(node.labelDy ?? node.radius + 20) + 17}
                            textAnchor={node.labelAnchor ?? "middle"}
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
            </>
          )}
        </div>

        {activeNode ? (
          <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 sm:flex-row sm:items-center">
            <span className="font-black" style={{ color: nodeStyles[activeNode.kind].text }}>
              {activeNode.label}
            </span>
            {activeNode.sublabel ? <span>{activeNode.sublabel}</span> : null}
            <span className="rounded-full bg-[#8B0000]/10 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-[#8B0000]">
              {activeNode.kind}
            </span>
            {activeNode.assetId ? (
              <Link href={`/app/${org.slug}/asset/${activeNode.assetId}`} className="text-[#0e7490] hover:text-[#155e75] sm:ml-auto">
                Open asset intelligence
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
