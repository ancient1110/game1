const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND = 76;

const spriteSheet = new Image();
let spriteReady = false;
let spriteMissing = false;

function assignSpriteSource(src) {
  spriteReady = false;
  spriteMissing = false;
  spriteSheet.src = src;
}

spriteSheet.onload = () => {
  spriteReady = true;
  spriteMissing = false;
};

spriteSheet.onerror = () => {
  spriteReady = false;
  spriteMissing = true;
};

assignSpriteSource(CHARACTER_SHEET_DATA_URL);

const CHARACTERS = {
  violet: {
    id: 'violet',
    name: '紫苑魔女（困难）',
    flap: -5.5,
    gravity: 0.34,
    hitbox: 15,
    frame: { sx: 0, sy: 0, sw: 192, sh: 192 },
  },
  gold: {
    id: 'gold',
    name: '金辉魔女（简单）',
    flap: -6.4,
    gravity: 0.27,
    hitbox: 12,
    frame: { sx: 192, sy: 0, sw: 192, sh: 192 },
  },
};

const state = {
  phase: 'select',
  score: 0,
  best: Number(localStorage.getItem('arcane-best') || 0),
  t: 0,
  stars: makeStars(72),
  particles: [],
  selectedCharacter: null,
  player: {
    x: 210,
    y: HEIGHT * 0.48,
    vy: 0,
    flapTilt: 0,
  },
  hazards: [],
  spawnTimer: 0,
};


const frameRectCache = new Map();

function getFrameDrawRect(character) {
  if (!spriteReady) {
    return { sx: character.frame.sx, sy: character.frame.sy, sw: character.frame.sw, sh: character.frame.sh };
  }
  if (frameRectCache.has(character.id)) {
    return frameRectCache.get(character.id);
  }

  const { sx, sy, sw, sh } = character.frame;

  const temp = document.createElement('canvas');
  temp.width = sw;
  temp.height = sh;
  const tctx = temp.getContext('2d');
  tctx.drawImage(spriteSheet, sx, sy, sw, sh, 0, 0, sw, sh);
  const data = tctx.getImageData(0, 0, sw, sh).data;

  const rowIsBlank = (row) => {
    let blank = 0;
    for (let x = 0; x < sw; x += 1) {
      const i = (row * sw + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const transparent = a < 10;
      const whiteStrip = a > 10 && r > 236 && g > 236 && b > 236;
      if (transparent || whiteStrip) blank += 1;
    }
    return blank / sw > 0.92;
  };

  let top = 0;
  while (top < sh - 1 && rowIsBlank(top)) top += 1;

  let bottom = sh - 1;
  while (bottom > top && rowIsBlank(bottom)) bottom -= 1;

  const rect = { sx, sy: sy + top, sw, sh: Math.max(8, bottom - top + 1) };
  frameRectCache.set(character.id, rect);
  return rect;
}


function getCharacter() {
  return CHARACTERS[state.selectedCharacter] || CHARACTERS.gold;
}

function makeStars(amount) {
  return Array.from({ length: amount }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * (HEIGHT - GROUND - 20),
    twinkle: Math.random() * Math.PI * 2,
    speed: 0.2 + Math.random() * 0.5,
    size: Math.random() > 0.82 ? 2 : 1,
  }));
}

function resetGame(toSelect = false) {
  state.phase = toSelect ? 'select' : 'ready';
  state.score = 0;
  state.t = 0;
  state.hazards = [];
  state.particles = [];
  state.spawnTimer = 0;
  state.player.y = HEIGHT * 0.48;
  state.player.vy = 0;
  state.player.flapTilt = 0;
}

function chooseCharacter(id) {
  state.selectedCharacter = id;
  resetGame(false);
}

function startGame() {
  if (!state.selectedCharacter) {
    state.phase = 'select';
    return;
  }
  if (state.phase === 'running') return;
  if (state.phase === 'dead') resetGame(false);
  state.phase = 'running';
  flap();
}

