const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const stageEl = document.querySelector(".stage");
const artSwitch = document.querySelector("#artSwitch");
const artSwitchText = artSwitch.querySelector(".art-switch__text");

const VIEW_W = 810;
const VIEW_H = 480;
const WORLD_W = 1460;
const GRAVITY = 1850;
const JUMP_VELOCITY = -690;
const MOVE_ACCEL = 2600;
const MAX_SPEED = 265;
const FRICTION = 1900;
const PLAYER_SPRITE_W = 96;
const PLAYER_SPRITE_H = 110;
const PLAYER_ASSET_DIR = "./assets/player_gpt2_v2";
const REALISTIC_BG_SRC = "./assets/realistic_mountain_bg_game.jpg";
const REALISTIC_CHICK_FRAME_DIR = "./assets/realistic_chick_frames";
const REALISTIC_CHICK_SRC = "./assets/realistic_chick.png";
const REALISTIC_DONUT_SRC = "./assets/realistic_donut.png";
const REALISTIC_PLATFORM_SRC = "./assets/realistic_platform.png";
const allMoveSpriteNames = Array.from({ length: 10 }, (_, index) => `move_${index}`);
const moveSpriteNames = ["move_5", "move_7", "move_9", "move_7"];
const realisticWalkSpriteNames = Array.from({ length: 12 }, (_, index) => `walk_${index}`);
const realisticMoveSpriteNames = realisticWalkSpriteNames;
const playerSpriteNames = [
  "idle_a",
  "idle_b",
  "jump_up",
  "fall",
  "land",
  "hop",
  "high_jump",
  "finish",
  ...allMoveSpriteNames,
];
const playerSprites = Object.fromEntries(
  playerSpriteNames.map((name) => {
    const image = new Image();
    image.src = `${PLAYER_ASSET_DIR}/${name}.png`;
    return [name, image];
  }),
);
const realisticChickSprites = Object.fromEntries(
  [...playerSpriteNames, ...realisticWalkSpriteNames].map((name) => {
    const image = new Image();
    image.src = `${REALISTIC_CHICK_FRAME_DIR}/${name}.png`;
    return [name, image];
  }),
);

const keys = new Set();
const buttons = new Set();
const particles = [];
const realisticBg = new Image();
realisticBg.src = REALISTIC_BG_SRC;
const realisticChick = new Image();
realisticChick.src = REALISTIC_CHICK_SRC;
const realisticDonut = new Image();
realisticDonut.src = REALISTIC_DONUT_SRC;
const realisticPlatform = new Image();
realisticPlatform.src = REALISTIC_PLATFORM_SRC;

const platforms = [
  { x: 0, y: 355, w: 170, h: 55 },
  { x: 260, y: 405, w: 140, h: 52 },
  { x: 415, y: 305, w: 90, h: 62 },
  { x: 520, y: 205, w: 122, h: 58 },
  { x: 675, y: 355, w: 170, h: 55 },
  { x: 890, y: 278, w: 152, h: 56 },
  { x: 1110, y: 386, w: 158, h: 54 },
  { x: 1330, y: 302, w: 170, h: 56 },
];

const rings = [
  { x: 330, y: 350, r: 18, taken: false },
  { x: 475, y: 267, r: 18, taken: false },
  { x: 551, y: 167, r: 18, taken: false },
  { x: 612, y: 167, r: 18, taken: false },
  { x: 745, y: 318, r: 18, taken: false },
  { x: 940, y: 238, r: 18, taken: false },
  { x: 986, y: 238, r: 18, taken: false },
  { x: 1390, y: 263, r: 18, taken: false },
];

const spawn = { x: 70, y: 294 };
const player = {
  x: spawn.x,
  y: spawn.y,
  w: 46,
  h: 58,
  vx: 0,
  vy: 0,
  face: 1,
  grounded: false,
  coyote: 0,
  jumpBuffer: 0,
  squash: 0,
  moveAnim: 0,
};

let cameraX = 0;
let won = false;
let startTime = performance.now();
let lastTime = performance.now();
let artMode = "original";
const initialArtMode = new URLSearchParams(window.location.search).get("art") === "realistic" ? "realistic" : "original";

function setArtMode(nextMode) {
  artMode = nextMode;
  stageEl.dataset.art = artMode;
  artSwitch.setAttribute("aria-pressed", String(artMode === "realistic"));
  artSwitchText.textContent = artMode === "realistic" ? "실사" : "원본";
}

