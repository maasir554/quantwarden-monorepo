"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Globe, Minus, Network, Plus, RotateCcw, Search, Server } from "lucide-react";
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
const graphHeight = 920;
const centerX = graphWidth / 2;
const centerY = graphHeight / 2;
const minZoom = 0.18;
const maxZoom = 3.2;
const graphPadding = 140;

const nodeStyles: Record<GraphNodeKind, { fill: string; stroke: string; text: string }> = {
  domain: { fill: "#0e2a3d", stroke: "#0891b2", text: "#0e7490" },
  ip: { fill: "#1a1040", stroke: "#4f46e5", text: "#4f46e5" },
  service: { fill: "#0e2d20", stroke: "#059669", text: "#047857" },
  scanner: { fill: "#2d0e1a", stroke: "#be123c", text: "#be123c" },
};

function truncateLabel(value: string, maxLength = 24) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
    ...layoutAssetGroup(rootAssets, 175, 125, 10),
    ...layoutAssetGroup(childAssets, rootAssets.length > 0 ? 330 : 175, 145, 16),
  ];
}

function buildGraph(assets: AssetRow[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  const portRenderLimitPerAsset = assets.length > 800 ? 0 : assets.length > 280 ? 1 : assets.length > 140 ? 2 : 4;
  const searchableAssets = normalizedSearch
    ? assets.filter((asset) => {
        const portTokens = normalizeAssetOpenPorts(asset.openPorts).flatMap((port) => [
          String(port.number),
          `${port.number}/${port.protocol}`,
          `${port.number}/${port.protocol.toUpperCase()}`,
        ]);

        return [asset.value, asset.type, asset.resolvedIp, asset.scanStatus, asset.portDiscoveryStatus, ...portTokens]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
    : assets;

  const visibleAssetIds = new Set(searchableAssets.map((asset) => asset.id));
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  nodes.set("scanner", {
    id: "scanner",
    kind: "scanner",
    label: "Asset Scanner",
    sublabel: `${searchableAssets.length} asset${searchableAssets.length === 1 ? "" : "s"}`,
    x: centerX,
    y: centerY,
    radius: 32,
  });

  for (const { asset, x, y, angle } of layoutAssetNodes(searchableAssets)) {
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
        });
      }
      edges.set(`${assetNodeId}->${ipNodeId}`, { id: `${assetNodeId}->${ipNodeId}`, source: assetNodeId, target: ipNodeId });
    }

    const ports = normalizeAssetOpenPorts(asset.openPorts).slice(0, portRenderLimitPerAsset);
    ports.forEach((port, portIndex) => {
      const portNodeId = `port:${asset.id}:${port.number}:${port.protocol}`;
      const offset = (portIndex - (ports.length - 1) / 2) * 46;
      nodes.set(portNodeId, {
        id: portNodeId,
        kind: "service",
        label: `${port.number}/${port.protocol.toUpperCase()}`,
        sublabel: port.number === 443 ? "TLS" : "Open port",
        x: x + radialX * 128 + tangentX * offset,
        y: y + radialY * 128 + tangentY * offset,
        radius: 17,
        assetId: asset.id,
      });
      edges.set(`${assetNodeId}->${portNodeId}`, { id: `${assetNodeId}->${portNodeId}`, source: assetNodeId, target: portNodeId });
    });
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export default function AssetGraphViewer({ org }: AssetGraphViewerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [search, setSearch] = useState("");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 720 });
  const [viewport, setViewport] = useState<Viewport>(() => getFitViewport(1200, 720));

  const graph = useMemo(() => buildGraph(org.assets || [], search), [org.assets, search]);
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
  const rootCount = org.assets.filter((asset) => asset.isRoot).length;
  const ipCount = new Set(org.assets.map((asset) => (asset.type === "ip" ? asset.value : asset.resolvedIp)).filter(Boolean)).size;
  const portCount = org.assets.reduce((sum, asset) => sum + normalizeAssetOpenPorts(asset.openPorts).length, 0);
  const lastAssetDate = [...org.assets]
    .map((asset) => asset.createdAt)
    .filter(Boolean)
    .sort((left, right) => new Date(right as string | Date).getTime() - new Date(left as string | Date).getTime())[0];
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
  }, [org.id, search, viewportSize.width, viewportSize.height]);

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
    <div className="flex min-h-full flex-col gap-5">
      <div className="rounded-[8px] border border-white/60 bg-white/62 px-5 py-5 shadow-sm backdrop-blur-xl sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.36em] text-[#8B0000]/70">Quantwarden</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#3d200a] sm:text-4xl">Asset Discoveries</h1>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-[8px] border border-amber-500/20 bg-white/70 px-4 py-2 text-sm font-bold text-[#6d3f1d]">
            <Calendar className="h-4 w-4 text-[#0e7490]" />
            {lastAssetDate ? `Latest asset added ${formatDate(lastAssetDate)}` : "No asset timeline yet"}
          </div>
        </div>
      </div>

      <div className="rounded-[8px] border border-white/60 bg-white/62 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a5d33]/55" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search domains, IP addresses, ports, or status"
            className="h-14 w-full rounded-[8px] border border-amber-500/20 bg-white/82 pl-12 pr-4 text-sm font-semibold text-[#3d200a] outline-none transition focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10"
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Tracked assets", value: org.assets.length, icon: Network },
            { label: "Root assets", value: rootCount, icon: Globe },
            { label: "Known IPs", value: ipCount, icon: Server },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-[8px] border border-amber-500/14 bg-white/72 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#8a5d33]/70">{stat.label}</p>
                  <Icon className="h-4 w-4 text-[#8B0000]" />
                </div>
                <p className="mt-2 text-2xl font-black text-[#3d200a]">{stat.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-[620px] overflow-hidden rounded-[8px] border border-white/65 bg-[#fff7dc]/86 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-3 border-b border-amber-500/16 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-[#3d200a]">Network Topology Graph</h2>
            <p className="text-sm font-semibold text-[#8a5d33]">
              {graph.nodes.length} nodes, {graph.edges.length} links, {portCount} tracked open ports.
            </p>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex flex-wrap gap-3 text-xs font-bold text-[#6d3f1d]">
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
            <div className="flex items-center gap-2 rounded-[8px] border border-amber-500/18 bg-white/72 p-1">
              <button
                type="button"
                onClick={() => updateZoom(-0.12)}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#7a1f1f] transition hover:bg-[#8B0000]/10"
                aria-label="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-14 text-center text-xs font-black text-[#6d3f1d]">
                {Math.round(viewport.zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => updateZoom(0.12)}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#7a1f1f] transition hover:bg-[#8B0000]/10"
                aria-label="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewport(getFitViewport(viewportSize.width, viewportSize.height))}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#7a1f1f] transition hover:bg-[#8B0000]/10"
                aria-label="Reset zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={viewportRef}
          className="relative h-[70vh] overflow-hidden"
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
              <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-[8px] border border-amber-500/18 bg-white/80 px-3 py-2 text-xs font-bold text-[#6d3f1d] backdrop-blur">
                Drag to pan. Scroll to zoom. Hold `Shift` while scrolling for faster zoom.
              </div>
              {(isDenseGraph || isHugeGraph) ? (
                <div className="pointer-events-none absolute right-4 top-4 z-10 rounded-[8px] border border-amber-500/18 bg-white/80 px-3 py-2 text-xs font-bold text-[#6d3f1d] backdrop-blur">
                  {isHugeGraph
                    ? "Dense mode: service nodes and most labels are reduced until you zoom in."
                    : "Large graph: labels fade in as you zoom."}
                </div>
              ) : null}
              <svg className="block h-full w-full bg-[#fff4cf]">
                <rect width="100%" height="100%" fill="#fff4cf" />
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
                        stroke={isActive ? "#0e7490" : "rgba(137, 92, 26, 0.24)"}
                        strokeWidth={isActive ? 2 : isHugeGraph ? 0.8 : 1.25}
                        opacity={isHugeGraph ? 0.6 : 1}
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
                      viewport.zoom >= 0.62 ||
                      (!isDenseGraph && node.kind !== "service") ||
                      (node.kind === "scanner" && viewport.zoom >= 0.32);
                    const showSecondaryLabel = isActive || viewport.zoom >= 1.05;

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
                            y={node.radius + 18}
                            textAnchor="middle"
                            fontSize={node.kind === "service" ? "10" : "12"}
                            fontWeight="800"
                            fill={style.text}
                            style={{ pointerEvents: "none", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                          >
                            {truncateLabel(node.label, isDenseGraph ? 18 : 24)}
                          </text>
                        ) : null}
                        {node.sublabel && showSecondaryLabel ? (
                          <text
                            y={node.radius + 33}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="700"
                            fill="#7c5a34"
                            style={{ pointerEvents: "none", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
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
          <div className="flex flex-col gap-2 border-t border-amber-500/16 bg-white/62 px-5 py-3 text-sm font-semibold text-[#6d3f1d] sm:flex-row sm:items-center">
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
