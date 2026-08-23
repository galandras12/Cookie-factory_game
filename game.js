// Game State Initialization
const gameState = {
  money: 0,
  totalCookies: 0,
  boxCookies: 0,

  // Ingredients current & max capacities
  ingredients: {
    flour: { current: 1000, max: 1000, refillCost: 100, upgradeCost: 200 },
    water: { current: 600, max: 600, refillCost: 10, upgradeCost: 200 },
    chocolate: { current: 400, max: 400, refillCost: 50, upgradeCost: 200 }
  },

  // Box & Truck parameters
  boxCapacity: 100,
  boxUpgradeCost: 500,

  truckCapacity: 100,
  truckUpgradeCost: 500,
  truckState: 'idle', // 'idle', 'arriving', 'loading', 'departing'
  truckProgress: 0, // 0 to 1 for animations
  cookiesToSell: 0,

  // Automation Level (0 to 7)
  autoLevel: 0,
  autoCosts: [1000, 2000, 3000, 4000, 5000, 6000, 7000],
  autoTimer: 0,

  // Flying Drones state
  drones: {
    flour: { active: false, progress: 0 },
    water: { active: false, progress: 0 },
    chocolate: { active: false, progress: 0 }
  }
};

// Web Audio API Synthesizer Sound System
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'produce') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'refill') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'truck') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.4);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'sell') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'upgrade') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.25);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {
    // Ignore audio errors if audio context blocked
  }
}

// Canvas and Visual Elements setup
let canvas, ctx;
let cookiesOnBelt = [];
let particles = [];
let beltOffset = 0;

window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('factoryCanvas');
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  loadGameSave();
  bindEvents();
  updateUI();
  requestAnimationFrame(gameLoop);

  // Auto save every 5 seconds
  setInterval(saveGameSave, 5000);
});

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

function bindEvents() {
  // Resume AudioContext on any user interaction
  window.addEventListener('click', initAudio, { once: true });
  window.addEventListener('touchstart', initAudio, { once: true });

  // Mobile/Bake Button
  const bakeBtnMobile = document.getElementById('bake-btn-mobile');
  if (bakeBtnMobile) {
    bakeBtnMobile.addEventListener('click', () => produceCookie());
  }

  // Refill Buttons
  document.getElementById('refill-flour-btn').addEventListener('click', () => refillIngredient('flour'));
  document.getElementById('refill-water-btn').addEventListener('click', () => refillIngredient('water'));
  document.getElementById('refill-chocolate-btn').addEventListener('click', () => refillIngredient('chocolate'));

  // Upgrade / Doubling Capacity Buttons
  document.getElementById('upgrade-flour-btn').addEventListener('click', () => upgradeIngredientCapacity('flour'));
  document.getElementById('upgrade-water-btn').addEventListener('click', () => upgradeIngredientCapacity('water'));
  document.getElementById('upgrade-chocolate-btn').addEventListener('click', () => upgradeIngredientCapacity('chocolate'));

  // Box & Truck Upgrade Buttons
  document.getElementById('upgrade-box-btn').addEventListener('click', upgradeBoxCapacity);
  document.getElementById('upgrade-truck-btn').addEventListener('click', upgradeTruckCapacity);

  // Call Truck Button
  document.getElementById('call-truck-btn').addEventListener('click', callTruck);

  // Automation Upgrade Button
  document.getElementById('buy-auto-btn').addEventListener('click', buyAutomationUpgrade);

  // Canvas Click / Touch
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    produceCookie(x, y);
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      const rect = canvas.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;
      produceCookie(x, y);
    }
  });

  // Reset Game
  document.getElementById('reset-btn').addEventListener('click', resetGame);
}

