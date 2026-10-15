// Original-size pose drawings, shared fixed head/feet, and lightweight canvas effects.
// The page only downloads idle initially; the other three poses load near the card.
export function createAdoptionCat(root, ui) {
  const button = root.querySelector('button');
  const idle = root.querySelector('img');
  const canvas = root.querySelector('canvas');
  const speech = root.querySelector('[role="status"]');
  const ctx = canvas.getContext('2d');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const images = new Map();
  const rows = ['..ooo...ooo..', '.opppoppppo.', 'opphhppppppo', 'opphpppppppo',
    'oppppppppppo', '.oppppppppo.', '..oppppppo..', '...oppppo...', '....oppo....', '.....oo.....'];
  let loading, request = 0, sequence = 0, resetTimer;

  function load() {
    if (!loading) loading = Promise.all(['idle', 'raise', 'near', 'heart'].map(async pose => {
      const image = pose === 'idle' ? idle : new Image();
      if (pose !== 'idle') image.src = `/pixel-cat/${pose}.webp`;
      await image.decode();
      images.set(pose, image);
    })).catch(error => { loading = undefined; throw error; });
    return loading;
  }

  function heart(x, y, unit, alpha) {
    ctx.globalAlpha = alpha;
    const colors = { o: '#a7537f', p: '#f193b6', h: '#ffe0e8' };
    rows.forEach((row, dy) => [...row].forEach((pixel, dx) => {
      if (!colors[pixel]) return;
      ctx.fillStyle = colors[pixel];
      ctx.fillRect(Math.floor(x - 13 * unit / 2) + dx * unit,
        Math.floor(y - 10 * unit / 2) + dy * unit, unit, unit);
    }));
    ctx.globalAlpha = 1;
  }

  function effects(progress) {
    const n = progress * 24;
    if (n >= 2 && n < 20) heart(502, 658, n < 5 ? 2 : 3, Math.min(1, (n - 1) / 3, (20 - n) / 4));
    for (let k = 0; k < 3; k++) {
      const age = n - 4 - k * 4;
      if (age < 0 || age >= 16) continue;
      const p = age / 15;
      const x = [883, 106, 815][k], y = [475, 780, 265][k] - Math.floor(p * 120);
      const alpha = Math.min(1, (age + 1) / 3, (16 - age) / 4);
      heart(x + Math.floor(Math.sin(p * Math.PI) * 12), y, k === 0 ? 5 : 4, alpha);
      if (age > 3 && age < 12) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffd994';
        ctx.fillRect(x - 37, y + 19, 15, 3);
        ctx.fillRect(x - 31, y + 13, 3, 15);
        ctx.globalAlpha = 1;
      }
    }
  }

  function stop() {
    cancelAnimationFrame(request);
    clearTimeout(resetTimer);
    canvas.hidden = true;
    idle.style.visibility = '';
    root.classList.remove('is-playing');
    button.removeAttribute('aria-busy');
  }

  async function play(message = ui.catHeart) {
    const current = ++sequence;
    stop();
    speech.textContent = ui.catLoading;
    button.setAttribute('aria-busy', 'true');
    try {
      await load();
      if (current !== sequence) return;
      speech.textContent = message;
      button.removeAttribute('aria-busy');
      root.classList.add('is-playing');
      canvas.hidden = false;
      idle.style.visibility = 'hidden';
      const start = performance.now();
      const draw = now => {
        const t = (now - start) / 1000;
        if (t >= (motion.matches ? 1.8 : 3.6)) { stop(); return; }
        const pose = motion.matches ? 'heart' : t < .8 || t >= 3 ? 'idle'
          : t < 1 || t >= 2.8 ? 'raise' : t < 1.2 || t >= 2.6 ? 'near' : 'heart';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(images.get(pose), 0, 0);
        if (!motion.matches && t >= 1.2 && t < 2.6) effects((t - 1.2) / 1.4);
        if (motion.matches) resetTimer = setTimeout(stop, 1800);
        else request = requestAnimationFrame(draw);
      };
      draw(start);
    } catch {
      if (current !== sequence) return;
      stop();
      speech.textContent = ui.catRetry;
    }
  }

  button.addEventListener('click', () => { void play(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { sequence++; stop(); }
  });
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      void load().catch(() => {});
    }
  }, { rootMargin: '200px' });
  observer.observe(root);
  return { play };
}
