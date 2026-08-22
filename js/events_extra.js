// 나머지 이벤트 — 즐거운 일, 가족(짝·출산·대 잇기), 인형, 나이, 곤란한 일.
// events.js 의 표에 밀어 넣는다.

import { T, Stage, Illness, clamp, won } from './tuning.js?v=1787385309';
import { atHome, livingCount, addMeals, mealsOf, takeMeal, totalMeals } from './save.js?v=1787385309';
import { CATALOG, okChoice } from './events.js?v=1787385309';

let L = null;
export function linkExtra(lib) { L = lib; }

const add = clamp;
const rnd = Math.random;

/** 선택지가 하나뿐인 "좋은 일"을 짧게 적기 위한 도구 */
const nice = (id, title, chance, cooldown, when, body, label, apply) =>
  ({ id, title, kind: 'ambient', chance, cooldown, when, body, choices: () => [okChoice(label, apply)] });

export function buildExtraEvents(sfx) {
  const play = (n) => { if (sfx) sfx.play(n); };

  const list = [

    // ══ 가족 ═════════════════════════════════════════════
    {
      id: 'marriage', title: '둘이 붙어 다닙니다', kind: 'forced', cooldown: 72,
      when: (s, p) => p.female && L.canMate(p) && L.findMateAtHome(s, p),
      body: (s, p) => {
        const m = L.findMateAtHome(s, p);
        return `${p.name}과(와) ${m ? m.name : '다른 아이'}이(가) 요즘 붙어 다닙니다.\n짝을 맺어 줄까요?`;
      },
      choices: () => [
        okChoice('맺어 준다', (s, p, e, t) => {
          const m = L.findMateAtHome(s, p);
          if (!m) return '때를 놓쳤습니다.';
          L.mate(s, p, m, t);
          play('tail');
          return `${p.name}이(가) 새끼를 뱄습니다.\n개의 ${T.pregnancyDays}일쯤 뒤에 낳습니다. 잘 먹여야 합니다.`;
        }),
        okChoice('아직은 아니다', () => '그냥 두기로 했습니다.'),
      ],
    },
    {
      id: 'birth', title: '새끼를 낳았습니다', kind: 'forced', cooldown: 0,
      when: () => false,
      body: (s, p, e) => {
        const room = Math.max(0, s.slots - livingCount(s));
        return `${p.name}이(가) 밤새 낑낑대더니 새끼 ${e.amount}마리를 낳았습니다.\n아직 눈도 못 떴습니다.\n\n집에 남은 자리는 ${room}칸입니다.`;
      },
      choices: (s) => [
        {
          label: '모두 키운다',
          enabled: (sv) => sv.slots - livingCount(sv) > 0,
          apply: (sv, p, e, t) => { play('yip'); return L.resolveLitter(sv, p, e.amount, e.amount, t); },
        },
        {
          label: '한 마리만 남긴다',
          enabled: (sv) => sv.slots - livingCount(sv) > 0,
          apply: (sv, p, e, t) => { play('coin'); return L.resolveLitter(sv, p, e.amount, 1, t); },
        },
        okChoice(`모두 좋은 집으로 보낸다 (마리당 ${won(T.adoptOutPuppy)})`,
          (sv, p, e, t) => { play('coin'); return L.resolveLitter(sv, p, e.amount, 0, t); }),
      ],
    },
    {
      id: 'walk_romance', title: '동네 개와 눈이 맞았습니다', kind: 'walk', cooldown: 96,
      when: (s, p) => p.female && L.canMate(p),
      body: (s, p) => `${p.name}이(가) 앞집 개 옆에서 안 떨어집니다.\n주인도 웃고 있습니다.`,
      choices: () => [
        {
          label: `주선한다 (${won(T.matingFee)})`, cost: T.matingFee,
          apply: (s, p, e, t) => {
            L.mateWithStranger(s, p, t, '앞집 진돌이', p.breedId);
            return `${p.name}이(가) 새끼를 뱄습니다. 앞집에서 축하한다고 합니다.`;
          },
        },
        okChoice('목줄을 당겨 데려온다', (s, p) => { p.mood = add(p.mood - 6); return '자꾸 뒤를 돌아봅니다.'; }),
      ],
    },
    {
      id: 'pup_photo', title: '사진이 왔습니다', kind: 'ambient', chance: 0.004, cooldown: 120,
      when: (s) => s.pets.some(x => x.bornHere),
      body: () => '예전에 보낸 아이의 사진이 왔습니다.\n많이 컸습니다. 잘 지내는 것 같습니다.',
      choices: () => [okChoice('한참 들여다본다', (s, p) => { p.mood = add(p.mood + 6); return '잘 지낸다니 됐습니다.'; })],
    },

    // ══ 대 잇기 ══════════════════════════════════════════
    {
      id: 'heir', title: '새끼가 하나 있다고 합니다', kind: 'forced', cooldown: 100000,
      when: (s, p, now) => p.stage === Stage.Senior && !p.dead && !p.lost
        && L.hoursLeftOfLife(p, now) <= T.heirOfferHours,
      body: (s, p) => {
        const room = Math.max(0, s.slots - livingCount(s));
        return `분양가게에서 연락이 왔습니다.\n"${p.name}의 새끼입니다. 생후 3개월이고요."\n\n` +
          `사진을 보니 ${p.name}이(가) 처음 왔을 때와 똑같이 생겼습니다.\n\n집에 남은 자리는 ${room}칸입니다.`;
      },
      choices: () => [
        {
          label: '데려온다',
          enabled: (sv) => livingCount(sv) < sv.slots,
          apply: (s, p, e, t) => {
            const h = L.makeHeir(s, p, t);
            play('yip');
            return `${h.name}이(가) 왔습니다.\n${p.name}이(가) 한참 냄새를 맡더니 옆에 눕습니다.`;
          },
        },
        okChoice('이 아이만으로 충분합니다', (s, p) => `${p.name} 곁을 지키기로 했습니다.`),
      ],
    },

    // ══ 나이 ═════════════════════════════════════════════
    {
      id: 'grew_old', title: '많이 늙었습니다', kind: 'forced', cooldown: 0,
      when: () => false,
      body: (s, p) => `${p.name}의 주둥이가 하얘졌습니다.\n계단을 오를 때 한 번 쉬어 갑니다. 잠도 늘었습니다.\n\n` +
        `이제부터는 잘 아프고, 산책도 힘들어합니다.\n앞으로 개의 나이로 5년쯤 함께할 수 있습니다.\n` +
        '이건 병이 아니라 나이라서, 병원으로는 못 막습니다.',
      choices: () => [okChoice('곁에 앉는다', (s, p) => { p.mood = add(p.mood + 12); return '무릎에 턱을 올립니다.'; })],
    },
    {
      id: 'last_days', title: '요즘 부쩍 잠이 늡니다', kind: 'forced', cooldown: 24,
      when: (s, p, now) => p.stage === Stage.Senior && !p.dead && !p.lost
        && L.hoursLeftOfLife(p, now) <= T.seniorWarningHours,
      body: (s, p, e) => {
        const h = Math.ceil(L.hoursLeftOfLife(p, e.at) / 24);
        return `${p.name}이(가) 볕 드는 자리에서 오래 잡니다.\n불러도 눈만 뜹니다.\n\n개의 시간으로 ${h}일쯤 남았습니다. 미리 알려 드립니다.`;
      },
      choices: () => [
        okChoice('좋아하던 간식을 준다', (s, p) => {
          p.mood = add(p.mood + 25); p.satiety = add(p.satiety + 20); play('eat');
          return '천천히, 다 먹었습니다.';
        }),
        okChoice('가만히 쓰다듬는다', (s, p) => { p.mood = add(p.mood + 20); return '꼬리를 두 번 칩니다.'; }),
      ],
    },

    // ══ 인형 ═════════════════════════════════════════════
    {
      id: 'doll_broken', title: '인형이 망가졌습니다', kind: 'forced', cooldown: 0,
      when: () => false,
      body: (s, p) => `바닥에 떨어져 있던 인형을 ${p.name}이(가) 물어뜯었습니다.\n팔이 하나 없습니다. 본인은 아주 만족스러운 얼굴입니다.`,
      choices: () => [
        okChoice('버린다', (s) => {
          const i = s.dolls.findIndex(d => d.state === 2);
          if (i >= 0) s.dolls.splice(i, 1);
          play('dong');
          return '망가진 인형을 버렸습니다. 용품점에서 새로 살 수 있습니다.';
        }),
        okChoice('일단 둔다', () => '바닥에 그대로 두었습니다. 나중에 탭해서 버릴 수 있습니다.'),
      ],
    },
    {
      id: 'doll_guard', title: '인형을 물고 안 놓습니다', kind: 'ambient', chance: 0.010, cooldown: 36,
      when: (s, p) => atHome(p) && !p.asleep && s.dolls.some(d => d.state === 1),
      body: (s, p) => `${p.name}이(가) 인형을 물고 방구석에 자리를 잡았습니다.\n다가가면 꼬리를 흔들면서도 안 놓습니다.`,
      choices: () => [
        okChoice('뺏는다', (s, p) => {
          const d = s.dolls.find(x => x.state === 1);
          if (d) L.pickUpDoll(s, d.id);
          p.mood = add(p.mood - 8);
          return '선반에 도로 올렸습니다. 한참 올려다봅니다.';
        }),
        okChoice('놀게 둔다', (s, p) => { p.mood = add(p.mood + 14); play('tail'); return '인형을 베고 누웠습니다.'; }),
      ],
    },

    // ══ 즐거운 일 ════════════════════════════════════════
    nice('first_sit', '앉기를 배웠습니다', 0.010, 60,
      (s, p) => p.stage === Stage.Puppy && p.mood > 55,
      (s, p) => `간식을 들고 있으니 ${p.name}이(가) 엉덩이를 붙입니다.\n처음입니다.`,
      '잘했다고 해 준다',
      (s, p) => { p.mood = add(p.mood + 16); p.social = add(p.social + 6); play('bark'); return '꼬리가 바닥을 칩니다.'; }),

    nice('knows_name', '이름을 알아듣습니다', 0.008, 96,
      (s, p) => p.stage >= Stage.Junior && p.mood > 50 && atHome(p),
      (s, p) => `부르니 ${p.name}이(가) 고개를 돌립니다.\n이제 자기 이름인 줄 압니다.`,
      '한 번 더 불러 본다',
      (s, p) => { p.mood = add(p.mood + 12); play('bark'); return '또 돌아봅니다. 몇 번을 해도 돌아봅니다.'; }),

    nice('zoomies', '우다다가 시작됐습니다', 0.014, 20,
      (s, p) => atHome(p) && !p.asleep && p.energy > 55 && p.mood > 45,
      (s, p) => `${p.name}이(가) 갑자기 방을 세 바퀴 돕니다.\n이유는 없습니다.`,
      '구경한다',
      (s, p) => { p.mood = add(p.mood + 10); p.energy = add(p.energy - 12); play('tail'); return '혼자 신나서 러그를 밀고 다닙니다.'; }),

    nice('dream', '꿈을 꿉니다', 0.012, 18,
      (s, p) => p.asleep && atHome(p),
      (s, p) => `자던 ${p.name}이(가) 발을 젓습니다.\n어디를 뛰고 있는 모양입니다.`,
      '이불을 덮어 준다',
      (s, p) => { p.mood = add(p.mood + 8); play('snore'); return '코를 붑니다.'; }),

    nice('belly', '배를 보입니다', 0.010, 30,
      (s, p) => atHome(p) && !p.asleep && p.mood > 65,
      (s, p) => `${p.name}이(가) 발라당 누워 배를 보입니다.\n믿는다는 뜻입니다.`,
      '배를 만져 준다',
      (s, p) => { p.mood = add(p.mood + 14); play('whine'); return '뒷다리를 파닥거립니다.'; }),

    nice('toy_found', '잃어버린 공을 찾았습니다', 0.008, 72,
      (s, p) => atHome(p) && !p.asleep,
      (s, p) => `소파 밑에서 ${p.name}이(가) 공을 물고 나옵니다.\n한참 없던 겁니다.`,
      '같이 논다',
      (s, p) => { p.mood = add(p.mood + 18); p.energy = add(p.energy - 10); p.playCount = (p.playCount || 0) + 1; play('bark'); return '안 놓습니다.'; }),

    nice('gift_chew', '개껌을 선물받았습니다', 0.006, 96,
      (s, p) => !p.dead,
      () => '옆집에서 개껌을 한 봉지 주고 갔습니다.\n"강아지 키우신다면서요."',
      '고맙게 받는다',
      (s) => { addMeals(s, 'treat', 5); play('coin'); return '간식 5개가 생겼습니다.'; }),

    nice('guest', '손님이 왔습니다', 0.007, 60,
      (s, p) => atHome(p) && !p.asleep && p.illness === 0,
      (s, p) => `친구가 놀러 왔습니다.\n${p.name}을(를) 보더니 예쁘다고 난리입니다.`,
      '인사시킨다',
      (s, p) => { p.social = add(p.social + 16); p.mood = add(p.mood + 10); play('bark'); return '무릎에 올라가 앉습니다.'; }),

    nice('snow', '첫눈이 왔습니다', 0.004, 240,
      (s, p) => atHome(p),
      (s, p) => `창밖이 하얗습니다.\n${p.name}이(가) 유리에 코를 대고 있습니다.`,
      '잠깐 안고 보여 준다',
      (s, p) => { p.mood = add(p.mood + 20); return '코에 김이 서립니다.'; }),

    nice('bath_after', '목욕하고 나서', 0.011, 24,
      (s, p) => atHome(p) && !p.asleep && p.clean > 90 && p.energy > 35,
      (s, p) => `막 씻긴 ${p.name}이(가) 몸을 털더니 이불에 얼굴을 비빕니다.`,
      '수건으로 감싸 준다',
      (s, p) => { p.mood = add(p.mood + 12); play('yawn'); return '수건 안에서 안 나오려고 합니다.'; }),

    nice('photo_hit', '사진이 잘 나왔습니다', 0.006, 72,
      (s, p) => atHome(p) && p.mood > 60,
      (s, p) => `우연히 찍은 ${p.name} 사진이 기가 막히게 나왔습니다.`,
      '자랑한다',
      (s) => { s.money += 10000; play('coin'); return '사람들이 좋아합니다. 용돈을 10,000원 더 받았습니다.'; }),

    nice('neighbor_praise', '칭찬을 들었습니다', 0.009, 48,
      (s, p) => atHome(p) && p.social > 40,
      (s, p) => `지나가던 분이 ${p.name}을(를) 보고 "참 순하게 생겼네" 합니다.`,
      '쑥스럽게 웃는다',
      (s, p) => { p.social = add(p.social + 10); p.mood = add(p.mood + 8); return '본인은 관심도 없습니다.'; }),

    nice('anniversary', '온 지 일주일입니다', 0.020, 100000,
      (s, p, now) => L.dogHoursBetween(p.adoptedAt, now) >= 7 * 24 && !p.bornHere,
      (s, p) => `${p.name}이(가) 이 집에 온 지 일주일이 됐습니다.\n처음 왔을 때는 손바닥만 했습니다.`,
      '간식을 준다',
      (s, p) => { addMeals(s, 'treat', 3); p.mood = add(p.mood + 18); play('ding'); return '간식 3개가 생겼습니다. 오늘은 실컷 줘도 되겠습니다.'; }),

    nice('sunspot', '볕에 누웠습니다', 0.012, 20,
      (s, p) => atHome(p) && !p.asleep,
      (s, p) => `창으로 들어온 볕에 ${p.name}이(가) 길게 누웠습니다.\n한참 안 움직입니다.`,
      '가만히 둔다',
      (s, p) => { p.mood = add(p.mood + 10); p.energy = add(p.energy + 8); return '숨소리가 고릅니다.'; }),

    nice('sneeze_cute', '재채기를 했습니다', 0.010, 30,
      (s, p) => atHome(p) && !p.asleep,
      (s, p) => `${p.name}이(가) 먼지를 마셨는지 조그맣게 재채기를 합니다.`,
      '웃는다',
      (s, p) => { p.mood = add(p.mood + 6); play('sneeze'); return '본인이 더 놀랐습니다.'; }),

    {
      id: 'puppy_school', title: '강아지 유치원 안내를 받았습니다', kind: 'ambient', chance: 0.005, cooldown: 120,
      when: (s, p) => atHome(p) && p.stage >= Stage.Junior,
      body: () => '동네에 강아지 유치원이 생겼습니다.\n하루 맡기면 다른 개들과 어울리는 법을 배운다고 합니다.',
      choices: () => [
        {
          label: '하루 보낸다 (30,000원)', cost: 30000,
          apply: (s, p) => {
            p.social = add(p.social + 35); p.mood = add(p.mood + 14);
            p.energy = add(p.energy - 20); p.outHours = (p.outHours || 0) + 1.5;
            play('ding');
            return `${p.name}이(가) 녹초가 되어 돌아왔습니다. 아주 잘 놀았답니다.`;
          },
        },
        okChoice('다음에 보낸다'),
      ],
    },
    {
      id: 'food_gift', title: '사료를 나눠 받았습니다', kind: 'walk', cooldown: 72,
      body: () => '산책길에 만난 견주가 사료를 바꿨다며 남은 걸 나눠 줍니다.\n"입맛에 맞을지 모르겠네요."',
      choices: () => [
        okChoice('고맙게 받는다', (s) => { addMeals(s, 'premium', 8); play('coin'); return '좋은 사료 8끼가 생겼습니다.'; }),
        okChoice('사양한다', (s, p) => { p.social = add(p.social + 4); return '인사만 하고 헤어졌습니다.'; }),
      ],
    },
    {
      id: 'walk_stream', title: '개울을 만났습니다', kind: 'walk', cooldown: 48,
      body: (s, p) => `${p.name}이(가) 물을 보더니 발을 담급니다.`,
      choices: () => [
        okChoice('들어가게 둔다', (s, p) => {
          p.mood = add(p.mood + 22); p.clean = add(p.clean - 30); p.energy = add(p.energy - 8);
          play('bark');
          return '온몸이 젖었습니다. 표정은 아주 좋습니다.';
        }),
        okChoice('발만 씻기고 나온다', (s, p) => { p.mood = add(p.mood + 8); p.clean = add(p.clean + 10); return '아쉬워하지만 발은 깨끗해졌습니다.'; }),
      ],
    },
    {
      id: 'walk_old_lady', title: '할머니가 부릅니다', kind: 'walk', cooldown: 60,
      body: (s, p) => `평상에 앉은 할머니가 손짓을 합니다.\n주머니에서 뭔가를 꺼내 ${p.name}에게 내밉니다.`,
      choices: () => [
        okChoice('받아먹게 한다', (s, p) => {
          p.mood = add(p.mood + 16); p.satiety = add(p.satiety + 10); p.social = add(p.social + 8);
          play('eat');
          return '받아먹고는 할머니 옆에 붙어 앉습니다.';
        }),
        okChoice('정중히 거절한다', (s, p) => { p.social = add(p.social + 4); return '할머니가 웃으며 손을 흔듭니다.'; }),
      ],
    },

    // ══ 곤란한 일 ════════════════════════════════════════
    {
      id: 'upset_tummy', title: '배탈이 났습니다', kind: 'ambient', chance: 0.006, cooldown: 60,
      when: (s, p) => atHome(p) && (p.satiety > 85 || (p.sameFoodStreak || 0) >= 2),
      body: (s, p) => `${p.name}이(가) 밤새 방을 서성이더니 바닥을 여러 군데 어질렀습니다.\n냄새가 만만치 않습니다.`,
      choices: () => [
        {
          label: `병원에 간다 (${won(T.clinicBasicPrice)})`, cost: T.clinicBasicPrice,
          apply: (s, p) => { p.clean = add(p.clean - 20); return '약을 받아 왔습니다. 하루면 괜찮아질 거라고 합니다.'; },
        },
        okChoice('굶기고 지켜본다', (s, p, e, t) => {
          p.satiety = add(p.satiety - 35); p.mood = add(p.mood - 12);
          for (let i = 0; i < 3; i++) L.dropPoop(s, t);
          if (rnd() < 0.35) L.setIllness(p, Illness.Weak, t);
          return '치울 게 늘었습니다. 기운이 없어 보입니다.';
        }),
      ],
    },
    {
      id: 'chocolate', title: '초콜릿을 주워 먹었습니다', kind: 'ambient', chance: 0.004, cooldown: 120,
      when: (s, p) => atHome(p) && !p.asleep,
      body: (s, p) => `탁자에 둔 초콜릿이 없어졌습니다.\n${p.name} 입가에 묻어 있습니다.\n\n개에게 초콜릿은 독입니다. 시간을 끌면 안 됩니다.`,
      choices: () => [
        {
          label: `지금 당장 병원에 간다 (${won(T.clinicFullPrice)})`, cost: T.clinicFullPrice,
          apply: (s, p) => { p.mood = add(p.mood - 10); return '토하게 하고 수액을 맞았습니다. 늦지 않았습니다.'; },
        },
        okChoice('조금 먹었으니 괜찮겠지', (s, p, e, t) => {
          if (rnd() < 0.7) {
            L.setIllness(p, Illness.Sick, t); p.health = add(p.health - 30);
            return '밤에 떨기 시작했습니다. 그냥 두면 안 되겠습니다.';
          }
          p.health = add(p.health - 10);
          return '다행히 별일 없이 넘어갔습니다. 다음엔 치워 둡시다.';
        }),
      ],
    },
    {
      id: 'knee', title: '뒷다리를 절뚝입니다', kind: 'ambient', chance: 0.005, cooldown: 96,
      when: (s, p) => atHome(p) && p.stage >= Stage.Adult && (p.walkCount || 0) > 6,
      body: (s, p) => `${p.name}이(가) 뒷다리를 들고 세 발로 걷습니다.\n작은 개들이 잘 겪는 슬개골 문제 같습니다.`,
      choices: () => [
        {
          label: `치료받는다 (${won(T.clinicFullPrice)})`, cost: T.clinicFullPrice,
          apply: (s, p) => { p.health = add(p.health + 15); return '당분간 멀리 걷는 건 피하라고 합니다.'; },
        },
        okChoice('쉬게 둔다', (s, p, e, t) => {
          p.mood = add(p.mood - 14); p.health = add(p.health - 12); p.lastWalkAt = t;
          return '산책을 못 나가니 답답해합니다.';
        }),
      ],
    },
    {
      id: 'matted_fur', title: '털이 뭉쳤습니다', kind: 'ambient', chance: 0.007, cooldown: 72,
      when: (s, p) => atHome(p) && p.clean < 45,
      body: (s, p) => `${p.name}의 겨드랑이와 귀 뒤가 딱딱하게 뭉쳤습니다.\n빗이 안 들어갑니다.`,
      choices: () => [
        {
          label: '미용실에 맡긴다 (35,000원)', cost: 35000,
          apply: (s, p) => { p.clean = 100; p.mood = add(p.mood - 6); return '짧게 깎고 왔습니다. 며칠은 어색해합니다.'; },
        },
        okChoice('직접 잘라 본다', (s, p) => {
          p.clean = add(p.clean + 35);
          if (rnd() < 0.4) {
            p.mood = add(p.mood - 18); p.health = add(p.health - 8);
            return '살을 조금 집었습니다. 깽 소리를 냈습니다. 미안합니다.';
          }
          return '어설프지만 뭉친 건 없어졌습니다.';
        }),
      ],
    },
    {
      id: 'food_spoiled', title: '사료가 상했습니다', kind: 'ambient', chance: 0.005, cooldown: 120,
      when: (s) => totalMeals(s) >= 10,
      body: () => '봉지를 열어 두었더니 사료에 습기가 찼습니다.\n냄새가 시큼합니다.',
      choices: () => [
        okChoice('버린다', (s) => {
          let lost = 0;
          for (const e of s.pantry) {
            const take = Math.min(e.meals, 8 - lost);
            e.meals -= take; lost += take;
            if (lost >= 8) break;
          }
          play('dong');
          return `${lost}끼를 버렸습니다.`;
        }),
        okChoice('그냥 준다', (s, p, e, t) => {
          if (rnd() < 0.55) { L.setIllness(p, Illness.Weak, t); return `${p.name}이(가) 먹고 나서 계속 핥습니다. 속이 안 좋은 모양입니다.`; }
          return '잘 먹습니다. 운이 좋았습니다.';
        }),
      ],
    },
    {
      id: 'accident_indoors', title: '집 안에 실수했습니다', kind: 'ambient', chance: 0.010, cooldown: 30,
      when: (s, p) => atHome(p) && p.stage <= Stage.Junior && p.poopDue.length > 0,
      body: (s, p) => `${p.name}이(가) 러그 한가운데에 실수했습니다.\n눈은 딴 데를 보고 있습니다.`,
      choices: () => [
        okChoice('말없이 치운다', (s, p, e, t) => { L.dropPoop(s, t); return '다음엔 나아지겠지요.'; }),
        okChoice('코를 대고 혼낸다', (s, p, e, t) => {
          L.dropPoop(s, t); p.mood = add(p.mood - 16); p.social = add(p.social - 6);
          return '구석에 들어가 안 나옵니다. 효과가 있을지는 모르겠습니다.';
        }),
      ],
    },
    {
      id: 'heat_wave', title: '더위가 심합니다', kind: 'ambient', chance: 0.005, cooldown: 96,
      when: (s, p) => atHome(p),
      body: (s, p) => `${p.name}이(가) 타일 바닥에 배를 붙이고 헥헥댑니다.\n혀가 길게 나와 있습니다.`,
      choices: () => [
        {
          label: '에어컨을 튼다 (전기세 12,000원)', cost: 12000,
          apply: (s, p) => { p.mood = add(p.mood + 12); p.energy = add(p.energy + 10); play('yawn'); return '바람 앞에 드러누웠습니다.'; },
        },
        okChoice('창문만 연다', (s, p) => {
          p.mood = add(p.mood - 10); p.health = add(p.health - 8); play('pant');
          return '계속 헥헥댑니다. 물을 자주 갈아 줘야겠습니다.';
        }),
      ],
    },
    {
      id: 'walk_bite', title: '다른 개에게 물렸습니다', kind: 'walk', cooldown: 96,
      body: (s, p) => `목줄 없는 큰 개가 달려들었습니다.\n${p.name}의 뒷다리에서 피가 납니다.`,
      choices: () => [
        {
          label: `바로 병원에 간다 (${won(T.clinicFullPrice)})`, cost: T.clinicFullPrice,
          apply: (s, p) => {
            p.mood = add(p.mood - 18); p.social = add(p.social - 20); p.health = add(p.health - 10);
            return '몇 바늘 꿰맸습니다. 당분간 그 골목은 피해야겠습니다.';
          },
        },
        okChoice('집에서 소독만 한다', (s, p, e, t) => {
          p.mood = add(p.mood - 22); p.social = add(p.social - 25); p.health = add(p.health - 20);
          L.setIllness(p, Illness.Weak, t);
          return '밤새 상처를 핥습니다. 부어오릅니다.';
        }),
      ],
    },
    {
      id: 'walk_car', title: '차가 옆으로 지나갔습니다', kind: 'walk', cooldown: 48,
      body: (s, p) => `경적 소리에 ${p.name}이(가) 펄쩍 뛰며 목줄을 당겼습니다.\n심장이 뛰는 게 손에 느껴집니다.`,
      choices: () => [
        okChoice('안아 들고 달랜다', (s, p) => { p.mood = add(p.mood - 6); return '품에서 한참 떨다가 조용해졌습니다.'; }),
        okChoice('그대로 걷는다', (s, p) => { p.mood = add(p.mood - 16); p.social = add(p.social - 12); return '남은 길 내내 뒤를 돌아봅니다.'; }),
      ],
    },
    {
      id: 'walk_lost_leash', title: '목줄을 놓쳤습니다', kind: 'walk', cooldown: 120,
      body: (s, p) => `손에서 줄이 빠졌습니다.\n${p.name}이(가) 골목 끝으로 뛰어갑니다.`,
      choices: () => [
        okChoice('이름을 부른다', (s, p, e, t) => {
          const back = 0.35 + p.social / 250 + (p.stage >= Stage.Junior ? 0.2 : 0);
          if (rnd() < back) { p.mood = add(p.mood + 8); play('bark'); return '멈춰 서더니 돌아옵니다. 다리에 힘이 풀립니다.'; }
          p.lost = true; p.lostSince = t;
          p.lostReturnAt = t + L.realSecondsFor(T.lostReturnMinHours + rnd() * (T.lostReturnMaxHours - T.lostReturnMinHours));
          play('sad');
          return '못 들은 척 모퉁이를 돌았습니다. 안 보입니다.';
        }),
        {
          label: '간식을 흔든다 (간식 1개)',
          enabled: (s) => mealsOf(s, 'treat') > 0,
          apply: (s, p) => { takeMeal(s, 'treat'); p.mood = add(p.mood + 10); play('eat'); return '봉지 소리를 듣고 곧장 달려왔습니다.'; },
        },
      ],
    },
  ];

  for (const e of list) CATALOG.push(e);
  return list.length;
}
