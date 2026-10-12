const WORLD_SIZE = 3200;
const HALF_WORLD = WORLD_SIZE / 2;
const TERRAIN_Y_OFFSET = 1.4;

const container = document.getElementById('game-container');
const speedHud = document.getElementById('speed-meter');
const vehicleHud = document.getElementById('vehicle-type');
const positionHud = document.getElementById('position');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8cc8ff);
scene.fog = new THREE.Fog(0x8cc8ff, 350, 3000);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 8000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const keys = {};

const world = {
    vehicles: [],
    buildings: [],
    trees: [],
    markers: [],
    roadMeshes: [],
    railMeshes: []
};

const player = {
    position: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    pitch: -0.42,
    velocityY: 0,
    onGround: true,
    moveSpeed: 18,
    sprintSpeed: 35,
    currentVehicle: 'foot',
    mountedVehicle: null,
    lastGroundHeight: 0,
    jumpVelocity: 15
};

const vehicleCatalog = ['foot', 'horse', 'wagon', 'buggy', 'stagecoach', 'cart'];
const vehicleSpeedMap = {
    foot: 18,
    horse: 42,
    wagon: 30,
    buggy: 46,
    stagecoach: 35,
    cart: 26
};

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function terrainHeightAt(x, z) {
    const mountainNorth = z > 620 && x > 120 ? (z - 620) * 0.25 + 32 : 0;
    const mountainEast = x > 1100 && z > 200 ? (x - 1100) * 0.18 + 20 : 0;
    const forestRidge = x > 750 ? Math.sin(x * 0.008) * 18 : 0;
    const plainLow = x > -600 && x < 600 && z > -500 && z < 500 ? -6 : 0;
    const desertDune = x < -700 && z < -100 ? Math.sin(x * 0.01 + z * 0.008) * 18 + 10 : 0;
    const canyonDepth = x > 700 && z < -850 ? (Math.sin(x * 0.01) * 15) - 12 : 0;
    const mineSlope = x < -850 && z > 200 && z < 700 ? Math.cos(x * 0.006) * 12 + 8 : 0;
    const riverBank = Math.abs(z) < 50 && x > -250 && x < 250 ? -14 : 0;

    return (
        Math.sin(x * 0.008) * 20 +
        Math.cos(z * 0.007) * 15 +
        Math.sin((x + z) * 0.006) * 10 +
        mountainNorth +
        mountainEast +
        forestRidge +
        plainLow +
        desertDune +
        canyonDepth +
        mineSlope +
        riverBank
    );
}

function terrainColorAt(x, z, y) {
    const roadBias = Math.abs(z) < 130 && Math.abs(x) < 220 ? 12 : 0;
    const greenForest = x > 700 ? 0.35 : 0;
    const desertSand = x < -700 && z < -100 ? 0.8 : 0;
    const mountain = z > 700 && x > 100 ? 0.25 : 0;
    const riverValley = Math.abs(z) < 60 && x > -250 && x < 250 ? -0.3 : 0;

    let r = 0.16 + greenForest + mountain * 0.15;
    let g = 0.28 + greenForest * 1.15 + mountain * 0.2 + desertSand * 0.1;
    let b = 0.15 + desertSand * 0.9 + riverValley * 0.35;

    if (y < -6) {
        r = 0.12; g = 0.4; b = 0.52;
    }

    if (x < -700 && z < -200) {
        r = 0.85; g = 0.7; b = 0.38;
    }

    if (z > 700 && x > 100) {
        r = 0.38; g = 0.42; b = 0.42;
    }

    if (Math.abs(z) < 90 && Math.abs(x) < 260) {
        r = 0.32; g = 0.31; b = 0.27;
    }

    if (roadBias > 0) {
        r = 0.30; g = 0.30; b = 0.30;
    }

    return new THREE.Color(r, g, b);
}

