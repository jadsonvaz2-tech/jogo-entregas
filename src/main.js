import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const $ = (id) => document.getElementById(id);
const raw = new URL("../assets/3d/", import.meta.url).href;
// Mundo procedural determinístico: os recursos permanecem nas mesmas posições entre sessões.
let worldRandomState=0x5eed2026;
function worldRandom(){worldRandomState=(worldRandomState*1664525+1013904223)>>>0;return worldRandomState/4294967296;}
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bb3a0);
scene.fog = new THREE.FogExp2(0x9bb3a0, 0.012);
const camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, 0.1, 450);
const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$("game").prepend(renderer.domElement);

const ambient = new THREE.HemisphereLight(0xdce9df,0x46513a,2.0);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffe2b3,2.1);
sun.position.set(-35,65,25); sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-55; sun.shadow.camera.right=55; sun.shadow.camera.top=55; sun.shadow.camera.bottom=-55;
scene.add(sun);

function terrainHeight(x,z){
 const hill=Math.sin(x*.035)*1.8+Math.cos(z*.041)*1.6+Math.sin((x+z)*.022)*2.4;
 const clearing=Math.exp(-(x*x+z*z)/500)*-.5;
 return hill+clearing;
}
const groundGeo = new THREE.PlaneGeometry(260,260,100,100);
groundGeo.rotateX(-Math.PI/2);
const pos = groundGeo.attributes.position;
for(let i=0;i<pos.count;i++){
 const x=pos.getX(i), z=pos.getZ(i);
 pos.setY(i,terrainHeight(x,z));
}
groundGeo.computeVertexNormals();
const ground = new THREE.Mesh(groundGeo,new THREE.MeshStandardMaterial({color:0x526a42,roughness:1}));
ground.receiveShadow=true; scene.add(ground);

