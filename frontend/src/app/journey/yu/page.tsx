"use client";

/**
 * 御艺·五御 2D 俯视驾车
 *
 * 操作：
 *   桌面：← → 调位置，↑ 油门，↓ 刹车，Space = 礼（鞠躬/停车）
 *   手机：屏幕左侧位置滑块，右侧速度滑块，底部「礼」按钮
 *
 * 系统每帧前进：y += speed * dt
 * 收集 trajectory（每 ~150ms 采样）+ events（关键动作时间戳）
 * 到达终点 → 提交后端三维评分
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { driveYuScenario, getYuProgress, getYuToday } from "@/lib/api";
import type {
  YuDriveResp,
  YuEvent,
  YuObstacle,
  YuProgressResp,
  YuRefBrief,
  YuTodayResp,
  YuTrajectoryPoint,
} from "@/lib/types";

const CANVAS_W = 360;       // 内部画布宽
const CANVAS_H = 540;       // 内部画布高
const ROAD_W = 160;         // 道路宽度
const CAR_LEN = 20;
const CAR_W = 14;
const MAX_SPEED = 14;       // m/s 上限
const ACC = 8;              // 加速度 m/s²
const BRK = 18;             // 刹车减速度 m/s²
const FRICTION = 1.2;       // 自然减速
const LATERAL_SPEED = 80;   // 横向移动像素/秒
const PX_PER_M = 4;         // 1m = 4 像素（道路 y 方向）

const KIND_COLOR: Record<string, string> = {
  mingheluan: "#854F0B",
  zhushui: "#0F6E56",
  junbiao: "#993C1D",
  jiaoqu: "#1E5F8E",
  qinzuo: "#534AB7",
};

type Phase = "idle" | "playing" | "submitting" | "scored";

export default function YuJourneyPage() {
  const [today, setToday] = useState<YuTodayResp | null>(null);
  const [progress, setProgress] = useState<YuProgressResp | null>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<YuDriveResp | null>(null);
  const [err, setErr] = useState("");
  const [hud, setHud] = useState({ speed: 0, progressY: 0, totalY: 600, elapsed: 0, beatIdx: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    car: { x: 0, y: 0, speed: 0 },
    keys: { left: false, right: false, up: false, down: false, space: false },
    trajectory: [] as YuTrajectoryPoint[],
    events: [] as YuEvent[],
    startedAt: 0,
    lastSample: 0,
    nextBeatIdx: 0,
    triggeredPedestrians: new Set<number>(),
    passedJunbiao: new Set<number>(),
    chasedDeer: new Set<number>(),
    finished: false,
  });

  useEffect(() => {
    getYuToday().then(setToday).catch(() => setErr("无法加载乐题 — 请先登录"));
    getYuProgress().then(setProgress).catch(() => {});
  }, []);

  const current = today?.scenarios[idx];

  const resetState = useCallback(() => {
    if (!current) return;
    stateRef.current = {
      car: { x: 0, y: 0, speed: 0 },
      keys: { left: false, right: false, up: false, down: false, space: false },
      trajectory: [],
      events: [],
      startedAt: 0,
      lastSample: 0,
      nextBeatIdx: 0,
      triggeredPedestrians: new Set(),
      passedJunbiao: new Set(),
      chasedDeer: new Set(),
      finished: false,
    };
    setResult(null);
    setHud({
      speed: 0, progressY: 0,
      totalY: current.road_config?.length || 600,
      elapsed: 0, beatIdx: 0,
    });
  }, [current]);

  useEffect(() => {
    if (current) resetState();
  }, [current?.id, resetState]);

  // 键盘事件
  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = stateRef.current.keys;
      if (e.key === "ArrowLeft") k.left = down;
      else if (e.key === "ArrowRight") k.right = down;
      else if (e.key === "ArrowUp") k.up = down;
      else if (e.key === "ArrowDown") k.down = down;
      else if (e.key === " ") {
        if (down && !k.space && phase === "playing") {
          // 单次按下记 li 事件
          stateRef.current.events.push({
            t: performance.now() - stateRef.current.startedAt,
            type: "li",
          });
        }
        k.space = down;
        e.preventDefault();
      }
    };
    const dn = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, [phase]);

  // 渲染 + 物理循环
  useEffect(() => {
    if (phase !== "playing" || !current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    let raf = 0;
    let lastT = performance.now();
    stateRef.current.startedAt = lastT;

    const roadCfg = current.road_config || { type: "straight", length: 600, obstacles: [] };
    const obstacles: YuObstacle[] = roadCfg.obstacles || [];
    const beats: number[] = roadCfg.beats || [];
    const curves = roadCfg.curves || [];

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const elapsed = now - stateRef.current.startedAt;
      const car = stateRef.current.car;
      const k = stateRef.current.keys;
      const prevSpeed = car.speed;

      // 纵向：油门 / 刹车 / 自然减速
      if (k.up) car.speed += ACC * dt;
      else if (k.down) car.speed -= BRK * dt;
      else car.speed -= FRICTION * dt;
      car.speed = Math.max(0, Math.min(MAX_SPEED, car.speed));
      car.y += car.speed * dt;   // 米

      // 急刹判定（速度突降 >5 m/s 在 1 frame）
      if (prevSpeed - car.speed > 5 * dt * 60) {
        stateRef.current.events.push({ t: elapsed, type: "hard_brake" });
      }
      // 超速
      if (car.speed > current.target_speed * 1.5) {
        const last = stateRef.current.events[stateRef.current.events.length - 1];
        if (!last || last.type !== "overspeed" || elapsed - last.t > 2000) {
          stateRef.current.events.push({ t: elapsed, type: "overspeed" });
        }
      }

      // 横向：左右键
      if (k.left) car.x -= (LATERAL_SPEED / PX_PER_M) * dt;
      if (k.right) car.x += (LATERAL_SPEED / PX_PER_M) * dt;
      // 限制不能跑出路面（道路宽 = ROAD_W / PX_PER_M 米）
      const maxX = (ROAD_W / PX_PER_M) / 2 - (CAR_W / PX_PER_M);
      car.x = Math.max(-maxX, Math.min(maxX, car.x));

      // 弯道渲染：在渲染时按 worldY 现算偏移，物理判定简化（不在此处处理 swerve）

      // 节拍命中（beats 是按目标时间到 beats[i] 秒时玩家应正好到 y = i*段长）
      while (
        stateRef.current.nextBeatIdx < beats.length &&
        elapsed / 1000 >= beats[stateRef.current.nextBeatIdx]
      ) {
        const i = stateRef.current.nextBeatIdx;
        const expectedY = ((i + 1) / (beats.length + 1)) * (roadCfg.length || 600);
        // 偏差 ≤ 30m 算命中
        if (Math.abs(car.y - expectedY) <= 30) {
          stateRef.current.events.push({ t: elapsed, type: "beat_hit" });
        }
        stateRef.current.nextBeatIdx = i + 1;
        setHud((h) => ({ ...h, beatIdx: i + 1 }));
      }

      // 障碍物判定
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (o.type === "junbiao") {
          // 经过君表（y ± 5m）
          if (!stateRef.current.passedJunbiao.has(i) && Math.abs(car.y - o.y) < 5) {
            // 君表附近车速 < 4 算礼让通过
            if (car.speed < 4) {
              stateRef.current.events.push({ t: elapsed, type: "junbiao_pass" });
              stateRef.current.passedJunbiao.add(i);
            }
          }
        } else if (o.type === "pedestrian") {
          // 触发点：到 trigger_y 时行人开始过马路
          const trigY = o.trigger_y ?? (o.y - 50);
          if (!stateRef.current.triggeredPedestrians.has(i) && car.y >= trigY) {
            stateRef.current.triggeredPedestrians.add(i);
          }
          // 行人到 y == o.y 时，车要停下来（speed < 1）
          if (stateRef.current.triggeredPedestrians.has(i)) {
            if (Math.abs(car.y - o.y) < 15) {
              if (car.speed < 1) {
                if (!stateRef.current.events.some(
                  (e) => e.type === "pedestrian_yield" && e.meta?.idx === i
                )) {
                  stateRef.current.events.push({
                    t: elapsed, type: "pedestrian_yield", meta: { idx: i },
                  });
                }
              } else if (car.speed > 3) {
                // 超速过 = 撞行人
                if (!stateRef.current.events.some(
                  (e) => e.type === "hit_pedestrian" && e.meta?.idx === i
                )) {
                  stateRef.current.events.push({
                    t: elapsed, type: "hit_pedestrian", meta: { idx: i },
                  });
                }
              }
            }
          }
        } else if (o.type === "deer") {
          // 见鹿（y < deer.y - 30 时鹿在屏幕上）
          // 玩家如果"追"它（x 偏左 > 1m）= chase
          if (Math.abs(car.y - o.y) < 80) {
            if (!stateRef.current.chasedDeer.has(i) && car.x < -1) {
              stateRef.current.events.push({
                t: elapsed, type: "chase", meta: { idx: i },
              });
              stateRef.current.chasedDeer.add(i);
            }
          }
        }
      }

      // 采样 trajectory
      if (now - stateRef.current.lastSample > 150) {
        stateRef.current.trajectory.push({
          t: Math.round(elapsed),
          x: Number(car.x.toFixed(2)),
          y: Number(car.y.toFixed(2)),
          speed: Number(car.speed.toFixed(2)),
        });
        stateRef.current.lastSample = now;
      }

      // 终点
      if (car.y >= (roadCfg.length || 600) && !stateRef.current.finished) {
        stateRef.current.finished = true;
        cancelAnimationFrame(raf);
        submit();
        return;
      }
      // 超时
      if (elapsed > current.target_duration_ms + 8000 && !stateRef.current.finished) {
        stateRef.current.finished = true;
        cancelAnimationFrame(raf);
        submit();
        return;
      }

      // ─── 渲染 ─────────────────────────────────────────
      const roadLength = roadCfg.length || 600;
      const cameraY = car.y - (CANVAS_H / PX_PER_M) * 0.7;

      // 1) 天空 + 远山（背景）— 渐变更柔和
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H * 0.6);
      skyGrad.addColorStop(0, "#e4dfc5");
      skyGrad.addColorStop(1, "#d5cfb5");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // 远山剪影（深浅两层）
      ctx.fillStyle = "rgba(140, 152, 145, 0.45)";
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H * 0.32);
      ctx.lineTo(60, CANVAS_H * 0.18);
      ctx.lineTo(140, CANVAS_H * 0.28);
      ctx.lineTo(220, CANVAS_H * 0.16);
      ctx.lineTo(300, CANVAS_H * 0.26);
      ctx.lineTo(CANVAS_W, CANVAS_H * 0.20);
      ctx.lineTo(CANVAS_W, CANVAS_H * 0.42);
      ctx.lineTo(0, CANVAS_H * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(122, 132, 124, 0.55)";
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H * 0.40);
      ctx.lineTo(80, CANVAS_H * 0.28);
      ctx.lineTo(180, CANVAS_H * 0.36);
      ctx.lineTo(280, CANVAS_H * 0.24);
      ctx.lineTo(CANVAS_W, CANVAS_H * 0.34);
      ctx.lineTo(CANVAS_W, CANVAS_H * 0.46);
      ctx.lineTo(0, CANVAS_H * 0.46);
      ctx.closePath();
      ctx.fill();
      // 飘动浮云（按 elapsed 慢漂）
      const cloudX = ((elapsed / 80) % (CANVAS_W + 100)) - 60;
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.beginPath();
      ctx.ellipse(cloudX, 40, 28, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cloudX + 200, 70, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2) 草地（两侧绿色）
      ctx.fillStyle = "#a8b88e";
      ctx.fillRect(0, CANVAS_H * 0.42, CANVAS_W, CANVAS_H * 0.58);
      // 草地小点（伪纹理）
      ctx.fillStyle = "rgba(122, 142, 102, 0.4)";
      for (let i = 0; i < 30; i++) {
        const gx = (i * 37 + (Math.floor(cameraY * 4) % 100)) % CANVAS_W;
        const gy = CANVAS_H * 0.42 + ((i * 53) % (CANVAS_H * 0.58));
        ctx.fillRect(gx, gy, 2, 2);
      }

      // 3) 道路（带中央虚线 + 路缘）— 一次性多边形画
      const segs: { worldY: number; screenY: number; center: number }[] = [];
      for (let yp = -8; yp < CANVAS_H + 8; yp += 4) {
        const worldY = cameraY + (CANVAS_H - yp) / PX_PER_M;
        if (worldY < -10 || worldY > roadLength + 10) continue;
        let center = 0;
        for (const c of curves) {
          if (worldY >= c.start && worldY <= c.end) {
            const t = (worldY - c.start) / (c.end - c.start);
            center = c.offset * Math.sin(t * Math.PI);
            break;
          }
        }
        segs.push({ worldY, screenY: yp, center });
      }
      // 道路本体（深棕渐变）
      for (const s of segs) {
        const left = CANVAS_W / 2 + s.center - ROAD_W / 2;
        ctx.fillStyle = "#6b5d4a";
        ctx.fillRect(left, s.screenY, ROAD_W, 4);
        // 路面纹理（每 8 米一条浅色横线）
        if (Math.floor(s.worldY) % 8 === 0) {
          ctx.fillStyle = "rgba(255, 240, 200, 0.06)";
          ctx.fillRect(left + 6, s.screenY + 1, ROAD_W - 12, 2);
        }
      }
      // 左右路缘（米色厚边）
      for (const s of segs) {
        const left = CANVAS_W / 2 + s.center - ROAD_W / 2;
        ctx.fillStyle = "#e8e0c8";
        ctx.fillRect(left - 2, s.screenY, 4, 4);
        ctx.fillRect(left + ROAD_W - 2, s.screenY, 4, 4);
      }
      // 中央虚线（每 16 米一段，长 8 米）
      for (const s of segs) {
        const phase = Math.floor(s.worldY) % 16;
        if (phase < 8) {
          ctx.fillStyle = "rgba(245, 240, 220, 0.6)";
          ctx.fillRect(CANVAS_W / 2 + s.center - 1.5, s.screenY, 3, 4);
        }
      }

      // 4) 节拍坎（彩色弧门）
      for (let i = 0; i < beats.length; i++) {
        const expectedY = ((i + 1) / (beats.length + 1)) * roadLength;
        const screenY = CANVAS_H - (expectedY - cameraY) * PX_PER_M;
        if (screenY < -20 || screenY > CANVAS_H + 20) continue;
        let center = 0;
        for (const c of curves) {
          if (expectedY >= c.start && expectedY <= c.end) {
            const t = (expectedY - c.start) / (c.end - c.start);
            center = c.offset * Math.sin(t * Math.PI);
            break;
          }
        }
        const passed = i < stateRef.current.nextBeatIdx;
        const hit = passed && stateRef.current.events.some(
          (e) => e.type === "beat_hit" && Math.abs(e.t / 1000 - beats[i]) < 0.5,
        );
        const color = passed ? (hit ? "#10b981" : "#dc2626") : "#fbbf24";
        // 弧形门（横向半椭圆）
        const cx = CANVAS_W / 2 + center;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, screenY, ROAD_W / 2 - 6, 10, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        // 命中时加白色光晕
        if (hit) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.ellipse(cx, screenY, ROAD_W / 2 - 6, 10, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        // 节拍编号小字
        ctx.fillStyle = color;
        ctx.font = "10px serif";
        ctx.textAlign = "center";
        ctx.fillText(`♩${i + 1}`, cx, screenY - 14);
      }

      // 5) 障碍物
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        const screenY = CANVAS_H - (o.y - cameraY) * PX_PER_M;
        if (screenY < -50 || screenY > CANVAS_H + 50) continue;
        // 取该 worldY 的车道偏移
        let center = 0;
        for (const c of curves) {
          if (o.y >= c.start && o.y <= c.end) {
            const t = (o.y - c.start) / (c.end - c.start);
            center = c.offset * Math.sin(t * Math.PI);
            break;
          }
        }
        const cx = CANVAS_W / 2 + center + (o.x || 0);
        if (o.type === "junbiao") {
          // 红木柱 + 金色横牌
          // 阴影
          ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
          ctx.beginPath();
          ctx.ellipse(cx, screenY + 4, 14, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          // 柱身（红木色 + 渐变）
          const pillar = ctx.createLinearGradient(cx - 5, 0, cx + 5, 0);
          pillar.addColorStop(0, "#7c2d12");
          pillar.addColorStop(0.5, "#b91c1c");
          pillar.addColorStop(1, "#7c2d12");
          ctx.fillStyle = pillar;
          ctx.fillRect(cx - 4, screenY - 38, 8, 38);
          // 顶部金色横牌
          ctx.fillStyle = "#d4a017";
          ctx.fillRect(cx - 14, screenY - 50, 28, 14);
          ctx.fillStyle = "#7c2d12";
          ctx.fillRect(cx - 14, screenY - 50, 28, 2);
          ctx.fillRect(cx - 14, screenY - 38, 28, 2);
          // 顶上"君"字
          ctx.fillStyle = "#7c2d12";
          ctx.font = "bold 11px serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("君", cx, screenY - 43);
          ctx.textBaseline = "alphabetic";
        } else if (o.type === "pedestrian") {
          // 行人 x：触发后从左往右穿越
          let px = -ROAD_W / 2 - 20;
          if (stateRef.current.triggeredPedestrians.has(i)) {
            const progress = Math.min(1, (car.y - (o.trigger_y ?? o.y - 50)) / 80);
            px = -ROAD_W / 2 - 20 + progress * (ROAD_W + 40);
          }
          // 阴影
          ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
          ctx.beginPath();
          ctx.ellipse(cx + px, screenY + 8, 8, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          // 行人 emoji
          ctx.font = "22px serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🚶", cx + px, screenY);
          ctx.textBaseline = "alphabetic";
        } else if (o.type === "deer") {
          // 鹿（左侧），随时间小幅抖动表示逃跑
          const ox = (o.x || 0) - Math.sin(elapsed / 200) * 3;
          ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
          ctx.beginPath();
          ctx.ellipse(cx + ox, screenY + 8, 10, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "24px serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🦌", cx + ox, screenY);
          ctx.textBaseline = "alphabetic";
        }
      }

      // 6) 车（俯视马车样式）
      const carScreenX = CANVAS_W / 2 + car.x * PX_PER_M;
      const carScreenY = CANVAS_H - (car.y - cameraY) * PX_PER_M;
      // 车阴影
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.beginPath();
      ctx.ellipse(carScreenX + 2, carScreenY + 14, CAR_W, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // 前马（两匹）
      ctx.fillStyle = "#8a6a4a";
      ctx.fillRect(carScreenX - 7, carScreenY - 22, 4, 8);   // 左马
      ctx.fillRect(carScreenX + 3, carScreenY - 22, 4, 8);   // 右马
      ctx.fillStyle = "#5a3a1a";
      ctx.fillRect(carScreenX - 7, carScreenY - 24, 4, 2);   // 左马头
      ctx.fillRect(carScreenX + 3, carScreenY - 24, 4, 2);   // 右马头
      // 缰绳（深棕细线）
      ctx.strokeStyle = "#3a2a1a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(carScreenX - 5, carScreenY - 14);
      ctx.lineTo(carScreenX - 4, carScreenY - 8);
      ctx.moveTo(carScreenX + 5, carScreenY - 14);
      ctx.lineTo(carScreenX + 4, carScreenY - 8);
      ctx.stroke();
      // 车厢（木色矩形）
      ctx.fillStyle = "#7c5a36";
      ctx.fillRect(carScreenX - CAR_W / 2, carScreenY - CAR_LEN / 2, CAR_W, CAR_LEN);
      // 朱红顶棚（覆盖车厢上面 2/3）
      const topGrad = ctx.createLinearGradient(carScreenX - CAR_W / 2, 0, carScreenX + CAR_W / 2, 0);
      topGrad.addColorStop(0, "#7f1d1d");
      topGrad.addColorStop(0.5, "#dc2626");
      topGrad.addColorStop(1, "#7f1d1d");
      ctx.fillStyle = topGrad;
      ctx.fillRect(carScreenX - CAR_W / 2 + 1, carScreenY - CAR_LEN / 2 + 2, CAR_W - 2, CAR_LEN - 8);
      // 车轮（左右黑色圆）
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(carScreenX - CAR_W / 2 - 2, carScreenY, 3, 0, Math.PI * 2);
      ctx.arc(carScreenX + CAR_W / 2 + 2, carScreenY, 3, 0, Math.PI * 2);
      ctx.fill();
      // 车轮辐条（小白点）
      ctx.fillStyle = "#9ca3af";
      ctx.fillRect(carScreenX - CAR_W / 2 - 2, carScreenY - 0.5, 1, 1);
      ctx.fillRect(carScreenX + CAR_W / 2 + 1, carScreenY - 0.5, 1, 1);
      // 前部铜铃（金色小点，按节奏闪烁）
      const bellOn = Math.floor(elapsed / 250) % 2 === 0;
      ctx.fillStyle = bellOn ? "#fde047" : "#ca8a04";
      ctx.beginPath();
      ctx.arc(carScreenX, carScreenY - CAR_LEN / 2 - 1, 2, 0, Math.PI * 2);
      ctx.fill();

      // HUD
      setHud((h) => ({
        ...h,
        speed: Number(car.speed.toFixed(1)),
        progressY: Number(car.y.toFixed(0)),
        elapsed: Math.round(elapsed),
      }));

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current?.id]);

  const submit = async () => {
    if (!current) return;
    setPhase("submitting");
    try {
      const r = await driveYuScenario(
        current.id,
        stateRef.current.trajectory,
        stateRef.current.events,
      );
      setResult(r);
      setPhase("scored");
      getYuProgress().then(setProgress).catch(() => {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "提交失败");
      setPhase("idle");
    }
  };

  const start = () => {
    resetState();
    setPhase("playing");
  };

  const onNext = () => {
    if (!today) return;
    setIdx((i) => (i < today.scenarios.length - 1 ? i + 1 : 0));
    setPhase("idle");
  };

  // 触屏按钮控制
  const touchKey = (key: "left" | "right" | "up" | "down" | "space", down: boolean) => {
    if (phase !== "playing") return;
    const k = stateRef.current.keys;
    if (key === "space" && down && !k.space) {
      stateRef.current.events.push({
        t: performance.now() - stateRef.current.startedAt,
        type: "li",
      });
    }
    k[key] = down;
  };

  if (err) return <div className="rounded-2xl bg-accent-soft p-6 text-sm text-accent">{err}</div>;
  if (!today || !current) return <div className="skeleton h-60 w-full rounded-2xl" />;

  return (
    <div className="space-y-4">
      {/* HUD */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-widest text-accent">六艺 · 御</div>
            <div className="font-serif text-lg text-fg">五御 · 礼以行之</div>
            <div className="mt-1 text-[10px] text-muted">
              非赛车 — 节奏、礼让、节制三者皆备方为善御
            </div>
          </div>
          {progress && (
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <Stat label="称号" value={progress.title} />
              <Stat label="御艺" value={`${progress.liuyi_yu}`} />
              <Stat label="驭过" value={`${progress.played_count}/${progress.total_scenarios}`} />
              <Stat label="最高" value={`${progress.best_score}`} />
            </div>
          )}
          <Link
            href="/journey"
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:bg-surface-2"
          >
            ← 六艺
          </Link>
        </div>
      </section>

      {/* 场景 + 主区 */}
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="rounded-xl px-3 py-2" style={{ background: `${KIND_COLOR[current.kind]}1a` }}>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: KIND_COLOR[current.kind] }}>
              {idx + 1}/{today.scenarios.length}
            </div>
            <div className="mt-0.5 font-serif text-lg" style={{ color: KIND_COLOR[current.kind] }}>
              {current.title}
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm text-fg">{current.setting}</p>
            <p className="text-[11px] text-muted">💡 {current.hint}</p>
          </div>
        </div>

        {/* Canvas 主区 */}
        <div className="relative mx-auto" style={{ width: CANVAS_W, maxWidth: "100%" }}>
          <canvas
            ref={canvasRef}
            className="block w-full rounded-xl border-2 border-line bg-surface-2"
            style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, touchAction: "none" }}
          />

          {/* HUD overlay */}
          {phase === "playing" && (
            <div className="pointer-events-none absolute left-2 right-2 top-2 flex justify-between text-[11px] text-white">
              <div className="rounded bg-black/55 px-2 py-1 backdrop-blur">
                速度 {hud.speed} m/s · 目标 {current.target_speed}
              </div>
              <div className="rounded bg-black/55 px-2 py-1 backdrop-blur">
                {hud.progressY}/{hud.totalY} m · {(hud.elapsed / 1000).toFixed(1)}s
              </div>
            </div>
          )}

          {/* 启动 overlay */}
          {phase === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/55 text-white backdrop-blur">
              <div className="font-serif text-xl">{current.title}</div>
              <div className="mt-1 text-xs opacity-80">{current.kind_label}</div>
              <div className="mt-3 max-w-[280px] text-center text-[11px] opacity-80">
                桌面：← → 调位 · ↑ 油门 · ↓ 刹车 · Space 礼<br/>
                手机：用底部按钮
              </div>
              <button
                onClick={start}
                className="mt-4 rounded-full bg-accent px-6 py-2 text-sm hover:opacity-90"
              >
                ▶ 起驾
              </button>
            </div>
          )}

          {phase === "submitting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white backdrop-blur">
              <div className="text-sm">评驭中…</div>
            </div>
          )}
        </div>

        {/* 触屏操作（仅 playing 显示）*/}
        {phase === "playing" && (
          <div className="grid grid-cols-5 gap-2 sm:hidden">
            <TouchBtn onDown={() => touchKey("left", true)} onUp={() => touchKey("left", false)}>←</TouchBtn>
            <TouchBtn onDown={() => touchKey("up", true)} onUp={() => touchKey("up", false)}>↑</TouchBtn>
            <TouchBtn onDown={() => touchKey("down", true)} onUp={() => touchKey("down", false)}>↓</TouchBtn>
            <TouchBtn onDown={() => touchKey("right", true)} onUp={() => touchKey("right", false)}>→</TouchBtn>
            <TouchBtn onDown={() => touchKey("space", true)} onUp={() => touchKey("space", false)} accent>礼</TouchBtn>
          </div>
        )}
      </section>

      {/* 评分卡 */}
      {result && (
        <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/70 p-4">
            <div className="flex items-baseline gap-3">
              <span
                className="font-serif leading-none"
                style={{ fontSize: "3.5rem", color: gradeColor(result.grade) }}
              >
                {result.score}
              </span>
              <span className="text-xs text-muted">/ 100</span>
              <span
                className="rounded-full px-3 py-1 text-sm text-white"
                style={{ background: gradeColor(result.grade) }}
              >
                {result.grade}
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <MetricBar label="节（节奏稳）" value={result.jie} color={gradeColor(result.grade)} />
              <MetricBar label="让（礼让到位）" value={result.rang} color={gradeColor(result.grade)} />
              <MetricBar label="不极（不急不躁）" value={result.buji} color={gradeColor(result.grade)} />
            </div>
          </div>

          <div className="mb-3 text-sm font-medium text-emerald-900">
            御艺 +{result.yu_delta} · xp +{result.xp_delta}
          </div>

          {/* 详细统计 */}
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg bg-white/70 p-3 text-[11px] sm:grid-cols-4">
            <Stat2 label="平均速度" value={`${result.stats.avg_speed} m/s`} />
            <Stat2 label="节拍命中" value={`${result.stats.beat_hits}/${result.stats.beats_total}`} />
            <Stat2 label="过君表" value={`${result.stats.junbiao_passes} ·礼 ${result.stats.li_count}`} />
            <Stat2 label="让行人" value={`${result.stats.pedestrian_yields}${result.stats.hit_pedestrian > 0 ? ` · 撞 ${result.stats.hit_pedestrian}` : ""}`} ill={result.stats.hit_pedestrian > 0} />
            <Stat2 label="急刹" value={`${result.stats.hard_brakes}`} ill={result.stats.hard_brakes > 2} />
            <Stat2 label="超速" value={`${result.stats.overspeeds}`} ill={result.stats.overspeeds > 0} />
            <Stat2 label="追禽" value={`${result.stats.chase_attempts}`} ill={result.stats.chase_attempts > 0} />
            <Stat2 label="速度方差" value={`${result.stats.speed_std}`} />
          </div>

          {/* 解锁经典 */}
          {result.new_unlocked_refs.length > 0 ? (
            <div className="mt-3 rounded-lg border border-gold bg-amber-50 p-3">
              <div className="mb-1 text-[10px] tracking-widest text-amber-700">🎖 新解锁经典</div>
              {result.new_unlocked_refs.map((r: YuRefBrief) => (
                <div key={r.ref_id} className="mt-1 border-l-2 border-amber-500 pl-2 text-sm text-amber-900">
                  <div className="text-[10px] opacity-70">{r.ref_label}</div>
                  <div className="font-serif">{r.text}</div>
                </div>
              ))}
            </div>
          ) : result.refs.length > 0 ? (
            <div className="mt-3 rounded-lg border border-line bg-surface-2/30 p-3">
              <div className="mb-1 text-[10px] tracking-widest text-faint">关联经典</div>
              {result.refs.map((r) => (
                <div key={r.ref_id} className="mt-1 text-xs">
                  <span className="text-faint">{r.ref_label}：</span>
                  <span className="font-serif text-fg">{r.text}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={start}
              className="rounded-full border border-line bg-surface-2 px-5 py-2 text-sm text-muted hover:bg-surface"
            >
              再驾一次
            </button>
            <button
              onClick={onNext}
              className="rounded-full bg-accent px-6 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              下一场景 →
            </button>
          </div>
        </section>
      )}

      {/* 场景一览 */}
      {progress && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 text-sm font-medium text-fg">御艺进境 · 五御一览</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {progress.scenarios.map((s) => (
              <div
                key={s.id}
                className={`rounded-lg border p-2 text-center text-xs ${
                  s.answered ? "border-gold bg-accent-soft" : "border-line bg-surface-2/40 text-faint"
                }`}
                title={s.setting}
              >
                <div className="font-serif text-sm text-fg">{s.title}</div>
                <div className="mt-0.5 text-[10px] text-muted">{s.kind_label}</div>
                <div className="mt-0.5 text-[10px]">
                  {s.answered ? `🏅 最高 ${s.best_score}` : "未驾"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-1">
      <div className="text-[10px] text-faint">{label}</div>
      <div className="font-serif text-sm text-fg">{value}</div>
    </div>
  );
}
function Stat2({ label, value, ill }: { label: string; value: string; ill?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${ill ? "bg-rose-50" : "bg-surface-2/30"}`}>
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`font-serif text-xs ${ill ? "text-rose-700" : "text-fg"}`}>{value}</div>
    </div>
  );
}
function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="min-w-[180px]">
      <div className="mb-0.5 flex justify-between text-[10px] text-muted">
        <span>{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
function TouchBtn({
  children, onDown, onUp, accent,
}: {
  children: React.ReactNode;
  onDown: () => void;
  onUp: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      onPointerUp={(e) => { e.preventDefault(); onUp(); }}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
      className={`select-none rounded-lg py-3 text-lg font-medium ${
        accent
          ? "bg-rose-500 text-white active:bg-rose-600"
          : "bg-surface-2 text-fg active:bg-accent-soft"
      }`}
      style={{ touchAction: "manipulation" }}
    >
      {children}
    </button>
  );
}
function gradeColor(grade: string): string {
  switch (grade) {
    case "神驭": return "#b45309";
    case "妙驭": return "#0F6E56";
    case "中驭": return "#1E5F8E";
    case "试驭": return "#534AB7";
    default:     return "#737373";
  }
}
