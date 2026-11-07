import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

const SAVE_KEY = "cronicas-floresta-distant-villages-v1";

// Moradores independentes das três pessoas do acampamento inicial.
// Seus dados são aditivos e ficam em uma chave separada para proteger os salvamentos antigos.
export function createDistantVillageResidents({ THREE, scene, player, terrainHeight, state, onToast, economy }) {
  const loader = new GLTFLoader();
  const towns = [
    {
      id: "vale", name: "Vila da Pradaria", x: -150, z: 112,
      residents: [
        { id: "vale-ana", name: "Ana", role: "Agricultora", model: "Worker_Female.gltf", color: 0x788d55, home: [-8, -7], work: [[-13, 11], [-10, 13]], greeting: "Cuido das hortas da Vila da Pradaria. Os campos abertos ajudam nossas plantações." },
        { id: "vale-bento", name: "Bento", role: "Lenhador", model: "Worker_Male.gltf", color: 0x79583b, home: [8, -7], work: [[19, -9], [22, -13]], greeting: "Trabalho na mata próxima e preparo madeira para as construções." },
        { id: "vale-marta", name: "Marta", role: "Comerciante", model: "Casual_Female.gltf", color: 0x8b6d91, home: [-8, 8], work: [[0, 3], [3, 4]], greeting: "Mantenho o mercado da pradaria e recebo viajantes." }
      ]
    },
    {
      id: "colina", name: "Vila do Norte", x: 151, z: -128,
      residents: [
        { id: "colina-joana", name: "Joana", role: "Pastora", model: "Worker_Female.gltf", color: 0x9a8051, home: [-7, -7], work: [[-17, 1], [-18, 5]], greeting: "Sou pastora. Conheço os pastos frios e as encostas do Norte." },
        { id: "colina-gil", name: "Gil", role: "Caçador", model: "Cowboy_Male.gltf", color: 0x7a5940, home: [7, -7], work: [[-19, -11], [-23, -15]], greeting: "Conheço as trilhas entre os pinheiros e as rochas." },
        { id: "colina-rute", name: "Rute", role: "Mercadora", model: "Casual2_Female.gltf", color: 0x826b9b, home: [7, 8], work: [[0, 3], [3, 4]], greeting: "Levo mercadorias e notícias pelas rotas do Norte." }
      ]
    },
    {
      id: "mangue", name: "Vila do Mangue", x: 151, z: 48,
      residents: [
        { id: "mangue-lia", name: "Lia", role: "Pescadora", model: "Worker_Female.gltf", color: 0x658b83, home: [-8, -7], work: [[-13, 11], [-10, 13]], greeting: "Vivo entre as águas e as raízes do mangue. Pesco e recolho alimentos." },
        { id: "mangue-tom", name: "Tom", role: "Coletor", model: "Worker_Male.gltf", color: 0x8b7449, home: [8, -7], work: [[19, -9], [22, -13]], greeting: "Recolho fibras, madeira úmida e materiais úteis nas margens." },
        { id: "mangue-iris", name: "Íris", role: "Comerciante", model: "Casual_Female.gltf", color: 0x718a9b, home: [-8, 8], work: [[0, 3], [3, 4]], greeting: "Meu pequeno mercado atende pescadores e viajantes." }
      ]
    },
    {
      id: "oeste", name: "Vila do Oeste", x: -132, z: -125,
      residents: [
        { id: "oeste-cael", name: "Cael", role: "Lenhador", model: "Worker_Male.gltf", color: 0x76513a, home: [-8, -7], work: [[-13, 11], [-10, 13]], greeting: "Trabalho na fronteira oeste, cortando madeira para a vila." },
        { id: "oeste-ena", name: "Ena", role: "Artesã", model: "Worker_Female.gltf", color: 0x8c6c86, home: [8, -7], work: [[19, -9], [22, -13]], greeting: "Transformo os materiais da floresta em ferramentas e utensílios." },
        { id: "oeste-raul", name: "Raul", role: "Comerciante", model: "Casual2_Male.gltf", color: 0x8b805c, home: [-8, 8], work: [[0, 3], [3, 4]], greeting: "Mantenho a rota comercial que liga o Oeste às outras comunidades." }
      ]
    }
  ];

  let saved = {};
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (raw && typeof raw === "object") saved = raw;
  } catch (error) {
    console.warn("Salvamento dos moradores das povoações indisponível.", error);
  }
  const savedMet = saved.met && typeof saved.met === "object" ? saved.met : {};
  const savedResidents = saved.residents && typeof saved.residents === "object" ? saved.residents : {};
  const savedRecruits = Array.isArray(saved.recruits) ? saved.recruits : [];
  for (const recruit of savedRecruits) { const town = towns.find(item => item.id === recruit.townId); if (town && recruit.id && !town.residents.some(item => item.id === recruit.id)) town.residents.push({ ...recruit, model: recruit.model || "Worker_Male.gltf", greeting: recruit.greeting || "Sou um novo morador desta comunidade.", isRecruit: true }); }
  const residents = [];
  const townMaterials = {
    wood: new THREE.MeshStandardMaterial({ color: 0x62452e, roughness: 1 }),
    woodLight: new THREE.MeshStandardMaterial({ color: 0x89633e, roughness: 1 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x59452e, roughness: 1 }),
    crop: new THREE.MeshStandardMaterial({ color: 0x87994d, roughness: 1 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x9a7548, roughness: 1 })
  };

  function save() {
    try {
      const met = {};
      const residentData = {};
      for (const resident of residents) {
        met[resident.id] = !!resident.met;
        residentData[resident.id] = { needs: resident.needs, mood: resident.mood, trust: resident.trust, lastSimHour: resident.lastSimHour, lastSocialDay: resident.lastSocialDay, workHours: resident.workHours, role: resident.role, work: resident.work };
      }
      const recruits = residents.filter(resident => resident.isRecruit).map(resident => ({ id: resident.id, name: resident.name, role: resident.role, model: resident.model, color: resident.color, home: resident.home, work: resident.work, greeting: resident.greeting, townId: resident.town.id }));
      localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 3, met, residents: residentData, recruits }));
    } catch (error) {
      console.warn("Não foi possível salvar o encontro com os moradores.", error);
    }
  }

  function addBox(parent, size, position, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addWorkArea(town) {
    const farm = new THREE.Group();
    for (let row = 0; row < 3; row++) {
      const z = row * 1.15;
      addBox(farm, [5.8, .12, .78], [0, .08, z], townMaterials.soil);
      for (let col = 0; col < 7; col++) {
        const crop = new THREE.Mesh(new THREE.ConeGeometry(.17, .52, 5), townMaterials.crop);
        crop.position.set(-2.45 + col * .8, .38, z);
        crop.castShadow = true;
        farm.add(crop);
      }
    }
    farm.position.set(town.x - 13, terrainHeight(town.x - 13, town.z + 11), town.z + 11);
    scene.add(farm);

    const woodPile = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, 2.1, 8), townMaterials.woodLight);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i % 2) * .12;
      log.position.set(0, .2 + Math.floor(i / 2) * .34, (i % 2) * .35 - .15);
      log.castShadow = true;
      woodPile.add(log);
    }
    woodPile.position.set(town.x + 20, terrainHeight(town.x + 20, town.z - 11), town.z - 11);
    scene.add(woodPile);

    const stall = new THREE.Group();
    addBox(stall, [3.1, .18, 1.7], [0, 1.25, 0], townMaterials.woodLight);
    addBox(stall, [.14, 2.5, .14], [-1.35, 1.25, -.65], townMaterials.wood);
    addBox(stall, [.14, 2.5, .14], [1.35, 1.25, -.65], townMaterials.wood);
    addBox(stall, [3.4, .12, 1.9], [0, 2.55, -.05], townMaterials.cloth);
    for (let i = 0; i < 3; i++) addBox(stall, [.45, .35, .42], [-.85 + i * .85, 1.52, .12], townMaterials.crop);
    stall.position.set(town.x, terrainHeight(town.x, town.z + 4), town.z + 4);
    scene.add(stall);
  }

  function makeTag(resident) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 28px Georgia";
    ctx.lineWidth = 5; ctx.strokeStyle = "rgba(16,24,17,.88)";
    ctx.strokeText(resident.name, 128, 32);
    ctx.fillStyle = "#fff0c9";
    ctx.fillText(resident.name, 128, 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.position.y = 2.38; sprite.scale.set(1.18, .3, 1);
    sprite.visible = false;
    return sprite;
  }

  function makeFallback(group, color) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.3, .78, 4, 8), new THREE.MeshStandardMaterial({ color, roughness: .95 }));
    body.position.y = .82; body.castShadow = true; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.21, 12, 10), new THREE.MeshStandardMaterial({ color: 0xc49a75, roughness: .9 }));
    head.position.y = 1.48; head.castShadow = true; group.add(head);
    return { body, head };
  }

  function loadModel(resident) {
    const fallback = resident.fallback;
    const url = new URL("../../assets/3d/" + resident.model, import.meta.url).href;
    let finished = false;
    const timer = setTimeout(() => { finished = true; }, 12000);
    loader.load(url, gltf => {
      if (finished || !resident.group.parent) return;
      finished = true; clearTimeout(timer);
      try {
        const model = cloneSkeleton(gltf.scene);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        if (!Number.isFinite(size.y) || size.y < .01) return;
        const scale = 1.82 / size.y;
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        model.traverse(part => { if (part.isMesh) { part.castShadow = true; part.receiveShadow = true; } });
        resident.group.remove(fallback.body, fallback.head);
        resident.group.add(model);
        resident.modelRoot = model;
        if (gltf.animations?.length) {
          resident.mixer = new THREE.AnimationMixer(model);
          const clips = gltf.animations;
          const idle = clips.find(c => /idle|stand/i.test(c.name));
          const walk = clips.find(c => /walk|run/i.test(c.name));
          if (idle) { resident.idleAction = resident.mixer.clipAction(idle); resident.idleAction.play(); }
          if (walk) resident.walkAction = resident.mixer.clipAction(walk);
        }
      } catch (error) {
        console.warn("Não foi possível preparar o modelo de " + resident.name, error);
      }
    }, undefined, error => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      console.warn("Modelo de " + resident.name + " indisponível; usando personagem provisório.", error);
    });
  }

  function createResident(town, data) {
    const previous = savedResidents[data.id] && typeof savedResidents[data.id] === "object" ? savedResidents[data.id] : {};
    const resident = {
      ...data, town, met: savedMet[data.id] === true,
      role: previous.role || data.role,
      work: Array.isArray(previous.work) ? previous.work : data.work,
      needs: { food: 82, water: 86, warmth: 90, rest: 92, ...(previous.needs || {}) },
      mood: Number.isFinite(previous.mood) ? previous.mood : 68,
      trust: Number.isFinite(previous.trust) ? previous.trust : 0,
      lastSimHour: Number.isFinite(previous.lastSimHour) ? previous.lastSimHour : ((Number(state.day) || 1) * 24 + (Number(state.timeOfDay) || 8)),
      lastSocialDay: Number.isFinite(previous.lastSocialDay) ? previous.lastSocialDay : 0,
      workHours: Number.isFinite(previous.workHours) ? previous.workHours : 0,
      mixer: null, idleAction: null, walkAction: null, moving: false, routeKey: "",
      routeIndex: 0, target: null, workPhase: 0, group: new THREE.Group()
    };
    const home = [town.x + data.home[0], town.z + data.home[1]];
    resident.homePoint = home;
    resident.group.position.set(home[0], terrainHeight(home[0], home[1]), home[1]);
    scene.add(resident.group);
    resident.fallback = makeFallback(resident.group, data.color);
    resident.tag = makeTag(resident);
    resident.group.add(resident.tag);
    residents.push(resident);
    loadModel(resident);
    return resident;
  }

  for (const town of towns) {
    addWorkArea(town);
    for (const data of town.residents) createResident(town, data);
  }

  const talkButton = document.createElement("button");
  talkButton.type = "button"; talkButton.hidden = true;
  talkButton.id = "distant-village-talk";
  talkButton.style.cssText = "position:fixed;z-index:44;left:50%;bottom:238px;transform:translateX(-50%);padding:11px 15px;border:1px solid #d6b45d;border-radius:22px;background:rgba(35,49,34,.97);color:#fff1cc;font:800 11px system-ui;box-shadow:0 4px 16px #0008;touch-action:manipulation";
  document.body.appendChild(talkButton);

  const dialog = document.createElement("section");
  dialog.hidden = true;
  dialog.id = "distant-village-dialog";
  dialog.style.cssText = "position:fixed;z-index:75;left:50%;top:50%;transform:translate(-50%,-50%);width:min(390px,calc(100vw - 32px));padding:18px;border:1px solid #d6b45d;border-radius:14px;background:linear-gradient(145deg,#293a2a,#17231b);color:#f3e8c9;box-shadow:0 18px 55px #000b;font:14px/1.55 Georgia,serif";
  dialog.innerHTML = '<button type="button" style="float:right;padding:7px 10px;background:transparent;color:#fff1cc;border:1px solid #b99b5c;border-radius:7px">FECHAR ✕</button><h2 style="margin:0 0 5px;color:#e6c979" id="distant-village-name"></h2><div id="distant-village-role" style="font:700 10px system-ui;color:#bfc99d;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px"></div><p id="distant-village-text"></p><div id="distant-village-status" style="padding:10px;margin:10px 0;background:#111d16;border:1px solid #65714d;border-radius:9px;font:12px/1.7 system-ui;color:#e7dfc6"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button id="distant-village-feed" type="button" style="padding:10px;border:1px solid #b99b5c;border-radius:8px;background:#42583a;color:#fff1cc;font:700 10px system-ui">OFERECER COMIDA</button><button id="distant-village-kind" type="button" style="padding:10px;border:1px solid #b99b5c;border-radius:8px;background:#594735;color:#fff1cc;font:700 10px system-ui">CONVERSAR</button></div>';
  document.body.appendChild(dialog);
  const dialogName = dialog.querySelector("#distant-village-name");
  const dialogRole = dialog.querySelector("#distant-village-role");
  const dialogText = dialog.querySelector("#distant-village-text");
  const dialogStatus = dialog.querySelector("#distant-village-status");
  const feedButton = dialog.querySelector("#distant-village-feed");
  const kindButton = dialog.querySelector("#distant-village-kind");
  dialog.querySelector("button").addEventListener("click", () => { dialog.hidden = true; });

  let nearest = null;
  function relationshipLabel(value) {
    return value >= 70 ? "Amizade" : value >= 30 ? "Conhecido" : "Recém-conhecido";
  }
  function refreshDialogue(resident) {
    const needs = resident.needs;
    dialogStatus.innerHTML = "<b>Ânimo: " + Math.round(resident.mood) + "/100 · " + relationshipLabel(resident.trust) + ": " + Math.round(resident.trust) + "/100</b><br>🍞 Alimentação " + Math.round(needs.food) + "% · 💧 Água " + Math.round(needs.water) + "%<br>🔥 Calor " + Math.round(needs.warmth) + "% · 🛏 Descanso " + Math.round(needs.rest) + "%<br><span style='color:#b9c99b'>Atividade: " + (resident.activity || "rotina da aldeia") + "</span>";
    const canFeed = (Number(state.berries) || 0) > 0 || (Number(state.cookedMeat) || 0) > 0 || (Number(state.meat) || 0) > 0;
    feedButton.disabled = !canFeed;
    feedButton.textContent = canFeed ? "OFERECER COMIDA" : "SEM COMIDA NA MOCHILA";
    kindButton.disabled = resident.lastSocialDay === (Number(state.day) || 1);
    kindButton.textContent = kindButton.disabled ? "JÁ CONVERSARAM HOJE" : "CONVERSAR";
  }
  function openDialogue(resident) {
    resident.met = true;
    dialogName.textContent = resident.name;
    dialogRole.textContent = resident.role + " · " + resident.town.name;
    dialogText.textContent = resident.greeting + " " + (resident.moving ? "Agora estou a caminho da minha atividade." : "Neste momento estou no meu ponto da rotina diária.");
    refreshDialogue(resident);
    dialog.hidden = false;
    talkButton.hidden = true;
    save();
    onToast("Você conversou com " + resident.name + ", de " + resident.town.name + ".");
  }
  feedButton.addEventListener("click", () => {
    if (!nearest || dialog.hidden) return;
    let food = "berries";
    if ((Number(state.cookedMeat) || 0) > 0) food = "cookedMeat";
    else if ((Number(state.berries) || 0) > 0) food = "berries";
    else if ((Number(state.meat) || 0) > 0) food = "meat";
    if ((Number(state[food]) || 0) <= 0) return;
    state[food]--;
    nearest.needs.food = Math.min(100, nearest.needs.food + (food === "cookedMeat" ? 48 : food === "meat" ? 34 : 24));
    nearest.mood = Math.min(100, nearest.mood + 8);
    nearest.trust = Math.min(100, nearest.trust + 6);
    refreshDialogue(nearest); save();
    onToast("Você dividiu comida com " + nearest.name + ". A confiança aumentou.");
  });
  kindButton.addEventListener("click", () => {
    if (!nearest || dialog.hidden || nearest.lastSocialDay === (Number(state.day) || 1)) return;
    nearest.lastSocialDay = Number(state.day) || 1;
    nearest.trust = Math.min(100, nearest.trust + 3);
    nearest.mood = Math.min(100, nearest.mood + 2);
    refreshDialogue(nearest); save();
    onToast(nearest.name + " gostou da conversa. Vocês se conhecem melhor.");
  });
  talkButton.addEventListener("click", () => { if (nearest && dialog.hidden) openDialogue(nearest); });

  function schedule(resident, hour) {
    if (hour < 5.5 || hour >= 20) return { key: "sleep", points: [resident.homePoint] };
    if (hour >= 11.5 && hour < 13.5) return { key: "meal", points: [resident.homePoint] };
    if (hour >= 6 && hour < 11.5 || hour >= 13.5 && hour < 19.5) {
      return { key: "work-" + resident.id, points: resident.work.map(([dx, dz]) => [resident.town.x + dx, resident.town.z + dz]) };
    }
    return { key: "home", points: [resident.homePoint] };
  }

  function setMoving(resident, moving) {
    if (resident.moving === moving) return;
    resident.moving = moving;
    if (moving && resident.idleAction) resident.idleAction.fadeOut(.18);
    if (!moving && resident.walkAction) resident.walkAction.fadeOut(.18);
    if (moving && resident.walkAction) resident.walkAction.reset().fadeIn(.18).play();
    if (!moving && resident.idleAction) resident.idleAction.reset().fadeIn(.18).play();
  }

  function updateNeeds(resident, absoluteHour) {
    const elapsed = Math.min(absoluteHour - resident.lastSimHour, 48);
    if (elapsed <= 0) return;
    const supply = economy?.towns?.find(town => town.id === resident.town.id);
    for (let tick = 0; tick < Math.floor(elapsed); tick++) {
      const hour = (resident.lastSimHour + tick + 1) % 24;
      const plan = schedule(resident, hour);
      const resting = plan.key === "sleep";
      const eating = plan.key === "meal";
      resident.needs.food = Math.max(0, resident.needs.food - .42);
      resident.needs.water = Math.max(0, resident.needs.water - .55);
      resident.needs.warmth = Math.max(0, resident.needs.warmth - .18);
      resident.needs.rest = resting ? Math.min(100, resident.needs.rest + 5.5) : Math.max(0, resident.needs.rest - (plan.key.startsWith("work") ? .9 : .35));
      if (eating && supply) {
        if (supply.stock.berries > 0) { supply.stock.berries--; resident.needs.food = Math.min(100, resident.needs.food + 32); }
        else if (supply.stock.meat > 0) { supply.stock.meat--; resident.needs.food = Math.min(100, resident.needs.food + 42); }
      }
      if (hour % 6 === 0 && supply && supply.stock.berries > 0) {
        supply.stock.berries--;
        resident.needs.water = Math.min(100, resident.needs.water + 28);
      }
      if (hour % 12 === 0 && supply && supply.stock.wood > 0) {
        supply.stock.wood--;
        resident.needs.warmth = Math.min(100, resident.needs.warmth + 24);
      }
      if (plan.key.startsWith("work")) resident.workHours += 1;
      const needsAverage = (resident.needs.food + resident.needs.water + resident.needs.warmth + resident.needs.rest) / 4;
      resident.mood = THREE.MathUtils.clamp(resident.mood + (needsAverage >= 55 ? .12 : -.28), 0, 100);
    }
    resident.lastSimHour = absoluteHour;
    if (supply && economy.save) economy.save();
  }

  function update(dt) {
    const hour = Number(state.timeOfDay) || 0;
    const absoluteHour = (Number(state.day) || 1) * 24 + hour;
    for (const resident of residents) {
      updateNeeds(resident, absoluteHour);
      const plan = schedule(resident, hour);
      resident.activity = plan.key === "sleep" ? "Dormindo em casa" : plan.key === "meal" ? "Refeição e descanso" : plan.key.startsWith("work") ? resident.role + " · trabalhando" : "Voltando para casa";
      if (plan.key !== resident.routeKey) {
        resident.routeKey = plan.key; resident.routeIndex = 0; resident.target = plan.points[0];
      }
      if (resident.target) {
        const dx = resident.target[0] - resident.group.position.x;
        const dz = resident.target[1] - resident.group.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < .32) {
          if (plan.points.length > 1) {
            resident.routeIndex = (resident.routeIndex + 1) % plan.points.length;
            resident.target = plan.points[resident.routeIndex];
          } else {
            resident.target = null; setMoving(resident, false);
          }
        } else {
          const step = Math.min(distance, .68 * Math.max(0, dt));
          resident.group.position.x += dx / distance * step;
          resident.group.position.z += dz / distance * step;
          resident.group.position.y = terrainHeight(resident.group.position.x, resident.group.position.z);
          resident.group.rotation.y = Math.atan2(dx, dz);
          setMoving(resident, true);
        }
      }
      if (resident.mixer) resident.mixer.update(dt);
    }

    nearest = null;
    let nearestDistance = 4.5;
    for (const resident of residents) {
      const distance = Math.hypot(player.position.x - resident.group.position.x, player.position.z - resident.group.position.z);
      if (resident.tag) resident.tag.visible = distance <= 5.5 && resident.group.visible;
      if (distance < nearestDistance) { nearest = resident; nearestDistance = distance; }
    }
    talkButton.hidden = !nearest || !dialog.hidden;
    if (nearest && dialog.hidden) talkButton.textContent = "CONVERSAR COM " + nearest.name.toUpperCase();
    if (nearest && !dialog.hidden) refreshDialogue(nearest);
  }

  function recruit(townId, data) {
    const town = towns.find(item => item.id === townId);
    if (!town || !data || !data.id || residents.some(item => item.id === data.id)) return null;
    const resident = createResident(town, { ...data, isRecruit: true, model: data.model || "Worker_Male.gltf", greeting: data.greeting || "Obrigado por me receber nesta povoação." });
    save(); onToast(resident.name + " agora vive em " + town.name + ".");
    return resident;
  }
  function assignProfession(residentId, role) {
    const resident = residents.find(item => item.id === residentId);
    const jobs = { "Agricultor":[[-13,11],[-10,13]], "Lenhador":[[19,-9],[22,-13]], "Caçador":[[-19,-11],[-23,-15]], "Pastor":[[-17,1],[-18,5]], "Artesão":[[-4,13],[0,15]], "Construtor":[[12,14],[15,17]], "Comerciante":[[0,3],[3,4]] };
    if (!resident || !jobs[role]) return false;
    resident.role=role; resident.work=jobs[role]; resident.routeKey=""; resident.target=null;
    if(resident.tag)resident.group.remove(resident.tag);
    resident.tag=makeTag(resident);resident.group.add(resident.tag);
    save(); return true;
  }
  function residentsForTown(townId) { return residents.filter(resident => resident.town.id===townId); }
  return { update, residents, save, recruit, assignProfession, residentsForTown };
}
