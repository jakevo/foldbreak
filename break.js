// The break itself (port of BreakSession.swift + the renderer in InnerBreakView.swift).
import { BREAK_OFFSET, hasUnfoldRecording, playUnfold, playSnap } from './fx.js';
import { prefs } from './prefs.js';

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const coin = () => Math.random() < 0.5;

/** Stable noise in 0..1 for a (frame, key) pair: flicker that doesn't shimmer randomly. */
function hash01(a, b) {
  let h = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const WHITE = [245, 250, 255];
const CREAK_START = 0.05;

export class BreakSession {
  /**
   * @param w,h  size of the screen being broken, in CSS px
   * @param armed  false on a first unfold set to break on the 2nd: the screen just works
   * @param hinge  true on a foldable's inner screen: damage starts at the crease
   */
  constructor(w, h, { armed = true, hinge = true } = {}) {
    this.w = w; this.h = h; this.armed = armed; this.hinge = hinge;
    this.midX = hinge ? w / 2 : w * rand(0.3, 0.7);
    this.style = prefs.damage;
    this.sound = prefs.sound;
    const delay = prefs.trigger === 'delayed' ? prefs.delaySeconds : 0;
    this.useRecording = this.sound !== 'synth' && hasUnfoldRecording();
    this.creakTime = delay + CREAK_START;
    this.breakTime = this.useRecording ? this.creakTime + BREAK_OFFSET : delay + 0.32;
    this.lines = []; this.regions = []; this.bands = [];
    this.cracks = []; this.shards = []; this.blots = [];
    this.start = performance.now();
  }

  elapsed() { return (performance.now() - this.start) / 1000; }

  begin() {
    if (!this.armed) return;
    const { w, h } = this;
    const y = h * rand(0.38, 0.72);
    const side = this.hinge ? (coin() ? 1 : -1) : (this.midX < w / 2 ? 1 : -1);
    if (this.style === 'subtle') {
      this.fracture(y, side, null, this.breakTime, true);
    } else if (this.style === 'heavy') {
      this.fracture(y, side, null, this.breakTime, true);
      for (let k = 1; k <= 2; k++) this.fracture(h * rand(0.12, 0.88), coin() ? 1 : -1, null, this.breakTime + k * 0.04, false);
      const bw = rand(18, 46), top = coin(), len = h * rand(0.35, 0.8);
      this.bands.push({ x: this.midX - bw * rand(0.2, 0.8), y: top ? 0 : h - len, w: bw, h: len, fromBottom: !top,
        t0: this.breakTime + 0.03, seed: randInt(0, 9999) });
    } else {
      this.shatter(this.midX + rand(-4, 4), y, this.breakTime, true);
    }
    if (this.sound === 'silent') return;
    if (this.useRecording) playUnfold(this.creakTime);
    else playSnap(true, this.breakTime);
  }

  /** Pressing on the screen makes the damaged panel fail a bit more. */
  tap(x, y) {
    const t = this.elapsed();
    if (!this.armed || t <= this.breakTime) return;
    if (this.style === 'shattered') {
      if (this.cracks.length > 2500) return;
      this.shatter(x, y, t, false);
    } else {
      if (this.lines.length > 40) return;
      this.fracture(y, x >= this.midX ? 1 : -1, x, t, false);
    }
    if (this.sound !== 'silent') playSnap(false);
  }

  /** Tension before the break: 0 → 1 over the last 0.8 s. */
  strain(t) {
    if (!this.armed || t >= this.breakTime) return 0;
    const k = Math.max(0, 1 - (this.breakTime - t) / 0.8);
    return k * k;
  }

  glitchOffset(r, t) {
    const dt = t - r.t0;
    if (dt < 0) return 0;
    if (dt < 0.12) return r.dy * 3 + Math.sin(dt * 140) * 4;
    return r.dy;
  }

  // Shattered glass
  shatter(cx, cy, time, main) {
    const speed = main ? 1500 : 1700;
    const maxDim = Math.max(this.w, this.h);
    const rays = main ? randInt(11, 16) : randInt(7, 10);
    const angles = [];
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + rand(-0.18, 0.18);
      angles.push(a);
      this.walk(cx, cy, a, maxDim * (main ? rand(0.15, 0.55) : rand(0.06, 0.25)), time, main ? 2.2 : 1.6, 0, speed);
    }
    const radii = main ? [12, 30, 62, 105] : [9, 22, 44];
    const rings = [];
    radii.forEach((r0, k) => {
      const pts = angles.map(a => { const r = r0 * rand(0.75, 1.3); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
      rings.push(pts);
      const tr = time + r0 / speed + 0.03 + k * 0.02;
      pts.forEach((p, i) => {
        if (Math.random() > 0.25) this.cracks.push({ a: p, b: pts[(i + 1) % pts.length], t0: tr, t1: tr + 0.04, width: 0.9 });
      });
    });
    for (let k = 0; k < rings.length - 1; k++) {
      rings[k].forEach((_, i) => {
        if (Math.random() >= 0.5) return;
        const j = (i + 1) % rings[k].length;
        const roll = Math.random();
        this.shards.push({ points: [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
          t0: time + radii[k + 1] / speed + 0.05, brightness: roll < 0.2 ? -0.5 : rand(0.05, 0.2) });
      });
    }
    this.shards.push({ points: rings[0], t0: time, brightness: 0.3 });
    if (main) {
      for (const dir of [-1, 1]) {
        let pos = [cx, cy], dist = 0;
        while (pos[1] > -10 && pos[1] < this.h + 10) {
          const step = rand(7, 15);
          const np = [this.midX + rand(-4, 4), pos[1] + dir * step];
          const t0 = time + dist / 2400;
          this.cracks.push({ a: pos, b: np, t0, t1: t0 + step / 2400, width: 1.9 });
          pos = np; dist += step;
        }
      }
    }
    this.blots.push({ x: cx, y: cy, r: main ? rand(40, 75) : rand(14, 30), t0: time + 0.05 });
  }

  walk(x, y, angle, length, start, width, depth, speed) {
    let pos = [x, y], ang = angle, dist = 0;
    while (dist < length) {
      const step = rand(9, 22);
      ang += rand(-0.3, 0.3);
      const np = [pos[0] + Math.cos(ang) * step, pos[1] + Math.sin(ang) * step];
      const t0 = start + dist / speed;
      const w = Math.max(0.5, width * (1 - dist / length));
      this.cracks.push({ a: pos, b: np, t0, t1: t0 + step / speed, width: w });
      if (depth < 2 && Math.random() < 0.08) {
        const turn = (coin() ? 1 : -1) * rand(0.4, 1.1);
        this.walk(np[0], np[1], ang + turn, (length - dist) * rand(0.3, 0.6), t0, w * 0.7, depth + 1, speed);
      }
      pos = np; dist += step;
      if (np[0] < -20 || np[1] < -20 || np[0] > this.w + 20 || np[1] > this.h + 20) break;
    }
  }

  // Line failures
  fracture(y, side, reach, time, main) {
    const cx = this.midX + rand(-3, 3);
    const { w, h } = this;
    const endX = reach != null
      ? Math.min(w - 4, Math.max(4, reach + side * rand(60, 240)))
      : (side > 0 ? w * rand(0.8, 0.97) : w * rand(0.03, 0.2));
    const tilt = rand(-0.022, 0.022) * Math.abs(endX - cx);
    const count = main ? randInt(2, 3) : randInt(1, 2);
    let yy = y, lastY = y;
    for (let i = 0; i < count; i++) {
      this.lines.push({ from: [cx, yy], to: [endX, yy + tilt + rand(-2, 2)], width: rand(1.6, 2.8),
        t0: time + i * 0.012, duration: rand(0.05, 0.09), color: WHITE, alpha: 1, seed: randInt(0, 99999) });
      lastY = yy;
      yy += rand(4, 16);
    }
    const down = main ? Math.random() < 0.75 : coin();
    const vx = cx + side * rand(2, 14);
    const vEnd = down ? h + 2 : -2;
    this.lines.push({ from: [vx, y], to: [vx + rand(-3, 3), vEnd], width: rand(1.8, 2.6), t0: time + 0.02,
      duration: 0.11, color: WHITE, alpha: 1, seed: randInt(0, 99999) });
    if (main && Math.random() < 0.55) {
      const vx2 = vx + side * rand(3, 9);
      this.lines.push({ from: [vx2, y + 6], to: [vx2, vEnd], width: 1.1, t0: time + 0.05, duration: 0.14,
        color: WHITE, alpha: 0.8, seed: randInt(0, 99999) });
    }
    if (main) {
      const x0 = Math.min(vx, endX), x1 = Math.max(vx, endX);
      const y0 = down ? lastY : 0, y1 = down ? h : y;
      this.regions.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, dy: rand(-6, -2.5), t0: time });
      const tint = coin() ? [140, 255, 153] : [255, 153, 242];
      const lx = cx - side * rand(6, 40);
      this.lines.push({ from: [lx, -2], to: [lx, h + 2], width: 1, t0: time + rand(2.5, 5), duration: 0.25,
        color: tint, alpha: 0.7, seed: randInt(0, 99999) });
    }
  }
}

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;

/**
 * Runs one break on screen: the home screen stays as it is, displaced copies of it show the
 * mis-driven pixels, and a canvas on top draws the failure lines or glass.
 */
export class BreakView {
  constructor(root, homeEl, session) {
    this.root = root; this.home = homeEl; this.s = session;
    this.regionLayer = document.createElement('div');
    this.regionLayer.className = 'fill';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fill';
    root.append(this.regionLayer, this.canvas);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(session.w * dpr);
    this.canvas.height = Math.round(session.h * dpr);
    this.canvas.style.width = session.w + 'px';
    this.canvas.style.height = session.h + 'px';
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    this.regionEls = new Map();
    this.running = true;
    const tick = () => { if (!this.running) return; this.draw(); this.raf = requestAnimationFrame(tick); };
    this.raf = requestAnimationFrame(tick);
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  draw() {
    const s = this.s, t = s.elapsed();
    // Mis-driven pixels inside the failed region: a clipped, shifted copy of the home screen
    for (const r of s.regions) {
      if (t < r.t0) continue;
      let el = this.regionEls.get(r);
      if (!el) {
        el = document.createElement('div');
        el.className = 'fill region';
        el.style.clipPath = `inset(${r.y}px ${s.w - r.x - r.w}px ${s.h - r.y - r.h}px ${r.x}px)`;
        const copy = this.home.cloneNode(true);
        copy.removeAttribute('id');
        el.append(copy);
        this.regionLayer.append(el);
        this.regionEls.set(r, el);
      }
      el.firstChild.style.transform = `translateY(${s.glitchOffset(r, t)}px)`;
    }
    this.drawLines(t);
  }

  drawLines(t) {
    const s = this.s, g = this.ctx, W = s.w, H = s.h;
    g.clearRect(0, 0, W, H);
    const strain = s.strain(t);
    if (s.hinge) {
      g.fillStyle = `rgba(255,255,255,${0.10 + 0.35 * strain})`;
      g.fillRect(s.midX - 0.5, 0, 1, H);
      g.fillStyle = 'rgba(0,0,0,0.05)';
      g.fillRect(s.midX + 0.5, 0, 1.5, H);
    }
    const frame = Math.floor(t * 30);

    // OLED bleed under glass impacts
    for (const b of s.blots) {
      if (t < b.t0) continue;
      const r = b.r * (1 - Math.exp(-(t - b.t0) * 1.4));
      if (r < 1) continue;
      g.save();
      g.translate(b.x, b.y); g.scale(1, 1.4);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.15);
      grad.addColorStop(0, 'rgba(0,0,0,0.9)');
      grad.addColorStop(0.7, 'rgba(0,0,0,0.85)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(0, 0, r * 1.15, 0, Math.PI * 2); g.fill();
      g.restore();
    }

    // Dead strips of panel, with the odd flicker back to life
    for (const b of s.bands) {
      if (t < b.t0) continue;
      const grow = Math.min(1, (t - b.t0) / 0.15);
      const hh = b.h * grow;
      const y = b.fromBottom ? b.y + b.h - hh : b.y;
      const alive = hash01(frame, b.seed) < 0.04;
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 5;
      g.fillStyle = `rgba(0,0,0,${alive ? 0.55 : 0.95})`;
      g.fillRect(b.x, y, b.w, hh);
      g.restore();
      g.fillStyle = 'rgba(179,102,255,0.5)';
      g.fillRect(b.x - 1, y, 1, hh);
    }

    for (const l of s.lines) {
      if (t < l.t0) continue;
      const f = Math.min(1, (t - l.t0) / l.duration);
      const e = 1 - (1 - f) * (1 - f);
      const ex = l.from[0] + (l.to[0] - l.from[0]) * e, ey = l.from[1] + (l.to[1] - l.from[1]) * e;
      const n = hash01(frame, l.seed);
      let level = 0.88 + 0.12 * n;
      if (n < 0.025) level = 0.25;
      const fresh = Math.max(0, 1 - (t - l.t0) / 0.25);
      // glow (overdriven for a moment when it first fails)
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.shadowColor = rgba(l.color, 0.9 * l.alpha);
      g.shadowBlur = 4 + fresh * 10;
      g.strokeStyle = rgba(l.color, (0.5 + fresh * 0.5) * level * l.alpha * 0.55);
      g.lineWidth = l.width + 2 + fresh * 4;
      g.beginPath(); g.moveTo(l.from[0], l.from[1]); g.lineTo(ex, ey); g.stroke();
      g.restore();
      g.strokeStyle = rgba(l.color, level * l.alpha);
      g.lineWidth = l.width; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(l.from[0], l.from[1]); g.lineTo(ex, ey); g.stroke();
    }

    if (s.cracks.length) this.drawGlass(t);
  }

  drawGlass(t) {
    const s = this.s, g = this.ctx;
    for (const sh of s.shards) {
      if (t < sh.t0 || sh.points.length < 3) continue;
      const fade = Math.min(1, (t - sh.t0) * 6);
      g.beginPath();
      sh.points.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.closePath();
      if (sh.brightness < 0) {
        g.fillStyle = `rgba(0,0,0,${-sh.brightness * fade})`;
      } else {
        const a = sh.points[0], b = sh.points[2];
        const grad = g.createLinearGradient(a[0], a[1], b[0], b[1]);
        grad.addColorStop(0, `rgba(255,255,255,${sh.brightness * fade})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
      }
      g.fill();
    }
    const wide = new Path2D(), thin = new Path2D();
    for (const c of s.cracks) {
      if (t < c.t0) continue;
      const f = Math.min(1, (t - c.t0) / Math.max(0.0001, c.t1 - c.t0));
      const ex = c.a[0] + (c.b[0] - c.a[0]) * f, ey = c.a[1] + (c.b[1] - c.a[1]) * f;
      const p = c.width > 1.2 ? wide : thin;
      p.moveTo(c.a[0], c.a[1]); p.lineTo(ex, ey);
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 3.2; g.stroke(wide);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2.2; g.stroke(thin);
    g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 1.7; g.stroke(wide);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.8; g.stroke(thin);
  }
}
