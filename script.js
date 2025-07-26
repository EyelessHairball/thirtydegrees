const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// === Constants ===
const gravity = 0.3;
const maxForce = 20;
const dragScale = 0.1;
const floorY = 600;
const turnTimeLimit = 15;
let turnTimeLeft = turnTimeLimit;
let lastTime = Date.now();

// Generate random colors
function getRandomColor() {
  const hue = Math.random() * 360;
  return `hsl(${hue}, 80%, 60%)`;
}


function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

canvas.addEventListener('dragstart', e => e.preventDefault());
canvas.addEventListener('mousedown', e => e.preventDefault());


const sfx = {
  launch: new Audio("assets/sfx/launch.wav"),
  collision: new Audio("assets/sfx/collide.wav"),
  land: new Audio("assets/sfx/land.wav"),
  damage: new Audio("assets/sfx/damage.wav"),
  gameover: new Audio("assets/sfx/gameover.wav"),
  click: new Audio("assets/sfx/click.wav"),
  start: new Audio("assets/sfx/startup.wav")
};

function playSfx(name) {
  if (sfx[name]) {
    if (sfx[name].paused || sfx[name].currentTime >= sfx[name].duration - 0.1) {
      sfx[name].currentTime = 0;
      sfx[name].play();
    }
  }
}

// === Players ===
const players = [
  {
    x: 200, y: 580,
    vx: 0, vy: 0,
    radius: 20,
    color: "blue",
    aiming: false,
    launched: false,
    arcSet: false,
    health: 100,
    maxHealth: 100
  },
  {
    x: 600, y: 580,
    vx: 0, vy: 0,
    radius: 20,
    color: "red",
    aiming: false,
    launched: false,
    arcSet: false,
    health: 100,
    maxHealth: 100
  }
];

let currentPlayerIndex = 0;
let state = "getReady"; 
let gameOver = false;
let winner = null;
let getReadyTimer = 0;
let getReadyDuration = 1;

let aimStart = { x: 0, y: 0 };
let aimEnd = { x: 0, y: 0 };
let isDragging = false;

let cameraX = 0;
let cameraY = 0;

canvas.addEventListener("mousedown", (e) => {
  if (gameOver) {
    // Check if restart button was clicked
    const buttonX = canvas.width / 2 - 100;
    const buttonY = canvas.height / 2 + 60;
    const buttonWidth = 200;
    const buttonHeight = 50;
    
    if (e.clientX >= buttonX && e.clientX <= buttonX + buttonWidth &&
        e.clientY >= buttonY && e.clientY <= buttonY + buttonHeight) {
      playSfx("click");
      restartGame();
      return;
    }
  }
  
  if (state !== "aiming") return;
  
  const p = players[currentPlayerIndex];
  const mx = e.clientX;
  const my = e.clientY;

  const screenX = mx + cameraX;
  const screenY = my + cameraY;

  if (!p.aiming && dist(screenX, screenY, p.x, p.y) < p.radius) {
    p.aiming = true;
    aimStart = { x: p.x, y: p.y };
    aimEnd = { x: screenX, y: screenY };
    isDragging = true;
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (isDragging) {
    aimEnd = {
      x: e.clientX + cameraX,
      y: e.clientY + cameraY
    };
  }
});

canvas.addEventListener("mouseup", () => {
  if (gameOver) return;

  const p = players[currentPlayerIndex];
  if (p.aiming && isDragging) {
    let dx = aimEnd.x - aimStart.x;
    let dy = aimEnd.y - aimStart.y;
    let force = Math.hypot(dx, dy) * dragScale;
    
    if (state === "aiming") {
      // Normal ground launch
      if (force > maxForce) {
        const angle = Math.atan2(dy, dx);
        dx = Math.cos(angle) * maxForce / dragScale;
        dy = Math.sin(angle) * maxForce / dragScale;
        aimEnd.x = aimStart.x + dx;
        aimEnd.y = aimStart.y + dy;
      }

      p.vx = dx * dragScale;
      p.vy = dy * dragScale;
      p.arcSet = true;
      p.aiming = false;
      isDragging = false;

      if (currentPlayerIndex === 0) {
        currentPlayerIndex = 1;
        turnTimeLeft = turnTimeLimit;
      } else {
        state = "executing";
        players.forEach(p => {
          p.launched = true;
          p.frozen = false;
        });
      }
      playSfx("launch");
    } else if (state === "executing" && p.launched && !p.airJumpUsed && p.y < floorY - p.radius) {
      const airJumpForce = Math.min(force, maxForce * 0.6); 
      if (airJumpForce > maxForce * 0.6) {
        const angle = Math.atan2(dy, dx);
        dx = Math.cos(angle) * maxForce * 0.6 / dragScale;
        dy = Math.sin(angle) * maxForce * 0.6 / dragScale;
      }

      p.vx = dx * dragScale;
      p.vy = dy * dragScale;
      p.airJumpUsed = true;
      p.aiming = false;
      isDragging = false;
      playSfx("launch");
    } else if (state === "executing" && p.launched && p.airJumpUsed) {
      const adjustmentForce = Math.min(force * 0.1, 2); 
      p.vx += (dx * dragScale) * 0.1;
      p.vy += (dy * dragScale) * 0.1;
      p.aiming = false;
      isDragging = false;
    }
  }
});

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function checkCollision(p1, p2) {
  const distance = dist(p1.x, p1.y, p2.x, p2.y);
  return distance < (p1.radius + p2.radius);
}

let sparks = [];

function spawnSparks(x, y, count = 1) {
  for (let i = 0; i < count; i++) { 
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 2;
    sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 20 + Math.random() * 10,
      color: `hsl(${Math.random() * 60 + 30}, 100%, 60%)`
    });
  }
}

