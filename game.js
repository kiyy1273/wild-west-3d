// Wild West Frontier 3D Game
// Main game bootstrap and world setup

const WORLD_SIZE = 4000;
const HALF_WORLD = WORLD_SIZE / 2;
const TERRAIN_HEIGHT_OFFSET = 1.4;

const container = document.getElementById('game-container');
const speedHud = document.getElementById('speed-meter');
const vehicleHud = document.getElementById('vehicle-type');
const positionHud = document.getElementById('position');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x98d8ff);
scene.fog = new THREE.Fog(0x98d8ff, 350, 4500);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 12000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const keys = {};

// ============================================
// CONSUMABLE ITEM SYSTEM
// ============================================

const consumableEffects = {
  water: {
    name: 'Water Bottle',
    duration: 0, // instant consumables have 0 duration
    effect: (playerState) => {
      playerState.energy = Math.min(playerState.energy + 25, 100);
    }
  },
  coffee: {
    name: 'Coffee',
    duration: 0,
    effect: (playerState) => {
      playerState.energy = Math.min(playerState.energy + 15, 100);
      playerState.speedBoost = 1.3;
      playerState.speedBoostTimer = 8; // 8 seconds
    }
  },
  steak: {
    name: 'Steak Dinner',
    duration: 0,
    effect: (playerState) => {
      playerState.energy = 100;
      playerState.health = Math.min(playerState.health + 20, 100);
    }
  },
  whiskey: {
    name: 'Whiskey',
    duration: 0,
    effect: (playerState) => {
      playerState.energy = Math.min(playerState.energy + 30, 100);
      playerState.drunkness = 0.4;
      playerState.drunkTimer = 6; // wears off after 6 seconds
    }
  },
  medicine: {
    name: 'Herbal Medicine',
    duration: 0,
    effect: (playerState) => {
      playerState.health = 100;
    }
  }
};

// ============================================
// BUSINESS CATALOG SYSTEM
// ============================================

const businessCatalog = {
  general_store: {
    name: 'General Store',
    owner: 'Tom Wills',
    position: { x: 0, y: 0, z: 0 }, // at town center
    type: 'retail',
    inventory: [
      { itemId: 'water', stock: 50, price: 2 },
      { itemId: 'coffee', stock: 30, price: 3 },
      { itemId: 'steak', stock: 20, price: 8 },
      { itemId: 'medicine', stock: 15, price: 12 }
    ]
  },
  desert_saloon: {
    name: 'Desert Saloon',
    owner: 'Whiskey Pete',
    position: { x: -1200, y: 0, z: -820 },
    type: 'tavern',
    inventory: [
      { itemId: 'whiskey', stock: 40, price: 5 },
      { itemId: 'water', stock: 35, price: 2 },
      { itemId: 'coffee', stock: 25, price: 4 }
    ]
  },
  mining_store: {
    name: 'Mining Camp Supply',
    owner: 'Old Hank',
    position: { x: -980, y: 0, z: 430 },
    type: 'supply',
    inventory: [
      { itemId: 'water', stock: 60, price: 1.5 },
      { itemId: 'steak', stock: 25, price: 7 },
      { itemId: 'medicine', stock: 20, price: 11 }
    ]
  },
  forest_lodge: {
    name: 'Forest Lodge',
    owner: 'Sarah Lodge',
    position: { x: 1150, y: 0, z: 240 },
    type: 'inn',
    inventory: [
      { itemId: 'steak', stock: 35, price: 9 },
      { itemId: 'coffee', stock: 40, price: 2.5 },
      { itemId: 'water', stock: 45, price: 1.8 },
      { itemId: 'medicine', stock: 18, price: 13 }
    ]
  },
  ranch_store: {
    name: 'Ranch Provisions',
    owner: 'Buck Thompson',
    position: { x: 840, y: 0, z: -380 },
    type: 'retail',
    inventory: [
      { itemId: 'steak', stock: 50, price: 6 },
      { itemId: 'water', stock: 55, price: 1.5 },
      { itemId: 'coffee', stock: 30, price: 3.5 },
      { itemId: 'medicine', stock: 16, price: 10 }
    ]
  }
};

