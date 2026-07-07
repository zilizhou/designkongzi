"use client";

/**
 * 礼 ·「执礼 · 宾至如归」— Phaser 玩法主体
 *
 * 三幕：
 *   一幕 迎宾（序 + 敬）：按尊卑顺序迎客，按住蓄力作揖，松手定深浅（过犹不及）
 *   二幕 安席（序）：把宾客拖到合乎位次的席位
 *   三幕 席间（节）：实时事件的时机把握 + 克己（过度殷勤反而扣分）
 *
 * 结束后把三维分 {jing, xu, jie} 交给 React 层上报后端。
 */

import { useEffect, useRef } from "react";
import type { LiHostScores } from "@/lib/types";

type Rank = "honored" | "elder" | "peer" | "junior";

export interface LiHostGuestCfg {
  id: string;
  name: string;
  rank: Rank;
  color: number;
  note: string;
  /** 该宾客揖礼中礼区间半宽的覆盖值（如远客更宽容） */
  zoneW?: number;
}

export interface LiHostEventCfg {
  at: number; // 开席后第几秒出现
  guest: string; // guest id
  icon: string;
  label: string;
  duration: number; // 事件持续秒数
  window: [number, number]; // 最佳时机窗（占 duration 的比例区间）
}

export interface LiHostScenarioCfg {
  key: string;
  title: string;
  subtitle: string;
  place: string;
  intro: string;
  tip: string;
  lesson: string;
  difficulty: number; // 1-5
  gaugeSpeed: number; // 蓄力速度（深度/秒）
  zoneW: number; // 揖礼中礼区间半宽（深度 0..1）
  banquetSeconds: number;
  guests: LiHostGuestCfg[];
  events: LiHostEventCfg[];
}

export interface LiHostRoundDetail {
  bowAvg: number;
  orderScore: number;
  seatScore: number;
  eventAvg: number;
  overActs: number;
  bows: { guest: string; verdict: string; score: number }[];
  events: { label: string; verdict: string; score: number }[];
}

const RANK_META: Record<Rank, { label: string; priority: number; depth: number; color: string }> = {
  honored: { label: "贵宾", priority: 4, depth: 0.82, color: "#993C1D" },
  elder: { label: "长者", priority: 3, depth: 0.68, color: "#854F0B" },
  peer: { label: "平辈", priority: 2, depth: 0.5, color: "#1E5F8E" },
  junior: { label: "幼辈", priority: 1, depth: 0.32, color: "#0F6E56" },
};

