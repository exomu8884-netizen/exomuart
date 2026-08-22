// 조사를 이름에 맞게 고친다.
//
// 문장은 전부 "둘리이(가)" 처럼 두 벌을 적어 두고, 화면에 뿌리기 직전에 여기서
// 한 번에 골라 준다. 문장마다 조건문을 넣지 않아도 되고, 이름이 뭐가 되든 맞는다.
//
//   둘리 → 받침 없음 → 둘리가, 둘리를, 둘리는
//   뭉치 → 받침 없음 → 뭉치가
//   초코 → 받침 없음 → 초코가
//   밤톨 → 받침 있음 → 밤톨이, 밤톨을, 밤톨은

/** 한글 한 글자에 받침이 있는가 */
export function hasBatchim(ch) {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;   // 한글이 아니면 모름
  return (code - 0xac00) % 28 !== 0;
}

/** 받침이 ㄹ 인가 (「으로/로」를 가를 때 쓴다) */
export function isRieul(ch) {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 === 8;
}

// 앞말에 받침이 있을 때 / 없을 때 쓰는 짝
const PAIRS = [
  ['이(가)', '이', '가'],
  ['가(이)', '이', '가'],
  ['을(를)', '을', '를'],
  ['를(을)', '을', '를'],
  ['은(는)', '은', '는'],
  ['는(은)', '은', '는'],
  ['과(와)', '과', '와'],
  ['와(과)', '과', '와'],
  ['아(야)', '아', '야'],
  ['야(아)', '아', '야'],
];

const ESC = (s) => s.replace(/[()]/g, '\\$&');
const RE = new RegExp('(.)(' + PAIRS.map(p => ESC(p[0])).join('|') + ')', 'g');

/**
 * "둘리이(가) 밥을 먹었습니다" → "둘리가 밥을 먹었습니다"
 * 한글이 아닌 글자 앞이면 두 벌 표기를 그대로 둔다 (판단할 수 없으므로).
 */
export function josa(text) {
  if (!text) return text;
  return text.replace(RE, (m, prev, pair) => {
    const b = hasBatchim(prev);
    if (b === null) return m;
    const found = PAIRS.find(p => p[0] === pair);
    return prev + (b ? found[1] : found[2]);
  });
}

/** 「으로/로」 — ㄹ 받침은 「로」를 쓴다 */
export function euro(word) {
  const last = word[word.length - 1];
  const b = hasBatchim(last);
  if (b === null) return word + '(으)로';
  return word + (!b || isRieul(last) ? '로' : '으로');
}
