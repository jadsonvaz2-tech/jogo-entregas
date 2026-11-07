const SAVE_KEY="cronicas-floresta-distant-exploration-v1";
const COOLDOWN=180000;
const SITE_DEFS={
 mines:{id:"mines",destination:"mines",label:"Acampamento da Serra",kind:"mines",symbol:"⛏",color:"#e0b66a",x:166,z:-151,description:"Um posto de mineração nas encostas. Veios de ferro e carvão afloram entre as pedras.",resources:[["ironOre",2,4],["coal",1,3]]},
 ruins:{id:"ruins",destination:"ruins",label:"Ruínas do Norte",kind:"ruins",symbol:"◆",color:"#d5c8a5",x:-124,z:-128,description:"Paredes antigas, colunas partidas e vestígios de uma povoação esquecida.",resources:[["stone",3,5],["herbs",1,3],["honey",0,1]]},
 marsh:{id:"marsh",destination:"marsh",label:"Clareira do Pântano",kind:"marsh",symbol:"♣",color:"#91bd83",x:151,z:91,description:"Uma clareira úmida entre raízes e juncos. Fibras, ervas e rastros de animais podem ser encontrados.",resources:[["fiber",2,4],["herbs",2,3],["hide",0,1]]}
};
const safeParse=value=>{try{const parsed=JSON.parse(value||"null");return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:null;}catch{return null;}};
export function createDistantExploration({THREE,scene,player,terrainHeight,state,onToast,onSave}){
 const raw=safeParse(localStorage.getItem(SAVE_KEY)),backup=safeParse(localStorage.getItem(SAVE_KEY+"-backup"));
 const data=raw||backup||{discovered:[],camps:[],sites:{},selectedId:null};
 if(!Array.isArray(data.discovered))data.discovered=[];
 if(!Array.isArray(data.camps))data.camps=[];
 if(!Array.isArray(data.routes))data.routes=[];
 if(!Array.isArray(data.rareMarkers))data.rareMarkers=[];
 if(!Array.isArray(data.visited))data.visited=[];
 if(!data.sites||typeof data.sites!=="object")data.sites={};
 let lastUI=0,nearby=null;
 const groups=new Map();
 const material=(color,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness});
 const mats={wood:material(0x68472b),darkWood:material(0x3d2b1e),canvas:material(0x8a7953),stone:material(0x77766d),darkStone:material(0x45463f),moss:material(0x526b3c),iron:material(0x8b7654,.8),fire:material(0xd77b35),reed:material(0x87904b),water:material(0x426f68)};
 const box=(g,w,h,d,mat,x,y,z,ry=0)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.rotation.y=ry;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
 const sphere=(g,r,mat,x,y,z,sx=1,sy=1,sz=1)=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,9,7),mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
 const cylinder=(g,r1,r2,h,mat,x,y,z,segments=8)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
 const createCamp=(g)=>{
  // Abrigo de lona, armação de madeira, fogueira e provisões.
  const tent=new THREE.Mesh(new THREE.ConeGeometry(1.8,2.35,4),mats.canvas);tent.position.set(0,1.18,0);tent.rotation.y=Math.PI/4;tent.castShadow=true;g.add(tent);
  box(g,.14,2.1,.14,mats.wood,0,1.05,-1.1);box(g,.14,2.1,.14,mats.wood,0,1.05,1.1);
  box(g,2.1,.12,.12,mats.darkWood,0,2.12,0);
  box(g,.8,.28,.5,mats.wood,-2.1,.28,.2);box(g,.8,.28,.5,mats.wood,-2.1,.28,.85);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;sphere(g,.22,mats.stone,2.1+Math.cos(a)*.65,.12,Math.sin(a)*.65,.9,.55,.9);}
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.22,.62,6),mats.fire);flame.position.set(2.1,.42,.0);flame.castShadow=true;g.add(flame);
  box(g,.95,.14,.13,mats.wood,-2.15,.55,.25,.18);
 };
 const createMine=(g)=>{
  for(let i=0;i<10;i++){const a=i*2.399,r=.65+(i%4)*.34;sphere(g,.62,i%3===0?mats.iron:mats.darkStone,Math.cos(a)*r,.42+(i%3)*.08,Math.sin(a)*r,.95,.72,1.08);}
  for(let i=0;i<5;i++){const vein=box(g,.18,.07,.72,mats.iron,-.8+(i%3)*.68,.64+(i%2)*.12,-.55+Math.floor(i/3)*.8,i*.55);vein.material=mats.iron;}
  box(g,1.2,.1,.1,mats.wood,-2.25,.75,-.7);box(g,.1,.8,.1,mats.wood,-2.8,.38,-.7);box(g,.1,.8,.1,mats.wood,-1.7,.38,-.7);
 };
 const createRuins=(g)=>{
  const mossStone=material(0x77786a),broken=material(0x5d6155);
  box(g,5,.42,.55,mossStone,0,.22,-2.2);box(g,4.5,.4,.5,mossStone,0,.2,2.0);
  for(const x of [-2.15,-.72,.72,2.15]){cylinder(g,.35,.42,2.65,mossStone,x,1.45,-2.05,7);cylinder(g,.43,.43,.25,broken,x,2.82,-2.05,7);}
  box(g,4.9,.45,.62,mossStone,0,2.9,-2.05);
  box(g,2.8,.35,.45,broken,-1.8,.2,.8,.18);box(g,1.8,.4,.5,mossStone,1.65,.25,.9,-.12);
  for(let i=0;i<6;i++){const x=-2.4+(i%3)*2.25,z=.3+Math.floor(i/3)*1.1;sphere(g,.4,mats.moss,x,.2,z,1.4,.45,1.2);}
 };
 const createMarsh=(g)=>{
  const pools=new THREE.Mesh(new THREE.CircleGeometry(2.6,18),mats.water);pools.rotation.x=-Math.PI/2;pools.position.set(0,.025,0);g.add(pools);
  for(let i=0;i<22;i++){const a=i*2.4,r=1.8+(i%5)*.27,x=Math.cos(a)*r,z=Math.sin(a)*r;const reed=cylinder(g,.035,.055,.9+(i%4)*.18,mats.reed,x,.45,z,5);reed.rotation.z=(i%2?.17:-.17);reed.rotation.x=.1;}
  for(let i=0;i<5;i++)sphere(g,.42,mats.moss,-2.2+i*.95,.25,2.2,.8,.55,1.3);
  box(g,2.4,.2,.28,mats.wood,-2.5,.3,-1.4,.15);
 };
 const createSiteVisual=site=>{
  if(groups.has(site.id))return;
  const group=new THREE.Group();
  createCamp(group);
  if(site.kind==="mines")createMine(group);
  if(site.kind==="ruins")createRuins(group);
  if(site.kind==="marsh")createMarsh(group);
  group.position.set(site.x,terrainHeight(site.x,site.z),site.z);
  scene.add(group);groups.set(site.id,group);
 };
 const createTemporaryCamp=camp=>{
  if(groups.has(camp.id))return;
  const group=new THREE.Group();createCamp(group);
  group.position.set(camp.x,terrainHeight(camp.x,camp.z),camp.z);group.rotation.y=camp.yaw||0;
  scene.add(group);groups.set(camp.id,group);
 };
 const save=()=>{
  try{const previous=localStorage.getItem(SAVE_KEY);if(previous&&safeParse(previous))localStorage.setItem(SAVE_KEY+"-backup",previous);localStorage.setItem(SAVE_KEY,JSON.stringify(data));}
  catch(error){console.warn("Falha ao salvar descobertas do mapa.",error);}
 };
 const siteFor=id=>SITE_DEFS[id]||null;
 const discoveredSites=()=>data.discovered.map(siteFor).filter(Boolean).map(site=>({...site,...(data.sites[site.id]||{})}));
 const allCamps=()=>data.camps.filter(c=>c&&Number.isFinite(c.x)&&Number.isFinite(c.z));
 const nearestSite=(x,z,max=7)=>discoveredSites().map(site=>({...site,distance:Math.hypot(x-site.x,z-site.z)})).filter(site=>site.distance<=max).sort((a,b)=>a.distance-b.distance)[0]||null;
 const addResources=site=>{
  const results=[];
  for(const [key,min,max] of site.resources||[]){const amount=min+Math.floor(Math.random()*(max-min+1));if(amount<=0)continue;if(typeof state[key]!=="number")state[key]=0;state[key]+=amount;results.push(amount+" "+key);}
  site.lastCollectedAt=Date.now();data.sites[site.id]={...(data.sites[site.id]||{}),lastCollectedAt:site.lastCollectedAt};
  save();onSave?.();onToast("Recursos recolhidos: "+results.join(", ")+".");renderDetails();
 };
 const exploreRuins=site=>{
  if(site.explored){onToast("As ruínas já foram exploradas. Você pode recolher os recursos quando voltarem a surgir.");return;}
  site.explored=true;data.sites[site.id]={...(data.sites[site.id]||{}),explored:true};
  const rewards=[["stone",5],["ironOre",2],["honey",2]];
  for(const [key,amount] of rewards){if(typeof state[key]!=="number")state[key]=0;state[key]+=amount;}
  save();onSave?.();onToast("Ruínas exploradas! Encontrados 5 pedras, 2 minérios de ferro e 2 méis.");renderDetails();
 };
 const interact=()=>{
  if(!nearby)return;
  const site=discoveredSites().find(item=>item.id===nearby.id);
  if(!site)return;
  if(site.kind==="ruins"&&!site.explored){exploreRuins(site);return;}
  const last=Number(site.lastCollectedAt)||0,remaining=COOLDOWN-(Date.now()-last);
  if(remaining>0){onToast("Este local precisa de mais "+Math.ceil(remaining/60000)+" min para recuperar recursos.");return;}
  addResources(site);
 };
 const rareFor=id=>data.rareMarkers.find(marker=>marker.id===id)||null;
 const select=id=>{const exists=discoveredSites().some(s=>s.id===id)||allCamps().some(c=>c.id===id)||!!rareFor(id);if(!exists)return false;data.selectedId=id;save();renderDetails();return true;};
 const selectAtWorld=(x,z)=>{
  const candidates=[...discoveredSites(),...allCamps(),...data.rareMarkers].map(p=>({...p,distance:Math.hypot(x-p.x,z-p.z)})).sort((a,b)=>a.distance-b.distance);
  if(!candidates.length||candidates[0].distance>12)return false;
  return select(candidates[0].id);
 };
 const routeFor=id=>{
  const site=SITE_DEFS[id]||SITE_DEFS.mines;
  const bend=id==="mines"?[42,-28]:id==="marsh"?[48,20]:[-35,-34];
  const mid2=id==="mines"?[104,-92]:id==="marsh"?[98,58]:[-82,-86];
  return [[0,0],bend,mid2,[site.x,site.z]];
 };
 const archive=safeParse(localStorage.getItem("cronicas-floresta-community-expeditions-v1"));
 if(Array.isArray(archive?.history)){
  archive.history.forEach((record,index)=>{
   const id=record.destinationId||({ "Serra das Minas":"mines","Ruínas do Norte":"ruins","Pântano Antigo":"marsh" }[record.destination])||"";
   const site=SITE_DEFS[id];
   if(!site)return;
   if(!data.visited.includes(id))data.visited.push(id);
   const routeId="legacy-"+String(record.at||index);
   if(!data.routes.some(route=>route.id===routeId)){
    const bend=id==="mines"?[42,-28]:id==="marsh"?[48,20]:[-35,-34];
    const mid2=id==="mines"?[104,-92]:id==="marsh"?[98,58]:[-82,-86];
    data.routes.push({id:routeId,destination:id,label:site.label,points:[[0,0],bend,mid2,[site.x,site.z]],completedAt:Number(record.at)||Date.now(),members:(record.memberNames||[]).slice(),legacy:true});
   }
   if(record.rareDiscovery){
    const markerId="rare-"+routeId;
    if(!data.rareMarkers.some(marker=>marker.id===markerId)){
     data.rareMarkers.push({id:markerId,label:"Achado raro",description:record.rareDiscovery,x:site.x,z:site.z,symbol:"✦",color:"#ffe17a",discoveredAt:Number(record.at)||Date.now(),destination:id});
    }
   }
  });
  data.routes=data.routes.slice(0,24);
  data.rareMarkers=data.rareMarkers.slice(0,40);
 }
 const discoverFromExpedition=info=>{
  const id=info?.destination,site=SITE_DEFS[id]||SITE_DEFS.mines;
  if(SITE_DEFS[id]&&!data.discovered.includes(id)){data.discovered.push(id);createSiteVisual(SITE_DEFS[id]);onToast("Novo ponto de interesse descoberto: "+SITE_DEFS[id].label+".");}
  if(id&&!data.visited.includes(id))data.visited.push(id);
  const routeId=String(info?.routeId||info?.completedAt||Date.now());
  if(!data.routes.some(route=>route.id===routeId)){
   data.routes.unshift({id:routeId,destination:id||"mines",label:site.label,points:routeFor(id||"mines"),completedAt:Number(info?.completedAt)||Date.now(),members:(info?.memberNames||[]).slice()});
   data.routes=data.routes.slice(0,24);
  }
  if(info?.eventType==="camp"&&info.eventResolved){
   const index=data.camps.length,angle=(index*2.399+1.1),radius=7+(index%3)*2;
   const camp={id:"camp-"+(index+1),label:"Acampamento temporário "+(index+1),x:site.x+Math.cos(angle)*radius,z:site.z+Math.sin(angle)*radius,yaw:angle,discoveredAt:Number(info?.completedAt)||Date.now()};
   data.camps.push(camp);createTemporaryCamp(camp);onToast("O grupo registrou um acampamento temporário no mapa.");
  }
  if(info?.eventType==="ruins"&&id!=="ruins"&&info.eventResolved&&!data.discovered.includes("ruins")){
   data.discovered.push("ruins");createSiteVisual(SITE_DEFS.ruins);onToast("Os moradores registraram ruínas antigas em seus mapas.");
  }
  if(info?.rareDiscovery){
   const markerId="rare-"+routeId;
   if(!data.rareMarkers.some(marker=>marker.id===markerId)){
    const offset=data.rareMarkers.length;
    data.rareMarkers.unshift({id:markerId,label:"Achado raro",description:info.rareDiscovery,x:site.x+(offset%3-1)*5,z:site.z+(offset%2?5:-5),symbol:"✦",color:"#ffe17a",discoveredAt:Number(info?.completedAt)||Date.now(),destination:id});
    data.rareMarkers=data.rareMarkers.slice(0,40);
   }
  }
  if(!data.selectedId&&SITE_DEFS[id])data.selectedId=id;
  save();renderDetails();
 };
 const infoRoot=document.getElementById("explorationSiteInfo"),listRoot=document.getElementById("explorationSiteList");
 const renderDetails=()=>{
  if(!infoRoot||!listRoot)return;
  const sites=discoveredSites(),camps=allCamps(),rares=data.rareMarkers,selected=sites.find(s=>s.id===data.selectedId)||camps.find(c=>c.id===data.selectedId)||rareFor(data.selectedId);
  infoRoot.textContent=selected?(selected.description||"Um acampamento temporário marcado pelos exploradores."):"Locais descobertos: "+sites.length+" · visitados: "+data.visited.length+" · acampamentos: "+camps.length+" · achados raros: "+rares.length+". Toque em um símbolo do mapa para ver detalhes.";
  listRoot.innerHTML="";
  for(const point of [...sites,...camps,...rares]){
   const button=document.createElement("button");button.type="button";button.className="exploration-site-button"+(point.id.startsWith("rare-")?" rare-site-marker":"");button.textContent=(point.symbol||"⛺")+" "+point.label;button.addEventListener("click",()=>{select(point.id);});listRoot.append(button);
  }
  if(selected&&sites.some(s=>s.id===selected.id)){
   const site=sites.find(s=>s.id===selected.id),distance=Math.hypot(player.position.x-site.x,player.position.z-site.z);
   const status=document.createElement("small");
   if(site.kind==="ruins"&&!site.explored)status.textContent="Ruínas aguardando exploração · aproxime-se para investigar.";
   else if(distance<=7){const remaining=COOLDOWN-(Date.now()-(Number(site.lastCollectedAt)||0));status.textContent=remaining>0?"Recursos em recuperação: "+Math.ceil(remaining/60000)+" min.":"Local de coleta pronto · aproxime-se para recolher.";}
   else status.textContent="Distância até o local: "+Math.round(distance)+" m · aproxime-se para interagir.";
   listRoot.append(status);
  }
 };
 const getMapMarkers=()=>[
  ...discoveredSites().map(site=>({id:site.id,x:site.x,z:site.z,label:site.label,symbol:site.symbol,color:site.color,visited:data.visited.includes(site.id),kind:"site"})),
  ...allCamps().map(camp=>({id:camp.id,x:camp.x,z:camp.z,label:camp.label,symbol:"⛺",color:"#d7b97b",kind:"camp"})),
  ...data.rareMarkers.map(marker=>({...marker,kind:"rare"}))
 ];
 const getMapRoutes=()=>data.routes.slice().reverse();
 const getMapStatus=()=>({discovered:discoveredSites().length,visited:data.visited.length,camps:allCamps().length,rare:data.rareMarkers.length,routes:data.routes.length});
 const update=()=>{
  const next=nearestSite(player.position.x,player.position.z,7);
  nearby=next;
  let button=document.getElementById("explorationCollectButton");
  if(!button){const holder=document.querySelector(".right-controls");if(holder){button=document.createElement("button");button.id="explorationCollectButton";button.type="button";button.className="control-button action";button.hidden=true;button.addEventListener("click",interact);holder.insertBefore(button,holder.firstChild);}}
  if(button){
   button.hidden=!nearby;
   if(nearby){const remaining=COOLDOWN-(Date.now()-(Number(nearby.lastCollectedAt)||0));button.textContent=nearby.kind==="ruins"&&!nearby.explored?"EXPLORAR RUÍNAS":remaining>0?"LOCAL EM RECUPERAÇÃO":"RECOLHER RECURSOS";button.disabled=!(nearby.kind==="ruins"&&!nearby.explored)&&remaining>0;}
  }
  if(Date.now()-lastUI>1100){renderDetails();lastUI=Date.now();}
 };
 for(const id of data.discovered){const site=SITE_DEFS[id];if(site)createSiteVisual({...site,...(data.sites[id]||{})});}
 for(const camp of allCamps())createTemporaryCamp(camp);
 renderDetails();
 return {update,getMapMarkers,getMapRoutes,selectAtWorld,discoverFromExpedition,getStatus:getMapStatus};
}
