const SAVE_KEY="cronicas-floresta-distant-exploration-v1";
const COOLDOWN=180000;
const SITE_DEFS={
 mines:{id:"mines",destination:"mines",label:"Acampamento da Serra",kind:"mines",symbol:"⛏",color:"#e0b66a",x:166,z:-151,description:"Um posto de mineração nas encostas. Veios de ferro e carvão afloram entre as pedras.",resources:[["ironOre",2,4],["coal",1,3]]},
 ruins:{id:"ruins",destination:"ruins",label:"Ruínas do Norte",kind:"ruins",symbol:"◆",color:"#d5c8a5",x:-124,z:-128,description:"Paredes antigas, colunas partidas e vestígios de uma povoação esquecida.",resources:[["stone",3,5],["herbs",1,3],["honey",0,1]]},
 marsh:{id:"marsh",destination:"marsh",label:"Clareira do Pântano",kind:"marsh",symbol:"♣",color:"#91bd83",x:151,z:91,description:"Uma clareira úmida entre raízes e juncos. Fibras, ervas e rastros de animais podem ser encontrados.",resources:[["fiber",2,4],["herbs",2,3],["hide",0,1]]}
};
const SECRET_DEFS=[
 {id:"shrine",label:"Santuário Esquecido",symbol:"⛩",color:"#d8c58c",x:-72,z:58,description:"Um pequeno santuário de pedra coberto de musgo. Símbolos antigos indicam que viajantes deixavam oferendas neste lugar."},
 {id:"spring",label:"Fonte das Raízes",symbol:"♧",color:"#8bd3c2",x:58,z:112,description:"Uma nascente escondida entre raízes grossas e pedras lisas. A água permanece limpa mesmo sob a mata fechada."},
 {id:"cache",label:"Esconderijo do Caçador",symbol:"⚒",color:"#c99b62",x:-86,z:-52,description:"Um depósito improvisado por um antigo caçador, protegido por pedras e madeira envelhecida."},
 {id:"watch",label:"Marco dos Antigos",symbol:"◈",color:"#b8b7a2",x:80,z:-64,description:"Um marco de pedra talhada, alinhado com as montanhas. Marcas gastas sugerem uma antiga rota de passagem."}
];
const SECRET_QUESTS={
 shrine:{steps:["Examine os símbolos gastos no altar.","Decifre a inscrição e reorganize as pedras de oferenda."],actions:["EXAMINAR INSCRIÇÃO","DECIFRAR E OFERECER"],story:"A inscrição fala de viajantes que protegiam a floresta e deixavam sementes para quem viesse depois.",reward:[["stone",3],["herbs",2],["honey",1]]},
 spring:{steps:["Observe o fluxo da água e procure a nascente entre as raízes.","Limpe a passagem das pedras para liberar a água cristalina."],actions:["INVESTIGAR NASCENTE","LIBERAR A FONTE"],story:"A fonte abastecia antigos viajantes. Sob as pedras havia ervas preservadas e fibras úteis.",reward:[["herbs",3],["fiber",3],["honey",1]]},
 cache:{steps:["Inspecione o esconderijo e procure o mecanismo da tampa.","Abra o baú antigo usando as marcas deixadas pelo caçador."],actions:["INSPECIONAR BAÚ","ABRIR ESCONDERIJO"],story:"O caçador deixou provisões para alguém que soubesse seguir suas marcas. Um bilhete recomenda respeitar a mata.",reward:[["hide",2],["ironOre",2],["wood",4]]},
 watch:{steps:["Leia as marcas talhadas no marco de pedra.","Alinhe as pedras menores com a rota indicada pela inscrição."],actions:["LER INSCRIÇÕES","ALINHAR MARCO"],story:"O marco assinalava uma passagem segura entre as colinas. A última inscrição registra uma antiga rota de comércio.",reward:[["stone",4],["ironOre",2],["herbs",2]]}
};
const SECRET_NPCS={
 shrine:{name:"Iara",role:"Guardiã do Santuário",intro:"A floresta guarda a memória de quem cuidou dela. Sou Iara, guardiã deste altar. Poucos chegam até aqui com respeito.",lore:"Os antigos viajantes plantavam sementes ao redor do santuário. Diziam que uma floresta protegida também protege seus caminhos.",quests:[{id:"seed",title:"Restaurar o jardim antigo",text:"Iara pede que você traga ervas para replantar o pequeno jardim do santuário.",needs:[["herbs",2]],reward:{key:"guardianSeed",label:"Semente da Guardiã",story:"Uma semente rara, preservada por gerações, capaz de lembrar a Edrik o compromisso de proteger a mata."}},{id:"brooch",title:"Reerguer o marco de pedra",text:"A guardiã precisa de pedras para firmar novamente a base do altar.",needs:[["stone",3]],reward:{key:"oakBrooch",label:"Broche do Carvalho",story:"Um broche de madeira antiga, símbolo dos primeiros protetores da floresta."}}]},
 spring:{name:"Naiá",role:"Espírito da Fonte",intro:"A água ainda canta, embora quase ninguém escute. Sou Naiá, memória viva desta nascente.",lore:"A fonte guiava os moradores durante as secas. Eles nunca retiravam mais água do que precisavam.",quests:[{id:"dew",title:"Purificar a nascente",text:"Naiá pede fibras para filtrar a água e proteger a nascente.",needs:[["fiber",3]],reward:{key:"springDew",label:"Gota da Nascente",story:"Uma gota cristalina que guarda o brilho da fonte e sua antiga canção."}},{id:"shell",title:"Recompor o círculo de ervas",text:"O espírito pede ervas para recompor o círculo natural que protege a água.",needs:[["herbs",2]],reward:{key:"waterShell",label:"Concha das Águas",story:"Uma concha lisa encontrada no fundo da fonte, marcada por símbolos de proteção."}}]},
 cache:{name:"Bento",role:"Viajante Errante",intro:"Por fim, alguém encontrou meu esconderijo. Sou Bento. Atravessei estas matas quando ainda havia pequenas casas por toda a região.",lore:"Os antigos moradores trocavam ferramentas e mantimentos neste abrigo. O caminho seguro passava pelo marco de pedra ao norte.",quests:[{id:"amulet",title:"Preparar um kit de viagem",text:"Bento pede couro para consertar sua velha bolsa de viagem.",needs:[["hide",2]],reward:{key:"hunterAmulet",label:"Amuleto do Caçador",story:"Um amuleto de osso e couro que pertenceu ao primeiro caçador destas colinas."}},{id:"map",title:"Recuperar as provisões perdidas",text:"Bento precisa de madeira para reforçar as caixas onde guardava seus mapas.",needs:[["wood",4]],reward:{key:"travelerMap",label:"Mapa do Viajante",story:"Um mapa antigo com anotações de trilhas que ainda não aparecem nos mapas comuns."}}]},
 watch:{name:"Memória dos Moradores",role:"Eco dos Antigos",intro:"Não sou um corpo, mas a lembrança de muitas vozes. Aqui viveram famílias que conheciam cada colina e cada nascente.",lore:"Os moradores deixaram este marco para que ninguém se perdesse ao atravessar as montanhas. Suas casas desapareceram, mas seus caminhos permanecem.",quests:[{id:"seal",title:"Reparar o marco comunitário",text:"O eco pede pedras para recompor a base do marco e honrar os antigos moradores.",needs:[["stone",4]],reward:{key:"ancientSeal",label:"Selo dos Antigos",story:"Um selo gravado com os símbolos das primeiras famílias que habitaram a floresta."}},{id:"route",title:"Reconstruir o registro da rota",text:"O eco precisa de minério de ferro para fixar a placa que indica a antiga rota.",needs:[["ironOre",2]],reward:{key:"routeFragment",label:"Fragmento da Rota",story:"Um fragmento metálico gravado com parte de uma rota comercial esquecida."}}]}
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
 if(!Array.isArray(data.fogPoints))data.fogPoints=[];
 if(!Array.isArray(data.walkTrails))data.walkTrails=[];
 if(!Array.isArray(data.secretsFound))data.secretsFound=[];
 if(!data.secretProgress||typeof data.secretProgress!=="object"||Array.isArray(data.secretProgress))data.secretProgress={};
 if(!Array.isArray(data.secretCompleted))data.secretCompleted=[];
 if(!Array.isArray(data.secretJournal))data.secretJournal=[];
 if(!data.secretSideMissions||typeof data.secretSideMissions!=="object"||Array.isArray(data.secretSideMissions))data.secretSideMissions={};
 if(!Array.isArray(data.secretUniqueRewards))data.secretUniqueRewards=[];
 if(!Array.isArray(data.secretDialogueHistory))data.secretDialogueHistory=[];
 data.fogPoints=data.fogPoints.filter(point=>Array.isArray(point)&&Number.isFinite(point[0])&&Number.isFinite(point[1]));
 data.walkTrails=data.walkTrails.filter(segment=>Array.isArray(segment)).map(segment=>segment.filter(point=>Array.isArray(point)&&Number.isFinite(point[0])&&Number.isFinite(point[1])));
 data.secretsFound=data.secretsFound.filter(id=>SECRET_DEFS.some(secret=>secret.id===id));
 if(!data.sites||typeof data.sites!=="object")data.sites={};
 let lastUI=0,nearby=null,nearbySecret=null;
 const groups=new Map();
 const material=(color,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness});
 const relicMaterial=material(0xd8b45c,.3);relicMaterial.emissive=new THREE.Color(0x66421b);
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
 const createSecretVisual=secret=>{
  if(groups.has("secret-"+secret.id))return;
  const g=new THREE.Group();
  if(secret.id==="shrine"||secret.id==="watch"){
   box(g,2.8,.32,2.2,mats.darkStone,0,.16,0);
   box(g,.55,2.0,.55,mats.stone,-.88,1.15,-.55);box(g,.55,2.0,.55,mats.stone,.88,1.15,-.55);
   box(g,2.45,.38,.65,mats.moss,0,2.15,-.55);
   box(g,.42,.8,.42,mats.iron,0,2.62,-.55);
   sphere(g,.22,mats.fire,0,3.12,-.55,.8,1.2,.8);
  }else if(secret.id==="spring"){
   const water=new THREE.Mesh(new THREE.CircleGeometry(2.1,18),mats.water);water.rotation.x=-Math.PI/2;water.position.y=.035;g.add(water);
   for(let i=0;i<9;i++){const a=i*Math.PI*2/9;sphere(g,.38,mats.stone,Math.cos(a)*2.1,.22,Math.sin(a)*2.1,1,.65,1);}
   for(let i=0;i<4;i++)cylinder(g,.055,.08,.8,mats.reed,-1.7+i*1.1,.4,1.8,5);
  }else{
   box(g,1.8,.65,1.35,mats.wood,0,.55,0);
   box(g,1.95,.2,1.48,mats.darkWood,0,1.0,0);
   box(g,.16,.4,.08,mats.iron,0,.55,.7);
   for(let i=0;i<5;i++)sphere(g,.35,mats.moss,-1.25+i*.62,.2,1.1,.9,.55,1.1);
  }
  g.position.set(secret.x,terrainHeight(secret.x,secret.z),secret.z);scene.add(g);groups.set("secret-"+secret.id,g);
 };
 const createSecretNpc=secret=>{
  const def=SECRET_NPCS[secret.id],site=groups.get("secret-"+secret.id);if(!def||!site||site.userData.npcCreated)return;
  const npc=new THREE.Group(),spirit=secret.id==="spring",echo=secret.id==="watch";
  const robe=new THREE.MeshStandardMaterial({color:spirit?0x62bcae:echo?0x9caeaa:secret.id==="shrine"?0x344c36:0x72513a,roughness:.8,transparent:spirit||echo,opacity:spirit?.76:echo?.62});
  const skin=new THREE.MeshStandardMaterial({color:echo?0xc5d2c7:spirit?0x9fe8d8:0xc99b76,roughness:.85,transparent:spirit||echo,opacity:spirit?.8:echo?.65});
  const hood=new THREE.Mesh(new THREE.ConeGeometry(.48,1.25,8),robe);hood.position.y=.72;hood.castShadow=true;npc.add(hood);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.22,.42,1.05,9),robe);body.position.y=.82;body.castShadow=true;npc.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.25,12,10),skin);head.position.set(0,1.55,.02);head.castShadow=true;npc.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.27,10,8),new THREE.MeshStandardMaterial({color:echo?0xbac8c0:0x33291f,roughness:1}));hair.position.set(0,1.67,-.025);hair.scale.set(1,.58,1);npc.add(hair);
  if(secret.id==="cache"){const pack=new THREE.Mesh(new THREE.BoxGeometry(.48,.56,.28),mats.darkWood);pack.position.set(0,.94,-.34);npc.add(pack);const staff=cylinder(npc,.035,.045,1.65,mats.wood,.52,.86,.02,6);staff.rotation.z=-.08;}
  if(secret.id==="shrine"){const staff=cylinder(npc,.04,.05,1.9,mats.wood,.58,.98,.05,7);staff.rotation.z=-.08;sphere(npc,.13,mats.moss,.58,1.95,.05,.8,1.2,.8);}
  if(spirit){const aura=new THREE.Mesh(new THREE.TorusGeometry(.62,.045,6,24),new THREE.MeshBasicMaterial({color:0x8ee9d6,transparent:true,opacity:.7}));aura.rotation.x=Math.PI/2;aura.position.y=.15;npc.add(aura);head.scale.set(1.05,1.05,1.05);}
  if(echo){const glow=new THREE.PointLight(0xb8d9c9,1.1,5);glow.position.set(0,1.3,0);npc.add(glow);}
  npc.position.set(secret.id==="spring"?2.65:2.8,0,secret.id==="watch"?.85:1.15);npc.rotation.y=-.35;site.add(npc);site.userData.npcCreated=true;
 };
 const showSideQuestReward=secret=>{
  const site=groups.get("secret-"+secret.id);if(!site||site.userData.sideRewardShown)return;
  site.userData.sideRewardShown=true;
  const colors={shrine:0x9bc66a,spring:0x72dfd0,cache:0xd8a45d,watch:0xc4d1c8};
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.25,1),new THREE.MeshStandardMaterial({color:colors[secret.id]||0xd8b45c,emissive:colors[secret.id]||0xd8b45c,emissiveIntensity:.22,roughness:.28}));
  gem.position.set(2.8,2.05,1.15);gem.castShadow=true;site.add(gem);
 };
 const showSecretReward=secret=>{
  const g=groups.get("secret-"+secret.id);if(!g||g.userData.rewardShown)return;
  g.userData.rewardShown=true;
  const relic=new THREE.Mesh(new THREE.OctahedronGeometry(.34,0),relicMaterial);
  relic.position.set(0,secret.id==="cache"?1.42:secret.id==="spring"?.5:3.35,secret.id==="cache"||secret.id==="spring"?0:-.55);
  relic.castShadow=true;g.add(relic);
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
 const secretProgressFor=id=>Math.max(0,Math.min(2,Number(data.secretProgress[id])||0));
 const sideMissionFor=id=>data.secretSideMissions[id]||null;
 const addSecretJournal=(entry)=>{data.secretJournal.unshift({...entry,at:Date.now()});data.secretJournal=data.secretJournal.slice(0,24);};
 const secretQuestFor=id=>SECRET_QUESTS[id]||null;
 let secretDialogueRoot=null;
 const ensureSecretDialogue=()=>{
  if(secretDialogueRoot)return secretDialogueRoot;
  const root=document.createElement("div");root.id="secretDialogueOverlay";root.className="secret-dialogue-overlay";root.hidden=true;
  const card=document.createElement("section");card.className="secret-dialogue-card";
  const header=document.createElement("header");header.className="secret-dialogue-header";
  const title=document.createElement("strong");title.id="secretDialogueTitle";
  const close=document.createElement("button");close.type="button";close.className="secret-dialogue-close";close.textContent="FECHAR";close.addEventListener("click",()=>{root.hidden=true;});
  header.append(title,close);
  const text=document.createElement("p");text.id="secretDialogueText";text.className="secret-dialogue-text";
  const options=document.createElement("div");options.id="secretDialogueOptions";options.className="secret-dialogue-options";
  card.append(header,text,options);root.append(card);root.addEventListener("click",event=>{if(event.target===root)root.hidden=true;});
  document.body.append(root);secretDialogueRoot=root;return root;
 };
 const openSecretDialogue=secret=>{
  const def=SECRET_NPCS[secret.id];if(!def)return;
  const root=ensureSecretDialogue(),title=root.querySelector("#secretDialogueTitle"),text=root.querySelector("#secretDialogueText"),options=root.querySelector("#secretDialogueOptions");
  const mission=sideMissionFor(secret.id),complete=!!mission?.completed;
  title.textContent=def.name+" · "+def.role;options.innerHTML="";
  const action=(label,callback,disabled=false)=>{
   const button=document.createElement("button");button.type="button";button.className="secret-dialogue-choice";button.textContent=label;button.disabled=disabled;button.addEventListener("click",callback);options.append(button);
  };
  if(complete){
   const reward=data.secretUniqueRewards.find(item=>item.key===mission.rewardKey);
   text.textContent="Você cumpriu sua promessa. "+(reward?.story||"A lembrança deste encontro ficará registrada.");
   action("OUVIR MAIS SOBRE O PASSADO",()=>{addSecretJournal({id:secret.id,title:def.name,text:def.lore,kind:"lore"});save();onSave?.();text.textContent=def.lore;options.innerHTML="";action("FECHAR CONVERSA",()=>root.hidden=true);renderDetails();});
  }else if(mission&&!mission.completed){
   const quest=def.quests.find(item=>item.id===mission.questId);
   const missing=quest.needs.map(([key,amount])=>({key,amount,have:Number(state[key])||0}));
   const enough=missing.every(item=>item.have>=item.amount);
   text.textContent=def.name+": "+quest.text+"\n\nNecessário: "+missing.map(item=>item.amount+" "+item.key+" (você tem "+item.have+")").join(", ")+".";
   action(enough?"ENTREGAR E CONCLUIR MISSÃO":"AINDA FALTAM RECURSOS",()=>{
    for(const [key,amount] of quest.needs)state[key]=Math.max(0,(Number(state[key])||0)-amount);
    const reward=quest.reward;
    mission.completed=true;mission.rewardKey=reward.key;data.secretUniqueRewards.push({key:reward.key,label:reward.label,story:reward.story,secretId:secret.id,at:Date.now()});
    addSecretJournal({id:secret.id,title:quest.title,text:reward.story,kind:"side-quest",uniqueReward:reward.label});
    showSideQuestReward(secret);save();onSave?.();renderDetails();onToast("Missão secundária concluída: "+reward.label+"!");openSecretDialogue(secret);
   },!enough);
   action("PERGUNTAR SOBRE A FLORESTA",()=>{text.textContent=def.lore;addSecretJournal({id:secret.id,title:def.name,text:def.lore,kind:"lore"});save();onSave?.();renderDetails();options.innerHTML="";action("VOLTAR À MISSÃO",()=>openSecretDialogue(secret));action("FECHAR CONVERSA",()=>root.hidden=true);});
  }else{
   text.textContent=def.intro;
   for(const quest of def.quests){
    action("ACEITAR: "+quest.title,()=>{
     data.secretSideMissions[secret.id]={questId:quest.id,accepted:true,completed:false,acceptedAt:Date.now()};
     addSecretJournal({id:secret.id,title:quest.title,text:quest.text,kind:"side-quest"});
     save();onSave?.();renderDetails();onToast("Nova missão secundária: "+quest.title);openSecretDialogue(secret);
    });
   }
   action("PERGUNTAR SOBRE O PASSADO",()=>{text.textContent=def.lore;addSecretJournal({id:secret.id,title:def.name,text:def.lore,kind:"lore"});save();onSave?.();renderDetails();options.innerHTML="";action("VOLTAR",()=>openSecretDialogue(secret));action("FECHAR CONVERSA",()=>root.hidden=true);});
  }
  action("DEIXAR PARA DEPOIS",()=>{root.hidden=true;});
  root.hidden=false;
 };
 const investigateSecret=secret=>{
  const quest=secretQuestFor(secret.id);if(!quest)return;
  if(data.secretCompleted.includes(secret.id)){onToast("Esta descoberta já foi concluída. O registro está no diário.");return;}
  const step=secretProgressFor(secret.id);
  if(step===0){
   data.secretProgress[secret.id]=1;
   data.secretJournal.unshift({id:secret.id,title:secret.label,text:quest.steps[0],at:Date.now(),kind:"clue"});
   data.secretJournal=data.secretJournal.slice(0,24);save();onSave?.();
   onToast(quest.steps[0]);renderDetails();return;
  }
  for(const [key,amount] of quest.reward){if(typeof state[key]!=="number")state[key]=0;state[key]+=amount;}
  data.secretProgress[secret.id]=2;data.secretCompleted.push(secret.id);
  showSecretReward(secret);
  data.secretJournal.unshift({id:secret.id,title:secret.label,text:quest.story,reward:quest.reward,at:Date.now(),kind:"discovery"});
  data.secretJournal=data.secretJournal.slice(0,24);
  save();onSave?.();onToast("Missão concluída: "+secret.label+". Recompensas adicionadas ao inventário.");renderDetails();
 };
 const rareFor=id=>data.rareMarkers.find(marker=>marker.id===id)||null;
 const secretFor=id=>data.secretsFound.map(secretId=>SECRET_DEFS.find(secret=>secret.id===secretId)).find(secret=>secret?.id===id)||null;
 const select=id=>{const exists=discoveredSites().some(s=>s.id===id)||allCamps().some(c=>c.id===id)||!!rareFor(id)||!!secretFor(id);if(!exists)return false;data.selectedId=id;save();renderDetails();return true;};
 const selectAtWorld=(x,z)=>{
  const candidates=[...discoveredSites(),...allCamps(),...data.rareMarkers,...data.secretsFound.map(secretId=>SECRET_DEFS.find(secret=>secret.id===secretId)).filter(Boolean)].map(p=>({...p,distance:Math.hypot(x-p.x,z-p.z)})).sort((a,b)=>a.distance-b.distance);
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
 let lastFogPoint=null,lastExplorationSave=Date.now();
 const recordPlayerExploration=()=>{
  const x=player.position.x,z=player.position.z,now=Date.now();
  if(!Number.isFinite(x)||!Number.isFinite(z))return;
  let trail=data.walkTrails[data.walkTrails.length-1];
  const previous=Array.isArray(trail)&&trail.length?trail[trail.length-1]:null;
  const distance=previous?Math.hypot(x-previous[0],z-previous[1]):Infinity;
  let changed=false,forceSave=false;
  if(!previous||distance>42){trail=[];data.walkTrails.push(trail);trail.push([Number(x.toFixed(1)),Number(z.toFixed(1))]);changed=true;}
  else if(distance>=5){trail.push([Number(x.toFixed(1)),Number(z.toFixed(1))]);changed=true;}
  while(data.walkTrails.length>16)data.walkTrails.shift();
  for(const segment of data.walkTrails)if(segment.length>450)segment.splice(0,segment.length-450);
  const fogDistance=lastFogPoint?Math.hypot(x-lastFogPoint[0],z-lastFogPoint[1]):Infinity;
  if(!lastFogPoint||fogDistance>=14){
   data.fogPoints.push([Number(x.toFixed(1)),Number(z.toFixed(1))]);
   lastFogPoint=[x,z];changed=true;forceSave=true;
   if(data.fogPoints.length>900)data.fogPoints.splice(0,data.fogPoints.length-900);
  }
  for(const site of discoveredSites()){
   if(!data.visited.includes(site.id)&&Math.hypot(x-site.x,z-site.z)<=10){data.visited.push(site.id);changed=true;forceSave=true;onToast("Local visitado: "+site.label+".");}
  }
  for(const secret of SECRET_DEFS){
   if(data.secretsFound.includes(secret.id))continue;
   if(Math.hypot(x-secret.x,z-secret.z)<=12){
    data.secretsFound.push(secret.id);data.selectedId=secret.id;createSecretNpc(secret);forceSave=true;
    onToast("Ponto secreto descoberto: "+secret.label+"! O local foi marcado no mapa.");
    changed=true;
   }
  }
  if(changed&&(forceSave||now-lastExplorationSave>10000)){
   save();lastExplorationSave=now;
  }
 };
 const getFogPoints=()=>data.fogPoints;
 const getWalkTrails=()=>data.walkTrails;
 const getExplorationStatus=()=>({revealedAreas:data.fogPoints.length,trailPoints:data.walkTrails.reduce((sum,line)=>sum+line.length,0),secrets:data.secretsFound.length});
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
 const infoRoot=document.getElementById("explorationSiteInfo"),listRoot=document.getElementById("explorationSiteList"),journalRoot=document.getElementById("secretDiscoveryJournal");
 const renderDetails=()=>{
  if(!infoRoot||!listRoot)return;
  const sites=discoveredSites(),camps=allCamps(),rares=data.rareMarkers,secrets=data.secretsFound.map(secretId=>SECRET_DEFS.find(secret=>secret.id===secretId)).filter(Boolean),selected=sites.find(s=>s.id===data.selectedId)||camps.find(c=>c.id===data.selectedId)||rareFor(data.selectedId)||secretFor(data.selectedId);
  const selectedQuest=selected&&secretFor(selected.id)?secretQuestFor(selected.id):null,selectedStep=selectedQuest?secretProgressFor(selected.id):0,selectedComplete=selectedQuest&&data.secretCompleted.includes(selected.id);
  const selectedNpc=selected&&secretFor(selected.id)?SECRET_NPCS[selected.id]:null,selectedSide=selected&&secretFor(selected.id)?sideMissionFor(selected.id):null;
  infoRoot.textContent=selected?(selected.description||"Um acampamento temporário marcado pelos exploradores.")+(selectedQuest?" "+(selectedComplete?selectedQuest.story:selectedQuest.steps[selectedStep]):"")+(selectedNpc?" Personagem: "+selectedNpc.name+" · "+(selectedSide?.completed?"missão secundária concluída":selectedSide?"missão secundária em andamento":"aguarda conversa")+".":""):"Locais descobertos: "+sites.length+" · visitados: "+data.visited.length+" · acampamentos: "+camps.length+" · achados raros: "+rares.length+" · segredos: "+secrets.length+". Áreas reveladas: "+data.fogPoints.length+". Toque em um símbolo do mapa para ver detalhes.";
  listRoot.innerHTML="";
  for(const point of [...sites,...camps,...rares,...secrets]){
   const button=document.createElement("button");button.type="button";button.className="exploration-site-button"+(point.id.startsWith("rare-")?" rare-site-marker":"");button.textContent=(point.kind==="site"&&data.visited.includes(point.id)?"✓ ":"")+(point.symbol||"⛺")+" "+point.label;button.addEventListener("click",()=>{select(point.id);});listRoot.append(button);
  }
  if(journalRoot){journalRoot.innerHTML="";for(const entry of data.secretJournal.slice(0,8)){const row=document.createElement("div");row.className="secret-journal-entry";const heading=document.createElement("strong");heading.textContent=entry.title;const story=document.createElement("p");story.textContent=entry.text;row.append(heading,story);if(entry.reward){const reward=document.createElement("small");reward.textContent="Recompensa: "+entry.reward.map(([key,amount])=>amount+" "+key).join(", ");row.append(reward);}if(entry.uniqueReward){const reward=document.createElement("small");reward.textContent="Relíquia exclusiva: "+entry.uniqueReward;row.append(reward);}journalRoot.append(row);}if(data.secretUniqueRewards.length){const collection=document.createElement("div");collection.className="secret-relic-collection";const heading=document.createElement("strong");heading.textContent="RELÍQUIAS EXCLUSIVAS ENCONTRADAS";collection.append(heading);for(const item of data.secretUniqueRewards){const line=document.createElement("p");line.textContent="✧ "+item.label;collection.append(line);}journalRoot.append(collection);}}
  if(selected&&secretFor(selected.id)){
   const secret=secretFor(selected.id),quest=secretQuestFor(secret.id),step=secretProgressFor(secret.id),complete=data.secretCompleted.includes(secret.id);
   const status=document.createElement("small");status.textContent=complete?"Descoberta concluída · registrada no diário.":step===0?"Missão disponível · aproxime-se do local para investigar.":quest.steps[1];listRoot.append(status);
   if(complete){const reward=document.createElement("small");reward.textContent="Recompensa: "+quest.reward.map(([key,amount])=>amount+" "+key).join(", ");listRoot.append(reward);}
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
  ...data.rareMarkers.map(marker=>({...marker,kind:"rare"})),
  ...data.secretsFound.map(secretId=>SECRET_DEFS.find(secret=>secret.id===secretId)).filter(Boolean).map(secret=>({...secret,kind:"secret"}))
 ];
 const getMapRoutes=()=>data.routes.slice().reverse();
 const getMapStatus=()=>({discovered:discoveredSites().length,visited:data.visited.length,camps:allCamps().length,rare:data.rareMarkers.length,routes:data.routes.length});
 const update=()=>{
  recordPlayerExploration();
  const next=nearestSite(player.position.x,player.position.z,7);
  nearby=next;
  let button=document.getElementById("explorationCollectButton");
  if(!button){const holder=document.querySelector(".right-controls");if(holder){button=document.createElement("button");button.id="explorationCollectButton";button.type="button";button.className="control-button action";button.hidden=true;button.addEventListener("click",interact);holder.insertBefore(button,holder.firstChild);}}
  if(button){
   button.hidden=!nearby;
   if(nearby){const remaining=COOLDOWN-(Date.now()-(Number(nearby.lastCollectedAt)||0));button.textContent=nearby.kind==="ruins"&&!nearby.explored?"EXPLORAR RUÍNAS":remaining>0?"LOCAL EM RECUPERAÇÃO":"RECOLHER RECURSOS";button.disabled=!(nearby.kind==="ruins"&&!nearby.explored)&&remaining>0;}
  }
  nearbySecret=data.secretsFound.map(id=>SECRET_DEFS.find(secret=>secret.id===id)).filter(Boolean).map(secret=>({...secret,distance:Math.hypot(player.position.x-secret.x,player.position.z-secret.z)})).filter(secret=>secret.distance<=9).sort((a,b)=>a.distance-b.distance)[0]||null;
  let talkButton=document.getElementById("explorationTalkButton");
  if(!talkButton){const holder=document.querySelector(".right-controls");if(holder){talkButton=document.createElement("button");talkButton.id="explorationTalkButton";talkButton.type="button";talkButton.className="control-button action";talkButton.textContent="CONVERSAR";talkButton.hidden=true;talkButton.addEventListener("click",()=>{if(nearbySecret)openSecretDialogue(nearbySecret);});holder.insertBefore(talkButton,holder.firstChild);}}
  if(talkButton){talkButton.hidden=!nearbySecret; if(nearbySecret){const person=SECRET_NPCS[nearbySecret.id];talkButton.textContent="FALAR: "+(person?.name||"VIAJANTE").toUpperCase();}}
  let secretButton=document.getElementById("explorationSecretButton");
  if(!secretButton){const holder=document.querySelector(".right-controls");if(holder){secretButton=document.createElement("button");secretButton.id="explorationSecretButton";secretButton.type="button";secretButton.className="control-button action";secretButton.hidden=true;secretButton.addEventListener("click",()=>{if(nearbySecret)investigateSecret(nearbySecret);});holder.insertBefore(secretButton,holder.firstChild);}}
  if(secretButton){secretButton.hidden=!nearbySecret||data.secretCompleted.includes(nearbySecret.id);if(nearbySecret&&!secretButton.hidden){const quest=secretQuestFor(nearbySecret.id),step=secretProgressFor(nearbySecret.id);secretButton.textContent=quest.actions[step]||"INVESTIGAR";}}
  if(Date.now()-lastUI>1100){renderDetails();lastUI=Date.now();}
 };
 for(const id of data.discovered){const site=SITE_DEFS[id];if(site)createSiteVisual({...site,...(data.sites[id]||{})});}
 for(const camp of allCamps())createTemporaryCamp(camp);
 for(const secret of SECRET_DEFS)createSecretVisual(secret);
 for(const secretId of data.secretsFound){const secret=SECRET_DEFS.find(item=>item.id===secretId);if(secret)createSecretNpc(secret);}
 for(const secretId of data.secretUniqueRewards.map(item=>item.secretId)){const secret=SECRET_DEFS.find(item=>item.id===secretId);if(secret)showSideQuestReward(secret);}
 for(const secretId of data.secretCompleted){const secret=SECRET_DEFS.find(item=>item.id===secretId);if(secret)showSecretReward(secret);}
 renderDetails();
 return {update,getMapMarkers,getMapRoutes,getFogPoints,getWalkTrails,selectAtWorld,discoverFromExpedition,getExplorationStatus,getSecretJournal:()=>data.secretJournal.slice(),getSecretSideMissions:()=>data.secretSideMissions,getSecretUniqueRewards:()=>data.secretUniqueRewards.slice(),getStatus:getMapStatus};
}