// ============================================
// SHOP FRAMEWORK
// ============================================

const shopFramework = {
  currentShop: null,
  isOpen: false,

  init() {
    this.createShopPanel();
  },

  createShopPanel() {
    const existingPanel = document.getElementById('shop-panel');
    if (existingPanel) existingPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'shop-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="shop-header">
        <h2 id="shop-name">Shop</h2>
        <p id="shop-owner">Owner: Unknown</p>
        <div class="shop-stats">
          <span id="wallet-display">Wallet: $0</span>
          <span id="energy-display">Energy: 100/100</span>
        </div>
      </div>
      <div class="shop-inventory">
        <div id="shop-items"></div>
      </div>
      <div class="shop-footer">
        <button id="close-shop-btn">Close Shop (ESC)</button>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('close-shop-btn').addEventListener('click', () => {
      this.close();
    });
  },

  open(businessId) {
    const business = businessCatalog[businessId];
    if (!business) return;

    this.currentShop = businessId;
    this.isOpen = true;

    const panel = document.getElementById('shop-panel');
    document.getElementById('shop-name').textContent = business.name;
    document.getElementById('shop-owner').textContent = `Owner: ${business.owner}`;
    this.updateShopDisplay();

    panel.style.display = 'block';
  },

  close() {
    this.isOpen = false;
    this.currentShop = null;
    document.getElementById('shop-panel').style.display = 'none';
  },

  updateShopDisplay() {
    if (!this.currentShop) return;

    const business = businessCatalog[this.currentShop];
    const itemsContainer = document.getElementById('shop-items');
    itemsContainer.innerHTML = '';

    // Update wallet and energy display
    document.getElementById('wallet-display').textContent = `Wallet: $${player.wallet.toFixed(2)}`;
    document.getElementById('energy-display').textContent = `Energy: ${Math.round(player.energy)}/100`;

    business.inventory.forEach((item) => {
      const itemEffect = consumableEffects[item.itemId];
      if (!itemEffect) return;

      const itemDiv = document.createElement('div');
      itemDiv.className = 'shop-item';
      itemDiv.innerHTML = `
        <div class="item-info">
          <h3>${itemEffect.name}</h3>
          <p>Stock: ${item.stock}</p>
          <p class="price">$${item.price.toFixed(2)}</p>
        </div>
        <button class="buy-btn" data-item="${item.itemId}" data-price="${item.price}">
          Buy
        </button>
      `;

      const button = itemDiv.querySelector('.buy-btn');
      button.addEventListener('click', () => {
        this.buyItem(item.itemId, item.price, this.currentShop);
      });

      itemsContainer.appendChild(itemDiv);
    });
  },

  buyItem(itemId, price, businessId) {
    const business = businessCatalog[businessId];
    if (!business) return;

    // Find the item in inventory
    const inventoryItem = business.inventory.find((inv) => inv.itemId === itemId);
    if (!inventoryItem || inventoryItem.stock <= 0) {
      alert('Out of stock!');
      return;
    }

    // Check wallet
    if (player.wallet < price) {
      alert('Not enough money!');
      return;
    }

    // Process transaction
    player.wallet -= price;
    inventoryItem.stock--;
    player.inventory.push(itemId);

    this.updateShopDisplay();
  },

  getNearestShop(position, range = 60) {
    let nearest = null;
    let nearestDist = range;

    Object.entries(businessCatalog).forEach(([businessId, business]) => {
      const bPos = business.position;
      const dx = position.x - bPos.x;
      const dz = position.z - bPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = businessId;
      }
    });

    return nearest;
  }
};

// ============================================
// PLAYER STATE & WORLD
// ============================================

const world = {
  vehicles: [],
  buildings: [],
  roads: [],
  rails: [],
  landmarks: [],
  trees: [],
  settlementNames: []
};

