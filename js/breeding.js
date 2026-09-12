// 짝을 맺고, 새끼를 낳고, 분양을 보낸다.
// 이 한 바퀴가 돌아야 게임이 끝나지 않는다 — 용돈 말고 두 번째 수입원이다.

import { T, Stage, clamp, won } from './tuning.js?v=1789206160';
import { PUPPY_NAMES } from './data.js?v=1789206160';
import { atHome, livingCount, hasInCollection } from './save.js?v=1789206160';
import { realSecondsFor } from './sim.js?v=1789206160';
import { newPet } from './actions.js?v=1789206160';
import { pushEvent } from './events.js?v=1789206160';

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

/** 정든 아이를 좋은 집으로 보낸다. 되돌릴 수 없다. */
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

  return {
    ok: true,
    message: `${p.name}을(를) 좋은 집으로 보냈습니다.\n${won(price)}을 받았습니다. 잘 지낼 겁니다.`,
  };
}
