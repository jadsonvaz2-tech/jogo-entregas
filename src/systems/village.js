import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

const SAVE_KEY = "cronicas-floresta-village-v1";

export function createVillageResidents({ THREE, scene, player, terrainHeight, state, onToast }) {
  const loader = new GLTFLoader();
  const saved = (() => {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      return data && typeof data === "object" ? data : {};
    } catch (error) {
      console.warn("Não foi possível ler o progresso dos moradores.", error);
      return {};
    }
  })();

  const residents = [
    {
      id: "lina", name: "Lina", role: "Agricultora", model: "Worker_Female.gltf",
      start: [-5.5, 1.5], home: [-5.5, 1.5],
      work: [[-8.2, 1.5], [-7.1, 4.2]],
      greeting: "Sou Lina. Cuido das sementes e procuro um bom lugar para plantar. Pela manhã trabalho no pequeno terreno; ao entardecer volto para descansar. Um dia teremos campos e celeiros por todo o vale."
    },
    {
      id: "odo", name: "Odo", role: "Lenhador", model: "Worker_Male.gltf",
      start: [6.2, 1.2], home: [6.2, 1.2],
      work: [[9.1, 1.4], [8.4, -2.2]],
      greeting: "Odo, lenhador. Passo o dia na orla da mata, escolhendo árvores e preparando madeira. Quando a comunidade crescer, precisaremos de um depósito e de uma oficina."
    },
    {
      id: "toma", name: "Tomé", role: "Pedreiro", model: "OldClassy_Male.gltf",
      start: [0.8, 7.2], home: [0.8, 7.2],
      work: [[2.5, 9.2], [4.1, 7.4]],
      greeting: "Meu nome é Tomé. Conheço pedras boas para fundações e caminhos. Quero ajudar a erguer casas firmes por aqui. Por enquanto, reúno material perto da clareira."
    }
  ];

  const uiStyle = document.createElement("style");
  uiStyle.textContent = `
    #village-roster{position:fixed;z-index:23;right:10px;top:270px;width:190px;padding:10px 11px;border:1px solid rgba(194,167,106,.58);border-radius:11px;background:rgba(22,32,24,.88);color:#eee5cf;font:11px/1.35 system-ui;pointer-events:none;box-shadow:0 4px 16px #0005}
    #village-roster strong{display:block;margin-bottom:6px;color:#e6c979;font-size:10px;letter-spacing:.08em}
    #village-roster .resident-line{display:flex;justify-content:space-between;gap:6px;padding:3px 0;border-top:1px solid #ffffff16}
    #village-roster .resident-line span:last-child{color:#bfc99d;text-align:right}
    #village-talk-button{position:fixed;z-index:43;left:50%;bottom:190px;transform:translateX(-50%);padding:12px 17px;border:1px solid #d6b45d;border-radius:23px;background:rgba(35,49,34,.97);color:#fff1cc;font:800 12px system-ui;letter-spacing:.03em;box-shadow:0 4px 16px #0008;touch-action:manipulation}
    #village-talk-button[hidden]{display:none}
    #village-dialog{position:fixed;z-index:71;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 32px));padding:19px;border:1px solid #d6b45d;border-radius:15px;background:linear-gradient(145deg,#293a2a,#17231b);color:#f3e8c9;box-shadow:0 18px 55px #000b;font:14px/1.55 Georgia,serif}
    #village-dialog[hidden]{display:none}
    #village-dialog h2{margin:0 0 4px;color:#e6c979;font-size:21px}
    #village-dialog .role{margin:0 0 12px;color:#bfc99d;font:700 10px system-ui;letter-spacing:.1em;text-transform:uppercase}
    #village-dialog p{margin:0 0 16px}
    #village-dialog button{padding:10px 15px;border:1px solid #d6b45d;border-radius:9px;background:#52634a;color:#fff1cc;font:700 12px system-ui}
    #village-dialog .close{float:right;background:transparent}
    @media(max-width:600px){#village-roster{top:265px;right:7px;width:172px;padding:8px 9px;font-size:10px}#village-talk-button{bottom:188px;padding:11px 14px;font-size:11px}}
  `;
  document.head.appendChild(uiStyle);

  const roster = document.createElement("div");
  roster.id = "village-roster";
  roster.innerHTML = '<strong>POVOADO · 3 MORADORES</strong>' +
    residents.map((resident) => '<div class="resident-line"><b>' + resident.name + '</b><span>' + resident.role + '</span></div>').join("") +
    '<div style="padding-top:6px;color:#bfc99d">Rotinas diárias · amanhecer ao anoitecer</div>';
  document.body.appendChild(roster);

  const talkButton = document.createElement("button");
  talkButton.id = "village-talk-button";
  talkButton.type = "button";
  talkButton.hidden = true;
  document.body.appendChild(talkButton);

  const dialog = document.createElement("section");
  dialog.id = "village-dialog";
  dialog.hidden = true;
  dialog.innerHTML = '<button class="close" type="button">FECHAR ✕</button><h2 id="village-dialog-name"></h2><div class="role" id="village-dialog-role"></div><p id="village-dialog-text"></p><button id="village-dialog-done" type="button">CONTINUAR</button>';
  document.body.appendChild(dialog);

  const dialogName = dialog.querySelector("#village-dialog-name");
  const dialogRole = dialog.querySelector("#village-dialog-role");
  const dialogText = dialog.querySelector("#village-dialog-text");
  const closeDialog = () => { dialog.hidden = true; };
  dialog.querySelector(".close").addEventListener("click", closeDialog);
  dialog.querySelector("#village-dialog-done").addEventListener("click", closeDialog);

  function saveVillageProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ met: residents.filter(r => r.met).map(r => r.id) }));
    } catch (error) {
      console.warn("Não foi possível salvar o progresso dos moradores.", error);
    }
  }

  function makeNameTag(name, role) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgba(24,34,25,.9)";
    context.beginPath();
    context.roundRect(8, 8, 496, 112, 22);
    context.fill();
    context.strokeStyle = "#c7ad6a";
    context.lineWidth = 4;
    context.stroke();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#f3e8c9";
    context.font = "bold 42px Georgia";
    context.fillText(name.toUpperCase(), 256, 49);
    context.fillStyle = "#c4cfaa";
    context.font = "bold 21px Arial";
    context.fillText(role.toUpperCase(), 256, 88);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.position.y = 2.65;
    sprite.scale.set(2.8, .7, 1);
    return sprite;
  }

  function makeFallback(group, color) {
    const clothes = new THREE.Mesh(
      new THREE.CapsuleGeometry(.31, .78, 4, 8),
      new THREE.MeshStandardMaterial({ color, roughness: .94 })
    );
    clothes.position.y = .82;
    clothes.castShadow = true;
    group.add(clothes);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(.22, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xc49a75, roughness: .9 })
    );
    head.position.y = 1.48;
    head.castShadow = true;
    group.add(head);
    return { clothes, head };
  }

  function loadResidentModel(resident, group, fallback) {
    const url = new URL("../../assets/3d/" + resident.model, import.meta.url).href;
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        console.warn("Tempo esgotado ao carregar o modelo de " + resident.name);
      }
    }, 15000);
    loader.load(url, (gltf) => {
      if (finished || !group.parent) return;
      finished = true;
      clearTimeout(timer);
      const model = cloneSkeleton(gltf.scene);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      if (!Number.isFinite(size.y) || size.y < .01) return;
      const scale = 1.82 / size.y;
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      model.traverse((part) => {
        if (part.isMesh) {
          part.castShadow = true;
          part.receiveShadow = true;
        }
      });
      group.remove(fallback.clothes);
      group.remove(fallback.head);
      group.add(model);
      resident.modelRoot = model;
      if (gltf.animations && gltf.animations.length) {
        resident.mixer = new THREE.AnimationMixer(model);
        for (const clip of gltf.animations) {
          const key = clip.name.toLowerCase().replace(/[^a-z]/g, "");
          resident.actions[key] = resident.mixer.clipAction(clip);
        }
        resident.idleAction = Object.entries(resident.actions).find(([key]) => key.includes("idle"))?.[1] || null;
        resident.walkAction = Object.entries(resident.actions).find(([key]) => key.includes("walk") || key.includes("run"))?.[1] || null;
        resident.setMoving(false);
      }
    }, undefined, (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      console.warn("Modelo de " + resident.name + " indisponível; usando personagem provisório.", error);
    });
  }

  for (const resident of residents) {
    resident.met = Array.isArray(saved.met) && saved.met.includes(resident.id);
    resident.group = new THREE.Group();
    resident.group.position.set(resident.start[0], terrainHeight(resident.start[0], resident.start[1]), resident.start[1]);
    scene.add(resident.group);
    const color = resident.id === "lina" ? 0x6b8050 : resident.id === "odo" ? 0x79563a : 0x777d82;
    resident.fallback = makeFallback(resident.group, color);
    resident.group.add(makeNameTag(resident.name, resident.role));
    resident.actions = {};
    resident.mixer = null;
    resident.moving = false;
    resident.target = null;
    resident.routeKey = "";
    resident.routeIndex = 0;
    resident.idleAction = null;
    resident.walkAction = null;
    resident.setMoving = (moving) => {
      if (resident.moving === moving) return;
      resident.moving = moving;
      const next = moving ? resident.walkAction : resident.idleAction;
      const previous = moving ? resident.idleAction : resident.walkAction;
      if (previous) previous.fadeOut(.18);
      if (next) next.reset().fadeIn(.18).play();
    };
    loadResidentModel(resident, resident.group, resident.fallback);
  }

  function scheduleFor(resident, hour) {
    if (hour < 5.5 || hour >= 20) return { key: "sleep", points: [resident.home] };
    if (hour >= 11.5 && hour < 13.5) return { key: "meal", points: [resident.home] };
    if (hour >= 6 && hour < 11.5) return { key: "morning-work", points: resident.work };
    if (hour >= 13.5 && hour < 19.5) return { key: "afternoon-work", points: [...resident.work].reverse() };
    return { key: "home", points: [resident.home] };
  }

  function openResidentDialogue(resident) {
    resident.met = true;
    saveVillageProgress();
    dialogName.textContent = resident.name;
    dialogRole.textContent = resident.role;
    dialogText.textContent = resident.greeting + " Hoje estou " + (resident.moving ? "indo para meu local de trabalho." : "no meu ponto da rotina diária.");
    dialog.hidden = false;
    onToast("Você conversou com " + resident.name + ".");
  }

  talkButton.addEventListener("click", () => {
    if (nearestResident) openResidentDialogue(nearestResident);
  });

  let nearestResident = null;
  let rosterClock = 0;
  function update(dt) {
    const hour = Number(state.timeOfDay) || 8;
    for (const resident of residents) {
      const schedule = scheduleFor(resident, hour);
      if (schedule.key !== resident.routeKey) {
        resident.routeKey = schedule.key;
        resident.routeIndex = 0;
        resident.target = schedule.points[0];
      }
      if (resident.target) {
        const dx = resident.target[0] - resident.group.position.x;
        const dz = resident.target[1] - resident.group.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < .35) {
          if (schedule.points.length > 1) {
            resident.routeIndex = (resident.routeIndex + 1) % schedule.points.length;
            resident.target = schedule.points[resident.routeIndex];
          } else {
            resident.setMoving(false);
          }
        } else {
          const speed = .82;
          const step = Math.min(distance, speed * Math.max(0, dt));
          resident.group.position.x += dx / distance * step;
          resident.group.position.z += dz / distance * step;
          resident.group.rotation.y = Math.atan2(dx, dz);
          resident.group.position.y = terrainHeight(resident.group.position.x, resident.group.position.z);
          resident.setMoving(step > .002);
        }
      } else {
        resident.setMoving(false);
      }
      if (resident.mixer) resident.mixer.update(dt);
    }

    let closest = null;
    let closestDistance = 4.3;
    for (const resident of residents) {
      const distance = Math.hypot(player.position.x - resident.group.position.x, player.position.z - resident.group.position.z);
      if (distance < closestDistance) {
        closest = resident;
        closestDistance = distance;
      }
    }
    nearestResident = closest;
    talkButton.hidden = !closest || !dialog.hidden;
    if (closest && dialog.hidden) talkButton.textContent = "CONVERSAR COM " + closest.name.toUpperCase();

    rosterClock += dt;
    if (rosterClock > 1.5) {
      rosterClock = 0;
      const hourText = hour.toFixed(0).padStart(2, "0") + "h";
      roster.querySelector("div:last-child").textContent = hour >= 20 || hour < 5.5
        ? "Todos descansam · " + hourText
        : hour >= 11.5 && hour < 13.5
          ? "Pausa para refeição · " + hourText
          : "Trabalho no povoado · " + hourText;
    }
  }

  return { update };
}
