import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Expansão visual determinística: não cria recursos coletáveis nem grava dados nos salvamentos.
export async function createExpandedWorld({ THREE, scene, terrainHeight, player, state, registerResource, onToast = () => {}, onSave = () => {} }) {
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

  // Ambientes subterrâneos independentes: o terreno externo e seus salvamentos permanecem intactos.
  const undergroundFloor = -26;
  const areas = {
    cave: { x: 520, z: 0, exitX: -22, exitZ: 0 },
    mine: { x: 720, z: 0, exitX: -22, exitZ: 0 }
  };
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x55574f, roughness: 1 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x514b40, roughness: 1 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x67482e, roughness: .95 });
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x6b9eae, emissive: 0x173c49, emissiveIntensity: .65, roughness: .25 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x766e62, roughness: .82, metalness: .28 });
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x24292b, roughness: .9, metalness: .12 });
  const interiors = {};
  const addRock = (group,x,y,z,size=1) => {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),stoneMat);
    mesh.position.set(x,y,z);
    mesh.scale.set(size*(.8+random()*.45),size*(.7+random()*.5),size*(.8+random()*.45));
    mesh.rotation.set(random()*.5,random()*Math.PI,random()*.5);
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  };
  const addTorch = (group,x,z) => {
    const torch=new THREE.Group();torch.position.set(x,0,z);group.add(torch);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.09,.14,1.7,7),timberMat);
    pole.position.y=.85;torch.add(pole);
    const flame=new THREE.Mesh(new THREE.IcosahedronGeometry(.22,1),new THREE.MeshStandardMaterial({color:0xffa34b,emissive:0xff5b13,emissiveIntensity:2.1}));
    flame.position.y=1.82;torch.add(flame);
    const light=new THREE.PointLight(0xffa45b,2.1,19,2);light.position.y=2.05;torch.add(light);
  };
  const buildInterior = kind => {
    const area=areas[kind],group=new THREE.Group();
    group.position.set(area.x,undergroundFloor,area.z);scene.add(group);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(54,38),floorMat);
    floor.rotation.x=-Math.PI/2;floor.position.y=.02;floor.receiveShadow=true;group.add(floor);
    const roof=new THREE.Mesh(new THREE.SphereGeometry(1,36,22,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0x252b28,roughness:1,side:THREE.BackSide}));
    roof.scale.set(28,15,20);roof.position.set(0,-1.2,0);group.add(roof);
    // Rochas formam paredes irregulares, deixando o túnel de entrada livre.
    for(let x=-25;x<=25;x+=5){addRock(group,x,1.2+random(),-18.2,3.2);addRock(group,x,1.1+random(),18.2,3.2);}
    for(let z=-14;z<=14;z+=4.5){addRock(group,26.2,1.2+random(),z,3.1);if(Math.abs(z)>5.5)addRock(group,-26.2,1.2+random(),z,3.1);}
    // Escoras de madeira no corredor de acesso.
    for(let x=-22;x<=-8;x+=4.5){
      for(const z of [-3.2,3.2]){const post=new THREE.Mesh(new THREE.BoxGeometry(.28,3.5,.28),timberMat);post.position.set(x,1.72,z);group.add(post);}
      const beam=new THREE.Mesh(new THREE.BoxGeometry(.32,.28,6.5),timberMat);beam.position.set(x,3.45,0);group.add(beam);
    }
    if(kind==="cave"){
      addTorch(group,-12,-9);addTorch(group,13,9);
      for(let i=0;i<22;i++){
        const x=-19+random()*38,z=-14+random()*28,length=.8+random()*2.4;
        const spike=new THREE.Mesh(new THREE.ConeGeometry(.35+random()*.55,length,7),stoneMat);
        spike.position.set(x,i%2?length*.48:11.5-length*.48,z);if(i%2)spike.rotation.x=Math.PI;group.add(spike);
      }
      for(const [x,z] of [[-5,-7],[5,5],[16,-8]])for(let i=0;i<4;i++){
        const crystal=new THREE.Mesh(new THREE.ConeGeometry(.32,1.8+random(),5),crystalMat);
        crystal.position.set(x+(random()-.5)*1.1,.85,z+(random()-.5)*1.1);crystal.rotation.z=(random()-.5)*.28;group.add(crystal);
      }
      const pool=new THREE.Mesh(new THREE.CircleGeometry(3.2,36),new THREE.MeshStandardMaterial({color:0x315d66,roughness:.2,transparent:true,opacity:.82}));
      pool.rotation.x=-Math.PI/2;pool.position.set(11,.08,-9);group.add(pool);
      if(rock)for(const [x,z,s] of [[-17,8,1.5],[18,11,1.7],[8,-14,1.25]]){const model=rock.clone(true);model.position.set(x,0,z);model.scale.multiplyScalar(s);group.add(model);}
    }else{
      addTorch(group,-12,-9);addTorch(group,19,-10);
      // Vigas, trilhos e um vagão tornam a mina atravessável e reconhecível.
      for(let x=-17;x<=17;x+=6){
        for(const z of [-3.1,3.1]){const post=new THREE.Mesh(new THREE.BoxGeometry(.34,4.3,.34),timberMat);post.position.set(x,2.05,z);group.add(post);}
        const beam=new THREE.Mesh(new THREE.BoxGeometry(.42,.38,6.6),timberMat);beam.position.set(x,4.15,0);group.add(beam);
      }
      for(const z of [-.82,.82]){const rail=new THREE.Mesh(new THREE.BoxGeometry(37,.16,.16),new THREE.MeshStandardMaterial({color:0x777b78,metalness:.65,roughness:.45}));rail.position.set(0,.18,z);group.add(rail);}
      for(let x=-18;x<=18;x+=2.2){const sleeper=new THREE.Mesh(new THREE.BoxGeometry(.22,.16,2.2),timberMat);sleeper.position.set(x,.1,0);group.add(sleeper);}
      const cart=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(2.8,1.3,2.1),new THREE.MeshStandardMaterial({color:0x57452f,roughness:.9}));
      body.position.y=1.05;cart.add(body);
      for(const x of [-.95,.95])for(const z of [-1,1]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.18,12),ironMat);wheel.rotation.x=Math.PI/2;wheel.position.set(x,.42,z);cart.add(wheel);}
      cart.position.set(8,0,0);group.add(cart);
      // Os veios usam o sistema de recursos existente: picareta, inventário e salvamento.
      for(const [x,z] of [[4,-7],[13,7],[20,-6]]){
        const node=new THREE.Group();node.position.set(x,.35,z);group.add(node);
        for(let i=0;i<7;i++){const shard=new THREE.Mesh(new THREE.DodecahedronGeometry(.35+random()*.42,1),ironMat);shard.position.set((random()-.5)*1.5,random()*.8,(random()-.5)*1.4);shard.scale.y=.75;node.add(shard);}
        registerResource({type:"ironOre",x:area.x+x,z:area.z+z,object:node,active:true});
      }
      for(const [x,z] of [[-2,8],[17,10]]){
        const node=new THREE.Group();node.position.set(x,.3,z);group.add(node);
        for(let i=0;i<6;i++){const shard=new THREE.Mesh(new THREE.DodecahedronGeometry(.3+random()*.38,1),coalMat);shard.position.set((random()-.5)*1.4,random()*.65,(random()-.5)*1.2);node.add(shard);}
        registerResource({type:"coal",x:area.x+x,z:area.z+z,object:node,active:true});
      }
      if(rock)for(const [x,z,s] of [[-18,10,1.5],[22,-12,1.7],[0,-15,1.25]]){const model=rock.clone(true);model.position.set(x,0,z);model.scale.multiplyScalar(s);group.add(model);}
    }
    interiors[kind]=group;
  };
  buildInterior("cave");buildInterior("mine");
  let activeInterior=null,outsidePosition=null,pendingEntrance=null,ignoreEntranceUntil=0;
  const action=document.createElement("button");
  action.type="button";action.textContent="ENTRAR NA CAVERNA";
  action.style.cssText="position:fixed;display:none;z-index:85;left:50%;bottom:calc(205px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);min-width:190px;padding:13px 18px;border:1px solid #e2c47d;border-radius:30px;background:#263b2cf2;color:#fff0cb;font:700 11px Arial,sans-serif;letter-spacing:1px;box-shadow:0 5px 18px #000b;touch-action:manipulation;pointer-events:auto";
  document.body.appendChild(action);
  action.addEventListener("pointerdown",event=>event.stopPropagation());
  action.addEventListener("click",()=>{
    if(activeInterior){
      const saved=outsidePosition;activeInterior=null;outsidePosition=null;ignoreEntranceUntil=Date.now()+1800;
      if(saved){player.position.set(saved.x,terrainHeight(saved.x,saved.z),saved.z);state.cameraYaw=saved.cameraYaw;state.yaw=saved.yaw;player.rotation.y=saved.yaw;}
      state.moveX=0;state.moveY=0;
      const panel=document.getElementById("craftPanel");if(panel)panel.classList.remove("open");
      const toggle=document.getElementById("craftToggle");if(toggle)toggle.disabled=false;
      action.style.display="none";onToast("Você voltou à superfície.");onSave();return;
    }
    if(!pendingEntrance)return;
    const entrance=pendingEntrance;
    outsidePosition={x:player.position.x,z:player.position.z,cameraYaw:state.cameraYaw,yaw:state.yaw};
    activeInterior=entrance.kind;
    const area=areas[entrance.kind];
    player.position.set(area.x+area.exitX,undergroundFloor,area.z+area.exitZ);
    state.cameraYaw=Math.PI/2;state.yaw=0;player.rotation.y=0;state.moveX=0;state.moveY=0;
    const panel=document.getElementById("craftPanel");if(panel)panel.classList.remove("open");
    const toggle=document.getElementById("craftToggle");if(toggle)toggle.disabled=true;
    action.textContent="SAIR DA "+(entrance.kind==="mine"?"MINA":"CAVERNA");action.style.display="block";
    pendingEntrance=null;onToast(entrance.kind==="mine"?"Você entrou na Mina Antiga. Use a picareta nos veios de minério.":"Você entrou na Caverna da Serra. Explore as galerias.");
    onSave();
  });
  const getGroundHeight=()=>activeInterior?undergroundFloor+.04:null;
  const updateUnderground=()=>{
    if(activeInterior){
      const area=areas[activeInterior];
      player.position.x=THREE.MathUtils.clamp(player.position.x,area.x-24.2,area.x+24.2);
      player.position.z=THREE.MathUtils.clamp(player.position.z,area.z-16.2,area.z+16.2);
      const exitDistance=Math.hypot(player.position.x-(area.x+area.exitX),player.position.z-(area.z+area.exitZ));
      action.textContent="SAIR DA "+(activeInterior==="mine"?"MINA":"CAVERNA");
      action.style.display=exitDistance<6.2?"block":"none";pendingEntrance=null;return;
    }
    if(Date.now()<ignoreEntranceUntil){action.style.display="none";pendingEntrance=null;return;}
    let nearest=null,nearestDistance=6.2;
    for(const [kind,entry] of [["cave",{x:142,z:-112}],["mine",{x:166,z:-151}]]){
      const distance=Math.hypot(player.position.x-entry.x,player.position.z-entry.z);
      if(distance<nearestDistance){nearestDistance=distance;nearest={kind};}
    }
    pendingEntrance=nearest;
    if(nearest){action.textContent=nearest.kind==="mine"?"ENTRAR NA MINA":"ENTRAR NA CAVERNA";action.style.display="block";}
    else action.style.display="none";
  };
  const undergroundWorld={
    update:updateUnderground,
    getGroundHeight,
    getSavePosition:()=>activeInterior&&outsidePosition?outsidePosition:player.position,
    isInside:()=>!!activeInterior
  };

  return { regions: 4, river: true, lakes: 2, bridge: true, waterfall: true, cave: true, mine: true, undergroundWorld };
}