// Cookie Production Logic
function produceCookie(spawnX, spawnY) {
  initAudio();
  const { flour, water, chocolate } = gameState.ingredients;

  // Check if ingredients are available
  if (flour.current < 1 || water.current < 1 || chocolate.current < 1) {
    createFloatingText("Nincs elég alapanyag!", spawnX || canvas.width/2, spawnY || canvas.height/2, "#e74c3c");
    return false;
  }

  // Check box capacity
  if (gameState.boxCookies >= gameState.boxCapacity) {
    createFloatingText("Megtelt a doboz tároló!", spawnX || canvas.width/2, spawnY || canvas.height/2, "#e74c3c");
    return false;
  }

  // Deduct ingredients
  flour.current -= 1;
  water.current -= 1;
  chocolate.current -= 1;

  // Update cookie counters
  gameState.totalCookies += 1;
  gameState.boxCookies += 1;

  // Spawn visual cookie on conveyor
  const startX = spawnX || 60;
  const startY = spawnY || canvas.height * 0.45;
  cookiesOnBelt.push({
    x: startX,
    y: startY,
    progress: 0,
    speed: 0.015 + Math.random() * 0.005
  });

  playSound('produce');

  // Spawn click feedback particle
  createClickParticle(startX, startY);

  updateUI();
  return true;
}

// Ingredient Refill
function refillIngredient(type) {
  initAudio();
  const ing = gameState.ingredients[type];
  if (ing.current >= ing.max) return;
  if (gameState.money < ing.refillCost) return;

  gameState.money -= ing.refillCost;
  ing.current = ing.max;

  playSound('refill');
  createFloatingText(`+${type.toUpperCase()} Újratöltve!`, canvas.width * 0.2, canvas.height * 0.3, "#2ecc71");
  updateUI();
  saveGameSave();
}

// Ingredient Storage Doubling Upgrade
function upgradeIngredientCapacity(type) {
  initAudio();
  const ing = gameState.ingredients[type];
  if (gameState.money < ing.upgradeCost) return;

  gameState.money -= ing.upgradeCost;
  ing.max *= 2;
  ing.upgradeCost *= 2;

  playSound('upgrade');
  createFloatingText(`${type.toUpperCase()} Kapacitás Duplázva!`, canvas.width * 0.2, canvas.height * 0.3, "#9b59b6");
  updateUI();
  saveGameSave();
}

// Box & Truck Capacity Upgrades
function upgradeBoxCapacity() {
  initAudio();
  if (gameState.money < gameState.boxUpgradeCost) return;
  gameState.money -= gameState.boxUpgradeCost;
  gameState.boxCapacity *= 2;
  gameState.boxUpgradeCost *= 2;
  playSound('upgrade');
  createFloatingText("Doboz Tároló Duplázva!", canvas.width * 0.5, canvas.height * 0.3, "#9b59b6");
  updateUI();
  saveGameSave();
}

function upgradeTruckCapacity() {
  initAudio();
  if (gameState.money < gameState.truckUpgradeCost) return;
  gameState.money -= gameState.truckUpgradeCost;
  gameState.truckCapacity *= 2;
  gameState.truckUpgradeCost *= 2;
  playSound('upgrade');
  createFloatingText("Kamion Kapacitás Duplázva!", canvas.width * 0.7, canvas.height * 0.3, "#9b59b6");
  updateUI();
  saveGameSave();
}

// Automation Level Upgrades
function buyAutomationUpgrade() {
  initAudio();
  if (gameState.autoLevel >= 7) return;
  const cost = gameState.autoCosts[gameState.autoLevel];
  if (gameState.money < cost) return;

  gameState.money -= cost;
  gameState.autoLevel += 1;
  playSound('upgrade');
  createFloatingText(`Automatizálás Szint ${gameState.autoLevel} Megvásárolva!`, canvas.width * 0.5, canvas.height * 0.2, "#1abc9c");
  updateUI();
  saveGameSave();
}

// Truck Dispatching & Animation Lock
function callTruck() {
  initAudio();
  if (gameState.truckState !== 'idle') return; // Strictly locked while truck is active
  if (gameState.boxCookies < 100) return; // Requires at least 100 cookies in storage

  // Determine amount to load into truck
  const sellAmount = Math.min(gameState.boxCookies, gameState.truckCapacity);
  if (sellAmount < 100) return;

  gameState.cookiesToSell = sellAmount;
  gameState.boxCookies -= sellAmount;
  gameState.truckState = 'arriving';
  gameState.truckProgress = 0;

  playSound('truck');
  createFloatingText("Kamion Érkezik...", canvas.width * 0.75, canvas.height * 0.2, "#3498db");
  updateUI();
}

