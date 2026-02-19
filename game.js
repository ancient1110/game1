const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND = 76;
const PLAYER_SIZE = 14;

const state = {
  phase: 'ready',
  score: 0,
  best: Number(localStorage.getItem('arcane-best') || 0),
  t: 0,
  stars: makeStars(72),
  particles: [],
  player: {
    x: 210,
    y: HEIGHT * 0.48,
    vy: 0,
    flapTilt: 0,
  },
  obstacles: [],
  obstacleTimer: 0,
};

function makeStars(amount) {
  return Array.from({ length: amount }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * (HEIGHT - GROUND - 20),
    twinkle: Math.random() * Math.PI * 2,
    speed: 0.2 + Math.random() * 0.5,
    size: Math.random() > 0.82 ? 2 : 1,
  }));
}

function resetGame() {
  state.phase = 'ready';
  state.score = 0;
  state.t = 0;
  state.obstacles = [];
  state.particles = [];
  state.obstacleTimer = 0;
  state.player.y = HEIGHT * 0.48;
  state.player.vy = 0;
  state.player.flapTilt = 0;
}

function startGame() {
  if (state.phase === 'running') return;
  if (state.phase === 'dead') resetGame();
  state.phase = 'running';
  flap();
}

function flap() {
  if (state.phase === 'ready') {
    startGame();
    return;
  }
  if (state.phase !== 'running') return;

  state.player.vy = -5.9;
  state.player.flapTilt = -0.45;
  emitParticles(state.player.x - 10, state.player.y + 1, 8, '#8ff8ff');
}

function emitParticles(x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 1.8,
      vy: (Math.random() - 0.5) * 1.8,
      life: 16 + Math.random() * 18,
      color,
      size: Math.random() > 0.45 ? 2 : 1,
    });
  }
}

function crash() {
  if (state.phase !== 'running') return;
  state.phase = 'dead';
  emitParticles(state.player.x, state.player.y, 48, '#ff88d8');
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('arcane-best', String(state.best));
  }
}

function spawnObstacle() {
  const variants = ['crystal-gate', 'tooth-gate', 'rune-wheel'];
  const variant = variants[Math.floor(Math.random() * variants.length)];
  const gap = variant === 'rune-wheel' ? 166 : 182;
  const topMin = 42;
  const topMax = HEIGHT - GROUND - gap - 42;
  const topHeight = topMin + Math.random() * (topMax - topMin);

  state.obstacles.push({
    variant,
    x: WIDTH + 40,
    width: 82,
    topHeight,
    bottomY: topHeight + gap,
    passed: false,
    seed: Math.random() * 1000,
    bobPhase: Math.random() * Math.PI * 2,
  });
}