const player = new THREE.Group(); scene.add(player);
player.position.y=terrainHeight(0,0);
const fallback = new THREE.Group(); player.add(fallback);
const body = new THREE.Mesh(new THREE.CapsuleGeometry(.34,.9,5,8),new THREE.MeshStandardMaterial({color:0x59402b}));
body.position.y=.85; body.castShadow=true; fallback.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(.23,12,10),new THREE.MeshStandardMaterial({color:0xc49a75}));
head.position.y=1.55; head.castShadow=true; fallback.add(head);
let mixer=null, characterReady=false;
let animationActions={},currentAnimation=null,lockedAnimation=null;
let verticalVelocity=0,isJumping=false;
function playCharacterAnimation(name,once=false){
 const next=animationActions[name.toLowerCase()];
 if(!next)return false;
 if(currentAnimation===next && !once)return true;
 next.reset();
 next.enabled=true;
 next.setEffectiveTimeScale(1);
 next.setEffectiveWeight(1);
 next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);
 next.clampWhenFinished=once;
 if(currentAnimation && currentAnimation!==next)currentAnimation.fadeOut(.16);
 next.fadeIn(.16).play();
 currentAnimation=next;
 if(once)lockedAnimation=next;
 return true;
}
function playOneShot(name){
 if(!characterReady || lockedAnimation || isJumping)return;
 playCharacterAnimation(name,true);
}
function jumpCharacter(){
 if(!characterReady || isJumping || lockedAnimation)return;
 if(playCharacterAnimation("jump",true)){isJumping=true;verticalVelocity=5.2;}
}
function attackCharacter(){
 if(!characterReady || isJumping || lockedAnimation)return;
 playOneShot("swordslash");
 const animal=nearestWildAnimal(3.8);
 if(animal){
  animal.health--;
  if(animal.health<=0){
   animal.alive=false;animal.object.visible=false;
   if(!state.huntedAnimals.includes(animal.id))state.huntedAnimals.push(animal.id);
   createCarcass(animal.x,animal.z);
   toast("Veado abatido! Recolha a carne e o couro.");
   saveGame();
  }else toast("Você atingiu o veado! Ele está ferido.");
 }
}
const loader = new GLTFLoader();
function loadCharacter(){
 return new Promise(resolve=>{
  let finished=false;
  const timer=setTimeout(()=>{if(!finished){finished=true;resolve(false);}},18000);
  loader.load(raw+"Viking_Male.gltf",g=>{
   if(finished)return;
   finished=true;clearTimeout(timer);
   const model=g.scene;
   const box=new THREE.Box3().setFromObject(model);
   const size=box.getSize(new THREE.Vector3());
   const center=box.getCenter(new THREE.Vector3());
   const scale=1.8/Math.max(size.y,.01);
   model.scale.setScalar(scale);
   model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
   model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.side=THREE.DoubleSide;}}});
   player.remove(fallback); player.add(model);state.characterModel=model;
   // Reposiciona as ferramentas depois que o esqueleto do personagem estiver carregado.
   if(state.axe)createToolVisual("axe");
   if(state.pickaxe)createToolVisual("pickaxe");
   if(g.animations?.length){
    mixer=new THREE.AnimationMixer(model);
    animationActions={};
    for(const clip of g.animations){
     const key=clip.name.toLowerCase().replace(/[^a-z]/g,"");
     animationActions[key]=mixer.clipAction(clip);
    }
    playCharacterAnimation("idle");
    mixer.addEventListener("finished",event=>{
     if(event.action===lockedAnimation){lockedAnimation=null;}
    });
   }
   characterReady=true; resolve(true);
  },undefined,()=>{
   if(finished)return;
   finished=true;clearTimeout(timer);resolve(false);
  });
 });
}
const treePositions=[];
for(let i=0;i<55;i++){
 const a=worldRandom()*Math.PI*2, r=12+worldRandom()*88;
 treePositions.push({x:Math.cos(a)*r,z:Math.sin(a)*r});
}
const treeModels=[];
async function loadTree(name){
 return new Promise(resolve=>{
  let finished=false;
  const timer=setTimeout(()=>{if(!finished){finished=true;resolve(null);}},12000);
  loader.load(raw+name+".gltf",g=>{
   if(finished)return;
   finished=true;clearTimeout(timer);resolve(g.scene);
  },undefined,()=>{
   if(finished)return;
   finished=true;clearTimeout(timer);resolve(null);
  });
 });
}
function scatterModel(model,x,z,scale=1){
 if(!model)return;
 const m=model.clone(true);
 m.position.set(x,terrainHeight(x,z),z); m.rotation.y=worldRandom()*Math.PI*2;
 const s=scale*(.78+worldRandom()*.5); m.scale.multiplyScalar(s);
 m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}}); scene.add(m); treeModels.push(m);
}
function addRock(x,z,s=1,collectible=false){
 const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.7*s,1),new THREE.MeshStandardMaterial({color:0x77786b,roughness:1}));
 rock.position.set(x,terrainHeight(x,z)+.35*s,z); rock.rotation.set(worldRandom(),worldRandom(),worldRandom()); rock.scale.y=.65; rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
 if(collectible)registerResource({object:rock,x,z,type:"stone",active:true});
 return rock;
}
function addGrass(){
 const geo=new THREE.BufferGeometry(), verts=[];
 for(let i=0;i<1600;i++){
  const x=(worldRandom()-.5)*210,z=(worldRandom()-.5)*210;
  if(Math.hypot(x,z)<8)continue;
  const h=.18+worldRandom()*.35,w=.035;
  const y=terrainHeight(x,z)+.015;
  verts.push(x-w,y,z,x+w,y,z,x,y+h,z);
 }
 geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x9aa66b,side:THREE.DoubleSide}));
 scene.add(mesh);
}
let resources=[];
const wildAnimals=[];
function resourceId(type,x,z){return `${type}:${x.toFixed(3)}:${z.toFixed(3)}`;}
function registerResource(resource){
 resource.id=resourceId(resource.type,resource.x,resource.z);
 if(state.collectedResources.includes(resource.id)){resource.active=false;resource.object.visible=false;if(resource.target)resource.target.visible=false;}
 resources.push(resource);
}
function createCarcass(x,z){
 const bodyMat=new THREE.MeshStandardMaterial({color:0x76513a,roughness:1});
 const darkMat=new THREE.MeshStandardMaterial({color:0x49382c,roughness:1});
 const carcass=new THREE.Group();
 const body=new THREE.Mesh(new THREE.SphereGeometry(.48,9,7),bodyMat);
 body.scale.set(1.35,.55,.8);body.position.set(0,.38,0);body.castShadow=true;carcass.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.2,7,6),darkMat);
 head.position.set(0,.32,.58);head.castShadow=true;carcass.add(head);
 carcass.position.set(x,terrainHeight(x,z),z);scene.add(carcass);
 registerResource({object:carcass,x,z,type:"carcass",active:true});
}
function createDeer(x,z,index){
 const id="deer-"+index;
 if(state.huntedAnimals.includes(id)){createCarcass(x,z);return;}
 const deer=new THREE.Group();
 const coat=new THREE.MeshStandardMaterial({color:0x8b6442,roughness:1});
 const belly=new THREE.MeshStandardMaterial({color:0xd3bd9a,roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:0x33271e,roughness:1});
 const body=new THREE.Mesh(new THREE.SphereGeometry(.58,10,8),coat);
 body.scale.set(1,.78,1.45);body.position.y=1.02;body.castShadow=true;deer.add(body);
 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,.72,7),coat);
 neck.position.set(0,1.32,.55);neck.rotation.x=.48;neck.castShadow=true;deer.add(neck);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.23,8,7),coat);
 head.position.set(0,1.64,.82);head.castShadow=true;deer.add(head);
 const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.12,7,6),belly);
 muzzle.scale.set(.85,.65,1.2);muzzle.position.set(0,1.58,1.01);deer.add(muzzle);
 const legs=[];
 for(const lx of [-.29,.29])for(const lz of [-.48,.48]){
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,.68,6),dark);
  leg.position.set(lx,.42,lz);leg.castShadow=true;deer.add(leg);legs.push(leg);
 }
 const tail=new THREE.Mesh(new THREE.SphereGeometry(.12,6,5),belly);
 tail.position.set(0,1.12,-.82);deer.add(tail);
 deer.position.set(x,terrainHeight(x,z),z);scene.add(deer);
 wildAnimals.push({id,object:deer,x,z,heading:worldRandom()*Math.PI*2,health:2,alive:true,wander:1+worldRandom()*2,legs});
}
function nearestWildAnimal(maxDistance){
 let nearest=null,dist=maxDistance;
 for(const animal of wildAnimals){if(!animal.alive)continue;const d=Math.hypot(player.position.x-animal.x,player.position.z-animal.z);if(d<dist){dist=d;nearest=animal;}}
 return nearest;
}
function updateWildlife(dt){
 for(const animal of wildAnimals){
  if(!animal.alive)continue;
  const dx=animal.x-player.position.x,dz=animal.z-player.position.z,d=Math.hypot(dx,dz);
  let speed=.45;
  if(d<9){animal.heading=Math.atan2(dx,dz);speed=3.2;}
  else{animal.wander-=dt;if(animal.wander<=0){animal.heading+=(worldRandom()-.5)*1.8;animal.wander=2+worldRandom()*3;}}
  animal.x+=Math.sin(animal.heading)*speed*dt;
  animal.z+=Math.cos(animal.heading)*speed*dt;
  animal.object.position.set(animal.x,terrainHeight(animal.x,animal.z),animal.z);
  animal.object.rotation.y=animal.heading;
 }
}
function createFiberPlant(x,z){
 const plant=new THREE.Group();
 const stemMat=new THREE.MeshStandardMaterial({color:0x668044,roughness:1});
 const fiberMat=new THREE.MeshStandardMaterial({color:0xb5a477,roughness:1});
 for(let i=0;i<5;i++){
  const a=i*Math.PI*2/5;
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.04,.72,5),stemMat);
  stem.position.set(Math.cos(a)*.12,.36,Math.sin(a)*.12);stem.rotation.z=Math.cos(a)*-.22;stem.rotation.x=Math.sin(a)*.22;plant.add(stem);
  const tuft=new THREE.Mesh(new THREE.SphereGeometry(.09,6,5),fiberMat);
  tuft.position.set(Math.cos(a)*.18,.72,Math.sin(a)*.18);tuft.scale.set(.65,1.8,.65);plant.add(tuft);
 }
 plant.position.set(x,terrainHeight(x,z),z);scene.add(plant);
 registerResource({object:plant,x,z,type:"fiber",active:true});
}
function createBerryBush(x,z){
 const bush=new THREE.Group();
 const leafMat=new THREE.MeshStandardMaterial({color:0x355d32,roughness:1});
 const berryMat=new THREE.MeshStandardMaterial({color:0x9e2630,roughness:.65});
 for(let i=0;i<5;i++){
  const a=i*Math.PI*2/5;
  const leaf=new THREE.Mesh(new THREE.SphereGeometry(.34,8,7),leafMat);
  leaf.position.set(Math.cos(a)*.22,.38+(i%2)*.12,Math.sin(a)*.22);leaf.scale.set(1,.72,1);leaf.castShadow=true;bush.add(leaf);
 }
 for(let i=0;i<7;i++){
  const a=i*2.4,r=.18+(i%3)*.08;
  const berry=new THREE.Mesh(new THREE.SphereGeometry(.075,7,6),berryMat);
  berry.position.set(Math.cos(a)*r,.42+(i%3)*.16,Math.sin(a)*r);berry.castShadow=true;bush.add(berry);
 }
 bush.position.set(x,terrainHeight(x,z),z);scene.add(bush);
 registerResource({object:bush,x,z,type:"berries",active:true});
}
function createWaterSource(x,z){
 const pond=new THREE.Group();
 const waterMat=new THREE.MeshStandardMaterial({color:0x477f91,roughness:.22,metalness:.08,transparent:true,opacity:.86});
 const water=new THREE.Mesh(new THREE.CircleGeometry(2.65,40),waterMat);
 water.rotation.x=-Math.PI/2;
 water.position.set(x,terrainHeight(x,z)+.09,z);
 pond.add(water);
 const rippleMat=new THREE.MeshBasicMaterial({color:0x9acbd0,transparent:true,opacity:.28,side:THREE.DoubleSide});
 for(let i=0;i<2;i++){
  const ripple=new THREE.Mesh(new THREE.RingGeometry(.55+i*.55,.59+i*.55,40),rippleMat);
  ripple.rotation.x=-Math.PI/2;ripple.position.set(x,water.position.y+.012+i*.003,z);pond.add(ripple);
 }
 const bankMat=new THREE.MeshStandardMaterial({color:0x77766a,roughness:1});
 for(let i=0;i<14;i++){
  const a=i*Math.PI*2/14,r=2.75+worldRandom()*.38;
  const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(.22+worldRandom()*.12,0),bankMat);
  const sx=x+Math.cos(a)*r,sz=z+Math.sin(a)*r;
  stone.position.set(sx,terrainHeight(sx,sz)+.16,sz);stone.scale.y=.72;stone.castShadow=true;pond.add(stone);
 }
 scene.add(pond);
 resources.push({object:pond,x,z,type:"water",active:true});
}
function createResource(x,z,type="wood",target=null){
 const stump=new THREE.Group();
 const log=new THREE.Mesh(new THREE.CylinderGeometry(.23,.3,.9,7),new THREE.MeshStandardMaterial({color:0x76502e}));
 log.rotation.z=Math.PI/2; log.position.y=.3; stump.add(log); stump.position.set(x,terrainHeight(x,z),z); scene.add(stump);
 registerResource({object:stump,x,z,type,target,active:true});
}
async function buildForest(){
 const [common,pine,twisted,rock] = await Promise.all([loadTree("CommonTree_1"),loadTree("Pine_1"),loadTree("TwistedTree_1"),loadTree("Rock_Medium_1")]);
 const choices=[common,pine,twisted];
 treePositions.forEach((p,i)=>{
  if(Math.hypot(p.x,p.z)<10)return;
  const tree=scatterModel(choices[i%choices.length],p.x,p.z,.8+worldRandom()*.55);
  if(i%5===0)createResource(p.x+1.8,p.z+.8,"wood",tree);
 });
 for(let i=0;i<35;i++){const a=worldRandom()*6.28,r=9+worldRandom()*85;addRock(Math.cos(a)*r,Math.sin(a)*r,.45+worldRandom()*.9,i%4===0);}
 // Materiais iniciais são posicionados ao redor da posição salva do jogador.
 const startX=0,startZ=0;
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,r=2.4+(i%2)*.8;
  createResource(startX+Math.cos(a)*r,startZ+Math.sin(a)*r,"branch");
 }
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4+.35,r=3.4+(i%2)*.7;
  const x=startX+Math.cos(a)*r,z=startZ+Math.sin(a)*r;
  const pebble=new THREE.Mesh(new THREE.DodecahedronGeometry(.25,0),new THREE.MeshStandardMaterial({color:0xaaa99c,roughness:1}));
  pebble.position.set(x,terrainHeight(x,z)+.14,z);pebble.castShadow=true;pebble.receiveShadow=true;scene.add(pebble);
  registerResource({object:pebble,x,z,type:"looseStone",active:true});
 }
 if(rock){for(let i=0;i<12;i++){const a=worldRandom()*6.28,r=12+worldRandom()*75;scatterModel(rock,Math.cos(a)*r,Math.sin(a)*r,.7);}}
 for(let i=0;i<14;i++){const a=worldRandom()*Math.PI*2,r=14+worldRandom()*62;createBerryBush(Math.cos(a)*r,Math.sin(a)*r);}
 for(let i=0;i<16;i++){const a=worldRandom()*Math.PI*2,r=8+worldRandom()*48;createFiberPlant(Math.cos(a)*r,Math.sin(a)*r);}
 for(let i=0;i<6;i++){const a=worldRandom()*Math.PI*2,r=24+worldRandom()*52;createDeer(Math.cos(a)*r,Math.sin(a)*r,i);}
 createWaterSource(13,0);
 addGrass();
}