// LocalStorage Save & Load
function saveGameSave() {
  try {
    localStorage.setItem('sutemeny_gyar_save', JSON.stringify(gameState));
  } catch(e) {}
}

function loadGameSave() {
  try {
    const data = localStorage.getItem('sutemeny_gyar_save');
    if (data) {
      const parsed = JSON.parse(data);
      Object.assign(gameState, parsed);
      // Reset non-persistent state
      gameState.truckState = 'idle';
      gameState.truckProgress = 0;
      gameState.cookiesToSell = 0;
      gameState.drones = {
        flour: { active: false, progress: 0 },
        water: { active: false, progress: 0 },
        chocolate: { active: false, progress: 0 }
      };
    }
  } catch(e) {}
}

// Floating Text Feedback
function createFloatingText(text, x, y, color = "#f1c40f") {
  particles.push({
    text,
    x: x || canvas.width / 2,
    y: y || canvas.height / 2,
    alpha: 1,
    color,
    dy: -1
  });
}

function createClickParticle(x, y) {
  for (let i = 0; i < 5; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      radius: Math.random() * 3 + 2,
      alpha: 1,
      color: "#f39c12"
    });
  }
}

// Update UI elements
function updateUI() {
  document.getElementById('money-display').textContent = `$${gameState.money}`;
  document.getElementById('total-cookies-display').textContent = gameState.totalCookies;
  document.getElementById('box-cookies-display').textContent = `${gameState.boxCookies} / ${gameState.boxCapacity}`;
  document.getElementById('auto-level-display').textContent = `Szint ${gameState.autoLevel}`;

  // Update Ingredient Cards
  const types = ['flour', 'water', 'chocolate'];
  types.forEach(type => {
    const ing = gameState.ingredients[type];
    document.getElementById(`${type}-qty`).textContent = `${ing.current} / ${ing.max}`;
    const bar = document.getElementById(`${type}-bar`);
    const pct = Math.max(0, Math.min(100, (ing.current / ing.max) * 100));
    bar.style.width = `${pct}%`;

    // Refill button
    const refillBtn = document.getElementById(`refill-${type}-btn`);
    refillBtn.textContent = `Újratölt ($${ing.refillCost})`;
    refillBtn.disabled = (ing.current >= ing.max) || (gameState.money < ing.refillCost);

    // Upgrade button
    const upgradeBtn = document.getElementById(`upgrade-${type}-btn`);
    upgradeBtn.textContent = `Raktár Duplázás ($${ing.upgradeCost})`;
    upgradeBtn.disabled = gameState.money < ing.upgradeCost;
  });

  // Box & Truck Capacity UI
  document.getElementById('box-capacity-text').textContent = gameState.boxCapacity;
  const upgradeBoxBtn = document.getElementById('upgrade-box-btn');
  upgradeBoxBtn.textContent = `Doboz Bővítés ($${gameState.boxUpgradeCost})`;
  upgradeBoxBtn.disabled = gameState.money < gameState.boxUpgradeCost;

  document.getElementById('truck-capacity-text').textContent = gameState.truckCapacity;
  const upgradeTruckBtn = document.getElementById('upgrade-truck-btn');
  upgradeTruckBtn.textContent = `Kamion Bővítés ($${gameState.truckUpgradeCost})`;
  upgradeTruckBtn.disabled = gameState.money < gameState.truckUpgradeCost;

  // Truck Call Button Status
  const callTruckBtn = document.getElementById('call-truck-btn');
  const truckStatusText = document.getElementById('truck-status-text');

  if (gameState.truckState === 'idle') {
    truckStatusText.textContent = "Státusz: Várakozik";
    callTruckBtn.disabled = gameState.boxCookies < 100;
  } else {
    truckStatusText.textContent = `Státusz: ${
      gameState.truckState === 'arriving' ? 'Tolatás be...' :
      gameState.truckState === 'loading' ? 'Bepakolás...' : 'Távozás...'
    }`;
    callTruckBtn.disabled = true; // Disabled while truck is in movement
  }

  // Automation Buy Button & Perks List
  const buyAutoBtn = document.getElementById('buy-auto-btn');
  if (gameState.autoLevel >= 7) {
    buyAutoBtn.textContent = "Automatizálás Max Szint (7/7)";
    buyAutoBtn.disabled = true;
  } else {
    const nextCost = gameState.autoCosts[gameState.autoLevel];
    buyAutoBtn.textContent = `Automatizálás Szint ${gameState.autoLevel + 1} ($${nextCost})`;
    buyAutoBtn.disabled = gameState.money < nextCost;
  }

  // Update perk list active highlighting
  for (let lvl = 1; lvl <= 7; lvl++) {
    const perkEl = document.getElementById(`perk-${lvl}`);
    if (perkEl) {
      if (gameState.autoLevel >= lvl) {
        perkEl.classList.add('active');
      } else {
        perkEl.classList.remove('active');
      }
    }
  }
}

