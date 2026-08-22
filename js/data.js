// 품종과 사료 표. 여기에 줄을 늘리면 게임에 는다.

export const BREEDS = [
  {
    id: 'pom',
    name: '포메라니안',
    blurb: '작고 잘 짖습니다. 털이 많아 자주 씻겨야 합니다.',
    price: 60000,
    model: 'pom',            // models/pom.glb
    tint: 0xe6b86b,          // 모델이 없을 때 쓸 색
    satietyRate: 1.1,
    moodRate: 1.15,
    illnessRate: 1.0,
    energyRate: 1.1,
  },
];

export const breedOf = (id) => BREEDS.find(b => b.id === id) || BREEDS[0];

// ── 성격 ──────────────────────────────────────────────────
// 1차 갈림길: 밥을 더 줬나(F) 더 놀아 줬나(P)
// 2차 갈림길: 자주 데리고 나갔나(S) 집에만 있었나(H)

export const AXIS = { fed: 'F', play: 'P', social: 'S', home: 'H' };

const TEMPER_NAMES = {
  FS: '의젓한', FH: '느긋한', PS: '활발한', PH: '새침한',
  F: '잘 먹는', P: '잘 노는',
};

export const temperName = (t) => TEMPER_NAMES[t] || '';

/** 도감에 적는 설명. 갈림길 기준을 숨기지 않는다. */
export function temperStory(t) {
  if (!t) return '';
  const a = t[0] === 'F' ? '밥을 잘 챙겨 먹였고' : '많이 놀아 주었고';
  if (t.length < 2) return a.slice(0, -1) + '습니다.';
  const b = t[1] === 'S' ? '자주 데리고 나갔습니다.' : '주로 집에서 지냈습니다.';
  return a + ', ' + b;
}

export const stageName = (s) => ['새끼', '중간', '다 자람', '노견'][s] || '?';

// ── 사료 ──────────────────────────────────────────────────
// 같은 걸 3번 연달아 주면 물린다 — 그래서 종류가 의미가 있다.

export const FOODS = [
  {
    id: 'basic', name: '일반 사료', blurb: '무난합니다. 계속 주면 물립니다.',
    price: 8000, meals: 20, satiety: 45, mood: 2, health: 0,
  },
  {
    id: 'puppy', name: '새끼용 사료', blurb: '알갱이가 작습니다. 새끼가 잘 먹습니다.',
    price: 12000, meals: 20, satiety: 40, mood: 5, health: 1, forPuppy: true,
  },
  {
    id: 'premium', name: '좋은 사료', blurb: '비쌉니다. 잘 먹고 건강해집니다.',
    price: 18000, meals: 20, satiety: 50, mood: 9, health: 2,
  },
  {
    id: 'vet', name: '처방식', blurb: '아플 때 먹입니다. 병이 깊어지는 걸 늦춥니다.',
    price: 22000, meals: 10, satiety: 35, mood: 0, health: 6, prescription: true,
  },
  {
    id: 'treat', name: '간식', blurb: '좋아합니다. 배는 별로 안 찹니다.',
    price: 3000, meals: 5, satiety: 12, mood: 22, health: 0, isTreat: true,
  },
];

export const foodOf = (id) => FOODS.find(f => f.id === id) || null;

// ── 집에서 태어난 새끼 이름 ───────────────────────────────
export const PUPPY_NAMES = [
  '뭉치', '초코', '봄이', '콩이', '보리', '하양', '까망', '두부',
  '감자', '밤톨', '구름', '별이', '송이', '달이', '복실', '누리',
];
