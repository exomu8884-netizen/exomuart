// 이벤트 엔진 + 표.
// 여기에 줄을 추가하면 게임에 이벤트가 는다.

import { T, Stage, Illness, clamp, won } from './tuning.js';
import { foodOf } from './data.js';
import {
  findPet, atHome, cooldownOf, stampCooldown, pendingCountFor,
  addMeals, takeMeal, mealsOf, totalMeals, livingCount, uid,
} from './save.js';

// 순환 참조를 피하려고 필요한 것만 늦게 가져온다
let L = null;
export function linkEvents(lib) { L = lib; }

const add = clamp;
const rnd = Math.random;
const okChoice = (label, apply) => ({ label, apply: apply || (() => null) });

// ══ 엔진 ═══════════════════════════════════════════════════

export const eventById = (id) => CATALOG.find(e => e.id === id) || null;

function canFire(s, p, def, now) {
  if (pendingCountFor(s, p.id) >= T.maxPendingEvents) return false;
  if (s.inbox.some(e => e.eventId === def.id && e.petId === p.id)) return false;

  const last = cooldownOf(s, def.id, p.id);
  if (last > 0 && L.dogHoursBetween(last, now) < def.cooldown) return false;

  return !def.when || def.when(s, p, now);
}

function fire(s, p, def, now, rep) {
  const pe = {
    eventId: def.id,
    petId: p.id,
    at: now,
    amount: def.amount ? def.amount(s, p) : 0,
  };
  s.inbox.push(pe);
  stampCooldown(s, def.id, p.id, now);
  if (def.onFire) def.onFire(s, p, pe, now);
  if (rep) rep.push({ petId: p.id, kind: 'event', text: def.title });
}

/** 한 걸음만큼 이벤트를 굴린다 */
export function rollEvents(s, p, now, hours, rep) {
  if (p.dead) return;
  for (const def of CATALOG) {
    if (def.kind === 'walk') continue;          // 산책은 따로 굴린다
    if (!canFire(s, p, def, now)) continue;
    if (def.kind === 'ambient' && rnd() >= def.chance * hours) continue;
    fire(s, p, def, now, rep);
  }
}

/** 산책을 나갔을 때 한 번 굴린다 */
export function rollWalkEvent(s, p, now, rep) {
  const pool = CATALOG.filter(d => d.kind === 'walk' && canFire(s, p, d, now));
  if (!pool.length) return;
  fire(s, p, pool[Math.floor(rnd() * pool.length)], now, rep);
}

/** 조건 없이 지금 띄운다 (돌아옴 알림처럼 코드가 부르는 것들) */
export function pushEvent(s, p, eventId, now, amount = 0, rep = null) {
  const def = eventById(eventId);
  if (!def) return;
  if (s.inbox.some(e => e.eventId === eventId && e.petId === p.id)) return;

  const pe = { eventId, petId: p.id, at: now, amount };
  s.inbox.push(pe);
  stampCooldown(s, eventId, p.id, now);
  if (def.onFire) def.onFire(s, p, pe, now);
  if (rep) rep.push({ petId: p.id, kind: 'event', text: def.title });
}

export function choicesFor(s, pe) {
  const def = eventById(pe.eventId);
  const p = findPet(s, pe.petId);
  if (!def || !p) return [];
  const list = def.choices ? def.choices(s, p, pe) : null;
  return (list && list.length) ? list : [okChoice('알겠습니다')];
}

export function titleOf(pe) {
  const def = eventById(pe.eventId);
  return def ? def.title : '';
}

export function bodyOf(s, pe) {
  const def = eventById(pe.eventId);
  const p = findPet(s, pe.petId);
  if (!def || !p) return '';
  return def.body ? def.body(s, p, pe) : '';
}