function resetGame() {
  if (!confirm("Biztosan újra akarod indítani a játékot? Minden haladás elvész.")) return;

  localStorage.removeItem('sutemeny_gyar_save');

  gameState.money = 0;
  gameState.totalCookies = 0;
  gameState.boxCookies = 0;

  gameState.ingredients.flour = { current: 1000, max: 1000, refillCost: 100, upgradeCost: 200 };
  gameState.ingredients.water = { current: 600, max: 600, refillCost: 10, upgradeCost: 200 };
  gameState.ingredients.chocolate = { current: 400, max: 400, refillCost: 50, upgradeCost: 200 };

  gameState.boxCapacity = 100;
  gameState.boxUpgradeCost = 500;
  gameState.truckCapacity = 100;
  gameState.truckUpgradeCost = 500;
  gameState.truckState = 'idle';
  gameState.truckProgress = 0;
  gameState.cookiesToSell = 0;

  gameState.autoLevel = 0;
  gameState.autoTimer = 0;

  gameState.drones.flour = { active: false, progress: 0 };
  gameState.drones.water = { active: false, progress: 0 };
  gameState.drones.chocolate = { active: false, progress: 0 };

  cookiesOnBelt = [];
  particles = [];

  updateUI();
}

function gameLoop() {
  updateGameLogic();
  render();
  requestAnimationFrame(gameLoop);
}