function updateSparks() {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.vx *= 0.96;
    s.vy *= 0.96;
    s.x += s.vx; 
    s.y += s.vy;
    s.vy += 0.12;
    s.life--;

    s.x += (Math.random() - 0.5) * 0.5; 
    s.y += (Math.random() - 0.5) * 0.5;

    s.size = Math.max(2, (1 - s.life / 300) * 1);

    if (s.life <= 0) sparks.splice(i, 1);
  }
}

function drawSparks() {
  sparks.forEach(s => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, s.life / 30);
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x - cameraX, s.y - cameraY, s.size || 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function handleCollision(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.hypot(dx, dy);
  
  // Normalize collision vector
  const nx = dx / distance;
  const ny = dy / distance;
  
  // Separate overlapping players
  const overlap = (p1.radius + p2.radius) - distance;
  const separateX = nx * overlap * 0.5;
  const separateY = ny * overlap * 0.5;
  
  p1.x -= separateX;
  p1.y -= separateY;
  p2.x += separateX;
  p2.y += separateY;
  
  // Calculate relative velocity
  const rvx = p2.vx - p1.vx;
  const rvy = p2.vy - p1.vy;
  
  // Calculate relative velocity in collision normal direction
  const speed = rvx * nx + rvy * ny;
  
  // Calculate damage based on impact speed (reduced damage)
  const impactForce = Math.abs(speed);
  const baseDamage = Math.max(2, impactForce * 1);
  
  // Determine who takes damage based on who was moving faster
  const p1Speed = Math.hypot(p1.vx, p1.vy);
  const p2Speed = Math.hypot(p2.vx, p2.vy);
  
  if (p1Speed > p2Speed * 1.5) {
    // P1 was moving much faster, P2 takes more damage
    p2.health -= baseDamage;
    p1.health -= baseDamage * 0.2;
  } else if (p2Speed > p1Speed * 1.5) {
    // P2 was moving much faster, P1 takes more damage
    p1.health -= baseDamage;
    p2.health -= baseDamage * 0.2;
  } else {
    // Similar speeds, both take damage
    p1.health -= baseDamage * 0.5;
    p2.health -= baseDamage * 0.5;
  }
  
  // Clamp health to 0-max
  p1.health = Math.max(0, Math.min(p1.maxHealth, p1.health));
  p2.health = Math.max(0, Math.min(p2.maxHealth, p2.health));
  
  // Check for game over
  if (p1.health <= 0) {
    gameOver = true;
    winner = players.indexOf(p2) + 1;
  } else if (p2.health <= 0) {
    gameOver = true;
    winner = players.indexOf(p1) + 1;
  }
  
  // Don't resolve collision if objects are separating
  if (speed > 0) return;
  
  // Collision resolution with bounce
  const restitution = 0.8; // Bounciness
  const impulse = -(1 + restitution) * speed / 2; // Assuming equal mass
  
  // Apply impulse to velocities
  p1.vx -= impulse * nx;
  p1.vy -= impulse * ny;
  p2.vx += impulse * nx;
  p2.vy += impulse * ny;
  playSfx("collision");
  if (baseDamage > 2) playSfx("damage");
  if (gameOver) playSfx("gameover");

  // Spawn sparks at collision point
  const collisionX = (p1.x + p2.x) / 2;
  const collisionY = (p1.y + p2.y) / 2;
  spawnSparks(collisionX, collisionY, Math.floor(baseDamage * 2));
}

function updatePlayer(p) {
  if (p.launched && !p.frozen) {
    p.vy += gravity;
    p.x += p.vx;
    p.y += p.vy;

    if (p.y + p.radius > floorY) {
      p.y = floorY - p.radius;
      p.vy = 0;
      p.vx = 0;
      p.launched = false;
      p.airJumpUsed = false;
      playSfx("land");
    }
  }
}

function drawPlayer(p) {
  let color = p.color;
  
  // Color changing effect
  if (state === "colorChanging") {
    const hue = (colorChangeTimer * 360) % 360;
    color = `hsl(${hue}, 100%, 50%)`;
  }
  
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x - cameraX, p.y - cameraY, p.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawArc(p) {
  if (p.aiming && isDragging) {
    const dx = aimEnd.x - aimStart.x;
    const dy = aimEnd.y - aimStart.y;
    let vx = dx * dragScale;
    let vy = dy * dragScale;

    const force = Math.hypot(vx, vy);
    if (force > maxForce) {
      const angle = Math.atan2(dy, dx);
      vx = Math.cos(angle) * maxForce;
      vy = Math.sin(angle) * maxForce;
    }

    const arcPoints = simulateTrajectory(p.x, p.y, vx, vy);

    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    
    ctx.beginPath();
    arcPoints.forEach((pt, i) => {
      const sx = pt.x - cameraX;
      const sy = pt.y - cameraY;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();
    
    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x - cameraX, p.y - cameraY);
    ctx.lineTo(aimEnd.x - cameraX, aimEnd.y - cameraY);
    ctx.stroke();
  }
}

function simulateTrajectory(x, y, vx, vy, steps = 60) {
  const points = [];
  for (let i = 0; i < steps; i++) {
    vy += gravity;
    x += vx;
    y += vy;
    points.push({ x, y });
    if (y > floorY) break;
  }
  return points;
}

let paused = false;

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "p") {
    paused = !paused;
    if (paused) {
      musicAudio.pause();
    } else {
      musicAudio.play();
      lastTime = Date.now(); 
    }
  }
});

