// 저장은 JSON 한 덩어리, 브라우저 저장소(localStorage)에 넣는다.
//
// 현실 시간은 저장해 둔 lastSeen(UTC 초)과 기기 시계의 차이로 잰다.
// 서버를 안 쓰므로 기기 시계를 앞으로 돌리면 시간이 건너뛴다. 뒤로 돌리면 그냥 멈춘다.

import { T } from './tuning.js?v=1788837232';
import { addToShelf } from './dolls.js?v=1788837232';

const KEY = 'dulli_save_v1';

export const nowUnix = () => Math.floor(Date.now() / 1000);

export const localMidnight = (unix) => {
  const d = new Date(unix * 1000);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
};

export function newGame() {
  T.timeScale = T.defaultTimeScale;
  const now = nowUnix();
  const s = {
    version: 1,
    lastSeen: now,
    lastAllowanceDay: 0,   // 개의 날 기준으로 용돈을 준다

    /** 개가 사는 시계. 지금까지 흐른 개의 시간(시). 아침 8시에 시작. */
    dogClockHours: 8,
    timeScale: T.defaultTimeScale,

    money: T.startingMoney,
    slots: T.startingSlots,
    roomFilth: 0,

    pets: [],
    poops: [],
    pantry: [],
    collection: [],
    inbox: [],
    cooldowns: [],
    dolls: [],

    warningAccepted: false,
  };
  for (let i = 0; i < T.startingDolls; i++) addToShelf(s);
  return s;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newGame();
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return newGame();
    repair(s);
    T.timeScale = s.timeScale;
    return s;
  } catch (e) {
    console.error('[둘리] 저장을 읽지 못했습니다', e);
    return newGame();
  }
}

export function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    console.error('[둘리] 저장하지 못했습니다', e);
  }
}

export function wipe() {
  try { localStorage.removeItem(KEY); } catch (e) { console.error(e); }
}

/** 옛 저장이나 손상된 저장에서 빈 곳을 메운다. */
function repair(s) {
  const lists = ['pets', 'poops', 'pantry', 'collection', 'inbox', 'cooldowns', 'dolls'];
  for (const k of lists) if (!Array.isArray(s[k])) s[k] = [];

  for (const p of s.pets) {
    if (!Array.isArray(p.poopDue)) p.poopDue = [];
    if (p.temperament == null) p.temperament = '';
    if (!p.name) p.name = '이름 없음';
    if (!(p.ageOffsetDays > 0)) p.ageOffsetDays = T.adoptedAgeDays;
  }

  if (!(s.slots >= 1)) s.slots = T.startingSlots;
  if (!(s.timeScale > 0)) s.timeScale = T.defaultTimeScale;
  if (!(s.dogClockHours >= 0)) s.dogClockHours = 8;
  if (s.lastAllowanceDay == null) s.lastAllowanceDay = Math.floor(s.dogClockHours / 24);
  if (!(s.money >= 0)) s.money = 0;
}

// ── 저장 옮기기 ───────────────────────────────────────────
// localStorage 는 주소(도메인+포트)마다 따로 보관된다. 배포하거나 폰으로 옮기면
// 그동안 키운 아이가 안 따라온다. 그래서 파일로 빼고 넣을 수 있게 해 둔다.

/** 지금 저장을 파일로 내려받는다 */
export function exportSave(s) {
  const name = s.pets.find(p => !p.dead)?.name || '둘리';
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const blob = new Blob([JSON.stringify(s)], { type: 'application/json' });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `둘리키우기_${name}_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return a.download;
}

/** 내려받아 둔 파일을 다시 넣는다 */
export function importSave(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, message: '파일을 읽지 못했습니다. 내려받은 그 파일이 맞습니까?' };
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.pets)) {
    return { ok: false, message: '둘리키우기 저장 파일이 아닙니다.' };
  }

  repair(data);
  T.timeScale = data.timeScale;
  // 자리를 비운 사이 시간이 흐른 것으로 치지 않게 지금으로 맞춘다
  data.lastSeen = nowUnix();
  save(data);

  const n = data.pets.filter(p => !p.dead).length;
  return { ok: true, data, message: `불러왔습니다. 아이 ${n}마리, ${data.money.toLocaleString('ko-KR')}원.` };
}

// ── 창고 ──────────────────────────────────────────────────

export const mealsOf = (s, foodId) => {
  const e = s.pantry.find(x => x.foodId === foodId);
  return e ? e.meals : 0;
};

export function addMeals(s, foodId, n) {
  const e = s.pantry.find(x => x.foodId === foodId);
  if (e) e.meals += n;
  else s.pantry.push({ foodId, meals: n });
}

export function takeMeal(s, foodId) {
  const e = s.pantry.find(x => x.foodId === foodId);
  if (!e || e.meals <= 0) return false;
  e.meals--;
  return true;
}

export const totalMeals = (s) => s.pantry.reduce((a, x) => a + x.meals, 0);

// ── 아이 찾기 ─────────────────────────────────────────────

export const findPet = (s, id) => s.pets.find(p => p.id === id) || null;
export const livingCount = (s) => s.pets.filter(p => !p.dead).length;
export const atHome = (p) => !p.dead && !p.lost;

export const hasInCollection = (s, breedId, temper) =>
  s.collection.some(c => c.breedId === breedId && c.temperament === temper);

// ── 이벤트 쿨다운 ─────────────────────────────────────────

export function cooldownOf(s, eventId, petId) {
  const c = s.cooldowns.find(x => x.eventId === eventId && x.petId === petId);
  return c ? c.last : 0;
}

export function stampCooldown(s, eventId, petId, when) {
  const c = s.cooldowns.find(x => x.eventId === eventId && x.petId === petId);
  if (c) c.last = when;
  else s.cooldowns.push({ eventId, petId, last: when });
}

export const pendingCountFor = (s, petId) => s.inbox.filter(e => e.petId === petId).length;

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