const player = {
  position: new THREE.Vector3(0, 0, 0),
  yaw: 0,
  pitch: -0.45,
  velocityY: 0,
  onGround: true,
  moveSpeed: 18,
  sprintSpeed: 32,
  currentVehicle: 'foot',
  mountedVehicle: null,
  jumpVelocity: 15,

  // Economy
  wallet: 50.0, // Starting cash
  inventory: [],
  energy: 100,
  health: 100,

  // Consumable effects
  speedBoost: 1.0,
  speedBoostTimer: 0,
  drunkness: 0,
  drunkTimer: 0
};

const vehicleCatalog = ['foot', 'horse', 'wagon', 'buggy', 'stagecoach', 'cart'];
const vehicleSpeedMap = {
  foot: 18,
  horse: 42,
  wagon: 32,
  buggy: 48,
  stagecoach: 36,
  cart: 28
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function terrainHeightAt(x, z) {
  const base =
    Math.sin(x * 0.008) * 18 +
    Math.cos(z * 0.0075) * 16 +
    Math.sin((x + z) * 0.0055) * 12;

  const mountainNorth = z > 980 && x > 200 ? (z - 980) * 0.27 + 38 : 0;
  const mountainEast = x > 1200 && z > -200 ? (x - 1200) * 0.2 + 26 : 0;
  const forestRidge = x > 750 && x < 1500 ? Math.sin(x * 0.009) * 16 : 0;
  const desertDune = x < -800 && z < -200 ? Math.sin(x * 0.012 + z * 0.01) * 22 + 12 : 0;
  const canyonDepth = x > 850 && z < -900 ? Math.sin(x * 0.01) * 18 - 16 : 0;
  const mineSlope = x < -1000 && z > 300 && z < 850 ? Math.cos(x * 0.006) * 12 + 10 : 0;
  const riverTable = Math.abs(z) < 70 && x > -350 && x < 350 ? -10 : 0;
  const plainFlat = x > -850 && x < 850 && z > -900 && z < 900 ? -4 : 0;

  return base + mountainNorth + mountainEast + forestRidge + desertDune + canyonDepth + mineSlope + riverTable + plainFlat;
}

function terrainColorAt(x, z, y) {
  const forest = x > 700 && x < 1700 ? 0.42 : 0;
  const desert = x < -800 && z < -150 ? 0.95 : 0;
  const mountains = z > 900 && x > 150 ? 0.35 : 0;
  const river = Math.abs(z) < 70 && x > -350 && x < 350 ? -0.45 : 0;
  const town = Math.abs(x) < 240 && Math.abs(z) < 220 ? 0.25 : 0;

  let r = 0.16 + forest * 0.18 + mountains * 0.15 + desert * 0.45;
  let g = 0.28 + forest * 0.8 + mountains * 0.18 + desert * 0.2;
  let b = 0.14 + forest * 0.18 + desert * 0.15 + river * 0.45 + town * 0.08;

  if (y < -6) {
    r = 0.10; g = 0.34; b = 0.48;
  }

  if (x < -800 && z < -150) {
    r = 0.86; g = 0.72; b = 0.42;
  }

  if (z > 900 && x > 150) {
    r = 0.46; g = 0.48; b = 0.52;
  }

  if (Math.abs(x) < 250 && Math.abs(z) < 220) {
    r = 0.32; g = 0.29; b = 0.22;
  }

  return new THREE.Color(r, g, b);
}

function createTerrain() {
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 260, 260);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const colors = [];

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getY(i);
    const y = terrainHeightAt(x, z);
    positions.setZ(i, y);

    const color = terrainColorAt(x, z, y);
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0.03
    })
  );

  terrain.receiveShadow = true;
  scene.add(terrain);
}

function createSkyAndLighting() {
  const hemi = new THREE.HemisphereLight(0xeaf7ff, 0x2e250f, 1.25);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1bb, 1.1);
  sun.position.set(500, 1000, 350);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1500;
  sun.shadow.camera.right = 1500;
  sun.shadow.camera.top = 1500;
  sun.shadow.camera.bottom = -1500;
  scene.add(sun);

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(55, 28, 28),
    new THREE.MeshBasicMaterial({ color: 0xfff4c8 })
  );
  sunGlow.position.set(700, 1100, 450);
  scene.add(sunGlow);
}

