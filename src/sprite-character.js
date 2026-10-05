import { FACE_FRAMES, POSES } from './sprite-art.js';
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
    this.temporaryPose = null;
    this.deferPoseTimers = false;
    this.presentedPose = 'idle';
    this.channels = { blink:false, talk:false };
    this.expressionFrame = 'idle_smile';
  }

  get sleeping() { return this.lonely >= 5; }
  get pose() {
    if (this.sleeping) return 'idle';
    return this.temporaryPose?.name ?? (this.lonely >= 3 ? 'tail' : this.lonely > 0 ? 'paws' : 'idle');
  }
  // Sleep > celebration > touch > greeting > persistent loneliness.
  requestPose(name, seconds, priority) {
    if (!POSES[name]) throw new Error(`Unknown pose: ${name}`);
    if (this.sleeping || (this.temporaryPose && this.temporaryPose.priority > priority)) return false;
    this.temporaryPose = { name, remaining:seconds, priority };
    return true;
  }
  presentPose(name) { this.presentedPose = name; }


  setLonely(level) {
    this.lonely = Math.max(0, Math.min(5, level));
    this.temporaryPose = null;
    this.expressionTime = 0;
    this.pet = 0;
    this.motionTime = 0;
  }

  setExpr(name, duration = 1.6) {
    this.expression = EXPRESSIONS[name] ?? (name.startsWith('idle_') ? name : `idle_${name}`);
    this.expressionTime = duration;
    if (['content', 'coax', 'shy'].includes(name)) this.requestPose('paws', duration, 20);
  }

  poke(strength = 1) {
    if (!this.reduceMotion) this.velocity = Math.min(70, this.velocity + strength * 55);
  }

  playMotion(name, duration = 1.2) { this.motion = name; this.motionTime = this.motionDuration = duration; }
  wave() { if (!this.requestPose('wave', 1.6, 10)) return; this.setExpr('smile', 1.6); this.playMotion('greet', 1.6); this.poke(0.5); }
  wink() { this.setExpr('wink', 1.6); this.playMotion('tilt'); }
  celebrate() { if (!this.requestPose('cheer', 2.6, 30)) return; this.setExpr('happy', 2.6); this.playMotion('celebrate', 2.6); this.poke(1.2); }
  petTick() {
    if (!this.requestPose('paws', 1.5, 20)) return;
    this.pet = Math.min(1, this.pet + 0.45);
    this.setExpr('content', 1.5);
    this.playMotion('nuzzle', 1.5);
  }

  react(zone) {
    const expression = { head: 'pout', chin: 'content', cheek: 'shy', ear: 'surprised', tail: 'surprised', bell: 'happy' };
    this.setExpr(expression[zone] ?? 'happy', 1.6);
    this.playMotion(zone === 'head' ? 'shake' : ['tail', 'ear'].includes(zone) ? 'startle' : 'nod');
    this.poke(zone === 'chin' ? 0.25 : 0.65);
  }

  update(dt, talking = false) {
    this.time += dt;
    if (this.temporaryPose && (!this.deferPoseTimers || this.presentedPose === this.pose)) {
      this.temporaryPose.remaining -= dt;
      if (this.temporaryPose.remaining <= 0) this.temporaryPose = null;
    }
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
    this.expressionFrame = this.sleeping ? 'idle_sleep'
      : this.expressionTime > 0 ? this.expression
      : this.pose === 'tail' ? 'idle_sulky'
      : this.pose === 'paws' ? (this.lonely ? 'idle_coax' : 'idle_content')
      : this.pose === 'cheer' ? 'idle_happy' : 'idle_smile';
    this.channels = { blink:!this.sleeping && this.blinkTime > 0,
      talk:!this.sleeping && talking && Math.floor(this.time / 0.18) % 2 === 0 };
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

export function spriteZone({ x, y }, pose = 'idle') {
  if (x < 0 || y < 0 || x > 1 || y > 1) return null;
  x *= 1024; y *= 1536;
  for (const region of POSES[pose].zones) {
    if (region.polygon) {
      let inside=false;
      const points=region.polygon;
      for(let i=0,j=points.length-1;i<points.length;j=i++) {
        const [xi,yi]=points[i], [xj,yj]=points[j];
        if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
      }
      if (inside) return region.zone;
    } else if (region.ellipse) {
      const [cx,cy,rx,ry] = region.ellipse;
      if (((x-cx)/rx)**2 + ((y-cy)/ry)**2 <= 1) return region.zone;
    } else {
      const [left,top,width,height] = region.rect;
      if (x >= left && x <= left+width && y >= top && y <= top+height) return region.zone;
    }
  }
  return 'body';
}
