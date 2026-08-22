// 유저가 누르는 것들. 시간은 sim.js 가 흘리고, 여기서는 그 순간의 변화만 준다.

import { T, Stage, Illness, clamp, won } from './tuning.js';
import { foodOf, breedOf } from './data.js';
import { mealsOf, takeMeal, addMeals, livingCount, uid, nowUnix } from './save.js';
import { realSecondsFor, dogHoursBetween, setIllness } from './sim.js';
import { rollWalkEvent } from './events.js';

export const ok = (message = null) => ({ ok: true, message });
export const no = (message) => ({ ok: false, message });

/** 지금 손을 댈 수 있는 상태인가 */
function ready(p) {
  if (p.dead) return no('');
  if (p.lost) return no(`${p.name}은(는) 집에 없습니다.`);
  if (p.asleep) return no(`${p.name}이(가) 자고 있습니다.`);
  return ok();
}

/** 같은 걸 연달아 하면 효과가 준다. 시간이 지나면 풀린다. */
function falloff(p, lastKey, streakKey, now) {
  const last = p[lastKey] || 0;
  if (!last || dogHoursBetween(last, now) > T.repeatResetHours) p[streakKey] = 0;
  const f = Math.pow(T.repeatFalloff, p[streakKey] || 0);
  p[streakKey] = (p[streakKey] || 0) + 1;
  return f;
}

// ── 밥 ────────────────────────────────────────────────────

export function feed(s, p, foodId, now) {
  const g = ready(p); if (!g.ok) return g;

  const food = foodOf(foodId);
  if (!food) return no('그런 사료가 없습니다.');
  if (mealsOf(s, foodId) <= 0) return no(`${food.name}이(가) 없습니다. 가게에서 사 오세요.`);
  if (!food.isTreat && p.satiety >= T.fullSatiety) return no(`${p.name}은(는) 배가 부릅니다.`);

  // 같은 사료만 계속 주면 물린다
  const bored = p.lastFoodId === foodId && (p.sameFoodStreak || 0) >= T.sameFoodBored;
  if (bored && !food.isTreat && Math.random() < T.refuseChance) {
    p.mood = clamp(p.mood - 4);
    return no(`${p.name}이(가) 냄새만 맡고 돌아섭니다. 물린 모양입니다.`);
  }

  if (!takeMeal(s, foodId)) return no('사료가 없습니다.');

  let moodGain = bored ? 0 : food.mood;
  if (food.forPuppy && p.stage === Stage.Puppy) moodGain += 4;

  p.satiety = clamp(p.satiety + food.satiety);
  p.mood = clamp(p.mood + moodGain);
  p.health = clamp(p.health + (food.health || 0));

  if (food.prescription) p.prescriptionUntil = now + realSecondsFor(T.prescriptionEffectHours);

  // 간식은 '밥'으로 세지 않는다 — 갈림길 판정이 왜곡되지 않게
  if (!food.isTreat) p.feedCount = (p.feedCount || 0) + 1;

  if (p.lastFoodId === foodId) p.sameFoodStreak = (p.sameFoodStreak || 0) + 1;
  else { p.lastFoodId = foodId; p.sameFoodStreak = 1; }

  p.poopDue.push(now + realSecondsFor(T.poopDelayHours));

  return ok(`${p.name}이(가) ${food.name}을(를) 먹었습니다.` + (bored ? ' 시큰둥합니다.' : ''));
}

// ── 손으로 하는 것 ────────────────────────────────────────

export function play(s, p, now) {
  const g = ready(p); if (!g.ok) return g;
  if (p.energy < T.playEnergyCost) return no(`${p.name}이(가) 지쳤습니다.`);

  const f = falloff(p, 'lastPlayAt', 'playStreak', now);
  p.lastPlayAt = now;
  p.mood = clamp(p.mood + T.playMood * f);
  p.energy = clamp(p.energy - T.playEnergyCost);
  p.playCount = (p.playCount || 0) + 1;

  return ok(f < 0.6 ? `${p.name}이(가) 슬슬 시들해합니다.` : `${p.name}이(가) 신나게 놀았습니다.`);
}

export function wash(s, p) {
  const g = ready(p); if (!g.ok) return g;
  if (p.clean >= 98) return no(`${p.name}은(는) 깨끗합니다.`);
  p.clean = T.washClean;
  p.mood = clamp(p.mood + T.washMood);
  return ok(`${p.name}을(를) 씻겼습니다. 별로 안 좋아합니다.`);
}

export function pat(s, p, now) {
  if (p.dead) return no('');
  if (p.lost) return no(`${p.name}은(는) 집에 없습니다.`);
  const f = falloff(p, 'lastPatAt', 'patStreak', now);
  p.lastPatAt = now;
  p.mood = clamp(p.mood + T.patMood * f);
  return ok(null);
}