function collidesRect(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function update() {
  state.t += 1;

  for (const star of state.stars) {
    star.x -= star.speed;
    star.twinkle += 0.035;
    if (star.x < -3) {
      star.x = WIDTH + Math.random() * 18;
      star.y = Math.random() * (HEIGHT - GROUND - 20);
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.03;
    p.life -= 1;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  if (state.phase !== 'running') return;

  state.player.vy += 0.31;
  state.player.y += state.player.vy;
  state.player.flapTilt = Math.min(state.player.flapTilt + 0.05, 0.64);

  state.obstacleTimer += 1;
  if (state.obstacleTimer >= 94) {
    state.obstacleTimer = 0;
    spawnObstacle();
  }

  const pRect = {
    left: state.player.x - PLAYER_SIZE,
    right: state.player.x + PLAYER_SIZE,
    top: state.player.y - PLAYER_SIZE,
    bottom: state.player.y + PLAYER_SIZE,
  };

  for (let i = state.obstacles.length - 1; i >= 0; i -= 1) {
    const o = state.obstacles[i];
    o.x -= 3;

    if (!o.passed && o.x + o.width < state.player.x) {
      o.passed = true;
      state.score += 1;
      emitParticles(state.player.x + 6, state.player.y - 2, 11, '#ffe58a');
    }

    if (o.x + o.width < -30) {
      state.obstacles.splice(i, 1);
      continue;
    }

    const inX = pRect.right > o.x && pRect.left < o.x + o.width;
    if (inX && (pRect.top < o.topHeight || pRect.bottom > o.bottomY)) {
      crash();
    }

    if (o.variant === 'tooth-gate' && inX) {
      const toothTop = {
        left: o.x + 20,
        right: o.x + o.width - 20,
        top: o.topHeight - 20,
        bottom: o.topHeight,
      };
      const toothBottom = {
        left: o.x + 20,
        right: o.x + o.width - 20,
        top: o.bottomY,
        bottom: o.bottomY + 20,
      };
      if (collidesRect(pRect, toothTop) || collidesRect(pRect, toothBottom)) crash();
    }

    if (o.variant === 'rune-wheel') {
      const wheelY = (o.topHeight + o.bottomY) / 2 + Math.sin(state.t * 0.08 + o.bobPhase) * 42;
      const wheel = {
        left: o.x + 30,
        right: o.x + 56,
        top: wheelY - 13,
        bottom: wheelY + 13,
      };
      if (collidesRect(pRect, wheel)) crash();
    }
  }

  if (state.player.y + PLAYER_SIZE > HEIGHT - GROUND || state.player.y - PLAYER_SIZE < 0) crash();
}

function drawPixelSprite(sprite, x, y, scale, palette) {
  for (let row = 0; row < sprite.length; row += 1) {
    for (let col = 0; col < sprite[row].length; col += 1) {
      const c = sprite[row][col];
      if (!c) continue;
      ctx.fillStyle = palette[c];
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#171430');
  grad.addColorStop(0.5, '#221e43');
  grad.addColorStop(1, '#1d1a32');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const star of state.stars) {
    const pulse = 0.56 + Math.sin(star.twinkle) * 0.32;
    ctx.fillStyle = `rgba(186, 225, 255, ${pulse})`;
    ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
  }

  drawMoon(WIDTH - 110, 78);
}

function drawMoon(x, y) {
  const moonSprite = [
    [0, 0, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
  ];
  drawPixelSprite(moonSprite, x, y, 7, { 1: '#c7b8ff' });
  drawPixelSprite(
    [
      [0, 2, 2, 0],
      [2, 2, 2, 0],
      [2, 2, 2, 2],
      [0, 2, 2, 2],
    ],
    x + 20,
    y + 15,
    7,
    { 2: '#171430' },
  );
}

function drawArcaneColumn(x, y, w, h, seed, variant) {
  const shadow = variant === 'tooth-gate' ? '#4f5b78' : '#2b6072';
  const body = variant === 'tooth-gate' ? '#8da2cb' : '#69f7ff';
  const rune = variant === 'rune-wheel' ? '#ffa4fe' : '#dbff6d';

  ctx.fillStyle = shadow;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = body;
  for (let i = 0; i < h; i += 13) {
    const offset = Math.sin(seed + i * 0.1) > 0 ? 5 : 2;
    ctx.fillRect(x + offset, y + i, w - 10, 6);
  }

  ctx.fillStyle = rune;
  for (let i = 12; i < h - 12; i += 26) {
    const rx = x + 8 + ((Math.sin(seed * 9 + i) + 1) * 0.5) * (w - 16);
    ctx.fillRect(Math.round(rx), y + i, 4, 4);
  }
}

function drawObstacle(o) {
  drawArcaneColumn(o.x, 0, o.width, o.topHeight, o.seed, o.variant);
  drawArcaneColumn(o.x, o.bottomY, o.width, HEIGHT - GROUND - o.bottomY, o.seed + 2.1, o.variant);

  if (o.variant === 'crystal-gate') {
    ctx.fillStyle = '#d5ffff';
    ctx.fillRect(o.x - 6, o.topHeight - 8, o.width + 12, 8);
    ctx.fillRect(o.x - 6, o.bottomY, o.width + 12, 8);
  }

  if (o.variant === 'tooth-gate') {
    ctx.fillStyle = '#e9f4ff';
    for (let x = o.x + 20; x < o.x + o.width - 20; x += 10) {
      ctx.fillRect(x, o.topHeight - 20, 6, 20);
      ctx.fillRect(x, o.bottomY, 6, 20);
    }
  }

  if (o.variant === 'rune-wheel') {
    ctx.fillStyle = '#bddeff';
    ctx.fillRect(o.x - 5, o.topHeight - 8, o.width + 10, 8);
    ctx.fillRect(o.x - 5, o.bottomY, o.width + 10, 8);

    const wy = (o.topHeight + o.bottomY) / 2 + Math.sin(state.t * 0.08 + o.bobPhase) * 42;
    ctx.fillStyle = '#7f4eff';
    ctx.fillRect(o.x + 30, wy - 13, 26, 26);
    ctx.fillStyle = '#f6b8ff';
    ctx.fillRect(o.x + 36, wy - 7, 14, 14);
    ctx.fillStyle = '#1f1533';
    ctx.fillRect(o.x + 41, wy - 2, 4, 4);
  }
}

const dragonSprite = [
  [0, 0, 0, 2, 2, 2, 0, 0],
  [0, 0, 2, 1, 1, 1, 2, 0],
  [0, 2, 1, 3, 1, 1, 1, 2],
  [2, 1, 1, 3, 3, 1, 1, 2],
  [2, 1, 1, 1, 1, 1, 1, 2],
  [0, 2, 1, 1, 1, 1, 2, 0],
  [0, 0, 2, 1, 1, 2, 0, 0],
  [0, 2, 0, 2, 2, 0, 2, 0],
];

const dragonPalette = {
  1: '#9d7dff',
  2: '#5a3ec2',
  3: '#a9f4ff',
};

function drawPlayer() {
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.rotate(state.player.flapTilt);
  const bob = Math.sin(state.t * 0.24) * (state.phase === 'running' ? 1 : 2.2);
  drawPixelSprite(dragonSprite, -16, -16 + bob, 4, dragonPalette);
  ctx.fillStyle = '#fefefe';
  ctx.fillRect(4, -3 + bob, 3, 3);
  ctx.restore();
}

function drawGround() {
  const y = HEIGHT - GROUND;
  ctx.fillStyle = '#2a2448';
  ctx.fillRect(0, y, WIDTH, GROUND);
  ctx.fillStyle = '#453d70';
  for (let x = 0; x < WIDTH; x += 16) {
    ctx.fillRect(x, y + ((x / 16) % 2) * 4, 12, 7);
  }
  ctx.fillStyle = '#65ffb4';
  for (let x = 2; x < WIDTH; x += 20) {
    const wave = Math.sin((state.t + x) * 0.07) * 2;
    ctx.fillRect(x, y - 3 + wave, 2, 5);
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
}

function drawBanner(text) {
  const w = 440;
  const h = 52;
  const x = (WIDTH - w) / 2;
  const y = HEIGHT * 0.13;
  ctx.fillStyle = '#0d0a18cc';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8b7bd3';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.fillStyle = '#e5dbff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(text, WIDTH / 2, y + 33);
}

function drawUi() {
  ctx.fillStyle = '#f7f2ff';
  ctx.textAlign = 'left';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`分数 ${state.score}`, 18, 38);
  ctx.font = '16px monospace';
  ctx.fillText(`最高 ${state.best}`, 18, 60);

  if (state.phase === 'ready') drawBanner('横屏秘境开启：点击或按空格起飞');
  if (state.phase === 'dead') drawBanner('撞上障碍！按空格再战一局');
}

function render() {
  drawBackground();
  for (const o of state.obstacles) drawObstacle(o);
  drawGround();
  drawParticles();
  drawPlayer();
  drawUi();
}

function frame() {
  update();
  render();
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
    event.preventDefault();
    if (state.phase === 'dead') {
      resetGame();
      startGame();
    } else {
      flap();
    }
  }
});

canvas.addEventListener('pointerdown', () => {
  if (state.phase === 'dead') {
    resetGame();
    startGame();
  } else {
    flap();
  }
});

resetGame();
frame();
