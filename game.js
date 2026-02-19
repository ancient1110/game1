const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND = 86;
const PLAYER_SIZE = 10;

const state = {
  phase: 'ready',
  score: 0,
  best: Number(localStorage.getItem('arcane-best') || 0),
  t: 0,
  stars: makeStars(48),
  particles: [],
  player: {
    x: 132,
    y: HEIGHT * 0.45,
    vy: 0,
    flapTilt: 0,
  },
  gates: [],
  gateTimer: 0,
};

function resetGame() {
  state.phase = 'ready';
  state.score = 0;
  state.t = 0;
  state.gates.length = 0;
  state.particles.length = 0;
  state.gateTimer = 0;
  state.player.y = HEIGHT * 0.45;
  state.player.vy = 0;
  state.player.flapTilt = 0;
}

function startGame() {
  if (state.phase === 'running') {
    return;
  }
  if (state.phase === 'dead') {
    resetGame();
  }
  state.phase = 'running';
  flap();
}

function flap() {
  if (state.phase === 'ready') {
    startGame();
    return;
  }
  if (state.phase !== 'running') {
    return;
  }
  state.player.vy = -5.6;
  state.player.flapTilt = -0.45;
  emitParticles(state.player.x - 8, state.player.y + 2, 8, '#8ff8ff');
}

function makeStars(amount) {
  return Array.from({ length: amount }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * (HEIGHT - GROUND - 30),
    twinkle: Math.random() * Math.PI * 2,
    speed: 0.15 + Math.random() * 0.45,
    size: Math.random() > 0.8 ? 2 : 1,
  }));
}

function spawnGate() {
  const gap = 176;
  const topMin = 80;
  const topMax = HEIGHT - GROUND - gap - 110;
  const topHeight = topMin + Math.random() * (topMax - topMin);

  state.gates.push({
    x: WIDTH + 24,
    width: 60,
    topHeight,
    bottomY: topHeight + gap,
    passed: false,
    seed: Math.random() * 999,
  });
}

function emitParticles(x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 1.6,
      vy: (Math.random() - 0.5) * 1.6,
      life: 18 + Math.random() * 16,
      color,
      size: Math.random() > 0.45 ? 2 : 1,
    });
  }
}

function crash() {
  if (state.phase !== 'running') {
    return;
  }
  state.phase = 'dead';
  emitParticles(state.player.x, state.player.y, 36, '#ff74d5');
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('arcane-best', String(state.best));
  }
}

