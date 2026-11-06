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
function craftBow(){
 if(state.bow){toast("Você já fabricou o arco.");return;}
 if(state.wood<2||state.fiber<2){toast("Faltam materiais para o arco. Necessário: 2 madeiras e 2 fibras.");return;}
 state.wood-=2;state.fiber-=2;state.bow=true;
 toast("Arco fabricado! Prepare flechas na oficina.");updateHUD();saveGame();
}
function craftArrows(){
 if(!state.bow||state.wood<1||state.fiber<1){toast("Cada lote de flechas custa 1 madeira e 1 fibra.");return;}
 state.wood--;state.fiber--;state.arrows+=5;
 toast("Você fabricou 5 flechas.");updateHUD();saveGame();
}
function damageWildAnimal(animal){
 if(!animal||!animal.alive)return;
 animal.health--;
 if(animal.health<=0){
  animal.alive=false;animal.object.visible=false;
  if(!state.huntedAnimals.includes(animal.id))state.huntedAnimals.push(animal.id);
  createCarcass(animal.x,animal.z);
  toast("Veado abatido! Recolha a carne e o couro.");saveGame();
 }else toast("A flecha atingiu o veado! Ele está ferido.");
}
function shootArrow(){
 if(!state.bow||state.arrows<1){toast("Você precisa de um arco e flechas.");return;}
 const animal=nearestWildAnimal(16);
 if(!animal){toast("Nenhum veado no alcance do arco.");return;}
 if(!characterReady||isJumping||lockedAnimation)return;
 state.arrows--;
 const arrow=new THREE.Group();
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.58,5),new THREE.MeshStandardMaterial({color:0x9b7544,roughness:1}));
 shaft.rotation.x=Math.PI/2;arrow.add(shaft);
 const tip=new THREE.Mesh(new THREE.ConeGeometry(.055,.15,5),new THREE.MeshStandardMaterial({color:0x777b80,metalness:.35,roughness:.65}));
 tip.rotation.x=Math.PI/2;tip.position.z=.34;arrow.add(tip);
 const start=new THREE.Vector3(player.position.x,player.position.y+1.35,player.position.z);
 arrow.position.copy(start);scene.add(arrow);
 flyingArrows.push({object:arrow,start,target:animal,elapsed:0,duration:.38});
 playOneShot("swordslash");updateHUD();saveGame();
}
function updateFlyingArrows(dt){
 for(let i=flyingArrows.length-1;i>=0;i--){
  const arrow=flyingArrows[i];arrow.elapsed+=dt;
  const end=new THREE.Vector3(arrow.target.x,terrainHeight(arrow.target.x,arrow.target.z)+1.15,arrow.target.z);
  const t=THREE.MathUtils.clamp(arrow.elapsed/arrow.duration,0,1);
  arrow.object.position.lerpVectors(arrow.start,end,t);arrow.object.lookAt(end);
  if(t>=1){
   scene.remove(arrow.object);arrow.object.traverse(part=>{if(part.isMesh){part.geometry.dispose();if(Array.isArray(part.material))part.material.forEach(m=>m.dispose());else part.material.dispose();}});
   damageWildAnimal(arrow.target);flyingArrows.splice(i,1);
  }
 }
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
  createResource(p.x,p.z,"wood",tree);
 });
 for(let i=0;i<35;i++){const a=worldRandom()*6.28,r=9+worldRandom()*85;addRock(Math.cos(a)*r,Math.sin(a)*r,.45+worldRandom()*.9,true);}
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

