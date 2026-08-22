// 시간이 흐르는 규칙 전부.
//
// 시계가 둘이다.
//  · 나이 시계 — 늘 배속대로. 기본 12배면 현실 2시간이 개의 하루.
//  · 돌봄 시계 — 켜 놓았을 때만 배속대로, 꺼 둔 동안은 훨씬 느리다.
// 그리고 꺼 둔 동안에는 죽지 않는다. 자고 일어나니 떠나 있는 일은 없어야 한다.

import { T, rate, Stage, Illness, clamp, won } from './tuning.js';
import { breedOf, temperName, temperStory, AXIS } from './data.js';
import { findPet, hasInCollection, uid } from './save.js';
import { stepDolls } from './dolls.js';
import { stepPregnancy } from './breeding.js';
import { rollEvents, pushEvent } from './events.js';

// ── 시간 환산 ─────────────────────────────────────────────

/** 개의 시간 몇 시간이 현실 몇 초인가 */
export const realSecondsFor = (dogHours) => Math.round(dogHours * 3600 / T.timeScale);

/** 두 시각 사이가 개의 시간으로 몇 시간인가 */
export const dogHoursBetween = (from, to) => (to - from) * T.timeScale / 3600;

// ── 개의 시계 ─────────────────────────────────────────────
// 현실 시계로 밤낮을 정하면 12배속에서 앞뒤가 안 맞는다.
// (개는 하루를 두 시간에 사는데 밤은 현실 밤에만 오게 된다.)

export const dogHourOfDay = (s) => ((s.dogClockHours % 24) + 24) % 24;
export const dogDayCount = (s) => Math.floor(s.dogClockHours / 24) + 1;

export function isNight(s) {
  const h = dogHourOfDay(s);
  return h >= T.nightStartHour || h < T.nightEndHour;
}

/** "밤 2시" 처럼 읽어 주는 말 */
export function clockText(s) {
  const h = Math.floor(dogHourOfDay(s));
  const part = h < 6 ? '새벽' : h < 11 ? '아침' : h < 17 ? '낮' : h < 21 ? '저녁' : '밤';
  let shown = h % 12; if (shown === 0) shown = 12;
  return `${part} ${shown}시`;
}

/** 밤이 얼마나 깊은가 0~1. 방 조명을 여기에 맞춘다. */
export function nightDepth(s) {
  const h = dogHourOfDay(s);
  if (h >= 20) return (h - 20) / 4;
  if (h < 5) return 1;
  if (h < 7) return (7 - h) / 2;
  return 0;
}

// ── 나이 ──────────────────────────────────────────────────

export function ageDays(p, now) {
  const end = p.dead ? p.diedAt : now;
  return p.ageOffsetDays + dogHoursBetween(p.adoptedAt, end) / 24;
}

/** "1살 3개월" 처럼 사람이 읽는 나이 */
export function ageText(p, now) {
  const days = ageDays(p, now);
  const years = Math.floor(days / 365);
  const months = Math.floor((days - years * 365) / 30.4);
  if (years <= 0) return months <= 0 ? `생후 ${Math.max(1, Math.floor(days))}일` : `${months}개월`;
  return months <= 0 ? `${years}살` : `${years}살 ${months}개월`;
}

// ── 남은 시간 ─────────────────────────────────────────────

export function hoursLeftBeforeDeath(p) {
  if (p.illness !== Illness.Critical) return Infinity;
  return Math.max(0, T.criticalDeathHours - (p.criticalDogHours || 0));
}

export function hoursLeftOfLife(p, now) {
  if (p.stage !== Stage.Senior || p.dead) return Infinity;
  const inStage = dogHoursBetween(p.stageEnteredAt, now) - (p.growthStalled || 0);
  return Math.max(0, T.seniorHours - inStage);
}

export function stageDuration(st) {
  return [T.puppyHours, T.juniorHours, T.adultHours, T.seniorHours][st] ?? Infinity;
}

export function stageProgress(p, now) {
  const inStage = dogHoursBetween(p.stageEnteredAt, now) - (p.growthStalled || 0);
  return Math.max(0, Math.min(1, inStage / stageDuration(p.stage)));
}