function createRiver() {
  const points = [
    new THREE.Vector3(-1700, 0, -150),
    new THREE.Vector3(-1100, 0, 30),
    new THREE.Vector3(-350, 0, 120),
    new THREE.Vector3(180, 0, 160),
    new THREE.Vector3(720, 0, 220),
    new THREE.Vector3(1250, 0, 260),
    new THREE.Vector3(1650, 0, 280)
  ];

  points.forEach((p) => {
    p.y = terrainHeightAt(p.x, p.z) - 1.6;
  });

  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 160, 16, 16, false);
  const river = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x2e83c9,
      roughness: 0.45,
      metalness: 0.08,
      emissive: 0x183d5c,
      emissiveIntensity: 0.18
    })
  );
  river.receiveShadow = true;
  scene.add(river);

  const bridgeMaterial = new THREE.MeshStandardMaterial({ color: 0x7a5331, roughness: 0.9 });
  [-430, 0, 520].forEach((x) => {
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(190, 11, 25), bridgeMaterial);
    bridge.position.set(x, terrainHeightAt(x, 140) + 8, 150);
    bridge.rotation.y = 0.18;
    bridge.castShadow = true;
    scene.add(bridge);
  });
}

function createRoad(start, end, width = 18) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);

  const road = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.7, length),
    new THREE.MeshStandardMaterial({ color: 0x4f3d2d, roughness: 0.92 })
  );

  const midX = (start.x + end.x) / 2;
  const midZ = (start.z + end.z) / 2;
  road.position.set(midX, terrainHeightAt(midX, midZ) + 0.5, midZ);
  road.rotation.y = Math.atan2(dx, dz);
  road.receiveShadow = true;
  scene.add(road);
  world.roads.push(road);
}

function createRail(start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);

  const railGroup = new THREE.Group();
  const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x4a3122, roughness: 0.9 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x6d6d6d, metalness: 0.9, roughness: 0.5 });

  for (let i = -2; i <= 2; i++) {
    const sleeper = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 18), sleeperMat);
    sleeper.position.set(0, 0.8, i * 26);
    railGroup.add(sleeper);
  }

  const left = new THREE.Mesh(new THREE.BoxGeometry(length, 0.7, 1.6), railMat);
  const right = new THREE.Mesh(new THREE.BoxGeometry(length, 0.7, 1.6), railMat);
  left.position.set(0, 1.5, -2.2);
  right.position.set(0, 1.5, 2.2);
  railGroup.add(left, right);

  const midX = (start.x + end.x) / 2;
  const midZ = (start.z + end.z) / 2;
  railGroup.position.set(midX, terrainHeightAt(midX, midZ) + 0.4, midZ);
  railGroup.rotation.y = Math.atan2(dx, dz);
  scene.add(railGroup);
  world.rails.push(railGroup);
}

function createSettlementMarker(x, z, name, color, height = 22) {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(25, 28, 8, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  );
  base.position.y = terrainHeightAt(x, z) + 4;
  base.castShadow = true;
  group.add(base);

  const flag = new THREE.Mesh(
    new THREE.ConeGeometry(14, height, 16),
    new THREE.MeshStandardMaterial({ color: 0xf0d57f, roughness: 0.75 })
  );
  flag.position.y = terrainHeightAt(x, z) + height / 2 + 5;
  flag.castShadow = true;
  group.add(flag);

  group.position.set(x, 0, z);
  scene.add(group);
  world.settlementNames.push({ name, x, z });
}