const state={health:100,hunger:100,thirst:100,temperature:100,energy:100,wood:0,stone:0,axe:false,pickaxe:false,running:false,moveX:0,moveY:0,yaw:0,cameraYaw:0,cameraPitch:.22,day:1,timeOfDay:8,near:null,campfire:false,campfireX:null,campfireZ:null,shelter:false,shelterX:null,shelterZ:null,coldCloak:false,leatherBoots:false,fiber:0,collectedResources:[],berries:0,meat:0,cookedMeat:0,hide:0,huntedAnimals:[],starterKitGranted:false,bed:false,bedX:null,bedZ:null,bandages:0,storageChest:false,storageChestX:null,storageChestZ:null,storage:{wood:0,stone:0,fiber:0,berries:0,meat:0,cookedMeat:0,hide:0,bandages:0,honey:0},waterSkin:false,waterCharges:0,bow:false,arrows:0,fenceSections:[],gates:[],floorTiles:[],wallPanels:[],windowPanels:[],roofTiles:[],gablePanels:[],ridgeCaps:[],chimneys:[],pathTiles:[],lanternPosts:[],wells:[],gardenPlots:[],gardenObjects:[],nearGardenIndex:-1,marketStalls:[],nearMarketIndex:-1,coins:0,chickenCoops:[],nearCoopIndex:-1,eggs:0,apiaries:[],nearApiaryIndex:-1,honey:0,watchtowers:[],doorPanels:[],doorObjects:[],nearDoorIndex:-1,windowShutters:[],shutterObjects:[],nearShutterIndex:-1,gateObjects:[],nearGateIndex:-1};
function loadGame(){
 try{
  const saved=JSON.parse(localStorage.getItem("cronicas-floresta-save")||"null");
  if(!saved)return;
  for(const key of ["health","hunger","thirst","temperature","energy","wood","stone","day","timeOfDay","berries","fiber","meat","cookedMeat","hide","bandages","waterCharges","arrows","coins","eggs","honey"])if(Number.isFinite(saved[key]))state[key]=saved[key];
  state.axe=saved.axe===true;state.pickaxe=saved.pickaxe===true;
  state.starterKitGranted=saved.starterKitGranted===true;
  state.campfire=saved.campfire===true;
  state.shelter=saved.shelter===true;
  state.bed=saved.bed===true;
  state.storageChest=saved.storageChest===true;
  state.waterSkin=saved.waterSkin===true;
  state.bow=saved.bow===true;
  state.waterCharges=Math.max(0,Math.min(3,state.waterCharges));
  if(saved.storage&&typeof saved.storage==="object")for(const key of ["wood","stone","fiber","berries","meat","cookedMeat","hide","bandages","honey"])if(Number.isFinite(saved.storage[key]))state.storage[key]=Math.max(0,saved.storage[key]);
  state.coldCloak=saved.coldCloak===true;
  state.leatherBoots=saved.leatherBoots===true;
  if(Array.isArray(saved.collectedResources))state.collectedResources=saved.collectedResources.filter(v=>typeof v==="string");
  if(Array.isArray(saved.huntedAnimals))state.huntedAnimals=saved.huntedAnimals.filter(v=>typeof v==="string");
   if(Array.isArray(saved.fenceSections))state.fenceSections=saved.fenceSections.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,200);
   if(Array.isArray(saved.gates))state.gates=saved.gates.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,30).map(v=>({...v,open:v.open===true}));
  if(Array.isArray(saved.floorTiles))state.floorTiles=saved.floorTiles.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,100);
  if(Array.isArray(saved.wallPanels))state.wallPanels=saved.wallPanels.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,100);
  if(Array.isArray(saved.windowPanels))state.windowPanels=saved.windowPanels.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,100);
  if(Array.isArray(saved.roofTiles))state.roofTiles=saved.roofTiles.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,100);
  if(Array.isArray(saved.gablePanels))state.gablePanels=saved.gablePanels.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,100);
  if(Array.isArray(saved.ridgeCaps))state.ridgeCaps=saved.ridgeCaps.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,100);
  if(Array.isArray(saved.chimneys))state.chimneys=saved.chimneys.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,100);
  if(Array.isArray(saved.pathTiles))state.pathTiles=saved.pathTiles.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,200);
  if(Array.isArray(saved.lanternPosts))state.lanternPosts=saved.lanternPosts.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,24);
  if(Array.isArray(saved.wells))state.wells=saved.wells.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)).slice(0,5);
  if(Array.isArray(saved.gardenPlots))state.gardenPlots=saved.gardenPlots.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,8).map(v=>({...v,plantedAt:Number.isFinite(v.plantedAt)?v.plantedAt:0}));
  if(Array.isArray(saved.watchtowers))state.watchtowers=saved.watchtowers.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,6);
  if(Array.isArray(saved.marketStalls))state.marketStalls=saved.marketStalls.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,4);
  if(Array.isArray(saved.chickenCoops))state.chickenCoops=saved.chickenCoops.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,4).map(v=>({...v,lastEggAt:Number.isFinite(v.lastEggAt)?v.lastEggAt:Date.now()}));
  if(Array.isArray(saved.apiaries))state.apiaries=saved.apiaries.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,4).map(v=>({...v,lastHoneyAt:Number.isFinite(v.lastHoneyAt)?v.lastHoneyAt:Date.now()}));
  if(Array.isArray(saved.doorPanels))state.doorPanels=saved.doorPanels.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,100).map(v=>({...v,open:v.open===true}));
  if(Array.isArray(saved.windowShutters))state.windowShutters=saved.windowShutters.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,100).map(v=>({...v,open:v.open===true}));
  if(Number.isFinite(saved.campfireX))state.campfireX=saved.campfireX;
  if(Number.isFinite(saved.campfireZ))state.campfireZ=saved.campfireZ;
  if(Number.isFinite(saved.shelterX))state.shelterX=saved.shelterX;
  if(Number.isFinite(saved.shelterZ))state.shelterZ=saved.shelterZ;
  if(Number.isFinite(saved.bedX))state.bedX=saved.bedX;
  if(Number.isFinite(saved.bedZ))state.bedZ=saved.bedZ;
  if(Number.isFinite(saved.storageChestX))state.storageChestX=saved.storageChestX;
  if(Number.isFinite(saved.storageChestZ))state.storageChestZ=saved.storageChestZ;
  if(Number.isFinite(saved.x))player.position.x=saved.x;
  if(Number.isFinite(saved.z))player.position.z=saved.z;
  player.position.y=terrainHeight(player.position.x,player.position.z);
 }catch(e){console.warn("Não foi possível carregar o salvamento",e);}
}
function saveGame(){
 try{localStorage.setItem("cronicas-floresta-save",JSON.stringify({x:player.position.x,z:player.position.z,health:state.health,hunger:state.hunger,thirst:state.thirst,temperature:state.temperature,energy:state.energy,wood:state.wood,stone:state.stone,axe:state.axe,pickaxe:state.pickaxe,day:state.day,timeOfDay:state.timeOfDay,campfire:state.campfire,campfireX:state.campfireX,campfireZ:state.campfireZ,shelter:state.shelter,shelterX:state.shelterX,shelterZ:state.shelterZ,bed:state.bed,bedX:state.bedX,bedZ:state.bedZ,storageChest:state.storageChest,storageChestX:state.storageChestX,storageChestZ:state.storageChestZ,storage:state.storage,waterSkin:state.waterSkin,waterCharges:state.waterCharges,bow:state.bow,arrows:state.arrows,collectedResources:state.collectedResources,berries:state.berries,fiber:state.fiber,coldCloak:state.coldCloak,leatherBoots:state.leatherBoots,meat:state.meat,cookedMeat:state.cookedMeat,hide:state.hide,bandages:state.bandages,huntedAnimals:state.huntedAnimals,fenceSections:state.fenceSections,gates:state.gates,floorTiles:state.floorTiles,wallPanels:state.wallPanels,windowPanels:state.windowPanels,roofTiles:state.roofTiles,gablePanels:state.gablePanels,ridgeCaps:state.ridgeCaps,chimneys:state.chimneys,pathTiles:state.pathTiles,lanternPosts:state.lanternPosts,wells:state.wells,gardenPlots:state.gardenPlots,watchtowers:state.watchtowers,marketStalls:state.marketStalls,coins:state.coins,chickenCoops:state.chickenCoops,apiaries:state.apiaries,honey:state.honey,doorPanels:state.doorPanels,windowShutters:state.windowShutters,starterKitGranted:state.starterKitGranted}));}
 catch(e){console.warn("Não foi possível salvar o jogo",e);}
}
loadGame();
// Kit único de recuperação para fabricar as primeiras ferramentas sem apagar progresso.
if(!state.starterKitGranted){
 if(!state.axe&&!state.pickaxe){state.wood=Math.max(state.wood,3);state.stone=Math.max(state.stone,3);}
 state.starterKitGranted=true;
 saveGame();
}
// Recria visualmente as ferramentas que já foram fabricadas e salvas.
if(state.axe)createToolVisual("axe");
if(state.pickaxe)createToolVisual("pickaxe");
if(state.coldCloak)createCloakVisual();
if(state.leatherBoots)createBootsVisual();
const cameraTarget=new THREE.Vector3();
let last=performance.now(),toastTimer=0,lastSave=0;
const flyingArrows=[];
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("show"),1900);}
function updateHUD(){
  const milestones=[
   {done:state.axe,title:"Fabricar um machado",detail:"Reúna 3 madeiras e 2 pedras na floresta."},
   {done:state.pickaxe,title:"Fabricar uma picareta",detail:"Prepare 3 madeiras e 3 pedras para minerar."},
   {done:state.campfire,title:"Construir uma fogueira",detail:"Junte 5 madeiras e 3 pedras para se aquecer."},
   {done:state.shelter,title:"Construir um abrigo",detail:"Use 10 madeiras e 4 pedras para se proteger do frio."},
   {done:state.bed,title:"Preparar uma cama",detail:"Reúna 3 madeiras e 6 fibras para descansar à noite."},
   {done:state.bow,title:"Fabricar um arco",detail:"Use 2 madeiras e 2 fibras para caçar à distância."},
   {done:state.storageChest,title:"Construir um baú",detail:"Guarde seus materiais: 6 madeiras e 2 pedras."},
   {done:state.waterSkin,title:"Fabricar um cantil",detail:"Consiga 2 couros e 3 fibras para levar água."},
   {done:state.coldCloak,title:"Fabricar um manto térmico",detail:"Prepare 5 fibras e 2 madeiras para resistir ao frio."},
   {done:state.leatherBoots,title:"Fabricar botas de couro",detail:"Use 2 couros e 3 fibras para se proteger."}
  ];
  const completed=milestones.filter(item=>item.done).length;
  const progress=Math.round(completed/milestones.length*100);
  $("journeyProgressFill").style.width=progress+"%";
  const current=milestones.find(item=>!item.done);
  $("objectiveStep").textContent=current?"JORNADA · ETAPA "+(completed+1)+"/"+milestones.length:"JORNADA CONCLUÍDA";
  $("objectiveTitle").textContent=current?current.title:"Você está pronto para explorar e expandir seu assentamento.";
  $("objectiveDetail").textContent=current?current.detail:"Continue sobrevivendo, explorando e construindo sua aldeia.";
 $("bowStatus").textContent=state.bow?"Arco: fabricado · Flechas: "+state.arrows:"Arco: não fabricado · Madeira: "+state.wood+"/2 · Fibras: "+state.fiber+"/2";
  const huntTarget=nearestWildAnimal(16);
  if(huntTarget){
   const dx=huntTarget.x-player.position.x,dz=huntTarget.z-player.position.z;
   const distance=Math.hypot(dx,dz).toFixed(1);
   const angle=Math.atan2(dx,dz)-state.cameraYaw;
   const relative=Math.atan2(Math.sin(angle),Math.cos(angle));
   const directions=["à frente","à frente e à direita","à direita","atrás e à direita","atrás","atrás e à esquerda","à esquerda","à frente e à esquerda"];
   const direction=directions[Math.round(relative/(Math.PI/4)+8)%8];
   $("huntTargetStatus").textContent="Veado: "+distance+" m · "+direction+" · Vida "+huntTarget.health+"/2";
  }else $("huntTargetStatus").textContent="Caça: nenhum veado a até 16 m";
 $("craftBow").disabled=state.bow;
 $("craftArrows").disabled=!state.bow||state.wood<1||state.fiber<1;
 $("shootBtn").disabled=!state.bow||state.arrows<1;
 $("shootBtn").textContent="🏹 ATIRAR ("+state.arrows+")";
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
 $("waterSkinStatus").textContent=state.waterSkin?"Cantil de couro: fabricado · Cargas: "+state.waterCharges+"/3":"Cantil de couro: não fabricado";
 $("craftWaterSkin").disabled=state.waterSkin||state.hide<2||state.fiber<3;
 const nearWell=state.wells.some(w=>Math.hypot(player.position.x-w.x,player.position.z-w.z)<3.8);
 const nearWater=!!(state.near&&state.near.type==="water")||nearWell;
 $("drinkWell").disabled=!nearWell||state.thirst>=100;
 $("fillWaterSkin").disabled=!state.waterSkin||!nearWater||state.waterCharges>=3;
 $("drinkWaterSkin").disabled=state.waterCharges<1||state.thirst>=100;
 $("bandageStatus").textContent="Ataduras medicinais: "+state.bandages;
 $("craftBandage").disabled=state.fiber<4;
 $("useBandage").disabled=state.bandages<1||state.health>=100;
 $("eatBerry").disabled=state.berries<1||state.hunger>=100;
 $("eatMeat").disabled=state.meat<1||state.hunger>=100;
 $("axeStatus").textContent=state.axe?"Machado: fabricado":"Machado: não fabricado";$("pickaxeStatus").textContent=state.pickaxe?"Picareta: fabricada":"Picareta: não fabricada";
 $("craftAxe").disabled=state.axe||state.wood<3||state.stone<2;$("craftPickaxe").disabled=state.pickaxe||state.wood<3||state.stone<3;
 $("campfireStatus").textContent=state.campfire?"Fogueira: construída":"Fogueira: não construída";
 $("craftCampfire").disabled=state.campfire||state.wood<5||state.stone<3;
 $("shelterStatus").textContent=state.shelter?"Abrigo: construído":"Abrigo: não construído";
 $("craftShelter").disabled=state.shelter||state.wood<10||state.stone<4;
 $("bedStatus").textContent=state.bed?"Cama improvisada: construída":"Cama improvisada: não construída";
 $("craftBed").disabled=state.bed||state.wood<3||state.fiber<6;
 $("storageChestStatus").textContent=state.storageChest?"Baú de armazenamento: construído":"Baú de armazenamento: não construído";
  $("fenceStatus").textContent="Cercas construídas: "+state.fenceSections.length+" seções";
  $("floorTileStatus").textContent="Pisos de madeira: "+state.floorTiles.length+" módulos";
  $("wallPanelStatus").textContent="Paredes modulares: "+state.wallPanels.length+" painéis";
  $("windowPanelStatus").textContent="Paredes com janela: "+state.windowPanels.length+" painéis";
  $("roofTileStatus").textContent="Telhados modulares: "+state.roofTiles.length+" módulos";
  $("gableStatus").textContent="Fechamentos triangulares: "+state.gablePanels.length+" conjuntos";
  $("ridgeCapStatus").textContent="Cumeeiras reforçadas: "+state.ridgeCaps.length+" telhados";
  $("chimneyStatus").textContent="Chaminés de pedra: "+state.chimneys.length;
  $("pathTileStatus").textContent="Caminhos de pedra: "+state.pathTiles.length+" trechos";
  $("lanternPostStatus").textContent="Postes de iluminação: "+state.lanternPosts.length+"/24";
  $("wellStatus").textContent="Poços comunitários: "+state.wells.length+"/5";
  $("gardenStatus").textContent="Hortas comunitárias: "+state.gardenPlots.length+"/8";
  $("watchtowerStatus").textContent="Torres de vigia: "+state.watchtowers.length+"/6";
  $("marketStatus").textContent="Feiras construídas: "+state.marketStalls.length+"/4 · Moedas: "+state.coins;
  $("coopStatus").textContent="Galinheiros: "+state.chickenCoops.length+"/4 · Ovos: "+state.eggs;
  $("apiaryStatus").textContent="Colmeias: "+state.apiaries.length+"/4 · Mel: "+state.honey;
  $("craftApiary").disabled=state.wood<8||state.fiber<4||state.apiaries.length>=4;
  $("collectHoney").hidden=state.nearApiaryIndex<0;
  $("collectHoney").disabled=state.nearApiaryIndex<0||!state.apiaries[state.nearApiaryIndex]||Math.floor((Date.now()-state.apiaries[state.nearApiaryIndex].lastHoneyAt)/240000)<1;
  $("eatHoney").disabled=state.honey<1||state.hunger>=100&&state.thirst>=100;
  $("craftCoop").disabled=state.wood<9||state.fiber<3||state.chickenCoops.length>=4;
  $("collectEggs").hidden=state.nearCoopIndex<0;
  $("collectEggs").disabled=state.nearCoopIndex<0||!state.chickenCoops[state.nearCoopIndex]||Math.floor((Date.now()-state.chickenCoops[state.nearCoopIndex].lastEggAt)/180000)<1;
  $("eatEgg").disabled=state.eggs<1;
  $("craftMarket").disabled=state.wood<10||state.fiber<4||state.marketStalls.length>=4;
  const marketNear=state.nearMarketIndex>=0;
  $("marketActions").hidden=!marketNear;
  $("sellBerries").disabled=!marketNear||state.berries<5;
  $("sellMeat").disabled=!marketNear||state.meat<1;
  $("sellHide").disabled=!marketNear||state.hide<1;
  $("sellEgg").disabled=!marketNear||state.eggs<1;
  $("sellHoney").disabled=!marketNear||state.honey<1;
  $("craftWatchtower").disabled=state.wood<14||state.fiber<5||state.watchtowers.length>=6;
  $("craftGarden").disabled=state.wood<4||state.fiber<2||state.gardenPlots.length>=8;
  $("craftWell").disabled=state.stone<12||state.wood<5||state.wells.length>=5;
  $("craftLanternPost").disabled=state.wood<3||state.fiber<2||state.lanternPosts.length>=24||state.pathTiles.length===0;
  $("craftPathTile").disabled=state.stone<5||state.wood<1||state.pathTiles.length>=200;
  $("craftChimney").disabled=state.stone<6||state.wood<2||state.chimneys.length>=100||state.roofTiles.length===0;
  $("craftRidgeCap").disabled=state.wood<3||state.fiber<1||state.ridgeCaps.length>=100||state.roofTiles.length===0;
  $("craftGable").disabled=state.wood<8||state.fiber<3||state.gablePanels.length>=100||state.roofTiles.length===0;
  $("doorPanelStatus").textContent="Portas de madeira: "+state.doorPanels.length;
  $("shutterStatus").textContent="Persianas de madeira: "+state.windowShutters.length+" conjuntos";
  $("craftShutters").disabled=state.wood<4||state.fiber<2||state.windowShutters.length>=100||state.windowPanels.length===0;
  $("craftDoorPanel").disabled=state.wood<8||state.fiber<3||state.doorPanels.length>=100||state.floorTiles.length===0;
  $("craftRoofTile").disabled=state.wood<8||state.fiber<3||state.roofTiles.length>=100||state.floorTiles.length===0;
  $("craftWindowPanel").disabled=state.wood<7||state.fiber<2||state.windowPanels.length>=100||state.floorTiles.length===0;
  $("craftWallPanel").disabled=state.wood<6||state.fiber<2||state.wallPanels.length>=100||state.floorTiles.length===0;
  $("craftFloorTile").disabled=state.wood<4||state.fiber<2||state.floorTiles.length>=100;
  $("craftFence").disabled=state.wood<5||state.fiber<2||state.fenceSections.length>=200;
  $("gateStatus").textContent="Portões construídos: "+state.gates.length;
  $("craftGate").disabled=state.wood<8||state.fiber<3||state.gates.length>=30;
  let nearestGate=-1,gateDistance=4.2;
  for(let i=0;i<state.gates.length;i++){const gate=state.gates[i],d=Math.hypot(player.position.x-gate.x,player.position.z-gate.z);if(d<gateDistance){gateDistance=d;nearestGate=i;}}
  state.nearGateIndex=nearestGate;
  $("gateToggle").hidden=nearestGate<0;
  if(nearestGate>=0)$("gateToggle").textContent=state.gates[nearestGate].open?"FECHAR PORTÃO":"ABRIR PORTÃO";
  let nearestDoor=-1,doorDistance=4.2;
  for(let i=0;i<state.doorPanels.length;i++){const door=state.doorPanels[i],d=Math.hypot(player.position.x-door.x,player.position.z-door.z);if(d<doorDistance){doorDistance=d;nearestDoor=i;}}
  state.nearDoorIndex=nearestDoor;
  $("doorToggle").hidden=nearestDoor<0;
  if(nearestDoor>=0)$("doorToggle").textContent=state.doorPanels[nearestDoor].open?"FECHAR PORTA":"ABRIR PORTA";
  let nearestShutter=-1,shutterDistance=4.2;
  for(let i=0;i<state.windowShutters.length;i++){const shutter=state.windowShutters[i],d=Math.hypot(player.position.x-shutter.x,player.position.z-shutter.z);if(d<shutterDistance){shutterDistance=d;nearestShutter=i;}}
  state.nearShutterIndex=nearestShutter;
  $("shutterToggle").hidden=nearestShutter<0;
  if(nearestShutter>=0)$("shutterToggle").textContent=state.windowShutters[nearestShutter].open?"FECHAR PERSIANAS":"ABRIR PERSIANAS";
 $("craftStorageChest").disabled=state.storageChest||state.wood<6||state.stone<2;
 const nearChest=state.storageChest&&Math.hypot(player.position.x-state.storageChestX,player.position.z-state.storageChestZ)<3.5;
 const carried=["wood","stone","fiber","berries","meat","cookedMeat","hide","bandages"].some(k=>state[k]>0);
 const stored=Object.values(state.storage).some(v=>v>0);
 $("storeResources").disabled=!nearChest||!carried;
 $("takeResources").disabled=!nearChest||!stored;
 $("storageStatus").textContent=nearChest?"Baú próximo · Guardar ou retirar recursos":"Aproxime-se do baú para acessar os materiais";
 const nearBed=state.bed&&Math.hypot(player.position.x-state.bedX,player.position.z-state.bedZ)<3.2;
 const night=state.timeOfDay>=19||state.timeOfDay<6;
 $("sleepBtn").hidden=!(nearBed&&night);
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
 if(resource.type==="fiber"){resource.respawnAt=Date.now()+90000;toast("Fibras coletadas. A planta vai crescer novamente em 90 segundos.");}
 else if(resource.id&&!state.collectedResources.includes(resource.id))state.collectedResources.push(resource.id);
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
// Backup manual do progresso: usa a mesma chave de salvamento, sem alterar o formato existente.
const backupArea=document.createElement("div");
backupArea.style.cssText="display:grid;gap:6px;margin-top:6px;padding-top:8px;border-top:1px solid #c2a76a55";
const backupTitle=document.createElement("strong");
backupTitle.textContent="SEGURANÇA DO PROGRESSO";
const backupInfo=document.createElement("small");
backupInfo.textContent="Exporte uma cópia do seu mundo ou restaure um arquivo salvo anteriormente.";
const exportBackupButton=document.createElement("button");
exportBackupButton.type="button";
exportBackupButton.textContent="⬇ BAIXAR BACKUP DO JOGO";
const importBackupButton=document.createElement("button");
importBackupButton.type="button";
importBackupButton.textContent="⬆ RESTAURAR BACKUP";
const backupFileInput=document.createElement("input");
backupFileInput.type="file";
backupFileInput.accept=".json,application/json";
backupFileInput.hidden=true;
backupArea.append(backupTitle,backupInfo,exportBackupButton,importBackupButton,backupFileInput);
craftPanel.appendChild(backupArea);
function downloadSaveBackup(){
 const rawSave=localStorage.getItem("cronicas-floresta-save");
 if(!rawSave){toast("Nenhum progresso salvo foi encontrado neste navegador.");return;}
 try{
  JSON.parse(rawSave);
  const blob=new Blob([rawSave],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  link.href=url;link.download="cronicas-floresta-backup-"+stamp+".json";
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast("Backup do progresso preparado para baixar.");
 }catch(error){toast("Não foi possível preparar o backup.");}
}
function restoreSaveBackup(file){
 if(!file)return;
 const reader=new FileReader();
 reader.onload=()=>{
  try{
   const imported=JSON.parse(String(reader.result||""));
   if(!imported||typeof imported!=="object"||Array.isArray(imported))throw new Error("Formato inválido");
   const validKeys=["x","z","health","hunger","thirst","wood","stone","axe","pickaxe","day","timeOfDay","collectedResources"];
   if(!validKeys.some(key=>Object.prototype.hasOwnProperty.call(imported,key)))throw new Error("Backup sem dados do jogo");
   if(!confirm("Restaurar este backup substituirá o progresso salvo neste navegador. Deseja continuar?"))return;
   localStorage.setItem("cronicas-floresta-save",JSON.stringify(imported));
   toast("Backup restaurado. Recarregando o mundo...");
   setTimeout(()=>location.reload(),700);
  }catch(error){toast("Arquivo inválido. O progresso atual foi mantido.");}
 };
 reader.onerror=()=>toast("Não foi possível ler o arquivo de backup.");
 reader.readAsText(file);
}
exportBackupButton.addEventListener("click",downloadSaveBackup);
importBackupButton.addEventListener("click",()=>backupFileInput.click());
backupFileInput.addEventListener("change",()=>{const file=backupFileInput.files?.[0];restoreSaveBackup(file);backupFileInput.value="";});

craftToggle.addEventListener("click",()=>{const open=craftPanel.classList.toggle("open");craftToggle.textContent=open?"FECHAR OFICINA":"FABRICAR";});
$("craftAxe").addEventListener("click",()=>craftTool("axe"));
$("craftPickaxe").addEventListener("click",()=>craftTool("pickaxe"));
$("craftStorageChest").addEventListener("click",craftStorageChest);
 $("craftFence").addEventListener("click",craftFenceSection);
 $("craftFloorTile").addEventListener("click",craftFloorTile);
 $("craftWallPanel").addEventListener("click",craftWallPanel);
 $("craftWindowPanel").addEventListener("click",craftWindowPanel);
 $("craftRoofTile").addEventListener("click",craftRoofTile);
 $("craftGable").addEventListener("click",craftGablePanel);
 $("craftRidgeCap").addEventListener("click",craftRidgeCap);
 $("craftChimney").addEventListener("click",craftChimney);
 $("craftPathTile").addEventListener("click",craftPathTile);
 $("craftLanternPost").addEventListener("click",craftLanternPost);
 $("craftWell").addEventListener("click",craftWell);
 $("craftGarden").addEventListener("click",craftGardenPlot);
 $("craftWatchtower").addEventListener("click",craftWatchtower);
 $("craftMarket").addEventListener("click",craftMarketStall);
 $("craftCoop").addEventListener("click",craftChickenCoop);
 $("collectEggs").addEventListener("click",collectCoopEggs);
 $("eatEgg").addEventListener("click",eatEgg);
 $("craftApiary").addEventListener("click",craftApiary);
 $("collectHoney").addEventListener("click",collectHoney);
 $("eatHoney").addEventListener("click",eatHoney);
 $("sellBerries").addEventListener("click",()=>sellMarketGoods("berries"));
 $("sellMeat").addEventListener("click",()=>sellMarketGoods("meat"));
 $("sellHide").addEventListener("click",()=>sellMarketGoods("hide"));
 $("sellEgg").addEventListener("click",()=>sellMarketGoods("egg"));
 $("sellHoney").addEventListener("click",()=>sellMarketGoods("honey"));
 $("gardenAction").addEventListener("click",gardenAction);
 $("drinkWell").addEventListener("click",drinkFromWell);
 $("craftDoorPanel").addEventListener("click",craftDoorPanel);
 $("doorToggle").addEventListener("click",toggleNearbyDoor);
 $("craftShutters").addEventListener("click",craftWindowShutters);
 $("shutterToggle").addEventListener("click",toggleNearbyShutters);
 $("craftGate").addEventListener("click",craftGate);
 $("gateToggle").addEventListener("click",toggleNearbyGate);
$("storeResources").addEventListener("click",storeResources);
$("takeResources").addEventListener("click",takeResources);
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
function craftStorageChest(){
 if(state.storageChest){toast("Você já construiu um baú de armazenamento.");return;}
 if(state.wood<6||state.stone<2){toast("Faltam materiais: 6 madeiras e 2 pedras.");return;}
 state.wood-=6;state.stone-=2;
 const x=player.position.x+Math.sin(player.rotation.y)*2.5;
 const z=player.position.z+Math.cos(player.rotation.y)*2.5;
 createStorageChest(x,z);updateHUD();saveGame();toast("Baú construído! Guarde seus recursos para liberar espaço na mochila.");
}
function createStorageChest(x,z){
 if(state.storageChestObject)scene.remove(state.storageChestObject);
 const group=new THREE.Group();
 const wood=new THREE.MeshStandardMaterial({color:0x684329,roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:0x35251a,roughness:1});
 const metal=new THREE.MeshStandardMaterial({color:0x77766b,metalness:.55,roughness:.6});
 const base=new THREE.Mesh(new THREE.BoxGeometry(1.25,.68,.82),wood);base.position.y=.43;base.castShadow=true;group.add(base);
 const lid=new THREE.Mesh(new THREE.BoxGeometry(1.3,.16,.88),dark);lid.position.y=.84;lid.castShadow=true;group.add(lid);
 const band=new THREE.Mesh(new THREE.BoxGeometry(.12,.72,.9),metal);band.position.set(0,.45,0);group.add(band);
 const latch=new THREE.Mesh(new THREE.BoxGeometry(.18,.2,.08),metal);latch.position.set(0,.67,.46);group.add(latch);
 group.position.set(x,terrainHeight(x,z),z);group.rotation.y=player.rotation.y;scene.add(group);
 state.storageChestObject=group;state.storageChest=true;state.storageChestX=x;state.storageChestZ=z;
}
function findFenceConnection(targetX,targetZ,extension){
  let best=null,bestDistance=5.5;
  for(const section of state.fenceSections){
   const axisX=Math.cos(section.yaw),axisZ=-Math.sin(section.yaw);
   for(const side of [-1,1]){
    const endX=section.x+axisX*side*3.2;
    const endZ=section.z+axisZ*side*3.2;
    const candidateX=endX+axisX*side*extension;
    const candidateZ=endZ+axisZ*side*extension;
    const distance=Math.hypot(candidateX-targetX,candidateZ-targetZ);
    if(distance<bestDistance){bestDistance=distance;best={x:candidateX,z:candidateZ,yaw:section.yaw};}
   }
  }
  return best;
 }
 function craftPathTile(){
  if(state.pathTiles.length>=200){toast("Limite de 200 trechos de caminho atingido.");return;}
  if(state.stone<5||state.wood<1){toast("Faltam materiais: 5 pedras e 1 madeira.");return;}
  const yaw=Math.round(player.rotation.y/(Math.PI/2))*(Math.PI/2);
  const targetX=player.position.x+Math.sin(yaw)*4.5;
  const targetZ=player.position.z+Math.cos(yaw)*4.5;
  const x=Math.round(targetX/3)*3,z=Math.round(targetZ/3)*3;
  if(state.pathTiles.some(tile=>Math.hypot(tile.x-x,tile.z-z)<2.3)){
   toast("Já existe um caminho neste espaço. Afaste-se para continuar.");return;
  }
  const tile={x,z,yaw};
  state.stone-=5;state.wood-=1;
  createPathTile(tile);state.pathTiles.push(tile);
  updateHUD();saveGame();toast("Trecho de caminho de pedras assentado!");
 }
 function craftLanternPost(){
  if(state.lanternPosts.length>=24){toast("Limite de 24 postes de iluminação atingido.");return;}
  if(state.wood<3||state.fiber<2){toast("Faltam materiais: 3 madeiras e 2 fibras.");return;}
  if(!state.pathTiles.length){toast("Assente primeiro um caminho de pedras.");return;}
  let nearest=null,nearestDistance=5.5;
  for(const tile of state.pathTiles){
   const distance=Math.hypot(player.position.x-tile.x,player.position.z-tile.z);
   if(distance<nearestDistance){nearestDistance=distance;nearest=tile;}
  }
  if(!nearest){toast("Aproxime-se de um caminho de pedras para instalar a iluminação.");return;}
  const x=nearest.x+Math.cos(nearest.yaw)*1.85;
  const z=nearest.z-Math.sin(nearest.yaw)*1.85;
  if(state.lanternPosts.some(post=>Math.hypot(post.x-x,post.z-z)<2.7)){
   toast("Já existe um poste muito próximo deste trecho.");return;
  }
  const post={x,z,yaw:nearest.yaw};
  state.wood-=3;state.fiber-=2;
  createLanternPost(post);state.lanternPosts.push(post);
  updateHUD();saveGame();toast("Poste de iluminação instalado ao lado do caminho!");
 }
 function craftWell(){
  if(state.wells.length>=5){toast("Limite de 5 poços comunitários atingido.");return;}
  if(state.stone<12||state.wood<5){toast("Faltam materiais: 12 pedras e 5 madeiras.");return;}
  const yaw=state.cameraYaw;
  const x=Math.round((player.position.x+Math.sin(yaw)*5)/3)*3;
  const z=Math.round((player.position.z+Math.cos(yaw)*5)/3)*3;
  if(state.wells.some(w=>Math.hypot(w.x-x,w.z-z)<5)){
   toast("Já existe um poço muito próximo. Afaste-se para construir outro.");return;
  }
  const well={x,z};
  state.stone-=12;state.wood-=5;
  createWell(well);state.wells.push(well);
  updateHUD();saveGame();toast("Poço comunitário construído! Agora você pode beber e encher o cantil aqui.");
 }
 function craftApiary(){
  if(state.apiaries.length>=4){toast("Limite de 4 colmeias atingido.");return;}
  if(state.wood<8||state.fiber<4){toast("Faltam materiais: 8 madeiras e 4 fibras.");return;}
  const yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2);
  const x=Math.round((player.position.x+Math.sin(yaw)*6)/3)*3;
  const z=Math.round((player.position.z+Math.cos(yaw)*6)/3)*3;
  if(state.apiaries.some(v=>Math.hypot(v.x-x,v.z-z)<5)){toast("Já existe uma colmeia muito próxima. Escolha outro local.");return;}
  const apiary={x,z,yaw,lastHoneyAt:Date.now()};
  state.wood-=8;state.fiber-=4;state.apiaries.push(apiary);createApiary(apiary);
  updateHUD();saveGame();toast("Colmeia construída! As abelhas começarão a produzir mel.");
 }
 function createApiary(apiary){
  const group=new THREE.Group();
  const woodMat=new THREE.MeshStandardMaterial({color:0x704725,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x3b2b1d,roughness:1});
  const straw=new THREE.MeshStandardMaterial({color:0xb69a59,roughness:1});
  const gold=new THREE.MeshStandardMaterial({color:0xd7a52e,roughness:.8});
  const cream=new THREE.MeshStandardMaterial({color:0xe4d2a6,roughness:1});
  // Suporte e três caixas de colmeia em madeira e palha.
  for(let i=0;i<3;i++){
   const x=(i-1)*1.05,z=(i%2)*.35;
   const stand=new THREE.Mesh(new THREE.BoxGeometry(.86,.18,.82),dark);
   stand.position.set(x,.55,z);group.add(stand);
   const box=new THREE.Mesh(new THREE.CylinderGeometry(.43,.48,.78,8),i===1?cream:straw);
   box.position.set(x,1.02,z);group.add(box);
   const lid=new THREE.Mesh(new THREE.CylinderGeometry(.48,.43,.13,8),woodMat);
   lid.position.set(x,1.47,z);group.add(lid);
   const entrance=new THREE.Mesh(new THREE.CircleGeometry(.09,12),dark);
   entrance.position.set(x,1.02,z+.47);group.add(entrance);
   for(let band=0;band<3;band++){
    const stripe=new THREE.Mesh(new THREE.TorusGeometry(.435,.025,5,16),gold);
    stripe.rotation.x=Math.PI/2;stripe.position.set(x,.78+band*.2,z);group.add(stripe);
   }
  }
  // Flores silvestres ao redor da apiária.
  for(let i=0;i<9;i++){
   const angle=i*Math.PI*2/9,r=1.9;
   const stem=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,.42,5),woodMat);
   stem.position.set(Math.cos(angle)*r,.21,Math.sin(angle)*r);group.add(stem);
   const flower=new THREE.Mesh(new THREE.SphereGeometry(.11,7,6),i%2?gold:cream);
   flower.position.set(Math.cos(angle)*r,.43,Math.sin(angle)*r);group.add(flower);
  }
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  group.position.set(apiary.x,terrainHeight(apiary.x,apiary.z),apiary.z);
  group.rotation.y=apiary.yaw;scene.add(group);return group;
 }
 function collectHoney(){
  const apiary=state.apiaries[state.nearApiaryIndex];
  if(!apiary){toast("Aproxime-se de uma colmeia.");return;}
  const elapsed=Math.max(0,Date.now()-apiary.lastHoneyAt);
  const produced=Math.min(3,Math.floor(elapsed/240000));
  if(produced<1){toast("O mel ainda está sendo produzido. Aguarde um pouco.");return;}
  state.honey+=produced;apiary.lastHoneyAt+=produced*240000;
  updateHUD();saveGame();toast("Você recolheu "+produced+" pote(s) de mel!");
 }
 function eatHoney(){
  if(state.honey<1){toast("Você não tem mel.");return;}
  if(state.hunger>=100&&state.thirst>=100){toast("Fome e sede já estão satisfeitas.");return;}
  state.honey--;state.hunger=Math.min(100,state.hunger+18);state.thirst=Math.min(100,state.thirst+10);
  updateHUD();saveGame();toast("Mel consumido: +18 de fome e +10 de sede.");
 }
 function craftChickenCoop(){
  if(state.chickenCoops.length>=4){toast("Limite de 4 galinheiros atingido.");return;}
  if(state.wood<9||state.fiber<3){toast("Faltam materiais: 9 madeiras e 3 fibras.");return;}
  const yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2);
  const x=Math.round((player.position.x+Math.sin(yaw)*6)/3)*3;
  const z=Math.round((player.position.z+Math.cos(yaw)*6)/3)*3;
  if(state.chickenCoops.some(coop=>Math.hypot(coop.x-x,coop.z-z)<5)){
   toast("Já existe um galinheiro muito próximo. Escolha outro local.");return;
  }
  const coop={x,z,yaw,lastEggAt:Date.now()};
  state.wood-=9;state.fiber-=3;
  state.chickenCoops.push(coop);createChickenCoop(coop);
  updateHUD();saveGame();toast("Galinheiro construído! As galinhas começarão a produzir ovos.");
 }
 function createChickenCoop(coop){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x684326,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x3f2b1d,roughness:1});
  const straw=new THREE.MeshStandardMaterial({color:0xb69a59,roughness:1});
  const white=new THREE.MeshStandardMaterial({color:0xe6dfc9,roughness:.85});
  const red=new THREE.MeshStandardMaterial({color:0x9e342a,roughness:.8});
  const feather=new THREE.MeshStandardMaterial({color:0xc8bda5,roughness:1});
  for(const x of [-1.7,1.7])for(const z of [-1.25,1.25]){
   const post=new THREE.Mesh(new THREE.BoxGeometry(.13,.85,.13),dark);
   post.position.set(x,.43,z);group.add(post);
  }
  for(const z of [-1.25,1.25])for(const y of [.32,.67]){
   const rail=new THREE.Mesh(new THREE.BoxGeometry(3.35,.1,.1),timber);rail.position.set(0,y,z);group.add(rail);
  }
  for(const x of [-1.7,1.7])for(const y of [.32,.67]){
   const rail=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,2.45),timber);rail.position.set(x,y,0);group.add(rail);
  }
  const house=new THREE.Mesh(new THREE.BoxGeometry(1.45,1.05,1.25),timber);
  house.position.set(0,.62,-.35);group.add(house);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(1.15,.72,4),straw);
  roof.position.set(0,1.48,-.35);roof.rotation.y=Math.PI/4;group.add(roof);
  const door=new THREE.Mesh(new THREE.BoxGeometry(.38,.65,.08),dark);
  door.position.set(0,.38,.31);group.add(door);
  for(let i=0;i<3;i++){
   const x=-.85+i*.82,z=.72+(i%2)*.22;
   const body=new THREE.Mesh(new THREE.SphereGeometry(.28,9,7),white);
   body.scale.set(1,.78,1.25);body.position.set(x,.48,z);group.add(body);
   const head=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),feather);
   head.position.set(x,.72,z+.24);group.add(head);
   const beak=new THREE.Mesh(new THREE.ConeGeometry(.065,.18,5),straw);
   beak.position.set(x,.69,z+.39);beak.rotation.x=Math.PI/2;group.add(beak);
   const comb=new THREE.Mesh(new THREE.SphereGeometry(.07,6,5),red);
   comb.position.set(x,.86,z+.2);group.add(comb);
   for(const side of [-1,1]){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.22,5),red);
    leg.position.set(x+side*.09,.2,z);group.add(leg);
   }
  }
  for(const x of [-.95,.95]){
   const nest=new THREE.Mesh(new THREE.CylinderGeometry(.28,.32,.16,8),straw);
   nest.position.set(x,.2,-.8);group.add(nest);
  }
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  group.position.set(coop.x,terrainHeight(coop.x,coop.z),coop.z);
  group.rotation.y=coop.yaw;scene.add(group);return group;
 }
 function collectCoopEggs(){
  const coop=state.chickenCoops[state.nearCoopIndex];
  if(!coop){toast("Aproxime-se de um galinheiro.");return;}
  const elapsed=Math.max(0,Date.now()-coop.lastEggAt);
  const produced=Math.min(3,Math.floor(elapsed/180000));
  if(produced<1){toast("As galinhas ainda estão botando ovos. Aguarde um pouco.");return;}
  state.eggs+=produced;coop.lastEggAt+=produced*180000;
  updateHUD();saveGame();toast("Você recolheu "+produced+" ovo(s) frescos!");
 }
 function eatEgg(){
  if(state.eggs<1){toast("Você não tem ovos para comer.");return;}
  if(state.hunger>=100){toast("Sua fome já está satisfeita.");return;}
  state.eggs--;state.hunger=Math.min(100,state.hunger+22);
  updateHUD();saveGame();toast("Você comeu um ovo fresco. +22 de fome.");
 }
 function craftMarketStall(){
  if(state.marketStalls.length>=4){toast("Limite de 4 bancas de feira atingido.");return;}
  if(state.wood<10||state.fiber<4){toast("Faltam materiais: 10 madeiras e 4 fibras.");return;}
  const yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2);
  const x=Math.round((player.position.x+Math.sin(yaw)*5)/3)*3;
  const z=Math.round((player.position.z+Math.cos(yaw)*5)/3)*3;
  if(state.marketStalls.some(stall=>Math.hypot(stall.x-x,stall.z-z)<5)){
   toast("Já existe uma feira muito próxima. Escolha outro local.");return;
  }
  const stall={x,z,yaw};
  state.wood-=10;state.fiber-=4;
  state.marketStalls.push(stall);createMarketStall(stall);
  updateHUD();saveGame();toast("Banca de feira construída! Aproxime-se para negociar sua produção.");
 }
 function createMarketStall(stall){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x684326,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x3e2b1d,roughness:1});
  const clothA=new THREE.MeshStandardMaterial({color:0x9b3329,roughness:1});
  const clothB=new THREE.MeshStandardMaterial({color:0xd8c59a,roughness:1});
  const produce=new THREE.MeshStandardMaterial({color:0x9d3c27,roughness:.7});
  for(const x of [-1.65,1.65])for(const z of [-.85,.85]){
   const post=new THREE.Mesh(new THREE.BoxGeometry(.16,2.65,.16),timber);
   post.position.set(x,1.32,z);group.add(post);
  }
  const counter=new THREE.Mesh(new THREE.BoxGeometry(3.65,.18,.72),dark);
  counter.position.set(0,1.02,.55);group.add(counter);
  const front=new THREE.Mesh(new THREE.BoxGeometry(3.55,.72,.12),timber);
  front.position.set(0,.63,.9);group.add(front);
  for(const y of [.25,1.78]){
   const beam=new THREE.Mesh(new THREE.BoxGeometry(3.5,.13,.13),dark);
   beam.position.set(0,y,-.85);group.add(beam);
  }
  const canopy=new THREE.Group();
  for(let i=0;i<7;i++){
   const panel=new THREE.Mesh(new THREE.BoxGeometry(.52,.12,2.05),i%2?clothB:clothA);
   panel.position.set(-1.56+i*.52,2.62,0);panel.rotation.z=(i%2?-.035:.035);canopy.add(panel);
  }
  canopy.traverse(o=>{if(o.isMesh)o.castShadow=true;});group.add(canopy);
  for(let i=0;i<5;i++){
   const basket=new THREE.Mesh(new THREE.CylinderGeometry(.23,.2,.24,8),dark);
   basket.position.set(-1.25+i*.62,1.23,.48);group.add(basket);
   for(let j=0;j<3;j++){
    const fruit=new THREE.Mesh(new THREE.SphereGeometry(.11,7,6),produce);
    fruit.position.set(-1.32+i*.62+(j%2)*.13,1.42+(j===1?.04:0),.45+(j-1)*.12);group.add(fruit);
   }
  }
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  group.position.set(stall.x,terrainHeight(stall.x,stall.z),stall.z);
  group.rotation.y=stall.yaw;scene.add(group);return group;
 }
 function sellMarketGoods(type){
  if(state.nearMarketIndex<0){toast("Aproxime-se de uma banca de feira para negociar.");return;}
  let amount=0,price=0,label="";
  if(type==="berries"&&state.berries>=5){amount=5;price=10;state.berries-=amount;label="5 frutas silvestres";}
  else if(type==="meat"&&state.meat>=1){amount=1;price=7;state.meat-=amount;label="1 carne crua";}
  else if(type==="hide"&&state.hide>=1){amount=1;price=12;state.hide-=amount;label="1 couro";}
  else if(type==="egg"&&state.eggs>=1){amount=1;price=5;state.eggs-=amount;label="1 ovo fresco";}
  else if(type==="honey"&&state.honey>=1){amount=1;price=8;state.honey-=amount;label="1 pote de mel";}
  else{toast("Você não tem quantidade suficiente para esta venda.");return;}
  state.coins+=price;
  updateHUD();saveGame();toast("Venda concluída: "+label+" por "+price+" moedas.");
 }
 function craftWatchtower(){
  if(state.watchtowers.length>=6){toast("Limite de 6 torres de vigia atingido.");return;}
  if(state.wood<14||state.fiber<5){toast("Faltam materiais: 14 madeiras e 5 fibras.");return;}
  const yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2);
  const x=Math.round((player.position.x+Math.sin(yaw)*7)/3)*3;
  const z=Math.round((player.position.z+Math.cos(yaw)*7)/3)*3;
  if(state.watchtowers.some(t=>Math.hypot(t.x-x,t.z-z)<8)){
   toast("Já existe uma torre muito próxima. Escolha outro local.");return;
  }
  const tower={x,z,yaw};
  state.wood-=14;state.fiber-=5;
  state.watchtowers.push(tower);createWatchtower(tower);
  updateHUD();saveGame();toast("Torre de vigia construída! Um novo marco para proteger o assentamento.");
 }
 function createWatchtower(tower){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x684326,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x3f2b1d,roughness:1});
  const plank=new THREE.MeshStandardMaterial({color:0x8a613b,roughness:1});
  const roofMat=new THREE.MeshStandardMaterial({color:0x59402c,roughness:1});
  const metal=new THREE.MeshStandardMaterial({color:0x4a4a43,metalness:.35,roughness:.7});
  // Quatro pilares estruturais e travessas diagonais.
  for(const x of [-1.55,1.55])for(const z of [-1.55,1.55]){
   const post=new THREE.Mesh(new THREE.BoxGeometry(.28,5.25,.28),timber);
   post.position.set(x,2.62,z);group.add(post);
   const brace=new THREE.Mesh(new THREE.BoxGeometry(.16,1.65,.16),dark);
   brace.position.set(x*.72,1.05,z*.72);brace.rotation.z=(x>0?-1:1)*.48;group.add(brace);
  }
  // Plataforma elevada com vigas e piso de tábuas.
  for(const y of [2.95,3.32]){
   for(const z of [-1.62,1.62]){
    const beam=new THREE.Mesh(new THREE.BoxGeometry(3.55,.2,.22),dark);
    beam.position.set(0,y,z);group.add(beam);
   }
   for(const x of [-1.62,1.62]){
    const beam=new THREE.Mesh(new THREE.BoxGeometry(.22,.2,3.55),dark);
    beam.position.set(x,y,0);group.add(beam);
   }
  }
  for(let i=0;i<7;i++){
   const board=new THREE.Mesh(new THREE.BoxGeometry(.43,.13,3.12),plank);
   board.position.set(-1.29+i*.43,3.48,0);group.add(board);
  }
  // Guarda-corpo com aberturas nos quatro lados.
  for(const y of [4.05,4.72]){
   for(const z of [-1.55,1.55]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(3.15,.13,.13),timber);
    rail.position.set(0,y,z);group.add(rail);
   }
   for(const x of [-1.55,1.55]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.13,.13,3.15),timber);
    rail.position.set(x,y,0);group.add(rail);
   }
  }
  for(const x of [-1.48,1.48])for(const z of [-1.48,1.48]){
   const upright=new THREE.Mesh(new THREE.BoxGeometry(.12,1.05,.12),dark);
   upright.position.set(x,4.45,z);group.add(upright);
  }
  // Escada frontal com montantes e degraus.
  for(const x of [-.78,.78]){
   const rail=new THREE.Mesh(new THREE.BoxGeometry(.16,4.05,.16),dark);
   rail.position.set(x,2.05,1.92);rail.rotation.x=-.18;group.add(rail);
  }
  for(let i=0;i<11;i++){
   const rung=new THREE.Mesh(new THREE.BoxGeometry(1.52,.13,.2),plank);
   rung.position.set(0,.38+i*.34,1.92-(i*.13));group.add(rung);
  }
  // Cobertura inclinada em duas águas.
  const ridge=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,3.75),dark);
  ridge.position.set(0,6.05,0);group.add(ridge);
  for(const side of [-1,1]){
   const roof=new THREE.Mesh(new THREE.BoxGeometry(2.05,.16,3.9),roofMat);
   roof.position.set(side*.92,5.75,0);roof.rotation.z=side*.32;group.add(roof);
   const fascia=new THREE.Mesh(new THREE.BoxGeometry(.13,.2,4.05),dark);
   fascia.position.set(side*1.82,5.35,0);fascia.rotation.z=side*.32;group.add(fascia);
  }
  const sign=new THREE.Mesh(new THREE.BoxGeometry(1.25,.5,.12),dark);
  sign.position.set(0,4.95,1.68);group.add(sign);
  for(const x of [-.45,.45]){
   const rivet=new THREE.Mesh(new THREE.SphereGeometry(.055,6,5),metal);
   rivet.position.set(x,4.95,1.6);group.add(rivet);
  }
  group.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}});
  group.position.set(tower.x,terrainHeight(tower.x,tower.z),tower.z);
  group.rotation.y=tower.yaw;scene.add(group);return group;
 }
 function craftGardenPlot(){
  if(state.gardenPlots.length>=8){toast("Limite de 8 hortas comunitárias atingido.");return;}
  if(state.wood<4||state.fiber<2){toast("Faltam materiais: 4 madeiras e 2 fibras.");return;}
  const yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2);
  const x=Math.round((player.position.x+Math.sin(yaw)*5)/3)*3;
  const z=Math.round((player.position.z+Math.cos(yaw)*5)/3)*3;
  if(state.gardenPlots.some(plot=>Math.hypot(plot.x-x,plot.z-z)<4.5)){
   toast("Já existe uma horta muito próxima. Afaste-se para construir outra.");return;
  }
  const plot={x,z,yaw,plantedAt:0};
  state.wood-=4;state.fiber-=2;
  state.gardenPlots.push(plot);state.gardenObjects.push(createGardenPlot(plot));
  updateHUD();saveGame();toast("Horta comunitária construída! Aproxime-se dela para plantar frutas silvestres.");
 }
 function createGardenPlot(plot){
  const group=new THREE.Group();
  const soil=new THREE.Mesh(new THREE.BoxGeometry(3.15,.2,2.15),new THREE.MeshStandardMaterial({color:0x493323,roughness:1}));
  soil.position.y=.12;group.add(soil);
  const wood=new THREE.MeshStandardMaterial({color:0x684326,roughness:1});
  for(const z of [-1.12,1.12]){
   const rail=new THREE.Mesh(new THREE.BoxGeometry(3.35,.2,.14),wood);
   rail.position.set(0,.28,z);group.add(rail);
  }
  for(const x of [-1.62,1.62]){
   const rail=new THREE.Mesh(new THREE.BoxGeometry(.14,.2,2.25),wood);
   rail.position.set(x,.28,0);group.add(rail);
  }
  if(plot.plantedAt>0){
   const mature=Date.now()-plot.plantedAt>=150000;
   const leafMat=new THREE.MeshStandardMaterial({color:0x477b37,roughness:1});
   const fruitMat=new THREE.MeshStandardMaterial({color:0x9d2921,roughness:.55});
   for(let row=0;row<2;row++)for(let col=0;col<4;col++){
    const x=-1.05+col*.7,z=-.48+row*.92;
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,.42,5),leafMat);
    stem.position.set(x,.42,z);group.add(stem);
    for(const side of [-1,1]){
     const leaf=new THREE.Mesh(new THREE.SphereGeometry(.16,6,5),leafMat);
     leaf.scale.set(1,.45,.7);leaf.position.set(x+side*.12,.5,z);group.add(leaf);
    }
    if(mature){
     const fruit=new THREE.Mesh(new THREE.SphereGeometry(.095,8,6),fruitMat);
     fruit.position.set(x,.68,z+.12);group.add(fruit);
    }
   }
  }
  group.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}});
  group.position.set(plot.x,terrainHeight(plot.x,plot.z),plot.z);
  group.rotation.y=plot.yaw;scene.add(group);return group;
 }
 function refreshGardenPlot(index){
  const old=state.gardenObjects[index];if(old)scene.remove(old);
  state.gardenObjects[index]=createGardenPlot(state.gardenPlots[index]);
 }
 function gardenAction(){
  const index=state.nearGardenIndex;
  if(index<0||!state.gardenPlots[index]){toast("Aproxime-se de uma horta comunitária.");return;}
  const plot=state.gardenPlots[index];
  if(plot.plantedAt>0){
   if(Date.now()-plot.plantedAt<150000){toast("As frutas ainda estão crescendo. Volte em alguns minutos.");return;}
   state.berries+=6;plot.plantedAt=0;refreshGardenPlot(index);
   updateHUD();saveGame();toast("Colheita concluída: +6 frutas silvestres!");return;
  }
  if(state.berries<3){toast("Você precisa de 3 frutas silvestres para plantar.");return;}
  state.berries-=3;plot.plantedAt=Date.now();refreshGardenPlot(index);
  updateHUD();saveGame();toast("Frutas plantadas! A colheita ficará pronta em 2 minutos e 30 segundos.");
 }
 function createWell(well){
  const group=new THREE.Group();
  const stoneMat=new THREE.MeshStandardMaterial({color:0x77766e,roughness:1});
  const darkStone=new THREE.MeshStandardMaterial({color:0x454943,roughness:1});
  const woodMat=new THREE.MeshStandardMaterial({color:0x59391f,roughness:1});
  const waterMat=new THREE.MeshStandardMaterial({color:0x285c70,metalness:.15,roughness:.25});
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(1.18,1.28,.72,12,1,true),stoneMat);
  ring.position.y=.43;group.add(ring);
  const lip=new THREE.Mesh(new THREE.TorusGeometry(1.16,.14,6,12),darkStone);
  lip.rotation.x=Math.PI/2;lip.position.y=.82;group.add(lip);
  const water=new THREE.Mesh(new THREE.CircleGeometry(1.02,16),waterMat);
  water.rotation.x=-Math.PI/2;water.position.y=.61;group.add(water);
  for(const x of [-.9,.9]){
   const post=new THREE.Mesh(new THREE.BoxGeometry(.16,2.75,.16),woodMat);
   post.position.set(x,1.95,0);group.add(post);
  }
  const beam=new THREE.Mesh(new THREE.BoxGeometry(2.15,.18,.2),woodMat);
  beam.position.y=3.32;group.add(beam);
  const roofMat=new THREE.MeshStandardMaterial({color:0x49301e,roughness:1});
  const roofL=new THREE.Mesh(new THREE.BoxGeometry(2.65,.13,1.65),roofMat);
  roofL.position.set(0,3.65,-.38);roofL.rotation.x=-.32;group.add(roofL);
  const roofR=new THREE.Mesh(new THREE.BoxGeometry(2.65,.13,1.65),roofMat);
  roofR.position.set(0,3.65,.38);roofR.rotation.x=.32;group.add(roofR);
  const axle=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,2.05,8),woodMat);
  axle.rotation.z=Math.PI/2;axle.position.y=2.55;group.add(axle);
  const crank=new THREE.Mesh(new THREE.BoxGeometry(.12,.72,.12),woodMat);
  crank.position.set(1.13,2.28,0);group.add(crank);
  const rope=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1.45,6),darkStone);
  rope.position.set(0,1.75,0);group.add(rope);
  const bucket=new THREE.Mesh(new THREE.CylinderGeometry(.18,.14,.28,8,1,true),woodMat);
  bucket.position.set(0,1.05,0);group.add(bucket);
  group.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}});
  group.position.set(well.x,terrainHeight(well.x,well.z),well.z);
  scene.add(group);
 }
 function drinkFromWell(){
  let nearest=null,distance=3.8;
  for(const well of state.wells){const d=Math.hypot(player.position.x-well.x,player.position.z-well.z);if(d<distance){distance=d;nearest=well;}}
  if(!nearest){toast("Aproxime-se de um poço comunitário.");return;}
  if(state.thirst>=100){toast("Você não está com sede.");return;}
  state.thirst=Math.min(100,state.thirst+50);
  updateHUD();saveGame();toast("Você bebeu água fresca do poço e recuperou 50 pontos de sede.");
 }
 function createLanternPost(post){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x57351f,roughness:1});
  const darkWood=new THREE.MeshStandardMaterial({color:0x352318,roughness:1});
  const iron=new THREE.MeshStandardMaterial({color:0x292b2b,metalness:.65,roughness:.65});
  const glow=new THREE.MeshStandardMaterial({color:0xffa83d,emissive:0xff6a12,emissiveIntensity:1.8,roughness:.45});
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.11,.16,3.25,8),timber);
  pole.position.y=1.62;group.add(pole);
  const foot=new THREE.Mesh(new THREE.BoxGeometry(.62,.18,.62),darkWood);
  foot.position.y=.12;group.add(foot);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(1.05,.13,.14),timber);
  arm.position.set(.42,3.02,0);group.add(arm);
  const cap=new THREE.Mesh(new THREE.BoxGeometry(.62,.12,.62),darkWood);
  cap.position.set(.78,2.78,0);group.add(cap);
  const lamp=new THREE.Group();lamp.position.set(.78,2.48,0);group.add(lamp);
  const body=new THREE.Mesh(new THREE.BoxGeometry(.42,.48,.42),glow);lamp.add(body);
  for(const x of [-.24,.24])for(const z of [-.24,.24]){
   const bar=new THREE.Mesh(new THREE.BoxGeometry(.045,.62,.045),iron);
   bar.position.set(x,0,z);lamp.add(bar);
  }
  const top=new THREE.Mesh(new THREE.ConeGeometry(.36,.22,4),iron);
  top.position.y=.36;top.rotation.y=Math.PI/4;lamp.add(top);
  const base=new THREE.Mesh(new THREE.BoxGeometry(.52,.08,.52),iron);
  base.position.y=-.29;lamp.add(base);
  const light=new THREE.PointLight(0xffa34a,1.15,9,2);
  light.position.set(.78,2.45,0);group.add(light);
  group.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}});
  group.position.set(post.x,terrainHeight(post.x,post.z),post.z);
  group.rotation.y=post.yaw;scene.add(group);
  return group;
 }
 function createPathTile(tile){
  const group=new THREE.Group();
  const stones=[
   [-1.12,-1.05,.72,.56],[-.28,-1.08,.68,.62],[.62,-1.02,.78,.55],
   [1.12,-.28,.62,.76],[.32,-.24,.72,.68],[-.58,-.25,.78,.7],
   [-1.12,.58,.66,.72],[-.25,.62,.8,.62],[.68,.62,.76,.72],
   [.18,1.2,.72,.48],[-.78,1.18,.68,.5]
  ];
  const palette=[0x77766e,0x89877d,0x686a65,0x969184,0x777a75];
  for(let i=0;i<stones.length;i++){
   const [x,z,w,d]=stones[i];
   const geo=new THREE.BoxGeometry(w,.16,d);
   const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:palette[i%palette.length],roughness:1}));
   mesh.position.set(x,.09+(i%3)*.008,z);
   mesh.rotation.y=((i%4)-1.5)*.09;
   mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
   const chip=new THREE.Mesh(new THREE.BoxGeometry(w*.22,.045,d*.18),new THREE.MeshStandardMaterial({color:0xaaa496,roughness:1}));
   chip.position.set(x-w*.12,.18,z-d*.12);chip.rotation.y=mesh.rotation.y;group.add(chip);
  }
  group.position.set(tile.x,terrainHeight(tile.x,tile.z)+.015,tile.z);
  group.rotation.y=tile.yaw;scene.add(group);
  return group;
 }
 function craftFloorTile(){
  if(state.floorTiles.length>=100){toast("Limite de 100 módulos de piso atingido.");return;}
  if(state.wood<4||state.fiber<2){toast("Faltam materiais: 4 madeiras e 2 fibras.");return;}
  const facing=player.rotation.y;
  const yaw=Math.round(facing/(Math.PI/2))*(Math.PI/2);
  const targetX=player.position.x+Math.sin(yaw)*4.5;
  const targetZ=player.position.z+Math.cos(yaw)*4.5;
  const x=Math.round(targetX/3)*3,z=Math.round(targetZ/3)*3;
  if(state.floorTiles.some(tile=>Math.hypot(tile.x-x,tile.z-z)<2.3)){
   toast("Este espaço já tem um piso. Afaste-se para construir o próximo módulo.");return;
  }
  const tile={x,z,yaw};
  state.wood-=4;state.fiber-=2;
  createFloorTile(tile);state.floorTiles.push(tile);
  updateHUD();saveGame();
  toast("Piso de madeira construído! Os próximos módulos se alinham à grade do assentamento.");
 }
 function createFloorTile(tile){
  const group=new THREE.Group();
  const wood=new THREE.MeshStandardMaterial({color:0x87603a,roughness:1});
  const edge=new THREE.MeshStandardMaterial({color:0x513720,roughness:1});
  for(let i=0;i<9;i++){
   const plank=new THREE.Mesh(new THREE.BoxGeometry(2.86,.14,.29),wood);
   plank.position.set(0,.2,-1.28+i*.32);plank.castShadow=true;plank.receiveShadow=true;group.add(plank);
  }
  for(const z of [-1.22,1.22]){
   const beam=new THREE.Mesh(new THREE.BoxGeometry(3.02,.2,.18),edge);
   beam.position.set(0,.08,z);beam.castShadow=true;group.add(beam);
  }
  for(const x of [-1.25,1.25]){
   const beam=new THREE.Mesh(new THREE.BoxGeometry(.18,.2,2.55),edge);
   beam.position.set(x,.08,0);beam.castShadow=true;group.add(beam);
  }
  group.position.set(tile.x,terrainHeight(tile.x,tile.z),tile.z);
  group.rotation.y=tile.yaw;scene.add(group);
  return group;
 }
 function craftWallPanel(){
  if(state.wallPanels.length>=100){toast("Limite de 100 painéis de parede atingido.");return;}
  if(state.wood<6||state.fiber<2){toast("Faltam materiais: 6 madeiras e 2 fibras.");return;}
  if(!state.floorTiles.length){toast("Construa primeiro um piso modular para apoiar a parede.");return;}
  let nearest=null,nearestDistance=7;
  for(const tile of state.floorTiles){
   const dx=player.position.x-tile.x,dz=player.position.z-tile.z;
   const localX=dx*Math.cos(tile.yaw)-dz*Math.sin(tile.yaw);
   const localZ=dx*Math.sin(tile.yaw)+dz*Math.cos(tile.yaw);
   const distance=Math.hypot(dx,dz);
   if(distance<nearestDistance){nearestDistance=distance;nearest={tile,localX,localZ};}
  }
  if(!nearest){toast("Aproxime-se de um piso modular para construir a parede.");return;}
  const {tile,localX,localZ}=nearest;
  let edgeX=0,edgeZ=0,placedYaw=tile.yaw;
  if(Math.abs(localX)>Math.abs(localZ)){
   edgeX=Math.sign(localX||1)*1.5;placedYaw=tile.yaw+Math.PI/2;
  }else edgeZ=Math.sign(localZ||1)*1.5;
  const x=tile.x+edgeX*Math.cos(tile.yaw)+edgeZ*Math.sin(tile.yaw);
  const z=tile.z-edgeX*Math.sin(tile.yaw)+edgeZ*Math.cos(tile.yaw);
  if(state.wallPanels.some(w=>Math.hypot(w.x-x,w.z-z)<2.35)){
   toast("Já existe uma parede neste lado do piso.");return;
  }
  const panel={x,z,yaw:placedYaw};
  state.wood-=6;state.fiber-=2;
  createWallPanel(panel);state.wallPanels.push(panel);
  updateHUD();saveGame();
  toast("Parede de madeira encaixada na borda do piso modular!");
 }
 function createWallPanel(panel){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x805632,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x4d321e,roughness:1});
  for(const x of [-1.42,1.42]){
   const post=new THREE.Mesh(new THREE.BoxGeometry(.18,2.45,.18),dark);
   post.position.set(x,1.225,0);post.castShadow=true;post.receiveShadow=true;group.add(post);
  }
  for(const y of [.16,2.28]){
   const beam=new THREE.Mesh(new THREE.BoxGeometry(2.9,.16,.16),dark);
   beam.position.set(0,y,0);beam.castShadow=true;group.add(beam);
  }
  for(let i=0;i<11;i++){
   const plank=new THREE.Mesh(new THREE.BoxGeometry(.23,2.05,.11),timber);
   plank.position.set(-1.25+i*.25,1.22,.015);plank.castShadow=true;plank.receiveShadow=true;group.add(plank);
  }
  group.position.set(panel.x,terrainHeight(panel.x,panel.z)+.28,panel.z);
  group.rotation.y=panel.yaw;scene.add(group);
  return group;
 }
 function craftWindowPanel(){
  if(state.windowPanels.length>=100){toast("Limite de 100 paredes com janela atingido.");return;}
  if(state.wood<7||state.fiber<2){toast("Faltam materiais: 7 madeiras e 2 fibras.");return;}
  if(!state.floorTiles.length){toast("Construa primeiro um piso modular.");return;}
  let nearest=null,nearestDistance=7;
  for(const tile of state.floorTiles){
   const dx=player.position.x-tile.x,dz=player.position.z-tile.z;
   const localX=dx*Math.cos(tile.yaw)-dz*Math.sin(tile.yaw);
   const localZ=dx*Math.sin(tile.yaw)+dz*Math.cos(tile.yaw);
   const distance=Math.hypot(dx,dz);
   if(distance<nearestDistance){nearestDistance=distance;nearest={tile,localX,localZ};}
  }
  if(!nearest){toast("Aproxime-se de um piso modular.");return;}
  const {tile,localX,localZ}=nearest;
  let edgeX=0,edgeZ=0,placedYaw=tile.yaw;
  if(Math.abs(localX)>Math.abs(localZ)){
   edgeX=Math.sign(localX||1)*1.5;placedYaw=tile.yaw+Math.PI/2;
  }else edgeZ=Math.sign(localZ||1)*1.5;
  const x=tile.x+edgeX*Math.cos(tile.yaw)+edgeZ*Math.sin(tile.yaw);
  const z=tile.z-edgeX*Math.sin(tile.yaw)+edgeZ*Math.cos(tile.yaw);
  const occupied=[...state.wallPanels,...state.windowPanels].some(w=>Math.hypot(w.x-x,w.z-z)<2.35);
  if(occupied){toast("Este lado do piso já tem uma parede.");return;}
  const panel={x,z,yaw:placedYaw};
  state.wood-=7;state.fiber-=2;
  createWindowPanel(panel);state.windowPanels.push(panel);
  updateHUD();saveGame();
  toast("Parede com janela construída e salva!");
 }
 function createWindowPanel(panel){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x93683f,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x4d321e,roughness:1});
  function beam(w,h,d,x,y,z,material){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
   mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  for(const x of [-1.42,1.42])beam(.18,2.45,.18,x,1.225,0,dark);
  beam(2.9,.16,.16,0,.16,0,dark);
  beam(2.9,.16,.16,0,2.28,0,dark);
  for(let i=0;i<11;i++){
   const x=-1.25+i*.25;
   if(Math.abs(x)<.62)continue;
   beam(.23,.78,.11,x,.56,.015,timber);
   beam(.23,.42,.11,x,2.04,.015,timber);
  }
  beam(1.05,.13,.12,0,.98,0,dark);
  beam(1.05,.13,.12,0,1.78,0,dark);
  for(const x of [-.55,.55])beam(.13,.8,.13,x,1.38,0,dark);
  beam(.1,.68,.08,0,1.38,.015,dark);
  group.position.set(panel.x,terrainHeight(panel.x,panel.z)+.28,panel.z);
  group.rotation.y=panel.yaw;scene.add(group);
  return group;
 }
 function craftRoofTile(){
  if(state.roofTiles.length>=100){toast("Limite de 100 módulos de telhado atingido.");return;}
  if(state.wood<8||state.fiber<3){toast("Faltam materiais: 8 madeiras e 3 fibras.");return;}
  if(!state.floorTiles.length){toast("Construa primeiro um piso modular para apoiar o telhado.");return;}
  let nearest=null,nearestDistance=7;
  for(const tile of state.floorTiles){
   const distance=Math.hypot(player.position.x-tile.x,player.position.z-tile.z);
   if(distance<nearestDistance){nearestDistance=distance;nearest=tile;}
  }
  if(!nearest){toast("Aproxime-se de um piso modular para construir o telhado.");return;}
  if(state.roofTiles.some(tile=>Math.hypot(tile.x-nearest.x,tile.z-nearest.z)<2.3)){
   toast("Este piso já possui um módulo de telhado.");return;
  }
  const roof={x:nearest.x,z:nearest.z,yaw:nearest.yaw};
  state.wood-=8;state.fiber-=3;
  createRoofTile(roof);state.roofTiles.push(roof);
  updateHUD();saveGame();
  toast("Telhado de duas águas construído sobre o piso modular!");
 }
 function craftGablePanel(){
  if(state.gablePanels.length>=100){toast("Limite de 100 conjuntos de fechamento atingido.");return;}
  if(state.wood<8||state.fiber<3){toast("Faltam materiais: 8 madeiras e 3 fibras.");return;}
  if(!state.roofTiles.length){toast("Construa primeiro um telhado modular.");return;}
  let nearest=null,nearestDistance=6.5;
  for(const roof of state.roofTiles){
   const distance=Math.hypot(player.position.x-roof.x,player.position.z-roof.z);
   if(distance<nearestDistance){nearestDistance=distance;nearest=roof;}
  }
  if(!nearest){toast("Aproxime-se de um telhado modular.");return;}
  if(state.gablePanels.some(g=>Math.hypot(g.x-nearest.x,g.z-nearest.z)<2.2)){
   toast("Este telhado já possui fechamento triangular.");return;
  }
  const gable={x:nearest.x,z:nearest.z,yaw:nearest.yaw};
  state.wood-=8;state.fiber-=3;
  createGablePanel(gable);state.gablePanels.push(gable);
  updateHUD();saveGame();toast("Duas extremidades triangulares instaladas no telhado!");
}
function craftRidgeCap(){
  if(state.ridgeCaps.length>=100){toast("Limite de 100 cumeeiras atingido.");return;}
  if(state.wood<3||state.fiber<1){toast("Faltam materiais: 3 madeiras e 1 fibra.");return;}
  if(!state.roofTiles.length){toast("Construa primeiro um telhado modular.");return;}
  let nearest=null,nearestDistance=6.5;
  for(const roof of state.roofTiles){
   const distance=Math.hypot(player.position.x-roof.x,player.position.z-roof.z);
   if(distance<nearestDistance){nearestDistance=distance;nearest=roof;}
  }
  if(!nearest){toast("Aproxime-se de um telhado modular.");return;}
  if(state.ridgeCaps.some(v=>Math.hypot(v.x-nearest.x,v.z-nearest.z)<2.2)){
   toast("Este telhado já possui uma cumeeira reforçada.");return;
  }
  const ridge={x:nearest.x,z:nearest.z,yaw:nearest.yaw};
  state.wood-=3;state.fiber-=1;
  createRidgeCap(ridge);state.ridgeCaps.push(ridge);
  updateHUD();saveGame();toast("Cumeeira de madeira reforçada e instalada!");
}
function craftChimney(){
  if(state.chimneys.length>=100){toast("Limite de 100 chaminés atingido.");return;}
  if(state.stone<6||state.wood<2){toast("Faltam materiais: 6 pedras e 2 madeiras.");return;}
  if(!state.roofTiles.length){toast("Construa primeiro um telhado modular.");return;}
  let nearest=null,nearestDistance=6.5;
  for(const roof of state.roofTiles){
   const distance=Math.hypot(player.position.x-roof.x,player.position.z-roof.z);
   if(distance<nearestDistance){nearestDistance=distance;nearest=roof;}
  }
  if(!nearest){toast("Aproxime-se de um telhado modular.");return;}
  if(state.chimneys.some(c=>Math.hypot(c.x-nearest.x,c.z-nearest.z)<2.2)){
   toast("Este telhado já possui uma chaminé.");return;
  }
  const chimney={x:nearest.x,z:nearest.z,yaw:nearest.yaw};
  state.stone-=6;state.wood-=2;
  createChimney(chimney);state.chimneys.push(chimney);
  updateHUD();saveGame();toast("Chaminé de pedra construída no telhado!");
}
function createChimney(chimney){
  const group=new THREE.Group();
  const stone=new THREE.MeshStandardMaterial({color:0x77736b,roughness:1});
  const stoneLight=new THREE.MeshStandardMaterial({color:0x928b7e,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x292723,roughness:1});
  const mortar=new THREE.MeshStandardMaterial({color:0x49443c,roughness:1});
  const cx=-1.02,cz=.48,baseY=2.67,height=1.48,width=.72,depth=.72;
  const back=new THREE.Mesh(new THREE.BoxGeometry(width,height,.12),stone);
  back.position.set(cx,baseY+height/2,cz-depth/2);group.add(back);
  const front=new THREE.Mesh(new THREE.BoxGeometry(width,height,.12),stone);
  front.position.set(cx,baseY+height/2,cz+depth/2);group.add(front);
  const left=new THREE.Mesh(new THREE.BoxGeometry(.12,height,depth-.18),stoneLight);
  left.position.set(cx-width/2,baseY+height/2,cz);group.add(left);
  const right=new THREE.Mesh(new THREE.BoxGeometry(.12,height,depth-.18),stoneLight);
  right.position.set(cx+width/2,baseY+height/2,cz);group.add(right);
  for(let course=0;course<4;course++){
   const seam=new THREE.Mesh(new THREE.BoxGeometry(width+.035,.035,depth+.035),mortar);
   seam.position.set(cx,baseY+.28+course*.34,cz);group.add(seam);
  }
  const opening=new THREE.Mesh(new THREE.BoxGeometry(.42,.035,.42),dark);
  opening.position.set(cx,baseY+height+.015,cz);group.add(opening);
  for(const side of [-1,1]){
   const rim=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,depth+.22),stoneLight);
   rim.position.set(cx+side*.31,baseY+height+.09,cz);group.add(rim);
  }
  for(const side of [-1,1]){
   const rim=new THREE.Mesh(new THREE.BoxGeometry(width+.22,.16,.16),stoneLight);
   rim.position.set(cx,baseY+height+.09,cz+side*.31);group.add(rim);
  }
  const cap=new THREE.Mesh(new THREE.BoxGeometry(width+.28,.12,depth+.28),stone);
  cap.position.set(cx,baseY+height+.2,cz);group.add(cap);
  group.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}});
  group.position.set(chimney.x,terrainHeight(chimney.x,chimney.z)+.28,chimney.z);
  group.rotation.y=chimney.yaw;scene.add(group);
  return group;
}
function createRidgeCap(ridge){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x694326,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x3d281a,roughness:1});
  const beam=new THREE.Mesh(new THREE.BoxGeometry(.3,.22,3.58),timber);
  beam.position.set(0,3.47,0);beam.castShadow=true;beam.receiveShadow=true;group.add(beam);
  for(let z=-1.5;z<=1.51;z+=.5){
   const collar=new THREE.Mesh(new THREE.BoxGeometry(.38,.08,.12),dark);
   collar.position.set(0,3.36,z);collar.castShadow=true;group.add(collar);
  }
  for(const side of [-1,1]){
   const trim=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,3.48),dark);
   trim.position.set(side*.13,3.36,0);trim.castShadow=true;group.add(trim);
  }
  group.position.set(ridge.x,terrainHeight(ridge.x,ridge.z)+.28,ridge.z);
  group.rotation.y=ridge.yaw;scene.add(group);
  return group;
}
function createGablePanel(gable){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x805632,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x49301d,roughness:1});
  for(const endZ of [-1.52,1.52]){
   const base=new THREE.Mesh(new THREE.BoxGeometry(3.5,.14,.14),dark);
   base.position.set(0,2.32,endZ);base.castShadow=true;base.receiveShadow=true;group.add(base);
   const slopeLength=Math.hypot(1.78,.8),slopeAngle=Math.atan2(.8,1.78);
   for(const side of [-1,1]){
    const beam=new THREE.Mesh(new THREE.BoxGeometry(slopeLength,.14,.14),dark);
    beam.position.set(side*.89,2.98,endZ);
    beam.rotation.z=side===-1?slopeAngle:-slopeAngle;
    beam.castShadow=true;beam.receiveShadow=true;group.add(beam);
   }
   for(let i=0;i<15;i++){
    const x=-1.62+i*.232;
    const roofLine=3.38-(Math.abs(x)/1.78)*.8;
    const bottom=2.39;
    const height=Math.max(.12,roofLine-bottom);
    const plank=new THREE.Mesh(new THREE.BoxGeometry(.205,height,.105),timber);
    plank.position.set(x,bottom+height/2,endZ);
    plank.castShadow=true;plank.receiveShadow=true;group.add(plank);
   }
   const centerPost=new THREE.Mesh(new THREE.BoxGeometry(.14,1.02,.14),dark);
   centerPost.position.set(0,2.88,endZ);centerPost.castShadow=true;group.add(centerPost);
  }
  group.position.set(gable.x,terrainHeight(gable.x,gable.z)+.28,gable.z);
  group.rotation.y=gable.yaw;scene.add(group);
  return group;
}
function createRoofTile(roof){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x79502f,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x49301d,roughness:1});
  function beam(w,h,d,x,y,z,material,rz=0){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
   mesh.position.set(x,y,z);mesh.rotation.z=rz;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  for(let i=0;i<10;i++){
   const z=-1.53+i*.34;
   beam(2.12,.13,.32,-.94,2.98,z,timber,.38);
   beam(2.12,.13,.32,.94,2.98,z,timber,-.38);
  }
  for(const x of [-1.78,0,1.78]){
   const y=x===0?3.38:2.58;
   beam(.18,.18,3.42,x,y,0,dark);
  }
  for(const z of [-1.68,1.68]){
   const brace=new THREE.Mesh(new THREE.BoxGeometry(3.75,.16,.16),dark);
   brace.position.set(0,2.98,z);brace.rotation.z=0;brace.castShadow=true;group.add(brace);
  }
  group.position.set(roof.x,terrainHeight(roof.x,roof.z)+.28,roof.z);
  group.rotation.y=roof.yaw;scene.add(group);
  return group;
 }
 function craftWindowShutters(){
  if(state.windowShutters.length>=100){toast("Limite de 100 conjuntos de persianas atingido.");return;}
  if(state.wood<4||state.fiber<2){toast("Faltam materiais: 4 madeiras e 2 fibras.");return;}
  if(!state.windowPanels.length){toast("Construa primeiro uma parede com janela.");return;}
  let nearest=null,nearestDistance=5.5;
  for(const windowPanel of state.windowPanels){
   const distance=Math.hypot(player.position.x-windowPanel.x,player.position.z-windowPanel.z);
   if(distance<nearestDistance){nearestDistance=distance;nearest=windowPanel;}
  }
  if(!nearest){toast("Aproxime-se de uma parede com janela.");return;}
  if(state.windowShutters.some(v=>Math.hypot(v.x-nearest.x,v.z-nearest.z)<1.2)){toast("Esta janela já possui persianas.");return;}
  const shutters={x:nearest.x,z:nearest.z,yaw:nearest.yaw,open:false};
  state.wood-=4;state.fiber-=2;
  createWindowShutters(shutters);state.windowShutters.push(shutters);
  updateHUD();saveGame();toast("Persianas de madeira instaladas! Aproxime-se para abrir ou fechar.");
}
function createWindowShutters(shutters){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x76502f,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x49301d,roughness:1});
  const pivots=[];
  for(const side of [-1,1]){
   const pivot=new THREE.Group();
   pivot.position.set(side*.62,1.38,.12);group.add(pivot);pivots.push(pivot);
   const leaf=new THREE.Mesh(new THREE.BoxGeometry(.58,.76,.12),timber);
   leaf.position.set(side*-.29,0,0);leaf.castShadow=true;leaf.receiveShadow=true;pivot.add(leaf);
   for(const y of [-.25,0,.25]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.58,.075,.15),dark);
    rail.position.set(side*-.29,y,.015);rail.castShadow=true;pivot.add(rail);
   }
   const brace=new THREE.Mesh(new THREE.BoxGeometry(.48,.07,.16),dark);
   brace.position.set(side*-.29,0,.035);brace.rotation.z=side*.55;brace.castShadow=true;pivot.add(brace);
   const hinge=new THREE.Mesh(new THREE.BoxGeometry(.07,.13,.08),dark);
   hinge.position.set(side*-.29,side>0?-.27:.27,.02);pivot.add(hinge);
  }
  for(const pivot of pivots)pivot.rotation.y=shutters.open?(pivot.position.x<0?1.05:-1.05):0;
  group.position.set(shutters.x,terrainHeight(shutters.x,shutters.z)+.28,shutters.z);
  group.rotation.y=shutters.yaw;scene.add(group);
  state.shutterObjects.push({group,pivots});
}
function toggleNearbyShutters(){
  const index=state.nearShutterIndex;
  if(index<0||!state.windowShutters[index]){toast("Aproxime-se de uma janela com persianas.");return;}
  const shutters=state.windowShutters[index];shutters.open=!shutters.open;
  const visual=state.shutterObjects[index];
  if(visual)for(const pivot of visual.pivots)pivot.rotation.y=shutters.open?(pivot.position.x<0?1.05:-1.05):0;
  updateHUD();saveGame();toast(shutters.open?"Persianas abertas.":"Persianas fechadas.");
}
function craftDoorPanel(){
  if(state.doorPanels.length>=100){toast("Limite de 100 portas atingido.");return;}
  if(state.wood<8||state.fiber<3){toast("Faltam materiais: 8 madeiras e 3 fibras.");return;}
  if(!state.floorTiles.length){toast("Construa primeiro um piso modular para apoiar a porta.");return;}
  let nearest=null,nearestDistance=7;
  for(const tile of state.floorTiles){
   const dx=player.position.x-tile.x,dz=player.position.z-tile.z;
   const localX=dx*Math.cos(tile.yaw)-dz*Math.sin(tile.yaw);
   const localZ=dx*Math.sin(tile.yaw)+dz*Math.cos(tile.yaw);
   const distance=Math.hypot(dx,dz);
   if(distance<nearestDistance){nearestDistance=distance;nearest={tile,localX,localZ};}
  }
  if(!nearest){toast("Aproxime-se de um piso modular.");return;}
  const {tile,localX,localZ}=nearest;
  let edgeX=0,edgeZ=0,placedYaw=tile.yaw;
  if(Math.abs(localX)>Math.abs(localZ)){
   edgeX=Math.sign(localX||1)*1.5;placedYaw=tile.yaw+Math.PI/2;
  }else edgeZ=Math.sign(localZ||1)*1.5;
  const x=tile.x+edgeX*Math.cos(tile.yaw)+edgeZ*Math.sin(tile.yaw);
  const z=tile.z-edgeX*Math.sin(tile.yaw)+edgeZ*Math.cos(tile.yaw);
  const occupied=[...state.wallPanels,...state.windowPanels,...state.doorPanels].some(w=>Math.hypot(w.x-x,w.z-z)<2.35);
  if(occupied){toast("Este lado do piso já possui uma parede ou porta.");return;}
  const door={x,z,yaw:placedYaw,open:false};
  state.wood-=8;state.fiber-=3;
  createDoorPanel(door);state.doorPanels.push(door);
  updateHUD();saveGame();toast("Porta de madeira instalada! Aproxime-se para abrir ou fechar.");
 }
 function createDoorPanel(door){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x805632,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x49301d,roughness:1});
  const metal=new THREE.MeshStandardMaterial({color:0x77766b,metalness:.45,roughness:.65});
  for(const x of [-1.42,1.42]){
   const post=new THREE.Mesh(new THREE.BoxGeometry(.18,2.45,.18),dark);
   post.position.set(x,1.225,0);post.castShadow=true;post.receiveShadow=true;group.add(post);
  }
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(2.9,.18,.2),dark);
  lintel.position.set(0,2.34,0);lintel.castShadow=true;group.add(lintel);
  const pivot=new THREE.Group();pivot.position.set(-1.32,.12,.04);group.add(pivot);
  const leaf=new THREE.Group();pivot.add(leaf);
  const panel=new THREE.Mesh(new THREE.BoxGeometry(2.58,2.12,.13),timber);
  panel.position.set(1.29,1.06,0);panel.castShadow=true;panel.receiveShadow=true;leaf.add(panel);
  for(const y of [.2,.72,1.4,1.92]){
   const rail=new THREE.Mesh(new THREE.BoxGeometry(2.58,.1,.16),dark);
   rail.position.set(1.29,y,0);rail.castShadow=true;leaf.add(rail);
  }
  for(let i=0;i<9;i++){
   const slat=new THREE.Mesh(new THREE.BoxGeometry(.2,2.02,.15),timber);
   slat.position.set(.17+i*.28,1.06,.075);slat.castShadow=true;leaf.add(slat);
  }
  const brace=new THREE.Mesh(new THREE.BoxGeometry(2.45,.12,.15),dark);
  brace.position.set(1.29,1.06,.12);brace.rotation.z=-.55;brace.castShadow=true;leaf.add(brace);
  for(const y of [.45,1.65]){
   const hinge=new THREE.Mesh(new THREE.BoxGeometry(.1,.25,.2),metal);
   hinge.position.set(.02,y,.12);leaf.add(hinge);
  }
  const handle=new THREE.Mesh(new THREE.BoxGeometry(.1,.24,.1),metal);
  handle.position.set(2.42,1.12,.13);leaf.add(handle);
  pivot.rotation.y=door.open?-1.35:0;
  group.position.set(door.x,terrainHeight(door.x,door.z)+.28,door.z);
  group.rotation.y=door.yaw;scene.add(group);
  state.doorObjects.push({group,pivot});
 }
 function toggleNearbyDoor(){
  const index=state.nearDoorIndex;
  if(index<0||!state.doorPanels[index]){toast("Aproxime-se de uma porta.");return;}
  const door=state.doorPanels[index];door.open=!door.open;
  const visual=state.doorObjects[index];if(visual)visual.pivot.rotation.y=door.open?-1.35:0;
  updateHUD();saveGame();toast(door.open?"Porta aberta.":"Porta fechada.");
 }
 function craftFenceSection(){
  if(state.fenceSections.length>=200){toast("Limite de 200 seções de cerca atingido.");return;}
  if(state.wood<5||state.fiber<2){toast("Faltam materiais: 5 madeiras e 2 fibras.");return;}
  const yaw=player.rotation.y;
  const targetX=player.position.x+Math.sin(yaw)*3.5;
  const targetZ=player.position.z+Math.cos(yaw)*3.5;
  const snapped=findFenceConnection(targetX,targetZ,3.2);
  const x=snapped?snapped.x:targetX,z=snapped?snapped.z:targetZ,placedYaw=snapped?snapped.yaw:yaw;
  state.wood-=5;state.fiber-=2;
  createFenceSection(x,z,placedYaw);
  state.fenceSections.push({x,z,yaw:placedYaw});
  updateHUD();saveGame();toast(snapped?"Cerca conectada à extremidade do perímetro!":"Cerca construída! Continue expandindo seu assentamento.");
 }
 function createFenceSection(x,z,yaw){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x795331,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x4b3321,roughness:1});
  const postGeo=new THREE.BoxGeometry(.16,1.25,.16);
  for(let i=0;i<=4;i++){
   const post=new THREE.Mesh(postGeo,timber);
   post.position.set(-3.2+i*1.6,.625,0);post.castShadow=true;post.receiveShadow=true;group.add(post);
  }
  for(let i=0;i<4;i++){
   const x0=-2.4+i*1.6;
   for(const y of [.42,.91]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(1.55,.13,.12),dark);
    rail.position.set(x0,y,0);rail.castShadow=true;rail.receiveShadow=true;group.add(rail);
   }
   for(let j=0;j<4;j++){
    const slat=new THREE.Mesh(new THREE.BoxGeometry(.11,.62,.1),timber);
    slat.position.set(x0-.48+j*.32,.68,0);slat.castShadow=true;group.add(slat);
   }
  }
  group.position.set(x,terrainHeight(x,z),z);group.rotation.y=yaw;scene.add(group);
  return group;
 }
 function craftGate(){
  if(state.gates.length>=30){toast("Limite de 30 portões atingido.");return;}
  if(state.wood<8||state.fiber<3){toast("Faltam materiais: 8 madeiras e 3 fibras.");return;}
  const yaw=player.rotation.y;
  const targetX=player.position.x+Math.sin(yaw)*3.5;
  const targetZ=player.position.z+Math.cos(yaw)*3.5;
  const snapped=findFenceConnection(targetX,targetZ,1.7);
  const x=snapped?snapped.x:targetX,z=snapped?snapped.z:targetZ,placedYaw=snapped?snapped.yaw:yaw;
  state.wood-=8;state.fiber-=3;
  const gate={x,z,yaw:placedYaw,open:false};
  state.gates.push(gate);createGate(gate);
  updateHUD();saveGame();toast(snapped?"Portão encaixado no perímetro da cerca!":"Portão construído! Aproxime-se para abrir ou fechar.");
 }
 function createGate(gate){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x795331,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x4b3321,roughness:1});
  const metal=new THREE.MeshStandardMaterial({color:0x77766b,metalness:.35,roughness:.65});
  for(const x of [-1.7,1.7]){
   const post=new THREE.Mesh(new THREE.BoxGeometry(.2,1.65,.2),timber);
   post.position.set(x,.825,0);post.castShadow=true;post.receiveShadow=true;group.add(post);
   const hinge=new THREE.Mesh(new THREE.BoxGeometry(.09,1.35,.09),metal);
   hinge.position.set(x<0?-1.57:1.57,.82,0);group.add(hinge);
  }
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(3.55,.18,.24),dark);
  lintel.position.set(0,1.62,0);lintel.castShadow=true;group.add(lintel);
  const pivot=new THREE.Group();pivot.position.set(-1.57,.08,.04);group.add(pivot);
  const panel=new THREE.Group();pivot.add(panel);
  const railMat=dark;
  for(const y of [.22,.72,1.22]){
   const rail=new THREE.Mesh(new THREE.BoxGeometry(3.05,.13,.13),railMat);
   rail.position.set(1.52,y,0);rail.castShadow=true;panel.add(rail);
  }
  for(let i=0;i<10;i++){
   const slat=new THREE.Mesh(new THREE.BoxGeometry(.19,1.35,.13),timber);
   slat.position.set(.12+i*.31,.72,0);slat.castShadow=true;slat.receiveShadow=true;panel.add(slat);
  }
  const brace=new THREE.Mesh(new THREE.BoxGeometry(2.95,.12,.14),timber);
  brace.position.set(1.52,.72,.09);brace.rotation.z=-.42;brace.castShadow=true;panel.add(brace);
  pivot.rotation.y=gate.open?-1.25:0;
  group.position.set(gate.x,terrainHeight(gate.x,gate.z),gate.z);group.rotation.y=gate.yaw;scene.add(group);
  state.gateObjects.push({group,pivot});
 }
 function toggleNearbyGate(){
  const index=state.nearGateIndex;
  if(index<0||!state.gates[index]){toast("Aproxime-se de um portão.");return;}
  const gate=state.gates[index];gate.open=!gate.open;
  const visual=state.gateObjects[index];if(visual)visual.pivot.rotation.y=gate.open?-1.25:0;
  updateHUD();saveGame();toast(gate.open?"Portão aberto.":"Portão fechado.");
 }
 function storeResources(){
 if(!state.storageChest||Math.hypot(player.position.x-state.storageChestX,player.position.z-state.storageChestZ)>=3.5){toast("Aproxime-se do baú.");return;}
 const keys=["wood","stone","fiber","berries","meat","cookedMeat","hide","bandages","honey"];
 let total=0;
 for(const key of keys){const amount=Math.max(0,Math.floor(state[key]));state.storage[key]+=amount;state[key]=0;total+=amount;}
 if(!total){toast("Sua mochila está vazia.");return;}
 updateHUD();saveGame();toast(total+" itens guardados no baú.");
}
function takeResources(){
 if(!state.storageChest||Math.hypot(player.position.x-state.storageChestX,player.position.z-state.storageChestZ)>=3.5){toast("Aproxime-se do baú.");return;}
 const keys=["wood","stone","fiber","berries","meat","cookedMeat","hide","bandages"];
 let total=0;
 for(const key of keys){const amount=Math.max(0,Math.floor(state.storage[key]));state[key]+=amount;state.storage[key]=0;total+=amount;}
 if(!total){toast("O baú está vazio.");return;}
 updateHUD();saveGame();toast(total+" itens retirados do baú.");
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
function craftWaterSkin(){
 if(state.waterSkin){toast("Você já fabricou um cantil de couro.");return;}
 if(state.hide<2||state.fiber<3){toast("Faltam materiais: 2 couros e 3 fibras.");return;}
 state.hide-=2;state.fiber-=3;state.waterSkin=true;state.waterCharges=0;
 updateHUD();saveGame();toast("Cantil de couro fabricado! Encha-o em uma fonte de água.");
}
function fillWaterSkin(){
 if(!state.waterSkin){toast("Fabrique um cantil primeiro.");return;}
 const nearWell=state.wells.some(w=>Math.hypot(player.position.x-w.x,player.position.z-w.z)<3.8);
 if((!state.near||state.near.type!=="water")&&!nearWell){toast("Aproxime-se de uma fonte de água ou poço.");return;}
 if(state.waterCharges>=3){toast("O cantil já está cheio.");return;}
 state.waterCharges=3;updateHUD();saveGame();toast("Cantil cheio: 3 goles de água.");
}
function drinkWaterSkin(){
 if(state.waterCharges<1||state.thirst>=100)return;
 state.waterCharges--;state.thirst=Math.min(100,state.thirst+35);
 updateHUD();saveGame();toast("Você bebeu do cantil e recuperou 35 pontos de sede.");
}
function craftBandage(){
 if(state.fiber<4){toast("Você precisa de 4 fibras para preparar uma atadura.");return;}
 state.fiber-=4;state.bandages++;updateHUD();saveGame();toast("Atadura medicinal preparada!");
}
function useBandage(){
 if(state.bandages<1||state.health>=100)return;
 state.bandages--;state.health=Math.min(100,state.health+30);
 updateHUD();saveGame();toast("Você usou uma atadura e recuperou até 30 pontos de vida.");
}
$("craftWaterSkin").addEventListener("click",craftWaterSkin);
$("fillWaterSkin").addEventListener("click",fillWaterSkin);
$("drinkWaterSkin").addEventListener("click",drinkWaterSkin);
$("craftBandage").addEventListener("click",craftBandage);
$("useBandage").addEventListener("click",useBandage);
function craftBed(){
 if(state.bed){toast("Você já construiu sua cama improvisada.");return;}
 if(state.wood<3||state.fiber<6){toast("Faltam materiais: 3 madeiras e 6 fibras.");return;}
 state.wood-=3;state.fiber-=6;
 const x=player.position.x+Math.sin(player.rotation.y)*2.2;
 const z=player.position.z+Math.cos(player.rotation.y)*2.2;
 createBed(x,z);updateHUD();saveGame();toast("Cama improvisada construída! Você poderá dormir durante a noite.");
}
function createBed(x,z){
 if(state.bedObject)scene.remove(state.bedObject);
 const group=new THREE.Group();
 const wood=new THREE.MeshStandardMaterial({color:0x654329,roughness:1});
 const straw=new THREE.MeshStandardMaterial({color:0xb2a071,roughness:1});
 const cloth=new THREE.MeshStandardMaterial({color:0x78634b,roughness:1});
 const frame=new THREE.Mesh(new THREE.BoxGeometry(1.15,.16,2.05),wood);frame.position.y=.28;frame.castShadow=true;group.add(frame);
 const mattress=new THREE.Mesh(new THREE.BoxGeometry(1.08,.2,1.9),straw);mattress.position.y=.46;mattress.castShadow=true;group.add(mattress);
 const blanket=new THREE.Mesh(new THREE.BoxGeometry(1.02,.09,1.12),cloth);blanket.position.set(0,.61,-.28);blanket.castShadow=true;group.add(blanket);
 const pillow=new THREE.Mesh(new THREE.BoxGeometry(.72,.13,.34),straw);pillow.position.set(0,.62,.72);pillow.castShadow=true;group.add(pillow);
 for(const px of [-.48,.48])for(const pz of [-.88,.88]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.13,.3,.13),wood);leg.position.set(px,.14,pz);leg.castShadow=true;group.add(leg);}
 group.position.set(x,terrainHeight(x,z),z);group.rotation.y=player.rotation.y;scene.add(group);
 state.bedObject=group;state.bed=true;state.bedX=x;state.bedZ=z;
}
function sleepAtBed(){
 const nearBed=state.bed&&Math.hypot(player.position.x-state.bedX,player.position.z-state.bedZ)<3.2;
 if(!nearBed){toast("Aproxime-se da cama.");return;}
 if(!(state.timeOfDay>=19||state.timeOfDay<6)){toast("Você só pode dormir durante a noite.");return;}
 if(state.timeOfDay>=19)state.day++;
 state.timeOfDay=7;state.energy=100;state.health=Math.min(100,state.health+15);
 state.hunger=Math.max(0,state.hunger-5);state.thirst=Math.max(0,state.thirst-8);
 updateHUD();saveGame();toast("Você descansou até o amanhecer. Energia recuperada!");
}
$("craftBed").addEventListener("click",craftBed);
$("sleepBtn").addEventListener("click",sleepAtBed);
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
 const metalMat=new THREE.MeshStandardMaterial({color:0xd8e1e4,metalness:.2,roughness:.3,emissive:0x303b40,emissiveIntensity:.35});

 // A palma segura o centro do cabo. A haste atravessa a mão no eixo
 // perpendicular ao antebraço; a cabeça fica numa ponta e o pomo na outra.
 const handle=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.82,12),woodMat);
 handle.rotation.x=Math.PI/2;
 handle.position.set(0,0,0);
 group.add(handle);
 const grip=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.20,12),gripMat);
 grip.rotation.x=Math.PI/2;
 grip.position.set(0,0,0);
 group.add(grip);

 if(type==="axe"){
  const head=new THREE.Mesh(new THREE.BoxGeometry(.42,.17,.14),metalMat);
  head.position.set(.08,0,-.39);
  group.add(head);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.19,.29,.17),metalMat);
  blade.position.set(.27,0,-.39);
  group.add(blade);
 }else{
  const head=new THREE.Mesh(new THREE.BoxGeometry(.62,.15,.14),metalMat);
  head.position.set(0,0,-.39);
  group.add(head);
  const tipA=new THREE.Mesh(new THREE.ConeGeometry(.09,.19,10),metalMat);
  tipA.rotation.z=Math.PI/2;
  tipA.position.set(.37,0,-.39);
  group.add(tipA);
  const tipB=new THREE.Mesh(new THREE.ConeGeometry(.09,.19,10),metalMat);
  tipB.rotation.z=-Math.PI/2;
  tipB.position.set(-.37,0,-.39);
  group.add(tipB);
 }

 group.scale.setScalar(.95);
 group.visible=true;
 group.traverse(o=>{
  if(!o.isMesh)return;
  o.castShadow=true;
  o.frustumCulled=false;
  o.renderOrder=100;
  if(o.material){
   o.material.side=THREE.DoubleSide;
   o.material.depthTest=false;
   o.material.depthWrite=false;
  }
 });

 // Os nomes e a hierarquia foram conferidos no glTF: Fist.R/L são filhos
 // diretos dos respectivos LowerArm e pertencem ao esqueleto animado.
 const side=type==="axe"?"right":"left";
 const pattern=side==="right"?/^fist[._ ]?r$/i:/^fist[._ ]?l$/i;
 const rig=state.characterModel||null;
 let hand=null;
 if(rig)rig.traverse(o=>{if(!hand&&pattern.test(o.name||""))hand=o;});
 state[handKey]=hand;

 if(hand){
  hand.add(group);
  group.position.set(0,0,0);
  group.rotation.set(0,0,0);
 }else{
  // Personagem provisório: mantém a ferramenta visível até o modelo carregar.
  player.add(group);
  group.position.set(side==="right"?.48:-.48,1.05,-.30);
  group.rotation.set(0,0,side==="right"?-.08:.08);
 }
 state[key]=group;
}