/** 자라는 게 멈췄는가. 나이 먹는 것은 안 멈춘다. */
export function growthStalledReason(p) {
  if (p.stage >= Stage.Adult) return null;
  if (p.lost) return '집에 없어서 자라지 못하고 있습니다';
  if (p.illness >= T.growthIllnessCap) return '아파서 자라지 못하고 있습니다';
  if (p.mood < T.growthMoodFloor) return '기분이 바닥이라 자라지 못하고 있습니다';
  return null;
}

// ── 배속 바꾸기 ───────────────────────────────────────────

/**
 * 그냥 바꾸면 "데려온 시각부터 지금까지 × 배속"으로 나이를 세는 탓에
 * 과거까지 소급돼 강아지가 갑자기 늙는다. 그래서 지금까지 흐른 개의 시간을
 * 유지하도록 모든 시각을 다시 앉힌다. 바뀌는 것은 앞으로의 속도뿐이다.
 */
export function changeTimeScale(s, newScale, now) {
  const old = T.timeScale;
  if (!(newScale > 0) || Math.abs(old - newScale) < 1e-6) return;

  const past = (t) => (t > 0 ? now - Math.round((now - t) * old / newScale) : t);
  const future = (t) => (t > 0 ? now + Math.round((t - now) * old / newScale) : t);

  for (const p of s.pets) {
    p.adoptedAt = past(p.adoptedAt);
    p.stageEnteredAt = past(p.stageEnteredAt);
    p.lastPlayAt = past(p.lastPlayAt);
    p.lastPatAt = past(p.lastPatAt);
    p.lastWalkAt = past(p.lastWalkAt);
    if (p.dead) p.diedAt = past(p.diedAt);

    p.pregnantDue = future(p.pregnantDue);
    p.lostReturnAt = future(p.lostReturnAt);
    p.prescriptionUntil = future(p.prescriptionUntil);
    p.poopDue = (p.poopDue || []).map(future);
  }
  for (const c of s.cooldowns) c.last = past(c.last);

  s.lastSeen = now;
  s.timeScale = newScale;
  T.timeScale = newScale;
}

// ── 시간 흘리기 ───────────────────────────────────────────

export function catchUp(s, now) {
  const rep = [];
  if (!(s.lastSeen > 0)) s.lastSeen = now;

  let realHours = (now - s.lastSeen) / 3600;
  if (realHours <= 0) { s.lastSeen = now; recomputeFilth(s); return rep; }

  const offline = realHours > T.offlineGapRealHours;
  if (realHours > T.maxOfflineRealHours) {
    s.lastSeen = now - Math.round(T.maxOfflineRealHours * 3600);
    realHours = T.maxOfflineRealHours;
  }

  // 한 걸음은 개의 한 시간. 그동안 돌봄과 병은 각자의 속도로 흐른다.
  const carePer = (offline ? T.offlineCareScale : T.timeScale) / T.timeScale;
  const illPer = (offline ? T.offlineIllnessScale : T.timeScale) / T.timeScale;

  let ageHours = realHours * T.timeScale;
  const secPerStep = realSecondsFor(T.stepHours);
  let cursor = s.lastSeen;
  let guard = 0;

  while (ageHours > 1e-4 && guard++ < 20000) {
    const step = Math.min(T.stepHours, ageHours);
    let end = cursor + Math.round(secPerStep * (step / T.stepHours));
    if (end <= cursor) end = cursor + 1;
    stepAll(s, step, step * carePer, step * illPer, end, offline, rep);
    cursor = end;
    ageHours -= step;
  }

  s.lastSeen = now;
  recomputeFilth(s);
  return rep;
}

function stepAll(s, ageH, careH, illH, end, offline, rep) {
  s.dogClockHours += ageH;   // 개의 시계를 돌린다
  recomputeFilth(s);
  for (const p of s.pets) {
    if (p.dead) continue;
    stepPet(s, p, ageH, careH, illH, end, offline, rep);
  }
}

const say = (rep, petId, kind, text) => rep.push({ petId, kind, text });