export const LI_HOST_SCENARIOS: LiHostScenarioCfg[] = [
  {
    key: "xiangyin",
    title: "乡饮酒礼",
    subtitle: "教学局 · 先学迎宾与安席",
    place: "村社学堂",
    intro: "乡里设宴敬老。你是今日主人：先依礼迎宾，再安排席位，席间照应周全。",
    tip: "先尊后卑迎客；对长者深揖，对幼辈浅揖——过深近谄，过浅近慢。",
    lesson: "乡饮酒礼的核心是「序」：谁先谁后、谁坐哪里，排序本身就是敬意。",
    difficulty: 1,
    gaugeSpeed: 0.75,
    zoneW: 0.11,
    banquetSeconds: 30,
    guests: [
      { id: "elder", name: "里中长者·伯翁", rank: "elder", color: 0x854f0b, note: "拄杖而来，望之俨然" },
      { id: "peer", name: "乡邻·仲叔", rank: "peer", color: 0x1e5f8e, note: "同辈乡邻，久未相见" },
      { id: "junior", name: "后生·小季", rank: "junior", color: 0x0f6e56, note: "初次赴宴，有些拘谨" },
    ],
    events: [
      { at: 4, guest: "elder", icon: "🍵", label: "长者杯空了", duration: 5, window: [0.3, 0.8] },
      { at: 11, guest: "peer", icon: "🍶", label: "仲叔举杯相邀", duration: 5, window: [0.3, 0.8] },
      { at: 18, guest: "junior", icon: "💬", label: "小季插不上话", duration: 5, window: [0.3, 0.8] },
      { at: 24, guest: "elder", icon: "🧓", label: "长者起身欲行", duration: 5, window: [0.3, 0.8] },
    ],
  },
  {
    key: "shixiangjian",
    title: "士相见礼",
    subtitle: "初次拜会 · 分寸更严",
    place: "府中正堂",
    intro: "远近士人来访相见。贵宾在列，揖礼的深浅、席位的高下都更讲究了。",
    tip: "贵宾之礼最深最严；「自卑而尊人」，但卑不是谄。",
    lesson: "礼者，自卑而尊人——把自己放低、把对方抬高，对任何人都如此。",
    difficulty: 2,
    gaugeSpeed: 0.9,
    zoneW: 0.09,
    banquetSeconds: 38,
    guests: [
      { id: "honored", name: "来访国士·公孙子", rank: "honored", color: 0x993c1d, note: "名满一方，执贽来见" },
      { id: "elder", name: "引见长者·师叔", rank: "elder", color: 0x854f0b, note: "为双方引见的前辈" },
      { id: "peer", name: "同门·子有", rank: "peer", color: 0x1e5f8e, note: "同门学友，随行而来" },
      { id: "junior", name: "门下弟子·阿俭", rank: "junior", color: 0x0f6e56, note: "执礼在侧的少年" },
    ],
    events: [
      { at: 4, guest: "honored", icon: "🎁", label: "国士奉上贽礼", duration: 4.5, window: [0.35, 0.72] },
      { at: 11, guest: "elder", icon: "🍵", label: "师叔杯空了", duration: 4.5, window: [0.35, 0.72] },
      { at: 18, guest: "peer", icon: "🍶", label: "子有举杯相邀", duration: 4.5, window: [0.35, 0.72] },
      { at: 25, guest: "junior", icon: "💬", label: "阿俭受了冷落", duration: 4.5, window: [0.35, 0.72] },
      { at: 32, guest: "honored", icon: "🧓", label: "国士起身告辞", duration: 4.5, window: [0.35, 0.72] },
    ],
  },
  {
    key: "jiayan",
    title: "家宴",
    subtitle: "长幼齐聚 · 事件频密考「节」",
    place: "自家堂屋",
    intro: "祖父寿辰，长幼齐聚。家人之间的礼最难：色难。事件会来得又多又快。",
    tip: "幼辈频频插话、长辈随时需要照应——沉住气，挑准时机，别忙乱。",
    lesson: "子曰：色难。对亲人尽礼，难的不是端茶送饭，而是脸色与心意。",
    difficulty: 3,
    gaugeSpeed: 0.95,
    zoneW: 0.085,
    banquetSeconds: 42,
    guests: [
      { id: "elder", name: "祖父", rank: "elder", color: 0x854f0b, note: "今日寿星，最要紧的人" },
      { id: "peer", name: "堂兄", rank: "peer", color: 0x1e5f8e, note: "多年未见的平辈" },
      { id: "junior1", name: "小侄", rank: "junior", color: 0x0f6e56, note: "坐不住的小孩" },
      { id: "junior2", name: "小妹", rank: "junior", color: 0x534ab7, note: "一直看手机的少女" },
    ],
    events: [
      { at: 3, guest: "elder", icon: "🍵", label: "祖父杯空了", duration: 4.5, window: [0.35, 0.7] },
      { at: 8, guest: "junior1", icon: "✋", label: "小侄打断祖父说话", duration: 4, window: [0.35, 0.7] },
      { at: 14, guest: "peer", icon: "🍶", label: "堂兄举杯相邀", duration: 4.5, window: [0.35, 0.7] },
      { at: 19, guest: "junior2", icon: "💬", label: "小妹被晾在一边", duration: 4, window: [0.35, 0.7] },
      { at: 25, guest: "elder", icon: "🧓", label: "祖父要讲旧事", duration: 4.5, window: [0.35, 0.7] },
      { at: 31, guest: "junior1", icon: "✋", label: "小侄又闹起来了", duration: 4, window: [0.35, 0.7] },
      { at: 37, guest: "elder", icon: "🍵", label: "给祖父添汤", duration: 4.5, window: [0.35, 0.7] },
    ],
  },
  {
    key: "yuanke",
    title: "待远客",
    subtitle: "有朋自远方来 · 宽严之间",
    place: "郊居庭院",
    intro: "远方友人来访，不识中土礼数。对远人当宽，对己当严——分寸拿捏在你。",
    tip: "对远客的揖礼区间更宽容；但你自己的顺序与时机，一点不能松。",
    lesson: "有朋自远方来，不亦乐乎？礼待远人，贵在诚意而不苛求形式。",
    difficulty: 4,
    gaugeSpeed: 1.0,
    zoneW: 0.085,
    banquetSeconds: 40,
    guests: [
      { id: "honored", name: "远客·安岚", rank: "honored", color: 0x993c1d, note: "跨海而来，不识中礼", zoneW: 0.16 },
      { id: "elder", name: "长者·伯翁", rank: "elder", color: 0x854f0b, note: "闻远客至，欣然赴会" },
      { id: "peer", name: "同窗·子敬", rank: "peer", color: 0x1e5f8e, note: "与你同窗多年" },
    ],
    events: [
      { at: 4, guest: "honored", icon: "❓", label: "远客不知如何举箸", duration: 5.5, window: [0.25, 0.85] },
      { at: 11, guest: "elder", icon: "🍵", label: "长者杯空了", duration: 4.5, window: [0.35, 0.7] },
      { at: 17, guest: "honored", icon: "🗺", label: "远客说起故乡", duration: 5.5, window: [0.25, 0.85] },
      { at: 24, guest: "peer", icon: "🍶", label: "子敬举杯相邀", duration: 4.5, window: [0.35, 0.7] },
      { at: 30, guest: "honored", icon: "💬", label: "远客误了礼数很窘", duration: 5.5, window: [0.25, 0.85] },
      { at: 36, guest: "elder", icon: "🧓", label: "长者起身欲行", duration: 4.5, window: [0.35, 0.7] },
    ],
  },
  {
    key: "dashe",
    title: "大射前宴",
    subtitle: "终局 · 全机制高难度",
    place: "射宫外庑",
    intro: "明日大射，今夜设宴。正宾在座，司正在侧——这是对你「执礼」的总考。",
    tip: "中礼区间最窄、事件最密。揖让而升，下而饮：其争也君子。",
    lesson: "射礼与宴礼相为表里：先能敬人、序人、节己，明日才谈得上反求诸己。",
    difficulty: 5,
    gaugeSpeed: 1.2,
    zoneW: 0.07,
    banquetSeconds: 45,
    guests: [
      { id: "honored", name: "射礼正宾·公仪子", rank: "honored", color: 0x993c1d, note: "明日大射的正宾" },
      { id: "elder", name: "司正·老丈", rank: "elder", color: 0x854f0b, note: "执掌礼仪纠察的长者" },
      { id: "peer", name: "同射·子臧", rank: "peer", color: 0x1e5f8e, note: "明日与你同射之人" },
      { id: "junior", name: "观礼少年·小柯", rank: "junior", color: 0x0f6e56, note: "来观礼的少年" },
    ],
    events: [
      { at: 3, guest: "honored", icon: "🍶", label: "正宾举杯", duration: 4, window: [0.42, 0.68] },
      { at: 8, guest: "elder", icon: "🍵", label: "司正杯空了", duration: 4, window: [0.42, 0.68] },
      { at: 13, guest: "peer", icon: "🏹", label: "子臧论弓矢", duration: 4, window: [0.42, 0.68] },
      { at: 18, guest: "junior", icon: "💬", label: "小柯欲问不敢问", duration: 4, window: [0.42, 0.68] },
      { at: 23, guest: "honored", icon: "🎁", label: "正宾赠玉玦", duration: 4, window: [0.42, 0.68] },
      { at: 29, guest: "elder", icon: "🧓", label: "司正宣宴将毕", duration: 4, window: [0.42, 0.68] },
      { at: 34, guest: "peer", icon: "🍶", label: "子臧再邀一杯", duration: 4, window: [0.42, 0.68] },
      { at: 40, guest: "honored", icon: "🧓", label: "正宾起身还席", duration: 4, window: [0.42, 0.68] },
    ],
  },
];

