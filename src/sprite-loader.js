import { POSES } from './sprite-art.js';

// Publish all three layers atomically. A failed decode never exposes half a pose.
export function createPoseLoader(decode) {
  const ready = new Map(), pending = new Map(), errors = new Map();
  function load(pose) {
    if (!POSES[pose]) return Promise.reject(new Error(`Unknown pose: ${pose}`));
    if (ready.has(pose)) return Promise.resolve(ready.get(pose));
    if (pending.has(pose)) return pending.get(pose);
    errors.delete(pose);
    const promise = Promise.all(Object.entries(POSES[pose].layers).map(async ([name,path]) => [name,await decode(path)]))
      .then(entries => { const layers = new Map(entries); ready.set(pose,layers); return layers; })
      .catch(error => { errors.set(pose,error); throw error; })
      .finally(() => pending.delete(pose));
    pending.set(pose,promise);
    return promise;
  }
  return { ready, pending, errors, load };
}

export class PoseTransition {
  constructor(reduceMotion = false) { this.pose='idle'; this.elapsed=.18; this.reduceMotion=reduceMotion; }
  select(requested, loaded) {
    const next = loaded.has(requested) ? requested : 'idle';
    if (next === this.pose) return false;
    this.pose=next; this.elapsed=this.reduceMotion ? .18 : 0;
    return true;
  }
  advance(dt) { this.elapsed=Math.min(.18,this.elapsed+dt); return this.mix; }
  get mix() { return this.reduceMotion ? 1 : this.elapsed/.18; }
}