/** 불을 끄고 켠다 */
export function toggleSleep(s, p) {
  if (p.dead) return no('');
  if (p.lost) return no(`${p.name}은(는) 집에 없습니다.`);
  p.asleep = !p.asleep;
  return ok(p.asleep
    ? `불을 껐습니다. ${p.name}이(가) 잠들었습니다.`
    : `${p.name}을(를) 깨웠습니다.`);
}

// ── 산책 ──────────────────────────────────────────────────

export function walk(s, p, now, len, rep) {
  const i = len;
  const g = ready(p); if (!g.ok) return g;
  if (p.illness >= Illness.Sick) return no(`${p.name}이(가) 아픕니다. 지금은 안 됩니다.`);
  if (p.pregnantDue > 0 && i === 2) return no(`${p.name}이(가) 새끼를 뱄습니다. 멀리는 무리입니다.`);

  const need = T.walkMinEnergy * (0.6 + 0.5 * i);
  if (p.energy < need) return no(`${p.name}이(가) 지쳤습니다. 짧게 다녀오거나 좀 쉬게 두세요.`);

  if (p.lastWalkAt > 0) {
    const since = dogHoursBetween(p.lastWalkAt, now);
    const cd = T.walkCooldown[i];
    if (since < cd) return no(`다녀온 지 얼마 안 됐습니다. ${Math.ceil(cd - since)}시간 뒤에 다시 나갈 수 있습니다.`);
  }

  p.mood = clamp(p.mood + T.walkMood[i]);
  p.social = clamp(p.social + T.walkSocial[i]);
  p.energy = clamp(p.energy - T.walkEnergy[i]);
  p.clean = clamp(p.clean - T.walkClean[i]);
  p.walkCount = (p.walkCount || 0) + 1;
  p.lastWalkAt = now;
  p.outHours = (p.outHours || 0) + T.walkOutHours[i];

  // 밖에서 보고 오면 집에 변이 안 생긴다
  let outside = false;
  if (p.poopDue.length > 0 && Math.random() < T.walkPoopOutside) {
    p.poopDue.shift();
    outside = true;
  }

  // 무리하면 탈이 난다. 새끼는 특히.
  let risk = T.walkTireRisk[i];
  if (p.stage === Stage.Puppy) risk *= T.puppyWalkRiskScale;
  if (p.energy <= 5) risk += 0.15;

  let tired = false;
  if (risk > 0 && Math.random() < risk) {
    tired = true;
    p.health = clamp(p.health - 12);
    if (p.illness === 0) setIllness(p, Illness.Weak, now);
  }

  if (Math.random() < T.walkEventChance[i]) rollWalkEvent(s, p, now, rep);

  let msg = i === 0 ? `${p.name}과(와) 잠깐 걷고 왔습니다.\n문 앞을 서성입니다. 아쉬운 모양입니다.`
    : i === 1 ? `${p.name}과(와) 한 바퀴 돌고 왔습니다.`
      : `${p.name}과(와) 멀리까지 다녀왔습니다. 바닥에 배를 깔고 눕습니다.`;
  if (outside) msg += ' 밖에서 볼일도 봤습니다.';
  if (tired) msg += `\n${p.name}이(가) 무리했는지 기운이 없습니다.`;

  return ok(msg);
}

// ── 병원 ──────────────────────────────────────────────────

/** 병원에서 고를 수 있는 것들. 이벤트에서도 병원 버튼에서도 같은 표를 쓴다. */
export function clinicChoices() {
  return [
    {
      label: `정밀 치료 (${won(T.clinicFullPrice)})`,
      cost: T.clinicFullPrice,
      apply: (s, p, e, t) => {
        setIllness(p, Illness.None, t);
        p.health = clamp(p.health + 40);
        return `${p.name}이(가) 다 나았습니다.`;
      },
    },
    {
      label: `간단 진료 (${won(T.clinicBasicPrice)})`,
      cost: T.clinicBasicPrice,
      apply: (s, p, e, t) => {
        setIllness(p, Math.max(0, p.illness - 1), t);
        p.health = clamp(p.health + 15);
        return p.illness === 0
          ? `${p.name}이(가) 나았습니다.`
          : `${p.name}이(가) 한 고비 넘겼습니다. 아직 더 봐야 합니다.`;
      },
    },
    {
      label: '집에서 지켜본다 (무료)',
      apply: () => '지켜보기로 했습니다. 나아지지 않으면 더 나빠집니다.',
    },
  ];
}

/** 고른 선택지를 적용한다 (돈은 여기서 뺀다) */
export function applyChoice(s, p, c, now) {
  if (!c) return no('');
  if (c.enabled && !c.enabled(s, p)) return no('지금은 고를 수 없습니다.');
  if (c.cost > 0) {
    if (s.money < c.cost) return no(`${won(c.cost)}이 모자랍니다.`);
    s.money -= c.cost;
  }
  return ok(c.apply ? c.apply(s, p, null, now) : null);
}