function createTownCore() {
  const colors = [0x8f5c39, 0xbf8a5b, 0x7f5b4c, 0x5f4639, 0x8d6d4a];

  const centerX = 0;
  const centerZ = 0;
  for (let i = 0; i < 42; i++) {
    const angle = (i / 42) * Math.PI * 2;
    const radius = 120 + (i % 5) * 20;
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    const height = 20 + (i % 5) * 8;

    const building = new THREE.Mesh(
      new THREE.BoxGeometry(18, height, 18),
      new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.88 })
    );
    building.position.set(x, terrainHeightAt(x, z) + height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    world.buildings.push(building);
  }

  const saloon = new THREE.Mesh(
    new THREE.BoxGeometry(54, 28, 40),
    new THREE.MeshStandardMaterial({ color: 0x734f39, roughness: 0.9 })
  );
  saloon.position.set(0, terrainHeightAt(0, 0) + 14, 0);
  saloon.castShadow = true;
  scene.add(saloon);

  const sheriff = new THREE.Mesh(
    new THREE.BoxGeometry(26, 34, 20),
    new THREE.MeshStandardMaterial({ color: 0xe4d9c8, roughness: 0.8 })
  );
  sheriff.position.set(-90, terrainHeightAt(-90, 10) + 17, -14);
  sheriff.castShadow = true;
  scene.add(sheriff);

  const stable = new THREE.Mesh(
    new THREE.BoxGeometry(42, 18, 24),
    new THREE.MeshStandardMaterial({ color: 0x88613b, roughness: 0.9 })
  );
  stable.position.set(90, terrainHeightAt(90, 28) + 9, 60);
  stable.castShadow = true;
  scene.add(stable);

  const bank = new THREE.Mesh(
    new THREE.BoxGeometry(35, 24, 28),
    new THREE.MeshStandardMaterial({ color: 0xaba290, roughness: 0.75 })
  );
  bank.position.set(65, terrainHeightAt(65, -80) + 12, -60);
  bank.castShadow = true;
  scene.add(bank);
}

function createTrees() {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d2f20, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6f3d, roughness: 0.9 });

  for (let i = 0; i < 280; i++) {
    const x = -1700 + Math.random() * 3400;
    const z = 700 + Math.random() * 1400;
    if (x > -400 && z < 1200) continue;

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.1, 16, 12), trunkMat);
    trunk.position.set(x, terrainHeightAt(x, z) + 8, z);
    trunk.castShadow = true;
    scene.add(trunk);

    const leaves = new THREE.Mesh(new THREE.ConeGeometry(10, 22, 12), leafMat);
    leaves.position.set(x, terrainHeightAt(x, z) + 26, z);
    leaves.castShadow = true;
    scene.add(leaves);
  }
}

function createRockyMountains() {
  for (let i = 0; i < 42; i++) {
    const x = 450 + Math.random() * 1200;
    const z = 900 + Math.random() * 900;
    const radius = 25 + Math.random() * 80;

    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(radius, 0),
      new THREE.MeshStandardMaterial({ color: 0x7d7f80, roughness: 1 })
    );
    rock.position.set(x, terrainHeightAt(x, z) + 36 + Math.random() * 50, z);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }
}

function createCanyonWalls() {
  for (let i = 0; i < 15; i++) {
    const x = 820 + Math.random() * 350;
    const z = -980 + Math.random() * 240;
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(105, 60, 70),
      new THREE.MeshStandardMaterial({ color: 0x7e5f43, roughness: 1 })
    );
    wall.position.set(x, terrainHeightAt(x, z) + 30, z);
    wall.rotation.y = Math.random() * Math.PI;
    wall.castShadow = true;
    scene.add(wall);
  }
}

function createMineSite() {
  const mine = new THREE.Mesh(
    new THREE.CylinderGeometry(42, 50, 64, 18),
    new THREE.MeshStandardMaterial({ color: 0x5d5d5d, roughness: 0.9 })
  );
  mine.position.set(-980, terrainHeightAt(-980, 430) + 32, 430);
  mine.castShadow = true;
  mine.receiveShadow = true;
  scene.add(mine);
}

