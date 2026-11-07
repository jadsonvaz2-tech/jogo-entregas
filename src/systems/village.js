import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

const SAVE_KEY = "cronicas-floresta-village-v1";

export function createVillageResidents({ THREE, scene, player, terrainHeight, state, onToast, onSave, onFarmAction, managementRoot = null }) {
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
  const savedRecruits = Array.isArray(saved.recruits) ? saved.recruits : [];
  for (const recruit of savedRecruits) {
    if (!recruit || !recruit.id || residents.some(person => person.id === recruit.id)) continue;
    const home = Array.isArray(recruit.home) && recruit.home.length === 2 ? recruit.home : [0, 0];
    residents.push({
      id: recruit.id, name: recruit.name || "Novo morador", role: recruit.role || "Sem tarefa",
      profession: recruit.profession || "idle", model: recruit.model || "Worker_Male.gltf",
      start: [...home], home: [...home], work: Array.isArray(recruit.work) ? recruit.work : [],
      greeting: recruit.greeting || "Obrigado por me receber nesta aldeia.", isRecruit: true
    });
  }
  let housesBuilt = Math.max(0, Math.min(6, Math.floor(Number(saved.houses) || 0)));
  const HOUSE_SLOTS = [[-15,14],[15,14],[-15,-14],[15,-14],[-23,0],[23,0]];
  const recruitNames = ["Afonso","Beatriz","Cecília","Dário","Elisa","Frederico","Guilherme","Helena","Inês","Joaquim","Leonor","Martim","Nuno","Olívia","Rafael","Sofia"];

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
  const refreshRoster = () => {
    roster.innerHTML = '<strong>ALDEIA CENTRAL · ' + residents.length + ' MORADORES</strong>' +
      residents.map((resident) => '<div class="resident-line"><b>' + resident.name + '</b><span>' + resident.role + '</span></div>').join("") +
      '<div style="padding-top:6px;color:#bfc99d">Rotinas diárias · amanhecer ao anoitecer</div>';
  };
  refreshRoster();
  if (managementRoot) managementRoot.appendChild(roster);
  else document.body.appendChild(roster);

  const workStyle = document.createElement("style");
  workStyle.textContent = `
    #village-work{position:fixed;z-index:24;right:10px;top:390px;width:min(260px,calc(100vw - 20px));max-height:42vh;overflow:auto;padding:10px;border:1px solid rgba(194,167,106,.68);border-radius:11px;background:rgba(22,32,24,.94);color:#eee5cf;font:11px/1.35 system-ui;box-shadow:0 4px 16px #0007;pointer-events:auto}
    #playerVillageManagementSlot #village-roster,#playerVillageManagementSlot #village-work{position:static;z-index:auto;top:auto;right:auto;left:auto;bottom:auto;transform:none;width:100%;max-width:none;max-height:none;margin:0 0 9px;box-shadow:none;pointer-events:auto}
    #playerVillageManagementSlot #village-roster{padding:10px;background:#17231b;border:1px solid #65714d;border-radius:8px}
    #playerVillageManagementSlot #village-work{padding:10px;background:#17231b;border:1px solid #65714d;border-radius:8px}
    #playerVillageManagementSlot .village-management-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:7px 0}
    #playerVillageManagementSlot .village-management-actions button{min-height:42px;padding:8px;border:1px solid #b99b5c;border-radius:7px;background:#42583a;color:#fff1cc;font:700 10px system-ui}
    #playerVillageManagementSlot .village-management-actions button:disabled{opacity:.42}
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
  workPanel.innerHTML = '<strong>ADMINISTRAÇÃO DA ALDEIA CENTRAL</strong><div id="village-housing-status" class="production"></div><div class="village-management-actions"><button id="village-build-house" type="button">🏠 CONSTRUIR CASA · 16 MADEIRAS + 8 PEDRAS</button><button id="village-recruit" type="button">👥 RECRUTAR · 25 MOEDAS</button></div><div class="work-list"></div><div id="village-morale" class="production"></div><button id="village-communal-meal" type="button">PREPARAR REFEIÇÃO · 5 FRUTAS</button><div id="village-stockpile" class="production"></div><button id="village-collect-stockpile" type="button">RECOLHER PRODUÇÃO</button><div id="village-work-summary" class="production"></div>';
  if (managementRoot) managementRoot.appendChild(workPanel);
  else document.body.appendChild(workPanel);
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
  const housingStatus = workPanel.querySelector("#village-housing-status");
  const buildHouseButton = workPanel.querySelector("#village-build-house");
  const recruitButton = workPanel.querySelector("#village-recruit");
  function refreshHousingUI() {
    const capacity = 3 + housesBuilt * 2;
    housingStatus.textContent = "MORADORES · " + residents.length + "/" + capacity + " vagas · CASAS CONSTRUÍDAS · " + housesBuilt + "/6";
    buildHouseButton.disabled = housesBuilt >= HOUSE_SLOTS.length || (Number(state.wood)||0) < 16 || (Number(state.stone)||0) < 8;
    buildHouseButton.textContent = housesBuilt >= HOUSE_SLOTS.length ? "LIMITE DE CASAS ATINGIDO" : "🏠 CASA · 16 MADEIRAS + 8 PEDRAS";
    recruitButton.disabled = residents.length >= capacity || (Number(state.coins)||0) < 25;
    recruitButton.textContent = residents.length >= capacity ? "CONSTRUA UMA CASA PARA MAIS VAGAS" : "👥 RECRUTAR · 25 MOEDAS";
  }
  function addRecruit() {
    const capacity = 3 + housesBuilt * 2;
    if (residents.length >= capacity || (Number(state.coins)||0) < 25) return;
    const recruitIndex = residents.length - 3;
    const houseIndex = Math.floor(recruitIndex / 2);
    const slot = HOUSE_SLOTS[houseIndex];
    if (!slot) return;
    const side = recruitIndex % 2 === 0 ? -1.25 : 1.25;
    const home = [slot[0] + side, slot[1] + 1.25];
    const usedNames = new Set(residents.map(r => r.name));
    const name = recruitNames.find(candidate => !usedNames.has(candidate)) || ("Morador " + (residents.length + 1));
    const professionKeys = ["farmer","lumberjack","mason"];
    const profession = professionKeys[(residents.length - 3) % professionKeys.length];
    const resident = {
      id:"central-recruit-"+Date.now()+"-"+residents.length, name, role:professions[profession].label, profession,
      model:residents.length % 2 ? "Worker_Male.gltf" : "Worker_Female.gltf",
      start:home, home, work:professionWorkPoints[profession], greeting:"Sou " + name + ". Vim construir uma vida nesta aldeia e ajudar a comunidade."
    };
    resident.group = new THREE.Group();
    resident.group.position.set(home[0],terrainHeight(home[0],home[1]),home[1]);
    scene.add(resident.group);
    resident.fallback = makeFallback(resident.group,0x80694d);
    skills[resident.id] = {xp:0,level:1};
    workElapsed[resident.id] = 0;
    resident.nameTag = makeNameTag(resident.name,resident.role,skills[resident.id].level);
    resident.group.add(resident.nameTag);
    resident.actions = {}; resident.mixer = null; resident.moving = false; resident.target = null;
    resident.routeKey = ""; resident.routeIndex = 0; resident.idleAction = null; resident.walkAction = null;
    resident.setMoving = moving => {
      if (resident.moving === moving) return;
      resident.moving = moving;
      const next = moving ? resident.walkAction : resident.idleAction;
      const previous = moving ? resident.idleAction : resident.walkAction;
      if (previous) previous.fadeOut(.18);
      if (next) next.reset().fadeIn(.18).play();
    };
    residents.push(resident);
    loadResidentModel(resident,resident.group,resident.fallback);
    state.coins -= 25;
    refreshRoster(); renderWorkPanel(); saveVillageProgress(); refreshStockpileUI(); refreshHousingUI();
    if (onSave) onSave();
    onToast(name + " chegou à aldeia central como " + professions[profession].label + ".");
  }
  buildHouseButton.addEventListener("click",() => {
    if (housesBuilt >= HOUSE_SLOTS.length || (Number(state.wood)||0) < 16 || (Number(state.stone)||0) < 8) return;
    state.wood -= 16; state.stone -= 8;
    buildHouse(housesBuilt); housesBuilt++;
    saveVillageProgress(); refreshHousingUI(); refreshStockpileUI();
    if (onSave) onSave();
    onToast("Casa construída! A aldeia central agora pode abrigar mais dois moradores.");
  });
  recruitButton.addEventListener("click",addRecruit);

  function saveVillageProgress() {
    try {
      const jobs = {};
      for (const resident of residents) jobs[resident.id] = { profession: resident.profession, enabled: resident.enabled };
      const recruits = residents.filter(r => r.isRecruit).map(r => ({ id:r.id, name:r.name, role:r.role, profession:r.profession, model:r.model, start:r.start, home:r.home, work:r.work, greeting:r.greeting }));
      localStorage.setItem(SAVE_KEY, JSON.stringify({ met: residents.filter(r => r.met).map(r => r.id), jobs, stockpile, morale, lastUpkeepDay, skills, recruits, houses:housesBuilt }));
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
    workSummary.textContent = residents.filter(r => r.enabled && r.profession !== "idle").length + "/" + residents.length + " moradores em atividade · produção guardada no depósito.";
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

  refreshHousingUI();
  refreshStockpileUI();

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

  function updateSkillProgressUI(resident) {
    const row = workList.querySelector('[data-resident-id="' + resident.id + '"]');
    if (!row) return;
    const skill = skills[resident.id];
    const job = professions[resident.profession];
    const bonus = productionBonus(resident);
    const skillProgress = skill.level >= 10 ? 100 : Math.min(100, Math.round(skill.xp / experienceNeeded(skill.level) * 100));
    const production = row.querySelector(".production");
    if (production) {
      const skillLine = skill.level >= 10 ? "NÍVEL 10 · MESTRE" : "NÍVEL " + skill.level + " · XP " + skill.xp + "/" + experienceNeeded(skill.level) + (bonus ? " · +" + bonus + " por ciclo" : "");
      production.textContent = job.resource ? (job.detail || ("Produz " + job.amount + " " + job.resourceLabel + " por ciclo de trabalho.")) + " " + skillLine : "Sem produção atribuída. " + skillLine;
    }
    const fill = row.querySelector('[aria-label="Progresso da profissão de ' + resident.name + '"] > div');
    if (fill) fill.style.width = skillProgress + "%";
    const caption = row.querySelector(".production[style*='text-align:right']");
    if (caption) caption.textContent = skill.level >= 10 ? "MAESTRIA ALCANÇADA" : "PROGRESSO PARA O PRÓXIMO NÍVEL · " + skillProgress + "%";
  }

  function renderWorkPanel() {
    workList.innerHTML = "";
    for (const resident of residents) {
      const row = document.createElement("div");
      row.className = "work-row";
      row.dataset.residentId = resident.id;
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
        refreshRoster();
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
      const skillTrack = document.createElement("div");
      skillTrack.setAttribute("aria-label", "Progresso da profissão de " + resident.name);
      skillTrack.style.cssText = "height:5px;margin-top:6px;border-radius:5px;background:#ffffff24;overflow:hidden";
      const skillFill = document.createElement("div");
      const skillProgress = skill.level >= 10 ? 100 : Math.min(100, Math.round(skill.xp / experienceNeeded(skill.level) * 100));
      skillFill.style.cssText = "height:100%;width:" + skillProgress + "%;border-radius:5px;background:linear-gradient(90deg,#8d9f65,#e6c979);transition:width .25s ease";
      skillTrack.appendChild(skillFill);
      const skillCaption = document.createElement("div");
      skillCaption.className = "production";
      skillCaption.style.cssText = "font-size:9px;text-align:right;color:#d6c58f";
      skillCaption.textContent = skill.level >= 10 ? "MAESTRIA ALCANÇADA" : "PROGRESSO PARA O PRÓXIMO NÍVEL · " + skillProgress + "%";
      row.append(head, select, toggle, production, skillTrack, skillCaption);
      workList.appendChild(row);
    }
    refreshStockpileUI();
  }
  function makeNameTag(name, role, level) {
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
    context.fillText((role + " · NÍVEL " + level).toUpperCase(), 256, 88);
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

  const houseObjects = [];
  const houseWood = new THREE.MeshStandardMaterial({ color: 0x765333, roughness: .95 });
  const houseRoof = new THREE.MeshStandardMaterial({ color: 0x514033, roughness: 1 });
  const houseStone = new THREE.MeshStandardMaterial({ color: 0x77746a, roughness: 1 });
  function buildHouse(index) {
    const slot = HOUSE_SLOTS[index];
    if (!slot) return;
    const group = new THREE.Group();
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(5.2,.3,4.6),houseStone);
    foundation.position.y=.15; foundation.receiveShadow=true; group.add(foundation);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(4.8,2.65,4.2),houseWood);
    walls.position.y=1.62; walls.castShadow=true; walls.receiveShadow=true; group.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.7,2.25,4),houseRoof);
    roof.rotation.y=Math.PI/4; roof.position.y=4.03; roof.castShadow=true; group.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(.85,1.8,.12),houseRoof);
    door.position.set(0,1.05,2.17); group.add(door);
    const windowMaterial = new THREE.MeshStandardMaterial({color:0x9eb5a4,emissive:0x263c32,roughness:.45});
    for (const side of [-1,1]) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(.8,.72,.1),windowMaterial);
      window.position.set(side*1.45,1.95,2.18); group.add(window);
    }
    group.position.set(slot[0],terrainHeight(slot[0],slot[1]),slot[1]);
    scene.add(group); houseObjects.push(group);
  }
  for (let i=0;i<housesBuilt;i++) buildHouse(i);

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
    resident.nameTag = makeNameTag(resident.name, resident.role, skills[resident.id].level);
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
  refreshRoster();
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
    resident.nameTag = makeNameTag(resident.name, resident.role, skills[resident.id].level);
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
            updateResidentNameTag(resident);
            renderWorkPanel();
            onToast(resident.name + " evoluiu na profissão! Agora está no nível " + skills[resident.id].level + ".");
          } else {
            updateSkillProgressUI(resident);
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
        productionLine.textContent = active + "/" + residents.length + " moradores em atividade · ciclos durante o expediente.";
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
