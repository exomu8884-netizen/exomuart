// 밸런스 상수를 한 곳에.
//
// 시간 단위는 전부 "개의 시간"이다. 기본값 12배속이면 현실 2시간이 개에게 하루다.
// 다만 앱을 꺼 둔 동안에는 나이만 그 속도로 먹고, 배고픔·병은 훨씬 천천히 흐른다
// — 자는 동안 죽어 있으면 안 되기 때문이다.

export const T = {
  // ── 시계 ────────────────────────────────────────────────
  /** 현실 1시간에 개의 시간이 몇 시간 흐르는가. 설정에서 바꾼다. */
  timeScale: 12,
  defaultTimeScale: 12,
  timeScaleChoices: [1, 4, 12, 24, 72],
  day: 24,

  /** 꺼 둔 동안 배고픔·기분·청결이 흐르는 속도(현실 1시간당 개의 시간) */
  offlineCareScale: 1.5,
  /** 꺼 둔 동안 병이 깊어지는 속도 */
  offlineIllnessScale: 1.0,

  stepHours: 1.0,
  maxOfflineRealHours: 24 * 14,
  offlineGapRealHours: 0.25,

  nightStartHour: 22,
  nightEndHour: 6,
  /** 밤에는 이만큼 더 빨리 지친다 — 그래야 밤에 잔다 */
  nightEnergyRate: 1.8,

  // ── 스탯이 바닥나는 데 걸리는 시간 (개의 시간) ──────────
  satietyHours: 12,   // 개는 하루 두 끼
  moodHours: 16,
  cleanHours: 36,
  socialHours: 240,
  energyAwakeHours: 13,
  energySleepHours: 5,     // 개는 금방 회복한다

  sleepThreshold: 12,
  wakeThreshold: 82,       // 다 안 채워도 일어난다

  // ── 건강 ────────────────────────────────────────────────
  healthDrainPerHour: 3,
  healthRegenPerHour: 1,

  // ── 병 ──────────────────────────────────────────────────
  illnessBaseRisk: 0.0008,
  illnessFilthRisk: 0.006,
  illnessStarveRisk: 0.004,
  illnessDirtyRisk: 0.004,
  vaccineRiskScale: 1 / 3,
  /** 치료 안 하면 개의 하루마다 한 단계씩 깊어진다 */
  illnessWorsenHours: 24,
  /** 위독으로 개의 사흘을 버티면 떠난다 */
  criticalDeathHours: 72,
  lastWarningHours: 18,
  prescriptionSlow: 0.5,
  prescriptionEffectHours: 20,

  // ── 배변 ────────────────────────────────────────────────
  poopDelayHours: 8,
  filthPerPoop: 14,
  maxPoops: 12,

  // ── 나이 (실제 개의 한살이) ─────────────────────────────
  adoptedAgeDays: 60,   // 분양가게에서 올 때 생후 2개월
  heirAgeDays: 90,      // 대를 잇는 새끼는 생후 3개월

  puppyHours: 6 * 30 * 24,      // 생후 6개월까지
  juniorHours: 18 * 30 * 24,    // 6개월 ~ 2살
  adultHours: 7 * 365 * 24,     // 2살 ~ 9살
  seniorHours: 5 * 365 * 24,    // 9살 ~ 14살
  seniorWarningHours: 20 * 24,
  heirOfferHours: 60 * 24,

  seniorEnergyRate: 1.35,
  seniorIllnessRate: 2.2,

  growthMoodFloor: 10,
  growthIllnessCap: 2,

  // ── 돌보기 ──────────────────────────────────────────────
  fullSatiety: 92,
  playMood: 28,
  playEnergyCost: 10,
  washClean: 100,
  washMood: -6,
  patMood: 10,
  repeatFalloff: 0.55,
  repeatResetHours: 6,
  sameFoodBored: 3,
  refuseChance: 0.35,

  // ── 산책 (짧게 / 한 바퀴 / 멀리까지) ────────────────────
  walkMood: [12, 30, 42],
  walkSocial: [8, 20, 34],
  walkEnergy: [10, 25, 55],
  walkClean: [8, 22, 40],
  walkCooldown: [4, 10, 18],
  walkOutHours: [0.5, 1.0, 2.0],
  walkTireRisk: [0, 0.03, 0.18],
  walkEventChance: [0.20, 0.45, 0.70],
  walkLabel: ['잠깐 (15분)', '한 바퀴 (30분)', '멀리까지 (1시간)'],

  puppyWalkRiskScale: 2.5,
  walkMinEnergy: 18,
  walkPoopOutside: 0.7,
  socialThresholdRatio: 0.05,

  // ── 짝과 새끼 ───────────────────────────────────────────
  pregnancyDays: 63,          // 개의 임신은 평균 9주
  get pregnancyHours() { return this.pregnancyDays * 24; },
  pregnantMoodRate: 1.7,
  pregnantSatietyRate: 1.4,
  pregnantLateFraction: 0.35,
  pregnantLateExtra: 1.5,

  litterMin: 1,
  litterMax: 5,
  matingFee: 20000,

  adoptOutPuppy: 45000,
  adoptOutJunior: 65000,
  adoptOutAdult: 95000,
  rareTemperamentBonus: 25000,

  // ── 인형 ────────────────────────────────────────────────
  shelfSlots: 6,
  startingDolls: 3,
  dollPrice: 25000,
  dollKnockChance: 0.010,
  dollChewChance: 0.020,
  dollFunMood: 10,

  // ── 돈 (용돈은 현실의 날마다) ───────────────────────────
  dailyAllowance: 15000,
  maxAllowanceDays: 7,
  startingMoney: 90000,

  clinicBasicPrice: 15000,
  clinicFullPrice: 45000,
  vaccinePrice: 25000,
  slotPrice: 50000,
  maxSlots: 6,
  startingSlots: 2,
  searchPrice: 30000,

  // ── 보상 ────────────────────────────────────────────────
  adultReward: 40000,
  newTemperamentBonus: 30000,

  // ── 이벤트 ──────────────────────────────────────────────
  maxPendingEvents: 3,
  lostReturnMinHours: 20,
  lostReturnMaxHours: 40,
  searchSuccessChance: 0.7,

  // ── 방 ──────────────────────────────────────────────────
  roomHalfX: 2.8,
  roomHalfZ: 2.0,
};

// 파생값 — 시간당 감소량
export const rate = {
  get satiety() { return 100 / T.satietyHours; },
  get mood() { return 100 / T.moodHours; },
  get clean() { return 100 / T.cleanHours; },
  get social() { return 100 / T.socialHours; },
  get energyDrain() { return 100 / T.energyAwakeHours; },
  get energyGain() { return 100 / T.energySleepHours; },
};

export const Stage = { Puppy: 0, Junior: 1, Adult: 2, Senior: 3 };
export const Illness = { None: 0, Weak: 1, Sick: 2, Critical: 3 };

export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
export const won = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
