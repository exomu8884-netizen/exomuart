// 선반 위의 인형들.
// 강아지가 부딪혀 떨어뜨리고, 바닥에 있으면 물어뜯는다.
// 망가진 건 버려야 하고, 새로 사려면 용품점에 간다.

import { T, Stage, Illness, clamp } from './tuning.js?v=1787385309';
import { uid, atHome } from './save.js?v=1787385309';
import { pushEvent } from './events.js?v=1787385309';

export const onShelf = (s) => s.dolls.filter(d => d.state === 0).length;
export const onFloor = (s) => s.dolls.filter(d => d.state === 1).length;
export const brokenCount = (s) => s.dolls.filter(d => d.state === 2).length;
export const findDoll = (s, id) => s.dolls.find(d => d.id === id) || null;

function freeSlot(s) {
  for (let slot = 0; slot < T.shelfSlots; slot++) {
    if (!s.dolls.some(d => d.state === 0 && d.shelfSlot === slot)) return slot;
  }
  return -1;
}

export const shelfHasRoom = (s) => freeSlot(s) >= 0;

export function addToShelf(s) {
  const slot = freeSlot(s);
  if (slot < 0) return false;
  s.dolls.push({
    id: uid(),
    state: 0,          // 0 선반 위 · 1 바닥 · 2 망가짐
    shelfSlot: slot,
    look: Math.floor(Math.random() * 6),   // 색·머리 모양
    x: 0, z: 0,
  });
  return true;
}

export function buyDoll(s) {
  if (!shelfHasRoom(s)) return { ok: false, message: '선반이 꽉 찼습니다.' };
  if (s.money < T.dollPrice) return { ok: false, message: '돈이 모자랍니다.' };
  s.money -= T.dollPrice;
  addToShelf(s);
  return { ok: true, message: '인형을 하나 사서 선반에 올렸습니다.' };
}

/** 바닥에 떨어진 인형을 도로 올린다 */
export function pickUp(s, id) {
  const d = findDoll(s, id);
  if (!d || d.state !== 1) return { ok: false, message: '' };
  const slot = freeSlot(s);
  if (slot < 0) return { ok: false, message: '선반에 올릴 자리가 없습니다.' };
  d.state = 0;
  d.shelfSlot = slot;
  return { ok: true, message: '인형을 도로 올려 두었습니다.' };
}

/** 망가진 인형을 버린다. 되돌릴 수 없다. */
export function discard(s, id) {
  const i = s.dolls.findIndex(d => d.id === id && d.state === 2);
  if (i < 0) return { ok: false, message: '' };
  s.dolls.splice(i, 1);
  return { ok: true, message: '망가진 인형을 버렸습니다.' };
}

// ── 시간이 흐르는 동안 ────────────────────────────────────

const pick = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);

export function stepDolls(s, p, hours, end, rep) {
  if (!atHome(p) || p.asleep) return;
  if (p.illness >= Illness.Sick) return;

  // 기운이 넘치는 아이가 선반을 친다. 새끼와 중간이 특히.
  if (p.energy > 40 && p.mood > 25) {
    let knock = T.dollKnockChance * hours;
    if (p.stage <= Stage.Junior) knock *= 1.6;
    if (p.stage === Stage.Senior) knock *= 0.3;

    if (Math.random() < knock) {
      const d = pick(s.dolls.filter(x => x.state === 0));
      if (d) {
        d.state = 1;
        d.x = (Math.random() * 2 - 1) * T.roomHalfX;
        d.z = (Math.random() * 2 - 1) * T.roomHalfZ;
        p.mood = clamp(p.mood + T.dollFunMood * 0.4);
        rep.push({ petId: p.id, kind: 'doll_fell', text: `${p.name}이(가) 선반을 치고 지나가 인형이 떨어졌습니다.` });
      }
    }
  }

  // 바닥에 굴러다니면 결국 물어뜯는다
  if (Math.random() < T.dollChewChance * hours) {
    const d = pick(s.dolls.filter(x => x.state === 1));
    if (d) {
      d.state = 2;
      p.mood = clamp(p.mood + T.dollFunMood);
      pushEvent(s, p, 'doll_broken', end, 0, rep);
    }
  }
}