function createWorld() {
  createTerrain();
  createSkyAndLighting();
  createRiver();

  createRoad(new THREE.Vector3(-1700, 0, -150), new THREE.Vector3(-360, 0, 40), 18);
  createRoad(new THREE.Vector3(-360, 0, 40), new THREE.Vector3(480, 0, 120), 18);
  createRoad(new THREE.Vector3(480, 0, 120), new THREE.Vector3(1500, 0, 260), 18);
  createRoad(new THREE.Vector3(-200, 0, 260), new THREE.Vector3(460, 0, -780), 15);
  createRoad(new THREE.Vector3(-950, 0, 430), new THREE.Vector3(-1200, 0, -820), 14);

  createRail(new THREE.Vector3(-1350, 0, 120), new THREE.Vector3(1300, 0, 260));
  createRail(new THREE.Vector3(-160, 0, -670), new THREE.Vector3(1100, 0, -1100));

  createTownCore();
  createSettlementMarker(-980, 430, 'Mining Camp', 0x8d6952, 26);
  createSettlementMarker(-1200, -820, 'Desert Town', 0xcf9d57, 24);
  createSettlementMarker(840, -380, 'Ranch', 0x8ac26d, 24);
  createSettlementMarker(1150, 240, 'Forest Post', 0x4d7d52, 24);
  createSettlementMarker(320, -990, 'Outlaw Camp', 0x8a5a47, 22);
  createSettlementMarker(980, -1200, 'Canyon Lookout', 0xb5895a, 28);
  createSettlementMarker(1500, -200, 'Rail Depot', 0xd0bb74, 24);

  createTrees();
  createRockyMountains();
  createCanyonWalls();
  createMineSite();
}

function buildHorse() {
  const horse = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7e4f2a, roughness: 0.82 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3d2518, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 8), bodyMat);
  body.castShadow = true;
  horse.add(body);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(6, 7, 4), bodyMat);
  neck.position.set(11, 6.5, 0);
  neck.castShadow = true;
  horse.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 5), darkMat);
  head.position.set(16, 8.5, 0);
  head.castShadow = true;
  horse.add(head);

  for (let i = -1; i <= 1; i += 2) {
    for (let j = -1; j <= 1; j += 2) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2.2, 11, 2.3), darkMat);
      leg.position.set(i * 5, -5, j * 3);
      leg.castShadow = true;
      horse.add(leg);
    }
  }

  horse.position.set(55, terrainHeightAt(55, 15) + 5, 15);
  horse.rotation.y = Math.PI * 0.25;
  scene.add(horse);
  return horse;
}

function buildVehicle(type, x, z) {
  if (type === 'horse') {
    const horse = buildHorse();
    horse.position.set(x, terrainHeightAt(x, z) + 5, z);
    return { type, mesh: horse, speed: vehicleSpeedMap.horse };
  }

  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9a3b2a, roughness: 0.7 });
  const accMat = new THREE.MeshStandardMaterial({ color: 0x1f2328, roughness: 0.8 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.85 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(24, 8, 14), bodyMat);
  base.castShadow = true;
  group.add(base);

  if (type === 'wagon' || type === 'stagecoach' || type === 'cart') {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 12), accMat);
    roof.position.set(0, 8, 0);
    group.add(roof);
  }

  if (type === 'buggy') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 10), accMat);
    cabin.position.set(1, 8, 0);
    group.add(cabin);
  }

  const accentColor = type === 'cart' ? 0x7a5a39 : type === 'stagecoach' ? 0xb67b3f : 0x6e6d73;
  const accent = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 10), new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.8 }));
  accent.position.set(-5, 10, 0);
  group.add(accent);

  const wheelPositions = [
    [-8, 0, -7], [8, 0, -7],
    [-8, 0, 7], [8, 0, 7]
  ];

  wheelPositions.forEach(([px, py, pz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 2.4, 18), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(px, py, pz);
    wheel.castShadow = true;
    group.add(wheel);
  });

  group.position.set(x, terrainHeightAt(x, z) + 5, z);
  group.rotation.y = Math.PI * 0.25;
  scene.add(group);

  return { type, mesh: group, speed: vehicleSpeedMap[type] };
}

function createVehicles() {
  const spawns = [
    { type: 'horse', x: 55, z: 15 },
    { type: 'wagon', x: 120, z: -80 },
    { type: 'buggy', x: -120, z: -60 },
    { type: 'stagecoach', x: 200, z: 100 },
    { type: 'cart', x: -170, z: 120 },
    { type: 'horse', x: 240, z: 250 }
  ];

  spawns.forEach(({ type, x, z }) => {
    world.vehicles.push(buildVehicle(type, x, z));
  });
}

