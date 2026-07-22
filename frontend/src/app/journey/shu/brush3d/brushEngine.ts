/** 书艺·竹简挥毫 — 书写引擎（薄逻辑，与 3D 表现解耦）
 *
 * 负责：底稿光栅（hanzi-writer strokes → 米字格浅灰底稿，缺数据回退系统楷体）、
 * 墨迹分段管理（慢粗快细）、段数/时长统计、
 * precision/recall/score 评分（离屏 256×256 掩膜分析，描红经典算法）。
 *
 * 计时纪律：全部用 Date.now() 真实时间，与 Canvas 时钟无关。
 */

export interface HanziData {
  strokes: string[];
  medians: number[][][];
}

export const CANVAS_SIZE = 1024; // 书写画布（纹理分辨率）
const ANALYSIS = 256; // 评分分析分辨率
const TOL = 34; // 容差膨胀（hanzi 1024 坐标系单位）

export interface InkSegment { x0: number; y0: number; x1: number; y1: number; w: number }
export interface InkDot { x: number; y: number; r: number }

export interface BrushEngineState {
  char: string;
  /** 底稿路径（hanzi 原始 1024 坐标，渲染时统一做 y 翻转） */
  paths: Path2D[];
  hasHanziData: boolean;
  /** 墨迹：段 + 起笔墨点 */
  segments: InkSegment[];
  dots: InkDot[];
  /** 显示画布（纸 + 格 + 底稿 + 墨），即 CanvasTexture 源 */
  view: HTMLCanvasElement;
  dirty: boolean;
  /** 段数（抬笔次数）与时长（首次落墨到交卷的真实毫秒） */
  strokes: number;
  firstInkAt: number | null;
  /** paintGuide 已作墨的底稿笔数（评分掩膜用） */
  guidePainted: number;
  /** 运笔状态 */
  penDown: boolean;
  lastX: number;
  lastY: number;
  lastW: number;
}

export async function loadHanziData(char: string): Promise<HanziData | null> {
  try {
    const r = await fetch(`/hanzi-data/${encodeURIComponent(char)}.json`);
    if (!r.ok) return null;
    const d = (await r.json()) as HanziData;
    return Array.isArray(d.strokes) && d.strokes.length > 0 ? d : null;
  } catch {
    return null;
  }
}

/** hanzi 1024 坐标 → 画布坐标（y 翻转：scale(1,-1)+translate(0,-900)，缩放到画布） */
function applyHanziTransform(ctx: CanvasRenderingContext2D, size: number) {
  const k = size / 1024;
  ctx.setTransform(k, 0, 0, -k, 0, 900 * k);
}

export function createEngine(char: string, data: HanziData | null): BrushEngineState {
  const view = document.createElement("canvas");
  view.width = CANVAS_SIZE;
  view.height = CANVAS_SIZE;
  const st: BrushEngineState = {
    char,
    paths: (data?.strokes ?? []).map((d) => new Path2D(d)),
    hasHanziData: !!data,
    segments: [],
    dots: [],
    view,
    dirty: true,
    strokes: 0,
    firstInkAt: null,
    guidePainted: 0,
    penDown: false,
    lastX: 0,
    lastY: 0,
    lastW: 26,
  };
  redrawView(st);
  return st;
}

// ── 底稿与重绘 ──