function updateTimer() {
  if (gameOver || paused) return;
  
  const now = Date.now();
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  if (state === "getReady") {
    getReadyTimer += delta;
    if (getReadyTimer >= getReadyDuration) {
      state = "aiming";
      getReadyTimer = 0;
    }
    return;
  }

  if (state === "aiming") {
    turnTimeLeft -= delta;
    if (turnTimeLeft <= 0) {
      const p = players[currentPlayerIndex];
      p.arcSet = true;
      p.aiming = false;
      p.vx = 0;
      p.vy = 0;

      if (currentPlayerIndex === 0) {
        currentPlayerIndex = 1;
        turnTimeLeft = turnTimeLimit;
      } else {
        state = "executing";
        players.forEach(p => {
          p.launched = true;
          p.frozen = false;
        });
      }
    } else if (turnTimeLeft <= 2 && turnTimeLeft + delta > 2) {
        //meoroeooow :3
    }
  }

  if (state === "executing") {
    // Reset timer to 2 seconds when entering executing state
    if (turnTimeLeft > 2) turnTimeLeft = 2;
    turnTimeLeft -= delta;
    if (turnTimeLeft <= 0) {
      // Freeze current player's movement
      const currentPlayer = players[currentPlayerIndex];
      currentPlayer.frozen = true;
      
      // Switch to next player or end turn
      if (currentPlayerIndex === 0) {
        currentPlayerIndex = 1;
        turnTimeLeft = turnTimeLimit;
      } else {
        // Both players have used their turns, wait for landing or continue
        if (players.every(p => !p.launched || p.frozen)) {
          state = "getReady";
          playSfx("start");
          players.forEach(p => {
            p.arcSet = false;
            p.frozen = false;
            p.airJumpUsed = false;
          });
          currentPlayerIndex = 0;
          turnTimeLeft = turnTimeLimit;
          getReadyTimer = 0;
        }
      }
    }
  }
}

function restartGame() {
  // Reset players with new random colors
  players[0] = {
    x: 200, y: 580,
    vx: 0, vy: 0,
    radius: 20,
    color: getRandomColor(),
    aiming: false,
    launched: false,
    arcSet: false,
    health: 100,
    maxHealth: 100,
    airJumpUsed: false,
    frozen: false
  };
  
  players[1] = {
    x: 600, y: 580,
    vx: 0, vy: 0,
    radius: 20,
    color: getRandomColor(),
    aiming: false,
    launched: false,
    arcSet: false,
    health: 100,
    maxHealth: 100,
    airJumpUsed: false,
    frozen: false
  };
  
  // Reset game state
  currentPlayerIndex = 0;
  state = "getReady";
  gameOver = false;
  winner = null;
  getReadyTimer = 0;
  turnTimeLeft = turnTimeLimit;
  
  // Reset aiming
  isDragging = false;
  
  // Reset camera
  cameraX = 0;
  cameraY = 0;
}