/** 선택지를 고른 결과를 적용하고, 보여 줄 문장을 돌려준다 */
export function resolveEvent(s, pe, index, now) {
  const def = eventById(pe.eventId);
  const p = findPet(s, pe.petId);
  const i = s.inbox.indexOf(pe);
  if (i >= 0) s.inbox.splice(i, 1);
  if (!def || !p) return null;

  const list = choicesFor(s, pe);
  const c = list[index];
  if (!c) return null;

  if (c.cost > 0) {
    if (s.money < c.cost) return '돈이 모자랍니다.';
    s.money -= c.cost;
  }
  return c.apply ? c.apply(s, p, pe, now) : null;
}

// ══ 표 ═════════════════════════════════════════════════════
// kind: 'ambient'(확률) · 'walk'(산책 중) · 'forced'(조건되면 반드시)

const clinic = () => L.clinicChoices();

const CATALOG = [

  // ── 아플 때 ─────────────────────────────────────────────
  {
    id: 'sick_notice', title: '아파 보입니다', kind: 'forced', cooldown: 14,
    when: (s, p) => p.illness >= Illness.Weak && !p.lost,
    body: (s, p) => {
      const how = p.illness === 1 ? '기운이 없고 밥을 깨작거립니다.'
        : p.illness === 2 ? '누워서 잘 일어나지 않습니다.'
          : '숨이 가쁩니다. 오래 두면 안 됩니다.';
      return `${p.name}이(가) ${how}\n어떻게 하시겠습니까?`;
    },
    choices: clinic,
  },
  {
    id: 'critical_warning', title: '지금 병원에 가야 합니다', kind: 'forced', cooldown: 4,
    when: (s, p, now) => p.illness === Illness.Critical && !p.lost && !p.lastWarningShown
      && L.hoursLeftBeforeDeath(p) <= T.lastWarningHours,
    onFire: (s, p) => { p.lastWarningShown = true; },
    body: (s, p) => `${p.name}이(가) 위독합니다.\n` +
      `이대로 두면 ${Math.ceil(L.hoursLeftBeforeDeath(p))}시간 뒤에 떠납니다.`,
    choices: clinic,
  },
  {
    id: 'vaccine_notice', title: '예방접종을 맞힐 때입니다', kind: 'forced', cooldown: 48,
    when: (s, p) => !p.vaccinated && p.stage >= Stage.Junior && !p.lost && !p.dead,
    body: (s, p) => `${p.name}이(가) 접종할 나이가 되었습니다.\n맞히면 앞으로 병에 훨씬 덜 걸립니다.`,
    choices: () => [
      {
        label: `맞힌다 (${won(T.vaccinePrice)})`, cost: T.vaccinePrice,
        apply: (s, p) => { p.vaccinated = true; return `${p.name}이(가) 접종을 마쳤습니다.`; },
      },
      okChoice('나중에 한다', () => '미뤘습니다.'),
    ],
  },

  // ── 잃어버림 ────────────────────────────────────────────
  {
    id: 'lost', title: '없어졌습니다', kind: 'ambient', chance: 0.010, cooldown: 96,
    when: (s, p) => !p.lost && !p.dead && p.stage >= Stage.Junior
      && (p.mood < 35 || p.social < 20) && p.illness < Illness.Sick,
    onFire: (s, p, e, now) => {
      p.lost = true;
      p.lostSince = now;
      p.lostReturnAt = now + L.realSecondsFor(
        T.lostReturnMinHours + rnd() * (T.lostReturnMaxHours - T.lostReturnMinHours));
    },
    body: (s, p) => `문이 열린 사이에 ${p.name}이(가) 나갔습니다.\n집에 없습니다.`,
    choices: () => [
      {
        label: `찾으러 나간다 (${won(T.searchPrice)})`, cost: T.searchPrice,
        apply: (s, p) => {
          if (rnd() < T.searchSuccessChance) {
            L.bringHome(p, true);
            return `두 골목 건너에서 ${p.name}을(를) 찾았습니다.`;
          }
          return '전단지를 붙이고 돌아왔습니다. 아직 못 찾았습니다.\n제 발로 돌아오는 경우가 많습니다. 기다려 봅시다.';
        },
      },
      okChoice('집에서 기다린다', () => '문을 열어 두고 기다리기로 했습니다.'),
    ],
  },
  {
    id: 'came_back', title: '돌아왔습니다', kind: 'forced', cooldown: 0,
    when: () => false,
    body: (s, p) => `${p.name}이(가) 문 앞에 앉아 있습니다.\n털이 엉키고 배가 홀쭉합니다. 어디서 뭘 했는지는 모릅니다.`,
  },

  // ── 밥 ──────────────────────────────────────────────────
  {
    id: 'food_bored', title: '밥을 안 먹습니다', kind: 'forced', cooldown: 20,
    when: (s, p) => !p.lost && !p.dead && (p.sameFoodStreak || 0) >= T.sameFoodBored && p.satiety < 60,
    body: (s, p) => {
      const f = foodOf(p.lastFoodId);
      return `${p.name}이(가) ${f ? f.name : '그 사료'}에 물렸습니다.\n그릇 앞에 앉아만 있습니다.`;
    },
    choices: () => [
      okChoice('다른 사료로 바꿔 준다', (s, p) => {
        p.sameFoodStreak = 0; p.lastFoodId = '';
        return '그릇을 비웠습니다. 다음엔 다른 걸 주십시오.';
      }),
      okChoice('그냥 둔다', (s, p) => { p.mood = add(p.mood - 8); return '그릇을 그대로 두었습니다. 시무룩합니다.'; }),
    ],
  },

  // ── 살림 ────────────────────────────────────────────────
  {
    id: 'chewed', title: '물어뜯었습니다', kind: 'ambient', chance: 0.012, cooldown: 40,
    when: (s, p) => atHome(p) && p.mood < 55 && p.stage <= Stage.Junior,
    amount: () => (2 + Math.floor(rnd() * 4)) * 5000,
    body: (s, p, e) => `${p.name}이(가) 심심했는지 물건을 물어뜯었습니다.\n${won(e.amount)}어치입니다.`,
    choices: () => [
      okChoice('혼낸다', (s, p, e) => {
        s.money -= e.amount; p.mood = add(p.mood - 12);
        return '풀이 죽었습니다. 당분간은 덜 할 겁니다.';
      }),
      okChoice('치우고 놀아 준다', (s, p, e) => {
        s.money -= e.amount; p.mood = add(p.mood + 15); p.energy = add(p.energy - 8);
        return '신나 합니다. 다음에 또 뜯을지도 모릅니다.';
      }),
    ],
  },
  {
    id: 'bark_complaint', title: '이웃이 찾아왔습니다', kind: 'ambient', chance: 0.010, cooldown: 72,
    when: (s, p, now) => atHome(p) && p.social < 35 && p.mood < 50
      && (!p.lastWalkAt || L.dogHoursBetween(p.lastWalkAt, now) > 48),
    body: (s, p) => `아랫집에서 올라왔습니다.\n${p.name}이(가) 낮에 계속 짖는다고 합니다.`,
    choices: () => [
      { label: '사과하고 선물을 드린다 (20,000원)', cost: 20000, apply: () => '웃으며 돌아갔습니다.' },
      okChoice('죄송하다고만 한다', () => '표정이 안 좋습니다. 또 올 것 같습니다.'),
    ],
  },
  {
    id: 'sale', title: '사료가 세일합니다', kind: 'ambient', chance: 0.006, cooldown: 96,
    when: (s, p) => !p.dead,
    body: () => '동네 가게가 좋은 사료를 반값에 팝니다.\n오늘까지입니다.',
    choices: () => [
      { label: '한 봉 산다 (9,000원)', cost: 9000, apply: (s) => { addMeals(s, 'premium', 20); return '좋은 사료 20끼를 챙겼습니다.'; } },
      okChoice('넘긴다'),
    ],
  },

  // ── 산책 중 ─────────────────────────────────────────────
  {
    id: 'walk_friend', title: '다른 개를 만났습니다', kind: 'walk', cooldown: 12,
    body: (s, p) => `공원에서 큰 개가 다가옵니다.\n${p.name}이(가) 뒤로 물러섭니다.`,
    choices: () => [
      okChoice('인사시켜 본다', (s, p) => {
        if (p.social > 45 || rnd() < 0.6) {
          p.social = add(p.social + 18); p.mood = add(p.mood + 12);
          return '냄새를 맡더니 같이 뛰어놉니다.';
        }
        p.mood = add(p.mood - 10); p.social = add(p.social - 5);
        return '짖다가 도망쳤습니다. 겁을 먹었습니다.';
      }),
      okChoice('안아 들고 지나간다', (s, p) => { p.mood = add(p.mood + 3); return '품에서 조용해졌습니다. 사회성은 늘지 않았습니다.'; }),
    ],
  },
  {
    id: 'walk_tick', title: '진드기가 붙었습니다', kind: 'walk', cooldown: 36,
    body: (s, p) => `풀숲을 지나온 ${p.name}의 목덜미에 진드기가 붙었습니다.`,
    choices: () => [
      okChoice('집에서 떼어 낸다', (s, p, e, t) => {
        p.clean = add(p.clean - 25);
        if (rnd() < 0.3) { L.setIllness(p, Illness.Weak, t); return '떼어 냈지만 자국이 부었습니다.'; }
        return '깨끗하게 떼어 냈습니다.';
      }),
      {
        label: `병원에 간다 (${won(T.clinicBasicPrice)})`, cost: T.clinicBasicPrice,
        apply: (s, p) => { p.clean = add(p.clean - 5); return '약을 바르고 왔습니다. 탈 없이 끝났습니다.'; },
      },
    ],
  },
  {
    id: 'walk_rain', title: '비가 옵니다', kind: 'walk', cooldown: 20,
    body: () => '반쯤 걸었는데 비가 쏟아집니다.',
    choices: () => [
      okChoice('바로 돌아온다', (s, p) => {
        p.mood = add(p.mood - 8); p.clean = add(p.clean - 10);
        return '젖은 채로 돌아왔습니다. 아쉬워합니다.';
      }),
      okChoice('그래도 마저 걷는다', (s, p, e, t) => {
        p.mood = add(p.mood + 14); p.clean = add(p.clean - 35);
        if (rnd() < 0.25) { L.setIllness(p, Illness.Weak, t); return '실컷 놀았지만 밤에 기침을 합니다.'; }
        return '웅덩이를 밟으며 좋아합니다.';
      }),
    ],
  },
  {
    id: 'walk_found', title: '뭘 주웠습니다', kind: 'walk', cooldown: 60,
    amount: () => (1 + Math.floor(rnd() * 4)) * 5000,
    body: (s, p, e) => `${p.name}이(가) 벤치 밑을 파더니 지갑을 물고 나옵니다.\n${won(e.amount)}이 들어 있습니다.`,
    choices: () => [
      okChoice('파출소에 맡긴다', (s, p, e) => {
        const fee = Math.round(e.amount / 10);
        s.money += fee; p.social = add(p.social + 5);
        return `사례금 ${won(fee)}을 받았습니다.`;
      }),
      okChoice('그냥 가진다', (s, p, e) => { s.money += e.amount; return `${won(e.amount)}이 생겼습니다. 마음이 좀 그렇습니다.`; }),
    ],
  },
  {
    id: 'walk_kid', title: '아이가 다가옵니다', kind: 'walk', cooldown: 24,
    body: (s, p) => `아이가 ${p.name}을(를) 만져 봐도 되냐고 묻습니다.`,
    choices: () => [
      okChoice('만지게 해 준다', (s, p) => {
        p.social = add(p.social + 12); p.mood = add(p.mood + 8);
        return '꼬리를 흔듭니다. 아이가 좋아합니다.';
      }),
      okChoice('다음에요, 하고 지나간다'),
    ],
  },
];

export default CATALOG;
export { CATALOG, okChoice, add };