/** 重绘显示画布：宣纸底 + 米字格 + 浅灰底稿 + 全部墨迹 */
export function redrawView(st: BrushEngineState) {
  const ctx = st.view.getContext("2d")!;
  const S = CANVAS_SIZE;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 宣纸底
  ctx.fillStyle = "#f6f0dd";
  ctx.fillRect(0, 0, S, S);
  // 纸纹（淡斑点）
  ctx.fillStyle = "rgba(180,160,110,0.05)";
  for (let i = 0; i < 120; i++) {
    const x = (i * 733) % S;
    const y = (i * 397) % S;
    ctx.fillRect(x, y, 3 + (i % 5), 2 + (i % 3));
  }
  // 边框
  ctx.strokeStyle = "rgba(150,50,40,0.55)";
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, S - 60, S - 60);
  // 米字格
  ctx.strokeStyle = "rgba(150,50,40,0.28)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(S / 2, 40); ctx.lineTo(S / 2, S - 40);
  ctx.moveTo(40, S / 2); ctx.lineTo(S - 40, S / 2);
  ctx.moveTo(40, 40); ctx.lineTo(S - 40, S - 40);
  ctx.moveTo(S - 40, 40); ctx.lineTo(40, S - 40);
  ctx.stroke();
  ctx.setLineDash([]);
  // 底稿
  applyHanziTransform(ctx, S);
  if (st.hasHanziData) {
    ctx.fillStyle = "rgba(60,55,48,0.20)";
    for (const p of st.paths) ctx.fill(p);
  } else {
    // 回退：系统楷体大字
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "rgba(60,55,48,0.20)";
    ctx.font = `${S * 0.72}px "Songti SC", "STKaiti", "KaiTi", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(st.char, S / 2, S / 2 + S * 0.04);
  }
  // 墨迹
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = "#211d18";
  ctx.fillStyle = "#211d18";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of st.dots) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of st.segments) {
    ctx.beginPath();
    ctx.lineWidth = s.w;
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
  }
  st.dirty = true;
}

// ── 运笔 ──

export function penDown(st: BrushEngineState, x: number, y: number) {
  st.penDown = true;
  st.lastX = x;
  st.lastY = y;
  if (st.firstInkAt === null) st.firstInkAt = Date.now();
  // 起笔墨点
  st.dots.push({ x, y, r: st.lastW * 0.55 });
  partialInk(st);
}

/** speed：画布像素/秒（慢粗快细，模拟提按） */
export function penMove(st: BrushEngineState, x: number, y: number, speed: number) {
  if (!st.penDown) return;
  if (st.firstInkAt === null) st.firstInkAt = Date.now();
  const target = Math.max(12, Math.min(34, 34 - speed * 0.012));
  const w = st.lastW + (target - st.lastW) * 0.35;
  st.segments.push({ x0: st.lastX, y0: st.lastY, x1: x, y1: y, w });
  st.lastX = x;
  st.lastY = y;
  st.lastW = w;
  partialInk(st);
}

export function penUp(st: BrushEngineState) {
  if (!st.penDown) return;
  st.penDown = false;
  st.strokes += 1;
}

/** 增量上墨（不全幅重绘，只画最新一段/点） */
function partialInk(st: BrushEngineState) {
  const ctx = st.view.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = "#211d18";
  ctx.fillStyle = "#211d18";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const s = st.segments[st.segments.length - 1];
  if (s) {
    ctx.beginPath();
    ctx.lineWidth = s.w;
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
  } else {
    const d = st.dots[st.dots.length - 1];
    if (d) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  st.dirty = true;
}

export function clearInk(st: BrushEngineState) {
  st.segments = [];
  st.dots = [];
  st.strokes = 0;
  st.firstInkAt = null;
  st.penDown = false;
  st.lastW = 26;
  st.guidePainted = 0;
  redrawView(st);
}

// ── 评分（离屏 256×256 掩膜分析） ──

function renderGuideMask(st: BrushEngineState, ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ANALYSIS, ANALYSIS);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  if (st.hasHanziData) {
    applyHanziTransform(ctx, ANALYSIS);
    for (const p of st.paths) ctx.fill(p);
    // 容差：底稿描边膨胀
    ctx.lineWidth = TOL;
    ctx.lineJoin = "round";
    for (const p of st.paths) ctx.stroke(p);
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `${ANALYSIS * 0.72}px "Songti SC", "STKaiti", "KaiTi", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(st.char, ANALYSIS / 2, ANALYSIS / 2 + ANALYSIS * 0.04);
    // 文字回退不做膨胀（字体渲染已偏粗）
  }
}

