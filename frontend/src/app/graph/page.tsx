"use client";

import * as echarts from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";
import { getNeighborhood } from "@/lib/api";
import type { GraphData, GraphNode } from "@/lib/types";

const TYPE_NAMES: Record<string, string> = {
  person: "人物",
  concept: "概念",
  passage: "篇章",
  proposition: "命题",
  school: "学派",
};
const TYPE_COLORS: Record<string, string> = {
  person: "#993C1D",
  concept: "#0F6E56",
  passage: "#854F0B",
  proposition: "#534AB7",
  school: "#1E5F8E",
};
const EDGE_LABELS: Record<string, string> = {
  DISCIPLE_OF: "师承",
  RELATED_TO: "相关",
  MENTIONS: "提及",
  PROPOSED: "提出",
  ABOUT: "论及",
  BELONGS_TO: "属于",
  FROM: "出自",
};
const START_NODES = [
  { id: "ren", label: "仁" },
  { id: "li", label: "礼" },
  { id: "junzi", label: "君子" },
  { id: "yi", label: "义" },
  { id: "kongzi", label: "孔子" },
];
const FALLBACK_TYPE: GraphNode["type"] = "concept";

function normalizeGraph(input: GraphData): GraphData {
  const allowedTypes = new Set(Object.keys(TYPE_NAMES));
  const nodeMap = new Map<string, GraphNode>();

  input.nodes.forEach((node) => {
    if (!node?.id) return;
    const type = allowedTypes.has(node.type) ? node.type : FALLBACK_TYPE;
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, {
        ...node,
        type: type as GraphNode["type"],
        label: node.label || node.id,
        color: node.color || TYPE_COLORS[type],
        meta: node.meta || {},
      });
    }
  });

  const edgeKeys = new Set<string>();
  const edges = input.edges.filter((edge) => {
    if (!edge?.source || !edge?.target || !edge.label) return false;
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) return false;
    const key = `${edge.source}\u0000${edge.target}\u0000${edge.label}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    return true;
  });

  return { ...input, nodes: Array.from(nodeMap.values()), edges };
}

export default function GraphPage() {
  const [center, setCenter] = useState("ren");
  const [depth, setDepth] = useState(2);
  const [data, setData] = useState<GraphData | null>(null);
  const [selected, setSelected] = useState<string>("ren");
  const [err, setErr] = useState("");
  const [dark, setDark] = useState(false);
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // 观察主题切换，驱动 echarts 重绘
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setErr("");
    getNeighborhood(center, depth)
      .then((d) => {
        setData(normalizeGraph(d));
        setSelected(center);
      })
      .catch(() => setErr("无法连接后端，请先启动 uvicorn (8000)。"));
  }, [center, depth]);

  // ECharts（自包含：每次挂载/数据变更自建自销，StrictMode 安全）
  useEffect(() => {
    if (!elRef.current || !data) return;
    const chart = echarts.init(elRef.current);
    chartRef.current = chart;

    const catIndex = Object.keys(TYPE_NAMES);
    const categories = catIndex.map((t) => ({
      name: TYPE_NAMES[t],
      itemStyle: { color: TYPE_COLORS[t] },
    }));
    const labelColor = dark ? "#ECE6DA" : "#2C2C2A";
    const edgeColor = dark ? "#9C9486" : "#888780";
    const lineColor = dark ? "rgba(255,255,255,0.16)" : "#c8c2b6";

    chart.setOption({
      tooltip: {
        formatter: (p: { dataType?: string; data?: { label?: string; en?: string } }) =>
          p.dataType === "node"
            ? `${p.data?.label ?? ""}${p.data?.en ? `<br/><span style="color:#999">${p.data.en}</span>` : ""}`
            : "",
      },
      legend: [
        {
          data: categories.map((c) => c.name),
          bottom: 0,
          textStyle: { color: labelColor, fontSize: 11 },
        },
      ],
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          draggable: true,
          categories,
          force: { repulsion: 240, edgeLength: 120, gravity: 0.08 },
          label: {
            show: true,
            position: "right",
            fontSize: 12,
            color: labelColor,
            formatter: (p: { data: { label: string } }) => p.data.label,
          },
          edgeLabel: {
            show: true,
            fontSize: 9,
            color: edgeColor,
            formatter: (p: { data: { rel: string } }) => EDGE_LABELS[p.data.rel] ?? p.data.rel,
          },
          emphasis: { focus: "adjacency", lineStyle: { width: 3 } },
          lineStyle: { color: lineColor, curveness: 0.06 },
          data: data.nodes.map((n) => ({
            id: n.id,
            name: n.id,
            label: n.label,
            en: n.label_en,
            value: n.type,
            category: Math.max(0, catIndex.indexOf(n.type)),
            symbolSize: n.id === center ? 46 : 30,
            itemStyle: { color: n.color },
          })),
          edges: data.edges.map((e) => ({ source: e.source, target: e.target, rel: e.label })),
        },
      ],
    });

    const onClick = (params: { dataType?: string; data?: { id?: string } }) => {
      if (params.dataType === "node" && params.data?.id) setSelected(params.data.id);
    };
    const onDbl = (params: { dataType?: string; data?: { id?: string } }) => {
      if (params.dataType === "node" && params.data?.id) setCenter(params.data.id);
    };
    chart.on("click", onClick as never);
    chart.on("dblclick", onDbl as never);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, [data, center, dark]);

  const nodeMap = useMemo(() => {
    const m: Record<string, GraphNode> = {};
    data?.nodes.forEach((n) => (m[n.id] = n));
    return m;
  }, [data]);

  const relations = useMemo(() => {
    if (!data) return [];
    return data.edges
      .filter((e) => e.source === selected || e.target === selected)
      .map((e) => ({
        rel: e.label,
        other: nodeMap[e.source === selected ? e.target : e.source],
      }))
      .filter((r) => r.other);
  }, [data, selected, nodeMap]);

  if (err)
    return <div className="rounded-xl bg-accent-soft p-4 text-sm text-accent">{err}</div>;

  return (
    <div className="space-y-4">
      {/* 控制条 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
        <span className="text-xs text-faint">起点</span>
        {START_NODES.map((n) => (
          <button
            key={n.id}
            onClick={() => setCenter(n.id)}
            className={`rounded-full px-2.5 py-1 text-xs ${
              center === n.id ? "bg-accent text-white" : "border border-line text-muted"
            }`}
          >
            {n.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        <span className="text-xs text-faint">深度</span>
        {[1, 2, 3].map((d) => (
          <button
            key={d}
            onClick={() => setDepth(d)}
            className={`rounded-full px-2.5 py-1 text-xs ${
              depth === d ? "bg-accent-soft text-accent" : "bg-surface-2 text-faint"
            }`}
          >
            {d}
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-faint sm:inline">
          单击查看关系 · 双击以该点为中心展开
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div
          ref={elRef}
          className="hidden h-[520px] rounded-2xl border border-line bg-surface md:block"
        />

        <aside className="space-y-2">
          {nodeMap[selected] && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div
                className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] text-white"
                style={{ background: nodeMap[selected].color }}
              >
                {TYPE_NAMES[nodeMap[selected].type]}
              </div>
              <div className="font-serif text-lg text-fg">{nodeMap[selected].label}</div>
              {nodeMap[selected].label_en && (
                <div className="text-xs italic text-faint">{nodeMap[selected].label_en}</div>
              )}
            </div>
          )}
          <div className="text-xs text-faint">关系 {relations.length} 条</div>
          {relations.map((r, i) => (
            <button
              key={i}
              onClick={() => setCenter(r.other.id)}
              className="block w-full rounded-lg border border-line bg-surface p-3 text-left hover:bg-surface-2"
            >
              <span className="mr-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-accent">
                {EDGE_LABELS[r.rel] ?? r.rel}
              </span>
              <span className="font-serif text-sm text-fg">{r.other.label}</span>
              <span className="ml-1 text-[10px] text-faint">{TYPE_NAMES[r.other.type]}</span>
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
}
