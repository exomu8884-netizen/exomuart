// 짝을 맺고, 새끼를 낳고, 분양을 보낸다.
// 이 한 바퀴가 돌아야 게임이 끝나지 않는다 — 용돈 말고 두 번째 수입원이다.

import { T, Stage, clamp, won } from './tuning.js?v=1792030104';
import { PUPPY_NAMES } from './data.js?v=1792030104';
import { atHome, livingCount, hasInCollection, nowUnix } from './save.js?v=1792030104';
import { realSecondsFor } from './sim.js?v=1792030104';
import { newPet } from './actions.js?v=1792030104';
import { pushEvent } from './events.js?v=1792030104';

/** 집에 없는 이름으로 하나 고른다 */
export function pickName(s) {
  const taken = new Set(s.pets.map(p => p.name));
  for (let i = 0; i < 40; i++) {
    const n = PUPPY_NAMES[Math.floor(Math.random() * PUPPY_NAMES.length)];
    if (!taken.has(n)) return n;
  }
  return '새복';
}

// ── 짝 ────────────────────────────────────────────────────

export const canMate = (p) =>
  atHome(p) && p.stage === Stage.Adult && p.illness === 0 && !(p.pregnantDue > 0);

export function findMateAtHome(s, p) {
  if (!canMate(p)) return null;
  return s.pets.find(q => q.id !== p.id && canMate(q) && q.female !== p.female) || null;
}

export function mate(s, a, b, now) {
  const mother = a.female ? a : b;
  const father = a.female ? b : a;
  conceive(mother, now, father.name, father.breedId);
}

/** 동네 개와 맺어 준다. 아빠가 누구인지는 이름만 남는다. */
export function mateWithStranger(s, p, now, mateName, mateBreedId) {
  if (!p.female) return;   // 수컷이면 새끼는 그 집으로 간다
  conceive(p, now, mateName, mateBreedId);
}

function conceive(mother, now, mateName, mateBreedId) {
  mother.pregnantDue = now + realSecondsFor(T.pregnancyHours);
  mother.mateName = mateName;
  mother.mateBreedId = mateBreedId;
  mother.litterSize = T.litterMin + Math.floor(Math.random() * (T.litterMax - T.litterMin + 1));
  mother.mood = clamp(mother.mood + 10);
}

/** 낳을 때가 되었으면 출산 이벤트를 띄운다 */
export function stepPregnancy(s, p, now, rep) {
  if (!(p.pregnantDue > 0) || now < p.pregnantDue) return;
  if (p.dead || p.lost) return;

  const n = Math.max(1, p.litterSize);
  p.pregnantDue = 0;

  pushEvent(s, p, 'birth', now, n, rep);
  rep.push({ petId: p.id, kind: 'birth', text: `${p.name}이(가) 새끼 ${n}마리를 낳았습니다.` });
}

// ── 새끼 ──────────────────────────────────────────────────

/** 새끼 n마리 중 keep 마리만 집에 두고 나머지는 분양 보낸다 */
export function resolveLitter(s, mother, litter, keep, now) {
  const room = Math.max(0, s.slots - livingCount(s));
  keep = Math.max(0, Math.min(keep, Math.min(litter, room)));

  const kept = [];
  for (let i = 0; i < keep; i++) kept.push(newPuppy(s, mother, now).name);

  const sent = litter - keep;
  const earned = sent * T.adoptOutPuppy;
  s.money += earned;

  mother.mood = clamp(mother.mood + (keep > 0 ? 12 : -10));
  mother.satiety = clamp(mother.satiety - 20);
  mother.energy = clamp(mother.energy - 30);

  const lines = [];
  if (kept.length) lines.push(`${kept.join(', ')}이(가) 집에 남았습니다.`);
  if (sent > 0) lines.push(`${sent}마리는 좋은 집으로 보냈습니다. ${won(earned)}을 받았습니다.\n가끔 사진이 온다고 합니다.`);
  if (!kept.length && !sent) lines.push('자리가 없어 아무도 남기지 못했습니다.');
  return lines.join('\n');
}

