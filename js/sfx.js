// 소리를 파일 없이 WebAudio 로 만든다. 저작권도 용량도 안 든다.
// 개 소리는 "톱니 배음 + 잡음"에 봉투를 씌우고 피치를 훑어서 만든다.

const RATE = 22050;

let ctx = null;
const cache = new Map();
let muted = localStorage.getItem('dulli_muted') === '1';

export const isMuted = () => muted;

export function setMuted(v) {
  muted = v;
  localStorage.setItem('dulli_muted', v ? '1' : '0');
}

/** 브라우저는 유저가 한 번 만지기 전까지 소리를 막는다. 아무 조작에서나 풀어 준다. */
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function play(name, volume = 1) {
  if (muted) return;
  unlock();
  if (!ctx) return;

  let buf = null, rate = 1;

  const rec = SAMPLES[name];
  if (rec && samples.has(rec[0])) {
    buf = samples.get(rec[0]);
    // 같은 소리가 똑같이 반복되면 티가 나니 조금씩 흔든다
    rate = rec[1] * (0.94 + Math.random() * 0.12);
  } else {
    buf = get(name);
  }
  if (!buf) return;

  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
  src.buffer = buf;
  src.playbackRate.value = rate;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

/**
 * 진짜 개 소리 녹음을 쓰는 것들.
 * 값은 [파일, 재생속도] — 같은 녹음을 빠르게 돌려 새끼 소리로도 쓴다.
 * 여기 없는 것은 코드로 만든 소리로 간다.
 */
const SAMPLES = {
  bark: ['bark.wav', 1.0],
  bark_low: ['growl.wav', 1.0],
  yip: ['bark.wav', 1.45],      // 같은 짖음을 높여 새끼 소리로
  pant: ['pant.wav', 1.0],
};

const samples = new Map();   // 이름 → AudioBuffer

/** 녹음 파일을 미리 받아 둔다. 없으면 조용히 넘어간다. */
export async function preload() {
  unlock();
  if (!ctx) return;
  const files = [...new Set(Object.values(SAMPLES).map(v => v[0]))];
  await Promise.all(files.map(async (f) => {
    if (samples.has(f)) return;
    try {
      const r = await fetch('sfx/cut/' + f);
      if (!r.ok) return;
      samples.set(f, await ctx.decodeAudioData(await r.arrayBuffer()));
    } catch (e) { /* 없으면 합성으로 간다 */ }
  }));
}

function get(name) {
  if (cache.has(name)) return cache.get(name);
  const data = build(name);
  if (!data) return null;
  const buf = ctx.createBuffer(1, data.length, RATE);
  buf.getChannelData(0).set(data);
  cache.set(name, buf);
  return buf;
}

// ── 만드는 도구 ───────────────────────────────────────────

const rnd = () => Math.random() * 2 - 1;

function finish(d) {
  // 끝을 살짝 죽여 딱 소리가 안 나게
  const tail = Math.min(220, d.length);
  for (let i = 0; i < tail; i++) d[d.length - 1 - i] *= i / tail;
  return d;
}

function env(t, dur, attack, decay) {
  if (t < attack) return t / Math.max(1e-4, attack);
  const k = (t - attack) / Math.max(1e-4, dur - attack);
  return Math.pow(1 - Math.min(1, Math.max(0, k)), decay);
}

/** 톱니에 가까운 배음 더미. 개 소리의 거친 느낌을 낸다. */
function growlish(phase, harmonics) {
  let v = 0;
  for (let h = 1; h <= harmonics; h++) v += Math.sin(phase * h) / h;
  return v * 0.5;
}

function build(name) {
  switch (name) {
    case 'bark': return bark(1);
    case 'bark_low': return bark(0.62);
    case 'yip': return bark(1.5, 1);
    case 'whine': return whine();
    case 'howl': return howl();
    case 'pant': return pant();
    case 'eat': return crunch();
    case 'lap': return lap();
    case 'snore': return snore();
    case 'sneeze': return sneeze();
    case 'yawn': return yawn();
    case 'tail': return tail();
    case 'ding': return ding(880, 0.35);
    case 'dong': return ding(420, 0.45);
    case 'sad': return sad();
    case 'coin': return coin();
    case 'pop': return pop();
  }
  return null;
}

// ── 개 소리 ───────────────────────────────────────────────

/**
 * 멍멍.
 * 배음만 쌓으면 웅웅거려서 개 소리가 안 난다. 진짜 짖는 소리는
 *   ① 컥 하고 터지는 잡음(입이 열리는 소리)
 *   ② 성대가 내는 거친 배음, 피치가 확 올랐다 떨어짐
 *   ③ 목과 입이 만드는 공명 두 개(포먼트)
 * 이 셋이 겹쳐야 한다. 여기서는 2극 공명기를 손으로 돌려 ③을 만든다.
 */
function bark(pitch, count = 2) {
  const one = 0.20, gap = 0.13;
  const n = Math.ceil((one * count + gap * (count - 1) + 0.06) * RATE);
  const d = new Float32Array(n);

  for (let b = 0; b < count; b++) {
    const start = Math.round(b * (one + gap) * RATE);
    // 두 번째는 살짝 낮고 짧게 — 같은 소리 반복이 아니게
    const basef = 300 * pitch * (b === 0 ? 1 : 0.88);
    const len = Math.floor(one * (b === 0 ? 1 : 0.86) * RATE);

    // 포먼트 두 개. 개는 사람보다 낮고 넓다.
    const F = [
      reson(520 * Math.pow(pitch, 0.35), 190),
      reson(1350 * Math.pow(pitch, 0.25), 420),
    ];

    let phase = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / RATE;

      // ② 성대 — 짖을 때 피치가 확 올랐다 떨어진다
      const f = basef * (1 + 0.85 * Math.exp(-t * 55)) * (1 - 0.35 * (t / one));
      phase += 2 * Math.PI * f / RATE;
      // 톱니에 가깝게(거칠게) + 배음마다 조금씩 흔들어 생기를 준다
      let src = 0;
      for (let h = 1; h <= 9; h++) src += Math.sin(phase * h + h * 0.3) / h;
      src *= 0.5;

      // ① 터지는 잡음 — 앞 25ms 에만
      const burst = Math.exp(-t * 150) * 0.9;
      src += rnd() * burst;
      // 숨 섞임
      src += rnd() * 0.12 * Math.exp(-t * 12);

      // ③ 공명 두 개를 통과
      const v = F[0](src) * 1.0 + F[1](src) * 0.55;

      // 봉투 — 아주 빠르게 붙고 빠르게 떨어진다
      const e = env(t, one, 0.004, 3.2);
      d[start + i] += v * e * 0.5;
    }
  }
  return normalize(d, 0.85);
}