function flap() {
  if (state.phase === 'select') return;
  if (state.phase === 'ready') {
    startGame();
    return;
  }
  if (state.phase !== 'running') return;

  const character = getCharacter();
  state.player.vy = character.flap;
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

function addHazard(kind, xOffset, extra = {}) {
  state.hazards.push({
    kind,
    x: WIDTH + xOffset,
    width: 56,
    passed: false,
    phase: Math.random() * Math.PI * 2,
    ...extra,
  });
}

function spawnWave() {
  const patterns = [
    () => {
      addHazard('top-spire', 40, { height: 150 + Math.random() * 90 });
      addHazard('bottom-spire', 220, { height: 130 + Math.random() * 90 });
    },
    () => {
      addHazard('bottom-spire', 40, { height: 160 + Math.random() * 70 });
      addHazard('floating-rune', 230, { yBase: 145 + Math.random() * 180, amp: 40, width: 34, height: 34 });
    },
    () => {
      addHazard('top-spire', 40, { height: 130 + Math.random() * 80 });
      addHazard('floating-rune', 180, { yBase: 185 + Math.random() * 150, amp: 52, width: 34, height: 34 });
      addHazard('bottom-spire', 340, { height: 120 + Math.random() * 80 });
    },
    () => {
      addHazard('pulse-wall', 60, { yBase: 170 + Math.random() * 140, width: 110, thickness: 14, onThreshold: 0.4 });
      addHazard('top-spire', 280, { height: 140 + Math.random() * 80 });
    },
  ];
  patterns[Math.floor(Math.random() * patterns.length)]();
}

function collidesRect(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function getHazardRect(h) {
  if (h.kind === 'top-spire') return { left: h.x, right: h.x + h.width, top: 0, bottom: h.height };
  if (h.kind === 'bottom-spire') return { left: h.x, right: h.x + h.width, top: HEIGHT - GROUND - h.height, bottom: HEIGHT - GROUND };
  if (h.kind === 'floating-rune') {
    const y = h.yBase + Math.sin(state.t * 0.08 + h.phase) * h.amp;
    return { left: h.x, right: h.x + h.width, top: y, bottom: y + h.height };
  }
  if (h.kind === 'pulse-wall') {
    const on = Math.sin(state.t * 0.11 + h.phase) > h.onThreshold;
    if (!on) return null;
    return { left: h.x, right: h.x + h.width, top: h.yBase - h.thickness * 0.5, bottom: h.yBase + h.thickness * 0.5 };
  }
  return null;
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

  const character = getCharacter();
  state.player.vy += character.gravity;
  state.player.y += state.player.vy;
  state.player.flapTilt = Math.max(-0.75, Math.min(0.9, state.player.vy * 0.12));

  state.spawnTimer += 1;
  if (state.spawnTimer >= 170) {
    state.spawnTimer = 0;
    spawnWave();
  }

  const r = character.hitbox;
  const pRect = { left: state.player.x - r, right: state.player.x + r, top: state.player.y - r, bottom: state.player.y + r };

  for (let i = state.hazards.length - 1; i >= 0; i -= 1) {
    const h = state.hazards[i];
    h.x -= 2.2;

    if (!h.passed && h.x + h.width < state.player.x) {
      h.passed = true;
      state.score += 1;
      emitParticles(state.player.x + 8, state.player.y - 2, 8, '#ffe58a');
    }

    if (h.x + h.width < -40) {
      state.hazards.splice(i, 1);
      continue;
    }

    const rect = getHazardRect(h);
    if (rect && collidesRect(pRect, rect)) crash();
  }

  if (state.player.y + r > HEIGHT - GROUND || state.player.y - r < 0) crash();
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

function drawHazard(h) {
  if (h.kind === 'top-spire') {
    ctx.fillStyle = '#345f86';
    ctx.fillRect(h.x, 0, h.width, h.height);
    ctx.fillStyle = '#8bd1ff';
    for (let y = 0; y < h.height; y += 14) ctx.fillRect(h.x + 6, y, h.width - 12, 6);
    ctx.fillStyle = '#d8f4ff';
    ctx.fillRect(h.x - 4, h.height - 8, h.width + 8, 8);
    return;
  }
  if (h.kind === 'bottom-spire') {
    const y0 = HEIGHT - GROUND - h.height;
    ctx.fillStyle = '#3d577e';
    ctx.fillRect(h.x, y0, h.width, h.height);
    ctx.fillStyle = '#aec9ff';
    for (let y = y0; y < HEIGHT - GROUND; y += 14) ctx.fillRect(h.x + 5, y + 4, h.width - 10, 6);
    ctx.fillStyle = '#eef5ff';
    ctx.fillRect(h.x - 4, y0, h.width + 8, 8);
    return;
  }
  if (h.kind === 'floating-rune') {
    const y = h.yBase + Math.sin(state.t * 0.08 + h.phase) * h.amp;
    ctx.fillStyle = '#6d42ff';
    ctx.fillRect(h.x, y, h.width, h.height);
    ctx.fillStyle = '#f2beff';
    ctx.fillRect(h.x + 7, y + 7, h.width - 14, h.height - 14);
    return;
  }
  if (h.kind === 'pulse-wall') {
    const active = Math.sin(state.t * 0.11 + h.phase) > h.onThreshold;
    if (active) {
      ctx.fillStyle = '#ff8df9';
      ctx.fillRect(h.x, h.yBase - h.thickness * 0.5, h.width, h.thickness);
      ctx.fillStyle = '#ffe7ff';
      ctx.fillRect(h.x + 10, h.yBase - h.thickness * 0.5 + 3, h.width - 20, h.thickness - 6);
    } else {
      ctx.fillStyle = '#9677b7';
      ctx.fillRect(h.x + 6, h.yBase - 2, h.width - 12, 4);
    }
  }
}

function drawCharacterFromSheet(character, x, y, targetW, targetH) {
  if (spriteReady) {
    ctx.imageSmoothingEnabled = false;
    const rect = getFrameDrawRect(character);
    ctx.drawImage(spriteSheet, rect.sx, rect.sy, rect.sw, rect.sh, x, y, targetW, targetH);
    return;
  }

  ctx.fillStyle = '#2a2038';
  ctx.fillRect(x, y, targetW, targetH);
  ctx.strokeStyle = '#8a76b8';
  ctx.strokeRect(x + 1.5, y + 1.5, targetW - 3, targetH - 3);
  ctx.fillStyle = '#f6e7ff';
  ctx.font = '12px monospace';
  ctx.fillText(spriteMissing ? '角色图未就绪' : '正在读取角色图', x + 8, y + targetH / 2);
}

function drawCharacterPreview(character, x, y, selected, keyLabel, helpText) {
  ctx.fillStyle = selected ? '#2e274e' : '#18142c';
  ctx.fillRect(x, y, 250, 170);
  ctx.strokeStyle = selected ? '#ffd86f' : '#7a6bbd';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, 247, 167);

  drawCharacterFromSheet(character, x + 10, y + 18, 100, 120);

  ctx.fillStyle = '#f7f2ff';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(character.name, x + 118, y + 52);
  ctx.font = '14px monospace';
  ctx.fillText(helpText, x + 118, y + 80);
  ctx.fillText(`按 ${keyLabel} 选择`, x + 118, y + 108);
}

function drawSelectScreen() {
  ctx.fillStyle = '#0b0914cc';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#f8f3ff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px monospace';
  ctx.fillText('选择角色', WIDTH / 2, 92);
  ctx.font = '16px monospace';
  ctx.fillText('角色图已内嵌到代码文本中（无二进制依赖）。', WIDTH / 2, 122);

  drawCharacterPreview(CHARACTERS.violet, 120, 160, state.selectedCharacter === 'violet', '1', '重力更高 / 操作更硬核');
  drawCharacterPreview(CHARACTERS.gold, 590, 160, state.selectedCharacter === 'gold', '2', '重力更低 / 起跳更轻松');
}

function drawPlayer() {
  const character = getCharacter();
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.rotate(state.player.flapTilt);
  const bob = Math.sin(state.t * 0.24) * (state.phase === 'running' ? 1 : 2.2);
  drawCharacterFromSheet(character, -24, -24 + bob, 48, 48);
  ctx.restore();
}

function drawGround() {
  const y = HEIGHT - GROUND;
  ctx.fillStyle = '#2a2448';
  ctx.fillRect(0, y, WIDTH, GROUND);
  ctx.fillStyle = '#453d70';
  for (let x = 0; x < WIDTH; x += 16) ctx.fillRect(x, y + ((x / 16) % 2) * 4, 12, 7);
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
  const w = 520;
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
  if (state.selectedCharacter) ctx.fillText(`角色 ${getCharacter().name}`, 18, 82);

  if (state.phase === 'ready') drawBanner('准备完毕：空格/点击起飞，按 Q 可重选角色');
  if (state.phase === 'dead') drawBanner('命中障碍！空格重开，按 Q 返回选角');
}

function render() {
  drawBackground();
  for (const h of state.hazards) drawHazard(h);
  drawGround();
  drawParticles();

  if (state.phase === 'select') drawSelectScreen();
  else {
    drawPlayer();
    drawUi();
  }
}

function frame() {
  update();
  render();
  requestAnimationFrame(frame);
}


window.addEventListener('keydown', (event) => {
  if (event.code === 'Digit1') return chooseCharacter('violet');
  if (event.code === 'Digit2') return chooseCharacter('gold');
  if (event.code === 'KeyQ') return resetGame(true);
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
    event.preventDefault();
    if (state.phase === 'dead') {
      resetGame(false);
      startGame();
    } else flap();
  }
});

canvas.addEventListener('pointerdown', (event) => {
  if (state.phase === 'select') {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;

    if (x >= 120 && x <= 370 && y >= 160 && y <= 330) return chooseCharacter('violet');
    if (x >= 590 && x <= 840 && y >= 160 && y <= 330) return chooseCharacter('gold');
    return;
  }

  if (state.phase === 'dead') {
    resetGame(false);
    startGame();
  } else flap();
});

resetGame(true);
frame();