function updateCamera() {
  const focus = players[0].launched || players[1].launched
    ? {
        x: (players[0].x + players[1].x) / 2,
        y: (players[0].y + players[1].y) / 2
      }
    : players[currentPlayerIndex];
  cameraX += (focus.x - canvas.width / 2 - cameraX) * 0.05;
  cameraY += (focus.y - canvas.height / 2 - cameraY) * 0.05;
}

function drawFloor() {
  ctx.fillStyle = "#444";
  ctx.fillRect(-10000 - cameraX, floorY - cameraY, 20000, 1000);
}

function drawText(text, x, y, font = "18px monospace") {
  ctx.fillStyle = "white";
  ctx.font = font;
  ctx.fillText(text, x, y);
}

function drawHealthBar(player, playerNum, x, y) {
  const barWidth = 200;
  const barHeight = 30;
  
  // Player label
  ctx.fillStyle = "white";
  ctx.font = "24px 'Jersey 15', monospace";
  ctx.fillText("PLAYR" + playerNum, x, y - 10);
  
  // Health bar background (red - represents missing health)
  ctx.fillStyle = "#DC143C";
  ctx.fillRect(x + 80, y - 25, barWidth, barHeight);
  
  // Health portion (yellow - represents current health)
  const healthPercent = player.health / player.maxHealth;
  const healthWidth = healthPercent * barWidth;
  ctx.fillStyle = "#FFD700";
  ctx.fillRect(x + 80, y - 25, healthWidth, barHeight);
  
  // State text
  let stateText;
  if (state === "aiming") {
    stateText = currentPlayerIndex === (playerNum - 1) ? "AIMING" : "WAITING";
  } else if (state === "executing") {
    stateText = "EXECUTING";
  } else if (state === "getReady") {
    stateText = "GET READY";
  } else {
    stateText = "UNKNOWN";
  }
  
  ctx.fillStyle = "white";
  ctx.font = "20px 'Jersey 15', monospace";
  ctx.fillText(stateText, x + 300, y - 5);
}

function draw() {
  if (paused) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "48px 'Jersey 15', monospace";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
    ctx.textAlign = "left";
    return; // Stop drawing/updating game
  }

  updateTimer();
  updateCamera();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawFloor();
  players.forEach(updatePlayer);

  // Update and draw sparks
  updateSparks();
  drawSparks();

  // Check for collisions during execution phase
  if (state === "executing" && !gameOver) {
    if (checkCollision(players[0], players[1])) {
      handleCollision(players[0], players[1]);
    }
  }
  
  players.forEach(drawPlayer);
  drawArc(players[currentPlayerIndex]);

  const uiWidth = 365; 
  const uiStartX = (canvas.width - uiWidth) / 2; 
  drawHealthBar(players[0], 1, uiStartX, 40);
  drawHealthBar(players[1], 2, uiStartX, 80);
  
  // Timer
  if (state !== "getReady") {
    ctx.fillStyle = "white";
    ctx.font = "24px 'Jersey 15', monospace";
    ctx.textAlign = "center";
    ctx.fillText(Math.max(0, turnTimeLeft).toFixed(1) + " SECONDS LEFT", canvas.width / 2, 130);
    ctx.textAlign = "left";
  } else {
    draw.playSFX = false;
    ctx.fillStyle = "white";
    ctx.font = "24px 'Jersey 15', monospace";
    ctx.textAlign = "center";
    ctx.fillText("GET READY!", canvas.width / 2, 130);
    ctx.textAlign = "left";
  }
  
  // Game over screen
  if (gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "white";
    ctx.font = "48px 'Jersey 15', monospace";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 50);
    ctx.fillText("PLAYR " + winner + " WINS!", canvas.width / 2, canvas.height / 2 + 20);
    
    // Restart button
    const buttonX = canvas.width / 2 - 100;
    const buttonY = canvas.height / 2 + 60;
    const buttonWidth = 200;
    const buttonHeight = 50;
    
    ctx.fillStyle = "#333";
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    ctx.fillStyle = "white";
    ctx.font = "24px 'Jersey 15', monospace";
    ctx.fillText("RESTART", canvas.width / 2, buttonY + 35);
    ctx.textAlign = "left";
  }

  if (state === "executing" && players.every(p => !p.launched || p.frozen) && !gameOver) {
    state = "getReady";
    playSfx("start");
    players.forEach(p => {
      p.arcSet = false;
      p.frozen = false;
      p.airJumpUsed = false;
    });
    currentPlayerIndex = 0;
    turnTimeLeft = turnTimeLimit;
    getReadyTimer = 0;
  }

  requestAnimationFrame(draw);
}

draw();