const state={health:100,hunger:100,thirst:100,temperature:100,energy:100,wood:0,stone:0,axe:false,pickaxe:false,running:false,moveX:0,moveY:0,yaw:0,cameraYaw:0,cameraPitch:.22,day:1,timeOfDay:8,near:null,campfire:false,campfireX:null,campfireZ:null,shelter:false,shelterX:null,shelterZ:null,coldCloak:false,leatherBoots:false,fiber:0,collectedResources:[],berries:0,meat:0,cookedMeat:0,hide:0,huntedAnimals:[]};
function loadGame(){
 try{
  const saved=JSON.parse(localStorage.getItem("cronicas-floresta-save")||"null");
  if(!saved)return;
  for(const key of ["health","hunger","thirst","temperature","energy","wood","stone","day","timeOfDay","berries","fiber","meat","cookedMeat","hide"])if(Number.isFinite(saved[key]))state[key]=saved[key];
  state.axe=saved.axe===true;state.pickaxe=saved.pickaxe===true;
  state.campfire=saved.campfire===true;
  state.shelter=saved.shelter===true;
  state.coldCloak=saved.coldCloak===true;
  state.leatherBoots=saved.leatherBoots===true;
  if(Array.isArray(saved.collectedResources))state.collectedResources=saved.collectedResources.filter(v=>typeof v==="string");
  if(Array.isArray(saved.huntedAnimals))state.huntedAnimals=saved.huntedAnimals.filter(v=>typeof v==="string");
  if(Number.isFinite(saved.campfireX))state.campfireX=saved.campfireX;
  if(Number.isFinite(saved.campfireZ))state.campfireZ=saved.campfireZ;
  if(Number.isFinite(saved.shelterX))state.shelterX=saved.shelterX;
  if(Number.isFinite(saved.shelterZ))state.shelterZ=saved.shelterZ;
  if(Number.isFinite(saved.x))player.position.x=saved.x;
  if(Number.isFinite(saved.z))player.position.z=saved.z;
  player.position.y=terrainHeight(player.position.x,player.position.z);
 }catch(e){console.warn("Não foi possível carregar o salvamento",e);}
}
function saveGame(){
 try{localStorage.setItem("cronicas-floresta-save",JSON.stringify({x:player.position.x,z:player.position.z,health:state.health,hunger:state.hunger,thirst:state.thirst,temperature:state.temperature,energy:state.energy,wood:state.wood,stone:state.stone,axe:state.axe,pickaxe:state.pickaxe,day:state.day,timeOfDay:state.timeOfDay,campfire:state.campfire,campfireX:state.campfireX,campfireZ:state.campfireZ,shelter:state.shelter,shelterX:state.shelterX,shelterZ:state.shelterZ,collectedResources:state.collectedResources,berries:state.berries,fiber:state.fiber,coldCloak:state.coldCloak,leatherBoots:state.leatherBoots,meat:state.meat,cookedMeat:state.cookedMeat,hide:state.hide,huntedAnimals:state.huntedAnimals}));}
 catch(e){console.warn("Não foi possível salvar o jogo",e);}
}
loadGame();
// Recria visualmente as ferramentas que já foram fabricadas e salvas.
if(state.axe)createToolVisual("axe");
if(state.pickaxe)createToolVisual("pickaxe");
if(state.coldCloak)createCloakVisual();
if(state.leatherBoots)createBootsVisual();
const cameraTarget=new THREE.Vector3();
let last=performance.now(),toastTimer=0,lastSave=0;
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("show"),1900);}
function updateHUD(){
 $("healthBar").style.width=state.health+"%";$("hungerBar").style.width=state.hunger+"%";$("thirstBar").style.width=state.thirst+"%";$("temperatureBar").style.width=state.temperature+"%";$("energyBar").style.width=state.energy+"%";
 $("wood").textContent=state.wood;$("stone").textContent=state.stone;$("day").textContent=state.day;
 $("berryStatus").textContent="Frutas silvestres: "+state.berries;
 $("fiber").textContent=state.fiber;$("meat").textContent=state.meat;$("hide").textContent=state.hide;
 $("meatStatus").textContent="Carne crua: "+state.meat+" · Cozida: "+state.cookedMeat+" · Couro: "+state.hide;
 $("cookMeat").disabled=state.meat<1||!isNearCampfire();
 $("eatCookedMeat").disabled=state.cookedMeat<1||state.hunger>=100;
 $("eatMeat").disabled=state.meat<1||state.hunger>=100;
 $("cloakStatus").textContent=state.coldCloak?"Manto térmico: equipado":"Manto térmico: não fabricado";
 $("craftCloak").disabled=state.coldCloak||state.fiber<5||state.wood<2;
 $("bootsStatus").textContent=state.leatherBoots?"Botas de couro: equipadas":"Botas de couro: não fabricadas";
 $("craftBoots").disabled=state.leatherBoots||state.hide<2||state.fiber<3;
 $("eatBerry").disabled=state.berries<1||state.hunger>=100;
 $("eatMeat").disabled=state.meat<1||state.hunger>=100;
 $("axeStatus").textContent=state.axe?"Machado: fabricado":"Machado: não fabricado";$("pickaxeStatus").textContent=state.pickaxe?"Picareta: fabricada":"Picareta: não fabricada";
 $("craftAxe").disabled=state.axe||state.wood<3||state.stone<2;$("craftPickaxe").disabled=state.pickaxe||state.wood<3||state.stone<3;
 $("campfireStatus").textContent=state.campfire?"Fogueira: construída":"Fogueira: não construída";
 $("craftCampfire").disabled=state.campfire||state.wood<5||state.stone<3;
 $("shelterStatus").textContent=state.shelter?"Abrigo: construído":"Abrigo: não construído";
 $("craftShelter").disabled=state.shelter||state.wood<10||state.stone<4;
 $("collectBtn").disabled=!state.near;
 $("collectBtn").textContent=state.near?(state.near.type==="stone"?"MINERAR":state.near.type==="water"?"BEBER ÁGUA":"COLETAR"):"COLETAR";
 const nearbyAnimal=nearestWildAnimal(5);
 $("hint").textContent=nearbyAnimal?"Veado por perto. Aproxime-se e toque em ATACAR.":state.near?(state.near.type==="water"?"Fonte de água encontrada. Toque em BEBER ÁGUA.":state.near.type==="stone"?"Use a picareta para minerar.":state.near.type==="wood"?"Use o machado para cortar madeira.":state.near.type==="branch"?"Galho encontrado. Toque em COLETAR.":state.near.type==="berries"?"Frutas silvestres encontradas. Toque em COLETAR.":state.near.type==="fiber"?"Planta fibrosa encontrada. Toque em COLETAR.":"Pedra solta encontrada. Toque em COLETAR."):"Procure recursos e arbustos de frutas pela floresta.";
}
function collect(){
 if(!state.near)return;
 const resource=state.near;
 if(resource.type==="water"){
  if(state.thirst>=100){toast("Você não está com sede.");return;}
  state.thirst=Math.min(100,state.thirst+45);
  toast("Você bebeu água fresca. Sede recuperada.");updateHUD();saveGame();return;
 }
 if(resource.type==="wood"&&!state.axe){toast("Você precisa fabricar um machado.");return;}
 if(resource.type==="stone"&&!state.pickaxe){toast("Você precisa fabricar uma picareta.");return;}
 if(resource.type==="branch"){state.wood+=1;toast("Você recolheu 1 galho.");}
 else if(resource.type==="berries"){state.berries+=3;toast("Você recolheu 3 frutas silvestres.");}
 else if(resource.type==="fiber"){state.fiber+=2;toast("Você recolheu fibras vegetais.");}
 else if(resource.type==="carcass"){state.meat+=2;state.hide+=1;toast("Você recolheu 2 carnes e 1 couro.");}
 else if(resource.type==="looseStone"){state.stone+=1;toast("Você recolheu 1 pedra solta.");}
 else if(resource.type==="stone"){state.stone+=2;toast("Você minerou 2 pedras.");}
 else{state.wood+=3;toast("Você cortou e recolheu 3 madeiras.");}
 resource.object.visible=false;if(resource.target)resource.target.visible=false;resource.active=false;
 if(resource.id&&!state.collectedResources.includes(resource.id))state.collectedResources.push(resource.id);
 state.near=null;updateHUD();saveGame();
}
function craftTool(type){
 if(type==="axe"){
  if(state.axe||state.wood<3||state.stone<2){toast("Faltam materiais: 3 madeiras e 2 pedras.");return;}
  state.wood-=3;state.stone-=2;state.axe=true;createToolVisual("axe");toast("Machado fabricado! Agora pode cortar árvores.");
 }else{
  if(state.pickaxe||state.wood<3||state.stone<3){toast("Faltam materiais: 3 madeiras e 3 pedras.");return;}
  state.wood-=3;state.stone-=3;state.pickaxe=true;createToolVisual("pickaxe");toast("Picareta fabricada! Agora pode minerar rochas.");
 }
 updateHUD();saveGame();
}
const craftToggle=$("craftToggle"),craftPanel=$("craftPanel");
craftToggle.addEventListener("click",()=>{const open=craftPanel.classList.toggle("open");craftToggle.textContent=open?"FECHAR OFICINA":"FABRICAR";});
$("craftAxe").addEventListener("click",()=>craftTool("axe"));
$("craftPickaxe").addEventListener("click",()=>craftTool("pickaxe"));
$("craftCampfire").addEventListener("click",craftCampfire);
 $("eatBerry").addEventListener("click",eatBerry);
 $("eatMeat").addEventListener("click",eatMeat);
 $("cookMeat").addEventListener("click",cookMeat);
 $("eatCookedMeat").addEventListener("click",eatCookedMeat);
 function isNearCampfire(){return state.campfire&&Math.hypot(player.position.x-state.campfireX,player.position.z-state.campfireZ)<6;}
 function cookMeat(){
  if(!isNearCampfire()){toast("Aproxime-se da fogueira para cozinhar.");return;}
  if(state.meat<1){toast("Você não tem carne crua.");return;}
  const portions=state.meat;state.meat=0;state.cookedMeat+=portions;
  updateHUD();saveGame();toast(portions+" porções de carne cozidas na fogueira!");
 }
 function eatCookedMeat(){
  if(state.cookedMeat<1||state.hunger>=100)return;
  state.cookedMeat--;state.hunger=Math.min(100,state.hunger+55);
  updateHUD();saveGame();toast("Você comeu carne cozida e recuperou 55 pontos de fome.");
 }
 function eatMeat(){
  if(state.meat<1||state.hunger>=100)return;
  state.meat--;state.hunger=Math.min(100,state.hunger+32);
  updateHUD();saveGame();toast("Você comeu carne e recuperou 32 pontos de fome.");
 }
 function eatBerry(){
  if(state.berries<1||state.hunger>=100)return;
  state.berries--;state.hunger=Math.min(100,state.hunger+18);state.thirst=Math.min(100,state.thirst+4);
  updateHUD();saveGame();toast("Você comeu frutas silvestres. Fome recuperada.");
 }