function resetGame() {
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.face = 1;
  player.grounded = false;
  player.coyote = 0;
  player.jumpBuffer = 0;
  player.squash = 0;
  player.moveAnim = 0;
  cameraX = 0;
  won = false;
  startTime = performance.now();
  particles.length = 0;
  for (const ring of rings) ring.taken = false;
}

function isDown(name) {
  return keys.has(name) || buttons.has(name);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function addBurst(x, y, color, amount = 10) {
  for (let i = 0; i < amount; i += 1) {
    const angle = (Math.PI * 2 * i) / amount + Math.random() * 0.45;
    const speed = 55 + Math.random() * 115;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.28,
      maxLife: 0.75,
      size: 3 + Math.random() * 3,
      color,
    });
  }
}

function update(dt) {
  const left = isDown("left");
  const right = isDown("right");
  const jump = isDown("jump");
  const wasGrounded = player.grounded;

  player.jumpBuffer = jump ? 0.12 : Math.max(0, player.jumpBuffer - dt);
  player.coyote = wasGrounded ? 0.1 : Math.max(0, player.coyote - dt);
  player.grounded = false;

  if (left === right) {
    const sign = Math.sign(player.vx);
    const next = Math.abs(player.vx) - FRICTION * dt;
    player.vx = next > 0 ? sign * next : 0;
  } else {
    const nextFace = right ? 1 : -1;
    player.vx += (right ? 1 : -1) * MOVE_ACCEL * dt;
    if (player.face !== nextFace) {
      player.moveAnim = 0;
    }
    player.face = nextFace;
  }

  player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx));

  if (player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = JUMP_VELOCITY;
    player.jumpBuffer = 0;
    player.coyote = 0;
    player.squash = 1;
    addBurst(player.x + player.w * 0.5, player.y + player.h, "#d8ec86", 7);
  }

  player.vy += GRAVITY * dt;

  player.x += player.vx * dt;
  player.x = Math.max(-20, Math.min(WORLD_W - player.w + 20, player.x));
  for (const platform of platforms) {
    if (rectsOverlap(player, platform)) {
      if (player.vx > 0) player.x = platform.x - player.w;
      if (player.vx < 0) player.x = platform.x + platform.w;
      player.vx = 0;
    }
  }

  player.y += player.vy * dt;
  for (const platform of platforms) {
    if (!rectsOverlap(player, platform)) continue;
    const previousBottom = player.y + player.h - player.vy * dt;
    const previousTop = player.y - player.vy * dt;
    if (player.vy >= 0 && previousBottom <= platform.y + 5) {
      const impactVy = player.vy;
      player.y = platform.y - player.h;
      player.vy = 0;
      player.grounded = true;
      if (!wasGrounded || impactVy > 160) {
        player.squash = Math.max(player.squash, 0.55);
      }
    } else if (player.vy < 0 && previousTop >= platform.y + platform.h - 5) {
      player.y = platform.y + platform.h;
      player.vy = 40;
    }
  }

  if (player.grounded && Math.abs(player.vx) > 24) {
    player.moveAnim += dt * (7.5 + Math.abs(player.vx) / 46);
  } else {
    player.moveAnim *= Math.max(0, 1 - dt * 8);
  }

  if (player.y > VIEW_H + 120) {
    addBurst(player.x + player.w / 2, VIEW_H - 30, "#f8d75f", 12);
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.moveAnim = 0;
    cameraX = 0;
  }

  for (const ring of rings) {
    if (ring.taken) continue;
    const dx = player.x + player.w * 0.5 - ring.x;
    const dy = player.y + player.h * 0.45 - ring.y;
    if (dx * dx + dy * dy < 1450) {
      ring.taken = true;
      addBurst(ring.x, ring.y, "#ff9fbc", 14);
    }
  }

  const collected = rings.filter((ring) => ring.taken).length;
  if (collected === rings.length && player.x > WORLD_W - 190) {
    won = true;
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 460 * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  player.squash = Math.max(0, player.squash - dt * 4.6);
  const targetCamera = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x - VIEW_W * 0.43));
  cameraX += (targetCamera - cameraX) * Math.min(1, dt * 7);

  scoreEl.textContent = `${collected} / ${rings.length}`;
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCoverImage(image, x, y, w, h, offsetX = 0) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = w / h;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;
  let sx = 0;
  let sy = 0;

  if (imageRatio > targetRatio) {
    sw = image.naturalHeight * targetRatio;
    sx = (image.naturalWidth - sw) * 0.5 + offsetX;
    sx = Math.max(0, Math.min(image.naturalWidth - sw, sx));
  } else {
    sh = image.naturalWidth / targetRatio;
    sy = (image.naturalHeight - sh) * 0.5;
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawRealisticPlatform(platform) {
  const x = Math.round(platform.x);
  const y = Math.round(platform.y);

  if (realisticPlatform.complete && realisticPlatform.naturalWidth > 0) {
    const drawW = platform.w + 26;
    const drawH = Math.max(72, platform.h + 40);
    const drawX = x - 13;
    const drawY = y - 10;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 7;
    ctx.drawImage(realisticPlatform, drawX, drawY, drawW, drawH);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 9;
  const dirt = ctx.createLinearGradient(0, y + 14, 0, y + platform.h + 8);
  dirt.addColorStop(0, "#9a7454");
  dirt.addColorStop(0.55, "#6f563f");
  dirt.addColorStop(1, "#3c3127");
  ctx.fillStyle = dirt;
  ctx.strokeStyle = "rgba(28, 22, 16, 0.82)";
  ctx.lineWidth = 2;
  roundRect(x + 4, y + 18, platform.w - 8, platform.h - 10, 9);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const moss = ctx.createLinearGradient(0, y - 2, 0, y + 36);
  moss.addColorStop(0, "#e1f29d");
  moss.addColorStop(0.35, "#89b552");
  moss.addColorStop(1, "#355d37");
  ctx.fillStyle = moss;
  ctx.strokeStyle = "rgba(28, 38, 22, 0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 11);
  ctx.bezierCurveTo(x + 18, y - 2, x + 33, y + 1, x + 47, y + 8);
  for (let px = x + 54; px < x + platform.w - 18; px += 33) {
    ctx.bezierCurveTo(px + 9, y + 31, px + 24, y + 29, px + 31, y + 12);
    ctx.bezierCurveTo(px + 39, y + 2, px + 48, y + 4, px + 54, y + 9);
  }
  ctx.lineTo(x + platform.w - 5, y + 12);
  ctx.lineTo(x + platform.w - 8, y + 35);
  ctx.lineTo(x + 9, y + 35);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(235, 255, 191, 0.34)";
  for (let i = 0; i < Math.floor(platform.w / 24); i += 1) {
    const sx = x + 12 + i * 22 + ((platform.x + i * 17) % 9);
    ctx.beginPath();
    ctx.ellipse(sx, y + 10 + (i % 3) * 4, 4 + (i % 2), 1.6, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlatform(platform) {
  if (artMode === "realistic") {
    drawRealisticPlatform(platform);
    return;
  }

  const x = Math.round(platform.x);
  const y = Math.round(platform.y);

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#171717";
  ctx.fillStyle = "#c39a77";
  roundRect(x + 3, y + 17, platform.w - 6, platform.h - 14, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#b8d563";
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 10);
  ctx.quadraticCurveTo(x + 12, y, x + 25, y + 4);
  for (let px = x + 30; px < x + platform.w - 15; px += 28) {
    ctx.quadraticCurveTo(px + 8, y + 25, px + 21, y + 13);
    ctx.quadraticCurveTo(px + 27, y + 5, px + 36, y + 8);
  }
  ctx.lineTo(x + platform.w - 5, y + 10);
  ctx.lineTo(x + platform.w - 9, y + 35);
  ctx.lineTo(x + 8, y + 35);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  for (let i = 0; i < Math.floor(platform.w / 42); i += 1) {
    const sx = x + 20 + i * 39 + ((platform.x + i * 11) % 9);
    ctx.beginPath();
    ctx.moveTo(sx, y + 12 + (i % 2) * 4);
    ctx.lineTo(sx + 7, y + 10 + (i % 3) * 3);
    ctx.stroke();
  }
}

function drawRealisticRing(ring, time) {
  if (ring.taken) return;
  const bob = Math.sin(time * 4 + ring.x * 0.03) * 4;
  const spin = Math.abs(Math.sin(time * 3.2 + ring.x));
  const width = 18 + spin * 10;
  const height = 20;

  if (realisticDonut.complete && realisticDonut.naturalWidth > 0) {
    const size = 54 + spin * 5;
    ctx.save();
    ctx.translate(ring.x, ring.y + bob);
    ctx.rotate(Math.sin(time * 2.8 + ring.x) * 0.04);
    ctx.shadowColor = "rgba(0, 0, 0, 0.26)";
    ctx.shadowBlur = 9;
    ctx.shadowOffsetY = 5;
    ctx.drawImage(realisticDonut, -size * 0.5, -size * 0.5, size, size);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(ring.x, ring.y + bob);
  ctx.shadowColor = "rgba(0, 0, 0, 0.26)";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 5;
  const dough = ctx.createRadialGradient(-width * 0.35, -height * 0.45, 2, 0, 0, width * 1.15);
  dough.addColorStop(0, "#ffe0a6");
  dough.addColorStop(0.48, "#c47b35");
  dough.addColorStop(1, "#7a421e");
  ctx.fillStyle = dough;
  ctx.strokeStyle = "rgba(80, 43, 22, 0.9)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const icing = ctx.createRadialGradient(-width * 0.25, -height * 0.42, 2, 0, -1, width);
  icing.addColorStop(0, "#ffe1ea");
  icing.addColorStop(0.5, "#ef83ac");
  icing.addColorStop(1, "#bb4072");
  ctx.fillStyle = icing;
  ctx.beginPath();
  ctx.ellipse(-1, -4, width * 0.82, height * 0.58, -0.05, Math.PI * 0.04, Math.PI * 1.94);
  ctx.bezierCurveTo(width * 0.48, height * 0.42, width * 0.17, height * 0.32, width * 0.05, height * 0.14);
  ctx.bezierCurveTo(-width * 0.16, height * 0.38, -width * 0.44, height * 0.33, -width * 0.49, height * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  const sprinkleColors = ["#fff5b8", "#7ed6ff", "#8ef38f", "#ff6a88", "#8b5cf6"];
  for (let i = 0; i < 7; i += 1) {
    const sx = -width * 0.52 + i * (width * 0.17);
    const sy = -height * 0.42 + ((i * 7 + ring.x) % 16) * 0.65;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(((i * 29 + ring.y) % 70) * 0.02);
    ctx.strokeStyle = sprinkleColors[i % sprinkleColors.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2.5, 0);
    ctx.lineTo(2.5, 0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(244, 248, 236, 0.64)";
  ctx.beginPath();
  ctx.ellipse(-width * 0.28, -height * 0.38, width * 0.24, height * 0.12, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(73, 45, 30, 0.92)";
  ctx.beginPath();
  ctx.ellipse(0, 1, width * 0.42, height * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRing(ring, time) {
  if (artMode === "realistic") {
    drawRealisticRing(ring, time);
    return;
  }

  if (ring.taken) return;
  const bob = Math.sin(time * 4 + ring.x * 0.03) * 4;
  const spin = Math.abs(Math.sin(time * 3.2 + ring.x));
  const width = 16 + spin * 12;
  const height = 21;

  ctx.save();
  ctx.translate(ring.x, ring.y + bob);
  ctx.lineWidth = 3;
  ctx.fillStyle = "#ffa3c0";
  ctx.strokeStyle = "#111";
  ctx.beginPath();
  ctx.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#404240";
  ctx.beginPath();
  ctx.ellipse(0, 1, width * 0.42, height * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRealisticPlayer(time) {
  let spriteName = "idle_a";
  if (!player.grounded) {
    if (player.vy < -340) spriteName = Math.sin(time * 12) > 0 ? "jump_up" : "high_jump";
    else if (player.vy < 80) spriteName = "hop";
    else spriteName = "fall";
  } else if (player.squash > 0.18) {
    spriteName = "land";
  } else if (Math.abs(player.vx) > 35) {
    spriteName = realisticMoveSpriteNames[Math.floor(player.moveAnim) % realisticMoveSpriteNames.length];
  } else if (won) {
    spriteName = "finish";
  }

  const speed = Math.min(1, Math.abs(player.vx) / MAX_SPEED);
  const centerX = player.x + player.w * 0.5;
  const footY = player.y + player.h + 4;
  const bounce = player.grounded ? Math.sin(time * 14) * speed * 1.8 : 0;
  const sprite = realisticChickSprites[spriteName];

  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    const drawW = 96;
    const drawH = 110;
    const drawY = player.y + player.h - drawH + 7 + bounce;

    ctx.save();
    ctx.translate(centerX, drawY + drawH * 0.52);
    ctx.rotate(player.face * speed * 0.04);
    if (player.face < 0) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(sprite, -drawW * 0.5, -drawH * 0.52, drawW, drawH);
    ctx.restore();
    return;
  }

  if (realisticChick.complete && realisticChick.naturalWidth > 0) {
    const drawW = 76 + speed * 2 + player.squash * 2;
    const drawH = 92 + (player.grounded ? 0 : 6) - player.squash * 5;
    const drawX = centerX - drawW * 0.5;
    const drawY = player.y + player.h - drawH + 5 + bounce;

    ctx.save();
    ctx.translate(centerX, drawY + drawH * 0.52);
    ctx.rotate(player.face * speed * 0.05);
    if (player.face < 0) {
      ctx.scale(-1, 1);
      ctx.drawImage(realisticChick, -drawW * 0.5, -drawH * 0.52, drawW, drawH);
    } else {
      ctx.drawImage(realisticChick, -drawW * 0.5, -drawH * 0.52, drawW, drawH);
    }
    ctx.restore();
    return;
  }

  const bodyW = 52 + speed * 2 + player.squash * 5;
  const bodyH = 53 + (player.grounded ? 0 : 5) - player.squash * 5;
  const lean = player.face * speed * 0.08;

  ctx.save();
  ctx.translate(centerX, footY - bodyH * 0.52 + bounce);
  ctx.rotate(lean);
  ctx.scale(1 + player.squash * 0.06, 1 - player.squash * 0.1);
  const feather = ctx.createRadialGradient(-bodyW * 0.2, -bodyH * 0.28, 5, 0, 0, bodyW * 0.72);
  feather.addColorStop(0, "#fff7c7");
  feather.addColorStop(0.45, "#f5d45b");
  feather.addColorStop(0.82, "#dfa338");
  feather.addColorStop(1, "#9b6a25");

  ctx.fillStyle = "rgba(242, 205, 79, 0.62)";
  for (let i = 0; i < 14; i += 1) {
    const angle = -Math.PI * 0.9 + (Math.PI * 1.8 * i) / 13;
    const fx = Math.cos(angle) * bodyW * 0.49;
    const fy = Math.sin(angle) * bodyH * 0.48;
    const size = 5 + (i % 3);
    ctx.beginPath();
    ctx.ellipse(fx, fy, size, size * 0.72, angle * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = feather;
  ctx.strokeStyle = "rgba(78, 52, 22, 0.82)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyW * 0.52, bodyH * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(126, 83, 26, 0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i += 1) {
    const px = -bodyW * 0.36 + i * (bodyW * 0.08);
    ctx.beginPath();
    ctx.moveTo(px, -bodyH * 0.26 + (i % 2) * 2);
    ctx.quadraticCurveTo(px + player.face * 3, -bodyH * 0.05, px + 1, bodyH * 0.18);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(232, 176, 54, 0.68)";
  ctx.beginPath();
  ctx.ellipse(-player.face * bodyW * 0.28, 4, bodyW * 0.14, bodyH * 0.24, -player.face * 0.48, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1b1511";
  ctx.beginPath();
  ctx.arc(-6 + player.face * 7, -bodyH * 0.18, 3.1, 0, Math.PI * 2);
  ctx.arc(5 + player.face * 7, -bodyH * 0.19, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#cf7924";
  ctx.strokeStyle = "rgba(48, 28, 14, 0.72)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(player.face * 8, -bodyH * 0.08);
  ctx.lineTo(player.face * 20, -bodyH * 0.04);
  ctx.lineTo(player.face * 8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(62, 39, 17, 0.84)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-5, -bodyH * 0.5);
  ctx.quadraticCurveTo(-8, -bodyH * 0.65, -1, -bodyH * 0.58);
  ctx.moveTo(2, -bodyH * 0.5);
  ctx.quadraticCurveTo(7, -bodyH * 0.64, 8, -bodyH * 0.52);
  ctx.stroke();

  ctx.strokeStyle = "rgba(84, 48, 22, 0.86)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-9, bodyH * 0.45);
  ctx.lineTo(-11 - speed * 3, bodyH * 0.57);
  ctx.moveTo(9, bodyH * 0.45);
  ctx.lineTo(11 + speed * 3, bodyH * 0.57);
  ctx.stroke();
  ctx.restore();

}

function drawPlayer(time) {
  if (artMode === "realistic") {
    drawRealisticPlayer(time);
    return;
  }

  let spriteName = "idle_a";
  if (!player.grounded) {
    if (player.vy < -340) spriteName = Math.sin(time * 12) > 0 ? "jump_up" : "high_jump";
    else if (player.vy < 80) spriteName = "hop";
    else spriteName = "fall";
  } else if (player.squash > 0.18) {
    spriteName = "land";
  } else if (Math.abs(player.vx) > 35) {
    spriteName = moveSpriteNames[Math.floor(player.moveAnim) % moveSpriteNames.length];
  } else if (won) {
    spriteName = "finish";
  }

  const sprite = playerSprites[spriteName];
  const drawX = Math.round(player.x + player.w * 0.5 - PLAYER_SPRITE_W * 0.5);
  const drawY = Math.round(player.y + player.h - PLAYER_SPRITE_H + 6);

  if (sprite.complete && sprite.naturalWidth > 0) {
    ctx.save();
    if (player.face < 0) {
      ctx.translate(drawX + PLAYER_SPRITE_W, drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0, PLAYER_SPRITE_W, PLAYER_SPRITE_H);
    } else {
      ctx.drawImage(sprite, drawX, drawY, PLAYER_SPRITE_W, PLAYER_SPRITE_H);
    }
    ctx.restore();
    return;
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#111";
  ctx.fillStyle = "#f9d866";
  ctx.beginPath();
  ctx.ellipse(player.x + player.w / 2, player.y + player.h / 2, player.w * 0.46, player.h * 0.49, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawBackground(time) {
  if (artMode === "realistic") {
    if (realisticBg.complete && realisticBg.naturalWidth > 0) {
      drawCoverImage(realisticBg, 0, 0, VIEW_W, VIEW_H, cameraX * 0.09);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      sky.addColorStop(0, "#dfe9ee");
      sky.addColorStop(1, "#4f6f55");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const vignette = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.46, VIEW_W * 0.12, VIEW_W * 0.5, VIEW_H * 0.46, VIEW_W * 0.75);
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(1, "rgba(12,24,18,0.26)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(0, VIEW_H - 34, VIEW_W, 34);
    return;
  }

  ctx.fillStyle = "#404240";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = -((cameraX * 0.16) % 86); x < VIEW_W; x += 86) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 140, VIEW_H);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, VIEW_H - 34, VIEW_W, 34);

  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "700 13px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.fillText("PHASE 3", VIEW_W / 2, 18 + Math.sin(time * 2) * 0.6);
}

function drawOverlay() {
  if (!won) return;
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff3d7";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 5;
  ctx.font = "800 52px ui-sans-serif, system-ui";
  ctx.strokeText("CLEAR", VIEW_W / 2, VIEW_H / 2 - 8);
  ctx.fillText("CLEAR", VIEW_W / 2, VIEW_H / 2 - 8);
}

function draw(time) {
  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawBackground(time);
  ctx.translate(-cameraX, 0);

  for (const platform of platforms) drawPlatform(platform);
  for (const ring of rings) drawRing(ring, time);
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawPlayer(time);
  ctx.restore();
  drawOverlay();
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  if (!won) update(dt);
  draw(now / 1000);
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "KeyA"].includes(event.code)) keys.add("left");
  if (["ArrowRight", "KeyD"].includes(event.code)) keys.add("right");
  if (["ArrowUp", "KeyW", "Space"].includes(event.code)) keys.add("jump");
  if (event.code === "KeyR") resetGame();
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  if (["ArrowLeft", "KeyA"].includes(event.code)) keys.delete("left");
  if (["ArrowRight", "KeyD"].includes(event.code)) keys.delete("right");
  if (["ArrowUp", "KeyW", "Space"].includes(event.code)) keys.delete("jump");
});

for (const button of document.querySelectorAll("[data-input]")) {
  const input = button.dataset.input;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    buttons.add(input);
  });
  button.addEventListener("pointerup", () => buttons.delete(input));
  button.addEventListener("pointercancel", () => buttons.delete(input));
  button.addEventListener("lostpointercapture", () => buttons.delete(input));
}

canvas.addEventListener("pointerdown", () => {
  if (won) resetGame();
});

artSwitch.addEventListener("click", () => {
  setArtMode(artMode === "realistic" ? "original" : "realistic");
});

setArtMode(initialArtMode);
resetGame();
requestAnimationFrame(frame);