function createTerrain() {
    const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 220, 220);
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.attributes.position;
    const colors = [];

    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const z = position.getY(i);
        const y = terrainHeightAt(x, z);
        position.setZ(i, y);

        const color = terrainColorAt(x, z, y);
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        metalness: 0.03,
        flatShading: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
}

function createLightRig() {
    const hemi = new THREE.HemisphereLight(0xe8f3ff, 0x3d2c1a, 1.1);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2c2, 1.4);
    sun.position.set(500, 780, 300);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -1200;
    sun.shadow.camera.right = 1200;
    sun.shadow.camera.top = 1200;
    sun.shadow.camera.bottom = -1200;
    scene.add(sun);

    const sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(60, 30, 30),
        new THREE.MeshBasicMaterial({ color: 0xfff4bb })
    );
    sunMesh.position.set(700, 1000, 400);
    scene.add(sunMesh);
}

function createRiver() {
    const points = [
        new THREE.Vector3(-1450, 0, -200),
        new THREE.Vector3(-900, 0, 50),
        new THREE.Vector3(-300, 0, 140),
        new THREE.Vector3(260, 0, 220),
        new THREE.Vector3(820, 0, 220),
        new THREE.Vector3(1200, 0, 250),
        new THREE.Vector3(1500, 0, 350)
    ];

    for (let i = 0; i < points.length; i++) {
        points[i].y = terrainHeightAt(points[i].x, points[i].z) - 1.5;
    }

    const riverCurve = new THREE.CatmullRomCurve3(points);
    const riverGeometry = new THREE.TubeGeometry(riverCurve, 120, 18, 18, false);
    const riverMaterial = new THREE.MeshStandardMaterial({
        color: 0x2f7dc3,
        roughness: 0.5,
        metalness: 0.1,
        emissive: 0x1d3a62,
        emissiveIntensity: 0.25
    });

    const river = new THREE.Mesh(riverGeometry, riverMaterial);
    river.castShadow = false;
    river.receiveShadow = true;
    scene.add(river);

    const bridgeMaterial = new THREE.MeshStandardMaterial({ color: 0x7b5634, roughness: 0.9 });
    const bridgeSpans = [
        [-400, 100],
        [0, 180],
        [500, 210]
    ];

    bridgeSpans.forEach(([x, z]) => {
        const span = new THREE.Mesh(new THREE.BoxGeometry(180, 12, 28), bridgeMaterial);
        span.position.set(x, terrainHeightAt(x, z) + 10, z);
        span.rotation.y = 0.2;
        scene.add(span);
    });
}

function createRoad(start, end, width = 16) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    const road = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.5, length),
        new THREE.MeshStandardMaterial({ color: 0x4f3d2d, roughness: 0.9 })
    );

    const midX = (start.x + end.x) / 2;
    const midZ = (start.z + end.z) / 2;
    road.position.set(midX, terrainHeightAt(midX, midZ) + 0.4, midZ);
    road.rotation.y = Math.atan2(dx, dz);
    road.receiveShadow = true;
    scene.add(road);
    world.roadMeshes.push(road);
}

function createRail(start, end) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    const rail = new THREE.Group();

    const sleeperMaterial = new THREE.MeshStandardMaterial({ color: 0x513d29, roughness: 0.85 });
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, metalness: 0.9, roughness: 0.5 });

    for (let i = -2; i <= 2; i++) {
        const sleeper = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 18), sleeperMaterial);
        sleeper.position.set(0, 0.7, i * 26);
        rail.add(sleeper);
    }

    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.8, 1.5), railMaterial);
    const rightRail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.8, 1.5), railMaterial);
    leftRail.position.set(0, 1.4, -1.8);
    rightRail.position.set(0, 1.4, 1.8);
    rail.add(leftRail, rightRail);

    const midX = (start.x + end.x) / 2;
    const midZ = (start.z + end.z) / 2;
    rail.position.set(midX, terrainHeightAt(midX, midZ) + 0.5, midZ);
    rail.rotation.y = Math.atan2(dx, dz);
    rail.scale.set(1, 1, 1);
    scene.add(rail);
    world.railMeshes.push(rail);
}