function toggleMount() {
  if (player.currentVehicle === 'foot') {
    let nearest = null;
    let nearestDist = 35;

    world.vehicles.forEach((vehicle) => {
      const dist = vehicle.mesh.position.distanceTo(player.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = vehicle;
      }
    });

    if (nearest) {
      player.currentVehicle = nearest.type;
      player.mountedVehicle = nearest;
      player.position.set(nearest.mesh.position.x, nearest.mesh.position.y + 5.5, nearest.mesh.position.z);
      player.onGround = true;
    }
  } else {
    player.currentVehicle = 'foot';
    player.mountedVehicle = null;
    player.position.y = terrainHeightAt(player.position.x, player.position.z) + TERRAIN_HEIGHT_OFFSET;
    player.velocityY = 0;
  }
}

function cycleVehicle() {
  const currentIndex = vehicleCatalog.indexOf(player.currentVehicle);
  const nextType = vehicleCatalog[(currentIndex + 1) % vehicleCatalog.length];

  if (nextType === 'foot') {
    player.currentVehicle = 'foot';
    player.mountedVehicle = null;
    player.position.y = terrainHeightAt(player.position.x, player.position.z) + TERRAIN_HEIGHT_OFFSET;
    return;
  }

  const existing = world.vehicles.find((v) => v.type === nextType);
  if (existing) {
    player.currentVehicle = nextType;
    player.mountedVehicle = existing;
    player.position.set(existing.mesh.position.x, existing.mesh.position.y + 5.5, existing.mesh.position.z);
    return;
  }

  const vehicle = buildVehicle(nextType, player.position.x + 35, player.position.z + 25);
  world.vehicles.push(vehicle);
  player.currentVehicle = nextType;
  player.mountedVehicle = vehicle;
}

function consumeItem(itemId) {
  const effect = consumableEffects[itemId];
  if (!effect) return;

  effect.effect(player);
  
  // Remove from inventory
  const index = player.inventory.indexOf(itemId);
  if (index > -1) {
    player.inventory.splice(index, 1);
  }
}

function updatePlayer(dt) {
  const moveX = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
  const moveZ = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);

  if (moveX !== 0 || moveZ !== 0) {
    const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const dir = new THREE.Vector3();
    dir.addScaledVector(forward, moveZ);
    dir.addScaledVector(right, moveX);
    dir.normalize();

    let speed = player.currentVehicle === 'foot'
      ? (keys['ShiftLeft'] || keys['ShiftRight'] ? player.sprintSpeed : player.moveSpeed)
      : vehicleSpeedMap[player.currentVehicle];

    speed *= player.speedBoost;

    const step = new THREE.Vector3(dir.x * speed * dt, 0, dir.z * speed * dt);

    if (player.mountedVehicle) {
      const target = player.mountedVehicle.mesh;
      target.position.x += step.x;
      target.position.z += step.z;
      target.rotation.y = Math.atan2(dir.x, dir.z);
      target.position.y = terrainHeightAt(target.position.x, target.position.z) + 4.5;
      player.position.set(target.position.x, target.position.y + 5.5, target.position.z);
    } else {
      player.position.x += step.x;
      player.position.z += step.z;
    }
  }

  if (player.mountedVehicle) {
    player.position.y = player.mountedVehicle.mesh.position.y + 5.3;
    player.onGround = true;
  } else {
    player.velocityY -= 28 * dt;
    const groundY = terrainHeightAt(player.position.x, player.position.z) + TERRAIN_HEIGHT_OFFSET;
    player.position.y += player.velocityY * dt;

    if (player.position.y <= groundY) {
      player.position.y = groundY;
      player.velocityY = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }
  }

  // Update consumable effects
  player.energy = Math.max(0, player.energy - 0.5 * dt); // Energy depletes over time
  player.health = Math.max(0, player.health - 0.1 * dt); // Health slowly depletes
  
  if (player.speedBoostTimer > 0) {
    player.speedBoostTimer -= dt;
    if (player.speedBoostTimer <= 0) {
      player.speedBoost = 1.0;
    }
  }

  if (player.drunkTimer > 0) {
    player.drunkTimer -= dt;
    if (player.drunkTimer <= 0) {
      player.drunkness = 0;
    }
  }

  // Add drunken camera sway
  if (player.drunkness > 0) {
    player.pitch += Math.sin(Date.now() * 0.003) * player.drunkness * 0.01;
    player.yaw += Math.cos(Date.now() * 0.002) * player.drunkness * 0.01;
  }

  player.position.x = clamp(player.position.x, -HALF_WORLD, HALF_WORLD);
  player.position.z = clamp(player.position.z, -HALF_WORLD, HALF_WORLD);
}