function updateGameLogic() {
  // Belt movement animation
  beltOffset = (beltOffset + 1.5) % 30;

  // Auto-production logic (Levels 1 to 3 speed)
  if (gameState.autoLevel >= 1) {
    const interval = gameState.autoLevel === 1 ? 60 : (gameState.autoLevel === 2 ? 35 : 15);
    gameState.autoTimer++;
    if (gameState.autoTimer >= interval) {
      gameState.autoTimer = 0;
      produceCookie();
    }
  }

  // Drone Auto-Refills (Level 4: Flour, Level 5: Water, Level 6: Chocolate)
  const droneLevels = { flour: 4, water: 5, chocolate: 6 };
  ['flour', 'water', 'chocolate'].forEach(type => {
    if (gameState.autoLevel >= droneLevels[type]) {
      const ing = gameState.ingredients[type];
      const drone = gameState.drones[type];

      // Trigger drone delivery if empty (or low) and affordable, and drone isn't currently flying
      if (ing.current <= 0 && gameState.money >= ing.refillCost && !drone.active) {
        drone.active = true;
        drone.progress = 0;
      }

      // Update active drone flight
      if (drone.active) {
        drone.progress += 0.02; // Drone speed
        if (drone.progress >= 1) {
          drone.active = false;
          drone.progress = 0;
          // Deduct cost & refill upon drone arrival
          if (gameState.money >= ing.refillCost && ing.current < ing.max) {
            gameState.money -= ing.refillCost;
            ing.current = ing.max;
            playSound('refill');
            createFloatingText(`Drón: ${type.toUpperCase()} Újratöltve!`, canvas.width * 0.2, canvas.height * 0.25, "#1abc9c");
            updateUI();
          }
        }
      }
    }
  });

  // Auto Truck Dispatching (Level 7)
  if (gameState.autoLevel >= 7) {
    if (gameState.truckState === 'idle' && gameState.boxCookies >= 100) {
      callTruck();
    }
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.text) {
      p.y += p.dy;
      p.alpha -= 0.02;
    } else {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;
    }
    if (p.alpha <= 0) particles.splice(i, 1);
  }

  // Update cookies on belt
  for (let i = cookiesOnBelt.length - 1; i >= 0; i--) {
    const cookie = cookiesOnBelt[i];
    cookie.progress += cookie.speed;
    if (cookie.progress >= 1) {
      cookiesOnBelt.splice(i, 1);
    }
  }

  // Truck Animation Logic
  if (gameState.truckState === 'arriving') {
    gameState.truckProgress += 0.008;
    if (gameState.truckProgress >= 1) {
      gameState.truckState = 'loading';
      gameState.truckProgress = 0;
    }
  } else if (gameState.truckState === 'loading') {
    gameState.truckProgress += 0.015;
    if (gameState.truckProgress >= 1) {
      gameState.truckState = 'departing';
      gameState.truckProgress = 0;
      // Earn money upon finishing loading
      const earnings = gameState.cookiesToSell * 1; // $1 per cookie
      gameState.money += earnings;
      playSound('sell');
      createFloatingText(`+$${earnings} eladva!`, canvas.width * 0.75, canvas.height * 0.5, "#2ecc71");
      updateUI();
      saveGameSave();
    }
  } else if (gameState.truckState === 'departing') {
    gameState.truckProgress += 0.008;
    if (gameState.truckProgress >= 1) {
      gameState.truckState = 'idle';
      gameState.truckProgress = 0;
      gameState.cookiesToSell = 0;
      updateUI();
    }
  }
}

