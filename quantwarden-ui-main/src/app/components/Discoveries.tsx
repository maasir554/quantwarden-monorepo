"use client";

import { useState } from "react";
import { Search, Calendar, Globe, Wifi, Server, Shield, Lock } from "lucide-react";

const nodeTypes: Record<string, { color: string; border: string; text: string; size: number }> = {
  www:  { color: "#0e2a3d", border: "#22d3ee", text: "var(--discover-www-text)", size: 28 },
  ip:   { color: "#1a1040", border: "#818cf8", text: "var(--discover-ip-text)", size: 24 },
  ssl:  { color: "#0e2d20", border: "#34d399", text: "var(--discover-ssl-text)", size: 22 },
  ssh:  { color: "#2d1a0e", border: "#f59e0b", text: "var(--discover-ssh-text)", size: 22 },
  scan: { color: "#1a1530", border: "#a78bfa", text: "var(--discover-scan-text)", size: 32 },
  app:  { color: "#2d0e1a", border: "#f43f5e", text: "var(--discover-app-text)", size: 32 },
  tab:  { color: "#1e2a20", border: "#4ade80", text: "var(--discover-tab-text)", size: 20 },
  vpn:  { color: "#2a1e10", border: "#fb923c", text: "var(--discover-vpn-text)", size: 22 },
};

const nodes = [
  { id: 0,  x: 490, y: 400, type: "scan", label: "PNB Scanner",          sub: "103.109.225.1"   },
  { id: 1,  x: 260, y: 470, type: "app",  label: "Core App Server",      sub: "10.0.4.15"       },
  { id: 2,  x: 440, y: 170, type: "www",  label: "pnb.co.in",            sub: "IP: 103.109.225" },
  { id: 3,  x: 300, y: 230, type: "ssl",  label: "SSL",                  sub: "2048-bit"        },
  { id: 4,  x: 150, y: 290, type: "ssh",  label: "SSH",                  sub: "Port 22"         },
  { id: 5,  x: 190, y: 210, type: "ip",   label: "103.109.224.131",      sub: ""                },
  { id: 6,  x: 330, y: 150, type: "www",  label: "netbanking.pnb.co.in", sub: "103.109.225.12"  },
  { id: 7,  x: 730, y: 185, type: "ip",   label: "103.186.238.44",       sub: ""                },
  { id: 8,  x: 690, y: 265, type: "ip",   label: "103.186.238.68",       sub: ""                },
  { id: 9,  x: 820, y: 230, type: "ip",   label: "103.177.168.201",      sub: ""                },
  { id: 10, x: 870, y: 180, type: "ip",   label: "103.177.168.44",       sub: ""                },
  { id: 11, x: 770, y: 310, type: "ip",   label: "103.109.224.249",      sub: ""                },
  { id: 12, x: 910, y: 280, type: "ip",   label: "103.109.225.201",      sub: ""                },
  { id: 13, x: 650, y: 340, type: "www",  label: "payments.pnb.co.in",   sub: "103.186.238.44"  },
  { id: 14, x: 560, y: 250, type: "www",  label: "api.pnb.co.in",        sub: "103.109.225.77"  },
  { id: 15, x: 465, y: 300, type: "www",  label: "auth.pnb.co.in",       sub: "103.177.168.201" },
  { id: 16, x: 380, y: 335, type: "www",  label: "vault.pnb.co.in",      sub: "103.109.225.128" },
  { id: 17, x: 270, y: 345, type: "ip",   label: "103.109.224.132",      sub: ""                },
  { id: 18, x: 355, y: 430, type: "ip",   label: "103.186.238.19",       sub: ""                },
  { id: 19, x: 555, y: 380, type: "www",  label: "trade.pnb.co.in",      sub: "103.109.224.191" },
  { id: 20, x: 640, y: 420, type: "www",  label: "kyc.pnb.co.in",        sub: "103.109.225.201" },
  { id: 21, x: 195, y: 430, type: "ip",   label: "103.177.168.178",      sub: ""                },
  { id: 22, x: 445, y: 480, type: "www",  label: "pnbone.pnb.co.in",     sub: "103.109.224.249" },
  { id: 23, x: 545, y: 470, type: "www",  label: "cdn.pnb.co.in",        sub: "103.177.168.44"  },
  { id: 24, x: 830, y: 370, type: "ip",   label: "78.154.233.60",       sub: "" },
  { id: 25, x: 880, y: 335, type: "ip",   label: "78.154.234.146",      sub: "" },
  { id: 26, x: 930, y: 395, type: "ip",   label: "78.154.239.131",      sub: "" },
  { id: 27, x: 960, y: 340, type: "vpn",  label: "VPN",                 sub: "" },
  { id: 28, x: 860, y: 445, type: "ip",   label: "78.154.236.277",      sub: "" },
  { id: 29, x: 790, y: 475, type: "ip",   label: "37.34.208.174",       sub: "" },
  { id: 30, x: 830, y: 520, type: "ip",   label: "182.180.55.93",       sub: "" },
  { id: 31, x: 665, y: 195, type: "tab",  label: "hosting",             sub: "" },
  { id: 32, x: 690, y: 480, type: "tab",  label: "ETAG",                sub: "" },
  { id: 33, x: 540, y: 145, type: "ssl",  label: "SSL",                 sub: "Valid" },
  { id: 34, x: 390, y: 250, type: "ssl",  label: "SSL",                 sub: "Expired" },
];

