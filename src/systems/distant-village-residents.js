import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

const SAVE_KEY = "cronicas-floresta-distant-villages-v1";

// Moradores independentes das três pessoas do acampamento inicial.
// Seus dados são aditivos e ficam em uma chave separada para proteger os salvamentos antigos.
export function createDistantVillageResidents({ THREE, scene, player, terrainHeight, state, onToast }) {
  const loader = new GLTFLoader();
  const towns = [
    {
      name: "Aldeia do Vale", x: 57, z: 31,
      residents: [
        { id: "vale-ana", name: "Ana", role: "Agricultora", model: "Worker_Female.gltf", color: 0x788d55, home: [-8, -7], work: [[-13, 11], [-10, 13]], greeting: "Cuido das hortas da Aldeia do Vale. Pela manhã preparo os canteiros e acompanho as plantações; depois descanso perto de casa." },
        { id: "vale-bento", name: "Bento", role: "Lenhador", model: "Worker_Male.gltf", color: 0x79583b, home: [8, -7], work: [[19, -9], [22, -13]], greeting: "Sou lenhador. Trabalho na mata além das últimas casas e separo troncos para as construções da aldeia." },
        { id: "vale-marta", name: "Marta", role: "Comerciante", model: "Casual_Female.gltf", color: 0x8b6d91, home: [-8, 8], work: [[0, 3], [3, 4]], greeting: "Mantenho o pequeno mercado da aldeia. Troco alimentos, ferramentas e materiais com quem chega pela estrada." }
      ]
    },
    {
      name: "Povoado da Colina", x: -59, z: -39,
      residents: [
        { id: "colina-joana", name: "Joana", role: "Pastora", model: "Worker_Female.gltf", color: 0x9a8051, home: [-7, -7], work: [[-17, 1], [-18, 5]], greeting: "Sou pastora. Levo os animais para pastar durante o dia e volto ao povoado antes do anoitecer." },
        { id: "colina-gil", name: "Gil", role: "Caçador", model: "Cowboy_Male.gltf", color: 0x7a5940, home: [7, -7], work: [[-19, -11], [-23, -15]], greeting: "Conheço as trilhas e os rastros da floresta. Passo o dia procurando caça e observando os arredores." },
        { id: "colina-rute", name: "Rute", role: "Mercadora", model: "Casual2_Female.gltf", color: 0x826b9b, home: [7, 8], work: [[0, 3], [3, 4]], greeting: "Viajo entre as comunidades levando notícias e mercadorias. O caminho entre as povoações precisa continuar seguro." }
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
      for (const resident of residents) met[resident.id] = !!resident.met;
      localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, met }));
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

  function makeTag(resident, townName) {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 132;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(22,31,24,.9)";
    ctx.beginPath(); ctx.roundRect(8, 8, 496, 116, 20); ctx.fill();
    ctx.strokeStyle = "#c6a96b"; ctx.lineWidth = 4; ctx.stroke();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#f4e7c9"; ctx.font = "bold 43px Georgia";
    ctx.fillText(resident.name.toUpperCase(), 256, 49);
    ctx.fillStyle = "#c4cfaa"; ctx.font = "bold 22px Arial";
    ctx.fillText(resident.role.toUpperCase() + " · " + townName.toUpperCase(), 256, 91);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.position.y = 2.72; sprite.scale.set(3.05, .78, 1);
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

  for (const town of towns) {
    addWorkArea(town);
    for (const data of town.residents) {
      const resident = {
        ...data, town, met: savedMet[data.id] === true, mixer: null,
        idleAction: null, walkAction: null, moving: false, routeKey: "",
        routeIndex: 0, target: null, workPhase: 0, group: new THREE.Group()
      };
      const home = [town.x + data.home[0], town.z + data.home[1]];
      resident.homePoint = home;
      resident.group.position.set(home[0], terrainHeight(home[0], home[1]), home[1]);
      scene.add(resident.group);
      resident.fallback = makeFallback(resident.group, data.color);
      resident.tag = makeTag(resident, town.name);
      resident.group.add(resident.tag);
      residents.push(resident);
      loadModel(resident);
    }
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
  dialog.innerHTML = '<button type="button" style="float:right;padding:7px 10px;background:transparent;color:#fff1cc;border:1px solid #b99b5c;border-radius:7px">FECHAR ✕</button><h2 style="margin:0 0 5px;color:#e6c979" id="distant-village-name"></h2><div id="distant-village-role" style="font:700 10px system-ui;color:#bfc99d;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px"></div><p id="distant-village-text"></p>';
  document.body.appendChild(dialog);
  const dialogName = dialog.querySelector("#distant-village-name");
  const dialogRole = dialog.querySelector("#distant-village-role");
  const dialogText = dialog.querySelector("#distant-village-text");
  dialog.querySelector("button").addEventListener("click", () => { dialog.hidden = true; });

  let nearest = null;
  function openDialogue(resident) {
    resident.met = true; save();
    dialogName.textContent = resident.name;
    dialogRole.textContent = resident.role + " · " + resident.town.name;
    dialogText.textContent = resident.greeting + " " + (resident.moving ? "Agora estou a caminho da minha atividade." : "Neste momento estou no meu ponto da rotina diária.");
    dialog.hidden = false;
    talkButton.hidden = true;
    onToast("Você conheceu " + resident.name + ", de " + resident.town.name + ".");
  }
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

  function update(dt) {
    const hour = Number(state.timeOfDay) || 8;
    for (const resident of residents) {
      const plan = schedule(resident, hour);
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
      if (distance < nearestDistance) { nearest = resident; nearestDistance = distance; }
    }
    talkButton.hidden = !nearest || !dialog.hidden;
    if (nearest && dialog.hidden) talkButton.textContent = "CONVERSAR COM " + nearest.name.toUpperCase();
  }

  return { update, residents };
}
