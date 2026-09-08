// 방을 three.js 로 짓고, 저장된 내용(강아지·변·인형)에 맞춰 맞춘다.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

import { T, Stage, Illness } from './tuning.js?v=1788837232';
import { breedOf } from './data.js?v=1788837232';
import { nightDepth } from './sim.js?v=1788837232';

// 강아지가 행동할 때 찾아가는 자리
export const ACT = { none: 0, eat: 1, play: 2, pat: 3, sleep: 4, away: 5 };

const PINK = {
  floorClean: 0xf5e0e3, floorDirty: 0xa89398,
  wallBack: 0xfadce6, wallSide: 0xf2c9dc,
  rug: 0xe895b5, rugInner: 0xf7c7d9,
  shelf: 0xfdf5f8, cushion: 0xf28fb8,
  bowl: 0xfdeaf2, water: 0xbfd9ef, trim: 0xfdf0f5,
};

const DRESS = [0xf26fa0, 0xfcb7c8, 0xb78be8, 0xfbd96f, 0x8ccbea, 0xfafafa];
const HAIR = [0xf2d16b, 0x6b4a33, 0x2b2b2b, 0xd97b4a, 0xf5f0e6, 0xc45a8a];
const EYES = [0x4a86c9, 0x6b4a33, 0x3f7d5a, 0x8a6bc9, 0x2f6f9e, 0x8a5a3a];

/** 인형 크기 배율. 1이면 30cm 쯤 — 대표님 요청으로 키웠다. */
const DOLL_SCALE = 3;

/** 단계별로 방에서 보이는 키 (미터) */
const HEIGHT = [0.55, 0.75, 1.00, 1.00];

export class Room {
  constructor(canvas) {
    this.canvas = canvas;
    this.pets = new Map();     // id → {group, mixer, action, target, act, actUntil, hidden, onArrive}
    this.poops = new Map();
    this.dolls = new Map();
    this.dogProto = null;

    this._initRenderer();
    this._build();
    this._initCamera();
    this._loadDog();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
  }

