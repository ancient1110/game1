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
  encounters: [],
  encounterTimer: 0,
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
  state.encounters = [];
  state.particles = [];
  state.encounterTimer = 0;
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

function spawnEncounter() {
  const variants = ['swing-orb', 'drift-shards', 'pulse-beam', 'narrow-gate'];
  const variant = variants[Math.floor(Math.random() * variants.length)];

  const baseGap = {
    'swing-orb': 190,
    'drift-shards': 196,
    'pulse-beam': 205,
    'narrow-gate': 178,
  }[variant];

  const topMin = 45;
  const topMax = HEIGHT - GROUND - baseGap - 45;
  const topHeight = topMin + Math.random() * (topMax - topMin);

  state.encounters.push({
    variant,
    x: WIDTH + 50,
    width: 94,
    topHeight,
    bottomY: topHeight + baseGap,
    passed: false,
    seed: Math.random() * 1000,
    phase: Math.random() * Math.PI * 2,
  });
}

function collidesRect(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function getDynamicHazards(e) {
  const hazards = [];

  if (e.variant === 'swing-orb') {
    const centerY = (e.topHeight + e.bottomY) / 2;
    const swing = Math.sin(state.t * 0.08 + e.phase) * 56;
    hazards.push({
      left: e.x + 36,
      right: e.x + 62,
      top: centerY + swing - 13,
      bottom: centerY + swing + 13,
      type: 'orb',
    });
  }

  if (e.variant === 'drift-shards') {
    const drift = Math.sin(state.t * 0.06 + e.phase) * 36;
    hazards.push({
      left: e.x + 20,
      right: e.x + 46,
      top: e.topHeight - 34 + drift,
      bottom: e.topHeight + drift,
      type: 'shard',
    });
    hazards.push({
      left: e.x + 48,
      right: e.x + 74,
      top: e.bottomY - drift,
      bottom: e.bottomY + 34 - drift,
      type: 'shard',
    });
  }

  if (e.variant === 'pulse-beam') {
    const pulse = Math.sin(state.t * 0.11 + e.phase);
    if (pulse > 0.35) {
      const by = (e.topHeight + e.bottomY) / 2;
      hazards.push({
        left: e.x + 6,
        right: e.x + e.width - 6,
        top: by - 8,
        bottom: by + 8,
        type: 'beam',
      });
    }
  }

  if (e.variant === 'narrow-gate') {
    const pinch = (Math.sin(state.t * 0.09 + e.phase) + 1) * 0.5;
    const inset = 12 + pinch * 12;
    hazards.push({
      left: e.x + inset,
      right: e.x + inset + 10,
      top: e.topHeight - 24,
      bottom: e.topHeight + 18,
      type: 'fang',
    });
    hazards.push({
      left: e.x + e.width - inset - 10,
      right: e.x + e.width - inset,
      top: e.bottomY - 18,
      bottom: e.bottomY + 24,
      type: 'fang',
    });
  }

  return hazards;
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

  state.encounterTimer += 1;
  if (state.encounterTimer >= 150) {
    state.encounterTimer = 0;
    spawnEncounter();
  }

  const pRect = {
    left: state.player.x - PLAYER_SIZE,
    right: state.player.x + PLAYER_SIZE,
    top: state.player.y - PLAYER_SIZE,
    bottom: state.player.y + PLAYER_SIZE,
  };

  for (let i = state.encounters.length - 1; i >= 0; i -= 1) {
    const e = state.encounters[i];
    e.x -= 2.25;

    if (!e.passed && e.x + e.width < state.player.x) {
      e.passed = true;
      state.score += 1;
      emitParticles(state.player.x + 6, state.player.y - 2, 11, '#ffe58a');
    }

    if (e.x + e.width < -30) {
      state.encounters.splice(i, 1);
      continue;
    }

    const inX = pRect.right > e.x && pRect.left < e.x + e.width;
    if (inX && (pRect.top < e.topHeight || pRect.bottom > e.bottomY)) {
      crash();
    }

    if (inX) {
      for (const hazard of getDynamicHazards(e)) {
        if (collidesRect(pRect, hazard)) {
          crash();
          break;
        }
      }
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

function drawArcaneColumn(x, y, w, h, seed, variant) {
  const colorMap = {
    'swing-orb': ['#33456f', '#7db3ff', '#8ffff2'],
    'drift-shards': ['#2f5f72', '#67f7ff', '#d9ff72'],
    'pulse-beam': ['#5f3478', '#c685ff', '#ffa5ff'],
    'narrow-gate': ['#544d76', '#b0a2d8', '#f5f0ff'],
  };
  const [shadow, body, rune] = colorMap[variant];

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

function drawHazard(h) {
  if (h.type === 'orb') {
    ctx.fillStyle = '#6a43ff';
    ctx.fillRect(h.left, h.top, h.right - h.left, h.bottom - h.top);
    ctx.fillStyle = '#e7b3ff';
    ctx.fillRect(h.left + 6, h.top + 6, 8, 8);
    return;
  }

  if (h.type === 'shard') {
    ctx.fillStyle = '#c8ffff';
    ctx.fillRect(h.left, h.top, h.right - h.left, h.bottom - h.top);
    ctx.fillStyle = '#5ad5ef';
    ctx.fillRect(h.left + 5, h.top + 5, 8, h.bottom - h.top - 10);
    return;
  }

  if (h.type === 'beam') {
    ctx.fillStyle = '#ff8df9';
    ctx.fillRect(h.left, h.top, h.right - h.left, h.bottom - h.top);
    ctx.fillStyle = '#ffe7ff';
    ctx.fillRect(h.left + 10, h.top + 3, h.right - h.left - 20, h.bottom - h.top - 6);
    return;
  }

  if (h.type === 'fang') {
    ctx.fillStyle = '#f4f0ff';
    ctx.fillRect(h.left, h.top, h.right - h.left, h.bottom - h.top);
  }
}

function drawEncounter(e) {
  drawArcaneColumn(e.x, 0, e.width, e.topHeight, e.seed, e.variant);
  drawArcaneColumn(e.x, e.bottomY, e.width, HEIGHT - GROUND - e.bottomY, e.seed + 2.1, e.variant);

  ctx.fillStyle = '#d6f6ff';
  ctx.fillRect(e.x - 5, e.topHeight - 7, e.width + 10, 7);
  ctx.fillRect(e.x - 5, e.bottomY, e.width + 10, 7);

  for (const hazard of getDynamicHazards(e)) {
    drawHazard(hazard);
  }

  if (e.variant === 'pulse-beam') {
    const pulse = Math.sin(state.t * 0.11 + e.phase);
    const by = (e.topHeight + e.bottomY) / 2;
    if (pulse <= 0.35) {
      ctx.fillStyle = '#9a78c8';
      ctx.fillRect(e.x + 8, by - 2, e.width - 16, 4);
    }
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
  const w = 450;
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

  if (state.phase === 'ready') drawBanner('节奏放缓：障碍更少，但机制更多样');
  if (state.phase === 'dead') drawBanner('撞上机制陷阱！按空格再战一局');
}

function render() {
  drawBackground();
  for (const e of state.encounters) drawEncounter(e);
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