export function vaccinate(s, p) {
  if (p.dead) return no('');
  if (p.vaccinated) return no('이미 맞혔습니다.');
  if (p.lost) return no(`${p.name}은(는) 집에 없습니다.`);
  if (s.money < T.vaccinePrice) return no(`접종비 ${won(T.vaccinePrice)}이 모자랍니다.`);
  s.money -= T.vaccinePrice;
  p.vaccinated = true;
  return ok(`${p.name}이(가) 예방접종을 맞았습니다. 이제 잘 안 아픕니다.`);
}

// ── 방 ────────────────────────────────────────────────────

export function cleanPoop(s, poopId) {
  const i = s.poops.findIndex(x => x.id === poopId);
  if (i < 0) return no('');
  s.poops.splice(i, 1);
  s.roomFilth = Math.min(100, s.poops.length * T.filthPerPoop);
  return ok(null);
}

// ── 돈 ────────────────────────────────────────────────────

/**
 * 용돈은 "개의 하루"마다 들어온다.
 * 현실 날짜로 주면 배속을 올렸을 때 무너진다 — 72배면 개는 현실 하루에 72일을 사는데
 * 사료값은 그만큼 나가고 용돈은 한 번만 들어와서 굶는다.
 * 개의 날 기준으로 주면 수입과 지출이 같은 속도로 늘어 균형이 유지된다.
 */
export function claimAllowance(s) {
  const dogDay = Math.floor(s.dogClockHours / 24);
  if (s.lastAllowanceDay == null) { s.lastAllowanceDay = dogDay; return 0; }
  if (dogDay <= s.lastAllowanceDay) return 0;

  let days = dogDay - s.lastAllowanceDay;
  days = Math.max(0, Math.min(days, T.maxAllowanceDays));

  const amount = days * T.dailyAllowance;
  s.money += amount;
  s.lastAllowanceDay = dogDay;
  return amount;
}

export function buyFood(s, foodId) {
  const f = foodOf(foodId);
  if (!f) return no('그런 사료가 없습니다.');
  if (s.money < f.price) return no('돈이 모자랍니다.');
  s.money -= f.price;
  addMeals(s, f.id, f.meals);
  return ok(`${f.name} ${f.meals}${f.isTreat ? '개' : '끼'}를 샀습니다.`);
}

export function buySlot(s) {
  if (s.slots >= T.maxSlots) return no('자리를 더 늘릴 수 없습니다.');
  if (s.money < T.slotPrice) return no('돈이 모자랍니다.');
  s.money -= T.slotPrice;
  s.slots++;
  return ok(`자리를 늘렸습니다. 이제 ${s.slots}마리까지 키울 수 있습니다.`);
}

// ── 분양 ──────────────────────────────────────────────────

/** 첫 아이는 공짜다. 돈이 없어 게임이 시작조차 안 되면 안 된다. */
export const isFirstAdoption = (s) => s.pets.length === 0;
export const priceFor = (s, breed) => (isFirstAdoption(s) ? 0 : breed.price);

export function canAdopt(s, breed) {
  if (!breed) return { ok: false, why: '없는 품종입니다.' };
  if (livingCount(s) >= s.slots) return { ok: false, why: '자리가 없습니다. 집을 넓히세요.' };
  if (s.money < priceFor(s, breed)) return { ok: false, why: `분양비 ${won(priceFor(s, breed))}이 모자랍니다.` };
  return { ok: true, why: null };
}

export function adopt(s, breed, name, now) {
  s.money -= priceFor(s, breed);
  const p = newPet({
    breedId: breed.id,
    name: (name || '').trim() || '둘리',
    now,
    ageOffsetDays: T.adoptedAgeDays,
  });
  s.pets.push(p);
  return p;
}

/** 새 아이 한 마리의 기본값 */
export function newPet({ breedId, name, now, ageOffsetDays, bornHere = false, parentNote = '' }) {
  return {
    id: uid(),
    name,
    breedId,
    stage: Stage.Puppy,
    temperament: '',

    adoptedAt: now,
    ageOffsetDays,
    // 이미 그만큼 자란 상태로 들어온다
    stageEnteredAt: now - realSecondsFor(ageOffsetDays * 24),
    growthStalled: 0,

    satiety: 75, mood: 80, clean: 100, energy: 92, health: 100, social: bornHere ? 55 : 40,
    asleep: false,

    illness: 0, illnessSince: 0, illnessDogHours: 0, criticalDogHours: 0,
    vaccinated: false, prescriptionUntil: 0, lastWarningShown: false,

    feedCount: 0, playCount: 0, walkCount: 0, homeHours: 0, outHours: 0,
    poopDue: [],
    lastFoodId: '', sameFoodStreak: 0,
    lastPlayAt: 0, playStreak: 0, lastPatAt: 0, patStreak: 0, lastWalkAt: 0,

    female: Math.random() < 0.5,
    pregnantDue: 0, mateName: '', mateBreedId: '', litterSize: 0,
    bornHere, parentNote,

    lost: false, lostSince: 0, lostReturnAt: 0,
    dead: false, diedAt: 0, diedOfAge: false,
  };
}
