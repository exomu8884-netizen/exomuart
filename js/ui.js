// 화면 — 위쪽 띠, 아래쪽 판, 덮는 창들.
// 열 때 새로 그리고 닫을 때 지운다. 상태가 남지 않아 헷갈릴 일이 없다.

import { T, Stage, Illness, won } from './tuning.js?v=1787385309';
import { BREEDS, FOODS, breedOf, foodOf, temperName, temperStory, stageName } from './data.js?v=1787385309';
import {
  findPet, livingCount, mealsOf, atHome, totalMeals,
} from './save.js?v=1787385309';
import * as sim from './sim.js?v=1787385309';
import * as act from './actions.js?v=1787385309';
import * as breed from './breeding.js?v=1787385309';
import * as dolls from './dolls.js?v=1787385309';
import * as ev from './events.js?v=1787385309';
import sfx from './sfx.js?v=1787385309';
import { josa } from './josa.js?v=1787385309';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = josa(String(text));
  return e;
};

export class UI {
  constructor(game) {
    this.game = game;
    this.overlay = $('overlay');
    this.toasts = $('toasts');
    this.barEls = {};
    this._buildBars();
    this._wire();
  }

  get S() { return this.game.S; }

  _buildBars() {
    const host = $('bars');
    host.innerHTML = '';
    for (const [key, cap] of [
      ['satiety', '배부름'], ['mood', '기분'], ['clean', '청결'],
      ['energy', '기력'], ['health', '건강'],
    ]) {
      const row = el('div', 'bar');
      row.appendChild(el('span', 'cap', cap));
      const track = el('div', 'track');
      const fill = el('div', 'fill');
      track.appendChild(fill);
      row.appendChild(track);
      const num = el('span', 'num', '0');
      row.appendChild(num);
      host.appendChild(row);
      this.barEls[key] = { fill, num };
    }
  }

  _wire() {
    $('topbtns').addEventListener('click', (e) => {
      const go = e.target.dataset.go;
      if (!go) return;
      sfx.play('pop', 0.5);
      ({ shop: () => this.shop(), store: () => this.store(), book: () => this.book(), settings: () => this.settings() })[go]();
    });

    $('actions').addEventListener('click', (e) => {
      const a = e.target.dataset.act;
      if (a) this.game.doAction(a);
    });

    // 아래 판을 접었다 폈다 — 방을 넓게 보려고.
    // 폰에서는 click 이 씹히는 일이 있어 touchend 도 같이 받는다.
    const foldBtn = $('fold');
    const doFold = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const b = $('bottom');
      const folded = b.classList.toggle('folded');
      document.body.classList.toggle('folded', folded);
      foldBtn.textContent = folded ? '▲  펴기' : '▼  접기';
      sfx.play('pop', 0.4);
      setTimeout(() => this.game.room.resize(), 240);
    };
    foldBtn.addEventListener('click', doFold);
    foldBtn.addEventListener('touchend', doFold, { passive: false });