function updateCamera() {
  const distance = 9;
  const lookAt = new THREE.Vector3(
    player.position.x + Math.sin(player.yaw) * 12,
    player.position.y + 4.5,
    player.position.z + Math.cos(player.yaw) * 12
  );

  const camX = player.position.x + Math.sin(player.yaw) * distance * Math.cos(player.pitch);
  const camY = player.position.y + 4.5 + Math.sin(player.pitch) * distance;
  const camZ = player.position.z + Math.cos(player.yaw) * distance * Math.cos(player.pitch);

  camera.position.set(camX, camY, camZ);
  camera.lookAt(lookAt);
}

function updateHud() {
  const speed = player.mountedVehicle
    ? vehicleSpeedMap[player.currentVehicle]
    : (keys['ShiftLeft'] || keys['ShiftRight'] ? player.sprintSpeed : player.moveSpeed);

  speedHud.textContent = `Speed: ${Math.round(speed * 1.8)} km/h`;
  vehicleHud.textContent = player.currentVehicle === 'foot'
    ? 'On Foot'
    : player.currentVehicle.charAt(0).toUpperCase() + player.currentVehicle.slice(1);
  positionHud.textContent = `X: ${Math.round(player.position.x)} Z: ${Math.round(player.position.z)}`;
}

function updateVehicleGestures() {
  world.vehicles.forEach((vehicle) => {
    if (vehicle.type === 'horse') {
      const legs = vehicle.mesh.children.filter((child) => child.geometry && child.geometry.type === 'BoxGeometry' && child.position.y < 0);
      legs.forEach((leg, index) => {
        leg.rotation.x = Math.sin(performance.now() * 0.01 + index) * 0.18;
      });
    }
  });
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.032);

  updatePlayer(dt);
  updateVehicleGestures();
  updateCamera();
  updateHud();
  renderer.render(scene, camera);
}

function initialize() {
  createWorld();
  createVehicles();
  shopFramework.init();

  player.position.set(0, terrainHeightAt(0, 0) + TERRAIN_HEIGHT_OFFSET, 0);
  player.currentVehicle = 'foot';

  updateCamera();
  animate();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.domElement.addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
});

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= event.movementX * 0.0023;
  player.pitch -= event.movementY * 0.0018;
  player.pitch = clamp(player.pitch, -1.15, 1.1);
});

document.addEventListener('keydown', (event) => {
  keys[event.code] = true;
  if (event.code === 'KeyE') toggleMount();
  if (event.code === 'KeyV') cycleVehicle();
  if (event.code === 'Space' && player.onGround && player.currentVehicle === 'foot') {
    player.velocityY = player.jumpVelocity;
    player.onGround = false;
  }
  if (event.code === 'KeyF') {
    const nearestShop = shopFramework.getNearestShop(player.position);
    if (nearestShop) {
      shopFramework.open(nearestShop);
    }
  }
  if (event.code === 'Escape') {
    shopFramework.close();
  }
  // Consume item with number keys (1-9)
  if (event.code.startsWith('Digit') && !shopFramework.isOpen) {
    const digit = parseInt(event.code.substring(5)) - 1;
    if (digit >= 0 && digit < player.inventory.length) {
      consumeItem(player.inventory[digit]);
    }
  }
});

document.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

initialize();