function stepPet(s, p, ageH, careH, illH, end, offline, rep) {
  const breed = breedOf(p.breedId);

  if (p.lost) {
    p.satiety = clamp(p.satiety - rate.satiety * 0.4 * careH);
    p.mood = clamp(p.mood - rate.mood * 0.4 * careH);
    if (end >= p.lostReturnAt) {
      bringHome(p, false);
      pushEvent(s, p, 'came_back', end, 0, rep);
      say(rep, p.id, 'home', `${p.name}이(가) 돌아왔습니다.`);
    }
    advanceGrowth(s, p, ageH, end, rep);
    return;
  }

  // 잠과 기력
  if (p.asleep) {
    p.energy = clamp(p.energy + rate.energyGain * careH);
    if (p.energy >= T.wakeThreshold) p.asleep = false;
  } else {
    const ageEnergy = p.stage === Stage.Senior ? T.seniorEnergyRate : 1;
    const sleepy = isNight(s) ? T.nightEnergyRate : 1;
    p.energy = clamp(p.energy - rate.energyDrain * breed.energyRate * ageEnergy * sleepy * careH);
    if (p.energy <= T.sleepThreshold) p.asleep = true;
  }

  const half = p.asleep ? 0.5 : 1;

  // 새끼를 배면 배가 더 고프고 예민해진다. 만삭에 가까울수록 심해진다.
  let pregSat = 1, pregMood = 1;
  if (p.pregnantDue > 0) {
    pregSat = T.pregnantSatietyRate;
    pregMood = T.pregnantMoodRate;
    const left = dogHoursBetween(end, p.pregnantDue);
    if (left <= T.pregnancyHours * T.pregnantLateFraction) {
      pregSat += T.pregnantLateExtra * 0.4;
      pregMood += T.pregnantLateExtra;
    }
  }

  p.satiety = clamp(p.satiety - rate.satiety * breed.satietyRate * pregSat * careH * half);
  p.mood = clamp(p.mood - rate.mood * breed.moodRate * pregMood * careH * half);
  p.clean = clamp(p.clean - rate.clean * careH * half);
  p.social = clamp(p.social - rate.social * careH);
  p.homeHours = (p.homeHours || 0) + ageH;

  const suffering = p.satiety <= 0 || p.clean <= 0 || p.illness >= Illness.Sick;
  if (suffering) p.health = clamp(p.health - T.healthDrainPerHour * careH);
  else if (p.illness === 0) p.health = clamp(p.health + T.healthRegenPerHour * careH);

  stepIllness(s, p, breed, illH, end, offline, rep);
  if (p.dead) return;

  stepPoop(s, p, end);
  stepDolls(s, p, careH, end, rep);
  stepPregnancy(s, p, end, rep);
  advanceGrowth(s, p, ageH, end, rep);
  rollEvents(s, p, end, careH, rep);
}

export function bringHome(p, foundBySearch) {
  if (!p.lost) return;
  p.lost = false;
  p.lostReturnAt = 0;
  p.clean = clamp(p.clean - 45);
  p.satiety = clamp(p.satiety - 30);
  p.energy = clamp(p.energy - 25);
  p.mood = clamp(p.mood + (foundBySearch ? 25 : 10));
  p.social = clamp(p.social + 5);
}

function stepIllness(s, p, breed, illH, end, offline, rep) {
  if (p.illness === Illness.None) {
    let risk = T.illnessBaseRisk
      + T.illnessFilthRisk * (s.roomFilth / 100)
      + (p.satiety <= 0 ? T.illnessStarveRisk : 0)
      + (p.clean <= 0 ? T.illnessDirtyRisk : 0);

    risk *= breed.illnessRate;
    if (p.stage === Stage.Senior) risk *= T.seniorIllnessRate;
    if (p.vaccinated) risk *= T.vaccineRiskScale;
    if (p.health < 30) risk *= 2;
    risk *= illH;

    if (Math.random() < risk) {
      setIllness(p, Illness.Weak, end);
      say(rep, p.id, 'sick', `${p.name}이(가) 시름시름합니다.`);
    }
    return;
  }

  let worsen = T.illnessWorsenHours;
  if (end < (p.prescriptionUntil || 0)) worsen /= T.prescriptionSlow;

  p.illnessDogHours = (p.illnessDogHours || 0) + illH;

  if (p.illness < Illness.Critical) {
    if (p.illnessDogHours >= worsen) {
      setIllness(p, p.illness + 1, end);
      const what = p.illness === Illness.Sick ? '앓아누웠습니다' : '위독합니다';
      say(rep, p.id, 'worse', `${p.name}이(가) ${what}. 병원에 데려가야 합니다.`);
    }
    return;
  }

  // 위독. 꺼 둔 동안에는 떠나지 않는다 — 예고 없는 죽음은 없다.
  p.criticalDogHours = (p.criticalDogHours || 0) + illH;
  if (offline) return;

  if (p.criticalDogHours >= T.criticalDeathHours) {
    p.dead = true;
    p.diedOfAge = false;
    p.diedAt = end;
    p.asleep = false;
    say(rep, p.id, 'died', `${p.name}이(가) 세상을 떠났습니다.`);
  }
}