    // 자유롭게 움직이다 길을 잃으면 처음 자리로
    const rc = $('recenter');
    const doRecenter = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      this.game.room.resetView();
      sfx.play('pop', 0.4);
    };
    rc.addEventListener('click', doRecenter);
    rc.addEventListener('touchend', doRecenter, { passive: false });

    $('chips').addEventListener('click', (e) => {
      const id = e.target.dataset.pet;
      if (id) { this.game.select(id); sfx.play('pop', 0.5); }
      else if (e.target.dataset.shop) this.shop();
    });
  }

  // ── 늘 떠 있는 것 ───────────────────────────────────────

  refresh() {
    const s = this.S;
    const now = this.game.now;

    $('money').textContent = won(s.money);
    const night = sim.isNight(s);
    const clock = $('clock');
    clock.textContent = `${night ? '☽' : '☀'} ${sim.clockText(s)} · ${sim.dogDayCount(s)}일째`;
    clock.classList.toggle('night', night);

    this._refreshChips();

    const p = this.game.selected();
    const warn = $('warn');

    if (!p) {
      $('petname').textContent = '아직 아무도 없습니다';
      $('petnote').textContent = '분양가게에서 데려오세요.';
      for (const k in this.barEls) this._setBar(k, 0);
      warn.hidden = true;
      return;
    }

    const b = breedOf(p.breedId);
    const t = temperName(p.temperament);
    $('petname').innerHTML = `${p.name}<span class="sub">${t ? t + ' ' : ''}${b.name} · ${sim.ageText(p, now)}</span>`;
    $('petnote').textContent = josa(this._noteFor(p, now));

    for (const k in this.barEls) this._setBar(k, p[k]);

    // 위독하면 남은 시간을 못박아 보여 준다
    if (p.illness === Illness.Critical && !p.dead) {
      warn.hidden = false;
      warn.className = '';
      warn.textContent = josa(`${p.name}이(가) 위독합니다 — 이대로 두면 개의 ${Math.ceil(sim.hoursLeftBeforeDeath(p))}시간 뒤에 떠납니다`);
    } else if (p.stage === Stage.Senior && !p.dead && sim.hoursLeftOfLife(p, now) <= T.seniorWarningHours) {
      warn.hidden = false;
      warn.className = 'age';
      warn.textContent = josa(`${p.name}이(가) 많이 늙었습니다 — 개의 ${Math.ceil(sim.hoursLeftOfLife(p, now) / 24)}일쯤 남았습니다`);
    } else {
      warn.hidden = true;
    }
  }

  _setBar(key, v) {
    const b = this.barEls[key];
    if (!b) return;
    const x = Math.max(0, Math.min(100, v || 0));
    b.fill.style.width = x + '%';
    b.fill.style.background = x > 55 ? '#78b370' : x > 25 ? '#e0a83f' : '#d15b52';
    b.num.textContent = Math.round(x);
  }

  _noteFor(p, now) {
    if (p.dead) return '곁을 떠났습니다.';
    if (p.lost) return '집에 없습니다. 돌아오기를 기다리는 중입니다.';
    if (p.pregnantDue > 0) {
      const h = Math.ceil(sim.dogHoursBetween(now, p.pregnantDue) / 24);
      return `새끼를 뱄습니다. 개의 ${h}일쯤 뒤에 낳습니다.`;
    }
    const stalled = sim.growthStalledReason(p);
    if (stalled) return stalled + '.';
    if (p.asleep) return '자고 있습니다.';
    if (p.illness > 0) {
      return p.illness === 1 ? '시름시름합니다. 병원에 데려가는 게 좋겠습니다.' : '앓아누웠습니다. 병원에 데려가야 합니다.';
    }
    if (p.stage === Stage.Senior) {
      const d = Math.ceil(sim.hoursLeftOfLife(p, now) / 24);
      return `많이 늙었습니다. 개의 ${d}일쯤 남았습니다.`;
    }
    if (p.stage === Stage.Adult) {
      const yrs = Math.max(0, Math.round((T.adultHours - sim.dogHoursBetween(p.stageEnteredAt, now)) / 24 / 365));
      return `한창때입니다. ${yrs}년쯤 뒤부터 늙기 시작합니다.` + (p.vaccinated ? ' · 접종 완료' : '');
    }
    const pct = Math.round(sim.stageProgress(p, now) * 100);
    return `자라는 중입니다 (${pct}%)` + (p.vaccinated ? ' · 접종 완료' : '');
  }

  _refreshChips() {
    const host = $('chips');
    host.innerHTML = '';
    for (const p of this.S.pets) {
      if (p.dead) continue;
      const mark = p.lost ? ' (밖)' : p.asleep ? ' (zZ)' : p.illness > 0 ? ' (!)' : '';
      const b = el('button', 'chip' + (p.id === this.game.selectedId ? ' on' : ''), p.name + mark);
      b.dataset.pet = p.id;
      host.appendChild(b);
    }
    if (livingCount(this.S) < this.S.slots) {
      const b = el('button', 'chip', '+ 분양');
      b.dataset.shop = '1';
      host.appendChild(b);
    }
  }

  // ── 토스트 ──────────────────────────────────────────────

  toast(msg) {
    if (!msg) return;
    msg = josa(String(msg));
    const t = el('div', 'toast', msg);
    this.toasts.appendChild(t);
    setTimeout(() => t.remove(), Math.min(6000, 2200 + msg.length * 45));
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
  }

  // ── 덮는 창 ─────────────────────────────────────────────

  close() {
    this.overlay.hidden = true;
    this.overlay.className = '';
    this.overlay.innerHTML = '';
    this.refresh();
  }

  get isOpen() { return !this.overlay.hidden; }

  _card(title, closable = true) {
    this.overlay.hidden = false;
    this.overlay.className = '';
    this.overlay.innerHTML = '';
    if (closable) {
      this.overlay.onclick = (e) => { if (e.target === this.overlay) this.close(); };
    } else this.overlay.onclick = null;

    const card = el('div', 'card');
    if (title) card.appendChild(el('h2', null, title));
    this.overlay.appendChild(card);
    return card;
  }

  _full(title) {
    this.overlay.hidden = false;
    this.overlay.className = 'full';
    this.overlay.innerHTML = '';
    this.overlay.onclick = null;

    const panel = el('div', 'full-panel');
    const head = el('div', 'full-head');
    head.appendChild(el('h2', null, title));
    const x = el('button', 'tb', '닫기');
    x.onclick = () => this.close();
    head.appendChild(x);
    panel.appendChild(head);

    const body = el('div', 'full-body');
    panel.appendChild(body);
    this.overlay.appendChild(panel);
    return body;
  }

  _btn(parent, label, cls, onclick, disabled = false) {
    const b = el('button', 'btn ' + (cls || ''), josa(String(label)));
    if (disabled) b.disabled = true;
    else b.onclick = onclick;
    parent.appendChild(b);
    return b;
  }

  // ── 시작 안내 ───────────────────────────────────────────

  intro() {
    const c = this._card('둘리키우기', false);
    const p = el('p');
    p.innerHTML =
      '강아지를 한 마리 데려와 집에서 키웁니다.\n\n' +
      '• 시간은 <b>현실보다 빠르게</b> 흐릅니다. 기본은 현실 2시간이 개의 하루입니다.\n' +
      '• 밥을 주고, 변을 치우고, 산책을 시키고, 아프면 병원에 데려갑니다.\n' +
      '• 어떻게 키우느냐에 따라 <b>성격이 달라집니다.</b>\n' +
      '• 다 자라면 짝을 맺어 새끼를 볼 수 있습니다.\n\n' +
      '<span class="warnline">미리 알려 드립니다.</span>\n' +
      '이 게임에는 <b>죽음이 있습니다.</b> 병을 오래 방치하면 떠나고, 나이가 차도 떠납니다.\n' +
      '다만 <b>갑자기 떠나지는 않습니다.</b> 병은 세 단계로 깊어지고 단계마다 알려 드리며, ' +
      '위독해지면 화면 위에 <b>남은 시간</b>이 뜹니다. 그때 병원에 데려가면 삽니다.\n' +
      '<b>앱을 꺼 둔 동안에는 죽지 않습니다.</b>';
    c.appendChild(p);

    this._btn(c, '알겠습니다. 시작합니다', 'primary', () => {
      this.S.warningAccepted = true;
      this.game.save();
      sfx.play('ding');
      this.shop();
    });
  }

  catchUpReport(lines) {
    if (!lines.length) { this.game.nextEvent(); return; }
    const c = this._card('그동안 있었던 일');
    c.appendChild(el('p', null, '• ' + lines.join('\n\n• ')));
    this._btn(c, '확인', 'primary', () => { this.close(); this.game.nextEvent(); });
  }

  // ── 분양가게 ────────────────────────────────────────────

  shop() {
    const s = this.S;
    const body = this._full('분양가게');
    body.appendChild(el('p', 'small', `자리 ${livingCount(s)}/${s.slots} · 가진 돈 ${won(s.money)}`));

    const free = act.isFirstAdoption(s);
    for (const b of BREEDS) {
      const card = el('div', 'item');
      card.appendChild(el('h3', null, b.name));
      card.appendChild(el('div', 'desc', b.blurb));
      card.appendChild(el('div', 'price', free ? '처음 오는 아이라 분양비를 안 받습니다' : `분양비 ${won(b.price)}`));

      const can = act.canAdopt(s, b);
      this._btn(card, can.ok ? (free ? '데려온다 (무료)' : '데려온다') : can.why,
        'pink', () => this.naming(b), !can.ok);
      body.appendChild(card);
    }

    // 아직 한 마리도 없으면 집부터 넓힐 일이 없다
    if (s.slots < T.maxSlots && s.pets.length > 0) {
      const card = el('div', 'item');
      card.appendChild(el('h3', null, '집 넓히기'));
      card.appendChild(el('div', 'desc', `자리를 하나 늘립니다 (${s.slots} → ${s.slots + 1}마리)`));
      card.appendChild(el('div', 'price', won(T.slotPrice)));
      this._btn(card, '넓힌다', '', () => {
        const r = act.buySlot(s);
        sfx.play(r.ok ? 'coin' : 'dong');
        this.toast(r.message);
        this.game.save();
        this.shop();
      });
      body.appendChild(card);
    }
  }

  naming(b) {
    const s = this.S;
    const c = this._card('이름을 지어 주세요', false);
    c.appendChild(el('p', 'small', `${b.name} 한 마리를 데려옵니다.\n한 번 지으면 바꿀 수 없습니다.`));

    const input = el('input');
    input.type = 'text';
    input.value = '둘리';
    input.maxLength = 8;
    c.appendChild(input);

    const row = el('div', 'row');
    c.appendChild(row);

    this._btn(row, '그만두기', 'ghost', () => this.shop());
    this._btn(row, act.isFirstAdoption(s) ? '데려온다 (무료)' : `데려온다 (${won(b.price)})`, 'primary', () => {
      const can = act.canAdopt(s, b);
      if (!can.ok) { this.toast(can.why); return; }
      const wasFree = act.isFirstAdoption(s);

      const p = act.adopt(s, b, input.value, this.game.now);
      if (totalMeals(s) === 0) this.game.addStartFood();

      this.game.selectedId = p.id;
      this.game.save();
      sfx.play('yip');
      this.close();
      this.toast(`${p.name}이(가) 집에 왔습니다.\n상자에서 나와 두리번거립니다.` + (wasFree ? '\n분양비는 안 받았습니다.' : ''));
    });
  }

  // ── 용품점 ──────────────────────────────────────────────

  store() {
    const s = this.S;
    const body = this._full('용품점');
    body.appendChild(el('p', 'small', `가진 돈 ${won(s.money)}`));
    body.appendChild(el('p', 'small', '같은 사료만 계속 주면 물립니다. 두어 가지를 번갈아 주세요.'));

    // 바비 인형
    const dcard = el('div', 'item');
    dcard.appendChild(el('h3', null, `바비 인형  (선반 ${dolls.onShelf(s)}/${T.shelfSlots})`));
    dcard.appendChild(el('div', 'desc', '선반에 올려 둡니다. 강아지가 치면 떨어지고, 바닥에 두면 물어뜯습니다.'));
    dcard.appendChild(el('div', 'price', won(T.dollPrice)));
    this._btn(dcard, '산다', 'pink', () => {
      const r = dolls.buyDoll(s);
      sfx.play(r.ok ? 'coin' : 'dong');
      this.toast(r.message);
      this.game.save();
      this.store();
    });
    body.appendChild(dcard);

    for (const f of FOODS) {
      const unit = f.isTreat ? '개' : '끼';
      const card = el('div', 'item');
      card.appendChild(el('h3', null, `${f.name}  (남은 것 ${mealsOf(s, f.id)}${unit})`));
      card.appendChild(el('div', 'desc', f.blurb));
      card.appendChild(el('div', 'price', `${won(f.price)} / ${f.meals}${unit}`));
      this._btn(card, '산다', 'pink', () => {
        const r = act.buyFood(s, f.id);
        sfx.play(r.ok ? 'coin' : 'dong');
        this.toast(r.message);
        this.game.save();
        this.store();
      });
      body.appendChild(card);
    }
  }

  // ── 도감 ────────────────────────────────────────────────

  book() {
    const s = this.S;
    const body = this._full('도감');
    body.appendChild(el('p', 'small', `${s.collection.length} / ${BREEDS.length * 4} 가지`));

    if (!s.collection.length) {
      body.appendChild(el('p', null, '아직 비어 있습니다.\n한 마리를 다 자랄 때까지 키우면 여기에 남습니다.'));
      return;
    }
    for (const e of s.collection) {
      const b = breedOf(e.breedId);
      const card = el('div', 'item');
      card.appendChild(el('h3', null, `${temperName(e.temperament)} ${b.name}`));
      card.appendChild(el('div', 'desc', `첫 아이: ${e.petName}`));
      card.appendChild(el('p', null, temperStory(e.temperament)));
      card.appendChild(el('div', 'desc', `밥 ${e.feedCount}번 · 놀기 ${e.playCount}번 · 산책 ${e.walkCount}번`));
      body.appendChild(card);
    }
  }

  // ── 고르는 창 ───────────────────────────────────────────

  foodPicker(p) {
    const s = this.S;
    const c = this._card(`${p.name}에게 무엇을 줄까요`);
    let any = false;

    for (const f of FOODS) {
      const have = mealsOf(s, f.id);
      if (have <= 0) continue;
      any = true;
      const unit = f.isTreat ? '개' : '끼';
      const bored = p.lastFoodId === f.id && (p.sameFoodStreak || 0) >= T.sameFoodBored;
      this._btn(c, `${f.name} (${have}${unit} 남음)` + (bored ? ' — 물렸습니다' : ''),
        bored ? 'ghost' : '', () => { this.close(); this.game.feed(f.id); });
    }

    if (!any) {
      c.appendChild(el('p', null, '창고가 비었습니다.\n용품점에서 사 오세요.'));
      this._btn(c, '용품점으로', 'pink', () => this.store());
    } else {
      this._btn(c, '그만두기', 'ghost', () => this.close());
    }
  }

  walkPicker(p) {
    const c = this._card('얼마나 걸을까요');
    c.appendChild(el('p', 'small', '짧으면 아쉬워하고, 멀리 가면 지칩니다.\n새끼는 특히 무리하면 탈이 납니다.'));
    for (let i = 0; i < 3; i++) {
      this._btn(c, T.walkLabel[i], i === 1 ? 'primary' : '', () => { this.close(); this.game.walk(i); });
    }
    this._btn(c, '그만두기', 'ghost', () => this.close());
  }

  clinic(p) {
    const s = this.S;
    if (p.illness === 0 && p.vaccinated) { this.toast(`${p.name}은(는) 멀쩡합니다. 접종도 마쳤습니다.`); return; }

    const c = this._card('병원');
    const state = p.illness === 0 ? '지금은 아픈 데가 없습니다.'
      : p.illness === 1 ? '시름시름합니다.'
        : p.illness === 2 ? '앓아누웠습니다.'
          : `위독합니다. 개의 ${Math.ceil(sim.hoursLeftBeforeDeath(p))}시간 남았습니다.`;
    c.appendChild(el('p', null, `${p.name} — ${state}`));

    if (p.stage === Stage.Senior)
      c.appendChild(el('p', 'small', '나이로 기운이 없는 것은 병이 아니라서 여기서 못 고칩니다.'));

    if (p.illness > 0) {
      const opts = act.clinicChoices();
      opts.forEach((o, i) => {
        this._btn(c, o.label, i === 0 ? 'primary' : '', () => {
          this.close();
          const r = act.applyChoice(s, p, o, this.game.now);
          sfx.play(r.ok ? 'ding' : 'dong');
          this.toast(r.message);
          this.game.save();
          this.refresh();
        });
      });
    }
    if (!p.vaccinated) {
      this._btn(c, `예방접종 (${won(T.vaccinePrice)})`, '', () => {
        this.close();
        const r = act.vaccinate(s, p);
        sfx.play(r.ok ? 'ding' : 'dong');
        this.toast(r.message);
        this.game.save();
        this.refresh();
      });
    }
    this._btn(c, '그만두기', 'ghost', () => this.close());
  }

  sendAway(p) {
    const s = this.S;
    const price = breed.adoptOutPrice(s, p);
    const c = this._card('좋은 집으로 보내기');
    const q = el('p');
    q.innerHTML = `${p.name}을(를) 다른 집으로 보냅니다.\n\n${won(price)}을 받습니다.\n<span class="warnline">되돌릴 수 없습니다.</span>`;
    c.appendChild(q);

    this._btn(c, '그냥 둔다', 'primary', () => this.close());
    this._btn(c, '보낸다', 'ghost', () => {
      const r = breed.sendAway(s, p);
      sfx.play('coin');
      this.game.selectFirst();
      this.game.save();
      this.close();
      this.toast(r.message);
    });
  }

  // ── 이벤트 창 ───────────────────────────────────────────

  event(pe) {
    const s = this.S;
    const p = findPet(s, pe.petId);
    const choices = ev.choicesFor(s, pe);

    const c = this._card(ev.titleOf(pe), false);
    if (p) c.appendChild(el('p', 'small', p.name));
    c.appendChild(el('p', null, ev.bodyOf(s, pe)));
    sfx.play('dong', 0.6);

    choices.forEach((ch, i) => {
      const can = (!ch.enabled || !p || ch.enabled(s, p)) && (!(ch.cost > 0) || s.money >= ch.cost);
      this._btn(c, ch.label, i === 0 && can ? 'primary' : '', () => {
        const result = ev.resolveEvent(s, pe, i, this.game.now);
        sfx.play('pop', 0.6);
        this.game.save();
        this.close();
        if (result) this.toast(result);
        this.game.nextEvent();
      }, !can);
    });
  }

  // ── 장례 ────────────────────────────────────────────────

  funeral(p, text) {
    this.overlay.hidden = false;
    this.overlay.className = 'funeral';
    this.overlay.innerHTML = '';
    this.overlay.onclick = null;
    sfx.play('sad');

    const c = el('div', 'card');
    c.style.background = 'transparent';

    const stone = el('div', 'stone');
    stone.appendChild(el('div', 'nm', p ? p.name : ''));
    stone.appendChild(el('div', 'ag', p ? sim.ageText(p, p.diedAt) + '까지' : ''));
    if (p && p.temperament) stone.appendChild(el('div', 'ag', temperName(p.temperament) + ' 아이였습니다'));
    c.appendChild(stone);

    const flowers = el('div', 'flowers');
    c.appendChild(flowers);

    const msg = el('div', 'funeral-msg',
      p && p.diedOfAge
        ? '병이 아니라 나이였습니다.\n막을 수 있는 것이 아니었습니다.'
        : '조금만 더 일찍 봤더라면 하는 생각이 듭니다.');
    c.appendChild(msg);

    let placed = 0;
    const done = el('button', 'btn ghost', '자리를 떠난다');
    done.disabled = true;

    const put = el('button', 'btn pink', '꽃을 놓는다');
    put.onclick = () => {
      if (placed >= 5) return;
      placed++;
      flowers.appendChild(el('div', 'flower'));
      sfx.play('pop', 0.5);
      if (placed >= 3) done.disabled = false;
      if (placed >= 5) put.disabled = true;
    };
    c.appendChild(put);

    done.onclick = () => { this.game.selectFirst(); this.close(); };
    c.appendChild(done);

    this.overlay.appendChild(c);
  }

  // ── 설정 ────────────────────────────────────────────────

  settings() {
    const s = this.S;
    const c = this._card('설정');

    c.appendChild(el('p', 'small', '저장은 이 브라우저에 남습니다.'));

    this._btn(c, sfx.isMuted() ? '소리 켜기' : '소리 끄기', '', () => {
      sfx.setMuted(!sfx.isMuted());
      if (!sfx.isMuted()) sfx.play('bark');
      this.settings();
    });
    this._btn(c, '소리 시험 (멍멍)', '', () => sfx.play('bark'));

    // 홈 화면 아이콘으로 열면 주소창이 없어 새로고침할 방법이 마땅치 않다.
    // 주소 뒤에 숫자를 바꿔 붙여 캐시를 확실히 건너뛴다.
    this._btn(c, '새로고침 (새 버전 받기)', '', () => {
      this.game.save();
      const url = location.origin + location.pathname + '?v=' + Date.now();
      location.replace(url);
    });

    // ── 시간 빠르기 ──
    c.appendChild(el('h2', null, '시간 빠르기'));
    c.appendChild(el('p', 'small', this._scaleText(T.timeScale)));

    const row = el('div', 'scalerow');
    for (const scale of T.timeScaleChoices) {
      const on = Math.abs(scale - T.timeScale) < 1e-6;
      const b = el('button', 'btn ' + (on ? 'primary' : ''), `${scale}배`);
      b.onclick = () => {
        sim.changeTimeScale(s, scale, this.game.now);
        this.game.save();
        sfx.play('pop');
        this.settings();
      };
      row.appendChild(b);
    }
    c.appendChild(row);
    c.appendChild(el('p', 'small', '바꿔도 지금까지 산 시간은 그대로입니다. 앞으로만 빨라지거나 느려집니다.'));

    c.appendChild(el('p', 'warnline', '아래는 되돌릴 수 없습니다.'));
    this._btn(c, '처음부터 다시 시작', 'ghost', () => this.confirmWipe());
    this._btn(c, '닫기', 'ghost', () => this.close());
  }

  _scaleText(scale) {
    const perDogDay = 24 / scale;
    const life = (T.puppyHours + T.juniorHours + T.adultHours + T.seniorHours) / scale / 24;
    const per = perDogDay >= 1 ? `현실 ${perDogDay.toFixed(1)}시간` : `현실 ${Math.round(perDogDay * 60)}분`;
    return `개의 하루 = ${per} · 14살까지 현실 ${Math.round(life)}일`;
  }

  confirmWipe() {
    const c = this._card('정말 지웁니까');
    c.appendChild(el('p', null, '지금까지 키운 아이들과 도감, 돈이 모두 사라집니다.\n\n되돌릴 수 없습니다.'));
    this._btn(c, '아니요', 'primary', () => this.close());
    this._btn(c, '네, 지우고 처음부터', 'ghost', () => {
      this.game.wipe();
      sfx.play('ding');
      this.close();
      this.intro();
    });
  }
}
