// v0.7.5 "Rift": battle effects drawn on one canvas (beams, sparks, rings, trigger links).
// Additive blending on a black stage makes simple shapes glow. Coordinates are CSS pixels relative to the canvas.
export class FxLayer {
  constructor(canvas) {
    this.cv = canvas; this.cx = canvas.getContext('2d');
    this.items = []; this.run = false; this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * d); this.cv.height = Math.round(r.height * d);
    this.cx.setTransform(d, 0, 0, d, 0, 0);
  }
  add(it) { if (this.items.length > 160) this.items.shift(); it.t = 0; this.items.push(it); if (!this.run) { this.run = true; this.last = performance.now(); requestAnimationFrame((ts) => this.tick(ts)); } }
  // a bright streak from a to b that fades from the tail
  beam(x1, y1, x2, y2, color, width = 3, life = 0.28) { this.add({ k: 'beam', x1, y1, x2, y2, color, width, life }); }
  sparks(x, y, color, n = 10, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random());
      this.add({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, color, life: 0.35 + Math.random() * 0.3, size: 1.5 + Math.random() * 2 });
    }
  }
  ring(x, y, color, r0 = 6, r1 = 46, life = 0.4, width = 2.5) { this.add({ k: 'ring', x, y, color, r0, r1, life, width }); }
  // curved link between two allies (trigger chains)
  link(x1, y1, x2, y2, color, life = 0.55) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(40, len * 0.35);
    this.add({ k: 'link', x1, y1, x2, y2, cx: mx - dy / len * bend, cy: my + dx / len * bend, color, life });
  }
  flash(color = '#fff', life = 0.25, alpha = 0.5) { this.add({ k: 'flash', color, life, alpha }); }
  clear() { this.items = []; this.cx.clearRect(0, 0, this.w, this.h); }

  tick(ts) {
    const dt = Math.min(0.05, (ts - this.last) / 1000); this.last = ts;
    const c = this.cx; c.clearRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = 'lighter';
    this.items = this.items.filter(it => (it.t += dt) < it.life);
    for (const it of this.items) {
      const p = it.t / it.life, fade = 1 - p;
      c.globalAlpha = 1;
      switch (it.k) {
        case 'beam': {
          // the head races to the target in the first 40% of its life, then the tail catches up
          const head = Math.min(1, p / 0.4), tail = Math.max(0, (p - 0.25) / 0.75);
          const hx = it.x1 + (it.x2 - it.x1) * head, hy = it.y1 + (it.y2 - it.y1) * head;
          const tx = it.x1 + (it.x2 - it.x1) * tail, ty = it.y1 + (it.y2 - it.y1) * tail;
          c.lineCap = 'round';
          c.strokeStyle = it.color; c.globalAlpha = 0.35 * fade; c.lineWidth = it.width * 3.2;
          c.beginPath(); c.moveTo(tx, ty); c.lineTo(hx, hy); c.stroke();
          c.strokeStyle = '#fff'; c.globalAlpha = 0.9 * fade; c.lineWidth = it.width * 0.8;
          c.beginPath(); c.moveTo(tx, ty); c.lineTo(hx, hy); c.stroke();
          break;
        }
        case 'spark': {
          it.x += it.vx * dt; it.y += it.vy * dt; it.vy += 420 * dt; it.vx *= 0.96;
          c.fillStyle = it.color; c.globalAlpha = fade;
          c.fillRect(it.x - it.size / 2, it.y - it.size / 2, it.size, it.size);
          break;
        }
        case 'ring': {
          const r = it.r0 + (it.r1 - it.r0) * (1 - Math.pow(1 - p, 3));
          c.strokeStyle = it.color; c.globalAlpha = fade * 0.9; c.lineWidth = it.width * fade + 0.5;
          c.beginPath(); c.arc(it.x, it.y, r, 0, Math.PI * 2); c.stroke();
          break;
        }
        case 'link': {
          const grow = Math.min(1, p / 0.35);
          c.strokeStyle = it.color; c.lineWidth = 2.5; c.globalAlpha = fade; c.setLineDash([6, 5]); c.lineDashOffset = -it.t * 60;
          c.beginPath(); c.moveTo(it.x1, it.y1);
          // draw the quadratic curve up to `grow`
          const n = 18;
          for (let i = 1; i <= n * grow; i++) {
            const s = i / n, a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, d = s * s;
            c.lineTo(a * it.x1 + b * it.cx + d * it.x2, a * it.y1 + b * it.cy + d * it.y2);
          }
          c.stroke(); c.setLineDash([]);
          break;
        }
        case 'flash': {
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = it.color; c.globalAlpha = it.alpha * fade * fade; c.fillRect(0, 0, this.w, this.h);
          c.globalCompositeOperation = 'lighter';
          break;
        }
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (this.items.length) requestAnimationFrame((t) => this.tick(t)); else { this.run = false; c.clearRect(0, 0, this.w, this.h); }
  }
}
