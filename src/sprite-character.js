import { FACE_FRAMES } from './sprite-art.js';
export const SPRITES = Object.keys(FACE_FRAMES);

const EXPRESSIONS = {
  happy: 'idle_happy', content: 'idle_content', pout: 'idle_pout',
  surprised: 'idle_surprised', sulky: 'idle_sulky', coax: 'idle_coax', wink: 'idle_wink', shy: 'idle_shy',
};

// Animation state is independent of image loading: an undecoded frame never
// replaces the current artwork with an empty canvas.
export class SpriteCharacter {
  constructor({ random = Math.random, reduceMotion = false } = {}) {
    this.random = random;
    this.reduceMotion = reduceMotion;
    this.lonely = 0;
    this.pet = 0;
    this.expression = 'idle_smile';
    this.expressionTime = 0;
    this.blinkIn = 2.5 + random() * 2.5;
    this.blinkTime = 0;
    this.bounce = 0;
    this.velocity = 0;
    this.time = 0;
    this.frame = 'idle_smile';
    this.motion = 'idle';
    this.motionTime = 0;
    this.motionDuration = 0;
  }

  get sleeping() { return this.lonely >= 5; }

  setLonely(level) {
    this.lonely = level;
    this.expressionTime = 0;
    this.pet = 0;
    this.motionTime = 0;
  }

  setExpr(name, duration = 1.6) {
    this.expression = EXPRESSIONS[name] ?? name;
    this.expressionTime = duration;
  }

  poke(strength = 1) {
    if (!this.reduceMotion) this.velocity = Math.min(70, this.velocity + strength * 55);
  }

  playMotion(name, duration = 1.2) { this.motion = name; this.motionTime = this.motionDuration = duration; }
  wave() { this.setExpr('happy', 1.2); this.playMotion('greet'); this.poke(0.5); }
  wink() { this.setExpr('wink', 1.6); this.playMotion('tilt'); }
  celebrate() { this.setExpr('happy', 2.6); this.playMotion('celebrate', 2.6); this.poke(1.2); }
  petTick() {
    this.pet = Math.min(1, this.pet + 0.45);
    this.setExpr('content', 1.8);
    this.playMotion('nuzzle', 1.8);
  }

  react(zone) {
    const expression = { head: 'pout', chin: 'content', cheek: 'shy', ear: 'surprised', tail: 'surprised', bell: 'happy' };
    this.setExpr(expression[zone] ?? 'happy', 1.6);
    this.playMotion(zone === 'head' ? 'shake' : ['tail', 'ear'].includes(zone) ? 'startle' : 'nod');
    this.poke(zone === 'chin' ? 0.25 : 0.65);
  }

  update(dt, talking = false) {
    this.time += dt;
    this.motionTime = Math.max(0, this.motionTime - dt);
    this.expressionTime = Math.max(0, this.expressionTime - dt);
    this.pet = Math.max(0, this.pet - dt * 0.28);
    this.blinkIn -= dt;
    this.blinkTime = Math.max(0, this.blinkTime - dt);
    if (this.blinkIn <= 0) {
      this.blinkTime = 0.14;
      this.blinkIn = 2.5 + this.random() * 3;
    }
    this.velocity += (-this.bounce * 100 - this.velocity * 13) * dt;
    this.bounce += this.velocity * dt;

    // Reactions stay readable while their dialogue is on screen. Speech frames
    // only alternate on the neutral face, never over a pout or sleeping face.
    this.frame = this.sleeping ? 'idle_sleep'
      : this.expressionTime > 0 ? this.expression
      : this.pet > 0.15 ? 'idle_content'
      : this.lonely >= 3 ? 'idle_sulky'
      : this.lonely > 0 ? 'idle_coax'
      : this.blinkTime > 0 ? 'idle_blink'
      : talking && Math.floor(this.time / 0.18) % 2 === 0 ? 'idle_talk'
      : 'idle_smile';
    return this.frame;
  }

  transform(rect) {
    const breath = this.reduceMotion ? 0 : Math.sin(this.time * 1.65);
    const phase = this.motionDuration ? 1 - this.motionTime / this.motionDuration : 1;
    const envelope = this.reduceMotion ? 0 : Math.sin(phase * Math.PI);
    const turn = { shake: Math.sin(phase * Math.PI * 6) * 0.018, tilt: -0.018,
      nuzzle: Math.sin(phase * Math.PI * 2) * 0.012, greet: 0.009, celebrate: Math.sin(phase * Math.PI * 4) * 0.014 };
    const nod = ['nod', 'greet', 'nuzzle'].includes(this.motion) ? Math.sin(phase * Math.PI * 4) * 3 : 0;
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height - (this.reduceMotion ? 0 : this.bounce) + envelope * nod,
      width: rect.width * (1 + breath * 0.0015),
      height: rect.height * (1 + breath * 0.003),
      angle: this.reduceMotion ? 0 : Math.sin(this.time * 0.7) * 0.003 + envelope * (turn[this.motion] ?? 0),
    };
  }

  get hairAngle() {
    if (this.reduceMotion) return 0;
    return Math.sin(this.time * 1.4) * 0.003 + Math.max(-0.008, Math.min(0.008, this.velocity * 0.0003));
  }
}

export function fitSprite(width, top, bottom) {
  const height = Math.max(1, Math.min(bottom - top, width * 0.96 * 1.5));
  return { x: (width - height / 1.5) / 2, y: bottom - height, width: height / 1.5, height };
}

// Normalized artwork coordinates <-> CSS pixels; use the same transform for
// rendering and hit testing so breathing/bouncing doesn't move the touch zones.
export function projectPoint(point, transform) {
  const x = (point.x - 0.5) * transform.width;
  const y = (point.y - 1) * transform.height;
  const c = Math.cos(transform.angle), s = Math.sin(transform.angle);
  return { x: transform.x + x * c - y * s, y: transform.y + x * s + y * c };
}

export function unprojectPoint(point, transform) {
  const x = point.x - transform.x, y = point.y - transform.y;
  const c = Math.cos(transform.angle), s = Math.sin(transform.angle);
  return { x: (x * c + y * s) / transform.width + 0.5, y: (-x * s + y * c) / transform.height + 1 };
}

export function spriteZone({ x, y }) {
  const ellipse = (cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  if (x < 0 || y < 0 || x > 1 || y > 1) return null;
  if (ellipse(0.5, 0.367, 0.045, 0.03)) return 'bell';
  if (ellipse(0.48, 0.315, 0.115, 0.026)) return 'chin';
  if (ellipse(0.40, 0.276, 0.035, 0.014) || ellipse(0.56, 0.252, 0.035, 0.014)) return 'cheek';
  if (y < 0.175 && (x < 0.34 || x > 0.565)) return 'ear';
  if (ellipse(0.46, 0.20, 0.29, 0.17)) return 'head';
  if (x > 0.80 && y > 0.47 && y < 0.88) return 'tail';
  return 'body';
}