function craftCampfire(){
 if(state.campfire){toast("Você já construiu sua fogueira.");return;}
 if(state.wood<5||state.stone<3){toast("Faltam materiais: 5 madeiras e 3 pedras.");return;}
 state.wood-=5;state.stone-=3;
 const x=player.position.x+Math.sin(player.rotation.y)*2.4;
 const z=player.position.z+Math.cos(player.rotation.y)*2.4;
 createCampfire(x,z);
 updateHUD();saveGame();toast("Fogueira construída! Descanse perto dela para recuperar energia.");
}
function createCampfire(x,z){
 if(state.campfireObject)scene.remove(state.campfireObject);
 const group=new THREE.Group();
 const stoneMat=new THREE.MeshStandardMaterial({color:0x77766d,roughness:1});
 const woodMat=new THREE.MeshStandardMaterial({color:0x68452b,roughness:1});
 for(let i=0;i<9;i++){
  const a=i*Math.PI*2/9;
  const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(.22,0),stoneMat);
  stone.position.set(Math.cos(a)*.62,.16,Math.sin(a)*.62);stone.scale.set(1,.72,.9);stone.castShadow=true;group.add(stone);
 }
 for(let i=0;i<3;i++){
  const log=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,1.15,7),woodMat);
  log.rotation.z=Math.PI/2;log.rotation.y=i*Math.PI/3;log.position.y=.22+i*.025;log.castShadow=true;group.add(log);
 }
 const flameMat=new THREE.MeshStandardMaterial({color:0xff8a24,emissive:0xff4b08,emissiveIntensity:1.7,roughness:.4});
 const flame=new THREE.Mesh(new THREE.ConeGeometry(.22,.8,7),flameMat);flame.position.y=.68;group.add(flame);
 const core=new THREE.Mesh(new THREE.SphereGeometry(.15,8,8),new THREE.MeshBasicMaterial({color:0xffd36a}));core.position.y=.43;group.add(core);
 const light=new THREE.PointLight(0xff9a42,1.8,10);light.position.y=1.1;group.add(light);
 group.position.set(x,terrainHeight(x,z),z);scene.add(group);
 state.campfireObject=group;state.campfire=true;state.campfireX=x;state.campfireZ=z;
}
function craftCloak(){
 if(state.coldCloak){toast("Você já está usando o manto térmico.");return;}
 if(state.fiber<5||state.wood<2){toast("Faltam materiais: 5 fibras e 2 madeiras.");return;}
 state.fiber-=5;state.wood-=2;state.coldCloak=true;createCloakVisual();updateHUD();saveGame();toast("Manto térmico fabricado! Você perde menos calor no frio.");
}
function craftBoots(){
 if(state.leatherBoots){toast("Você já está usando as botas de couro.");return;}
 if(state.hide<2||state.fiber<3){toast("Faltam materiais: 2 couros e 3 fibras.");return;}
 state.hide-=2;state.fiber-=3;state.leatherBoots=true;createBootsVisual();updateHUD();saveGame();toast("Botas de couro fabricadas! Você perde menos calor.");
}
function createBootsVisual(){
 if(state.bootsObject)player.remove(state.bootsObject);
 const boots=new THREE.Group();
 const leather=new THREE.MeshStandardMaterial({color:0x49301f,roughness:1});
 const sole=new THREE.MeshStandardMaterial({color:0x241b15,roughness:1});
 for(const x of [-.2,.2]){
  const foot=new THREE.Mesh(new THREE.BoxGeometry(.22,.19,.38),leather);
  foot.position.set(x,.11,.07);foot.castShadow=true;boots.add(foot);
  const base=new THREE.Mesh(new THREE.BoxGeometry(.23,.055,.39),sole);
  base.position.set(x,.035,.07);base.castShadow=true;boots.add(base);
 }
 player.add(boots);state.bootsObject=boots;
}
function createCloakVisual(){
 if(state.cloakObject)player.remove(state.cloakObject);
 const cloak=new THREE.Group();
 const fur=new THREE.MeshStandardMaterial({color:0x65452f,roughness:1});
 const trim=new THREE.MeshStandardMaterial({color:0xb49a6b,roughness:1});
 const cape=new THREE.Mesh(new THREE.SphereGeometry(.48,12,10),fur);cape.scale.set(.9,1.25,.34);cape.position.set(0,1.02,-.22);cape.castShadow=true;cloak.add(cape);
 const collar=new THREE.Mesh(new THREE.TorusGeometry(.28,.075,6,12),trim);collar.rotation.x=Math.PI/2;collar.position.set(0,1.52,-.04);collar.castShadow=true;cloak.add(collar);
 player.add(cloak);state.cloakObject=cloak;
}
$("craftCloak").addEventListener("click",craftCloak);
$("craftBoots").addEventListener("click",craftBoots);
function craftShelter(){
 if(state.shelter){toast("Você já construiu seu abrigo.");return;}
 if(state.wood<10||state.stone<4){toast("Faltam materiais: 10 madeiras e 4 pedras.");return;}
 state.wood-=10;state.stone-=4;
 const x=player.position.x+Math.sin(player.rotation.y)*2.8;
 const z=player.position.z+Math.cos(player.rotation.y)*2.8;
 createShelter(x,z);updateHUD();saveGame();toast("Abrigo construído! Fique perto dele durante a noite.");
}
function createShelter(x,z){
 if(state.shelterObject)scene.remove(state.shelterObject);
 const group=new THREE.Group();
 const woodMat=new THREE.MeshStandardMaterial({color:0x76502e,roughness:1});
 const darkWood=new THREE.MeshStandardMaterial({color:0x4d3523,roughness:1});
 const postGeo=new THREE.BoxGeometry(.16,1.65,.16);
 for(const px of [-1.05,1.05]){
  const post=new THREE.Mesh(postGeo,woodMat);post.position.set(px,.82,.35);post.castShadow=true;group.add(post);
  const rear=new THREE.Mesh(postGeo,woodMat);rear.position.set(px,.82,-.85);rear.castShadow=true;group.add(rear);
 }
 const roof=new THREE.Mesh(new THREE.BoxGeometry(2.45,.16,1.75),darkWood);
 roof.position.set(0,1.55,-.12);roof.rotation.x=-.32;roof.castShadow=true;roof.receiveShadow=true;group.add(roof);
 for(let i=0;i<7;i++){
  const plank=new THREE.Mesh(new THREE.BoxGeometry(.31,.12,1.72),woodMat);
  plank.position.set(-.93+i*.31,1.66,-.12);plank.rotation.x=-.32;plank.castShadow=true;group.add(plank);
 }
 const back=new THREE.Mesh(new THREE.BoxGeometry(2.1,1.35,.12),darkWood);back.position.set(0,.72,-.88);back.castShadow=true;group.add(back);
 group.position.set(x,terrainHeight(x,z),z);group.rotation.y=player.rotation.y;scene.add(group);
 state.shelterObject=group;state.shelter=true;state.shelterX=x;state.shelterZ=z;
}
$("craftShelter").addEventListener("click",craftShelter);
function createToolVisual(type){
 const key=type==="axe"?"axeObject":"pickaxeObject";
 const handKey=type==="axe"?"axeHand":"pickaxeHand";
 const previous=state[key];
 if(previous?.parent)previous.parent.remove(previous);
 state[handKey]=null;
 const group=new THREE.Group();
 const woodMat=new THREE.MeshStandardMaterial({color:0x8a5a2b,roughness:.88});
 const gripMat=new THREE.MeshStandardMaterial({color:0x382719,roughness:1});
 const metalMat=new THREE.MeshStandardMaterial({color:0xd8e1e4,metalness:.25,roughness:.28,emissive:0x66747a,emissiveIntensity:.7});
 // O punho fica dentro da palma; o cabo desce pelo lado de fora do antebraço.
 const handle=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,1.12,12),woodMat);
 handle.position.set(0,-.47,0);group.add(handle);
 const grip=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.25,12),gripMat);
 grip.position.set(0,.015,-.025);group.add(grip);
 const head=new THREE.Mesh(type==="axe"?new THREE.BoxGeometry(.5,.22,.2):new THREE.BoxGeometry(.76,.19,.2),metalMat);
 head.position.set(0,.18,-.07);group.add(head);
 if(type==="axe"){
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.22,.34,.22),metalMat);
  blade.position.set(.25,.14,0);group.add(blade);
 }else{
  const tipA=new THREE.Mesh(new THREE.ConeGeometry(.105,.24,10),metalMat);
  tipA.rotation.z=Math.PI/2;tipA.position.set(.45,.14,0);group.add(tipA);
  const tipB=new THREE.Mesh(new THREE.ConeGeometry(.105,.24,10),metalMat);
  tipB.rotation.z=-Math.PI/2;tipB.position.set(-.45,.14,0);group.add(tipB);
 }
 // Aumenta a leitura visual em tela pequena; o cabo não fica escondido dentro do punho.
 group.scale.setScalar(1.4);
 group.visible=true;
 group.traverse(o=>{if(o.isMesh){
  o.castShadow=true;o.frustumCulled=false;o.renderOrder=100;
  if(o.material){o.material.depthTest=false;o.material.depthWrite=false;}
 }});
 const side=type==="axe"?"right":"left";
 const handPattern=side==="right"?/^fist[._ ]?r$/i:/^fist[._ ]?l$/i;
 const rig=state.characterModel||null;
 let hand=null;
 if(rig)rig.traverse(o=>{if(!hand&&handPattern.test(o.name||""))hand=o;});
 state[handKey]=hand;
 if(hand){
  // Filho direto do osso correto: herda a pose e a rotação da mão em cada animação.
  hand.add(group);
  // Desloca a empunhadura para fora da palma e à frente do corpo, sem perder o vínculo com o osso.
  group.position.set(side==="right"?.025:-.025,0,-.16);
  group.rotation.set(0,0,side==="right"?-.10:.10);
 }else{
  // Fallback temporário até o modelo terminar de carregar.
  player.add(group);
  group.position.set(side==="right"?.62:-.62,1.02,-.42);
 }
 state[key]=group;
}
function updateToolAttachments(){
 for(const type of ["axe","pickaxe"]){
  const group=state[type==="axe"?"axeObject":"pickaxeObject"];
  const hand=state[type==="axe"?"axeHand":"pickaxeHand"];
  if(!group)continue;
  if(hand&&group.parent===hand){
   group.visible=true;
   continue;
  }
  if(group.parent!==player)player.add(group);
  group.position.set(type==="axe"?.62:-.62,1.02,-.42);
  group.rotation.set(0,0,type==="axe"?-.10:.10);
  group.visible=true;
 }
}
$("collectBtn").addEventListener("click",collect);
$("runBtn").addEventListener("click",()=>{state.running=!state.running;$("runBtn").textContent=state.running?"ANDAR":"CORRER";});
const joy=$("joystick"),stick=$("stick");
let joyPointer=null;
joy.addEventListener("pointerdown",e=>{joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e);});
joy.addEventListener("pointermove",e=>{if(e.pointerId===joyPointer)moveJoy(e);});
function moveJoy(e){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy),max=35;if(len>max){dx=dx/len*max;dy=dy/len*max;}stick.style.transform=`translate(${dx}px,${dy}px)`;// Inverte somente o eixo horizontal para alinhar esquerda/direita do controle ao movimento esperado.
 state.moveX=-dx/max;state.moveY=-dy/max;}
