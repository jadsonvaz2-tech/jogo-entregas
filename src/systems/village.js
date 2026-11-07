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
  let prosperityXp = Math.max(0, Math.floor(Number(saved.prosperityXp) || 0));
  let storageLevel = Math.max(0, Math.min(3, Math.floor(Number(saved.storageLevel) || 0)));
  let lastUpkeepDay = Number.isFinite(Number(saved.lastUpkeepDay)) ? Math.max(1, Number(saved.lastUpkeepDay)) : Math.max(1, Number(state.day) || 1);
  const WORK_SHIFTS = { reduced:{label:"Jornada reduzida · 7h–17h",start:7,end:17,detail:"Menos horas de trabalho e mais tempo de descanso."}, normal:{label:"Jornada normal · 6h–19h30",start:6,end:19.5,detail:"Equilíbrio entre produção e descanso."}, extended:{label:"Jornada estendida · 5h–21h",start:5,end:21,detail:"Mais tempo de produção, com menos descanso."} };
  let workShift = Object.prototype.hasOwnProperty.call(WORK_SHIFTS,saved.workShift) ? saved.workShift : "normal";
  const RECRUIT_PROFESSIONS = ["auto","farmer","lumberjack","mason","hunter","herbalist","gatherer","tanner","shepherd","beekeeper"];
  let nextRecruitProfession = RECRUIT_PROFESSIONS.includes(saved.nextRecruitProfession) ? saved.nextRecruitProfession : "auto";
  const FOOD_RESERVE_TARGETS = [1,3,5,7];
  const FOOD_RATION_POLICIES = ["berries-first","meat-first"];
  const WORK_PRIORITIES = ["low","normal","high"];
  let foodReserveTargetDays = FOOD_RESERVE_TARGETS.includes(Number(saved.foodReserveTargetDays)) ? Number(saved.foodReserveTargetDays) : 3;
  let foodRationPolicy = FOOD_RATION_POLICIES.includes(saved.foodRationPolicy) ? saved.foodRationPolicy : "berries-first";
  const COMMUNAL_MEAL_POLICIES = ["auto","berries","meat"];
  let communalMealPolicy = COMMUNAL_MEAL_POLICIES.includes(saved.communalMealPolicy) ? saved.communalMealPolicy : "auto";
  let protectFoodReserve = saved.protectFoodReserve === true;
  const stockpile = Object.fromEntries(["wood","stone","berries","meat","herbs","hide","fiber","wool","honey"].map(key => [key, Math.max(0, Number(saved.stockpile?.[key]) || 0)]));
  const RESOURCE_KEYS = ["wood","stone","berries","meat","herbs","hide","fiber","wool","honey"];
  const resourceTargets = Object.fromEntries(RESOURCE_KEYS.map(key => [
    key, Math.max(0, Math.min(200, Math.floor(Number(saved.resourceTargets?.[key]) || 0)))
  ]));
  const legacyStorageFloor = Object.values(stockpile).reduce((sum, amount) => sum + amount, 0);
  const RESOURCE_LABELS = {wood:"Madeira",stone:"Pedra",berries:"Frutas",meat:"Carne",herbs:"Ervas",hide:"Peles",fiber:"Fibras",wool:"Lã",honey:"Mel"};
  const savedProduction = saved.productionReport && typeof saved.productionReport === "object" ? saved.productionReport : {};
  const savedFoodReport = saved.foodReport && typeof saved.foodReport === "object" ? saved.foodReport : {};
  const foodReport = {
    fedDays: Math.max(0, Math.floor(Number(savedFoodReport.fedDays) || 0)),
    missedDays: Math.max(0, Math.floor(Number(savedFoodReport.missedDays) || 0)),
    berriesUsed: Math.max(0, Math.floor(Number(savedFoodReport.berriesUsed) || 0)),
    meatUsed: Math.max(0, Math.floor(Number(savedFoodReport.meatUsed) || 0)),
    communalMeals: Math.max(0, Math.floor(Number(savedFoodReport.communalMeals) || 0)),
    communalBerries: Math.max(0, Math.floor(Number(savedFoodReport.communalBerries) || 0)),
    communalMeat: Math.max(0, Math.floor(Number(savedFoodReport.communalMeat) || 0)),
    history: Array.isArray(savedFoodReport.history) ? savedFoodReport.history.slice(-7).map(entry => ({
      day: Math.max(1, Math.floor(Number(entry?.day) || 1)),
      fed: entry?.fed === true,
      berries: Math.max(0, Math.floor(Number(entry?.berries) || 0)),
      meat: Math.max(0, Math.floor(Number(entry?.meat) || 0))
    })) : []
  };
  const productionReport = {
    produced: Math.max(0, Math.floor(Number(savedProduction.produced) || 0)),
    stored: Math.max(0, Math.floor(Number(savedProduction.stored) || 0)),
    lost: Math.max(0, Math.floor(Number(savedProduction.lost) || 0)),
    byResource: Object.fromEntries(Object.keys(RESOURCE_LABELS).map(key => [key, Math.max(0, Math.floor(Number(savedProduction.byResource?.[key]) || 0))])),
    byResident: savedProduction.byResident && typeof savedProduction.byResident === "object" ? Object.fromEntries(Object.entries(savedProduction.byResident).map(([id,entry]) => [id,{name:String(entry?.name || "Morador"),amount:Math.max(0,Math.floor(Number(entry?.amount)||0)),stored:Math.max(0,Math.floor(Number(entry?.stored)||0))}])) : {}
  };
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
      greeting: recruit.greeting || "Obrigado por me receber nesta aldeia.", isRecruit: true, homeSlot: recruit.homeSlot || null
    });
  }
  let housesBuilt = Math.max(0, Math.min(6, Math.floor(Number(saved.houses) || 0)));
  const HOUSE_SLOTS = [[-15,14],[15,14],[-15,-14],[15,-14],[-23,0],[23,0]];
  const ORIGINAL_HOMES = { lina: [-5.5,1.5], odo: [6.2,1.2], toma: [0.8,7.2] };
  function homePosition(slotId) {
    if (slotId && slotId.startsWith("original-")) return ORIGINAL_HOMES[slotId.slice(9)] || [0,0];
    const match = /^house-(\d+)-(\d+)$/.exec(slotId || "");
    if (!match) return [0,0];
    const center = HOUSE_SLOTS[Number(match[1])];
    if (!center) return [0,0];
    return [center[0] + (Number(match[2]) === 0 ? -1.25 : 1.25), center[1] + 1.25];
  }
  function housingSlots() {
    const slots = Object.entries(ORIGINAL_HOMES).map(([id]) => ({id:"original-"+id,label:"Moradia original · "+({lina:"Lina",odo:"Odo",toma:"Tomé"}[id])}));
    for (let house=0;house<housesBuilt;house++) for (let bed=0;bed<2;bed++) slots.push({id:"house-"+house+"-"+bed,label:"Casa "+(house+1)+" · Cama "+(bed+1)});
    return slots;
  }
  for (let i=0;i<residents.length;i++) {
    const resident=residents[i], savedHome=saved.homes && saved.homes[resident.id];
    if (savedHome && Array.isArray(savedHome.position)) { resident.home=[...savedHome.position]; resident.homeSlot=savedHome.slot || resident.homeSlot; }
    if (!resident.homeSlot) resident.homeSlot=i<3 ? "original-"+resident.id : "house-"+Math.floor((i-3)/2)+"-"+((i-3)%2);
    if (i>=3 && !savedHome) resident.home=homePosition(resident.homeSlot);
  }
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
    #village-work #village-work-shift{margin:4px 0 2px;border-color:#d6b45d;font-weight:700}
    #village-work button{margin-top:5px;width:100%;padding:7px;border:1px solid #b99b5c;border-radius:6px;background:#52634a;color:#fff1cc;font:700 10px system-ui}
    #village-work .production{color:#c4cfaa;font-size:10px;margin-top:3px}
    #village-work #village-alerts{margin:8px 0;padding:8px;border:1px solid #8a774b;border-radius:7px;background:#202d22}
    #village-work #village-alerts strong{margin:0 0 5px;color:#f0d58a}
    #village-work #village-alerts .village-alert{padding:3px 0;border-top:1px solid #ffffff18;color:#e9d9b6;font-size:10px}
    #village-work #village-alerts .village-alert:first-of-type{border-top:0}
    #village-work #village-alerts .village-alert[data-level="critical"]{color:#ffb0a0}
    #village-work #village-alerts .village-alert[data-level="warning"]{color:#f0d58a}
    #village-work #village-alerts .village-alert[data-level="good"]{color:#b9d48d}
    #village-work #village-production-report,#village-work #village-food-report{margin:8px 0;padding:8px;border:1px solid #65714d;border-radius:7px;background:#202d22}
    #village-work #village-food-report .food-report-totals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin:6px 0}
    #village-work #village-food-report .food-report-total{padding:5px;border-radius:5px;background:#293b2d;text-align:center;color:#c4cfaa;font-size:9px}
    #village-work #village-food-report .food-report-total b{display:block;color:#f0d58a;font-size:14px}
    #village-work #village-food-report .food-history{display:grid;gap:3px;margin-top:6px}
    #village-work #village-food-report .food-day{display:flex;justify-content:space-between;gap:6px;padding:3px 0;border-top:1px solid #ffffff18;color:#e6ddc7;font-size:9px}
    #village-work #village-food-report .food-day[data-fed="false"]{color:#ffb0a0}
    #village-work #village-production-report .report-totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin:6px 0}
    #village-work #village-production-report .report-total{padding:5px 2px;border-radius:5px;background:#293b2d;text-align:center;color:#c4cfaa;font-size:9px}
    #village-work #village-production-report .report-total b{display:block;color:#f0d58a;font-size:14px}
    #village-work #village-production-report .report-resources{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px 8px;color:#c4cfaa;font-size:9px}
    #village-work #village-production-report .report-resources span{display:flex;justify-content:space-between;gap:5px;border-top:1px solid #ffffff14;padding-top:3px}
    #village-work #village-production-report .report-contributors{margin-top:8px;padding-top:6px;border-top:1px solid #ffffff25}
    #village-work #village-production-report .contributor{display:flex;justify-content:space-between;gap:8px;padding:3px 0;color:#e6ddc7;font-size:10px}
    #village-work #village-production-report .contributor small{color:#aebd91}
    #village-work .stockpile-heading{margin:10px 0 6px;padding-top:9px;border-top:1px solid #b99b5c88;color:#f0d58a;font-weight:800;font-size:11px;letter-spacing:.04em}
    #village-work .stockpile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
    #village-work .stockpile-item{display:flex;justify-content:space-between;align-items:center;gap:4px;padding:6px;background:#293b2d;border:1px solid #65714d;border-radius:6px;color:#eee5cf;font-size:11px}
    #village-work .stockpile-item b{color:#f5d98c;font-size:13px}
    #village-work .stockpile-capacity{margin-top:7px;padding:7px;background:#3a482f;border-radius:6px;color:#f0d58a;font-weight:800;text-align:center}
    #village-work #village-housing-roster{margin:6px 0 9px;padding:7px;border:1px solid #65714d;border-radius:7px;background:#202d22}
    #village-work .housing-card{padding:5px 0;border-top:1px solid #ffffff20}
    #village-work .housing-card:first-child{border-top:0}
    #village-work .housing-card strong{display:block;color:#f0d58a;font-size:10px}
    #village-work .housing-bed{display:flex;justify-content:space-between;gap:6px;padding:2px 0;color:#d8dfc5;font-size:10px}
    #village-work .housing-bed[data-occupied="false"] span:last-child{color:#b9d48d}
    #village-work .resource-target-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:6px 0}
    #village-work .resource-target{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:4px 5px;background:#29372a;border-radius:5px;font-size:10px}
    #village-work .resource-target input{width:48px;min-width:0;padding:4px;text-align:center}
    #village-work .stockpile-item{display:block}
    #village-work .stockpile-item .stockpile-resource{display:flex;justify-content:space-between;gap:5px;align-items:center}
    #village-work .stockpile-item .personal-count{display:block;margin:3px 0;color:#c4cfaa;font-size:9px}
    #village-work .stockpile-item .stockpile-actions{display:grid;grid-template-columns:1fr 1fr;gap:4px}
    #village-work .stockpile-item .stockpile-actions button{margin:0;padding:5px 2px;font-size:9px;min-height:27px}
    #village-work .stockpile-item .stockpile-actions button:disabled{opacity:.4}
    @media(max-width:600px){#village-work{top:390px;right:7px;width:174px;max-height:35vh;padding:7px;font-size:10px}#village-work select{padding:6px;font-size:10px}#village-work .stockpile-grid{grid-template-columns:1fr 1fr}#village-work .stockpile-item{font-size:10px;padding:5px}}
    @media(min-width:800px){#village-work{top:390px;right:20px;width:220px;max-height:48vh}}
  `;
  document.head.appendChild(workStyle);
  const workPanel = document.createElement("section");
  workPanel.id = "village-work";
  workPanel.innerHTML = '<strong>ADMINISTRAÇÃO DA ALDEIA CENTRAL</strong><label class="production" for="village-work-shift">JORNADA DOS MORADORES</label><select id="village-work-shift" aria-label="Jornada de trabalho da aldeia"><option value="reduced">Jornada reduzida · 7h–17h</option><option value="normal">Jornada normal · 6h–19h30</option><option value="extended">Jornada estendida · 5h–21h</option></select><div id="village-shift-detail" class="production"></div><label class="production" for="village-food-reserve-target">META DE RESERVA DE ALIMENTOS</label><select id="village-food-reserve-target" aria-label="Meta de dias de reserva de alimentos"><option value="1">1 dia · economia de espaço</option><option value="3">3 dias · equilibrado</option><option value="5">5 dias · segurança</option><option value="7">7 dias · grande reserva</option></select><div id="village-food-priority" class="production"></div><label class="production" for="village-protect-food-reserve"><input id="village-protect-food-reserve" type="checkbox"> PROTEGER RESERVA DE ALIMENTOS</label><div id="village-food-protection-detail" class="production"></div><label class="production" for="village-ration-policy">POLÍTICA DE DISTRIBUIÇÃO DE ALIMENTOS</label><select id="village-ration-policy" aria-label="Política de distribuição de alimentos"><option value="berries-first">Frutas primeiro · preservar carne</option><option value="meat-first">Carne primeiro · preservar frutas</option></select><div id="village-ration-policy-detail" class="production"></div><div class="stockpile-heading">METAS DE ESTOQUE DA ALDEIA</div><div class="production">Defina quanto deseja manter de cada recurso. A profissão responsável recebe prioridade enquanto o estoque estiver abaixo da meta.</div><div id="village-resource-targets" class="resource-target-grid"></div><div id="village-material-priority" class="production"></div><div id="village-housing-status" class="production"></div><div id="village-housing-roster" aria-live="polite"></div><button id="village-auto-assign-homes" type="button">ATRIBUIR MORADORES SEM CAMA</button><div id="village-security-status" class="production"></div><div id="village-alerts" aria-live="polite"><strong>CONDIÇÃO DA ALDEIA</strong></div><div class="village-management-actions"><button id="village-build-house" type="button">🏠 CONSTRUIR CASA · 16 MADEIRAS + 8 PEDRAS</button><label class="production" for="village-next-recruit-profession">PROFISSÃO DO PRÓXIMO RECRUTA</label><select id="village-next-recruit-profession" aria-label="Profissão do próximo morador recrutado"><option value="auto">Automática · rodízio</option><option value="farmer">Agricultor(a)</option><option value="lumberjack">Lenhador</option><option value="mason">Pedreiro</option><option value="hunter">Caçador(a)</option><option value="herbalist">Herborista</option><option value="gatherer">Coletor(a)</option><option value="tanner">Curtidor(a)</option><option value="shepherd">Pastor(a)</option><option value="beekeeper">Apicultor(a)</option></select><button id="village-recruit" type="button">👥 RECRUTAR · 25 MOEDAS</button></div><label class="production" for="village-resident-search">BUSCAR MORADOR</label><input id="village-resident-search" type="search" placeholder="Digite o nome..." autocomplete="off"><label class="production" for="village-resident-filter">FILTRAR POR PROFISSÃO</label><select id="village-resident-filter" aria-label="Filtrar moradores por profissão"><option value="all">Todas as profissões</option><option value="farmer">Agricultores</option><option value="lumberjack">Lenhadores</option><option value="mason">Pedreiros</option><option value="hunter">Caçadores</option><option value="herbalist">Herboristas</option><option value="gatherer">Coletores</option><option value="tanner">Curtidores</option><option value="shepherd">Pastores</option><option value="beekeeper">Apicultores</option><option value="guard">Vigias</option><option value="idle">Sem tarefa</option></select><div id="village-resident-filter-count" class="production" aria-live="polite"></div><div class="work-list"></div><div id="village-morale" class="production"></div><div id="village-prosperity" class="production"></div><label class="production" for="village-communal-meal-policy">INGREDIENTE DA REFEIÇÃO COMUNITÁRIA</label><select id="village-communal-meal-policy" aria-label="Escolher ingrediente da refeição comunitária"><option value="auto">Automático · frutas primeiro</option><option value="berries">Somente frutas · 5 unidades</option><option value="meat">Somente carne · 3 unidades</option></select><button id="village-communal-meal" type="button">PREPARAR REFEIÇÃO · 5 FRUTAS</button><div id="village-stockpile" class="production"></div><button id="village-upgrade-storage" type="button">MELHORAR DEPÓSITO</button><button id="village-collect-stockpile" type="button">RECOLHER PRODUÇÃO</button><div id="village-work-summary" class="production"></div><div id="village-food-report" class="production"></div><div id="village-production-report" class="production"></div>';
  if (managementRoot) managementRoot.appendChild(workPanel);
  else document.body.appendChild(workPanel);
  const workList = workPanel.querySelector(".work-list");
  const residentSearchInput = workPanel.querySelector("#village-resident-search");
  const residentProfessionFilter = workPanel.querySelector("#village-resident-filter");
  const residentFilterCount = workPanel.querySelector("#village-resident-filter-count");
  const RESIDENT_STATUS_FILTERS = ["all","working","paused"];
  let residentStatusFilter = RESIDENT_STATUS_FILTERS.includes(saved.residentStatusFilter) ? saved.residentStatusFilter : "all";
  const RESIDENT_HOUSING_FILTERS = ["all","housed","unhoused"];
  let residentHousingFilter = RESIDENT_HOUSING_FILTERS.includes(saved.residentHousingFilter) ? saved.residentHousingFilter : "all";
  const residentStatusLabel = document.createElement("label");
  residentStatusLabel.className = "production";
  residentStatusLabel.htmlFor = "village-resident-status-filter";
  residentStatusLabel.textContent = "FILTRAR POR SITUAÇÃO";
  const residentStatusSelect = document.createElement("select");
  residentStatusSelect.id = "village-resident-status-filter";
  residentStatusSelect.setAttribute("aria-label", "Filtrar moradores por situação");
  residentStatusSelect.innerHTML = '<option value="all">Todos os moradores</option><option value="working">Trabalhando</option><option value="paused">Pausados ou sem tarefa</option>';
  residentStatusSelect.value = residentStatusFilter;
  residentFilterCount.parentNode.insertBefore(residentStatusLabel,residentFilterCount);
  residentFilterCount.parentNode.insertBefore(residentStatusSelect,residentFilterCount);
  const residentHousingLabel=document.createElement("label");
  residentHousingLabel.className="production";
  residentHousingLabel.htmlFor="village-resident-housing-filter";
  residentHousingLabel.textContent="FILTRAR POR MORADIA";
  const residentHousingSelect=document.createElement("select");
  residentHousingSelect.id="village-resident-housing-filter";
  residentHousingSelect.setAttribute("aria-label","Filtrar moradores por situação de moradia");
  residentHousingSelect.innerHTML='<option value="all">Todas as moradias</option><option value="housed">Com cama atribuída</option><option value="unhoused">Sem moradia atribuída</option>';
  residentHousingSelect.value=residentHousingFilter;
  residentFilterCount.parentNode.insertBefore(residentHousingLabel,residentFilterCount);
  residentFilterCount.parentNode.insertBefore(residentHousingSelect,residentFilterCount);
  const residentBulkActions = document.createElement("div");
  residentBulkActions.id = "village-resident-bulk-actions";
  residentBulkActions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:8px 0";
  const activateVisibleButton = document.createElement("button");
  activateVisibleButton.type = "button";
  activateVisibleButton.textContent = "▶ ATIVAR EXIBIDOS";
  activateVisibleButton.setAttribute("aria-label","Ativar tarefas dos moradores exibidos");
  const pauseVisibleButton = document.createElement("button");
  pauseVisibleButton.type = "button";
  pauseVisibleButton.textContent = "Ⅱ PAUSAR EXIBIDOS";
  pauseVisibleButton.setAttribute("aria-label","Pausar tarefas dos moradores exibidos");
  const bulkPrioritySelect = document.createElement("select");
  bulkPrioritySelect.id = "village-resident-bulk-priority";
  bulkPrioritySelect.setAttribute("aria-label","Prioridade para moradores exibidos");
  for(const [value,label] of [["low","Prioridade baixa"],["normal","Prioridade normal"],["high","Prioridade alta"]]){
    const option=document.createElement("option");option.value=value;option.textContent=label;bulkPrioritySelect.appendChild(option);
  }
  const applyBulkPriorityButton = document.createElement("button");
  applyBulkPriorityButton.type = "button";
  applyBulkPriorityButton.textContent = "APLICAR PRIORIDADE";
  applyBulkPriorityButton.setAttribute("aria-label","Aplicar prioridade aos moradores exibidos");
  const bulkProfessionSelect = document.createElement("select");
  bulkProfessionSelect.id = "village-resident-bulk-profession";
  bulkProfessionSelect.setAttribute("aria-label","Profissão para moradores exibidos");
  const bulkProfessionPlaceholder = document.createElement("option");
  bulkProfessionPlaceholder.value = "";
  bulkProfessionPlaceholder.textContent = "Profissão para exibidos...";
  bulkProfessionSelect.appendChild(bulkProfessionPlaceholder);
  for(const [value,profession] of Object.entries(professions)){
    const option=document.createElement("option");option.value=value;option.textContent=profession.label;bulkProfessionSelect.appendChild(option);
  }
  const applyBulkProfessionButton = document.createElement("button");
  applyBulkProfessionButton.type = "button";
  applyBulkProfessionButton.textContent = "ATRIBUIR PROFISSÃO";
  applyBulkProfessionButton.setAttribute("aria-label","Atribuir profissão aos moradores exibidos");
  const bulkPatrolSelect = document.createElement("select");
  bulkPatrolSelect.id = "village-resident-bulk-patrol";
  bulkPatrolSelect.setAttribute("aria-label","Rota de patrulha para guardas exibidos");
  bulkPatrolSelect.innerHTML = '<option value="">Rota para guardas exibidos...</option><option value="outer">Perímetro externo</option><option value="inner">Caminho interno</option><option value="central">Faixa central</option>';
  const applyBulkPatrolButton = document.createElement("button");
  applyBulkPatrolButton.type = "button";
  applyBulkPatrolButton.textContent = "APLICAR ROTA AOS GUARDAS";
  applyBulkPatrolButton.setAttribute("aria-label","Aplicar rota de patrulha aos guardas exibidos");
  residentBulkActions.append(activateVisibleButton,pauseVisibleButton,bulkPrioritySelect,applyBulkPriorityButton,bulkProfessionSelect,applyBulkProfessionButton,bulkPatrolSelect,applyBulkPatrolButton);
  residentFilterCount.parentNode.insertBefore(residentBulkActions,residentFilterCount);
  const RESIDENT_SORTS = ["name","level","production","profession"];
  let residentSort = RESIDENT_SORTS.includes(saved.residentSort) ? saved.residentSort : "name";
  const residentSortSelect = document.createElement("select");
  residentSortSelect.id = "village-resident-sort";
  residentSortSelect.setAttribute("aria-label", "Ordenar moradores");
  residentSortSelect.innerHTML = '<option value="name">Nome · A a Z</option><option value="level">Experiência · maior nível</option><option value="production">Produção · maior contribuição</option><option value="profession">Profissão · A a Z</option>';
  residentSortSelect.value = residentSort;
  residentSearchInput.parentNode.insertBefore(residentSortSelect, residentSearchInput);
  const workShiftSelect = workPanel.querySelector("#village-work-shift");
  const workShiftDetail = workPanel.querySelector("#village-shift-detail");
  const foodReserveSelect = workPanel.querySelector("#village-food-reserve-target");
  const foodPriorityDisplay = workPanel.querySelector("#village-food-priority");
  const protectFoodReserveInput = workPanel.querySelector("#village-protect-food-reserve");
  const foodProtectionDetail = workPanel.querySelector("#village-food-protection-detail");
  const refreshFoodProtectionUI = () => {
    protectFoodReserveInput.checked = protectFoodReserve;
    foodProtectionDetail.textContent = protectFoodReserve
      ? "Ativo: retiradas e recolhimento preservam até " + foodReserveTargetDays + " dia(s) de comida para os moradores."
      : "Desativado: você pode retirar toda a comida do depósito.";
  };
  protectFoodReserveInput.checked = protectFoodReserve;
  protectFoodReserveInput.addEventListener("change", () => {
    protectFoodReserve = protectFoodReserveInput.checked;
    saveVillageProgress();
    refreshFoodProtectionUI();
    refreshStockpileUI();
    onToast(protectFoodReserve ? "Reserva alimentar protegida contra retiradas." : "Proteção da reserva alimentar desativada.");
  });
  const resourceTargetsDisplay = workPanel.querySelector("#village-resource-targets");
  const materialPriorityDisplay = workPanel.querySelector("#village-material-priority");
  const RESOURCE_ICONS = {wood:"🪵",stone:"🪨",berries:"🫐",meat:"🥩",herbs:"🌿",hide:"🟤",fiber:"🧵",wool:"🐑",honey:"🍯"};
  function refreshMaterialTargetsUI() {
    resourceTargetsDisplay.innerHTML = RESOURCE_KEYS.map(key =>
      '<label class="resource-target"><span>' + RESOURCE_ICONS[key] + ' ' + RESOURCE_LABELS[key] + '</span><input type="number" min="0" max="200" step="1" inputmode="numeric" data-resource-target="' + key + '" value="' + resourceTargets[key] + '" aria-label="Meta de ' + RESOURCE_LABELS[key] + '"></label>'
    ).join("");
    for (const input of resourceTargetsDisplay.querySelectorAll("[data-resource-target]")) {
      input.addEventListener("change", () => updateMaterialTarget(input.dataset.resourceTarget, input));
    }
    const active = RESOURCE_KEYS.filter(key => resourceTargets[key] > stockpile[key]);
    materialPriorityDisplay.textContent = active.length
      ? "PRIORIDADE ATIVA · " + active.map(key => RESOURCE_LABELS[key] + ": faltam " + (resourceTargets[key] - stockpile[key])).join(" · ") + ". Profissões responsáveis aceleram até 18%."
      : "Metas atingidas ou desativadas · produção normal.";
  }
  function updateMaterialTarget(resource, input) {
    const value = Number(input.value);
    if (!RESOURCE_KEYS.includes(resource) || !Number.isFinite(value) || value < 0 || value > 200) {
      input.value = String(resourceTargets[resource] || 0);
      onToast("A meta deve ficar entre 0 e 200 unidades.");
      return;
    }
    resourceTargets[resource] = Math.floor(value);
    saveVillageProgress();
    refreshStockpileUI();
    onToast("Meta de " + RESOURCE_LABELS[resource].toLowerCase() + " atualizada.");
  }
  refreshMaterialTargetsUI();

  const rationPolicySelect = workPanel.querySelector("#village-ration-policy");
  const rationPolicyDetail = workPanel.querySelector("#village-ration-policy-detail");
  const refreshRationPolicyUI = () => {
    rationPolicySelect.value = foodRationPolicy;
    rationPolicyDetail.textContent = foodRationPolicy === "meat-first"
      ? "O consumo diário usa carne antes das frutas; cada carne vale até duas porções."
      : "O consumo diário usa frutas antes da carne; cada carne vale até duas porções.";
  };
  rationPolicySelect.value = foodRationPolicy;
  rationPolicySelect.addEventListener("change", () => {
    if (!FOOD_RATION_POLICIES.includes(rationPolicySelect.value)) { refreshRationPolicyUI(); return; }
    foodRationPolicy = rationPolicySelect.value;
    saveVillageProgress();
    refreshRationPolicyUI();
    onToast(foodRationPolicy === "meat-first" ? "A aldeia agora prioriza carne nas refeições diárias." : "A aldeia agora prioriza frutas nas refeições diárias.");
  });
  refreshRationPolicyUI();
  refreshFoodProtectionUI();
  foodReserveSelect.value = String(foodReserveTargetDays);
  foodReserveSelect.addEventListener("change", () => {
    const target = Number(foodReserveSelect.value);
    if (!FOOD_RESERVE_TARGETS.includes(target)) { foodReserveSelect.value = String(foodReserveTargetDays); return; }
    foodReserveTargetDays = target;
    saveVillageProgress();
    refreshStockpileUI();
    refreshFoodProtectionUI();
    onToast("Meta de alimentos da aldeia definida para " + target + " dia(s).");
  });
  workShiftSelect.value = workShift;
  const refreshWorkShiftUI = () => { workShiftSelect.value = workShift; workShiftDetail.textContent = WORK_SHIFTS[workShift].detail; };
  workShiftSelect.addEventListener("change", () => {
    if (!Object.prototype.hasOwnProperty.call(WORK_SHIFTS,workShiftSelect.value)) { refreshWorkShiftUI(); return; }
    workShift = workShiftSelect.value;
    for (const resident of residents) { resident.routeKey = ""; resident.target = null; resident.routeIndex = 0; }
    saveVillageProgress();
    refreshWorkShiftUI();
    onToast("Jornada da aldeia alterada: " + WORK_SHIFTS[workShift].label + ".");
  });
  refreshWorkShiftUI();
  const stockpileDisplay = workPanel.querySelector("#village-stockpile");
  const collectStockpileButton = workPanel.querySelector("#village-collect-stockpile");
  const upgradeStorageButton = workPanel.querySelector("#village-upgrade-storage");
  const workSummary = workPanel.querySelector("#village-work-summary");
  const productionReportDisplay = workPanel.querySelector("#village-production-report");
  const upkeepStatus = document.createElement("div");
  upkeepStatus.className = "production";
  upkeepStatus.style.marginTop = "4px";
  workPanel.insertBefore(upkeepStatus, stockpileDisplay);
  const moraleDisplay = workPanel.querySelector("#village-morale");
  const communalMealButton = workPanel.querySelector("#village-communal-meal");
  const communalMealPolicySelect = workPanel.querySelector("#village-communal-meal-policy");
  communalMealPolicySelect.value = communalMealPolicy;
  communalMealPolicySelect.addEventListener("change", () => {
    if (!COMMUNAL_MEAL_POLICIES.includes(communalMealPolicySelect.value)) { communalMealPolicySelect.value = communalMealPolicy; return; }
    communalMealPolicy = communalMealPolicySelect.value;
    saveVillageProgress();
    refreshStockpileUI();
    onToast(communalMealPolicy === "berries" ? "Refeições comunitárias usarão somente frutas." : communalMealPolicy === "meat" ? "Refeições comunitárias usarão somente carne." : "Refeições comunitárias escolherão frutas primeiro e carne como alternativa.");
  });

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
    hunter: { label: "Caçador", resource: "meat", resourceLabel: "carnes", amount: 1, detail: "Rastreia animais e traz carne para as provisões." },
    herbalist: { label: "Herborista", resource: "herbs", resourceLabel: "ervas", amount: 2, detail: "Recolhe ervas medicinais para curativos e poções." },
    gatherer: { label: "Coletor", resource: "fiber", resourceLabel: "fibras", amount: 2, detail: "Reúne fibras vegetais para cordas e construções." },
    tanner: { label: "Curtidor", resource: "hide", resourceLabel: "peles", amount: 1, detail: "Prepara peles para roupas e equipamentos." },
    shepherd: { label: "Pastor", resource: "wool", resourceLabel: "lãs", amount: 1, detail: "Cuida dos rebanhos e separa lã para a comunidade." },
    beekeeper: { label: "Apicultor", resource: "honey", resourceLabel: "méis", amount: 1, detail: "Cuida das colmeias e recolhe mel." },
    guard: { label: "Vigia", resource: null, resourceLabel: "—", amount: 0, detail: "Faz rondas pelos limites da aldeia, ganha experiência patrulhando e melhora a cobertura de vigilância." },
    idle: { label: "Sem tarefa", resource: null, resourceLabel: "—", amount: 0 }
  };
  const workElapsed = Object.fromEntries(residents.map(resident=>[resident.id,0]));
  const professionWorkPoints = {
    farmer: [[-8.2, 1.5], [-7.1, 4.2]],
    lumberjack: [[9.1, 1.4], [8.4, -2.2]],
    mason: [[2.5, 9.2], [4.1, 7.4]],
    hunter: [[-12.5,-5.5],[-10.2,-8.2]], herbalist: [[-3.5,11.5],[-1.5,13]],
    gatherer: [[-11,7],[-8.5,9]], tanner: [[12,8],[14,10]],
    shepherd: [[16,-7],[18,-9]], beekeeper: [[-17,-7],[-19,-9]],
    guard: [[-12,-12],[12,-12],[12,12],[-12,12]]
  };
  const housingStatus = workPanel.querySelector("#village-housing-status");
  const housingRosterDisplay = workPanel.querySelector("#village-housing-roster");
  const autoAssignHomesButton = workPanel.querySelector("#village-auto-assign-homes");
  const villageAlerts = workPanel.querySelector("#village-alerts");
  const securityDisplay = workPanel.querySelector("#village-security-status");
  const buildHouseButton = workPanel.querySelector("#village-build-house");
  const recruitButton = workPanel.querySelector("#village-recruit");
  const nextRecruitProfessionSelect = workPanel.querySelector("#village-next-recruit-profession");
  nextRecruitProfessionSelect.value = nextRecruitProfession;
  function availableConstructionResource(resource) {
    return Math.max(0, Math.floor(Number(state[resource]) || 0))
      + Math.max(0, Math.floor(Number(stockpile[resource]) || 0))
      + Math.max(0, Math.floor(Number(state.storage?.[resource]) || 0));
  }
  function takeConstructionResource(resource, amount) {
    let remaining = amount;
    const backpack = Math.min(remaining, Math.max(0, Math.floor(Number(state[resource]) || 0)));
    state[resource] = Math.max(0, Math.floor(Number(state[resource]) || 0)) - backpack;
    remaining -= backpack;
    const communal = Math.min(remaining, Math.max(0, Math.floor(Number(stockpile[resource]) || 0)));
    stockpile[resource] -= communal;
    remaining -= communal;
    if (remaining > 0 && state.storage) {
      const stored = Math.min(remaining, Math.max(0, Math.floor(Number(state.storage[resource]) || 0)));
      state.storage[resource] -= stored;
      remaining -= stored;
    }
    return remaining === 0;
  }
  function refreshHousingUI() {
    const capacity = 3 + housesBuilt * 2;
    const assigned = residents.filter(r => r.homeSlot && housingSlots().some(slot => slot.id === r.homeSlot)).length;
    const woodAvailable = availableConstructionResource("wood");
    const stoneAvailable = availableConstructionResource("stone");
    const woodBackpack = Math.max(0, Math.floor(Number(state.wood) || 0));
    const stoneBackpack = Math.max(0, Math.floor(Number(state.stone) || 0));
    const woodCommunal = Math.max(0, Math.floor(Number(stockpile.wood) || 0));
    const stoneCommunal = Math.max(0, Math.floor(Number(stockpile.stone) || 0));
    const woodChest = Math.max(0, Math.floor(Number(state.storage?.wood) || 0));
    const stoneChest = Math.max(0, Math.floor(Number(state.storage?.stone) || 0));
    const missingWood = Math.max(0, 16 - woodAvailable);
    const missingStone = Math.max(0, 8 - stoneAvailable);
    housingStatus.textContent = "MORADORES · " + residents.length + "/" + capacity + " vagas · CAMAS · " + assigned + "/" + residents.length + " · CASAS · " + housesBuilt + "/6 · CASA: MADEIRA " + woodAvailable + "/16 (mochila " + woodBackpack + " + depósito " + woodCommunal + " + baú " + woodChest + ") · PEDRA " + stoneAvailable + "/8 (mochila " + stoneBackpack + " + depósito " + stoneCommunal + " + baú " + stoneChest + ").";
    buildHouseButton.disabled = housesBuilt >= HOUSE_SLOTS.length || missingWood > 0 || missingStone > 0;
    buildHouseButton.textContent = housesBuilt >= HOUSE_SLOTS.length
      ? "LIMITE DE CASAS ATINGIDO"
      : missingWood || missingStone
        ? "FALTAM " + missingWood + " MADEIRAS · " + missingStone + " PEDRAS"
        : "🏠 CONSTRUIR CASA · 16 MADEIRAS + 8 PEDRAS";
    recruitButton.disabled = residents.length >= capacity || (Number(state.coins)||0) < 25;
    recruitButton.textContent = residents.length >= capacity ? "CONSTRUA UMA CASA PARA MAIS VAGAS" : "👥 RECRUTAR · 25 MOEDAS";
    const slots = housingSlots();
    const cards = [
      ...Object.entries(ORIGINAL_HOMES).map(([id]) => ({
        title: "Moradia original · " + ({lina:"Lina",odo:"Odo",toma:"Tomé"}[id]),
        beds: slots.filter(slot => slot.id === "original-" + id)
      })),
      ...Array.from({length:housesBuilt},(_,house)=>({
        title:"Casa " + (house + 1),
        beds:slots.filter(slot=>slot.id.startsWith("house-" + house + "-"))
      }))
    ];
    housingRosterDisplay.replaceChildren();
    const heading=document.createElement("strong");
    heading.className="stockpile-heading";
    heading.textContent="OCUPAÇÃO DAS MORADIAS";
    housingRosterDisplay.appendChild(heading);
    for (const cardData of cards) {
      const card=document.createElement("div");
      card.className="housing-card";
      const title=document.createElement("strong");
      const occupants=cardData.beds.filter(slot=>residents.some(person=>person.homeSlot===slot.id)).length;
      title.textContent=cardData.title+" · "+occupants+"/"+cardData.beds.length+" cama(s)";
      card.appendChild(title);
      for (const slot of cardData.beds) {
        const occupant=residents.find(person=>person.homeSlot===slot.id);
        const line=document.createElement("div");
        line.className="housing-bed";
        line.dataset.occupied=String(Boolean(occupant));
        const bed=document.createElement("span");
        bed.textContent=slot.label.replace("Moradia original · ","").replace("Casa "+(Number((/^house-(\\d+)-/.exec(slot.id)||[])[1]||0)+1)+" · ","Cama ");
        const name=document.createElement("span");
        name.textContent=occupant ? occupant.name : "Vaga livre";
        line.append(bed,name);
        card.appendChild(line);
      }
      housingRosterDisplay.appendChild(card);
    }
    const unassigned=residents.filter(person=>!slots.some(slot=>slot.id===person.homeSlot));
    const freeBeds=slots.filter(slot=>!residents.some(person=>person.homeSlot===slot.id)).length;
    autoAssignHomesButton.disabled=unassigned.length===0 || freeBeds===0;
    autoAssignHomesButton.textContent=unassigned.length
      ? "ATRIBUIR " + Math.min(unassigned.length,freeBeds) + " MORADOR(ES) ÀS CAMAS LIVRES"
      : "TODOS OS MORADORES TÊM CAMA";
    if(unassigned.length){
      const warning=document.createElement("div");
      warning.className="housing-bed";
      warning.textContent="Sem cama atribuída: "+unassigned.map(person=>person.name).join(", ");
      housingRosterDisplay.appendChild(warning);
    }
  }
  function addRecruit() {
    const capacity = 3 + housesBuilt * 2;
    if (residents.length >= capacity || (Number(state.coins)||0) < 25) return;
    const recruitIndex = residents.length - 3;
    const availableHome = housingSlots().find(slot => !residents.some(person => person.homeSlot === slot.id));
    if (!availableHome) return;
    const homeSlot = availableHome.id;
    const home = homePosition(homeSlot);
    const usedNames = new Set(residents.map(r => r.name));
    const name = recruitNames.find(candidate => !usedNames.has(candidate)) || ("Morador " + (residents.length + 1));
    const professionKeys = RECRUIT_PROFESSIONS.filter(key => key !== "auto");
    const profession = nextRecruitProfession === "auto"
      ? professionKeys[(residents.length - 3) % professionKeys.length]
      : nextRecruitProfession;
    const resident = {
      id:"central-recruit-"+Date.now()+"-"+residents.length, name, role:professions[profession].label, profession, isRecruit:true,
      model:residents.length % 2 ? "Worker_Male.gltf" : "Worker_Female.gltf",
      start:home, home, homeSlot, work:professionWorkPoints[profession], greeting:"Sou " + name + ". Vim construir uma vida nesta aldeia e ajudar a comunidade."
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
  nextRecruitProfessionSelect.addEventListener("change",()=>{
    const selected=RECRUIT_PROFESSIONS.includes(nextRecruitProfessionSelect.value) ? nextRecruitProfessionSelect.value : "auto";
    nextRecruitProfession=selected;
    saveVillageProgress();
    const label=selected==="auto" ? "rodízio automático" : professions[selected].label;
    onToast("Próximo recrutamento: "+label+".");
  });
  autoAssignHomesButton.addEventListener("click",()=>{
    const slots=housingSlots();
    const occupied=new Set(residents.filter(person=>slots.some(slot=>slot.id===person.homeSlot)).map(person=>person.homeSlot));
    let assignedCount=0;
    for(const resident of residents){
      if(slots.some(slot=>slot.id===resident.homeSlot)) continue;
      const freeSlot=slots.find(slot=>!occupied.has(slot.id));
      if(!freeSlot) break;
      resident.homeSlot=freeSlot.id;
      resident.home=homePosition(freeSlot.id);
      resident.routeKey="";
      resident.routeIndex=0;
      resident.target=resident.home;
      occupied.add(freeSlot.id);
      assignedCount++;
    }
    if(!assignedCount){
      onToast("Não há camas livres. Construa outra casa para ampliar as vagas.");
      refreshHousingUI();
      return;
    }
    saveVillageProgress();
    refreshRoster();
    renderWorkPanel();
    refreshHousingUI();
    if(onSave) onSave();
    onToast(assignedCount+" morador(es) receberam uma cama livre na aldeia.");
  });
  buildHouseButton.addEventListener("click",() => {
    if (housesBuilt >= HOUSE_SLOTS.length) { onToast("A aldeia já atingiu o limite de seis casas novas."); return; }
    if (availableConstructionResource("wood") < 16 || availableConstructionResource("stone") < 8) {
      refreshHousingUI();
      onToast("Materiais insuficientes. A casa exige 16 madeiras e 8 pedras somando mochila, depósito comunitário e baú pessoal.");
      return;
    }
    if (!takeConstructionResource("wood",16) || !takeConstructionResource("stone",8)) {
      onToast("Não foi possível separar os materiais. Confira os estoques e tente novamente.");
      refreshHousingUI();
      return;
    }
    buildHouse(housesBuilt); housesBuilt++;
    saveVillageProgress(); refreshHousingUI(); refreshStockpileUI(); renderWorkPanel();
    if (onSave) onSave();
    onToast("Casa construída! A aldeia central agora pode abrigar mais dois moradores.");
  });
  recruitButton.addEventListener("click",addRecruit);

  function recordDailyFood(day, ration) {
    foodReport.fedDays += ration.fed ? 1 : 0;
    foodReport.missedDays += ration.fed ? 0 : 1;
    foodReport.berriesUsed += ration.berriesUsed;
    foodReport.meatUsed += ration.meatUsed;
    foodReport.history.push({ day, fed: ration.fed, berries: ration.berriesUsed, meat: ration.meatUsed });
    foodReport.history = foodReport.history.slice(-7);
  }

  function recordCommunalMeal(resource) {
    foodReport.communalMeals++;
    if (resource === "berries") foodReport.communalBerries += 5;
    else foodReport.communalMeat += 3;
  }

  function refreshFoodReport() {
    const display = workPanel.querySelector("#village-food-report");
    if (!display) return;
    display.innerHTML = "<strong>HISTÓRICO DE ALIMENTAÇÃO</strong>" +
      '<div class="food-report-totals"><div class="food-report-total"><b>' + foodReport.fedDays + '</b>dias abastecidos</div><div class="food-report-total"><b>' + foodReport.missedDays + '</b>dias sem alimento</div><div class="food-report-total"><b>' + foodReport.berriesUsed + '</b>frutas consumidas</div><div class="food-report-total"><b>' + foodReport.meatUsed + '</b>carnes consumidas</div></div>' +
      '<div class="production">REFEIÇÕES COMUNITÁRIAS · ' + foodReport.communalMeals + ' · ' + foodReport.communalBerries + ' frutas · ' + foodReport.communalMeat + ' carnes</div>' +
      '<div class="food-history">' + (foodReport.history.length ? foodReport.history.map(entry => '<div class="food-day" data-fed="' + entry.fed + '"><span>DIA ' + entry.day + ' · ' + (entry.fed ? "ABASTECIDO" : "FALTOU ALIMENTO") + '</span><span>' + entry.berries + ' frutas · ' + entry.meat + ' carnes</span></div>').join("") : '<div class="production">O histórico será preenchido após os próximos dias.</div>') + '</div>';
  }

  function saveVillageProgress() {
    try {
      const jobs = {};
      for (const resident of residents) jobs[resident.id] = { profession: resident.profession, enabled: resident.enabled, priority: resident.priority || "normal", ...(resident.patrolRoute ? { patrolRoute: resident.patrolRoute } : {}) };
      const recruits = residents.filter(r => r.isRecruit).map(r => ({ id:r.id, name:r.name, role:r.role, profession:r.profession, model:r.model, start:r.start, home:r.home, homeSlot:r.homeSlot, work:r.work, greeting:r.greeting }));
      const homes = Object.fromEntries(residents.map(r => [r.id,{slot:r.homeSlot,position:r.home}]));
      localStorage.setItem(SAVE_KEY, JSON.stringify({ met: residents.filter(r => r.met).map(r => r.id), jobs, stockpile, morale, prosperityXp, lastUpkeepDay, skills, recruits, houses:housesBuilt, homes, storageLevel, workShift, foodReserveTargetDays, foodRationPolicy, communalMealPolicy, protectFoodReserve, productionReport, foodReport, resourceTargets, nextRecruitProfession, residentSort, residentStatusFilter, residentHousingFilter }));
    } catch (error) {
      console.warn("Não foi possível salvar o progresso dos moradores.", error);
    }
  }

  function prosperityLevel() {
    if (prosperityXp >= 24) return 5;
    if (prosperityXp >= 15) return 4;
    if (prosperityXp >= 8) return 3;
    if (prosperityXp >= 3) return 2;
    return 1;
  }

  function gainProsperity(amount) {
    const previous = prosperityLevel();
    prosperityXp += Math.max(0, Math.floor(Number(amount) || 0));
    const current = prosperityLevel();
    saveVillageProgress();
    refreshStockpileUI();
    if (current > previous) onToast("A aldeia central prosperou! Nível " + current + " alcançado: os moradores trabalham com mais eficiência.");
  }

  function moraleDescription() {
    if (morale >= 75) return "POVOADO ANIMADO";
    if (morale >= 45) return "POVOADO ESTÁVEL";
    if (morale >= 25) return "POVOADO DESMOTIVADO";
    return "POVOADO DESANIMADO";
  }

  function dailyFoodNeed() { return Math.max(1, residents.length); }

  function foodReserveDays() {
    return Math.floor((stockpile.berries + stockpile.meat * 2) / dailyFoodNeed());
  }

  function foodWithdrawalLimit(resource) {
    if (!protectFoodReserve || (resource !== "berries" && resource !== "meat")) return stockpile[resource] || 0;
    const protectedRations = foodReserveTargetDays * dailyFoodNeed();
    const excessRations = Math.max(0, stockpile.berries + stockpile.meat * 2 - protectedRations);
    if (resource === "berries") return Math.min(stockpile.berries, excessRations);
    return Math.min(stockpile.meat, Math.floor(excessRations / 2));
  }

  function canServeCommunalMeal(resource) {
    const amount = resource === "berries" ? 5 : 3;
    if (stockpile[resource] < amount) return false;
    if (!protectFoodReserve) return true;
    const remainingRations = stockpile.berries + stockpile.meat * 2 - (resource === "berries" ? 5 : 6);
    return remainingRations >= foodReserveTargetDays * dailyFoodNeed();
  }

  function consumeDailyRation() {
    let needed = dailyFoodNeed();
    let berriesUsed = 0;
    let meatUsed = 0;
    if (foodRationPolicy === "meat-first") {
      meatUsed = Math.min(stockpile.meat, Math.ceil(needed / 2));
      stockpile.meat -= meatUsed;
      needed -= meatUsed * 2;
      berriesUsed = Math.min(stockpile.berries, Math.max(0, needed));
      stockpile.berries -= berriesUsed;
      needed -= berriesUsed;
    } else {
      berriesUsed = Math.min(stockpile.berries, needed);
      stockpile.berries -= berriesUsed;
      needed -= berriesUsed;
      meatUsed = Math.min(stockpile.meat, Math.ceil(needed / 2));
      stockpile.meat -= meatUsed;
      needed -= meatUsed * 2;
    }
    return { fed: needed <= 0, berriesUsed, meatUsed };
  }

  function stockpileTotal() {
    return Object.values(stockpile).reduce((sum, amount) => sum + amount, 0);
  }

  function storageCapacity() {
    return Math.max(100 + storageLevel * 100, legacyStorageFloor);
  }

  function storeResource(resource, amount) {
    const requested = Math.max(0, Math.floor(Number(amount) || 0));
    const accepted = Math.min(requested, Math.max(0, storageCapacity() - stockpileTotal()));
    if (accepted > 0) stockpile[resource] = (stockpile[resource] || 0) + accepted;
    return accepted;
  }

  function storageUpgradeCost() {
    return [{wood:30,stone:20},{wood:55,stone:40},{wood:80,stone:60}][storageLevel] || null;
  }

  function refreshStorageUpgradeUI() {
    const cost = storageUpgradeCost();
    if (!cost) {
      upgradeStorageButton.disabled = true;
      upgradeStorageButton.textContent = "DEPÓSITO NO NÍVEL MÁXIMO";
      return;
    }
    upgradeStorageButton.disabled = (Number(state.wood) || 0) < cost.wood || (Number(state.stone) || 0) < cost.stone;
    upgradeStorageButton.textContent = "AMPLIAR DEPÓSITO · NÍVEL " + (storageLevel + 1) + " · " + cost.wood + " MADEIRAS + " + cost.stone + " PEDRAS";
  }

  function transferStockpileResource(resource, direction, requestedAmount = null) {
    if (!Object.prototype.hasOwnProperty.call(stockpile, resource)) return;
    const personal = Math.max(0, Math.floor(Number(state[resource]) || 0));
    const requested = requestedAmount === null ? Infinity : Math.floor(Number(requestedAmount));
    if (!(requested > 0)) { onToast("Informe uma quantidade válida, maior que zero."); return; }
    if (direction === "deposit") {
      const amount = Math.min(personal, requested, Math.max(0, storageCapacity() - stockpileTotal()));
      if (amount < 1) {
        onToast(personal < 1 ? "Você não possui esse recurso na mochila." : "O depósito comunitário está cheio. Amplie sua capacidade em GESTÃO.");
        return;
      }
      state[resource] = personal - amount;
      stockpile[resource] += amount;
      onToast("Você guardou " + amount + " unidade(s) no depósito comunitário.");
    } else {
      const withdrawable = foodWithdrawalLimit(resource);
      const amount = Math.min(withdrawable, requested);
      if (amount < 1) {
        onToast(protectFoodReserve && (resource === "berries" || resource === "meat") ? "A proteção está preservando a reserva alimentar da aldeia." : "Não há esse recurso no depósito comunitário.");
        return;
      }
      state[resource] = personal + amount;
      stockpile[resource] -= amount;
      onToast("Você retirou " + amount + " unidade(s) do depósito comunitário.");
    }
    saveVillageProgress();
    if (onSave) onSave();
    refreshStockpileUI();
  }

  function recordProduction(resident, resource, produced, stored) {
    const amount = Math.max(0, Math.floor(Number(produced) || 0));
    const accepted = Math.max(0, Math.min(amount, Math.floor(Number(stored) || 0)));
    if (!Object.prototype.hasOwnProperty.call(RESOURCE_LABELS, resource) || amount < 1) return;
    productionReport.produced += amount;
    productionReport.stored += accepted;
    productionReport.lost += amount - accepted;
    productionReport.byResource[resource] += amount;
    const contribution = productionReport.byResident[resident.id] || {name:resident.name,amount:0,stored:0};
    contribution.name = resident.name;
    contribution.amount += amount;
    contribution.stored += accepted;
    productionReport.byResident[resident.id] = contribution;
  }

  function refreshProductionReport() {
    const rows = Object.entries(productionReport.byResource).filter(([,amount]) => amount > 0).sort((a,b) => b[1]-a[1]);
    productionReportDisplay.innerHTML = "<strong>PRODUÇÃO ACUMULADA DA ALDEIA</strong>" +
      '<div class="report-totals"><div class="report-total"><b>' + productionReport.produced + '</b>produzidas</div><div class="report-total"><b>' + productionReport.stored + '</b>armazenadas</div><div class="report-total"><b>' + productionReport.lost + '</b>sem espaço</div></div>' +
      '<div class="report-resources">' + (rows.length ? rows.map(([key,amount]) => "<span><span>" + RESOURCE_LABELS[key] + "</span><b>" + amount + "</b></span>").join("") : "<span>Nenhuma produção registrada</span>") + "</div>" +
      '<div class="report-contributors"><strong>CONTRIBUIÇÃO POR MORADOR</strong>' + Object.entries(productionReport.byResident).sort((a,b) => b[1].amount-a[1].amount).slice(0,5).map(([id,entry]) => '<div class="contributor"><span>' + entry.name + '</span><span><b>' + entry.amount + '</b> <small>produzidas · ' + entry.stored + ' guardadas</small></span></div>').join("") + (Object.keys(productionReport.byResident).length ? "" : '<div class="contributor"><span>Aguardando produção dos moradores</span></div>') + "</div>";
  }

  function refreshStockpileUI() {
    const resources = [
      ["🪵","Madeira","wood"],["🪨","Pedra","stone"],["🫐","Frutas","berries"],
      ["🥩","Carne","meat"],["🌿","Ervas","herbs"],["🟤","Peles","hide"],
      ["🧵","Fibras","fiber"],["🐑","Lã","wool"],["🍯","Mel","honey"]
    ];
    const total = stockpileTotal();
    stockpileDisplay.innerHTML = '<div class="stockpile-heading">DEPÓSITO COMUNITÁRIO · RECURSOS DA ALDEIA</div>' +
      '<div class="stockpile-grid">' + resources.map(([icon,label,key]) => {
        const personal = Math.max(0, Math.floor(Number(state[key]) || 0));
        return '<div class="stockpile-item" data-resource="' + key + '">' +
          '<div class="stockpile-resource"><span>' + icon + ' ' + label + '</span><b>' + stockpile[key] + '</b></div>' +
          '<span class="personal-count">Na sua mochila: ' + personal + '</span>' +
          '<div class="stockpile-quantity"><label>Quantidade <input type="number" min="1" step="1" inputmode="numeric" data-transfer-amount value="1" aria-label="Quantidade de ' + label + ' para transferir"></label></div>' +
          '<div class="stockpile-presets" aria-label="Atalhos de quantidade"><button type="button" data-transfer-preset="1">1</button><button type="button" data-transfer-preset="5">5</button><button type="button" data-transfer-preset="10">10</button><button type="button" data-transfer-preset="max">MÁX.</button></div>' +
          '<div class="stockpile-actions"><button type="button" data-transfer="deposit">GUARDAR TUDO</button><button type="button" data-transfer="withdraw">RETIRAR TUDO</button></div>' +
          '<div class="stockpile-actions"><button type="button" data-transfer="deposit-amount">GUARDAR QTD.</button><button type="button" data-transfer="withdraw-amount">RETIRAR QTD.</button></div></div>';
      }).join("") + '</div><div class="stockpile-capacity">TOTAL ARMAZENADO · ' + total + ' / ' + storageCapacity() + ' unidades</div>';
    for (const card of stockpileDisplay.querySelectorAll(".stockpile-item")) {
      const resource = card.dataset.resource;
      const personal = Math.max(0, Math.floor(Number(state[resource]) || 0));
      const deposit = card.querySelector('[data-transfer="deposit"]');
      const withdraw = card.querySelector('[data-transfer="withdraw"]');
      const depositAmount = card.querySelector('[data-transfer="deposit-amount"]');
      const withdrawAmount = card.querySelector('[data-transfer="withdraw-amount"]');
      const quantityInput = card.querySelector("[data-transfer-amount]");
      deposit.disabled = personal < 1 || total >= storageCapacity();
      const withdrawable = foodWithdrawalLimit(resource);
      withdraw.disabled = withdrawable < 1;
      depositAmount.disabled = personal < 1 || total >= storageCapacity();
      withdrawAmount.disabled = withdrawable < 1;
      quantityInput.max = String(Math.max(personal, stockpile[resource], 1));
      for (const preset of card.querySelectorAll("[data-transfer-preset]")) {
        preset.addEventListener("click", () => {
          const value = preset.dataset.transferPreset === "max"
            ? Math.max(personal, stockpile[resource], 1)
            : Number(preset.dataset.transferPreset);
          quantityInput.value = String(value);
          quantityInput.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }
      deposit.addEventListener("click", () => transferStockpileResource(resource, "deposit"));
      withdraw.addEventListener("click", () => transferStockpileResource(resource, "withdraw"));
      depositAmount.addEventListener("click", () => transferStockpileResource(resource, "deposit", quantityInput.value));
      withdrawAmount.addEventListener("click", () => transferStockpileResource(resource, "withdraw", quantityInput.value));
    }
    collectStockpileButton.disabled = total < 1;
    refreshStorageUpgradeUI();
    moraleDisplay.textContent = "ÂNIMO DO POVOADO · " + Math.round(morale) + "/100 · " + moraleDescription();
    const level = prosperityLevel();
    const nextThreshold = [0,3,8,15,24][level] ?? 24;
    const progress = level >= 5 ? "MAIOR NÍVEL ALCANÇADO" : (nextThreshold - prosperityXp) + " contribuição(ões) para o próximo nível";
    workPanel.querySelector("#village-prosperity").textContent = "PROSPERIDADE · NÍVEL " + level + "/5 · " + progress + " · refeições e dias abastecidos fortalecem a aldeia.";
    const canServeBerries = canServeCommunalMeal("berries");
    const canServeMeat = canServeCommunalMeal("meat");
    const mealUsesBerries = communalMealPolicy === "berries" || (communalMealPolicy === "auto" && (canServeBerries || !canServeMeat));
    const mealAvailable = mealUsesBerries ? canServeBerries : canServeMeat;
    communalMealPolicySelect.value = communalMealPolicy;
    communalMealButton.disabled = !mealAvailable || morale >= 100;
    communalMealButton.textContent = mealUsesBerries ? "PREPARAR REFEIÇÃO · 5 FRUTAS" : "PREPARAR REFEIÇÃO · 3 CARNES";
    const reserveDays = foodReserveDays();
    const reserveText = reserveDays === 1 ? "1 dia" : reserveDays + " dias";
    upkeepStatus.textContent = "RAÇÕES · " + dailyFoodNeed() + " por dia · frutas ou carne (vale 2 rações) · reserva para " + reserveText + (reserveDays < 2 ? " · REABASTECER" : " · suficiente");
    foodReserveSelect.value = String(foodReserveTargetDays);
    const foodPriorityActive = reserveDays < foodReserveTargetDays;
    foodPriorityDisplay.textContent = "META · " + foodReserveTargetDays + " dias · " + (foodPriorityActive ? "PRIORIDADE ATIVA: agricultor e caçador trabalham até 22% mais rápido." : "Reserva atingida · produção normal.");
    workSummary.textContent = residents.filter(r => r.enabled && r.profession !== "idle").length + "/" + residents.length + " moradores em atividade · produção guardada no depósito.";
    refreshProductionReport();
    refreshFoodReport();
    refreshMaterialTargetsUI();
    refreshHousingUI();
    refreshVillageAlerts(total, reserveDays);
  }

  function refreshVillageAlerts(total = stockpileTotal(), reserveDays = foodReserveDays()) {
    const capacity = 3 + housesBuilt * 2;
    const assigned = residents.filter(r => r.homeSlot && housingSlots().some(slot => slot.id === r.homeSlot)).length;
    const active = residents.filter(r => r.enabled && r.profession !== "idle").length;
    const alerts = [];
    if (reserveDays < 1) alerts.push(["critical", "ALIMENTO ESGOTADO · prepare ou recolha provisões para os moradores."]);
    else if (reserveDays < foodReserveTargetDays) alerts.push(["warning", "RESERVA BAIXA · faltam " + (foodReserveTargetDays - reserveDays) + " dia(s) para atingir a meta."]);
    else alerts.push(["good", "ALIMENTAÇÃO · reserva dentro da meta de " + foodReserveTargetDays + " dias."]);
    for (const key of RESOURCE_KEYS) {
      if (resourceTargets[key] > stockpile[key]) alerts.push(["warning", RESOURCE_LABELS[key].toUpperCase() + " · faltam " + (resourceTargets[key] - stockpile[key]) + " unidades para atingir a meta."]);
    }
    if (assigned < residents.length) alerts.push(["warning", "MORADIA · " + (residents.length - assigned) + " morador(es) sem cama atribuída."]);
    else if (residents.length > capacity) alerts.push(["critical", "MORADIA · população acima da capacidade disponível."]);
    else alerts.push(["good", "MORADIA · todos possuem cama atribuída."]);
    if (active < residents.length) alerts.push(["warning", "MÃO DE OBRA · " + (residents.length - active) + " morador(es) sem tarefa ativa."]);
    if (total >= storageCapacity()) alerts.push(["warning", "DEPÓSITO CHEIO · recolha ou retire recursos para liberar espaço."]);
    else if (total >= storageCapacity() * .9) alerts.push(["warning", "DEPÓSITO QUASE CHEIO · " + total + "/" + storageCapacity() + " unidades."]);
    else alerts.push(["good", "DEPÓSITO · " + total + "/" + storageCapacity() + " unidades ocupadas."]);
    villageAlerts.innerHTML = "<strong>CONDIÇÃO DA ALDEIA</strong>" + alerts.map(([level,message]) => {
      const line = document.createElement("div"); line.className = "village-alert"; line.dataset.level = level; line.textContent = message; return line.outerHTML;
    }).join("");
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
  refreshProductionReport();
  refreshStockpileUI();

  upgradeStorageButton.addEventListener("click", () => {
    const cost = storageUpgradeCost();
    if (!cost || (Number(state.wood) || 0) < cost.wood || (Number(state.stone) || 0) < cost.stone) return;
    state.wood -= cost.wood;
    state.stone -= cost.stone;
    storageLevel++;
    saveVillageProgress();
    if (onSave) onSave();
    refreshStockpileUI();
    onToast("Depósito comunitário ampliado! Capacidade agora: " + storageCapacity() + " unidades.");
  });

  communalMealButton.addEventListener("click", () => {
    if (morale >= 100) return;
    const previousProsperityLevel = prosperityLevel();
    const canServeBerries = canServeCommunalMeal("berries");
    const canServeMeat = canServeCommunalMeal("meat");
    const useBerries = communalMealPolicy === "berries" || (communalMealPolicy === "auto" && (canServeBerries || !canServeMeat));
    if (useBerries && canServeBerries) stockpile.berries -= 5;
    else if (!useBerries && canServeMeat) stockpile.meat -= 3;
    else { onToast(protectFoodReserve ? "A reserva protegida precisa permanecer intacta; não há excedente suficiente para essa refeição." : "Não há ingredientes suficientes para a opção de refeição escolhida."); return; }
    recordCommunalMeal(useBerries ? "berries" : "meat");
    morale = Math.min(100, morale + 15);
    prosperityXp += 2;
    saveVillageProgress();
    refreshStockpileUI();
    if (prosperityLevel() > previousProsperityLevel) onToast("A aldeia central avançou para o nível " + prosperityLevel() + " de prosperidade!");
    onToast("Refeição comunitária servida! O ânimo do povoado aumentou para " + Math.round(morale) + "/100.");
  });

  collectStockpileButton.addEventListener("click", () => {
    const amounts = { ...stockpile };
    if (protectFoodReserve) {
      let excessRations = Math.max(0, stockpile.berries + stockpile.meat * 2 - foodReserveTargetDays * dailyFoodNeed());
      amounts.berries = Math.min(stockpile.berries, excessRations);
      excessRations -= amounts.berries;
      amounts.meat = Math.min(stockpile.meat, Math.floor(excessRations / 2));
    }
    const total = Object.values(amounts).reduce((sum,value)=>sum+value,0);
    if (!total) { onToast(protectFoodReserve ? "Não há recursos disponíveis para recolher sem comprometer a reserva alimentar." : "O depósito comunitário está vazio."); return; }
    for (const [resource,amount] of Object.entries(amounts)) if (resource in state) state[resource] = Math.max(0,Number(state[resource])||0)+amount;
    for (const resource of Object.keys(stockpile)) stockpile[resource] = Math.max(0, stockpile[resource] - (amounts[resource] || 0));
    saveVillageProgress();
    onSave();
    refreshStockpileUI();
    onToast("Você recolheu a produção comunitária: " + Object.entries(amounts).filter(([,amount])=>amount>0).map(([resource,amount])=>amount+" "+({wood:"madeiras",stone:"pedras",berries:"frutas",meat:"carnes",herbs:"ervas",hide:"peles",fiber:"fibras",wool:"lãs",honey:"méis"}[resource]||resource)).join(", ")+".");
  });

  const GUARD_PATROL_ROUTES = {
    outer: { label: "perímetro externo", points: [[-12,-12],[12,-12],[12,12],[-12,12]] },
    inner: { label: "caminho interno", points: [[-9,-9],[9,-9],[9,9],[-9,9]] },
    central: { label: "faixa central", points: [[-12,-7],[12,-7],[12,7],[-12,7]] }
  };

  function guardPatrolFor(resident) {
    const guardIndex = residents.filter(person => person.profession === "guard").indexOf(resident);
    const routeKeys = Object.keys(GUARD_PATROL_ROUTES);
    const selectedKey = Object.prototype.hasOwnProperty.call(GUARD_PATROL_ROUTES, resident.patrolRoute)
      ? resident.patrolRoute
      : routeKeys[Math.max(0, guardIndex) % routeKeys.length];
    const route = GUARD_PATROL_ROUTES[selectedKey];
    const reverse = !resident.patrolRoute && guardIndex % 2 === 1;
    return { key: selectedKey, label: route.label, points: reverse ? [...route.points].reverse() : [...route.points] };
  }

  function refreshSecurityUI() {
    const activeGuards = residents.filter(resident => resident.profession === "guard" && resident.enabled);
    const guards = activeGuards.length;
    const averageLevel = guards ? activeGuards.reduce((sum, resident) => sum + (skills[resident.id]?.level || 1), 0) / guards : 0;
    const level = guards === 0 ? "SEM PATRULHA" : guards === 1 ? "VIGILÂNCIA BÁSICA" : guards <= 3 ? "VIGILÂNCIA REGULAR" : "VIGILÂNCIA REFORÇADA";
    const experience = guards ? " · EXPERIÊNCIA MÉDIA Nv. " + averageLevel.toFixed(1) + "/10" : "";
    const routeCounts = Object.fromEntries(Object.keys(GUARD_PATROL_ROUTES).map(key => [key, 0]));
    for (const resident of activeGuards) routeCounts[guardPatrolFor(resident).key]++;
    const coveredRoutes = Object.values(routeCounts).filter(count => count > 0).length;
    const coveragePercent = Math.round(coveredRoutes / Object.keys(GUARD_PATROL_ROUTES).length * 100);
    const routeSummary = Object.entries(GUARD_PATROL_ROUTES).map(([key, route]) => route.label + ": " + routeCounts[key]).join(" · ");
    const missingRoutes = Object.entries(GUARD_PATROL_ROUTES).filter(([key]) => routeCounts[key] === 0).map(([,route]) => route.label);
    const coverageDetail = guards === 0
      ? "Nenhum setor possui vigia ativo."
      : missingRoutes.length
        ? "Setores sem vigia: " + missingRoutes.join(", ") + "."
        : "Os três setores possuem ao menos um vigia ativo.";
    const patrolTeam = guards ? " · " + activeGuards.map(resident => resident.name + " Nv." + (skills[resident.id]?.level || 1) + " · " + guardPatrolFor(resident).label).join("; ") : "";
    const detail = guards === 0
      ? "Nenhum morador está fazendo rondas. Atribua a profissão Vigia para iniciar a patrulha."
      : "Cada ciclo completo concede experiência. A cobertura é um indicador de distribuição das rondas, não uma simulação de combate.";
    securityDisplay.textContent = "VIGILÂNCIA · " + level + " · " + guards + " VIGIA(S) · COBERTURA " + coveragePercent + "% · " + routeSummary + " · " + coverageDetail + experience + patrolTeam + ". " + detail;
  }

  function experienceNeeded(level) { return level * 5; }

  function productionBonus(resident) { return Math.floor((skills[resident.id].level - 1) / 2); }

  function workCycleFor(resident) {
    const baseWorkCycle = morale >= 75 ? 40 : morale < 25 ? 55 : 45;
    const prosperityReduction = (prosperityLevel() - 1) * 3;
    const masteryReduction = Math.min(8, (skills[resident.id].level - 1) * .9);
    const foodPriority = (resident.profession === "farmer" || resident.profession === "hunter") && foodReserveDays() < foodReserveTargetDays;
    const materialResource = professions[resident.profession]?.resource;
    const materialPriority = materialResource && resourceTargets[materialResource] > stockpile[materialResource];
    const priorityFactor = resident.priority === "high" ? .86 : resident.priority === "low" ? 1.18 : 1;
    return Math.max(24, (baseWorkCycle - prosperityReduction - masteryReduction) * (foodPriority ? .78 : 1) * (materialPriority ? .82 : 1) * priorityFactor);
  }

  function workEfficiencyLabel(resident) {
    const cycle = workCycleFor(resident);
    const foodPriority = (resident.profession === "farmer" || resident.profession === "hunter") && foodReserveDays() < foodReserveTargetDays;
    const workPriorityLabel = resident.priority === "high" ? "prioridade alta" : resident.priority === "low" ? "prioridade baixa" : "prioridade normal";
    const materialResource = professions[resident.profession]?.resource;
    const materialPriority = materialResource && resourceTargets[materialResource] > stockpile[materialResource];
    return "CICLO DE PRODUÇÃO · " + cycle.toFixed(0) + "s · " + workPriorityLabel + (foodPriority ? " · prioridade de alimentos" : materialPriority ? " · prioridade de materiais" : (skills[resident.id].level > 1 ? " · especialista acelera o trabalho" : ""));
  }

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
      const skillLine = (skill.level >= 10 ? "NÍVEL 10 · MESTRE" : "NÍVEL " + skill.level + " · XP " + skill.xp + "/" + experienceNeeded(skill.level)) + (bonus ? " · +" + bonus + " por ciclo" : "") + " · " + workEfficiencyLabel(resident);
      production.textContent = job.resource ? (job.detail || ("Produz " + job.amount + " " + job.resourceLabel + " por ciclo de trabalho.")) + " " + skillLine : (job.detail || "Sem produção atribuída.") + " " + skillLine;
    }
    const fill = row.querySelector('[aria-label="Progresso da profissão de ' + resident.name + '"] > div');
    if (fill) fill.style.width = skillProgress + "%";
    const caption = row.querySelector(".production[style*='text-align:right']");
    if (caption) caption.textContent = skill.level >= 10 ? "MAESTRIA ALCANÇADA" : "PROGRESSO PARA O PRÓXIMO NÍVEL · " + skillProgress + "%";
  }

  function applyResidentFilters() {
    const query=residentSearchInput.value.trim().toLocaleLowerCase("pt-BR");
    const profession=residentProfessionFilter.value;
    let visible=0;
    const working=residents.filter(resident=>resident.enabled && resident.profession!=="idle").length;
    const paused=residents.length-working;
    for(const row of workList.children){
      const name=(row.dataset.residentName||"").toLocaleLowerCase("pt-BR");
      const matchesName=!query || name.includes(query);
      const matchesProfession=profession==="all" || row.dataset.profession===profession;
      const matchesStatus=residentStatusFilter==="all" || row.dataset.workStatus===residentStatusFilter;
      const matchesHousing=residentHousingFilter==="all" || row.dataset.housingStatus===residentHousingFilter;
      row.hidden=!(matchesName && matchesProfession && matchesStatus && matchesHousing);
      if(!row.hidden) visible++;
    }
    const housed=residents.filter(resident=>!!resident.homeSlot).length;
    residentFilterCount.textContent=visible+" de "+residents.length+" morador(es) exibido(s) · "+working+" trabalhando · "+paused+" pausado(s) · "+housed+" com moradia · "+(residents.length-housed)+" sem moradia.";
  }
  function setVisibleResidentsWorkState(enabled) {
    let changed=0;
    for(const row of workList.children){
      if(row.hidden) continue;
      const resident=residents.find(item=>item.id===row.dataset.residentId);
      if(!resident || resident.profession==="idle" || resident.enabled===enabled) continue;
      resident.enabled=enabled;
      resident.routeKey="";
      resident.target=null;
      resident.routeIndex=0;
      changed++;
    }
    if(!changed){onToast(enabled ? "Nenhum morador exibido precisa ser ativado." : "Nenhum morador exibido precisa ser pausado.");return;}
    saveVillageProgress();
    renderWorkPanel();
    onToast(changed+" morador(es) "+(enabled ? "ativado(s)" : "pausado(s)")+".");
  }
  function setVisibleResidentsPriority(priority) {
    if(!WORK_PRIORITIES.includes(priority)){onToast("Selecione uma prioridade válida.");return;}
    let changed=0;
    for(const row of workList.children){
      if(row.hidden) continue;
      const resident=residents.find(item=>item.id===row.dataset.residentId);
      if(!resident || resident.profession==="idle" || (resident.priority||"normal")===priority) continue;
      resident.priority=priority;
      changed++;
    }
    if(!changed){onToast("Nenhum morador exibido precisa dessa prioridade.");return;}
    saveVillageProgress();
    renderWorkPanel();
    const label=bulkPrioritySelect.options[bulkPrioritySelect.selectedIndex].text;
    onToast("Prioridade "+label.replace("Prioridade ","").toLowerCase()+" aplicada a "+changed+" morador(es).");
  }
  applyBulkPriorityButton.addEventListener("click",()=>setVisibleResidentsPriority(bulkPrioritySelect.value));
  function setVisibleResidentsProfession(professionKey) {
    if(!Object.prototype.hasOwnProperty.call(professions,professionKey)){onToast("Escolha uma profissão válida.");return;}
    let changed=0;
    for(const row of workList.children){
      if(row.hidden) continue;
      const resident=residents.find(item=>item.id===row.dataset.residentId);
      if(!resident || resident.profession===professionKey) continue;
      resident.profession=professionKey;
      resident.role=professions[professionKey].label;
      if(professionKey==="idle") resident.enabled=false;
      else resident.enabled=true;
      if(professionKey==="guard" && !Object.prototype.hasOwnProperty.call(GUARD_PATROL_ROUTES,resident.patrolRoute)) resident.patrolRoute=guardPatrolFor(resident).key;
      resident.routeKey="";
      resident.target=null;
      resident.routeIndex=0;
      updateResidentNameTag(resident);
      changed++;
    }
    if(!changed){onToast("Nenhum morador exibido precisa dessa profissão.");return;}
    saveVillageProgress();
    refreshRoster();
    refreshSecurityUI();
    renderWorkPanel();
    onToast(professions[professionKey].label+" atribuída a "+changed+" morador(es) exibido(s).");
  }
  applyBulkProfessionButton.addEventListener("click",()=>setVisibleResidentsProfession(bulkProfessionSelect.value));
  function setVisibleResidentsPatrolRoute(routeKey) {
    if(!["outer","inner","central"].includes(routeKey)){onToast("Escolha uma rota de patrulha válida.");return;}
    let changed=0;
    for(const row of workList.children){
      if(row.hidden) continue;
      const resident=residents.find(item=>item.id===row.dataset.residentId);
      if(!resident || resident.profession!=="guard" || resident.patrolRoute===routeKey) continue;
      resident.patrolRoute=routeKey;
      resident.routeKey="";
      resident.target=null;
      resident.routeIndex=0;
      changed++;
    }
    if(!changed){onToast("Nenhum guarda exibido precisa dessa rota.");return;}
    saveVillageProgress();
    refreshSecurityUI();
    renderWorkPanel();
    const label=bulkPatrolSelect.options[bulkPatrolSelect.selectedIndex].text;
    onToast("Rota "+label.toLowerCase()+" aplicada a "+changed+" guarda(s) exibido(s).");
  }
  applyBulkPatrolButton.addEventListener("click",()=>setVisibleResidentsPatrolRoute(bulkPatrolSelect.value));
  activateVisibleButton.addEventListener("click",()=>setVisibleResidentsWorkState(true));
  pauseVisibleButton.addEventListener("click",()=>setVisibleResidentsWorkState(false));
  residentSearchInput.addEventListener("input",applyResidentFilters);
  residentProfessionFilter.addEventListener("change",applyResidentFilters);
  residentStatusSelect.addEventListener("change",()=>{
    if(!RESIDENT_STATUS_FILTERS.includes(residentStatusSelect.value)){residentStatusSelect.value=residentStatusFilter;return;}
    residentStatusFilter=residentStatusSelect.value;
    saveVillageProgress();
    applyResidentFilters();
  });
  residentHousingSelect.addEventListener("change",()=>{
    if(!RESIDENT_HOUSING_FILTERS.includes(residentHousingSelect.value)){residentHousingSelect.value=residentHousingFilter;return;}
    residentHousingFilter=residentHousingSelect.value;
    saveVillageProgress();
    applyResidentFilters();
  });
  residentSortSelect.addEventListener("change",()=>{
    if(!RESIDENT_SORTS.includes(residentSortSelect.value)){residentSortSelect.value=residentSort;return;}
    residentSort=residentSortSelect.value;
    saveVillageProgress();
    renderWorkPanel();
    onToast("Lista de moradores ordenada: "+residentSortSelect.options[residentSortSelect.selectedIndex].text+".");
  });

  function renderWorkPanel() {
    workList.innerHTML = "";
    const sortedResidents = [...residents].sort((a,b)=>{
      if(residentSort==="level") return (skills[b.id]?.level||1)-(skills[a.id]?.level||1) || (skills[b.id]?.xp||0)-(skills[a.id]?.xp||0) || a.name.localeCompare(b.name,"pt-BR");
      if(residentSort==="production") return (productionReport.byResident[b.id]?.amount||0)-(productionReport.byResident[a.id]?.amount||0) || a.name.localeCompare(b.name,"pt-BR");
      if(residentSort==="profession") return (professions[a.profession]?.label||"").localeCompare(professions[b.profession]?.label||"","pt-BR") || a.name.localeCompare(b.name,"pt-BR");
      return a.name.localeCompare(b.name,"pt-BR");
    });
    residentSortSelect.value=residentSort;
    for (const resident of sortedResidents) {
      const row = document.createElement("div");
      row.className = "work-row";
      row.dataset.residentId = resident.id;
      row.dataset.residentName = resident.name;
      row.dataset.profession = resident.profession;
      row.dataset.workStatus = resident.enabled && resident.profession !== "idle" ? "working" : "paused";
      row.dataset.housingStatus = resident.homeSlot ? "housed" : "unhoused";
      const head = document.createElement("div");
      head.className = "work-head";
      const name = document.createElement("b");
      name.textContent = resident.name;
      const status = document.createElement("span");
      status.textContent = resident.enabled && resident.profession !== "idle" ? "TRABALHANDO" : "PAUSADO";
      status.style.color = resident.enabled && resident.profession !== "idle" ? "#b9d48d" : "#d5aa83";
      head.append(name, status);
      const homeSelect = document.createElement("select");
      homeSelect.setAttribute("aria-label","Moradia de "+resident.name);
      for (const slot of housingSlots()) { const option=document.createElement("option"); option.value=slot.id; option.textContent=slot.label; homeSelect.appendChild(option); }
      homeSelect.value=resident.homeSlot || "";
      homeSelect.addEventListener("change",()=>{
        const occupied=residents.find(other=>other!==resident && other.homeSlot===homeSelect.value);
        if (occupied) { onToast("Esta cama já está atribuída a "+occupied.name+"."); homeSelect.value=resident.homeSlot; return; }
        resident.homeSlot=homeSelect.value; resident.home=homePosition(resident.homeSlot); resident.routeKey=""; resident.routeIndex=0; resident.target=resident.home;
        row.dataset.housingStatus=resident.homeSlot ? "housed" : "unhoused";
        saveVillageProgress(); refreshHousingUI(); applyResidentFilters(); onToast(resident.name+" agora mora em "+homeSelect.options[homeSelect.selectedIndex].text+".");
      });
      const select = document.createElement("select");
      select.setAttribute("aria-label", "Profissão de " + resident.name);
      for (const [value, profession] of Object.entries(professions)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = profession.label;
        select.appendChild(option);
      }
      select.value = resident.profession;
      const patrolLabel = document.createElement("label");
      patrolLabel.className = "production";
      patrolLabel.textContent = "ROTA DE PATRULHA";
      patrolLabel.hidden = resident.profession !== "guard";
      const patrolSelect = document.createElement("select");
      patrolSelect.setAttribute("aria-label", "Rota de patrulha de " + resident.name);
      for (const [value, route] of Object.entries(GUARD_PATROL_ROUTES)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = route.label.charAt(0).toUpperCase() + route.label.slice(1);
        patrolSelect.appendChild(option);
      }
      patrolSelect.value = guardPatrolFor(resident).key;
      patrolSelect.hidden = resident.profession !== "guard";
      patrolSelect.addEventListener("change", () => {
        if (!Object.prototype.hasOwnProperty.call(GUARD_PATROL_ROUTES, patrolSelect.value)) return;
        resident.patrolRoute = patrolSelect.value;
        resident.routeKey = "";
        resident.routeIndex = 0;
        resident.target = null;
        saveVillageProgress();
        refreshSecurityUI();
        onToast("Rota de " + resident.name + " alterada para " + GUARD_PATROL_ROUTES[resident.patrolRoute].label + ".");
      });
      select.addEventListener("change", () => {
        resident.profession = select.value;
        if (resident.profession === "guard" && !Object.prototype.hasOwnProperty.call(GUARD_PATROL_ROUTES, resident.patrolRoute)) resident.patrolRoute = guardPatrolFor(resident).key;
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
      const priorityLabel = document.createElement("label");
      priorityLabel.className = "production";
      priorityLabel.textContent = "PRIORIDADE DE TRABALHO";
      const prioritySelect = document.createElement("select");
      prioritySelect.setAttribute("aria-label", "Prioridade de trabalho de " + resident.name);
      for (const [value, label] of [["low","Baixa · ritmo tranquilo"],["normal","Normal · equilibrada"],["high","Alta · produção acelerada"]]) {
        const option = document.createElement("option"); option.value = value; option.textContent = label; prioritySelect.appendChild(option);
      }
      prioritySelect.value = resident.priority || "normal";
      prioritySelect.addEventListener("change", () => {
        if (!WORK_PRIORITIES.includes(prioritySelect.value)) return;
        resident.priority = prioritySelect.value;
        saveVillageProgress();
        renderWorkPanel();
        onToast("Prioridade de " + resident.name + ": " + prioritySelect.options[prioritySelect.selectedIndex].text + ".");
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
      const skillLine = (skill.level >= 10 ? "NÍVEL 10 · MESTRE" : "NÍVEL " + skill.level + " · XP " + skill.xp + "/" + experienceNeeded(skill.level)) + (bonus ? " · +" + bonus + " por ciclo" : "") + " · " + workEfficiencyLabel(resident);
      production.textContent = job.resource ? (job.detail || ("Produz " + job.amount + " " + job.resourceLabel + " por ciclo de trabalho.")) + " " + skillLine : (job.detail || "Sem produção atribuída.") + " " + skillLine;
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
      row.append(head, homeSelect, select, patrolLabel, patrolSelect, priorityLabel, prioritySelect, toggle, production, skillTrack, skillCaption);
      workList.appendChild(row);
    }
    applyResidentFilters();
    refreshStockpileUI();
    refreshSecurityUI();
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
    resident.priority = job && WORK_PRIORITIES.includes(job.priority) ? job.priority : "normal";
    resident.patrolRoute = job && ["outer","inner","central"].includes(job.patrolRoute) ? job.patrolRoute : "";
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
    const shift = WORK_SHIFTS[workShift];
    if (hour < shift.start || hour >= shift.end) return { key: "sleep", points: [resident.home] };
    if (hour >= 11.5 && hour < 13.5) return { key: "meal", points: [resident.home] };
    const workingHours = hour >= shift.start && hour < 11.5 || hour >= 13.5 && hour < shift.end;
    if (workingHours && (!resident.enabled || resident.profession === "idle")) {
      return { key: "resting-" + resident.id, points: [resident.home] };
    }
    const workPoints = resident.profession === "guard" ? guardPatrolFor(resident).points : professionWorkPoints[resident.profession];
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
      const previousProsperityLevel = prosperityLevel();
      while (lastUpkeepDay < currentDay) {
        lastUpkeepDay++;
        const ration = consumeDailyRation();
        recordDailyFood(lastUpkeepDay, ration);
        if (ration.fed) {
          morale = Math.min(100, morale + 4);
          fedDays++;
        } else {
          morale = Math.max(0, morale - 8);
          missedDays++;
        }
      }
      prosperityXp += fedDays;
      saveVillageProgress();
      refreshStockpileUI();
      if (prosperityLevel() > previousProsperityLevel) onToast("A aldeia central alcançou o nível " + prosperityLevel() + " de prosperidade graças às refeições diárias.");
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
      const shift = WORK_SHIFTS[workShift];
      const workingTime = hour >= shift.start && hour < 11.5 || hour >= 13.5 && hour < shift.end;
      const job = professions[resident.profession];
      if (resident.enabled && job && (job.resource || resident.profession === "guard") && workingTime) {
        workElapsed[resident.id] += Math.max(0, dt);
        const workCycle = workCycleFor(resident);
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
          if (resident.profession === "guard") {
            refreshSecurityUI();
            continue;
          }
          const farmResult = resident.profession === "farmer" && typeof onFarmAction === "function" && stockpileTotal() < storageCapacity() ? onFarmAction() : null;
          if (farmResult && typeof farmResult === "object" && farmResult.resource && Number(farmResult.amount) > 0) {
            const produced = Number(farmResult.amount) + bonus;
            const stored = storeResource(farmResult.resource, produced);
            recordProduction(resident, farmResult.resource, produced, stored);
            saveVillageProgress();
            refreshStockpileUI();
            onToast((farmResult.message || "Lina trabalhou na horta.") + (stored < produced ? " Depósito cheio: " + stored + "/" + produced + " unidades armazenadas." : (bonus ? " Bônus de experiência: +" + bonus + " unidade(s)." : "")));
          } else if (farmResult) {
            onToast(farmResult);
          } else {
            const produced = job.amount + bonus;
            const stored = storeResource(job.resource, produced);
            recordProduction(resident, job.resource, produced, stored);
            saveVillageProgress();
            refreshStockpileUI();
            onToast(stored > 0 ? resident.name + " armazenou " + stored + " " + job.resourceLabel + " no depósito comunitário." + (stored < produced ? " O depósito está cheio; amplie-o em GESTÃO." : "") : "Depósito comunitário cheio! Amplie a capacidade em GESTÃO para retomar a produção.");
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
      refreshHousingUI();
      refreshSecurityUI();
      roster.querySelector("div:last-child").textContent = hour >= 20 || hour < 5.5
        ? "Todos descansam · " + hourText
        : hour >= 11.5 && hour < 13.5
          ? "Pausa para refeição · " + hourText
          : "Trabalho no povoado · " + hourText;
    }
  }

  return { update, getStockpile, takeFromStockpile, getMorale: () => morale };
}