function renderInkMask(st: BrushEngineState, ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ANALYSIS, ANALYSIS);
  const k = ANALYSIS / CANVAS_SIZE;
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // paintGuide 作墨的底稿笔（与底稿掩膜同样加容差描边，使描红满分时 recall=1）
  if (st.guidePainted > 0 && st.hasHanziData) {
    applyHanziTransform(ctx, ANALYSIS);
    const painted = st.paths.slice(0, st.guidePainted);
    for (const p of painted) ctx.fill(p);
    ctx.lineWidth = TOL;
    ctx.lineJoin = "round";
    for (const p of painted) ctx.stroke(p);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  for (const d of st.dots) {
    ctx.beginPath();
    ctx.arc(d.x * k, d.y * k, d.r * k, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of st.segments) {
    ctx.beginPath();
    ctx.lineWidth = s.w * k;
    ctx.moveTo(s.x0 * k, s.y0 * k);
    ctx.lineTo(s.x1 * k, s.y1 * k);
    ctx.stroke();
  }
}

export interface BrushScore { precision: number; recall: number; score: number }

export function computeScore(st: BrushEngineState): BrushScore {
  const g = document.createElement("canvas");
  g.width = ANALYSIS; g.height = ANALYSIS;
  const gctx = g.getContext("2d", { willReadFrequently: true })!;
  renderGuideMask(st, gctx);
  const gData = gctx.getImageData(0, 0, ANALYSIS, ANALYSIS).data;

  const ik = document.createElement("canvas");
  ik.width = ANALYSIS; ik.height = ANALYSIS;
  const ictx = ik.getContext("2d", { willReadFrequently: true })!;
  renderInkMask(st, ictx);
  const iData = ictx.getImageData(0, 0, ANALYSIS, ANALYSIS).data;

  let guideTotal = 0, covered = 0, inkTotal = 0, inkOutside = 0;
  for (let i = 3; i < gData.length; i += 4) {
    const gm = gData[i] > 40;
    const im = iData[i] > 40;
    if (gm) guideTotal++;
    if (im) inkTotal++;
    if (gm && im) covered++;
    if (im && !gm) inkOutside++;
  }
  if (guideTotal === 0 || inkTotal === 0) return { precision: 0, recall: 0, score: 0 };
  const recall = covered / guideTotal;
  const precision = 1 - inkOutside / inkTotal;
  return { precision, recall, score: Math.round(precision * recall * 100) };
}

/** 交卷数据 */
export function finalize(st: BrushEngineState) {
  const sc = computeScore(st);
  return {
    strokes: st.strokes,
    durationMs: st.firstInkAt === null ? 0 : Date.now() - st.firstInkAt,
    ...sc,
  };
}

// ── 调试钩子用 ──

/** 把底稿当笔迹画进去（高分路径；n 限定只画前 n 笔） */
export function paintGuide(st: BrushEngineState, n?: number) {
  const paths = n == null ? st.paths : st.paths.slice(0, Math.max(0, n));
  if (st.hasHanziData && paths.length > 0) {
    const ctx = st.view.getContext("2d")!;
    applyHanziTransform(ctx, CANVAS_SIZE);
    ctx.fillStyle = "#211d18";
    for (const p of paths) ctx.fill(p);
    st.guidePainted = Math.max(st.guidePainted, paths.length);
    st.strokes += paths.length;
  } else {
    // 回退：沿米字格画满（覆盖率靠字体掩膜）
    scribble(st, 6, true);
    return;
  }
  if (st.firstInkAt === null) st.firstInkAt = Date.now();
  st.dirty = true;
}

/** 乱涂（低分路径） */
export function scribble(st: BrushEngineState, count = 4, tidy = false) {
  const S = CANVAS_SIZE;
  const rnd = mulberry32(tidy ? 42 : Date.now() % 100000);
  for (let k = 0; k < count; k++) {
    let x = S * (0.15 + rnd() * 0.7);
    let y = S * (0.15 + rnd() * 0.7);
    st.dots.push({ x, y, r: 14 });
    const steps = 5 + Math.floor(rnd() * 4);
    for (let i = 0; i < steps; i++) {
      const nx = tidy ? S * (0.15 + rnd() * 0.7) : x + (rnd() - 0.5) * S * 0.5;
      const ny = tidy ? S * (0.15 + rnd() * 0.7) : y + (rnd() - 0.5) * S * 0.5;
      st.segments.push({ x0: x, y0: y, x1: nx, y1: ny, w: 20 + rnd() * 12 });
      x = nx; y = ny;
    }
    st.strokes += 1;
  }
  if (st.firstInkAt === null) st.firstInkAt = Date.now();
  redrawView(st);
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