const edges: [number, number][] = [
  [0, 2], [0, 14], [0, 15], [0, 16], [0, 19], [0, 20], [0, 22], [0, 23],
  [1, 17], [1, 18], [1, 21], [1, 4],
  [2, 3], [2, 6], [2, 33],
  [3, 5], [4, 5], [5, 6], [6, 34],
  [13, 7], [13, 8], [13, 31],
  [7, 9], [8, 10], [9, 11], [10, 12],
  [14, 34],
  [19, 24], [20, 32], [18, 15],
  [24, 25], [25, 26], [26, 27],
  [28, 29], [29, 30],
  [32, 28], [32, 29], [32, 24],
  [11, 13], [12, 9],
];

const nodeIconMap: Record<string, React.FC<{ className?: string }>> = {
  www: Globe,
  ip: Wifi,
  ssl: Lock,
  ssh: Shield,
  scan: Search,
  app: Server,
  tab: Globe,
  vpn: Shield,
};

export default function Discoveries() {
  const [searchVal, setSearchVal] = useState("");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-03-13");
  const [hovered, setHovered] = useState<number | null>(null);

  const highlightSet = new Set<number>();
  if (hovered !== null) {
    highlightSet.add(hovered);
    edges.forEach(([a, b]) => {
      if (a === hovered) highlightSet.add(b);
      if (b === hovered) highlightSet.add(a);
    });
  }

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search domain, URL, contact, IoC or other…"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 py-3.5 pl-12 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-0 focus:outline-none"
          />
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-cyan-300" />
            <p className="text-sm font-medium text-slate-200">Time Period</p>
            <span className="text-xs text-slate-500">— Specify the Period for data</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Start</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
            <span className="text-slate-500">—</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">End</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
            <button className="ml-auto rounded-lg bg-cyan-500/20 border border-cyan-400/30 px-4 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/30 transition">
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Network Graph */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-sm font-medium text-slate-200">Network Topology Graph</h2>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            {[
              { type: "www", label: "Web/Domain" },
              { type: "ip", label: "IP Address" },
              { type: "ssl", label: "SSL/TLS" },
              { type: "scan", label: "Scanner" },
              { type: "app", label: "App Server" },
            ].map(({ type, label }) => (
              <span key={type} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border" style={{ background: nodeTypes[type].color, borderColor: nodeTypes[type].border }} />
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-slate-950/50 overflow-x-auto">
          <svg width="1060" height="580" className="min-w-[700px]">
            {/* Edges */}
            {edges.map(([a, b], i) => {
              const na = nodes[a];
              const nb = nodes[b];
              const isHighlighted = hovered !== null && (highlightSet.has(a) && highlightSet.has(b));
              return (
                <line
                  key={i}
                  x1={na.x} y1={na.y}
                  x2={nb.x} y2={nb.y}
                  stroke={isHighlighted ? "var(--discover-edge-active)" : "var(--discover-edge)"}
                  strokeWidth={isHighlighted ? 1.5 : 1}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const style = nodeTypes[node.type] ?? nodeTypes.ip;
              const r = style.size / 2;
              const isActive = hovered === node.id;
              const isDimmed = hovered !== null && !highlightSet.has(node.id);
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  style={{ cursor: "pointer", opacity: isDimmed ? 0.25 : 1, transition: "opacity 0.2s" }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <circle
                    r={r + (isActive ? 4 : 0)}
                    fill={style.color}
                    stroke={style.border}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                  {/* Label */}
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    fontSize={9}
                    fill={style.text}
                    style={{ pointerEvents: "none", fontFamily: "monospace", fontWeight: 600 }}
                  >
                    {node.label.length > 18 ? node.label.slice(0, 17) + "…" : node.label}
                  </text>
                  {node.sub && (
                    <text
                      y={r + 24}
                      textAnchor="middle"
                      fontSize={8}
                      fill="var(--discover-subtext)"
                      style={{ pointerEvents: "none", fontFamily: "monospace", fontWeight: 500 }}
                    >
                      {node.sub}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        {hovered !== null && (
          <div className="border-t border-white/10 px-5 py-3 flex items-center gap-4 text-xs text-slate-300">
            <span className="font-medium text-slate-100">{nodes[hovered]?.label}</span>
            {nodes[hovered]?.sub && <span className="text-slate-500 font-mono">{nodes[hovered].sub}</span>}
            <span className="rounded-full border border-white/20 px-2 py-0.5 text-slate-400 capitalize">{nodes[hovered]?.type}</span>
            <span className="ml-auto text-slate-500">Hover edges to trace connections</span>
          </div>
        )}
      </div>
    </div>
  );
}
