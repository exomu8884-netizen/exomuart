// 나머지 이벤트 — 즐거운 일, 가족(짝·출산·대 잇기), 인형, 나이, 곤란한 일.
// events.js 의 표에 밀어 넣는다.

import { T, Stage, Illness, clamp, won } from './tuning.js?v=1791623614';
import { atHome, livingCount, addMeals, mealsOf, takeMeal, totalMeals } from './save.js?v=1791623614';
import { CATALOG, okChoice } from './events.js?v=1791623614';

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
          return '못 들은 척 모퉁이를 돌았습니다. 안 보입니다.\n하루 이틀 안에 제 발로 돌아옵니다. 개집은 그대로 둡니다.';
        }),
        {
          label: '간식을 흔든다 (간식 1개)',
          enabled: (s) => mealsOf(s, 'treat') > 0,
          apply: (s, p) => { takeMeal(s, 'treat'); p.mood = add(p.mood + 10); play('eat'); return '봉지 소리를 듣고 곧장 달려왔습니다.'; },
        },
      ],
    },

    // ══ 집에서 있는 작은 일 ══════════════════════════════
    nice('sock_thief', '양말 한 짝이 없어졌습니다', 0.009, 36,
      (s, p) => atHome(p) && !p.asleep && p.stage <= Stage.Junior,
      (s, p) => `빨래 바구니가 쓰러져 있습니다.\n${p.name}이(가) 양말 한 짝을 물고 방을 돕니다.`,
      '쫓아가 본다',
      (s, p) => { p.mood = add(p.mood + 12); p.energy = add(p.energy - 8); play('bark'); return '잡으러 가니 더 신이 났습니다.'; }),

    nice('box_fort', '택배 상자에 들어갔습니다', 0.007, 60,
      (s, p) => atHome(p) && !p.asleep,
      (s, p) => `비워 둔 택배 상자에 ${p.name}이(가) 앉아 있습니다.\n몸이 꼭 맞습니다.`,
      '그대로 둔다',
      (s, p) => { p.mood = add(p.mood + 10); return '한참을 안 나옵니다.'; }),

    nice('window_birds', '창밖을 봅니다', 0.011, 24,
      (s, p) => atHome(p) && !p.asleep,
      (s, p) => `${p.name}이(가) 창틀에 턱을 올리고 밖을 봅니다.\n참새가 앉았다 갑니다.`,
      '옆에 앉는다',
      (s, p) => { p.mood = add(p.mood + 8); play('whine'); return '입으로 캬르르 소리를 냅니다.'; }),

    nice('shoe_pillow', '신발을 베고 잡니다', 0.008, 48,
      (s, p) => atHome(p) && p.asleep,
      (s, p) => `현관에 벗어 둔 신발 위에 ${p.name}이(가) 턱을 올리고 자고 있습니다.`,
      '사진을 찍는다',
      (s, p) => { p.mood = add(p.mood + 10); p.social = add(p.social + 4); return '냄새가 나야 잠이 오는 모양입니다.'; }),

    nice('blanket_dig', '이불 속으로 들어갔습니다', 0.010, 30,
      (s, p) => atHome(p) && !p.asleep && p.energy < 55,
      (s, p) => `${p.name}이(가) 앞발로 이불을 파더니 그 안으로 들어갔습니다.\n꼬리만 나와 있습니다.`,
      '덮어 준다',
      (s, p) => { p.mood = add(p.mood + 12); p.energy = add(p.energy + 6); play('yawn'); return '안에서 한 번 뒤척이고 조용해졌습니다.'; }),

    nice('head_tilt', '고개를 갸웃합니다', 0.012, 20,
      (s, p) => atHome(p) && !p.asleep && p.social > 25,
      (s, p) => `무슨 말을 하니 ${p.name}이(가) 고개를 옆으로 꺾습니다.\n알아듣는 것 같기도 합니다.`,
      '한 번 더 말해 본다',
      (s, p) => { p.mood = add(p.mood + 8); p.social = add(p.social + 6); return '반대쪽으로 꺾습니다.'; }),

    nice('rain_sound', '빗소리를 듣습니다', 0.006, 72,
      (s, p) => atHome(p) && !p.asleep,
      (s, p) => `창을 때리는 빗소리에 ${p.name}이(가) 귀를 세웁니다.\n나가자는 말은 안 합니다.`,
      '같이 듣는다',
      (s, p) => { p.mood = add(p.mood + 9); p.energy = add(p.energy + 5); return '곧 다시 엎드립니다.'; }),

    nice('tail_chase', '제 꼬리를 쫓습니다', 0.010, 28,
      (s, p) => atHome(p) && !p.asleep && p.stage <= Stage.Junior && p.energy > 50,
      (s, p) => `${p.name}이(가) 제자리에서 빙빙 돕니다.\n잡으려는 게 제 꼬리입니다.`,
      '지켜본다',
      (s, p) => { p.mood = add(p.mood + 11); p.energy = add(p.energy - 10); play('tail'); return '몇 바퀴 돌더니 어지러운지 앉습니다.'; }),

    nice('sigh_at_feet', '발치에 엎드렸습니다', 0.011, 24,
      (s, p) => atHome(p) && !p.asleep && p.social > 30,
      (s, p) => `${p.name}이(가) 발등에 턱을 올리고 길게 숨을 내쉽니다.`,
      '가만히 둔다',
      (s, p) => { p.mood = add(p.mood + 10); p.social = add(p.social + 8); return '발이 저릴 때까지 안 움직입니다.'; }),

    nice('night_watch', '현관을 지킵니다', 0.007, 48,
      (s, p) => atHome(p) && !p.asleep && L.isNight(s) && p.stage >= Stage.Junior,
      (s, p) => `불을 끄니 ${p.name}이(가) 현관 쪽을 보고 앉습니다.\n한참을 그러고 있습니다.`,
      '불을 조금 켜 둔다',
      (s, p) => { p.mood = add(p.mood + 8); p.social = add(p.social + 5); return '그제야 자리로 돌아갑니다.'; }),

    nice('first_bark', '처음 짖었습니다', 0.012, 100000,
      (s, p) => atHome(p) && !p.asleep && p.stage === Stage.Puppy && p.mood > 40,
      (s, p) => `초인종 소리에 ${p.name}이(가) 소리를 냈습니다.\n짖는다기보다 삑 하는 쪽에 가깝습니다.`,
      '놀란 표정을 지어 준다',
      (s, p) => { p.mood = add(p.mood + 16); play('yip'); return '자기 소리에 자기가 더 놀랐습니다.'; }),

    nice('gray_muzzle', '입 주변이 하얘졌습니다', 0.006, 168,
      (s, p) => atHome(p) && p.stage === Stage.Senior,
      (s, p) => `${p.name} 입 주변 털이 하얗게 셌습니다.\n언제 이렇게 됐는지 모르겠습니다.`,
      '한참 들여다본다',
      (s, p) => { p.mood = add(p.mood + 8); p.social = add(p.social + 6); return '눈은 그대로입니다.'; }),

    // ══ 살림 ═════════════════════════════════════════════
    {
      id: 'plant_pot', title: '화분이 엎어졌습니다', kind: 'ambient', chance: 0.007, cooldown: 60,
      when: (s, p) => atHome(p) && !p.asleep && p.energy > 45,
      body: (s, p) => `거실에 흙이 쏟아져 있습니다.\n${p.name} 코끝이 까맣습니다.`,
      choices: () => [
        okChoice('치우고 화분을 올린다', (s, p) => {
          p.clean = add(p.clean - 25);
          return '손이 좀 갔습니다. 화분은 높은 데로 옮겼습니다.';
        }),
        okChoice('혼낸다', (s, p) => {
          p.mood = add(p.mood - 14); p.social = add(p.social - 6);
          return '귀를 접고 눈치를 봅니다. 흙은 그대로입니다.';
        }),
      ],
    },
    {
      id: 'toilet_paper', title: '휴지를 다 풀었습니다', kind: 'ambient', chance: 0.008, cooldown: 72,
      when: (s, p) => atHome(p) && !p.asleep && p.stage <= Stage.Junior,
      body: (s, p) => `화장실 문이 열려 있었습니다.\n복도 끝까지 휴지가 깔려 있고 ${p.name}이(가) 그 가운데 앉아 있습니다.`,
      choices: () => [
        okChoice('웃고 치운다', (s, p) => { p.mood = add(p.mood + 8); return '다시 감기는 건 포기했습니다.'; }),
        okChoice('문을 닫는 습관을 들인다', (s, p) => { p.mood = add(p.mood - 5); return '다음부터는 문을 닫기로 했습니다.'; }),
      ],
    },
    {
      id: 'remote_hidden', title: '리모컨이 없어졌습니다', kind: 'ambient', chance: 0.006, cooldown: 96,
      when: (s, p) => atHome(p),
      body: (s, p) => `한참 찾다가 소파 밑에서 나왔습니다.\n${p.name} 이빨 자국이 선명합니다.`,
      choices: () => [
        okChoice('그냥 쓴다', () => '단추는 눌립니다. 됐습니다.'),
        {
          label: '새로 산다 (20,000원)', cost: 20000,
          apply: (s) => { play('coin'); return '이번엔 서랍에 넣어 두기로 했습니다.'; },
        },
      ],
    },
    {
      id: 'laundry_nest', title: '빨래 위에 앉았습니다', kind: 'ambient', chance: 0.009, cooldown: 40,
      when: (s, p) => atHome(p) && !p.asleep,
      body: (s, p) => `개 둔 빨래 더미가 무너져 있습니다.\n${p.name}이(가) 그 위에 자리를 잡았습니다.`,
      choices: () => [
        okChoice('자게 둔다', (s, p) => { p.mood = add(p.mood + 12); p.energy = add(p.energy + 8); return '다시 개는 건 내일 일입니다.'; }),
        okChoice('들어 올려 옮긴다', (s, p) => { p.mood = add(p.mood - 6); return '내려놓자마자 다시 올라갑니다.'; }),
      ],
    },
    {
      id: 'stash', title: '소파 밑에 모아 뒀습니다', kind: 'ambient', chance: 0.005, cooldown: 120,
      when: (s, p) => atHome(p) && p.stage >= Stage.Junior,
      body: (s, p) => `소파를 밀어 보니 공, 양말, 말린 간식이 나란히 있습니다.\n${p.name}이(가) 하나씩 옮겨 둔 모양입니다.`,
      choices: () => [
        okChoice('그대로 덮어 둔다', (s, p) => { p.mood = add(p.mood + 10); return '본인 살림입니다. 건드리지 않기로 했습니다.'; }),
        okChoice('간식만 돌려받는다', (s) => { addMeals(s, 'treat', 2); play('coin'); return '간식 2개를 되찾았습니다.'; }),
      ],
    },

    // ══ 산책에서 ═════════════════════════════════════════
    {
      id: 'walk_cat', title: '고양이와 마주쳤습니다', kind: 'walk', cooldown: 48,
      body: (s, p) => `담장 위에 고양이가 앉아 있습니다.\n${p.name}이(가) 멈춰 서서 올려다봅니다.`,
      choices: () => [
        okChoice('그냥 지나간다', (s, p) => { p.social = add(p.social + 6); return '몇 번 돌아보더니 따라옵니다.'; }),
        okChoice('인사하게 둔다', (s, p) => {
          if (rnd() < 0.5) { p.mood = add(p.mood + 14); p.social = add(p.social + 12); return '서로 코를 대 보고는 각자 갈 길을 갑니다.'; }
          p.mood = add(p.mood - 10); play('yip');
          return '고양이가 앞발을 휘둘렀습니다. 코끝이 빨개졌습니다.';
        }),
      ],
    },
    {
      id: 'walk_pigeons', title: '비둘기 떼가 있습니다', kind: 'walk', cooldown: 36,
      body: (s, p) => `광장 바닥에 비둘기가 잔뜩 앉아 있습니다.\n${p.name}이(가) 몸을 낮춥니다.`,
      choices: () => [
        okChoice('줄을 늦춰 준다', (s, p) => {
          p.mood = add(p.mood + 16); p.energy = add(p.energy - 12); play('bark');
          return '한 마리도 못 잡았습니다. 본인은 아주 만족합니다.';
        }),
        okChoice('돌아서 간다', (s, p) => { p.mood = add(p.mood - 5); return '자꾸 뒤를 봅니다.'; }),
      ],
    },
    {
      id: 'walk_no_bag', title: '배변봉투를 안 가져왔습니다', kind: 'walk', cooldown: 72,
      body: (s, p) => `${p.name}이(가) 길 한복판에서 볼일을 봤습니다.\n주머니를 뒤져 보니 봉투가 없습니다.`,
      choices: () => [
        okChoice('편의점에서 사 온다 (2,000원)', (s, p) => {
          s.money = Math.max(0, s.money - 2000); p.social = add(p.social + 6);
          return '치우고 왔습니다. 지나던 분이 고개를 끄덕입니다.';
        }),
        okChoice('모른 척 간다', (s, p) => {
          p.social = add(p.social - 14);
          return '뒤통수가 따갑습니다. 다음부터는 챙기기로 했습니다.';
        }),
      ],
    },
    {
      id: 'walk_sudden_rain', title: '소나기가 쏟아집니다', kind: 'walk', cooldown: 48,
      body: (s, p) => `하늘이 갑자기 어두워지더니 비가 쏟아집니다.\n${p.name}이(가) 처마 밑으로 파고듭니다.`,
      choices: () => [
        okChoice('그치길 기다린다', (s, p) => {
          p.mood = add(p.mood + 6); p.energy = add(p.energy - 6); p.outHours = (p.outHours || 0) + 0.5;
          return '처마 밑에서 한참 같이 앉아 있었습니다.';
        }),
        okChoice('안고 뛴다', (s, p) => {
          p.clean = add(p.clean - 25); p.mood = add(p.mood + 10); p.social = add(p.social + 6);
          return '둘 다 흠뻑 젖었습니다. 품에서는 가만히 있었습니다.';
        }),
      ],
    },
    {
      id: 'walk_photo_request', title: '사진을 찍어도 되냐고 합니다', kind: 'walk', cooldown: 60,
      body: (s, p) => `지나가던 분이 멈춰 서서 ${p.name}을(를) 가리킵니다.\n"한 장만 찍어도 될까요?"`,
      choices: () => [
        okChoice('찍게 해 준다', (s, p) => {
          p.social = add(p.social + 14); p.mood = add(p.mood + 8); play('ding');
          return '카메라를 보고 고개를 돌려 버렸습니다. 그래도 좋아합니다.';
        }),
        okChoice('웃으며 사양한다', (s, p) => { p.social = add(p.social + 4); return '인사만 하고 헤어졌습니다.'; }),
      ],
    },
    {
      id: 'walk_puddle', title: '웅덩이를 발견했습니다', kind: 'walk', cooldown: 36,
      body: (s, p) => `비 온 자리에 흙탕물이 고여 있습니다.\n${p.name}이(가) 벌써 한 발을 넣었습니다.`,
      choices: () => [
        okChoice('들어가게 둔다', (s, p) => {
          p.mood = add(p.mood + 20); p.clean = add(p.clean - 35);
          return '배까지 까맣습니다. 집에 가면 바로 씻겨야 합니다.';
        }),
        okChoice('번쩍 들어 건넌다', (s, p) => { p.mood = add(p.mood - 6); p.energy = add(p.energy - 4); return '내려놓으니 웅덩이 쪽을 봅니다.'; }),
      ],
    },
    {
      id: 'walk_hot_ground', title: '바닥이 뜨겁습니다', kind: 'walk', cooldown: 48,
      when: (s, p) => p.stage <= Stage.Adult,
      body: (s, p) => `손을 대 보니 아스팔트가 뜨겁습니다.\n${p.name}이(가) 발을 번갈아 듭니다.`,
      choices: () => [
        okChoice('그늘로 돌아간다', (s, p) => { p.mood = add(p.mood - 4); p.health = add(p.health + 3); return '흙길로 돌아 왔습니다. 조금 돌았지만 낫습니다.'; }),
        okChoice('안고 건넌다', (s, p) => { p.social = add(p.social + 8); p.energy = add(p.energy - 5); return '내려놓으니 발바닥을 핥습니다.'; }),
        okChoice('그냥 걷는다', (s, p, e, t) => {
          p.health = add(p.health - 12); p.mood = add(p.mood - 12);
          if (rnd() < 0.3) L.setIllness(p, Illness.Weak, t);
          return '발바닥이 빨갛게 익었습니다. 절뚝거립니다.';
        }),
      ],
    },
    {
      id: 'walk_leftover', title: '길에 음식이 떨어져 있습니다', kind: 'walk', cooldown: 60,
      body: (s, p) => `전봇대 옆에 누가 버린 닭뼈가 있습니다.\n${p.name}이(가) 코를 박습니다.`,
      choices: () => [
        okChoice('얼른 떼어 놓는다', (s, p) => { p.mood = add(p.mood - 8); p.social = add(p.social + 4); return '아쉬워하지만 큰일은 면했습니다.'; }),
        okChoice('간식으로 바꿔 준다', (s, p) => {
          if (mealsOf(s, 'treat') > 0) { takeMeal(s, 'treat'); p.mood = add(p.mood + 10); play('eat'); return '간식 하나로 바로 잊었습니다.'; }
          p.mood = add(p.mood - 6);
          return '줄 간식이 없습니다. 억지로 끌고 왔습니다.';
        }),
      ],
    },

    // ══ 몸 ═══════════════════════════════════════════════
    {
      id: 'nails_long', title: '발톱이 길었습니다', kind: 'ambient', chance: 0.006, cooldown: 120,
      when: (s, p) => atHome(p) && p.stage >= Stage.Junior && (p.homeHours || 0) > (p.outHours || 0) * 10,
      body: (s, p) => `${p.name}이(가) 걸을 때마다 바닥에서 딱딱 소리가 납니다.\n발톱이 많이 길었습니다.`,
      choices: () => [
        {
          label: `미용실에서 깎는다 (${won(20000)})`, cost: 20000,
          apply: (s, p) => { p.health = add(p.health + 6); p.clean = add(p.clean + 8); play('ding'); return '얌전히 있었다고 합니다.'; },
        },
        okChoice('집에서 깎아 본다', (s, p) => {
          if (rnd() < 0.65) { p.health = add(p.health + 4); p.social = add(p.social + 6); return '한 발씩 쉬어 가며 다 깎았습니다.'; }
          p.health = add(p.health - 8); p.mood = add(p.mood - 16); play('yip');
          return '너무 바싹 잘라 피가 났습니다. 다음엔 안 맡기려 할 겁니다.';
        }),
        okChoice('그냥 둔다', (s, p) => { p.health = add(p.health - 6); return '걷는 자세가 조금 이상해졌습니다.'; }),
      ],
    },
    {
      id: 'ear_itch', title: '귀를 자꾸 긁습니다', kind: 'ambient', chance: 0.006, cooldown: 96,
      when: (s, p) => atHome(p) && p.clean < 60,
      body: (s, p) => `${p.name}이(가) 한쪽 귀만 계속 긁습니다.\n들여다보니 속이 벌겋고 냄새가 납니다.`,
      choices: () => [
        {
          label: `병원에 간다 (${won(T.clinicBasicPrice)})`, cost: T.clinicBasicPrice,
          apply: (s, p) => { p.health = add(p.health + 10); p.clean = add(p.clean + 10); return '약을 넣고 왔습니다. 며칠이면 낫는다고 합니다.'; },
        },
        okChoice('귀만 닦아 준다', (s, p, e, t) => {
          p.clean = add(p.clean + 12);
          if (rnd() < 0.4) { L.setIllness(p, Illness.Weak, t); return '그때뿐입니다. 밤에 또 긁습니다.'; }
          return '한결 나아 보입니다.';
        }),
      ],
    },
    {
      id: 'bad_breath', title: '입냄새가 납니다', kind: 'ambient', chance: 0.005, cooldown: 168,
      when: (s, p) => atHome(p) && p.stage >= Stage.Adult,
      body: (s, p) => `${p.name}이(가) 하품할 때마다 냄새가 훅 납니다.\n이빨에 누런 것이 끼었습니다.`,
      choices: () => [
        {
          label: `스케일링을 받는다 (${won(T.clinicFullPrice)})`, cost: T.clinicFullPrice,
          apply: (s, p) => { p.health = add(p.health + 14); play('ding'); return '마취에서 깨어 비틀거립니다. 이빨은 하얗습니다.'; },
        },
        okChoice('개껌으로 버틴다', (s) => {
          addMeals(s, 'treat', 2);
          return '간식 2개를 사 왔습니다. 당장은 이쪽입니다.';
        }),
      ],
    },
    {
      id: 'shedding', title: '털갈이가 시작됐습니다', kind: 'ambient', chance: 0.007, cooldown: 120,
      when: (s, p) => atHome(p) && p.stage >= Stage.Junior,
      body: (s, p) => `쓸어도 쓸어도 털이 나옵니다.\n${p.name}을(를) 한 번 쓰다듬으면 손에 한 줌입니다.`,
      choices: () => [
        okChoice('빗겨 준다', (s, p) => {
          p.clean = add(p.clean + 18); p.mood = add(p.mood + 10); p.social = add(p.social + 6);
          return '눈을 반쯤 감고 가만히 있습니다.';
        }),
        okChoice('청소기를 돌린다', (s, p) => {
          p.mood = add(p.mood - 10); p.energy = add(p.energy - 5);
          return '방은 깨끗해졌습니다. 청소기 소리에 침대 밑으로 숨었습니다.';
        }),
      ],
    },
    {
      id: 'night_bark', title: '밤새 짖었습니다', kind: 'ambient', chance: 0.006, cooldown: 96,
      when: (s, p) => atHome(p) && p.social < 35 && p.stage >= Stage.Junior,
      body: (s, p) => `새벽에 ${p.name}이(가) 현관을 보고 한참 짖었습니다.\n아무도 없었습니다.`,
      choices: () => [
        okChoice('곁에 가서 재운다', (s, p) => {
          p.social = add(p.social + 14); p.mood = add(p.mood + 8); p.energy = add(p.energy - 6);
          return '옆에 앉아 있으니 금방 잠들었습니다.';
        }),
        okChoice('모른 척한다', (s, p) => {
          p.social = add(p.social - 10); p.mood = add(p.mood - 10);
          return '한참 더 짖다가 그쳤습니다. 아침에 눈이 부어 있습니다.';
        }),
      ],
    },
    {
      id: 'cold_snap', title: '한파가 왔습니다', kind: 'ambient', chance: 0.005, cooldown: 120,
      when: (s, p) => atHome(p) && p.stage !== Stage.Adult,
      body: (s, p) => `아침에 창에 성에가 꼈습니다.\n${p.name}이(가) 몸을 동그랗게 말고 떱니다.`,
      choices: () => [
        {
          label: `옷을 사 입힌다 (${won(25000)})`, cost: 25000,
          apply: (s, p) => { p.health = add(p.health + 10); p.mood = add(p.mood + 6); play('coin'); return '처음엔 굳어 있더니 금세 익숙해졌습니다.'; },
        },
        okChoice('담요를 깔아 준다', (s, p) => { p.health = add(p.health + 5); p.mood = add(p.mood + 8); return '담요 위에서 안 내려옵니다.'; }),
        okChoice('그냥 둔다', (s, p, e, t) => {
          p.health = add(p.health - 12);
          if (rnd() < 0.35) L.setIllness(p, Illness.Weak, t);
          return '밤새 떨었습니다. 콧물이 비칩니다.';
        }),
      ],
    },
    {
      id: 'teething', title: '이갈이를 합니다', kind: 'ambient', chance: 0.009, cooldown: 60,
      when: (s, p) => atHome(p) && p.stage === Stage.Puppy,
      body: (s, p) => `${p.name}이(가) 아무거나 물고 있습니다.\n잇몸에서 젖니가 하나 빠져 있습니다.`,
      choices: () => [
        okChoice('개껌을 준다', (s, p) => {
          addMeals(s, 'treat', 2); p.mood = add(p.mood + 10); play('eat');
          return '간식 2개가 생겼습니다. 물 것이 생기니 조용해졌습니다.';
        }),
        okChoice('물지 말라고 가르친다', (s, p) => {
          p.mood = add(p.mood - 8); p.social = add(p.social + 10);
          return '몇 번을 떼어 놓으니 손은 안 뭅니다. 가구는 아직입니다.';
        }),
      ],
    },
    {
      id: 'senior_stairs', title: '계단을 못 오릅니다', kind: 'ambient', chance: 0.007, cooldown: 96,
      when: (s, p) => atHome(p) && p.stage === Stage.Senior,
      body: (s, p) => `${p.name}이(가) 계단 앞에서 올려다보기만 합니다.\n예전에는 뛰어 올라갔습니다.`,
      choices: () => [
        okChoice('안아서 올려 준다', (s, p) => { p.mood = add(p.mood + 10); p.social = add(p.social + 8); return '품에서 한참 안 내려오려고 합니다.'; }),
        {
          label: `계단을 놓아 준다 (${won(35000)})`, cost: 35000,
          apply: (s, p) => { p.mood = add(p.mood + 14); p.health = add(p.health + 6); play('ding'); return '제 발로 소파에 올라갑니다. 표정이 달라졌습니다.'; },
        },
      ],
    },

    // ══ 돈이 되는 일 ═════════════════════════════════════
    {
      id: 'photo_contest', title: '사진 대회가 열렸습니다', kind: 'ambient', chance: 0.005, cooldown: 168,
      when: (s, p) => atHome(p) && p.mood > 55,
      body: (s, p) => `동네 상가에서 반려견 사진 대회를 합니다.\n참가비가 있고, 뽑히면 상금을 줍니다.`,
      choices: () => [
        {
          label: `한 장 내 본다 (${won(10000)})`, cost: 10000,
          apply: (s, p) => {
            const win = rnd() < 0.3 + p.mood / 400;
            if (win) { s.money += 150000; play('coin'); return `${p.name} 사진이 뽑혔습니다. 상금 150,000원이 들어왔습니다.`; }
            p.mood = add(p.mood + 6);
            return '떨어졌습니다. 그래도 사진은 잘 나왔습니다.';
          },
        },
        okChoice('구경만 한다', (s, p) => { p.social = add(p.social + 6); return '남의 집 개들을 한참 봤습니다.'; }),
      ],
    },
    {
      id: 'group_buy', title: '사료 공동구매가 열렸습니다', kind: 'ambient', chance: 0.006, cooldown: 120,
      when: (s) => s.money >= 40000,
      body: () => '동네 모임에서 사료를 묶어 삽니다.\n한 사람 몫만 받으면 꽤 쌉니다.',
      choices: () => [
        {
          label: `좋은 사료 20끼 (${won(40000)})`, cost: 40000,
          apply: (s) => { addMeals(s, 'premium', 20); play('coin'); return '좋은 사료 20끼가 생겼습니다. 평소의 반값입니다.'; },
        },
        {
          label: `일반 사료 30끼 (${won(20000)})`, cost: 20000,
          apply: (s) => { addMeals(s, 'basic', 30); play('coin'); return '일반 사료 30끼가 생겼습니다.'; },
        },
        okChoice('이번엔 거른다'),
      ],
    },
    {
      id: 'neighbor_sitting', title: '옆집 개를 맡아 달라고 합니다', kind: 'ambient', chance: 0.005, cooldown: 168,
      when: (s, p) => atHome(p) && p.stage >= Stage.Junior && p.social > 40 && p.illness === 0,
      body: (s, p) => `옆집이 이틀 집을 비운다고 합니다.\n개를 맡아 주면 사례하겠답니다. ${p.name}과(와) 사이는 나쁘지 않습니다.`,
      choices: () => [
        okChoice('맡는다 (50,000원을 받는다)', (s, p) => {
          s.money += 50000; p.social = add(p.social + 20); p.mood = add(p.mood + 8);
          p.energy = add(p.energy - 15); p.clean = add(p.clean - 10);
          play('coin');
          return '이틀 내내 둘이 붙어 다녔습니다. 50,000원을 받았습니다.';
        }),
        okChoice('사양한다', (s, p) => { p.social = add(p.social - 4); return '다음에 꼭 부탁한다고 합니다.'; }),
      ],
    },
    {
      id: 'vet_checkup', title: '건강검진 안내를 받았습니다', kind: 'ambient', chance: 0.005, cooldown: 168,
      when: (s, p) => atHome(p) && p.stage >= Stage.Adult,
      body: (s, p) => `단골 병원에서 연락이 왔습니다.\n${p.name} 나이면 한 번쯤 전체를 봐 두는 게 좋다고 합니다.`,
      choices: () => [
        {
          label: `검진을 받는다 (${won(T.clinicFullPrice)})`, cost: T.clinicFullPrice,
          apply: (s, p, e, t) => {
            p.health = add(p.health + 20);
            if (p.illness > Illness.None) { L.setIllness(p, Illness.None, t); return '초기에 잡았습니다. 약을 받아 왔고 이제 괜찮습니다.'; }
            return '다 괜찮다고 합니다. 한결 마음이 놓입니다.';
          },
        },
        okChoice('나중에 간다'),
      ],
    },
  ];

  for (const e of list) CATALOG.push(e);
  return list.length;
}