function createTown() {
    const centerX = 0;
    const centerZ = 0;
    const buildingColors = [0x8b5b3c, 0xb59472, 0x82654d, 0x734921, 0x6d5b48];

    for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        const radius = 110 + (i % 5) * 18;
        const x = centerX + Math.cos(angle) * radius;
        const z = centerZ + Math.sin(angle) * radius;
        const height = 24 + (i % 4) * 10;

        const building = new THREE.Mesh(
            new THREE.BoxGeometry(18, height, 18),
            new THREE.MeshStandardMaterial({
                color: buildingColors[i % buildingColors.length],
                roughness: 0.85,
                metalness: 0.1
            })
        );

        building.position.set(x, terrainHeightAt(x, z) + height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        world.buildings.push(building);
    }

    const saloon = new THREE.Mesh(
        new THREE.BoxGeometry(52, 34, 42),
        new THREE.MeshStandardMaterial({ color: 0x79614b, roughness: 0.9 })
    );
    saloon.position.set(0, terrainHeightAt(0, 0) + 17, 0);
    saloon.castShadow = true;
    scene.add(saloon);

    const church = new THREE.Mesh(
        new THREE.BoxGeometry(28, 42, 28),
        new THREE.MeshStandardMaterial({ color: 0xe5ded1, roughness: 0.8 })
    );
    church.position.set(-80, terrainHeightAt(-80, 0) + 21, -30);
    church.castShadow = true;
    scene.add(church);

    const stable = new THREE.Mesh(
        new THREE.BoxGeometry(42, 20, 24),
        new THREE.MeshStandardMaterial({ color: 0x8a6239, roughness: 0.9 })
    );
    stable.position.set(90, terrainHeightAt(90, 20) + 10, 60);
    stable.castShadow = true;
    scene.add(stable);
}

function createSettlement(x, z, name, colorHex) {
    const marker = new THREE.Group();

    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(28, 30, 10, 16),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.9 })
    );
    base.position.y = terrainHeightAt(x, z) + 5;
    base.castShadow = true;
    base.receiveShadow = true;
    marker.add(base);

    const top = new THREE.Mesh(
        new THREE.ConeGeometry(16, 24, 16),
        new THREE.MeshStandardMaterial({ color: 0xf3d07e, roughness: 0.8 })
    );
    top.position.y = terrainHeightAt(x, z) + 22;
    marker.add(top);

    marker.position.set(x, 0, z);
    scene.add(marker);
    world.markers.push({ name, x, z, marker });
}

function createTrees() {
    const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x2b6b3c, roughness: 0.9 });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4f3221, roughness: 0.9 });

    for (let i = 0; i < 240; i++) {
        const x = -1400 + Math.random() * 3000;
        const z = 700 + Math.random() * 1200;
        if (x < -900 && z < 1500) continue;

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 18, 10), trunkMaterial);
        trunk.position.set(x, terrainHeightAt(x, z) + 9, z);
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        scene.add(trunk);

        const leaves = new THREE.Mesh(new THREE.ConeGeometry(10, 22, 12), treeMaterial);
        leaves.position.set(x, terrainHeightAt(x, z) + 28, z);
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        scene.add(leaves);
    }
}

function createRockyMountains() {
    for (let i = 0; i < 30; i++) {
        const x = 400 + Math.random() * 1200;
        const z = 780 + Math.random() * 700;
        const radius = 20 + Math.random() * 80;

        const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(radius, 0),
            new THREE.MeshStandardMaterial({ color: 0x7a7d83, roughness: 1 })
        );
        rock.position.set(x, terrainHeightAt(x, z) + 50, z);
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
    }
}

function createCanyon() {
    const canyonMaterial = new THREE.MeshStandardMaterial({ color: 0x81624c, roughness: 1 });
    for (let i = 0; i < 12; i++) {
        const x = 830 + Math.random() * 360;
        const z = -980 + Math.random() * 260;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(90, 52, 70), canyonMaterial);
        wall.position.set(x, terrainHeightAt(x, z) + 26, z);
        wall.rotation.y = Math.random() * Math.PI;
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
    }
}

