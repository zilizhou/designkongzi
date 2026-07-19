/** 御艺·五御 — WebAudio 合成音效（无外部资源）
 *
 *   update(speed)  马蹄声四步节奏 + 风噪，速度驱动（每帧调用）
 *   beatChime(ok)  节拍门：合拍 = 鸾铃清响，错过 = 低哑
 *   junbiao()      过君表（缓行致礼）一声钟
 *   li()           按「礼」— 揖礼磬音
 *   yieldOk()      让行人成功
 *   hitPed()       撞到行人（闷响 + 下行音）
 *   deer()         鹿鸣奔逃
 *   hardBrake()    急刹（噪声刮擦）
 *   overspeed()    超速提示
 *   finish(grade)  冲线凯旋（按评级给不同明亮度）
 */

let ctx: AudioContext | null = null;
let windSrc: AudioBufferSourceNode | null = null;
let windGain: GainNode | null = null;
let hoofTimer: ReturnType<typeof setInterval> | null = null;
let hoofStep = 0;
let lastSpeed = 0;

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as AudioWindow).webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) ctx = new Ctx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(
  freq: number,
  dur = 0.08,
  type: OscillatorType = "sine",
  vol = 0.05,
  when = 0,
  slideTo?: number,
) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noiseBurst(dur = 0.12, vol = 0.05, low = 400, high = 2000, when = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = (low + high) / 2;
  f.Q.value = 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

// ── 持续层：马蹄 + 风噪（每帧以速度驱动） ──
export function update(speed: number, running: boolean) {
  const c = ac();
  if (!c) return;
  lastSpeed = speed;

  // 风噪
  if (running && !windSrc) {
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) {
      v = v * 0.98 + (Math.random() * 2 - 1) * 0.02; // 棕色噪声
      d[i] = v * 8;
    }
    windSrc = c.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 600;
    windGain = c.createGain();
    windGain.gain.value = 0;
    windSrc.connect(f).connect(windGain).connect(c.destination);
    windSrc.start();
  }
  if (windGain) {
    const target = running ? Math.min(0.05, speed * 0.005) : 0;
    windGain.gain.setTargetAtTime(target, c.currentTime, 0.2);
  }
  if (!running && windSrc) {
    windGain?.gain.setTargetAtTime(0, c.currentTime, 0.15);
    const src = windSrc;
    setTimeout(() => { try { src.stop(); } catch { /* noop */ } }, 600);
    windSrc = null;
    windGain = null;
  }

  // 马蹄（四步一轮：哒-哒-哒-哒，节奏随速度）
  if (running && speed > 1 && !hoofTimer) {
    const schedule = () => {
      const s = lastSpeed;
      if (s <= 1) return;
      const pat = [0, 0.16, 0.34, 0.5]; // 四蹄错位
      const cycle = Math.max(0.34, 0.85 - s * 0.035);
      const base = hoofStep % 4;
      const freq = base % 2 === 0 ? 150 + s * 3 : 110 + s * 2;
      tone(freq, 0.05, "square", 0.014);
      noiseBurst(0.03, 0.012, 800, 2600);
      hoofStep++;
      // 下一击
      const nextIn = (pat[(hoofStep % 4)] || cycle) * 0 + cycle * (base === 3 ? 1.25 : 0.62);
      hoofTimer = setTimeout(schedule, nextIn * 1000);
    };
    hoofTimer = setTimeout(schedule, 0);
  } else if ((!running || speed <= 1) && hoofTimer) {
    clearTimeout(hoofTimer);
    hoofTimer = null;
  }
}

export function stopAll() {
  if (hoofTimer) { clearTimeout(hoofTimer); hoofTimer = null; }
  if (windSrc) { try { windSrc.stop(); } catch { /* noop */ } windSrc = null; windGain = null; }
}

// ── 事件音 ──
export const beatChime = (ok: boolean) => {
  if (ok) {
    tone(880, 0.16, "sine", 0.06);
    tone(1320, 0.22, "sine", 0.045, 0.05);
    tone(1760, 0.3, "sine", 0.03, 0.1);
  } else {
    tone(185, 0.16, "sawtooth", 0.03);
  }
};

export const junbiao = () => {
  tone(392, 0.5, "sine", 0.055); // 钟
  tone(588, 0.4, "sine", 0.03, 0.02);
};

export const li = () => {
  tone(660, 0.18, "triangle", 0.05);
  tone(990, 0.24, "sine", 0.03, 0.06);
};

export const yieldOk = () => {
  tone(523, 0.12, "triangle", 0.045);
  tone(784, 0.18, "triangle", 0.04, 0.08);
};

export const hitPed = () => {
  noiseBurst(0.2, 0.09, 150, 700);
  tone(160, 0.35, "sawtooth", 0.05, 0, 70);
};

export const deer = () => {
  tone(1200, 0.12, "sine", 0.03);
  tone(1500, 0.1, "sine", 0.025, 0.09);
};

export const hardBrake = () => noiseBurst(0.28, 0.06, 900, 3400);

export const overspeed = () => {
  tone(440, 0.09, "square", 0.03);
  tone(440, 0.09, "square", 0.03, 0.14);
};

export function finish(score: number) {
  const bright = score >= 75;
  const base = bright ? [523, 659, 784, 1047] : score >= 40 ? [440, 554, 659] : [330, 392];
  base.forEach((f, i) => tone(f, 0.35, "triangle", 0.055, i * 0.13));
  if (bright) tone(1319, 0.6, "sine", 0.05, base.length * 0.13);
}