  // ── 뼈대 ────────────────────────────────────────────────

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2b2226);

    this.clock = new THREE.Clock();
  }

  _initCamera() {
    this.cam = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
    this.yaw = 0; this.pitch = 18; this.dist = 4.2;
    this.pivot = new THREE.Vector3(0, 0.7, 0);
    this.applyCamera();
    this.resize();
  }

  applyCamera() {
    // 코앞까지 붙기도, 방 전체가 들어오게 물러서기도 한다. 좌우는 한 바퀴 다 돈다.
    this.pitch = Math.max(-12, Math.min(86, this.pitch));
    this.dist = Math.max(0.7, Math.min(20, this.dist));

    // 보는 지점이 방을 너무 벗어나지 않게만 잡아 둔다
    const HX = T.roomHalfX + 2.5, HZ = T.roomHalfZ + 2.5;
    this.pivot.x = Math.max(-HX, Math.min(HX, this.pivot.x));
    this.pivot.z = Math.max(-HZ, Math.min(HZ, this.pivot.z));
    this.pivot.y = Math.max(-0.5, Math.min(3.2, this.pivot.y));

    const yaw = this.yaw * Math.PI / 180;
    const pitch = this.pitch * Math.PI / 180;
    const d = this.dist;

    this.cam.position.set(
      this.pivot.x + d * Math.sin(yaw) * Math.cos(pitch),
      this.pivot.y + d * Math.sin(pitch),
      this.pivot.z - d * Math.cos(yaw) * Math.cos(pitch));
    this.cam.lookAt(this.pivot);
  }

  /**
   * 보는 지점을 옆으로·위아래로 민다.
   * 이게 없으면 카메라가 방 한가운데만 붙잡고 돌아서 답답하다.
   * dx, dy 는 화면에서 움직인 픽셀.
   */
  pan(dx, dy) {
    const h = this.canvas.clientHeight || 1;
    // 화면에서 움직인 만큼이 그 거리에서 실제로 몇 미터인지
    const perPx = 2 * this.dist * Math.tan(this.cam.fov * Math.PI / 360) / h;

    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    this.cam.matrixWorld.extractBasis(right, up, new THREE.Vector3());

    this.pivot.addScaledVector(right, -dx * perPx);
    this.pivot.addScaledVector(up, dy * perPx);
    this.applyCamera();
  }

  /** 시점을 처음 자리로 */
  resetView() {
    this.yaw = 0; this.pitch = 18; this.dist = 4.2;
    this.pivot.set(0, 0.7, 0);
    this.applyCamera();
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  // ── 방 짓기 ─────────────────────────────────────────────

  _build() {
    const w = T.roomHalfX * 2 + 1.2;
    const d = T.roomHalfZ * 2 + 1.2;
    const shelfZ = d / 2 - 0.22;

    this.floor = this._box(w, 0.2, d, 0, -0.1, 0, PINK.floorClean);
    this.floor.receiveShadow = true;

    this._box(w, 2.8, 0.16, 0, 1.4, d / 2, PINK.wallBack);
    this._box(0.16, 2.8, d, -w / 2, 1.4, 0, PINK.wallSide);
    this._box(0.16, 2.8, d, w / 2, 1.4, 0, PINK.wallSide);
    this._box(w, 0.10, 0.02, 0, 0.86, d / 2 - 0.09, PINK.trim);

    this._box(3.0, 0.02, 2.1, 0, 0.011, -0.25, PINK.rug);
    this._box(2.2, 0.02, 1.4, 0, 0.014, -0.25, PINK.rugInner);

    // 선반
    this.shelfZ = shelfZ;
    this._box(3.8, 0.07, 0.34, 0, 1.24, shelfZ, PINK.shelf);
    this._box(0.06, 0.22, 0.34, -1.9, 1.35, shelfZ, PINK.shelf);
    this._box(0.06, 0.22, 0.34, 1.9, 1.35, shelfZ, PINK.shelf);

    // 밥그릇·방석
    const bowl = new THREE.Vector3(-1.9, 0.05, 1.35);
    const cushion = new THREE.Vector3(1.8, 0.07, 1.15);
    this._cyl(0.34, 0.10, bowl.x, bowl.y, bowl.z, PINK.bowl);
    this._cyl(0.30, 0.09, bowl.x + 0.55, bowl.y - 0.005, bowl.z + 0.05, PINK.water);
    this._box(1.15, 0.14, 0.90, cushion.x, cushion.y, cushion.z, PINK.cushion);

    this.spots = {
      bowl: new THREE.Vector3(bowl.x + 0.25, 0, bowl.z - 0.6),
      cushion: new THREE.Vector3(cushion.x, 0, cushion.z),
      front: new THREE.Vector3(0, 0, -T.roomHalfZ + 0.5),
    };

    // 조명
    this.sun = new THREE.DirectionalLight(0xfff7f2, 1.6);
    this.sun.position.set(2.5, 5, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -5; this.sun.shadow.camera.right = 5;
    this.sun.shadow.camera.top = 5; this.sun.shadow.camera.bottom = -5;
    this.scene.add(this.sun);

    this.fill = new THREE.HemisphereLight(0xffe7f0, 0x6b5a60, 0.9);
    this.scene.add(this.fill);

    this.petRoot = new THREE.Group(); this.scene.add(this.petRoot);
    this.poopRoot = new THREE.Group(); this.scene.add(this.poopRoot);
    this.dollRoot = new THREE.Group(); this.scene.add(this.dollRoot);
  }

  _mat(color, rough = 0.85) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });
  }

  _box(sx, sy, sz, x, y, z, color, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), this._mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    (parent || this.scene).add(m);
    return m;
  }

  _cyl(dia, h, x, y, z, color, parent) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(dia / 2, dia / 2, h, 24), this._mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    (parent || this.scene).add(m);
    return m;
  }

  // ── 강아지 모델 ─────────────────────────────────────────

  _loadDog() {
    new GLTFLoader().load('models/pom.glb', (gltf) => {
      this.dogProto = gltf.scene;
      this.dogClips = gltf.animations || [];
      this.dogProto.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });

      // 모델이 늦게 오면 그 사이에 임시 모양으로 만들어진 아이들이 있다.
      // 여기서 지워 주지 않으면 계속 베개로 남는다.
      for (const [, e] of this.pets) this.petRoot.remove(e.g);
      this.pets.clear();

      this.onDogReady && this.onDogReady();
    }, (e) => {
      // 얼마나 받았는지 알려 준다 — 안 그러면 멈춘 것처럼 보인다
      if (this.onDogProgress && e.total) this.onDogProgress(e.loaded / e.total);
    }, (err) => {
      console.warn('[둘리] 모델을 못 읽었습니다. 임시 모양으로 대신합니다.', err);
      this.dogProto = null;
      this.dogFailed = true;
      this.onDogReady && this.onDogReady();
    });
  }

  _makeDog(p) {
    const g = new THREE.Group();
    let mixer = null, action = null;

    if (this.dogProto) {
      const model = skeletonClone(this.dogProto);
      // 키를 단계에 맞춘다
      const box = new THREE.Box3().setFromObject(model);
      const h = Math.max(1e-4, box.max.y - box.min.y);
      const k = HEIGHT[p.stage] / h;
      model.scale.setScalar(k);
      model.position.y = -box.min.y * k;

      // 새끼는 통통하고 밝게, 성견은 길쭉하고 진하게
      const fat = p.stage === Stage.Puppy ? 1.14 : p.stage === Stage.Junior ? 1.04 : 0.96;
      model.scale.x *= fat; model.scale.z *= fat;

      g.add(model);

      if (this.dogClips.length) {
        mixer = new THREE.AnimationMixer(model);
        action = mixer.clipAction(this.dogClips[0]);
        action.play();
      }
    } else {
      // 모델이 아직 없을 때 쓰는 임시 몸.
      // 캡슐 하나만 두면 베개처럼 보여서, 최소한 개 꼴은 갖춘다.
      const breed = breedOf(p.breedId);
      const m = this._mat(breed.tint);
      const k = HEIGHT[p.stage] / 0.55;      // 단계에 맞춰 통째로 키운다
      const tmp = new THREE.Group();
      const add = (geo, x, y, z, rx = 0) => {
        const o = new THREE.Mesh(geo, m);
        o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true;
        tmp.add(o); return o;
      };

      add(new THREE.CapsuleGeometry(0.115, 0.20, 5, 12), 0, 0.30, 0, Math.PI / 2);   // 몸통
      const head = add(new THREE.SphereGeometry(0.105, 16, 12), 0, 0.40, 0.21);       // 머리
      head.scale.set(1, 0.95, 1.05);
      add(new THREE.ConeGeometry(0.045, 0.075, 8), -0.062, 0.475, 0.20);              // 귀
      add(new THREE.ConeGeometry(0.045, 0.075, 8), 0.062, 0.475, 0.20);
      add(new THREE.SphereGeometry(0.055, 12, 10), 0, 0.365, 0.30);                   // 주둥이
      for (const [x, z] of [[-0.07, 0.11], [0.07, 0.11], [-0.07, -0.11], [0.07, -0.11]])
        add(new THREE.CylinderGeometry(0.030, 0.026, 0.20, 8), x, 0.11, z);           // 다리
      add(new THREE.CapsuleGeometry(0.035, 0.09, 4, 8), 0, 0.40, -0.20, -0.9);        // 꼬리

      tmp.scale.setScalar(k);
      g.add(tmp);
    }

    // 탭을 받을 보이지 않는 상자
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, HEIGHT[p.stage], 1.1),
      new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = HEIGHT[p.stage] / 2;
    hit.userData.petId = p.id;
    g.add(hit);

    return { g, mixer, action };
  }

  // ── 예쁜 인형 ───────────────────────────────────────────

  _makeDoll(d) {
    const g = new THREE.Group();
    const dress = DRESS[d.look % DRESS.length];
    const hair = HAIR[d.look % HAIR.length];
    const eyeCol = EYES[d.look % EYES.length];
    const skin = 0xffe2cf;
    const broken = d.state === 2;
    const dim = (c) => broken ? new THREE.Color(c).lerp(new THREE.Color(0x8a8a8a), 0.5).getHex() : c;

    const put = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    const skinM = this._mat(dim(skin), 0.55);
    const dressM = this._mat(dim(dress), 0.5);
    const hairM = this._mat(dim(hair), 0.42);

    // ── 다리 ──
    for (const x of [-0.020, 0.020]) {
      put(new THREE.CylinderGeometry(0.0105, 0.0085, 0.115, 10), skinM, x, 0.058, 0);
      // 구두
      put(new THREE.BoxGeometry(0.020, 0.010, 0.030), this._mat(dim(0xd94f7e), 0.35), x, 0.006, 0.005);
    }

    // ── 퍼지는 드레스 ──
    const skirt = put(new THREE.ConeGeometry(0.060, 0.105, 20, 1, true), dressM, 0, 0.155, 0);
    skirt.material = dressM.clone();
    skirt.material.side = THREE.DoubleSide;
    // 치맛단
    put(new THREE.TorusGeometry(0.058, 0.004, 8, 20), this._mat(dim(0xffffff), 0.4), 0, 0.104, 0)
      .rotation.x = Math.PI / 2;

    // ── 잘록한 허리 · 상의 ──
    put(new THREE.CylinderGeometry(0.0215, 0.0155, 0.045, 14), dressM, 0, 0.228, 0);
    put(new THREE.CylinderGeometry(0.0235, 0.0215, 0.032, 14), dressM, 0, 0.262, 0);

    // ── 팔 (망가지면 한쪽이 없다) ──
    for (const x of (broken ? [-0.032] : [-0.032, 0.032])) {
      const arm = put(new THREE.CapsuleGeometry(0.0075, 0.055, 4, 8), skinM, x, 0.252, 0);
      arm.rotation.z = x < 0 ? 0.26 : -0.26;
    }

    // ── 목 · 머리 ──
    put(new THREE.CylinderGeometry(0.0085, 0.0095, 0.020, 10), skinM, 0, 0.288, 0);
    const head = put(new THREE.SphereGeometry(0.031, 22, 18), skinM, 0, 0.322, 0);
    head.scale.set(0.93, 1.08, 0.95);

    // ── 얼굴 ──
    // 눈 — 흰자 · 눈동자 · 동공 · 빛점
    const white = this._mat(0xfdfdfd, 0.25);
    const iris = this._mat(dim(eyeCol), 0.25);
    const pupil = this._mat(0x1a1418, 0.2);
    const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (const x of [-0.0115, 0.0115]) {
      const w = put(new THREE.SphereGeometry(0.0072, 14, 12), white, x, 0.3245, 0.0245);
      w.scale.set(1, 1.22, 0.55);
      put(new THREE.SphereGeometry(0.0042, 12, 10), iris, x, 0.3245, 0.0288).scale.set(1, 1.05, 0.5);
      put(new THREE.SphereGeometry(0.0020, 8, 8), pupil, x, 0.3245, 0.0300).scale.set(1, 1.05, 0.5);
      put(new THREE.SphereGeometry(0.0009, 6, 6), shine, x + 0.0018, 0.3268, 0.0305);

      // 속눈썹 — 눈 위를 덮는 얇은 판
      const lash = put(new THREE.BoxGeometry(0.0165, 0.0022, 0.0045),
        this._mat(0x241c22, 0.3), x, 0.3305, 0.0250);
      lash.rotation.x = -0.35;
      lash.rotation.z = x < 0 ? 0.12 : -0.12;

      // 눈썹
      const brow = put(new THREE.BoxGeometry(0.0135, 0.0018, 0.0030), hairM, x, 0.3365, 0.0225);
      brow.rotation.z = x < 0 ? 0.16 : -0.16;

      // 볼터치
      const blush = put(new THREE.CircleGeometry(0.0055, 14),
        new THREE.MeshBasicMaterial({ color: 0xf9a3b4, transparent: true, opacity: 0.55 }),
        x * 1.55, 0.3155, 0.0272);
      blush.rotation.y = x < 0 ? 0.35 : -0.35;
    }

    // 코
    put(new THREE.SphereGeometry(0.0022, 8, 8), skinM, 0, 0.3175, 0.0300);

    // 웃는 입
    const mouth = put(new THREE.TorusGeometry(0.0060, 0.0013, 8, 16, Math.PI * 0.85),
      this._mat(dim(0xd4506a), 0.3), 0, 0.3115, 0.0272);
    mouth.rotation.x = -0.25;
    mouth.rotation.z = Math.PI + 0.17;

    // ── 머리카락 ──
    // 뒤통수를 감싸는 덩어리
    const back = put(new THREE.SphereGeometry(0.0345, 20, 16), hairM, 0, 0.3235, -0.0035);
    back.scale.set(1.02, 1.10, 1.03);
    // 앞머리 — 이마를 덮는다
    const bang = put(new THREE.SphereGeometry(0.0325, 18, 14,
      0, Math.PI * 2, 0, Math.PI * 0.44), hairM, 0, 0.3275, 0.0035);
    bang.scale.set(1.06, 1.0, 1.06);
    // 뒤로 흘러내리는 긴 머리
    const tail1 = put(new THREE.CapsuleGeometry(0.0175, 0.070, 6, 12), hairM, 0, 0.2830, -0.0215);
    tail1.rotation.x = -0.12;
    // 옆머리 두 갈래
    for (const x of [-0.026, 0.026]) {
      const side = put(new THREE.CapsuleGeometry(0.0080, 0.040, 5, 10), hairM, x, 0.3020, 0.0055);
      side.rotation.z = x < 0 ? 0.10 : -0.10;
    }

    if (broken) head.rotation.z = 0.45;

    g.traverse(o => { if (o.isMesh) o.castShadow = true; });

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.38, 0.16),
      new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.19;
    hit.userData.dollId = d.id;
    g.add(hit);

    g.scale.setScalar(DOLL_SCALE);
    return g;
  }

  shelfSlotPos(slot) {
    const t = T.shelfSlots <= 1 ? 0.5 : slot / (T.shelfSlots - 1);
    return new THREE.Vector3(-1.72 + t * 3.44, 1.275, this.shelfZ);
  }

  // ── 저장 내용에 맞추기 ──────────────────────────────────

  sync(s, dt) {
    this._syncPets(s, dt);
    this._syncPoops(s);
    this._syncDolls(s);
    this._syncLight(s);
  }

  _syncPets(s, dt) {
    // 없어진 아이 치우기
    for (const [id, e] of [...this.pets]) {
      const p = s.pets.find(x => x.id === id);
      if (!p || p.lost) { this.petRoot.remove(e.g); this.pets.delete(id); }
    }

    let i = 0;
    for (const p of s.pets) {
      if (p.lost) continue;
      let e = this.pets.get(p.id);

      if (!e || e.stage !== p.stage || e.dead !== p.dead) {
        if (e) this.petRoot.remove(e.g);
        const made = this._makeDog(p);
        e = {
          g: made.g, mixer: made.mixer, action: made.action,
          stage: p.stage, dead: p.dead,
          target: new THREE.Vector3(0, 0, 0), nextRetarget: 0,
          act: ACT.none, actSpot: null, actUntil: 0, onArrive: null, arrived: false,
        };
        e.g.position.set(-T.roomHalfX + 0.8 + i * 1.1, 0, 0);
        this.petRoot.add(e.g);
        this.pets.set(p.id, e);
      }
      this._movePet(s, p, e, dt);
      i++;
    }
  }

  /** 어떤 아이에게 행동을 시킨다. 도착하면 onArrive 를 부른다. */
  act(petId, kind, onArrive) {
    const e = this.pets.get(petId);
    if (!e) { onArrive && onArrive(); return; }

    const spot =
      kind === ACT.eat ? this.spots.bowl :
        kind === ACT.sleep ? this.spots.cushion :
          this.spots.front;

    const secs = kind === ACT.eat ? 6 : kind === ACT.play ? 7 : kind === ACT.pat ? 4 : kind === ACT.away ? 5 : 0;

    e.act = kind;
    e.actSpot = spot.clone();
    e.actUntil = secs > 0 ? performance.now() / 1000 + secs : Infinity;
    e.arrived = false;
    e.onArrive = onArrive || null;

    // 잠깐 자리를 비우는 행동은 모습을 감춘다
    this._setHidden(e, kind === ACT.away);
    if (kind === ACT.away && onArrive) { e.onArrive = null; onArrive(); }
  }

  _setHidden(e, hide) {
    if (e.hidden === hide) return;
    e.hidden = hide;
    e.g.traverse(o => { if (o.isMesh && o.material && o.material.visible !== false) o.visible = !hide; });
  }

  _movePet(s, p, e, dt) {
    if (e.mixer) e.mixer.update(dt);
    const now = performance.now() / 1000;

    // 시킨 일이 끝났으면 다시 어슬렁거린다
    if (e.act !== ACT.none && now >= e.actUntil) {
      e.act = ACT.none; e.nextRetarget = 0; this._setHidden(e, false);
    }
    // 자면 방석으로
    if (p.asleep && e.act !== ACT.sleep) { e.act = ACT.sleep; e.actSpot = this.spots.cushion.clone(); e.actUntil = Infinity; }
    if (!p.asleep && e.act === ACT.sleep) { e.act = ACT.none; e.nextRetarget = 0; }

    if (e.act !== ACT.none && e.actSpot) {
      e.target.copy(e.actSpot);
    } else if (now >= e.nextRetarget) {
      e.nextRetarget = now + 2.5 + Math.random() * 3.5;
      e.target.set(
        (Math.random() * 2 - 1) * (T.roomHalfX - 0.6), 0,
        (Math.random() * 2 - 1) * (T.roomHalfZ - 0.6));
    }

    const still = p.asleep || p.illness >= Illness.Sick;
    const flat = new THREE.Vector3().subVectors(e.target, e.g.position); flat.y = 0;
    const dist = flat.length();

    if (!still && dist > 0.08) {
      const vigor = 0.5 + (p.mood / 100) * 0.9;
      flat.normalize();
      e.g.position.addScaledVector(flat, 0.55 * vigor * dt);

      const want = Math.atan2(flat.x, flat.z);
      e.g.rotation.y += ((want - e.g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 6);

      if (e.action) e.action.timeScale = Math.max(0.4, Math.min(1.6, vigor));
    } else {
      // 도착
      if (!e.arrived && e.act !== ACT.none) {
        e.arrived = true;
        if (e.onArrive) { e.onArrive(); e.onArrive = null; }
      }
      if (e.action) e.action.timeScale = still ? (p.asleep ? 0 : 0.12) : 0.18;

      // 놀기·쓰다듬기는 유저 쪽을 보고 반긴다
      if (e.act === ACT.play || e.act === ACT.pat) {
        e.g.rotation.y += ((Math.PI - e.g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 5);
        e.g.position.y = Math.abs(Math.sin(now * 9)) * 0.10;
        if (e.action) e.action.timeScale = 1.4;
      } else {
        e.g.position.y = 0;
      }
    }

    // 자세 — 자면 옆으로 눕고, 아프면 낮게 엎드린다
    const wantRoll = p.asleep ? 1.25 : 0;
    e.g.rotation.z += (wantRoll - e.g.rotation.z) * Math.min(1, dt * 3);
    if (p.illness >= Illness.Sick && !p.asleep) e.g.position.y = -0.02;
  }

  _syncPoops(s) {
    const alive = new Set(s.poops.map(p => p.id));
    for (const [id, m] of [...this.poops]) {
      if (!alive.has(id)) { this.poopRoot.remove(m); this.poops.delete(id); }
    }
    for (const d of s.poops) {
      if (this.poops.has(d.id)) continue;
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), this._mat(0x6b503a));
      m.scale.set(1, 0.62, 1); m.position.y = 0.05; m.castShadow = true;
      g.add(m);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.12; hit.userData.poopId = d.id;
      g.add(hit);
      g.position.set(d.x, 0, d.z);
      this.poopRoot.add(g);
      this.poops.set(d.id, g);
    }
  }

  _syncDolls(s) {
    const alive = new Set(s.dolls.map(d => d.id));
    for (const [id, e] of [...this.dolls]) {
      if (!alive.has(id)) { this.dollRoot.remove(e.g); this.dolls.delete(id); }
    }
    for (const d of s.dolls) {
      let e = this.dolls.get(d.id);
      if (!e || e.state !== d.state) {
        if (e) this.dollRoot.remove(e.g);
        e = { g: this._makeDoll(d), state: d.state };
        this.dollRoot.add(e.g);
        this.dolls.set(d.id, e);
      }
      if (d.state === 0) {
        e.g.position.copy(this.shelfSlotPos(d.shelfSlot));
        e.g.rotation.set(0, Math.PI, 0);
      } else {
        e.g.position.set(d.x, 0.04 * DOLL_SCALE, d.z);
        e.g.rotation.set(-Math.PI / 2 * 0.92, d.x * 0.9, 0);
      }
    }
  }

  _syncLight(s) {
    const n = nightDepth(s);
    this.sun.intensity = 1.6 * (1 - n) + 0.18 * n;
    this.sun.color.setHex(n > 0.5 ? 0x9fb0e8 : 0xfff7f2);
    this.fill.intensity = 0.9 * (1 - n) + 0.16 * n;
    this.scene.background.setHex(n > 0.5 ? 0x1a1622 : 0x2b2226);

    const filth = s.roomFilth / 100;
    this.floor.material.color.setHex(PINK.floorClean).lerp(new THREE.Color(PINK.floorDirty), filth);
    this.floor.material.color.multiplyScalar(1 - n * 0.55);
  }

  render() { this.renderer.render(this.scene, this.cam); }

  /** 화면 좌표를 쏴서 무엇을 눌렀는지 알아낸다 */
  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.cam);

    const hits = this.raycaster.intersectObjects(
      [this.petRoot, this.poopRoot, this.dollRoot], true);
    for (const h of hits) {
      const u = h.object.userData;
      if (u.petId) return { petId: u.petId };
      if (u.poopId) return { poopId: u.poopId };
      if (u.dollId) return { dollId: u.dollId };
    }
    return null;
  }
}