function createMineSite() {
    const mine = new THREE.Mesh(
        new THREE.CylinderGeometry(40, 50, 60, 18),
        new THREE.MeshStandardMaterial({ color: 0x5d5d5d, roughness: 0.9 })
    );
    mine.position.set(-980, terrainHeightAt(-980, 420) + 30, 420);
    mine.castShadow = true;
    mine.receiveShadow = true;
    scene.add(mine);
}

function createWorld() {
    createTerrain();
    createLightRig();
    createRiver();

    createRoad(new THREE.Vector3(-1400, 0, -250), new THREE.Vector3(-300, 0, 0), 18);
    createRoad(new THREE.Vector3(-300, 0, 0), new THREE.Vector3(450, 0, 80), 18);
    createRoad(new THREE.Vector3(450, 0, 80), new THREE.Vector3(1200, 0, 200), 18);
    createRoad(new THREE.Vector3(-200, 0, 250), new THREE.Vector3(550, 0, -700), 15);
    createRoad(new THREE.Vector3(-900, 0, 420), new THREE.Vector3(-1100, 0, -800), 14);

    createRail(new THREE.Vector3(-1200, 0, 120), new THREE.Vector3(1200, 0, 260));
    createRail(new THREE.Vector3(-150, 0, -650), new THREE.Vector3(1100, 0, -1100));

    createTown();
    createSettlement(-980, 420, 'Mining Camp', 0x8d6952);
    createSettlement(-1100, -820, 'Desert Town', 0xcf9d57);
    createSettlement(840, -360, 'Ranch', 0x8ac26d);
    createSettlement(1150, 240, 'Forest Post', 0x4d7d52);
    createSettlement(350, -980, 'Outlaw Camp', 0x8a5a47);
    createSettlement(980, -1180, 'Canyon Lookout', 0xb5895a);

    createTrees();
    createRockyMountains();
    createCanyon();
    createMineSite();
}

function buildHorse() {
    const horse = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x7e4f2a, roughness: 0.8 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2518, roughness: 0.9 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 8), bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    horse.add(body);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(6, 7, 4), bodyMaterial);
    neck.position.set(11, 6.5, 0);
    neck.castShadow = true;
    horse.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 5), darkMaterial);
    head.position.set(16, 8.5, 0);
    head.castShadow = true;
    horse.add(head);

    for (let i = -1; i <= 1; i += 2) {
        for (let j = -1; j <= 1; j += 2) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(2.2, 11, 2.3), darkMaterial);
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
    const group = new THREE.Group();
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x9a3b2a, roughness: 0.7 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x272b31, roughness: 0.8 });

    if (type === 'horse') {
        const horse = buildHorse();
        horse.position.set(x, terrainHeightAt(x, z) + 5, z);
        return { type, mesh: horse, speed: vehicleSpeedMap.horse, mountOffsetY: 8 };
    }

    const baseBody = new THREE.Mesh(new THREE.BoxGeometry(24, 8, 14), bodyMaterial);
    baseBody.castShadow = true;
    baseBody.receiveShadow = true;
    group.add(baseBody);

    if (type === 'wagon' || type === 'stagecoach' || type === 'cart') {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 12), accentMaterial);
        roof.position.set(0, 8, 0);
        group.add(roof);
    }

    if (type === 'buggy') {
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 10), accentMaterial);
        cabin.position.set(1, 8, 0);
        group.add(cabin);
    }

    const clearColor = type === 'cart' ? 0x7a5a39 : (type === 'stagecoach' ? 0xb67b3f : 0x6e6d73);
    const accent = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 10), new THREE.MeshStandardMaterial({ color: clearColor, roughness: 0.8 }));
    accent.position.set(-5, 10, 0);
    group.add(accent);

    const wheelPositions = [
        [-8, 0, -7], [8, 0, -7],
        [-8, 0, 7], [8, 0, 7]
    ];

    wheelPositions.forEach(([px, py, pz]) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 2.4, 18), wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(px, py, pz);
        wheel.castShadow = true;
        group.add(wheel);
    });

    group.position.set(x, terrainHeightAt(x, z) + 5, z);
    group.rotation.y = Math.PI * 0.3;
    scene.add(group);

    return {
        type,
        mesh: group,
        speed: vehicleSpeedMap[type],
        mountOffsetY: 7
    };
}

