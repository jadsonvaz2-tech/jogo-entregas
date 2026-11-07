import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

const SAVE_KEY = "cronicas-floresta-village-v1";

export function createVillageResidents({ THREE, scene, player, terrainHeight, state, onToast, onSave, onFarmAction }) {
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

  const savedJobs = saved.jobs && typeof saved.jobs === "object" ? saved.jobs : {};
  let morale = Math.min(100, Math.max(0, Number(saved.morale ?? 50) || 0));
  let lastUpkeepDay = Number.isFinite(Number(saved.lastUpkeepDay)) ? Math.max(1, Number(saved.lastUpkeepDay)) : Math.max(1, Number(state.day) || 1);
  const stockpile = { wood: Math.max(0, Number(saved.stockpile?.wood) || 0), stone: Math.max(0, Number(saved.stockpile?.stone) || 0), berries: Math.max(0, Number(saved.stockpile?.berries) || 0) };
  const residents = [
    {
      id: "lina", name: "Lina", role: "Agricultora", profession: "farmer", model: "Worker_Female.gltf",
      start: [-5.5, 1.5], home: [-5.5, 1.5],
      work: [[-8.2, 1.5], [-7.1, 4.2]],
      greeting: "Sou Lina. Cuido das sementes e procuro um bom lugar para plantar. Pela manhã trabalho no pequeno terreno; ao entardecer volto para descansar. Um dia teremos campos e celeiros por todo o vale."
    },
    {
      id: "odo", name: "Odo", role: "Lenhador", profession: "lumberjack", model: "Worker_Male.gltf",
      start: [6.2, 1.2], home: [6.2, 1.2],
      work: [[9.1, 1.4], [8.4, -2.2]],
      greeting: "Odo, lenhador. Passo o dia na orla da mata, escolhendo árvores e preparando madeira. Quando a comunidade crescer, precisaremos de um depósito e de uma oficina."
    },
    {
      id: "toma", name: "Tomé", role: "Pedreiro", profession: "mason", model: "OldClassy_Male.gltf",
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

  const workStyle = document.createElement("style");
  workStyle.textContent = `
    #village-work{position:fixed;z-index:24;right:10px;top:390px;width:min(260px,calc(100vw - 20px));max-height:42vh;overflow:auto;padding:10px;border:1px solid rgba(194,167,106,.68);border-radius:11px;background:rgba(22,32,24,.94);color:#eee5cf;font:11px/1.35 system-ui;box-shadow:0 4px 16px #0007;pointer-events:auto}
    #village-work strong{display:block;color:#e6c979;font-size:10px;letter-spacing:.08em;margin-bottom:6px}
    #village-work .work-row{padding:7px 0;border-top:1px solid #ffffff20}
    #village-work .work-head{display:flex;justify-content:space-between;align-items:center;gap:6px}
    #village-work select{width:100%;margin-top:5px;padding:7px;border:1px solid #b99b5c;border-radius:6px;background:#263729;color:#fff1cc;font:11px system-ui}
    #village-work button{margin-top:5px;width:100%;padding:7px;border:1px solid #b99b5c;border-radius:6px;background:#52634a;color:#fff1cc;font:700 10px system-ui}
    #village-work .production{color:#c4cfaa;font-size:10px;margin-top:3px}
    @media(max-width:600px){#village-work{top:390px;right:7px;width:174px;max-height:35vh;padding:7px;font-size:10px}#village-work select{padding:6px;font-size:10px}}
    @media(min-width:800px){#village-work{top:390px;right:20px;width:220px;max-height:48vh}}
  `;
  document.head.appendChild(workStyle);
  const workPanel = document.createElement("section");
  workPanel.id = "village-work";
  workPanel.innerHTML = '<strong>GESTÃO DO POVOADO</strong><div class="work-list"></div><div id="village-morale" class="production"></div><button id="village-communal-meal" type="button">PREPARAR REFEIÇÃO · 5 FRUTAS</button><div id="village-stockpile" class="production"></div><button id="village-collect-stockpile" type="button">RECOLHER PRODUÇÃO</button><div id="village-work-summary" class="production"></div>';
  document.body.appendChild(workPanel);
  const workList = workPanel.querySelector(".work-list");
  const stockpileDisplay = workPanel.querySelector("#village-stockpile");
  const collectStockpileButton = workPanel.querySelector("#village-collect-stockpile");
  const workSummary = workPanel.querySelector("#village-work-summary");
  const upkeepStatus = document.createElement("div");
  upkeepStatus.className = "production";
  upkeepStatus.style.marginTop = "4px";
  workPanel.insertBefore(upkeepStatus, stockpileDisplay);
  const moraleDisplay = workPanel.querySelector("#village-morale");
  const communalMealButton = workPanel.querySelector("#village-communal-meal");

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

  const skills = Object.fromEntries(residents.map(resident => {
    const savedSkill = saved.skills && typeof saved.skills === "object" ? saved.skills[resident.id] || {} : {};
    return [resident.id, { xp: Math.max(0, Math.floor(Number(savedSkill.xp) || 0)), level: Math.min(10, Math.max(1, Math.floor(Number(savedSkill.level) || 1))) }];
  }));

  const professions = {
    farmer: { label: "Agricultora", resource: "berries", resourceLabel: "frutas", amount: 2, detail: "Cuida das hortas: planta 3 frutas e colhe 6 quando amadurecem." },
    lumberjack: { label: "Lenhador", resource: "wood", resourceLabel: "madeiras", amount: 1 },
    mason: { label: "Pedreiro", resource: "stone", resourceLabel: "pedras", amount: 1 },
    idle: { label: "Sem tarefa", resource: null, resourceLabel: "—", amount: 0 }
  };
  const workElapsed = { lina: 0, odo: 0, toma: 0 };
  const professionWorkPoints = {
    farmer: [[-8.2, 1.5], [-7.1, 4.2]],
    lumberjack: [[9.1, 1.4], [8.4, -2.2]],
    mason: [[2.5, 9.2], [4.1, 7.4]]
  };

  function saveVillageProgress() {
    try {
      const jobs = {};
      for (const resident of residents) jobs[resident.id] = { profession: resident.profession, enabled: resident.enabled };
      localStorage.setItem(SAVE_KEY, JSON.stringify({ met: residents.filter(r => r.met).map(r => r.id), jobs, stockpile, morale, lastUpkeepDay, skills }));
    } catch (error) {
      console.warn("Não foi possível salvar o progresso dos moradores.", error);
    }
  }

  function moraleDescription() {
    if (morale >= 75) return "POVOADO ANIMADO";
    if (morale >= 45) return "POVOADO ESTÁVEL";
    if (morale >= 25) return "POVOADO DESMOTIVADO";
    return "POVOADO DESANIMADO";
  }

  function foodReserveDays() {
    return Math.floor(stockpile.berries / 3);
  }

  function refreshStockpileUI() {
    stockpileDisplay.textContent = "DEPÓSITO COMUNITÁRIO · " + stockpile.wood + " madeira · " + stockpile.stone + " pedra · " + stockpile.berries + " frutas";
    const total = stockpile.wood + stockpile.stone + stockpile.berries;
    collectStockpileButton.disabled = total < 1;
    moraleDisplay.textContent = "ÂNIMO DO POVOADO · " + Math.round(morale) + "/100 · " + moraleDescription();
    communalMealButton.disabled = stockpile.berries < 5 || morale >= 100;
    const reserveDays = foodReserveDays();
    const reserveText = reserveDays === 1 ? "1 dia" : reserveDays + " dias";
    upkeepStatus.textContent = "RAÇÕES · 3 frutas/dia · reserva para " + reserveText + (reserveDays < 2 ? " · REABASTECER" : " · suficiente");
    workSummary.textContent = residents.filter(r => r.enabled && r.profession !== "idle").length + "/3 moradores em atividade · produção guardada no depósito.";
  }

  function getStockpile(resource) {
    return Math.max(0, Number(stockpile[resource]) || 0);
  }

  function takeFromStockpile(resource, amount) {
    const quantity = Math.max(0, Math.floor(Number(amount) || 0));
    if (!Object.prototype.hasOwnProperty.call(stockpile, resource) || quantity < 1 || stockpile[resource] < quantity) return false;
    stockpile[resource] -= quantity;
    saveVillageProgress();
    refreshStockpileUI();
    return true;
  }

  communalMealButton.addEventListener("click", () => {
    if (stockpile.berries < 5 || morale >= 100) return;
    stockpile.berries -= 5;
    morale = Math.min(100, morale + 15);
    saveVillageProgress();
    refreshStockpileUI();
    onToast("Refeição comunitária servida! O ânimo do povoado aumentou para " + Math.round(morale) + "/100.");
  });

  collectStockpileButton.addEventListener("click", () => {
    const amounts = { ...stockpile };
    const total = amounts.wood + amounts.stone + amounts.berries;
    if (!total) { onToast("O depósito comunitário está vazio."); return; }
    state.wood = Math.max(0, Number(state.wood) || 0) + amounts.wood;
    state.stone = Math.max(0, Number(state.stone) || 0) + amounts.stone;
    state.berries = Math.max(0, Number(state.berries) || 0) + amounts.berries;
    stockpile.wood = 0; stockpile.stone = 0; stockpile.berries = 0;
    saveVillageProgress();
    onSave();
    refreshStockpileUI();
    onToast("Você recolheu a produção comunitária: " + amounts.wood + " madeiras, " + amounts.stone + " pedras e " + amounts.berries + " frutas.");
  });

  function experienceNeeded(level) { return level * 5; }

  function productionBonus(resident) { return Math.floor((skills[resident.id].level - 1) / 2); }

  function awardWorkExperience(resident) {
    const skill = skills[resident.id];
    if (skill.level >= 10) return false;
    skill.xp++;
    if (skill.xp >= experienceNeeded(skill.level)) { skill.level++; saveVillageProgress(); return true; }
    saveVillageProgress();
    return false;
  }

  function renderWorkPanel() {
    workList.innerHTML = "";
    for (const resident of residents) {
      const row = document.createElement("div");
      row.className = "work-row";
      const head = document.createElement("div");
      head.className = "work-head";
      const name = document.createElement("b");
      name.textContent = resident.name;
      const status = document.createElement("span");
      status.textContent = resident.enabled && resident.profession !== "idle" ? "TRABALHANDO" : "PAUSADO";
      status.style.color = resident.enabled && resident.profession !== "idle" ? "#b9d48d" : "#d5aa83";
      head.append(name, status);
      const select = document.createElement("select");
      select.setAttribute("aria-label", "Profissão de " + resident.name);
      for (const [value, profession] of Object.entries(professions)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = profession.label;
        select.appendChild(option);
      }
      select.value = resident.profession;
      select.addEventListener("change", () => {
        resident.profession = select.value;
        resident.role = professions[resident.profession].label;
        const residentIndex = residents.indexOf(resident);
        const rosterRole = roster.querySelectorAll(".resident-line span")[residentIndex];
        if (rosterRole) rosterRole.textContent = resident.role;
        if (resident.profession === "idle") resident.enabled = false;
        else resident.enabled = true;
        resident.routeKey = "";
        resident.target = null;
        resident.routeIndex = 0;
        updateResidentNameTag(resident);
        saveVillageProgress();
        renderWorkPanel();
        onToast(resident.name + " agora exerce a função: " + professions[resident.profession].label + ".");
      });
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = resident.enabled ? "PAUSAR TAREFA" : "ATIVAR TAREFA";
      toggle.disabled = resident.profession === "idle";
      toggle.addEventListener("click", () => {
        resident.enabled = !resident.enabled;
        resident.routeKey = "";
        resident.target = null;
        resident.routeIndex = 0;
        saveVillageProgress();
        renderWorkPanel();
      });
      const production = document.createElement("div");
      production.className = "production";
      const job = professions[resident.profession];
      const skill = skills[resident.id];
      const bonus = productionBonus(resident);
      const skillLine = skill.level >= 10 ? "NÍVEL 10 · MESTRE" : "NÍVEL " + skill.level + " · XP " + skill.xp + "/" + experienceNeeded(skill.level) + (bonus ? " · +" + bonus + " por ciclo" : "");
      production.textContent = job.resource ? (job.detail || ("Produz " + job.amount + " " + job.resourceLabel + " por ciclo de trabalho.")) + " " + skillLine : "Sem produção atribuída. " + skillLine;
      row.append(head, select, toggle, production);
      workList.appendChild(row);
    }
    refreshStockpileUI();
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
    const job = savedJobs[resident.id];
    if (job && Object.prototype.hasOwnProperty.call(professions, job.profession)) resident.profession = job.profession;
    resident.enabled = job ? job.enabled !== false : true;
    resident.role = professions[resident.profession].label;
    resident.met = Array.isArray(saved.met) && saved.met.includes(resident.id);
    resident.group = new THREE.Group();
    resident.group.position.set(resident.start[0], terrainHeight(resident.start[0], resident.start[1]), resident.start[1]);
    scene.add(resident.group);
    const color = resident.id === "lina" ? 0x6b8050 : resident.id === "odo" ? 0x79563a : 0x777d82;
    resident.fallback = makeFallback(resident.group, color);
    resident.nameTag = makeNameTag(resident.name, resident.role);
    resident.group.add(resident.nameTag);
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
  roster.querySelectorAll(".resident-line span").forEach((el, index) => { el.textContent = residents[index].role; });
  renderWorkPanel();

  function scheduleFor(resident, hour) {
    if (hour < 5.5 || hour >= 20) return { key: "sleep", points: [resident.home] };
    if (hour >= 11.5 && hour < 13.5) return { key: "meal", points: [resident.home] };
    const workingHours = hour >= 6 && hour < 11.5 || hour >= 13.5 && hour < 19.5;
    if (workingHours && (!resident.enabled || resident.profession === "idle")) {
      return { key: "resting-" + resident.id, points: [resident.home] };
    }
    const workPoints = professionWorkPoints[resident.profession];
    if (workingHours && workPoints) {
      return hour < 11.5
        ? { key: "morning-work-" + resident.profession, points: workPoints }
        : { key: "afternoon-work-" + resident.profession, points: [...workPoints].reverse() };
    }
    return { key: "home", points: [resident.home] };
  }

  function updateResidentNameTag(resident) {
    if (resident.nameTag) {
      resident.group.remove(resident.nameTag);
      resident.nameTag.material.map?.dispose();
      resident.nameTag.material.dispose();
    }
    resident.nameTag = makeNameTag(resident.name, resident.role);
    resident.group.add(resident.nameTag);
  }

  function openResidentDialogue(resident) {
    resident.met = true;
    saveVillageProgress();
    dialogName.textContent = resident.name;
    dialogRole.textContent = resident.role;
    const reserveDays = foodReserveDays();
    const villageCondition = morale >= 75
      ? "O povoado está animado e o trabalho rende mais."
      : morale >= 45
        ? "O povoado está estável, mas precisamos manter as provisões."
        : morale >= 25
          ? "O ânimo está baixo. Uma refeição comunitária ajudaria."
          : "O povoado está desanimado; precisamos cuidar das pessoas.";
    const foodCondition = reserveDays > 1
      ? "Temos frutas para " + reserveDays + " dias de refeições."
      : reserveDays === 1
        ? "Nosso estoque só cobre mais um dia de refeições."
        : "Estamos sem frutas para as refeições diárias.";
    dialogText.textContent = resident.greeting + " Hoje estou " + (resident.moving ? "indo para meu local de trabalho. " : "no meu ponto da rotina diária. ") + villageCondition + " " + foodCondition;
    dialog.hidden = false;
    onToast("Você conversou com " + resident.name + ".");
  }

  talkButton.addEventListener("click", () => {
    if (nearestResident) openResidentDialogue(nearestResident);
  });

  let nearestResident = null;
  let rosterClock = 0;
  function update(dt) {
    const currentDay = Math.max(1, Number(state.day) || 1);
    if (currentDay > lastUpkeepDay) {
      let fedDays = 0;
      let missedDays = 0;
      while (lastUpkeepDay < currentDay) {
        lastUpkeepDay++;
        if (stockpile.berries >= 3) {
          stockpile.berries -= 3;
          morale = Math.min(100, morale + 4);
          fedDays++;
        } else {
          morale = Math.max(0, morale - 8);
          missedDays++;
        }
      }
      saveVillageProgress();
      refreshStockpileUI();
      if (fedDays && missedDays) onToast("O povoado recebeu " + fedDays + " refeição(ões), mas faltou comida em " + missedDays + " dia(s).");
      else if (fedDays) onToast("Os moradores fizeram suas refeições diárias. O ânimo melhorou.");
      else onToast("Faltaram frutas para alimentar o povoado. O ânimo dos moradores diminuiu.");
    }
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
      const workingTime = hour >= 6 && hour < 11.5 || hour >= 13.5 && hour < 19.5;
      const job = professions[resident.profession];
      if (resident.enabled && job && job.resource && workingTime) {
        workElapsed[resident.id] += Math.max(0, dt);
        const workCycle = morale >= 75 ? 40 : morale < 25 ? 55 : 45;
        if (workElapsed[resident.id] >= workCycle) {
          workElapsed[resident.id] -= workCycle;
          const leveledUp = awardWorkExperience(resident);
          const bonus = productionBonus(resident);
          if (leveledUp) {
            renderWorkPanel();
            onToast(resident.name + " evoluiu na profissão! Agora está no nível " + skills[resident.id].level + ".");
          }
          const farmResult = resident.profession === "farmer" && typeof onFarmAction === "function" ? onFarmAction() : null;
          if (farmResult && typeof farmResult === "object" && farmResult.resource && Number(farmResult.amount) > 0) {
            const produced = Number(farmResult.amount) + bonus;
            stockpile[farmResult.resource] = (stockpile[farmResult.resource] || 0) + produced;
            saveVillageProgress();
            refreshStockpileUI();
            onToast((farmResult.message || "Lina armazenou a colheita no depósito comunitário.") + (bonus ? " Bônus de experiência: +" + bonus + " unidade(s)." : ""));
          } else if (farmResult) {
            onToast(farmResult);
          } else {
            const produced = job.amount + bonus;
            stockpile[job.resource] = (stockpile[job.resource] || 0) + produced;
            saveVillageProgress();
            refreshStockpileUI();
            onToast(resident.name + " armazenou " + produced + " " + job.resourceLabel + " no depósito comunitário.");
          }
        }
      }
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
      const productionLine = workPanel.querySelector("#village-work-summary");
      if (productionLine) {
        const active = residents.filter(r => r.enabled && r.profession !== "idle").length;
        productionLine.textContent = active + "/3 moradores em atividade · ciclos durante o expediente.";
      }
      roster.querySelector("div:last-child").textContent = hour >= 20 || hour < 5.5
        ? "Todos descansam · " + hourText
        : hour >= 11.5 && hour < 13.5
          ? "Pausa para refeição · " + hourText
          : "Trabalho no povoado · " + hourText;
    }
  }

  return { update, getStockpile, takeFromStockpile, getMorale: () => morale };
}