function newPuppy(s, mother, now) {
  // 품종은 어미 쪽을 따른다 (아빠 품종이 있으면 반반)
  let breed = mother.breedId;
  if (mother.mateBreedId && Math.random() < 0.5) breed = mother.mateBreedId;

  const p = newPet({
    breedId: breed,
    name: pickName(s),
    now,
    ageOffsetDays: 1,
    bornHere: true,
    parentNote: mother.mateName
      ? `${mother.name}와(과) ${mother.mateName}의 아이`
      : `${mother.name}의 아이`,
  });
  s.pets.push(p);
  return p;
}

// ── 대 잇기 ───────────────────────────────────────────────

/**
 * 떠날 때가 가까운 아이의 새끼를 들인다. 생김새는 같고, 나이는 생후 3개월이다.
 * 이름은 "둘리 2세"처럼 대를 물린다.
 */
export function makeHeir(s, parent, now) {
  const p = newPet({
    breedId: parent.breedId,
    name: heirName(parent.name),
    now,
    ageOffsetDays: T.heirAgeDays,
    bornHere: true,
    parentNote: `${parent.name}의 새끼`,
  });
  s.pets.push(p);
  return p;
}

/** "둘리" → "둘리 2세" → "둘리 3세" */
export function heirName(parentName) {
  let base = parentName;
  let gen = 2;
  const m = /^(.*)\s(\d+)세$/.exec(parentName);
  if (m) { base = m[1]; gen = parseInt(m[2], 10) + 1; }
  return `${base} ${gen}세`;
}

// ── 분양 보내기 ───────────────────────────────────────────

export function adoptOutPrice(s, p) {
  let base = p.stage === Stage.Puppy ? T.adoptOutPuppy
    : p.stage === Stage.Junior ? T.adoptOutJunior
      : T.adoptOutAdult;

  // 도감에 없는 성격이면 더 쳐 준다
  if (p.stage === Stage.Adult && p.temperament && !hasInCollection(s, p.breedId, p.temperament))
    base += T.rareTemperamentBonus;

  if (p.illness > 0) base = Math.round(base * 0.6);
  if (p.vaccinated) base += 10000;
  return base;
}

/** 정든 아이를 좋은 집으로 보낸다. 실수였으면 되찾을 수 있게 기록을 남긴다. */
export function sendAway(s, p) {
  if (p.dead) return { ok: false, message: '' };
  if (p.lost) return { ok: false, message: `${p.name}은(는) 집에 없습니다.` };
  if (p.pregnantDue > 0) return { ok: false, message: `${p.name}은(는) 새끼를 배고 있습니다.` };

  // 지운 뒤에 값을 치른다.
  // 먼저 더하면, 목록에 없는 옛 객체가 넘어왔을 때 돈만 들어오고 아이는 그대로 남는다.
  const i = s.pets.indexOf(p);
  if (i < 0) return { ok: false, message: '' };

  const price = adoptOutPrice(s, p);
  s.pets.splice(i, 1);
  s.money += price;
  rememberSent(s, p, price);
  forgetPet(s, p.id);

  return {
    ok: true,
    message: `${p.name}을(를) 좋은 집으로 보냈습니다.\n${won(price)}을 받았습니다. 잘 지낼 겁니다.`,
  };
}

// ── 되찾기 ────────────────────────────────────────────────
// 실수로 보내는 일이 생긴다. 한 번 누르면 끝이라 더 그렇다.
// 그래서 보낸 아이를 그대로 적어 두고, 받은 돈을 돌려주면 되찾을 수 있게 한다.

/** 보낸 아이를 그대로 적어 둔다 */
function rememberSent(s, p, price) {
  if (!Array.isArray(s.sentAway)) s.sentAway = [];
  s.sentAway.unshift({ at: nowUnix(), price, pet: JSON.parse(JSON.stringify(p)) });
  if (s.sentAway.length > T.sentAwayMemory) s.sentAway.length = T.sentAwayMemory;
}

/**
 * 집을 떠난 아이의 편지와 쿨다운을 치운다.
 * 남겨 두면 주인 없는 편지가 편지함 맨 앞에 앉아, 글도 선택지도 없는 창이 떠 게임이 막힌다.
 */