function updateToolAttachments(){
 for(const type of ["axe","pickaxe"]){
  const group=state[type==="axe"?"axeObject":"pickaxeObject"];
  const hand=state[type==="axe"?"axeHand":"pickaxeHand"];
  if(!group)continue;

  if(hand){
   // Parentar diretamente ao osso elimina conversões entre espaços de coordenadas.
   // O próprio AnimationMixer move a mão e a ferramenta acompanha o mesmo osso.
   if(group.parent!==hand){
    hand.add(group);
    group.position.set(0,0,0);
    group.rotation.set(0,0,0);
   }
  }else{
   if(group.parent!==player){
    player.add(group);
    group.position.set(type==="axe"?.48:-.48,1.05,-.30);
    group.rotation.set(0,0,type==="axe"?-.08:.08);
   }
  }
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
$("shootBtn").addEventListener("click",shootArrow);
$("craftBow").addEventListener("click",craftBow);
$("craftArrows").addEventListener("click",craftArrows);
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
 const nowMs=Date.now();
 for(const r of resources){if(r.type==="fiber"&&!r.active&&r.respawnAt&&nowMs>=r.respawnAt){r.active=true;r.respawnAt=0;r.object.visible=true;toast("Uma planta fibrosa cresceu novamente.");}}
 updateWorldLighting(dt);
 updateWildlife(dt);
 updateFlyingArrows(dt);
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
 state.near=closest;
  let nearGarden=-1,gardenDistance=4.2;
  for(let i=0;i<state.gardenPlots.length;i++){const plot=state.gardenPlots[i],d=Math.hypot(player.position.x-plot.x,player.position.z-plot.z);if(d<gardenDistance){gardenDistance=d;nearGarden=i;}}
  state.nearGardenIndex=nearGarden;
  let nearMarket=-1,marketDistance=5;
  for(let i=0;i<state.marketStalls.length;i++){const stall=state.marketStalls[i],d=Math.hypot(player.position.x-stall.x,player.position.z-stall.z);if(d<marketDistance){marketDistance=d;nearMarket=i;}}
  state.nearMarketIndex=nearMarket;
  let nearCoop=-1,coopDistance=4.5;
  for(let i=0;i<state.chickenCoops.length;i++){const coop=state.chickenCoops[i],d=Math.hypot(player.position.x-coop.x,player.position.z-coop.z);if(d<coopDistance){coopDistance=d;nearCoop=i;}}
  state.nearCoopIndex=nearCoop;
  let nearApiary=-1,apiaryDistance=4.5;
  for(let i=0;i<state.apiaries.length;i++){const apiary=state.apiaries[i],d=Math.hypot(player.position.x-apiary.x,player.position.z-apiary.z);if(d<apiaryDistance){apiaryDistance=d;nearApiary=i;}}
  state.nearApiaryIndex=nearApiary;
  const gardenActionButton=$("gardenAction");
  gardenActionButton.hidden=nearGarden<0;
  if(nearGarden>=0){
   const plot=state.gardenPlots[nearGarden],ready=plot.plantedAt>0&&Date.now()-plot.plantedAt>=150000;
   gardenActionButton.textContent=ready?"COLHER FRUTAS (+6)":plot.plantedAt>0?"CULTIVO CRESCENDO":"PLANTAR 3 FRUTAS";
   gardenActionButton.disabled=!ready&& (plot.plantedAt>0||state.berries<3);
  }
  updateHUD();
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
 if(state.bed&&Number.isFinite(state.bedX)&&Number.isFinite(state.bedZ))createBed(state.bedX,state.bedZ);
 if(state.storageChest&&Number.isFinite(state.storageChestX)&&Number.isFinite(state.storageChestZ))createStorageChest(state.storageChestX,state.storageChestZ);
 for(const section of state.fenceSections)createFenceSection(section.x,section.z,section.yaw);
 for(const tile of state.floorTiles)createFloorTile(tile);
 for(const wall of state.wallPanels)createWallPanel(wall);
 for(const windowPanel of state.windowPanels)createWindowPanel(windowPanel);
 for(const roofTile of state.roofTiles)createRoofTile(roofTile);
 for(const gable of state.gablePanels)createGablePanel(gable);
 for(const ridge of state.ridgeCaps)createRidgeCap(ridge);
 for(const chimney of state.chimneys)createChimney(chimney);
 for(const lantern of state.lanternPosts)createLanternPost(lantern);
 for(const well of state.wells)createWell(well);
 for(const plot of state.gardenPlots)state.gardenObjects.push(createGardenPlot(plot));
 for(const tower of state.watchtowers)createWatchtower(tower);
 for(const stall of state.marketStalls)createMarketStall(stall);
 for(const coop of state.chickenCoops)createChickenCoop(coop);
 for(const apiary of state.apiaries)createApiary(apiary);
 for(const door of state.doorPanels)createDoorPanel(door);
 for(const shutters of state.windowShutters)createWindowShutters(shutters);
 for(const gate of state.gates)createGate(gate);
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