function createVehicles() {
    const spawnData = [
        { type: 'horse', x: 55, z: 15 },
        { type: 'wagon', x: 120, z: -80 },
        { type: 'buggy', x: -120, z: -60 },
        { type: 'stagecoach', x: 200, z: 100 },
        { type: 'cart', x: -170, z: 120 }
    ];

    spawnData.forEach(({ type, x, z }) => {
        world.vehicles.push(buildVehicle(type, x, z));
    });
}

function updateVehicleAnimations(dt) {
    world.vehicles.forEach((vehicle) => {
        if (!vehicle.mesh) return;
        if (vehicle.type === 'horse') {
            const legs = vehicle.mesh.children.filter((child) => child.geometry && child.geometry.type === 'BoxGeometry' && child.position.y < 0);
            legs.forEach((leg, index) => {
                leg.rotation.x = Math.sin((performance.now() * 0.01) + index) * 0.18;
            });
        }

        if (vehicle.type === 'buggy' || vehicle.type === 'wagon' || vehicle.type === 'stagecoach' || vehicle.type === 'cart') {
            vehicle.mesh.rotation.y += Math.sin(performance.now() * 0.001) * 0.0008;
        }
    });
}

function setVehicle(type) {
    const existing = world.vehicles.find((v) => v.type === type);
    if (existing) {
        player.currentVehicle = type;
        player.mountedVehicle = existing;
        player.position.set(existing.mesh.position.x, existing.mesh.position.y + 5, existing.mesh.position.z);
        player.onGround = true;
        return;
    }

    const newVehicle = buildVehicle(type, player.position.x + 40, player.position.z + 20);
    world.vehicles.push(newVehicle);
    player.currentVehicle = type;
    player.mountedVehicle = newVehicle;
}

function toggleMount() {
    if (player.currentVehicle === 'foot') {
        let nearest = null;
        let nearestDist = 40;

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
        player.position.y = terrainHeightAt(player.position.x, player.position.z) + 5;
        player.velocityY = 0;
    }
}

function cycleVehicle() {
    const currentIndex = vehicleCatalog.indexOf(player.currentVehicle);
    const nextIndex = (currentIndex + 1) % vehicleCatalog.length;
    const nextType = vehicleCatalog[nextIndex];

    if (nextType === 'foot') {
        player.currentVehicle = 'foot';
        player.mountedVehicle = null;
        player.position.y = terrainHeightAt(player.position.x, player.position.z) + 5;
        return;
    }

    setVehicle(nextType);
}