export function liHostScenario(key: string): LiHostScenarioCfg {
  return LI_HOST_SCENARIOS.find((s) => s.key === key) ?? LI_HOST_SCENARIOS[0];
}

const W = 960;
const H = 640;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function LiPhaserGame({
  scenarioKey,
  onExit,
  onFinish,
}: {
  scenarioKey: string;
  onExit: () => void;
  onFinish: (scores: LiHostScores, detail: LiHostRoundDetail) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<{ destroy: (removeCanvas: boolean) => void } | null>(null);
  const onExitRef = useRef(onExit);
  const onFinishRef = useRef(onFinish);
  onExitRef.current = onExit;
  onFinishRef.current = onFinish;

  useEffect(() => {
    let mounted = true;
    const cfg = liHostScenario(scenarioKey);

    async function boot() {
      const Phaser = await import("phaser");
      if (!mounted || !hostRef.current) return;

      type GuestNode = {
        cfg: LiHostGuestCfg;
        node: Phaser.GameObjects.Container;
        greeted: boolean;
        seatIdx: number | null; // 当前占用的席位
        homeX: number;
        homeY: number;
      };

      type LiveEvent = {
        cfg: LiHostEventCfg;
        guest: GuestNode;
        bubble: Phaser.GameObjects.Container;
        ring: Phaser.GameObjects.Graphics;
        startMs: number;
        resolved: boolean;
      };

      class HostScene extends Phaser.Scene {
        phase: "intro" | "greet" | "seat" | "banquet" | "end" = "intro";
        guests: GuestNode[] = [];
        promptText!: Phaser.GameObjects.Text;
        phaseText!: Phaser.GameObjects.Text;
        chipText!: Phaser.GameObjects.Text;

        // 一幕 · 迎宾
        bowing: GuestNode | null = null;
        bowUI: Phaser.GameObjects.Container | null = null;
        charging = false;
        depth = 0;
        depthDir = 1;
        gaugeG!: Phaser.GameObjects.Graphics;
        hostAvatar!: Phaser.GameObjects.Container;
        bows: { guest: string; verdict: string; score: number }[] = [];
        orderHits = 0;
        orderTotal = 0;

        // 二幕 · 安席
        seats: { x: number; y: number; label: string; marker: Phaser.GameObjects.Container }[] = [];
        seatScore = 0;
        seatBtn: Phaser.GameObjects.Container | null = null;

        // 三幕 · 席间
        banquetStartMs = 0;
        liveEvents: LiveEvent[] = [];
        eventResults: { label: string; verdict: string; score: number }[] = [];
        overActs = 0;
        eventCursor = 0;
        timerG!: Phaser.GameObjects.Graphics;
        banquetDone = false;

        constructor() {
          super("li-host");
        }

        create() {
          this.cameras.main.setBackgroundColor("#f6efe2");
          this.drawBackdrop();
          this.drawChrome();
          this.spawnGuests();
          this.input.on("pointerup", this.releaseBow, this);
          this.showIntro();
        }

        // ── 场景基础 ────────────────────────────────────────────

        drawBackdrop() {
          const g = this.add.graphics();
          g.fillGradientStyle(0xfbf6ea, 0xfbf6ea, 0xf0e6d0, 0xe9dcc2, 1);
          g.fillRect(0, 0, W, H);
          // 地席
          g.fillStyle(0xdcc9a3, 0.55);
          g.fillEllipse(470, 360, 640, 300);
          g.lineStyle(2, 0xb49560, 0.5);
          g.strokeEllipse(470, 360, 640, 300);
          // 屏风
          g.fillStyle(0x8c5a2b, 0.16);
          for (let i = 0; i < 4; i += 1) g.fillRoundedRect(320 + i * 82, 96, 72, 96, 6);
          g.lineStyle(1, 0x8c5a2b, 0.35);
          for (let i = 0; i < 4; i += 1) g.strokeRoundedRect(320 + i * 82, 96, 72, 96, 6);
          // 门（右侧）
          g.fillStyle(0x7c2d12, 0.75);
          g.fillRoundedRect(896, 160, 12, 330, 4);
          g.fillStyle(0x7c2d12, 0.3);
          g.fillRoundedRect(848, 150, 60, 10, 4);
        }

        drawChrome() {
          this.add.text(28, 18, `执礼 · ${cfg.title}`, {
            fontFamily: "Georgia, 'Songti SC', serif", fontSize: "26px", color: "#24170f",
          });
          this.add.text(28, 52, cfg.place, {
            fontFamily: "Arial, sans-serif", fontSize: "13px", color: "#854F0B",
          });
          this.phaseText = this.add.text(W - 28, 22, "", {
            fontFamily: "Georgia, 'Songti SC', serif", fontSize: "18px", color: "#993C1D",
          }).setOrigin(1, 0);
          this.chipText = this.add.text(W - 28, 50, "", {
            fontFamily: "Arial, sans-serif", fontSize: "12px", color: "#5f5148",
          }).setOrigin(1, 0);
          const bar = this.add.graphics().setDepth(40);
          bar.fillStyle(0x24170f, 0.82);
          bar.fillRoundedRect(24, H - 66, W - 48, 46, 12);
          this.promptText = this.add.text(W / 2, H - 43, "", {
            fontFamily: "Arial, sans-serif", fontSize: "15px", color: "#fdf6e3",
            wordWrap: { width: W - 110 }, align: "center",
          }).setOrigin(0.5).setDepth(41);
        }

        setPrompt(s: string) {
          this.promptText.setText(s);
        }

        setChips() {
          const parts: string[] = [];
          if (this.bows.length > 0) parts.push(`敬 ${this.bowAvg()}`);
          if (this.phase === "banquet" || this.phase === "end") parts.push(`序 ${this.xuScore()}`);
          if (this.overActs > 0) parts.push(`殷勤过度 ×${this.overActs}`);
          this.chipText.setText(parts.join(" · "));
        }

        banner(text: string, cb?: () => void) {
          const c = this.add.container(W / 2, 300).setDepth(80).setAlpha(0);
          const g = this.add.graphics();
          g.fillStyle(0x24170f, 0.88);
          g.fillRoundedRect(-230, -44, 460, 88, 14);
          const t = this.add.text(0, 0, text, {
            fontFamily: "Georgia, 'Songti SC', serif", fontSize: "26px", color: "#fdf6e3", align: "center",
          }).setOrigin(0.5);
          c.add([g, t]);
          this.tweens.add({
            targets: c, alpha: 1, duration: 240, hold: 950, yoyo: true,
            onComplete: () => { c.destroy(); cb?.(); },
          });
        }

        toast(x: number, y: number, text: string, color = "#993C1D") {
          const t = this.add.text(x, y, text, {
            fontFamily: "Arial, sans-serif", fontSize: "15px", color,
            stroke: "#fdf6e3", strokeThickness: 4, fontStyle: "bold",
          }).setOrigin(0.5).setDepth(90);
          this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
        }

        // ── 人物 ────────────────────────────────────────────────

        makePerson(color: number, name: string, rank: Rank | null): Phaser.GameObjects.Container {
          const c = this.add.container(0, 0);
          const shadow = this.add.ellipse(0, 44, 56, 16, 0x000000, 0.16);
          const robe = this.add.graphics();
          robe.fillStyle(color, 1);
          robe.fillRoundedRect(-24, -14, 48, 56, { tl: 22, tr: 22, bl: 8, br: 8 });
          robe.fillStyle(0xffffff, 0.9);
          robe.fillTriangle(-9, -12, 9, -12, 0, 8);
          const head = this.add.circle(0, -30, 17, 0xf6d4b8, 1);
          const hair = this.add.ellipse(0, -40, 30, 16, 0x111827, 1);
          const eyeL = this.add.circle(-6, -31, 2, 0x111827, 1);
          const eyeR = this.add.circle(6, -31, 2, 0x111827, 1);
          const label = this.add.text(0, 58, name, {
            fontFamily: "Arial, sans-serif", fontSize: "12px", color: "#24170f",
            backgroundColor: "rgba(253,246,227,0.9)", padding: { x: 6, y: 2 },
          }).setOrigin(0.5);
          c.add([shadow, robe, head, hair, eyeL, eyeR, label]);
          if (rank) {
            const meta = RANK_META[rank];
            const badge = this.add.text(0, -62, meta.label, {
              fontFamily: "Arial, sans-serif", fontSize: "11px", color: "#ffffff",
              backgroundColor: meta.color, padding: { x: 7, y: 2 },
            }).setOrigin(0.5);
            c.add(badge);
          }
          return c;
        }

        spawnGuests() {
          const startY = 200;
          this.guests = cfg.guests.map((g, i) => {
            const node = this.makePerson(g.color, g.name, g.rank);
            node.setPosition(W + 60, startY + i * 88);
            node.setSize(96, 130);
            node.setDepth(node.y);
            return { cfg: g, node, greeted: false, seatIdx: null, homeX: 840, homeY: startY + i * 88 };
          });
        }

        // ── 序幕 ────────────────────────────────────────────────

        showIntro() {
          this.phase = "intro";
          this.phaseText.setText("开场");
          const c = this.add.container(0, 0).setDepth(100);
          const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x24170f, 0.62).setInteractive();
          const g = this.add.graphics();
          g.fillStyle(0xfdf6e3, 0.98);
          g.fillRoundedRect(W / 2 - 300, 130, 600, 350, 16);
          const title = this.add.text(W / 2, 172, `${cfg.title} · ${cfg.subtitle}`, {
            fontFamily: "Georgia, 'Songti SC', serif", fontSize: "26px", color: "#993C1D",
          }).setOrigin(0.5);
          const intro = this.add.text(W / 2, 240, cfg.intro, {
            fontFamily: "Arial, sans-serif", fontSize: "16px", color: "#3f2f22",
            wordWrap: { width: 520 }, align: "center", lineSpacing: 8,
          }).setOrigin(0.5, 0);
          const tip = this.add.text(W / 2, 330, `要诀：${cfg.tip}`, {
            fontFamily: "Arial, sans-serif", fontSize: "13px", color: "#854F0B",
            wordWrap: { width: 520 }, align: "center", lineSpacing: 6,
          }).setOrigin(0.5, 0);
          const btn = this.makeButton(W / 2, 432, 180, 48, "入 场", () => {
            c.destroy();
            this.startGreet();
          });
          c.add([dim, g, title, intro, tip, ...btn]);
        }

        makeButton(
          x: number, y: number, w: number, h: number, label: string, cb: () => void, color = 0x993c1d,
        ): Phaser.GameObjects.GameObject[] {
          const box = this.add.rectangle(x, y, w, h, color, 1).setStrokeStyle(2, 0x24170f, 0.25);
          const t = this.add.text(x, y, label, {
            fontFamily: "Georgia, 'Songti SC', serif", fontSize: "19px", color: "#fdf6e3",
          }).setOrigin(0.5);
          box.setInteractive({ useHandCursor: true });
          box.on("pointerover", () => box.setScale(1.04));
          box.on("pointerout", () => box.setScale(1));
          box.on("pointerdown", () => cb());
          return [box, t];
        }

        // ── 一幕 · 迎宾 ─────────────────────────────────────────

        startGreet() {
          this.phase = "greet";
          this.phaseText.setText("一幕 · 迎宾");
          this.orderTotal = this.guests.length;
          this.banner("宾客将至 · 依礼迎之", () => {
            this.setPrompt("点选此刻最当先迎的宾客（先尊后卑），再按住「作揖」蓄力行礼。");
          });
          // 宾客走到门口列队
          this.guests.forEach((g, i) => {
            this.tweens.add({
              targets: g.node, x: g.homeX, y: g.homeY, duration: 700 + i * 180, ease: "Sine.easeOut",
              onUpdate: () => g.node.setDepth(g.node.y),
            });
            g.node.setInteractive({ useHandCursor: true });
            g.node.on("pointerdown", () => this.pickGuestToGreet(g));
          });
          // 主人（你）
          this.hostAvatar = this.makePerson(0x475569, "你 · 主人", null);
          this.hostAvatar.setPosition(620, 330).setDepth(330);
        }

        pickGuestToGreet(g: GuestNode) {
          if (this.phase !== "greet" || this.bowing || g.greeted) return;
          // 顺序判定：此刻未迎宾客中的最高身份
          const remainMax = Math.max(
            ...this.guests.filter((x) => !x.greeted).map((x) => RANK_META[x.cfg.rank].priority),
          );
          const ok = RANK_META[g.cfg.rank].priority >= remainMax;
          if (ok) {
            this.orderHits += 1;
            this.toast(g.node.x, g.node.y - 84, "先后得宜", "#0F6E56");
          } else {
            this.toast(g.node.x, g.node.y - 84, "失了先后", "#993C1D");
          }
          this.bowing = g;
          this.depth = 0;
          this.depthDir = 1;
          // 宾客上前，与主人对面
          this.tweens.add({ targets: g.node, x: 700, y: 330, duration: 450, ease: "Sine.easeInOut" });
          this.tweens.add({ targets: this.hostAvatar, x: 560, y: 330, duration: 450 });
          this.showBowUI(g);
        }

        showBowUI(g: GuestNode) {
          const meta = RANK_META[g.cfg.rank];
          const zoneW = g.cfg.zoneW ?? cfg.zoneW;
          const ui = this.add.container(0, 0).setDepth(70);
          this.bowUI = ui;

          const panel = this.add.graphics();
          panel.fillStyle(0xfdf6e3, 0.96);
          panel.fillRoundedRect(60, 130, 300, 400, 14);
          panel.lineStyle(2, 0x854f0b, 0.4);
          panel.strokeRoundedRect(60, 130, 300, 400, 14);
          const title = this.add.text(210, 152, `向${meta.label}行揖礼`, {
            fontFamily: "Georgia, 'Songti SC', serif", fontSize: "19px", color: "#24170f",
          }).setOrigin(0.5);
          const note = this.add.text(210, 178, g.cfg.note, {
            fontFamily: "Arial, sans-serif", fontSize: "12px", color: "#854F0B",
          }).setOrigin(0.5);

          // 量表轨道
          const track = this.add.graphics();
          const tx = 130; const ty = 205; const th = 250;
          track.fillStyle(0xe9dcc2, 1);
          track.fillRoundedRect(tx - 11, ty, 22, th, 10);
          // 中礼区间
          const zc = meta.depth;
          track.fillStyle(0xc9a24b, 0.85);
          track.fillRoundedRect(tx - 11, ty + (zc - zoneW) * th, 22, zoneW * 2 * th, 8);
          const zoneLabel = this.add.text(tx + 22, ty + zc * th, "中礼", {
            fontFamily: "Arial, sans-serif", fontSize: "12px", color: "#854F0B",
          }).setOrigin(0, 0.5);
          const shallowLabel = this.add.text(tx + 22, ty + 8, "浅 · 近慢", {
            fontFamily: "Arial, sans-serif", fontSize: "11px", color: "#9c8b74",
          }).setOrigin(0, 0.5);
          const deepLabel = this.add.text(tx + 22, ty + th - 8, "深 · 近谄", {
            fontFamily: "Arial, sans-serif", fontSize: "11px", color: "#9c8b74",
          }).setOrigin(0, 0.5);

          this.gaugeG = this.add.graphics();

          const hold = this.add.rectangle(210, 492, 240, 54, 0x993c1d, 1).setStrokeStyle(2, 0x24170f, 0.25);
          const holdT = this.add.text(210, 492, "按住 作揖 · 松手定深浅", {
            fontFamily: "Georgia, 'Songti SC', serif", fontSize: "17px", color: "#fdf6e3",
          }).setOrigin(0.5);
          hold.setInteractive({ useHandCursor: true });
          hold.on("pointerdown", () => { this.charging = true; });

          ui.add([panel, title, note, track, zoneLabel, shallowLabel, deepLabel, this.gaugeG, hold, holdT]);
          this.setPrompt(`对${meta.label}行礼：${meta.label === "长者" || meta.label === "贵宾" ? "宜深" : meta.label === "平辈" ? "宜中" : "宜浅"}。按住蓄力，松手即揖。`);
        }

        releaseBow() {
          if (!this.charging || !this.bowing) return;
          this.charging = false;
          const g = this.bowing;
          const meta = RANK_META[g.cfg.rank];
          const zoneW = g.cfg.zoneW ?? cfg.zoneW;
          const dist = Math.abs(this.depth - meta.depth);
          let score: number;
          let verdict: string;
          if (dist <= zoneW) {
            score = Math.round(100 - (dist / zoneW) * 25);
            verdict = "揖让得宜";
          } else if (this.depth > meta.depth) {
            score = Math.round(clamp(70 - (dist - zoneW) * 240, 5, 69));
            verdict = "过恭近谄";
          } else {
            score = Math.round(clamp(70 - (dist - zoneW) * 240, 5, 69));
            verdict = "失之轻慢";
          }
          this.bows.push({ guest: g.cfg.name, verdict, score });

          // 主人躬身动画（深度映射角度）
          this.tweens.add({
            targets: this.hostAvatar, angle: 14 + this.depth * 46, duration: 260, yoyo: true, hold: 320,
            ease: "Sine.easeInOut",
          });
          this.tweens.add({
            targets: g.node, angle: 10 + meta.depth * 30, duration: 260, yoyo: true, hold: 320, delay: 140,
          });
          this.toast(430, 300, `${verdict} ${score}`, score >= 70 ? "#0F6E56" : "#993C1D");

          g.greeted = true;
          this.time.delayedCall(750, () => {
            // 宾客入内等待（左侧）
            const idx = this.guests.filter((x) => x.greeted).length - 1;
            const wx = 150; const wy = 210 + idx * 92;
            this.tweens.add({
              targets: g.node, x: wx, y: wy, duration: 620, ease: "Sine.easeInOut",
              onUpdate: () => g.node.setDepth(g.node.y),
            });
            g.homeX = wx; g.homeY = wy;
            this.bowUI?.destroy();
            this.bowUI = null;
            this.bowing = null;
            this.setChips();
            const left = this.guests.filter((x) => !x.greeted).length;
            if (left > 0) {
              this.setPrompt(`还有 ${left} 位宾客在门外。此刻当先迎谁？`);
            } else {
              this.time.delayedCall(600, () => this.startSeat());
            }
          });
        }

        bowAvg(): number {
          if (this.bows.length === 0) return 0;
          return Math.round(this.bows.reduce((a, b) => a + b.score, 0) / this.bows.length);
        }

        orderScore(): number {
          return this.orderTotal === 0 ? 0 : Math.round((this.orderHits / this.orderTotal) * 100);
        }

        xuScore(): number {
          return Math.round(0.5 * this.orderScore() + 0.5 * this.seatScore);
        }

        // ── 二幕 · 安席 ─────────────────────────────────────────

        seatLayout(): { x: number; y: number }[] {
          if (this.guests.length <= 3) {
            return [{ x: 470, y: 216 }, { x: 320, y: 350 }, { x: 620, y: 350 }];
          }
          return [{ x: 470, y: 210 }, { x: 316, y: 330 }, { x: 624, y: 330 }, { x: 470, y: 452 }];
        }

        startSeat() {
          this.phase = "seat";
          this.phaseText.setText("二幕 · 安席");
          this.hostAvatar.setPosition(820, 420);
          this.banner("宾已入门 · 请安其席", () => {
            this.setPrompt("把宾客拖到合乎位次的席位——长者贵宾宜居尊位。全部安坐后开席。");
          });

          const seatNames = ["尊位", "次位", "三位", "末位"].slice(0, this.guests.length);
          const layout = this.seatLayout();
          // 桌案
          const table = this.add.graphics().setDepth(20);
          table.fillStyle(0x8c5a2b, 0.8);
          table.fillEllipse(470, 332, 220, 110);
          table.fillStyle(0xfdf6e3, 0.25);
          table.fillEllipse(470, 326, 190, 88);

          this.seats = layout.map((p, i) => {
            const marker = this.add.container(p.x, p.y).setDepth(21);
            const ring = this.add.circle(0, 0, 40, 0xc9a24b, 0.22).setStrokeStyle(2, 0x854f0b, 0.6);
            const t = this.add.text(0, 0, seatNames[i], {
              fontFamily: "Georgia, 'Songti SC', serif", fontSize: "15px", color: "#854F0B",
            }).setOrigin(0.5);
            marker.add([ring, t]);
            return { x: p.x, y: p.y, label: seatNames[i], marker };
          });

          // 宾客可拖拽
          this.guests.forEach((g) => {
            g.node.removeAllListeners("pointerdown");
            this.input.setDraggable(g.node.setInteractive({ useHandCursor: true }), true);
          });
          this.input.on("drag", (_p: unknown, obj: Phaser.GameObjects.Container, dx: number, dy: number) => {
            obj.x = clamp(dx, 60, 900);
            obj.y = clamp(dy, 170, 500);
            obj.setDepth(1000);
          });
          this.input.on("dragend", (_p: unknown, obj: Phaser.GameObjects.Container) => {
            const g = this.guests.find((x) => x.node === obj);
            if (g) this.dropGuest(g);
          });

          const btn = this.makeButton(820, 520, 150, 46, "开 席", () => {
            if (this.guests.some((x) => x.seatIdx === null)) {
              this.toast(820, 480, "尚有宾客未安坐", "#993C1D");
              return;
            }
            this.confirmSeats();
          }, 0x854f0b);
          this.seatBtn = this.add.container(0, 0, btn as Phaser.GameObjects.GameObject[]).setDepth(60);
        }

        dropGuest(g: GuestNode) {
          // 找最近空席（80px 内）
          let best = -1; let bestD = 80;
          this.seats.forEach((s, i) => {
            if (this.guests.some((x) => x !== g && x.seatIdx === i)) return;
            const d = Math.hypot(g.node.x - s.x, g.node.y - s.y);
            if (d < bestD) { best = i; bestD = d; }
          });
          if (best >= 0) {
            g.seatIdx = best;
            this.tweens.add({ targets: g.node, x: this.seats[best].x, y: this.seats[best].y - 26, duration: 180 });
            g.node.setDepth(this.seats[best].y);
          } else {
            g.seatIdx = null;
            this.tweens.add({ targets: g.node, x: g.homeX, y: g.homeY, duration: 260 });
            g.node.setDepth(g.homeY);
          }
        }

        confirmSeats() {
          // 期望：席位 i 上应坐第 i 高身份（同身份可互换）
          const sorted = [...this.guests].sort(
            (a, b) => RANK_META[b.cfg.rank].priority - RANK_META[a.cfg.rank].priority,
          );
          let correct = 0;
          this.guests.forEach((g) => {
            if (g.seatIdx === null) return;
            const expected = RANK_META[sorted[g.seatIdx].cfg.rank].priority;
            if (RANK_META[g.cfg.rank].priority === expected) correct += 1;
          });
          this.seatScore = Math.round((correct / this.guests.length) * 100);
          this.guests.forEach((g) => {
            this.input.setDraggable(g.node, false);
          });
          this.input.removeAllListeners("drag");
          this.input.removeAllListeners("dragend");
          this.seatBtn?.destroy();
          this.seatBtn = null;
          this.setChips();
          this.toast(470, 300, `位次 ${this.seatScore === 100 ? "尽合于礼" : this.seatScore >= 50 ? "略有出入" : "多有颠倒"}`, this.seatScore >= 75 ? "#0F6E56" : "#993C1D");
          this.time.delayedCall(900, () => this.startBanquet());
        }

        // ── 三幕 · 席间 ─────────────────────────────────────────

        startBanquet() {
          this.phase = "banquet";
          this.phaseText.setText("三幕 · 席间");
          this.banner("开席 · 观其所需，应之以时", () => {
            this.setPrompt("事件出现时，在金色时机圈内点按宾客最得体；无事频频打扰，反失于「节」。");
          });
          this.banquetStartMs = this.time.now;
          this.eventCursor = 0;
          this.timerG = this.add.graphics().setDepth(45);
          // 宾客点按
          this.guests.forEach((g) => {
            g.node.removeAllListeners("pointerdown");
            g.node.setInteractive({ useHandCursor: true });
            g.node.on("pointerdown", () => this.tapGuest(g));
          });
        }

        tapGuest(g: GuestNode) {
          if (this.phase !== "banquet") return;
          const ev = this.liveEvents.find((e) => !e.resolved && e.guest === g);
          if (!ev) {
            this.overActs += 1;
            this.toast(g.node.x, g.node.y - 84, "过度殷勤 · 失于节", "#993C1D");
            this.setChips();
            return;
          }
          const t = (this.time.now - ev.startMs) / (ev.cfg.duration * 1000);
          const [w0, w1] = ev.cfg.window;
          let score: number; let verdict: string;
          if (t < w0) {
            score = 55; verdict = "太急则躁";
          } else if (t <= w1) {
            const mid = (w0 + w1) / 2;
            const off = Math.abs(t - mid) / ((w1 - w0) / 2);
            score = Math.round(100 - off * 15);
            verdict = "恰到好处";
          } else {
            score = 70; verdict = "稍迟了些";
          }
          this.resolveEvent(ev, score, verdict);
        }

        resolveEvent(ev: LiveEvent, score: number, verdict: string) {
          ev.resolved = true;
          this.eventResults.push({ label: ev.cfg.label, verdict, score });
          this.toast(ev.guest.node.x, ev.guest.node.y - 92, `${verdict} ${score}`, score >= 80 ? "#0F6E56" : score >= 55 ? "#854F0B" : "#993C1D");
          this.tweens.add({
            targets: ev.bubble, alpha: 0, scale: 0.6, duration: 220,
            onComplete: () => { ev.bubble.destroy(); ev.ring.destroy(); },
          });
        }

        spawnEvent(e: LiHostEventCfg) {
          const g = this.guests.find((x) => x.cfg.id === e.guest);
          if (!g) return;
          const bubble = this.add.container(g.node.x, g.node.y - 96).setDepth(75);
          const bg = this.add.graphics();
          bg.fillStyle(0xfdf6e3, 0.97);
          bg.fillRoundedRect(-72, -26, 144, 52, 12);
          bg.lineStyle(2, 0x993c1d, 0.5);
          bg.strokeRoundedRect(-72, -26, 144, 52, 12);
          const icon = this.add.text(-52, 0, e.icon, { fontSize: "22px" }).setOrigin(0.5);
          const label = this.add.text(8, 0, e.label, {
            fontFamily: "Arial, sans-serif", fontSize: "12px", color: "#3f2f22",
            wordWrap: { width: 104 }, align: "center",
          }).setOrigin(0.5);
          bubble.add([bg, icon, label]);
          bubble.setScale(0.4).setAlpha(0);
          this.tweens.add({ targets: bubble, scale: 1, alpha: 1, duration: 200, ease: "Back.easeOut" });
          const ring = this.add.graphics().setDepth(76);
          this.liveEvents.push({ cfg: e, guest: g, bubble, ring, startMs: this.time.now, resolved: false });
        }

        jieScore(): number {
          const avg = this.eventResults.length
            ? this.eventResults.reduce((a, b) => a + b.score, 0) / this.eventResults.length
            : 0;
          return Math.round(clamp(avg - this.overActs * 6, 0, 100));
        }

        finishRound() {
          if (this.phase === "end") return;
          this.phase = "end";
          this.phaseText.setText("礼成");
          const jing = this.bowAvg();
          const xu = this.xuScore();
          const jie = this.jieScore();
          const detail: LiHostRoundDetail = {
            bowAvg: jing,
            orderScore: this.orderScore(),
            seatScore: this.seatScore,
            eventAvg: this.eventResults.length
              ? Math.round(this.eventResults.reduce((a, b) => a + b.score, 0) / this.eventResults.length)
              : 0,
            overActs: this.overActs,
            bows: this.bows,
            events: this.eventResults,
          };
          const c = this.add.container(0, 0).setDepth(120);
          const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x24170f, 0.66).setInteractive();
          const g = this.add.graphics();
          g.fillStyle(0xfdf6e3, 0.98);
          g.fillRoundedRect(W / 2 - 260, 150, 520, 320, 16);
          const title = this.add.text(W / 2, 192, "宾主尽欢 · 礼成", {
            fontFamily: "Georgia, 'Songti SC', serif", fontSize: "28px", color: "#993C1D",
          }).setOrigin(0.5);
          const rows = [
            `敬 ${jing} — 揖礼深浅`,
            `序 ${xu} — 迎宾先后 ${detail.orderScore} · 席位 ${detail.seatScore}`,
            `节 ${jie} — 时机 ${detail.eventAvg}${this.overActs ? ` · 殷勤过度 ×${this.overActs}` : ""}`,
          ];
          const body = this.add.text(W / 2, 240, rows.join("\n"), {
            fontFamily: "Arial, sans-serif", fontSize: "17px", color: "#3f2f22",
            align: "center", lineSpacing: 14,
          }).setOrigin(0.5, 0);
          const btn = this.makeButton(W / 2, 412, 190, 48, "查看结算", () => {
            onFinishRef.current({ jing, xu, jie }, detail);
          });
          c.add([dim, g, title, body, ...btn]);
        }

        // ── 主循环 ──────────────────────────────────────────────

        update(time: number, delta: number) {
          // 揖礼蓄力（往复：过犹不及）
          if (this.phase === "greet" && this.bowing) {
            if (this.charging) {
              this.depth += this.depthDir * cfg.gaugeSpeed * (delta / 1000);
              if (this.depth >= 1) { this.depth = 1; this.depthDir = -1; }
              if (this.depth <= 0) { this.depth = 0; this.depthDir = 1; }
            }
            if (this.gaugeG) {
              const tx = 130; const ty = 205; const th = 250;
              this.gaugeG.clear();
              // 已蓄深度
              this.gaugeG.fillStyle(0x993c1d, 0.85);
              this.gaugeG.fillRoundedRect(tx - 7, ty, 14, Math.max(6, this.depth * th), 7);
              // 指针
              this.gaugeG.fillStyle(0x24170f, 1);
              this.gaugeG.fillRect(tx - 16, ty + this.depth * th - 2, 32, 4);
            }
          }

          // 席间：计时、事件生成、超时、时机圈
          if (this.phase === "banquet") {
            const elapsed = (time - this.banquetStartMs) / 1000;
            // 生成
            while (this.eventCursor < cfg.events.length && cfg.events[this.eventCursor].at <= elapsed) {
              this.spawnEvent(cfg.events[this.eventCursor]);
              this.eventCursor += 1;
            }
            // 时机圈 + 超时
            this.liveEvents.forEach((ev) => {
              if (ev.resolved) return;
              const t = (time - ev.startMs) / (ev.cfg.duration * 1000);
              if (t >= 1) {
                this.resolveEvent(ev, 30, "怠慢了");
                return;
              }
              const [w0, w1] = ev.cfg.window;
              const inWindow = t >= w0 && t <= w1;
              ev.ring.clear();
              ev.ring.lineStyle(5, inWindow ? 0xc9a24b : 0x9c8b74, 0.95);
              ev.ring.beginPath();
              ev.ring.arc(ev.guest.node.x, ev.guest.node.y - 30, 52, -Math.PI / 2, -Math.PI / 2 + (1 - t) * Math.PI * 2);
              ev.ring.strokePath();
              if (inWindow) {
                ev.ring.lineStyle(2, 0xc9a24b, 0.6);
                ev.ring.strokeCircle(ev.guest.node.x, ev.guest.node.y - 30, 60);
              }
            });
            // 计时条
            const frac = clamp(elapsed / cfg.banquetSeconds, 0, 1);
            this.timerG.clear();
            this.timerG.fillStyle(0xe9dcc2, 0.9);
            this.timerG.fillRoundedRect(280, 96, 400, 10, 5);
            this.timerG.fillStyle(0x993c1d, 0.9);
            this.timerG.fillRoundedRect(280, 96, 400 * (1 - frac), 10, 5);
            // 结束：时间到且事件全部处理
            if (elapsed >= cfg.banquetSeconds && !this.banquetDone) {
              const pending = this.liveEvents.filter((e) => !e.resolved);
              pending.forEach((e) => this.resolveEvent(e, 30, "怠慢了"));
              this.banquetDone = true;
              this.time.delayedCall(700, () => this.finishRound());
            }
          }
        }
      }

      gameRef.current?.destroy(true);
      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: W,
        height: H,
        backgroundColor: "#f6efe2",
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: HostScene,
      });
    }

    boot();

    return () => {
      mounted = false;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [scenarioKey]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => onExitRef.current()} className="text-xs text-faint hover:text-accent">
          ← 退出本局
        </button>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">
          执礼 · 宾至如归
        </span>
      </div>
      <div className="rounded-lg border border-line bg-surface p-3">
        <div ref={hostRef} className="h-[min(72vw,640px)] min-h-[420px] w-full overflow-hidden rounded-md bg-[#f6efe2]" />
      </div>
    </div>
  );
}
