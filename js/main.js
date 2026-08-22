// 조립. 저장을 읽고, 시간을 흘리고, 화면과 방을 맞춘다.

import { T, Stage } from './tuning.js';
import * as save from './save.js';
import * as sim from './sim.js';
import * as act from './actions.js';
import * as breed from './breeding.js';
import * as dolls from './dolls.js';
import * as ev from './events.js';
import { buildExtraEvents, linkExtra } from './events_extra.js';
import { Room, ACT } from './room3d.js';
import { UI } from './ui.js';
import sfx from './sfx.js';

// 순환 참조를 피하려고 이벤트 표에 필요한 것만 넘겨 준다
const LIB = {
  ...sim, ...breed,
  clinicChoices: act.clinicChoices,
  pickUpDoll: dolls.pickUp,
};
ev.linkEvents(LIB);
linkExtra(LIB);
buildExtraEvents(sfx);

class Game {
  constructor() {
    this.S = save.load();
    this.selectedId = null;
    this.room = new Room(document.getElementById('scene'));
    this.ui = new UI(this);

    // 모델이 도착해야 시작한다.
    // 먼저 시작해 버리면 임시 모양(베개)으로 만들어진 채로 굳는다.
    this.room.onDogReady = () => {
      document.getElementById('loading').hidden = true;
      this.start();
    };
    this.room.onDogProgress = (r) => {
      const h = document.querySelector('#loading .h');
      if (h) h.textContent = `강아지를 데려오는 중… ${Math.round(r * 100)}%`;
    };

    this._wireInput();
    this._loop();
    sfx.preload();

    // 아주 오래 걸리면 안내를 바꿔 준다 (그래도 계속 기다린다)
    setTimeout(() => {
      if (this.started) return;
      const h = document.querySelector('#loading .h');
      if (h) h.textContent = '조금 오래 걸립니다. 그대로 두시면 곧 열립니다…';
    }, 15000);
  }

  get now() { return save.nowUnix(); }

  start() {
    if (this.started) return;
    this.started = true;

    const rep = sim.catchUp(this.S, this.now);
    const gained = act.claimAllowance(this.S);

    this.selectFirst();
    this.ui.refresh();

    if (!this.S.warningAccepted) { this.ui.intro(); return; }
    if (save.livingCount(this.S) === 0) { this.ui.shop(); return; }

    const lines = [];
    if (gained > 0) lines.push(`용돈 ${gained.toLocaleString('ko-KR')}원이 들어왔습니다.`);
    for (const e of rep) {
      if (e.kind === 'event' || lines.length >= 6) continue;
      lines.push(e.text);
    }
    this.ui.catchUpReport(lines);
  }

  // ── 고르기 ────────────────────────────────────────────

  selected() { return save.findPet(this.S, this.selectedId); }

  select(id) { this.selectedId = id; this.ui.refresh(); }

  selectFirst() {
    const p = this.S.pets.find(x => !x.dead);
    this.selectedId = p ? p.id : null;
  }

  save() { save.save(this.S); }

  wipe() {
    save.wipe();
    this.S = save.newGame();
    this.selectedId = null;
    this.save();
  }

  addStartFood() { save.addMeals(this.S, 'puppy', 10); }

  // ── 매 프레임 ─────────────────────────────────────────

  _loop() {
    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, this.room.clock.getDelta());

      if (this.started) {
        this._sec = (this._sec || 0) + dt;
        if (this._sec >= 1) {
          this._sec = 0;
          const rep = sim.catchUp(this.S, this.now);
          act.claimAllowance(this.S);
          this._handle(rep);
          this.ui.refresh();
        }
        this._saveT = (this._saveT || 0) + dt;
        if (this._saveT >= 15) { this._saveT = 0; this.save(); }

        this._ambient(dt);
      }