function forgetPet(s, petId) {
  s.inbox = s.inbox.filter(e => e.petId !== petId);
  s.cooldowns = s.cooldowns.filter(c => c.petId !== petId);
}

/**
 * 되찾을 수 있는 아이들.
 * - 적어 둔 기록이 있으면 그때 그대로 돌아온다.
 * - 이 기능이 생기기 전에 보낸 아이는 기록이 없다. 도감에 남아 있으면 거기 적힌 대로 다시 데려온다.
 *   (집을 떠나는 길은 분양뿐이다. 죽은 아이는 목록에 그대로 남으므로 여기 섞이지 않는다.)
 */
export function reclaimable(s) {
  const out = [];
  const known = new Set(s.pets.map(p => p.name));

  for (const e of (s.sentAway || [])) {
    if (!e || !e.pet) continue;
    out.push({
      key: e.pet.id, name: e.pet.name, breedId: e.pet.breedId,
      temperament: e.pet.temperament, price: e.price || 0, exact: true, at: e.at,
    });
  }

  for (const c of (s.collection || [])) {
    if (!c.petName || known.has(c.petName)) continue;
    if (out.some(x => x.name === c.petName)) continue;
    out.push({
      key: 'book:' + c.breedId + ':' + c.temperament, name: c.petName, breedId: c.breedId,
      temperament: c.temperament, price: T.adoptOutAdult, exact: false, at: c.at,
    });
  }
  return out;
}

/** 떠나 있던 시간만큼 시각을 밀어 준다 — 그래야 돌아온 아이가 갑자기 늙거나 똥을 쏟지 않는다 */
function shiftTimes(p, dt) {
  if (!(dt > 0)) return;
  for (const k of ['adoptedAt', 'stageEnteredAt', 'lastPlayAt', 'lastPatAt', 'lastWalkAt',
    'illnessSince', 'prescriptionUntil', 'lostSince', 'lostReturnAt']) {
    if (p[k] > 0) p[k] += dt;
  }
  if (Array.isArray(p.poopDue)) p.poopDue = p.poopDue.map(t => t + dt);
}

/** 보낸 아이를 다시 데려온다 */
export function reclaim(s, key, now) {
  const item = reclaimable(s).find(x => x.key === key);
  if (!item) return { ok: false, message: '그 아이는 기록에 없습니다.' };
  if (livingCount(s) >= s.slots) return { ok: false, message: '자리가 없습니다. 집을 넓히고 데려오세요.' };
  if (s.money < item.price) return { ok: false, message: `${won(item.price)}이 있어야 데려올 수 있습니다.` };

  s.money -= item.price;

  const i = (s.sentAway || []).findIndex(e => e.pet && e.pet.id === key);
  if (i >= 0) {
    const e = s.sentAway[i];
    const p = e.pet;
    shiftTimes(p, now - (e.at || now));
    s.pets.push(p);
    s.sentAway.splice(i, 1);
    return {
      ok: true, pet: p,
      message: `${p.name}이(가) 돌아왔습니다.
그 집에서 며칠 지내다 왔습니다. 나이도 기분도 보낼 때와 같습니다.`,
    };
  }

  // 도감 기록으로 다시 데려온다 — 이름과 성격은 그대로, 나이는 성견의 처음으로 맞춘다
  const c = (s.collection || []).find(x => 'book:' + x.breedId + ':' + x.temperament === key);
  const p = newPet({ breedId: item.breedId, name: item.name, now, ageOffsetDays: 2 * 365 });
  p.stage = Stage.Adult;
  p.stageEnteredAt = now;
  p.temperament = item.temperament || '';
  if (c) {
    p.feedCount = c.feedCount || 0;
    p.playCount = c.playCount || 0;
    p.walkCount = c.walkCount || 0;
  }
  s.pets.push(p);
  return {
    ok: true, pet: p,
    message: `${p.name}이(가) 돌아왔습니다.
이름과 성격은 그대로입니다. 다만 그때의 몸 상태까지는 남아 있지 않아, 두 살 성견으로 다시 시작합니다.`,
  };
}