export function setIllness(p, level, when) {
  p.illness = level;
  p.illnessSince = when;
  p.illnessDogHours = 0;
  if (level !== Illness.Critical) { p.criticalDogHours = 0; p.lastWarningShown = false; }
}

function stepPoop(s, p, end) {
  if (!p.poopDue) return;
  for (let i = p.poopDue.length - 1; i >= 0; i--) {
    if (p.poopDue[i] > end) continue;
    p.poopDue.splice(i, 1);
    dropPoop(s, end);
  }
}

export function dropPoop(s, when) {
  if (s.poops.length >= T.maxPoops) return;
  s.poops.push({
    id: uid(),
    at: when,
    x: (Math.random() * 2 - 1) * T.roomHalfX,
    z: (Math.random() * 2 - 1) * T.roomHalfZ,
  });
  recomputeFilth(s);
}

export function recomputeFilth(s) {
  s.roomFilth = Math.min(100, s.poops.length * T.filthPerPoop);
}

function advanceGrowth(s, p, ageH, end, rep) {
  if (growthStalledReason(p)) { p.growthStalled = (p.growthStalled || 0) + ageH; return; }

  const inStage = dogHoursBetween(p.stageEnteredAt, end) - (p.growthStalled || 0);
  if (inStage < stageDuration(p.stage)) return;

  promote(s, p, end, rep);
}

function promote(s, p, when, rep) {
  switch (p.stage) {
    case Stage.Puppy:
      // 1차 갈림길 — 밥을 더 챙겼나, 더 놀아 줬나
      p.stage = Stage.Junior;
      p.temperament = (p.feedCount || 0) >= (p.playCount || 0) ? AXIS.fed : AXIS.play;
      say(rep, p.id, 'grew', `${p.name}이(가) 한 뼘 자랐습니다. ` +
        (p.temperament === AXIS.fed ? '잘 먹고 자란 티가 납니다.' : '잘 놀고 자란 티가 납니다.'));
      p.stageEnteredAt = when;
      p.growthStalled = 0;
      break;

    case Stage.Junior:
      // 2차 갈림길 — 자주 데리고 나갔나, 집에만 있었나
      p.stage = Stage.Adult;
      p.temperament += (p.outHours || 0) >= (p.homeHours || 0) * T.socialThresholdRatio
        ? AXIS.social : AXIS.home;
      onReachedAdult(s, p, when, rep);
      break;

    case Stage.Adult:
      p.stage = Stage.Senior;
      p.stageEnteredAt = when;
      p.growthStalled = 0;
      p.pregnantDue = 0;
      pushEvent(s, p, 'grew_old', when, 0, rep);
      say(rep, p.id, 'old', `${p.name}이(가) 부쩍 늙었습니다.`);
      break;

    case Stage.Senior:
      // 병이 아니라 나이로 떠난다. 막을 수 없고, 미리 알려 왔다.
      p.dead = true;
      p.diedOfAge = true;
      p.diedAt = when;
      p.asleep = false;
      say(rep, p.id, 'died', `${p.name}이(가) 방석에서 잠들듯 떠났습니다.`);
      break;
  }
}

function onReachedAdult(s, p, when, rep) {
  p.stageEnteredAt = when;
  p.growthStalled = 0;

  const breed = breedOf(p.breedId);
  const isNew = !hasInCollection(s, p.breedId, p.temperament);
  const reward = T.adultReward + (isNew ? T.newTemperamentBonus : 0);
  s.money += reward;

  if (isNew) {
    s.collection.push({
      breedId: p.breedId,
      temperament: p.temperament,
      petName: p.name,
      at: when,
      feedCount: p.feedCount || 0,
      playCount: p.playCount || 0,
      walkCount: p.walkCount || 0,
    });
  }

  say(rep, p.id, 'adult',
    `${p.name}이(가) 다 자랐습니다 — ${temperName(p.temperament)} ${breed.name}.\n` +
    temperStory(p.temperament) +
    (isNew ? '\n도감에 처음 오릅니다.' : '') +
    `\n정성 ${won(reward)}을 받았습니다.`);
}