      this.room.sync(this.S, dt);
      this.room.render();
    };
    tick();
  }

  _handle(rep) {
    for (const e of rep) {
      switch (e.kind) {
        case 'adult': case 'grew': sfx.play('ding'); this.ui.toast(e.text); break;
        case 'birth': sfx.play('yip'); break;
        case 'sick': case 'worse': sfx.play('whine'); this.ui.toast(e.text); break;
        case 'home': sfx.play('bark'); break;
        case 'old': sfx.play('dong'); break;
        case 'doll_fell': sfx.play('pop'); this.ui.toast(e.text); break;
        case 'died': {
          const p = save.findPet(this.S, e.petId);
          this.ui.funeral(p, e.text);
          return;
        }
      }
    }
    if (this.S.inbox.length && !this.ui.isOpen) this.nextEvent();
  }

  nextEvent() {
    if (!this.S.inbox.length) return;
    this.ui.event(this.S.inbox[0]);
  }

  /** 가끔 혼자 소리를 낸다 — 조용하면 정이 안 든다 */
  _ambient(dt) {
    this._sfxT = (this._sfxT || 12) - dt;
    if (this._sfxT > 0) return;
    this._sfxT = 9 + Math.random() * 13;

    const p = this.selected();
    if (!p || !save.atHome(p)) return;

    if (p.asleep) return sfx.play('snore', 0.5);
    if (p.illness >= 2) return sfx.play('whine', 0.6);
    if (p.satiety < 25) return sfx.play('whine', 0.7);
    if (p.mood > 70) return sfx.play(Math.random() < 0.5 ? 'bark' : 'tail', 0.55);
    if (p.energy < 30) return sfx.play('pant', 0.5);
    sfx.play(Math.random() < 0.5 ? 'yawn' : 'bark_low', 0.4);
  }

  // ── 버튼 ──────────────────────────────────────────────

  doAction(a) {
    sfx.unlock();
    const p = this.selected();
    if (!p) { this.ui.toast('먼저 아이를 고르세요.'); return; }

    switch (a) {
      case 'feed': return this.ui.foodPicker(p);
      case 'walk': return this.ui.walkPicker(p);
      case 'clinic': return this.ui.clinic(p);
      case 'send': return this.ui.sendAway(p);

      case 'play': return this._act(p, ACT.play, () => act.play(this.S, p, this.now), 'bark');
      case 'pat': return this._act(p, ACT.pat, () => act.pat(this.S, p, this.now), 'tail');
      case 'wash': return this._act(p, ACT.away, () => act.wash(this.S, p), 'lap');
      case 'sleep': {
        const r = act.toggleSleep(this.S, p);
        if (r.ok) this.room.act(p.id, p.asleep ? ACT.sleep : ACT.none, null);
        sfx.play(r.ok ? 'yawn' : 'dong');
        this.ui.toast(r.message);
        this.save(); this.ui.refresh();
        return;
      }
    }
  }

  /**
   * 강아지를 먼저 보내고, 도착해서 시작할 때 안내를 띄운다.
   * (스탯은 즉시 반영하되 말만 늦춘다 — 안 그러면 "놀았습니다"가 먼저 뜨고 그다음에 논다.)
   */
  _act(p, kind, run, sound) {
    const r = run();
    if (!r.ok) { sfx.play('dong', 0.4); this.ui.toast(r.message); return; }

    this.save();
    this.ui.refresh();
    this.room.act(p.id, kind, () => {
      sfx.play(sound);
      this.ui.toast(r.message);
    });
  }

  feed(foodId) {
    const p = this.selected();
    if (!p) return;
    const r = act.feed(this.S, p, foodId, this.now);
    if (!r.ok) { sfx.play('dong', 0.4); this.ui.toast(r.message); return; }

    this.save();
    this.ui.refresh();
    this.room.act(p.id, ACT.eat, () => { sfx.play('eat'); this.ui.toast(r.message); });
  }

  walk(len) {
    const p = this.selected();
    if (!p) return;
    const rep = [];
    const r = act.walk(this.S, p, this.now, len, rep);
    if (!r.ok) { sfx.play('dong', 0.4); this.ui.toast(r.message); return; }

    this.save();
    this.ui.refresh();
    this.room.act(p.id, ACT.away, () => { sfx.play('pant'); this.ui.toast(r.message); });
    setTimeout(() => { if (this.S.inbox.length && !this.ui.isOpen) this.nextEvent(); }, 5200);
  }

  // ── 화면 조작 ─────────────────────────────────────────

  _wireInput() {
    const cv = this.room.canvas;
    let dragging = false, moved = false, lx = 0, ly = 0, pinch = 0;

    const down = (x, y) => { dragging = true; moved = false; lx = x; ly = y; sfx.unlock(); };
    const move = (x, y) => {
      if (!dragging) return;
      const dx = x - lx, dy = y - ly;
      if (Math.abs(dx) + Math.abs(dy) > 8) {
        moved = true;
        this.room.yaw += dx * 0.22;
        this.room.pitch -= dy * 0.16;
        this.room.applyCamera();
        lx = x; ly = y;
      }
    };
    const up = (x, y) => {
      if (dragging && !moved) this._tap(x, y);
      dragging = false;
    };

    cv.addEventListener('mousedown', e => down(e.clientX, e.clientY));
    cv.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    window.addEventListener('mouseup', e => up(e.clientX, e.clientY));

    cv.addEventListener('touchstart', e => {
      if (e.touches.length === 2) { pinch = this._pinchDist(e); dragging = false; return; }
      down(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    cv.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        const d = this._pinchDist(e);
        if (pinch > 0) { this.room.dist -= (d - pinch) * 0.008; this.room.applyCamera(); }
        pinch = d;
        return;
      }
      move(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    cv.addEventListener('touchend', e => {
      pinch = 0;
      const t = e.changedTouches[0];
      if (t) up(t.clientX, t.clientY);
    });

    cv.addEventListener('wheel', e => {
      this.room.dist += e.deltaY * 0.002;
      this.room.applyCamera();
    }, { passive: true });

    window.addEventListener('resize', () => this.room.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    window.addEventListener('beforeunload', () => this.save());
  }

  _pinchDist(e) {
    const a = e.touches[0], b = e.touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  _tap(x, y) {
    if (this.ui.isOpen) return;
    const hit = this.room.pick(x, y);
    if (!hit) return;

    if (hit.poopId) {
      act.cleanPoop(this.S, hit.poopId);
      sfx.play('pop');
      this.ui.toast('치웠습니다.');
      this.save();
      return;
    }
    if (hit.dollId) {
      const d = dolls.findDoll(this.S, hit.dollId);
      if (!d) return;
      let r;
      if (d.state === 1) r = dolls.pickUp(this.S, d.id);
      else if (d.state === 2) r = dolls.discard(this.S, d.id);
      else r = { ok: false, message: '선반 위 인형입니다.' };
      sfx.play(r.ok ? 'pop' : 'dong');
      this.ui.toast(r.message);
      this.save();
      return;
    }
    if (hit.petId) {
      this.selectedId = hit.petId;
      const p = this.selected();
      if (p) {
        act.pat(this.S, p, this.now);
        sfx.play(p.asleep ? 'snore' : p.mood > 60 ? 'bark' : 'whine', 0.7);
      }
      this.ui.refresh();
    }
  }
}

window.game = new Game();
