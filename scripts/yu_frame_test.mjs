// 快速取景检查：选第一张卡 → 加速到 ~8 m/s → 截图
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9341;
const URL = process.env.YU_URL ?? "http://localhost:7100/journey/yu";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader",
  `--remote-debugging-port=${PORT}`, "--window-size=700,460",
  "--user-data-dir=/tmp/yu_frame_profile", URL,
], { stdio: "ignore" });

let ws, msgId = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
}
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true });
  return r.result?.value;
}

async function main() {
  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === "page" && t.url.includes("/journey/yu"));
      if (target) break;
    } catch {}
  }
  if (!target) throw new Error("找不到页面");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  };
  await send("Page.enable");
  await sleep(6000);

  const card = await evalJs(`(() => {
    const b = [...document.querySelectorAll("button")].find(x => x.innerText.includes("m/s"));
    if (!b) return null; b.scrollIntoView({block:"center"});
    const r = b.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  })()`);
  if (!card) throw new Error("无场景卡");
  const { x, y } = JSON.parse(card);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await sleep(60);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
  await sleep(2500);

  // 巡航到 ~8 m/s 保持
  let holding = false;
  for (let i = 0; i < 120; i++) {
    const v = await evalJs(`(() => {
      const el = [...document.querySelectorAll("span")].find(s => s.nextSibling?.textContent?.includes("m/s"));
      return el ? parseFloat(el.textContent) : -1;
    })()`);
    if (v >= 0) {
      if (v < 7.8 && !holding) { await send("Input.dispatchKeyEvent", { type: "keyDown", code: "ArrowUp", key: "ArrowUp" }); holding = true; }
      else if (v > 8.4 && holding) { await send("Input.dispatchKeyEvent", { type: "keyUp", code: "ArrowUp", key: "ArrowUp" }); holding = false; }
    }
    if (i === 50) {
      const r = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync("/tmp/yu_frame.png", Buffer.from(r.data, "base64"));
      console.log("已截图, 速度", v);
    }
    await sleep(250);
  }
  if (holding) await send("Input.dispatchKeyEvent", { type: "keyUp", code: "ArrowUp", key: "ArrowUp" });
}
main().catch((e) => { console.error("FAIL:", e.message); process.exitCode = 1; })
  .finally(() => { try { ws?.close(); } catch {} chrome.kill("SIGKILL"); });