function render() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const h = canvas.height;

  // Background - Factory Floor
  ctx.fillStyle = '#243342';
  ctx.fillRect(0, 0, w, h);

  // Draw Loading Dock / Road for Truck on the Right Side
  const dockX = w * 0.7;
  ctx.fillStyle = '#1a252f';
  ctx.fillRect(dockX, 0, w - dockX, h);

  // Road dashed lines
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 3;
  ctx.setLineDash([15, 15]);
  ctx.beginPath();
  ctx.moveTo(dockX + (w - dockX) / 2, 0);
  ctx.lineTo(dockX + (w - dockX) / 2, h);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Conveyor Belt (Left to Center-Right)
  const beltY = h * 0.45;
  const beltHeight = 50;
  const beltWidth = w * 0.55;

  ctx.fillStyle = '#34495e';
  ctx.fillRect(20, beltY, beltWidth, beltHeight);
  ctx.strokeStyle = '#7f8c8d';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, beltY, beltWidth, beltHeight);

  // Belt moving stripes animation
  ctx.strokeStyle = '#2c3e50';
  ctx.lineWidth = 2;
  for (let x = 20 + (beltOffset % 20); x < 20 + beltWidth; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, beltY);
    ctx.lineTo(x, beltY + beltHeight);
    ctx.stroke();
  }

  // Draw Box Storage at the end of Conveyor Belt
  const boxX = 20 + beltWidth + 10;
  const boxY = beltY - 10;
  const boxW = 60;
  const boxH = 70;

  ctx.fillStyle = '#d35400';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = '#e67e22';
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // Box Label & Fill indicator
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DOBOZ', boxX + boxW/2, boxY + 20);
  ctx.fillText(`${gameState.boxCookies}`, boxX + boxW/2, boxY + 45);

  // Draw Cookies on Belt
  cookiesOnBelt.forEach(c => {
    const cx = c.x + c.progress * (20 + beltWidth - c.x);
    const cy = beltY + beltHeight / 2;

    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6d4c41';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 3, cy + 2, 2.5, 0, Math.PI * 2);
    ctx.arc(cx - 2, cy + 3, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Render Top-Down Reversing Delivery Truck
  renderTruck(dockX + (w - dockX) / 2, h);

  // Render Flying Drones
  renderDrones(w, h);

  // Render Particles & Floating Text
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    if (p.text) {
      ctx.fillStyle = p.color;
      ctx.font = 'bold 16px Segoe UI, sans-serif';
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

// Top-Down Flying Drones Rendering
function renderDrones(w, h) {
  const types = ['flour', 'water', 'chocolate'];
  const colors = { flour: '#f1c40f', water: '#3498db', chocolate: '#8d6e63' };

  types.forEach((type, index) => {
    const drone = gameState.drones[type];
    if (!drone.active) return;

    // Flight path: from off-screen top-left to ingredient area on left
    const startX = -30;
    const startY = -30;
    const targetX = 80;
    const targetY = 80 + index * 50;

    // Curved parabolic trajectory
    let currentX = startX + (targetX - startX) * drone.progress;
    let currentY = startY + (targetY - startY) * Math.sin(drone.progress * Math.PI / 2);

    ctx.save();
    ctx.translate(currentX, currentY);

    // Drone Body
    ctx.fillStyle = '#34495e';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    // Drone Arms & Propellers
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, -16); ctx.lineTo(16, 16);
    ctx.moveTo(-16, 16); ctx.lineTo(16, -16);
    ctx.stroke();

    // Rotating Propeller Blades
    const propAngle = Date.now() * 0.05;
    [[-16,-16], [16,16], [-16,16], [16,-16]].forEach(([px, py]) => {
      ctx.fillStyle = '#bdc3c7';
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Crate carried by drone
    ctx.fillStyle = colors[type];
    ctx.fillRect(-6, -6, 12, 12);

    ctx.restore();
  });
}

// Top-Down Truck Rendering
function renderTruck(centerX, canvasHeight) {
  if (gameState.truckState === 'idle') return;

  const truckWidth = 60;
  const truckLength = 120;
  const targetY = canvasHeight * 0.45;
  const startY = -truckLength; // Off-screen top for backing in

  let currentY = startY;

  if (gameState.truckState === 'arriving') {
    // Backing in (reversing from top to target position near box)
    currentY = startY + (targetY - startY) * gameState.truckProgress;
  } else if (gameState.truckState === 'loading') {
    currentY = targetY;
  } else if (gameState.truckState === 'departing') {
    // Driving off downwards
    currentY = targetY + (canvasHeight + truckLength - targetY) * gameState.truckProgress;
  }

  ctx.save();
  ctx.translate(centerX, currentY);

  // Truck Cargo Container (Back of top-down truck)
  ctx.fillStyle = '#ecf0f1';
  ctx.fillRect(-truckWidth / 2, -truckLength / 2, truckWidth, truckLength * 0.7);
  ctx.strokeStyle = '#bdc3c7';
  ctx.lineWidth = 2;
  ctx.strokeRect(-truckWidth / 2, -truckLength / 2, truckWidth, truckLength * 0.7);

  // Truck Cabin (Front facing direction of travel)
  // When arriving (reversing down), cabin points up/front.
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(-truckWidth / 2 + 5, -truckLength / 2 - 25, truckWidth - 10, 25);

  // Cabin Windshield
  ctx.fillStyle = '#3498db';
  ctx.fillRect(-truckWidth / 2 + 8, -truckLength / 2 - 20, truckWidth - 16, 10);

  // Headlights / Reverse Lights
  if (gameState.truckState === 'arriving') {
    // White reverse lights at back
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-truckWidth / 2 + 2, truckLength * 0.2, 8, 4);
    ctx.fillRect(truckWidth / 2 - 10, truckLength * 0.2, 8, 4);
  }

  // Loading animation visual on truck bed
  if (gameState.truckState === 'loading') {
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 12px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`+${gameState.cookiesToSell} Süti`, 0, -10);
  }

  ctx.restore();
}
