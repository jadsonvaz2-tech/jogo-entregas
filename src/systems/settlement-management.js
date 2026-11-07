const SAVE_KEY = "cronicas-floresta-settlement-management-v1";
const ROLES = ["Agricultor","Lenhador","Caçador","Pastor","Artesão","Construtor","Comerciante"];
const NAMES = ["Aldo","Bruna","Caio","Dora","Estevão","Flora","Hugo","Iara","Jorge","Lina","Mateus","Nara","Otávio","Rosa","Silas","Tereza"];
const HOUSE_SLOTS = [[-13,20],[0,23],[13,20],[-13,-20],[0,-23],[13,-20],[-23,0],[23,0]];

export function createSettlementManagement({ THREE, scene, player, terrainHeight, state, onToast, economy, residents, onChange }) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") || {}; } catch (error) { console.warn("Gestão das povoações indisponível.", error); }
  const towns = economy.towns.map(town => {
    const record = saved.towns && saved.towns[town.id] || {};
    return { ...town, houses: Math.max(0, Math.min(HOUSE_SLOTS.length, Number(record.houses) || 0)), houseObjects: [] };
  });
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x765333, roughness: .95 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x514033, roughness: 1 });
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x77746a, roughness: 1 });

  function save() {
    try {
      const data = { version: 1, towns: {} };
      for (const town of towns) data.towns[town.id] = { houses: town.houses };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (error) { console.warn("Não foi possível salvar a gestão das povoações.", error); }
  }

  function buildHouse(town, index) {
    const offset = HOUSE_SLOTS[index];
    if (!offset) return;
    const x = town.x + offset[0], z = town.z + offset[1];
    const group = new THREE.Group();
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(5.1,.32,4.5), stoneMaterial);
    foundation.position.y=.16; foundation.receiveShadow=true; group.add(foundation);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(4.7,2.7,4.1), woodMaterial);
    walls.position.y=1.62; walls.castShadow=true; walls.receiveShadow=true; group.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.65,2.35,4), roofMaterial);
    roof.rotation.y=Math.PI/4; roof.position.y=4.05; roof.castShadow=true; group.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(.85,1.8,.12), roofMaterial);
    door.position.set(0,1.08,2.12); group.add(door);
    const windowMat = new THREE.MeshStandardMaterial({color:0x9eb5a4,emissive:0x263c32,roughness:.45});
    for (const side of [-1,1]) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(.8,.72,.1),windowMat);
      window.position.set(side*1.45,1.95,2.13); group.add(window);
    }
    group.position.set(x,terrainHeight(x,z),z);
    scene.add(group); town.houseObjects.push(group);
  }

  for (const town of towns) for (let i=0;i<town.houses;i++) buildHouse(town,i);

  const trigger = document.createElement("button");
  trigger.type="button"; trigger.hidden=true; trigger.textContent="🏘️ GERENCIAR POVOAÇÃO";
  trigger.style.cssText="position:fixed;z-index:47;left:50%;bottom:138px;transform:translateX(-50%);padding:11px 15px;border:1px solid #d6b45d;border-radius:22px;background:rgba(35,49,34,.98);color:#fff1cc;font:800 11px system-ui;box-shadow:0 4px 16px #0008;touch-action:manipulation";
  document.body.appendChild(trigger);

  const panel=document.createElement("section");
  panel.hidden=true;
  panel.style.cssText="position:fixed;z-index:82;left:50%;top:50%;transform:translate(-50%,-50%);width:min(470px,calc(100vw - 24px));max-height:82vh;overflow:auto;padding:16px;border:1px solid #d6b45d;border-radius:14px;background:linear-gradient(145deg,#293a2a,#17231b);color:#f3e8c9;box-shadow:0 18px 55px #000b;font:13px/1.5 system-ui";
  panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><small style="color:#c5c99e;letter-spacing:.12em">ADMINISTRAÇÃO MEDIEVAL</small><h2 id="settlement-manage-title" style="margin:2px 0;color:#e6c979;font:700 22px Georgia">Povoação</h2></div><button id="settlement-manage-close" type="button" style="padding:8px 10px;background:transparent;color:#fff1cc;border:1px solid #b99b5c;border-radius:7px">FECHAR ✕</button></div><div id="settlement-manage-summary" style="padding:10px;margin:10px 0;background:#111d16;border:1px solid #65714d;border-radius:9px;color:#e7dfc6"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button id="settlement-build-house" type="button" style="padding:11px;border:1px solid #b99b5c;border-radius:8px;background:#594735;color:#fff1cc;font-weight:800">🏠 CONSTRUIR CASA</button><button id="settlement-recruit" type="button" style="padding:11px;border:1px solid #b99b5c;border-radius:8px;background:#42583a;color:#fff1cc;font-weight:800">👥 RECRUTAR MORADOR</button></div><p style="margin:8px 0;color:#c5cfb0;font-size:11px">Casa: 16 madeiras + 8 pedras. Recrutamento: 25 moedas. Cada nova casa abriga mais um morador.</p><h3 style="margin:14px 0 6px;color:#e6c979;font:700 16px Georgia">Moradores e profissões</h3><div id="settlement-manage-roster"></div><p style="margin:12px 0 0;color:#aeb99f;font-size:10px">As profissões alteram a produção diária do mercado local. As casas, moradores e funções ficam salvos neste mundo.</p>';
  document.body.appendChild(panel);
  const title=panel.querySelector("#settlement-manage-title");
  const summary=panel.querySelector("#settlement-manage-summary");
  const roster=panel.querySelector("#settlement-manage-roster");
  const buildButton=panel.querySelector("#settlement-build-house");
  const recruitButton=panel.querySelector("#settlement-recruit");
  let activeTown=null, nearestTown=null;

  function productionFor(town) {
    const production={...town.baseProduction};
    for (const resident of residents.residentsForTown(town.id)) {
      if (resident.role==="Agricultor") production.berries=(production.berries||0)+4;
      else if (resident.role==="Lenhador") production.wood=(production.wood||0)+4;
      else if (resident.role==="Caçador") { production.meat=(production.meat||0)+2; production.hide=(production.hide||0)+1; }
      else if (resident.role==="Pastor") production.wool=(production.wool||0)+2;
      else if (resident.role==="Artesão") { production.wood=(production.wood||0)+1; production.wool=(production.wool||0)+1; }
      else if (resident.role==="Construtor") production.wood=(production.wood||0)+2;
      else if (resident.role==="Comerciante") production.berries=(production.berries||0)+1;
    }
    town.production=production;
    return production;
  }

  function refresh() {
    if (!activeTown) return;
    const people=residents.residentsForTown(activeTown.id);
    const capacity=3+activeTown.houses;
    const production=productionFor(activeTown);
    title.textContent=activeTown.name;
    summary.innerHTML="<b>👥 População: "+people.length+" / "+capacity+"</b><br>🏠 Casas novas: "+activeTown.houses+" · 🪙 Suas moedas: "+(Number(state.coins)||0)+"<br><b>Produção diária estimada:</b> "+Object.entries(production).map(([key,value])=>key+": +"+value).join(" · ");
    buildButton.disabled=activeTown.houses>=HOUSE_SLOTS.length||(Number(state.wood)||0)<16||(Number(state.stone)||0)<8;
    buildButton.textContent=activeTown.houses>=HOUSE_SLOTS.length?"LIMITE DE CASAS ATINGIDO":"🏠 CASA · 16 MADEIRAS + 8 PEDRAS";
    recruitButton.disabled=people.length>=capacity||(Number(state.coins)||0)<25;
    recruitButton.textContent=people.length>=capacity?"CONSTRUA UMA CASA PRIMEIRO":"👥 RECRUTAR · 25 MOEDAS";
    roster.replaceChildren();
    for (const person of people) {
      const row=document.createElement("div");
      row.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid #526044";
      const label=document.createElement("div");
      label.style.cssText="min-width:0;flex:1";
      label.innerHTML="<b>"+person.name+"</b><div style='font-size:10px;color:#c5cfb0'>"+(person.isRecruit?"Novo habitante":"Morador original")+" · "+Math.round(person.mood)+" ânimo</div>";
      const select=document.createElement("select");
      select.style.cssText="max-width:145px;padding:8px;border:1px solid #8b784e;border-radius:7px;background:#293a2a;color:#fff1cc;font:11px system-ui";
      for (const role of ROLES) { const option=document.createElement("option");option.value=role;option.textContent=role;option.selected=person.role===role;select.appendChild(option); }
      select.addEventListener("change",()=>{if(residents.assignProfession(person.id,select.value)){productionFor(activeTown);residents.save();save();refresh();if(onChange)onChange();onToast(person.name+" agora trabalha como "+select.value+".");}});
      row.append(label,select);roster.appendChild(row);
    }
  }

  function open(town) { activeTown=town;refresh();panel.hidden=false;trigger.hidden=true; }
  trigger.addEventListener("click",()=>{if(nearestTown&&panel.hidden)open(nearestTown);});
  panel.querySelector("#settlement-manage-close").addEventListener("click",()=>{panel.hidden=true;});
  buildButton.addEventListener("click",()=>{
    if(!activeTown||activeTown.houses>=HOUSE_SLOTS.length||(Number(state.wood)||0)<16||(Number(state.stone)||0)<8)return;
    state.wood-=16;state.stone-=8;buildHouse(activeTown,activeTown.houses);activeTown.houses++;
    save();refresh();if(onChange)onChange();onToast("Nova casa construída em "+activeTown.name+". A povoação pode receber mais um habitante.");
  });
  recruitButton.addEventListener("click",()=>{
    if(!activeTown)return;
    const people=residents.residentsForTown(activeTown.id);
    if(people.length>=3+activeTown.houses||(Number(state.coins)||0)<25)return;
    const name=NAMES.find(candidate=>!residents.residents.some(person=>person.name===candidate))||("Viajante "+(residents.residents.length+1));
    const index=people.length-3;
    const slot=HOUSE_SLOTS[index];
    if(!slot)return;
    const role=ROLES[(residents.residents.length+2)%ROLES.length];
    const recruited=residents.recruit(activeTown.id,{id:activeTown.id+"-recruit-"+Date.now(),name,role,color:0x80694d,model:"Worker_Male.gltf",home:slot,work:[[12,14],[15,17]],greeting:"Vim em busca de uma vida nova nesta povoação."});
    if(!recruited)return;
    state.coins-=25;productionFor(activeTown);residents.save();save();refresh();if(onChange)onChange();
    onToast(name+" foi recrutado para "+activeTown.name+" como "+role+".");
  });

  function update() {
    nearestTown=null;
    let distanceLimit=7;
    for(const town of towns){const distance=Math.hypot(player.position.x-town.market[0],player.position.z-town.market[1]);if(distance<distanceLimit){distanceLimit=distance;nearestTown=town;}}
    trigger.hidden=!nearestTown||!panel.hidden;
    if(nearestTown&&panel.hidden)trigger.textContent="🏘️ GERENCIAR · "+nearestTown.name.toUpperCase();
    if(activeTown&&!panel.hidden)productionFor(activeTown);
  }

  for(const town of towns)productionFor(town);
  save();
  return {update, towns, save};
}