/** 2극 공명기 하나. 넣으면 그 주파수만 울려서 나온다. */
function reson(freq, bw) {
  const r = Math.exp(-Math.PI * bw / RATE);
  const theta = 2 * Math.PI * freq / RATE;
  const b1 = 2 * r * Math.cos(theta);
  const b2 = -r * r;
  const a = (1 - r) * Math.sqrt(Math.max(0.0001, 1 - 2 * r * Math.cos(2 * theta) + r * r));
  let y1 = 0, y2 = 0;
  return (x) => {
    const y = a * x + b1 * y1 + b2 * y2;
    y2 = y1; y1 = y;
    return y;
  };
}

/** 제일 큰 값을 기준으로 크기를 맞춘다 — 공명기를 거치면 세기가 들쭉날쭉해진다 */
function normalize(d, peak) {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 1e-6) {
    const k = peak / m;
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  return finish(d);
}

function whine() {
  const dur = 0.75, n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const slide = Math.sin(t * 7.5) * 0.16 + (1 - t / dur) * 0.20;
    phase += 2 * Math.PI * (620 * (1 + slide)) / RATE;
    d[i] = (Math.sin(phase) * 0.8 + Math.sin(phase * 2) * 0.2) * env(t, dur, 0.05, 1.4) * 0.26;
  }
  return finish(d);
}

function howl() {
  const dur = 1.5, n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, k = t / dur;
    const f = 300 * (1 + 0.5 * Math.sin(Math.PI * Math.min(1, k * 1.3))) * (1 + 0.03 * Math.sin(t * 32));
    phase += 2 * Math.PI * f / RATE;
    d[i] = growlish(phase, 5) * env(t, dur, 0.18, 1.1) * 0.30;
  }
  return finish(d);
}

