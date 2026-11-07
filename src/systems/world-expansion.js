import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Expansão visual determinística: não cria recursos coletáveis nem grava dados nos salvamentos.
export async function createExpandedWorld({ THREE, scene, terrainHeight }) {
  const loader = new GLTFLoader();
  const load = name => new Promise(resolve => loader.load(
    new URL("../../assets/3d/" + name + ".gltf", import.meta.url).href,
    gltf => resolve(gltf.scene), undefined, () => resolve(null)
  ));
  const [forestTree, mangroveTree, pineTree, tallGrass, fern, rock, bush] = await Promise.all([
    load("CommonTree_1"), load("TwistedTree_1"), load("Pine_1"),
    load("Grass_Wispy_Tall"), load("Fern_1"), load("Rock_Medium_1"), load("Bush_Common")
  ]);
  let seed = 0x71c0ffee;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const addModel = (source, x, z, scale, rotation = random() * Math.PI * 2) => {
    if (!source) return;
    const object = source.clone(true);
    object.position.set(x, terrainHeight(x, z), z);
    object.rotation.y = rotation;
    object.scale.multiplyScalar(scale);
    object.traverse(child => { if (child.isMesh) { child.castShadow = false; child.receiveShadow = true; } });
    scene.add(object);
    return object;
  };
  const mat = (color, roughness = 1, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const waterMat = mat(0x397f88, .24, { metalness: .08, transparent: true, opacity: .78, side: THREE.DoubleSide });
  const wood = mat(0x60452e);
  const darkStone = mat(0x343b37);
  const rockMat = mat(0x77786f);
  const green = mat(0x637a43);
  const regionLabel = (text, x, z) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#263629"; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#c8b27c"; ctx.lineWidth = 7; ctx.strokeRect(5, 5, 502, 118);
    ctx.fillStyle = "#f0e3bd"; ctx.font = "bold 34px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text.toUpperCase(), 256, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshStandardMaterial({ map: texture, transparent: false }));
    board.position.y = 3.4; sign.add(board);
    for (const dx of [-3.4, 3.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 3.5, 6), wood);
      post.position.set(dx, 1.7, 0); sign.add(post);
    }
    sign.position.set(x, terrainHeight(x, z), z);
    scene.add(sign);
  };
  const addPath = points => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x,z]) => new THREE.Vector3(x, 0, z)));
    const samples = curve.getPoints(100), vertices = [], indices = [];
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i], a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
      const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length, nz = dx / length;
      for (const side of [-1, 1]) vertices.push(p.x + nx * side * 1.05, terrainHeight(p.x + nx * side * 1.05, p.z + nz * side * 1.05) + .09, p.z + nz * side * 1.05);
      if (i < samples.length - 1) { const n = i * 2; indices.push(n,n+1,n+2,n+1,n+3,n+2); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, mat(0x806b4d)); mesh.receiveShadow = true; scene.add(mesh);
  };
  const riverPoints = [];
  for (let i = 0; i <= 80; i++) {
    const z = -190 + i * 4.75;
    riverPoints.push([112 + 14 * Math.sin((z + 190) * .009), z]);
  }
  const riverCurve = new THREE.CatmullRomCurve3(riverPoints.map(([x,z]) => new THREE.Vector3(x, 0, z)));
  const riverSamples = riverCurve.getPoints(320), riverVertices = [], riverIndices = [];
  for (let i = 0; i < riverSamples.length; i++) {
    const p = riverSamples[i], before = riverSamples[Math.max(0, i - 1)], after = riverSamples[Math.min(riverSamples.length - 1, i + 1)];
    const dx = after.x - before.x, dz = after.z - before.z, length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length, nz = dx / length;
    for (const side of [-1, 0, 1]) {
      const x = p.x + nx * side * 3.1, z = p.z + nz * side * 3.1;
      riverVertices.push(x, terrainHeight(x, z) + .34, z);
    }
    if (i < riverSamples.length - 1) for (let row = 0; row < 2; row++) {
      const a = i * 3 + row, b = (i + 1) * 3 + row;
      riverIndices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const riverGeometry = new THREE.BufferGeometry();
  riverGeometry.setAttribute("position", new THREE.Float32BufferAttribute(riverVertices, 3));
  riverGeometry.setIndex(riverIndices); riverGeometry.computeVertexNormals();
  const river = new THREE.Mesh(riverGeometry, waterMat); river.receiveShadow = true; scene.add(river);

  // Lagos encaixados em depressões do terreno externo.
  for (const [x,z,radius] of [[-118,-104,13.5],[82,126,12]]) {
    const lake = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), waterMat);
    lake.rotation.x = -Math.PI / 2; lake.position.set(x, terrainHeight(x,z) + 1.55, z); scene.add(lake);
    for (let i = 0; i < 18; i++) {
      const angle = i * Math.PI * 2 / 18, r = radius + .8 + random() * 1.8;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(.55 + random() * .55, 0), rockMat);
      stone.position.set(x + Math.cos(angle) * r, terrainHeight(x + Math.cos(angle) * r, z + Math.sin(angle) * r) + .12, z + Math.sin(angle) * r);
      stone.scale.y = .55; stone.castShadow = true; scene.add(stone);
    }
  }

  // Floresta antiga e pradarias abertas.
  for (let i = 0; i < 28; i++) {
    const angle = random() * Math.PI * 2, radius = 16 + Math.sqrt(random()) * 36;
    addModel(forestTree, -132 + Math.cos(angle) * radius, -125 + Math.sin(angle) * radius, .78 + random() * .48);
  }
  for (let i = 0; i < 34; i++) {
    const x = -150 + (random() - .5) * 76, z = 112 + (random() - .5) * 72;
    addModel(tallGrass, x, z, .55 + random() * .55);
    if (i % 3 === 0) addModel(bush, x + 1.4, z - 1.2, .42 + random() * .25);
  }

  // Manguezal: árvores retorcidas, raízes aéreas e vegetação baixa em solo úmido.
  for (let i = 0; i < 18; i++) {
    const angle = random() * Math.PI * 2, radius = 8 + Math.sqrt(random()) * 30;
    const x = 151 + Math.cos(angle) * radius, z = 48 + Math.sin(angle) * radius;
    const tree = addModel(mangroveTree, x, z, .75 + random() * .42);
    if (tree) for (let root = 0; root < 4; root++) {
      const a = root * Math.PI / 2 + random() * .35;
      const length = 1.1 + random() * .9;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(.045, .13, length, 5), wood);
      branch.position.set(Math.cos(a) * length * .38, .28, Math.sin(a) * length * .38);
      branch.rotation.z = Math.cos(a) * .62; branch.rotation.x = Math.sin(a) * .62;
      tree.add(branch);
    }
  }
  for (let i = 0; i < 26; i++) {
    const x = 130 + random() * 42, z = 20 + random() * 58;
    addModel(fern, x, z, .48 + random() * .42);
  }

  // Região montanhosa com pinheiros e afloramentos rochosos.
  for (let i = 0; i < 23; i++) {
    const angle = random() * Math.PI * 2, radius = 10 + Math.sqrt(random()) * 43;
    const x = 151 + Math.cos(angle) * radius, z = -128 + Math.sin(angle) * radius;
    addModel(i % 3 === 0 ? forestTree : pineTree, x, z, .68 + random() * .62);
    if (i % 2 === 0) addModel(rock, x + 2.2, z - 1.1, .5 + random() * .5);
  }

  // Ponte de madeira sobre o rio, com pilares e corrimãos.
  const bridgeX = 112 + 14 * Math.sin((42 + 190) * .009), bridgeZ = 42;
  const bridgeY = terrainHeight(bridgeX, bridgeZ) + 1.15;
  const bridge = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(13, .38, 4.4), wood);
  deck.position.y = 0; deck.castShadow = true; deck.receiveShadow = true; bridge.add(deck);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(13, .18, .18), wood); rail.position.set(0, .82, side * 2.05); bridge.add(rail);
    for (let i = -5; i <= 5; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.22, .95, .22), wood);
      post.position.set(i * 1.15, .42, side * 2.05); bridge.add(post);
    }
  }
  for (const side of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(.8, 2.3, 1), rockMat);
    pier.position.set(side * 4.6, -1.05, 0); bridge.add(pier);
  }
  bridge.position.set(bridgeX, bridgeY, bridgeZ); scene.add(bridge);
  addPath([[58,31],[76,34],[93,38],[bridgeX - 7,bridgeZ],[bridgeX + 7,bridgeZ],[139,52],[151,48]]);

  // Queda d'água no sopé da serra.
  const fallX = 112 + 14 * Math.sin((-55 + 190) * .009), fallZ = -55;
  const waterfall = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 6.5), waterMat);
  waterfall.position.set(fallX, terrainHeight(fallX, fallZ) + 3.2, fallZ);
  waterfall.rotation.y = .08; scene.add(waterfall);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(5.2, 40), waterMat);
  pool.rotation.x = -Math.PI / 2; pool.position.set(fallX, terrainHeight(fallX, fallZ) + .28, fallZ + 5.5); scene.add(pool);

  // Entradas de caverna e mina na encosta: rocha, arco de madeira e trilhos curtos.
  const addEntrance = (x, z, mine = false) => {
    const group = new THREE.Group();
    const arch = new THREE.Mesh(new THREE.TorusGeometry(mine ? 2.35 : 2.7, .62, 7, 14, Math.PI), rockMat);
    arch.position.y = 2.35; group.add(arch);
    const opening = new THREE.Mesh(new THREE.CircleGeometry(mine ? 1.9 : 2.2, 24), darkStone);
    opening.position.set(0, 1.55, .12); group.add(opening);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.24, 3.3, .28), wood);
      post.position.set(side * 2.05, 1.55, .2); group.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(4.5, .28, .3), wood);
    beam.position.set(0, 3.05, .2); group.add(beam);
    if (mine) {
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, 7), wood);
        rail.position.set(side * .72, .12, 3.3); group.add(rail);
      }
      for (let i = 0; i < 5; i++) {
        const sleeper = new THREE.Mesh(new THREE.BoxGeometry(1.8, .12, .22), wood);
        sleeper.position.set(0, .08, i * 1.5); group.add(sleeper);
      }
    }
    group.position.set(x, terrainHeight(x,z), z); group.rotation.y = Math.PI; scene.add(group);
    for (let i = 0; i < 10; i++) {
      const a = random() * Math.PI * 2, r = 3.3 + random() * 3.4;
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(.7 + random() * 1.1, 1), rockMat);
      boulder.position.set(x + Math.cos(a) * r, terrainHeight(x + Math.cos(a) * r, z + Math.sin(a) * r) + .35, z + Math.sin(a) * r);
      boulder.scale.y = .7; boulder.castShadow = true; scene.add(boulder);
    }
  };
  addEntrance(142, -112, false);
  addEntrance(166, -151, true);

  regionLabel("Bosque Antigo", -132, -174);
  regionLabel("Pradarias do Oeste", -151, 151);
  regionLabel("Manguezal das Águas", 151, 91);
  regionLabel("Serra das Cavernas", 165, -184);
  return { regions: 4, river: true, lakes: 2, bridge: true, waterfall: true, cave: true, mine: true };
}