function updatePlayer(dt) {
    const moveX = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
    const moveZ = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);

    const isMoving = moveX !== 0 || moveZ !== 0;
    const moveVector = new THREE.Vector3(moveX, 0, moveZ);

    if (isMoving) {
        moveVector.normalize();
        const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
        const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
        const moveDir = new THREE.Vector3();
        moveDir.addScaledVector(forward, moveVector.z);
        moveDir.addScaledVector(right, moveVector.x);
        moveDir.normalize();

        let speed = player.currentVehicle === 'foot' ? (keys['ShiftLeft'] || keys['ShiftRight'] ? player.sprintSpeed : player.moveSpeed) : vehicleSpeedMap[player.currentVehicle];
        if (player.currentVehicle === 'foot' && (keys['Space'] && player.onGround)) {
            player.velocityY = player.jumpVelocity;
            player.onGround = false;
        }

        const step = new THREE.Vector3(moveDir.x * speed * dt, 0, moveDir.z * speed * dt);
        if (player.mountedVehicle) {
            const target = player.mountedVehicle.mesh;
            target.position.x += step.x;
            target.position.z += step.z;
            target.rotation.y = Math.atan2(moveDir.x, moveDir.z);
            target.position.y = terrainHeightAt(target.position.x, target.position.z) + 4.5;
            player.position.set(target.position.x, target.position.y + 5.5, target.position.z);
        } else {
            player.position.x += step.x;
            player.position.z += step.z;
        }
    }

    player.velocityY -= 28 * dt;
    const groundY = terrainHeightAt(player.position.x, player.position.z) + TERRAIN_Y_OFFSET;

    if (player.mountedVehicle) {
        player.position.y = player.mountedVehicle.mesh.position.y + 5.2;
        player.onGround = true;
    } else {
        player.position.y += player.velocityY * dt;
        if (player.position.y <= groundY) {
            player.position.y = groundY;
            player.velocityY = 0;
            player.onGround = true;
        } else {
            player.onGround = false;
        }
    }

    if (player.position.x < -HALF_WORLD) player.position.x = -HALF_WORLD;
    if (player.position.x > HALF_WORLD) player.position.x = HALF_WORLD;
    if (player.position.z < -HALF_WORLD) player.position.z = -HALF_WORLD;
    if (player.position.z > HALF_WORLD) player.position.z = HALF_WORLD;
}

function updateCamera() {
    const cameraDistance = 9;
    const lookAt = new THREE.Vector3(
        player.position.x + Math.sin(player.yaw) * 12,
        player.position.y + 4.8,
        player.position.z + Math.cos(player.yaw) * 12
    );

    const camX = player.position.x + Math.sin(player.yaw) * cameraDistance * Math.cos(player.pitch);
    const camY = player.position.y + 4.5 + Math.sin(player.pitch) * cameraDistance;
    const camZ = player.position.z + Math.cos(player.yaw) * cameraDistance * Math.cos(player.pitch);

    camera.position.set(camX, camY, camZ);
    camera.lookAt(lookAt);
}

function updateHud() {
    const speed = player.mountedVehicle
        ? vehicleSpeedMap[player.currentVehicle]
        : (keys['ShiftLeft'] || keys['ShiftRight'] ? player.sprintSpeed : player.moveSpeed);

    speedHud.textContent = `Speed: ${Math.round(speed * 1.8)} km/h`;
    vehicleHud.textContent = player.currentVehicle === 'foot' ? 'On Foot' : player.currentVehicle.charAt(0).toUpperCase() + player.currentVehicle.slice(1);
    positionHud.textContent = `X: ${Math.round(player.position.x)} Z: ${Math.round(player.position.z)}`;
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.032);

    updatePlayer(dt);
    updateVehicleAnimations(dt);
    updateCamera();
    updateHud();

    renderer.render(scene, camera);
}

function initialize() {
    scene.add(new THREE.AxesHelper(50));
    createWorld();
    createVehicles();

    player.position.set(0, terrainHeightAt(0, 0) + TERRAIN_Y_OFFSET, 0);
    player.mountedVehicle = null;
    player.currentVehicle = 'foot';

    updateCamera();
    animate();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== renderer.domElement) {
        // allow click to lock again
    }
});

renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});

document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    player.yaw -= event.movementX * 0.0023;
    player.pitch -= event.movementY * 0.0018;
    player.pitch = clamp(player.pitch, -1.2, 1.1);
});

document.addEventListener('keydown', (event) => {
    keys[event.code] = true;
    if (event.code === 'KeyE') toggleMount();
    if (event.code === 'KeyV') cycleVehicle();
    if (event.code === 'Space' && player.onGround && player.currentVehicle === 'foot') {
        player.velocityY = player.jumpVelocity;
        player.onGround = false;
    }
});

document.addEventListener('keyup', (event) => {
    keys[event.code] = false;
});

initialize();