function update() {
  state.t += 1;

  for (const star of state.stars) {
    star.x -= star.speed;
    star.twinkle += 0.04;
    if (star.x < -4) {
      star.x = WIDTH + Math.random() * 20;
      star.y = Math.random() * (HEIGHT - GROUND - 30);
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.03;
    p.life -= 1;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }

  if (state.phase !== 'running') {
    return;
  }

  state.player.vy += 0.32;
  state.player.y += state.player.vy;
  state.player.flapTilt += 0.05;
  state.player.flapTilt = Math.min(state.player.flapTilt, 0.65);

  state.gateTimer += 1;
  if (state.gateTimer >= 92) {
    state.gateTimer = 0;
    spawnGate();
  }

  const playerRect = {
    left: state.player.x - PLAYER_SIZE,
    right: state.player.x + PLAYER_SIZE,
    top: state.player.y - PLAYER_SIZE,
    bottom: state.player.y + PLAYER_SIZE,
  };

  for (let i = state.gates.length - 1; i >= 0; i -= 1) {
    const gate = state.gates[i];
    gate.x -= 2.15;

    if (!gate.passed && gate.x + gate.width < state.player.x) {
      gate.passed = true;
      state.score += 1;
      emitParticles(state.player.x + 8, state.player.y, 10, '#ffe082');
    }

    if (gate.x + gate.width < -20) {
      state.gates.splice(i, 1);
      continue;
    }

    const inX = playerRect.right > gate.x && playerRect.left < gate.x + gate.width;
    if (inX) {
      if (playerRect.top < gate.topHeight || playerRect.bottom > gate.bottomY) {
        crash();
      }
    }
  }

  if (state.player.y + PLAYER_SIZE > HEIGHT - GROUND || state.player.y - PLAYER_SIZE < 0) {
    crash();
  }
}

function drawPixelSprite(sprite, x, y, scale, palette) {
  for (let row = 0; row < sprite.length; row += 1) {
    for (let col = 0; col < sprite[row].length; col += 1) {
      const colorId = sprite[row][col];
      if (!colorId) {
        continue;
      }
      ctx.fillStyle = palette[colorId];
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#18152f');
  grad.addColorStop(0.5, '#231f43');
  grad.addColorStop(1, '#211b33');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const star of state.stars) {
    const pulse = 0.55 + Math.sin(star.twinkle) * 0.35;
    ctx.fillStyle = `rgba(186, 225, 255, ${pulse})`;
    ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
  }

  const moonX = WIDTH - 80;
  const moonY = 86 + Math.sin(state.t * 0.01) * 2;
  ctx.fillStyle = '#c7b8ff';
  ctx.fillRect(moonX, moonY, 40, 40);
  ctx.fillStyle = '#18152f';
  ctx.fillRect(moonX + 8, moonY + 8, 30, 30);
}

function drawGate(gate) {
  const crystal = '#68f6ff';
  const shadow = '#2b6072';
  const rune = '#d5ff63';

  drawArcaneColumn(gate.x, 0, gate.width, gate.topHeight, gate.seed, crystal, shadow, rune, true);
  drawArcaneColumn(gate.x, gate.bottomY, gate.width, HEIGHT - GROUND - gate.bottomY, gate.seed + 1.3, crystal, shadow, rune, false);

  ctx.fillStyle = '#cbffff';
  ctx.fillRect(gate.x - 4, gate.topHeight - 6, gate.width + 8, 6);
  ctx.fillRect(gate.x - 4, gate.bottomY, gate.width + 8, 6);
}

function drawArcaneColumn(x, y, w, h, seed, crystal, shadow, rune, isTop) {
  ctx.fillStyle = shadow;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = crystal;
  for (let i = 0; i < h; i += 12) {
    const offset = Math.sin(seed + i * 0.1) > 0 ? 4 : 2;
    ctx.fillRect(x + offset, y + i, w - 8, 6);
  }

  ctx.fillStyle = rune;
  for (let i = 12; i < h - 12; i += 30) {
    const rx = x + 10 + ((Math.sin(seed * 8 + i) + 1) * 0.5) * (w - 20);
    ctx.fillRect(Math.round(rx), y + i, 4, 4);
  }

  if (isTop) {
    ctx.fillStyle = '#e8ffff';
    ctx.fillRect(x + 2, y + h - 10, w - 4, 4);
  } else {
    ctx.fillStyle = '#e8ffff';
    ctx.fillRect(x + 2, y + 6, w - 4, 4);
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
  const bob = Math.sin(state.t * 0.24) * (state.phase === 'running' ? 0.8 : 2);
  drawPixelSprite(dragonSprite, -16, -16 + bob, 4, dragonPalette);
  ctx.fillStyle = '#fefefe';
  ctx.fillRect(4, -3 + bob, 3, 3);
  ctx.restore();
}

function drawGround() {
  const y = HEIGHT - GROUND;
  ctx.fillStyle = '#2b2445';
  ctx.fillRect(0, y, WIDTH, GROUND);
  ctx.fillStyle = '#453968';
  for (let x = 0; x < WIDTH; x += 14) {
    ctx.fillRect(x, y + ((x / 14) % 2) * 4, 10, 6);
  }
  ctx.fillStyle = '#67ffb8';
  for (let x = 2; x < WIDTH; x += 18) {
    const wave = Math.sin((state.t + x) * 0.06) * 2;
    ctx.fillRect(x, y - 2 + wave, 2, 4);
  }
}

function drawUi() {
  ctx.fillStyle = '#f7f2ff';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`分数 ${state.score}`, 16, 40);

  ctx.font = '16px monospace';
  ctx.fillText(`最高 ${state.best}`, 16, 64);

  if (state.phase === 'ready') {
    drawBanner('点击或按空格开始');
  } else if (state.phase === 'dead') {
    drawBanner('坠入魔雾！按空格重来');
  }
}

function drawBanner(text) {
  const w = 340;
  const h = 52;
  const x = (WIDTH - w) / 2;
  const y = HEIGHT * 0.15;
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

function drawParticles() {
  for (const p of state.particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
}

function render() {
  drawBackground();
  for (const gate of state.gates) {
    drawGate(gate);
  }
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