function resetJoy(e){if(e.pointerId!==joyPointer)return;joyPointer=null;state.moveX=0;state.moveY=0;stick.style.transform="translate(0,0)";}
joy.addEventListener("pointerup",resetJoy);joy.addEventListener("pointercancel",resetJoy);
const keys={};
addEventListener("keydown",e=>{
 keys[e.key.toLowerCase()]=true;
 if(e.key.toLowerCase()==="e")collect();
 if(e.key==="Shift")state.running=true;
 if(e.code==="Space"){e.preventDefault();jumpCharacter();}
 if(e.key.toLowerCase()==="f")attackCharacter();
});
addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;if(e.key==="Shift")state.running=false;});
$("jumpBtn").addEventListener("click",jumpCharacter);
$("attackBtn").addEventListener("click",attackCharacter);
let lookPointer=null,lastX=0,lastY=0;
renderer.domElement.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"||e.clientX>innerWidth*.38){lookPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);}});
renderer.domElement.addEventListener("pointermove",e=>{if(e.pointerId!==lookPointer)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;state.cameraYaw-=dx*.005;state.cameraPitch=THREE.MathUtils.clamp(state.cameraPitch+dy*.003,-.72,1.12);});
renderer.domElement.addEventListener("pointerup",e=>{if(e.pointerId===lookPointer)lookPointer=null;});
renderer.domElement.addEventListener("pointercancel",e=>{if(e.pointerId===lookPointer)lookPointer=null;});
function updateWorldLighting(dt){
 state.timeOfDay+=dt*24/900;
 if(state.timeOfDay>=24){state.timeOfDay-=24;state.day++;}
 const hour=state.timeOfDay;
 const daylight=THREE.MathUtils.clamp(Math.sin((hour-6)/12*Math.PI),0,1);
 sun.position.set(Math.cos((hour-6)/12*Math.PI)*45,Math.max(3,daylight*65),25);
 sun.intensity=.08+daylight*2.05;
 sun.color.setRGB(1,.72+daylight*.16,.48+daylight*.48);
 ambient.intensity=.35+daylight*1.65;
 const sky=new THREE.Color(0x18283d).lerp(new THREE.Color(0x9bb3a0),daylight);
 scene.background.copy(sky);scene.fog.color.copy(sky);
 const period=hour<5||hour>=20?"NOITE":hour<7?"AMANHECER":hour<17?"DIA":hour<19?"PÔR DO SOL":"ANOITECER";
 $("period").textContent=period;$("day").textContent=state.day;
}
function update(dt){
 updateWorldLighting(dt);
 updateWildlife(dt);
 const kx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
 const ky=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0);
 const mx=THREE.MathUtils.clamp(state.moveX+kx,-1,1),my=THREE.MathUtils.clamp(state.moveY+ky,-1,1);
 const moving=Math.hypot(mx,my)>.08;
 const fast=(state.running||keys.shift)&&state.energy>0;
 if(moving){
  const direction=new THREE.Vector3(mx,0,my).normalize();
  const angle=state.cameraYaw;
  // Corrige o eixo horizontal relativo à câmera: direita no joystick move para a direita da tela.
  const dx=direction.x*Math.cos(angle)+direction.z*Math.sin(angle);
  const dz=-direction.x*Math.sin(angle)+direction.z*Math.cos(angle);
  const speed=fast?7.1:3.6;
  player.position.x+=dx*speed*dt;player.position.z+=dz*speed*dt;
  state.yaw=Math.atan2(dx,dz);player.rotation.y=state.yaw;
  if(fast)state.energy=Math.max(0,state.energy-dt*2.5);else state.energy=Math.min(100,state.energy+dt*1.2);
 }else{state.energy=Math.min(100,state.energy+dt*4);}
 const nearFire=state.campfire&&Math.hypot(player.position.x-state.campfireX,player.position.z-state.campfireZ)<6;
 const nearShelter=state.shelter&&Math.hypot(player.position.x-state.shelterX,player.position.z-state.shelterZ)<5;
 if(nearFire){state.energy=Math.min(100,state.energy+dt*5);state.temperature=Math.min(100,state.temperature+dt*9);}
 else{const daylight=THREE.MathUtils.clamp(Math.sin((state.timeOfDay-6)/12*Math.PI),0,1);let coldRate=state.timeOfDay<6||state.timeOfDay>=19?.42:.10;if(nearShelter)coldRate*=.2;if(state.coldCloak)coldRate*=.45;if(state.leatherBoots)coldRate*=.7;state.temperature=THREE.MathUtils.clamp(state.temperature+dt*(daylight*.32-coldRate),0,100);}
 const floorY=terrainHeight(player.position.x,player.position.z);
 if(isJumping){
  verticalVelocity-=12*dt;
  player.position.y+=verticalVelocity*dt;
  if(player.position.y<=floorY){player.position.y=floorY;verticalVelocity=0;isJumping=false;lockedAnimation=null;}
 }else{player.position.y=floorY;}
 if(characterReady && !lockedAnimation && !isJumping){
  const desired=moving?(fast?"run":"walk"):"idle";
  if(currentAnimation!==animationActions[desired])playCharacterAnimation(desired);
 }
 state.hunger=Math.max(0,state.hunger-dt*.055);state.thirst=Math.max(0,state.thirst-dt*.085);
 if(mixer)mixer.update(dt);
 updateToolAttachments();
 cameraTarget.set(player.position.x,player.position.y+1.25,player.position.z);
 const distance=7.2,cp=Math.cos(state.cameraPitch),sp=Math.sin(state.cameraPitch);
 camera.position.set(player.position.x-Math.sin(state.cameraYaw)*distance*cp,player.position.y+1.25+distance*sp,player.position.z-Math.cos(state.cameraYaw)*distance*cp);
 camera.lookAt(cameraTarget);
 let closest=null,dist=6.0;
 for(const r of resources){if(!r.active)continue;const d=Math.hypot(player.position.x-r.x,player.position.z-r.z);if(d<dist){dist=d;closest=r;}}
 state.near=closest;updateHUD();
 if(state.hunger<=0||state.thirst<=0||state.temperature<=0){state.health=Math.max(0,state.health-dt*.7);}
}
function animate(now){
 requestAnimationFrame(animate);
 const dt=Math.min((now-last)/1000,.05);last=now;
 update(dt);if(now-lastSave>5000){saveGame();lastSave=now;}renderer.render(scene,camera);
}
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));});
async function start(){
 $("loadingText").textContent="Criando o terreno e a floresta...";
 $("loadingBar").style.width="20%";
 await buildForest();
 if(state.campfire&&Number.isFinite(state.campfireX)&&Number.isFinite(state.campfireZ))createCampfire(state.campfireX,state.campfireZ);
 if(state.shelter&&Number.isFinite(state.shelterX)&&Number.isFinite(state.shelterZ))createShelter(state.shelterX,state.shelterZ);
 $("loadingBar").style.width="72%";
 $("loadingText").textContent="Carregando o viajante...";
 const loaded=await loadCharacter();
 if(!loaded)toast("Modelo do viajante indisponível: usando personagem provisório.");
 $("loadingBar").style.width="100%";
 updateHUD();
 setTimeout(()=>{$("loading").style.opacity="0";setTimeout(()=>$("loading").remove(),700);},350);
 toast("Você despertou em uma floresta desconhecida.");
 animate(performance.now());
}
addEventListener("beforeunload",saveGame);
start().catch(err=>{console.error(err);$("loadingText").textContent="Não foi possível carregar o cenário. Atualize a página.";toast("Falha ao iniciar o mundo.");});
