#!/usr/bin/env node
// Ad automation runner. Keep this running (or under pm2 / cron) alongside the app:
//   node scripts/ad-auto.mjs
// It polls the app's automation configs and fires due runs (per each config's dailyCount).
// The app (next dev / next start) must be running and reachable at BASE_URL.
//
// Env: BASE_URL (default http://localhost:3000), POLL_MS (default 300000 = 5 min).

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const POLL_MS = Number(process.env.POLL_MS || 5 * 60 * 1000);

const log = (...a) => console.log(new Date().toISOString(), ...a);

function isDue(c, now) {
  if (!c.enabled) return false;
  const interval = 86_400_000 / c.dailyCount;
  if (!c.lastRunAt) return true;
  return now - new Date(c.lastRunAt).getTime() >= interval;
}

async function tick() {
  let configs;
  try {
    const res = await fetch(`${BASE_URL}/api/ad/automation`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    configs = (await res.json()).configs ?? [];
  } catch (e) {
    log("설정 조회 실패 (앱이 실행 중인가요?):", e.message);
    return;
  }
  const due = configs.filter((c) => isDue(c, Date.now()));
  if (!due.length) {
    log(`대기 — 설정 ${configs.length}개, 실행 대상 없음`);
    return;
  }
  for (const c of due) {
    log(`실행 시작: "${c.name}" (${c.id})`);
    try {
      const res = await fetch(`${BASE_URL}/api/ad/automation/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId: c.id }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d?.error?.message || `HTTP ${res.status}`);
      const r = d.result;
      log(`완료: "${c.name}" → ${r.projectId} | 주제="${r.topic}" | 단계=${r.steps.join(",")}` + (r.renderPath ? ` | 렌더=${r.renderPath}` : "") + (r.warnings?.length ? ` | 경고 ${r.warnings.length}건` : ""));
    } catch (e) {
      log(`실패: "${c.name}":`, e.message);
    }
  }
}

log(`ad-auto 러너 시작 — ${BASE_URL}, ${Math.round(POLL_MS / 1000)}s 간격`);
// self-scheduling loop — the next tick is armed only after the previous one fully
// finishes, so a long run (compose+images+TTS+render can exceed POLL_MS) can never
// overlap with the next tick and double-fire the same config.
for (;;) {
  try {
    await tick();
  } catch (e) {
    log("tick 오류:", e.message);
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