function pant() {
  const dur = 1.1, n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const cycle = Math.abs(Math.sin(t * Math.PI * 4.2));   // 초당 네 번쯤
    lp += (rnd() - lp) * 0.22;
    d[i] = lp * Math.pow(cycle, 2.2) * env(t, dur, 0.05, 0.7) * 0.30;
  }
  return finish(d);
}

function crunch() {
  const dur = 0.9, n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  for (let c = 0; c < 7; c++) {
    const start = Math.floor((0.03 + c * 0.12) * RATE);
    const len = Math.floor(0.05 * RATE);
    const amp = 0.6 + Math.random() * 0.4;
    let lp = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / RATE;
      lp += (rnd() - lp) * 0.55;
      d[start + i] += lp * Math.exp(-t * 90) * amp * 0.35;
    }
  }
  return finish(d);
}

function lap() {
  const dur = 0.9, n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  for (let c = 0; c < 6; c++) {
    const start = Math.floor((0.02 + c * 0.14) * RATE);
    const len = Math.floor(0.07 * RATE);
    let phase = 0;
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / RATE;
      const f = 900 + (260 - 900) * (i / len);
      phase += 2 * Math.PI * f / RATE;
      d[start + i] += (Math.sin(phase) * 0.5 + rnd() * 0.5) * Math.exp(-t * 55) * 0.22;
    }
  }
  return finish(d);
}

function snore() {
  const dur = 1.6, n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  let phase = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const breath = Math.max(0, Math.sin(t * Math.PI / 0.8));
    phase += 2 * Math.PI * (95 * (1 + 0.25 * breath)) / RATE;
    lp += (rnd() - lp) * 0.12;
    d[i] = (growlish(phase, 9) * 0.6 + lp) * Math.pow(breath, 1.6) * 0.24;
  }
  return finish(d);
}

function sneeze() {
  const dur = 0.45, n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const e = t < 0.12 ? (t / 0.12) * 0.25 : Math.exp(-(t - 0.12) * 22);
    lp += (rnd() - lp) * 0.45;
    d[i] = lp * e * 0.5;
  }
  return finish(d);
}

function yawn() {
  const dur = 1.0, n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, k = t / dur;
    phase += 2 * Math.PI * (240 * (1 + 0.9 * Math.sin(Math.PI * k))) / RATE;
    d[i] = (growlish(phase, 4) * 0.6 + rnd() * 0.25) * Math.sin(Math.PI * k) * 0.22;
  }
  return finish(d);
}

function tail() {
  const dur = 0.7, n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  for (let c = 0; c < 5; c++) {
    const start = Math.floor((0.02 + c * 0.13) * RATE);
    const len = Math.floor(0.06 * RATE);
    for (let i = 0; i < len && start + i < n; i++) {
      d[start + i] += rnd() * Math.exp(-(i / RATE) * 120) * 0.20;
    }
  }
  return finish(d);
}

// ── 화면 소리 ─────────────────────────────────────────────

function ding(f0, dur) {
  const n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const v = Math.sin(2 * Math.PI * f0 * t) * 0.7
      + Math.sin(2 * Math.PI * f0 * 1.5 * t) * 0.25
      + Math.sin(2 * Math.PI * f0 * 2 * t) * 0.12;
    d[i] = v * env(t, dur, 0.005, 2.2) * 0.20;
  }
  return finish(d);
}

function sad() {
  const dur = 0.6, n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    phase += 2 * Math.PI * (520 + (300 - 520) * (t / dur)) / RATE;
    d[i] = Math.sin(phase) * env(t, dur, 0.01, 1.8) * 0.18;
  }
  return finish(d);
}

function coin() {
  const dur = 0.35, n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  const fs = [1180, 1560, 1980];
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    for (let k = 0; k < fs.length; k++) v += Math.sin(2 * Math.PI * fs[k] * t) / (k + 1.5);
    d[i] = v * env(t, dur, 0.003, 3.0) * 0.16;
  }
  return finish(d);
}

function pop() {
  const dur = 0.09, n = Math.floor(dur * RATE);
  const d = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    phase += 2 * Math.PI * (700 + (320 - 700) * (t / dur)) / RATE;
    d[i] = Math.sin(phase) * env(t, dur, 0.002, 2.5) * 0.14;
  }
  return finish(d);
}

export default { play, unlock, isMuted, setMuted, preload };
