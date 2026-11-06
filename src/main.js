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

const state={health:100,hunger:100,thirst:100,temperature:100,energy:100,wood:0,stone:0,axe:false,pickaxe:false,running:false,moveX:0,moveY:0,yaw:0,cameraYaw:0,cameraPitch:.22,day:1,timeOfDay:8,near:null,campfire:false,campfireX:null,campfireZ:null,shelter:false,shelterX:null,shelterZ:null,coldCloak:false,leatherBoots:false,fiber:0,collectedResources:[],berries:0,meat:0,cookedMeat:0,hide:0,huntedAnimals:[],starterKitGranted:false,bed:false,bedX:null,bedZ:null,bandages:0,storageChest:false,storageChestX:null,storageChestZ:null,storage:{wood:0,stone:0,fiber:0,berries:0,meat:0,cookedMeat:0,hide:0,bandages:0},waterSkin:false,waterCharges:0,bow:false,arrows:0,fenceSections:[],gates:[],floorTiles:[],gateObjects:[],nearGateIndex:-1};
function loadGame(){
 try{
  const saved=JSON.parse(localStorage.getItem("cronicas-floresta-save")||"null");
  if(!saved)return;
  for(const key of ["health","hunger","thirst","temperature","energy","wood","stone","day","timeOfDay","berries","fiber","meat","cookedMeat","hide","bandages","waterCharges","arrows"])if(Number.isFinite(saved[key]))state[key]=saved[key];
  state.axe=saved.axe===true;state.pickaxe=saved.pickaxe===true;
  state.starterKitGranted=saved.starterKitGranted===true;
  state.campfire=saved.campfire===true;
  state.shelter=saved.shelter===true;
  state.bed=saved.bed===true;
  state.storageChest=saved.storageChest===true;
  state.waterSkin=saved.waterSkin===true;
  state.bow=saved.bow===true;
  state.waterCharges=Math.max(0,Math.min(3,state.waterCharges));
  if(saved.storage&&typeof saved.storage==="object")for(const key of ["wood","stone","fiber","berries","meat","cookedMeat","hide","bandages"])if(Number.isFinite(saved.storage[key]))state.storage[key]=Math.max(0,saved.storage[key]);
  state.coldCloak=saved.coldCloak===true;
  state.leatherBoots=saved.leatherBoots===true;
  if(Array.isArray(saved.collectedResources))state.collectedResources=saved.collectedResources.filter(v=>typeof v==="string");
  if(Array.isArray(saved.huntedAnimals))state.huntedAnimals=saved.huntedAnimals.filter(v=>typeof v==="string");
   if(Array.isArray(saved.fenceSections))state.fenceSections=saved.fenceSections.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,200);
   if(Array.isArray(saved.gates))state.gates=saved.gates.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,30).map(v=>({...v,open:v.open===true}));
  if(Array.isArray(saved.floorTiles))state.floorTiles=saved.floorTiles.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,100);
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
 try{localStorage.setItem("cronicas-floresta-save",JSON.stringify({x:player.position.x,z:player.position.z,health:state.health,hunger:state.hunger,thirst:state.thirst,temperature:state.temperature,energy:state.energy,wood:state.wood,stone:state.stone,axe:state.axe,pickaxe:state.pickaxe,day:state.day,timeOfDay:state.timeOfDay,campfire:state.campfire,campfireX:state.campfireX,campfireZ:state.campfireZ,shelter:state.shelter,shelterX:state.shelterX,shelterZ:state.shelterZ,bed:state.bed,bedX:state.bedX,bedZ:state.bedZ,storageChest:state.storageChest,storageChestX:state.storageChestX,storageChestZ:state.storageChestZ,storage:state.storage,waterSkin:state.waterSkin,waterCharges:state.waterCharges,bow:state.bow,arrows:state.arrows,collectedResources:state.collectedResources,berries:state.berries,fiber:state.fiber,coldCloak:state.coldCloak,leatherBoots:state.leatherBoots,meat:state.meat,cookedMeat:state.cookedMeat,hide:state.hide,bandages:state.bandages,huntedAnimals:state.huntedAnimals,fenceSections:state.fenceSections,gates:state.gates,floorTiles:state.floorTiles,starterKitGranted:state.starterKitGranted}));}
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
 const nearWater=!!(state.near&&state.near.type==="water");
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
  $("craftFloorTile").disabled=state.wood<4||state.fiber<2||state.floorTiles.length>=100;
  $("craftFence").disabled=state.wood<5||state.fiber<2||state.fenceSections.length>=200;
  $("gateStatus").textContent="Portões construídos: "+state.gates.length;
  $("craftGate").disabled=state.wood<8||state.fiber<3||state.gates.length>=30;
  let nearestGate=-1,gateDistance=4.2;
  for(let i=0;i<state.gates.length;i++){const gate=state.gates[i],d=Math.hypot(player.position.x-gate.x,player.position.z-gate.z);if(d<gateDistance){gateDistance=d;nearestGate=i;}}
  state.nearGateIndex=nearestGate;
  $("gateToggle").hidden=nearestGate<0;
  if(nearestGate>=0)$("gateToggle").textContent=state.gates[nearestGate].open?"FECHAR PORTÃO":"ABRIR PORTÃO";
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
 const keys=["wood","stone","fiber","berries","meat","cookedMeat","hide","bandages"];
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
 if(!state.near||state.near.type!=="water"){toast("Aproxime-se de uma fonte de água.");return;}
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
 if(state.bed&&Number.isFinite(state.bedX)&&Number.isFinite(state.bedZ))createBed(state.bedX,state.bedZ);
 if(state.storageChest&&Number.isFinite(state.storageChestX)&&Number.isFinite(state.storageChestZ))createStorageChest(state.storageChestX,state.storageChestZ);
 for(const section of state.fenceSections)createFenceSection(section.x,section.z,section.yaw);
 for(const tile of state.floorTiles)createFloorTile(tile);
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
