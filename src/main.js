import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

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
 // Ondulações largas criam colinas e lombadas naturais sem alterar o nível do acampamento inicial.
 const distance=Math.hypot(x,z);
 const edgeBlend=1-Math.exp(-(distance*distance)/520);
 const broadHills=Math.sin(x*.018+z*.012)*2.8+Math.cos(z*.021-x*.009)*2.2+Math.sin((x-z)*.015)*1.7;
 const localHills=Math.sin(x*.035)*1.8+Math.cos(z*.041)*1.6+Math.sin((x+z)*.022)*2.4;
 const clearing=Math.exp(-(x*x+z*z)/500)*-.5;
 return localHills+broadHills*edgeBlend+clearing;
}
const groundGeo = new THREE.PlaneGeometry(260,260,160,160);
groundGeo.rotateX(-Math.PI/2);
const pos = groundGeo.attributes.position;
const groundColors=[];
const meadowColor=new THREE.Color(0x526a42);
const soilColor=new THREE.Color(0x79684c);
const mossColor=new THREE.Color(0x68784a);
for(let i=0;i<pos.count;i++){
 const x=pos.getX(i), z=pos.getZ(i);
 const height=terrainHeight(x,z);
 pos.setY(i,height);
 // Variação de solo acompanha as elevações: gramado nos baixios, terra exposta nas encostas e musgo em manchas suaves.
 const slopeExposure=THREE.MathUtils.clamp((height-1.8)/6.8,0,.62);
 const broadPatch=(Math.sin(x*.073+Math.cos(z*.061)*1.7)+Math.cos(z*.087-x*.039)+Math.sin((x+z)*.052)) / 3;
 const finePatch=(Math.sin(x*.19+Math.cos(z*.16)*1.2)+Math.cos(z*.23-x*.11)+Math.sin((x-z)*.14)) / 3;
 const patch=broadPatch*.78+finePatch*.22;
 const color=meadowColor.clone().lerp(soilColor,slopeExposure);
 color.lerp(mossColor,THREE.MathUtils.clamp((patch-.10)*.38,0,.27));
 // Pequenas variações de terra e relva quebram o aspecto uniforme sem criar placas ou alterar a altura do terreno.
 const earthSpeckle=Math.max(0,Math.sin(x*.37+Math.sin(z*.29))*Math.cos(z*.33-x*.17));
 color.lerp(soilColor,earthSpeckle*.055);
 color.multiplyScalar(.925+patch*.09+finePatch*.018);
 groundColors.push(color.r,color.g,color.b);
}
groundGeo.setAttribute("color",new THREE.Float32BufferAttribute(groundColors,3));
groundGeo.computeVertexNormals();
const ground = new THREE.Mesh(groundGeo,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1}));
ground.receiveShadow=true; scene.add(ground);

const player = new THREE.Group(); scene.add(player);
player.position.y=terrainHeight(0,0);
const fallback = new THREE.Group(); player.add(fallback);
let characterVisual=fallback;
const body = new THREE.Mesh(new THREE.CapsuleGeometry(.34,.9,5,8),new THREE.MeshStandardMaterial({color:0x59402b}));
body.position.y=.85; body.castShadow=true; fallback.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(.23,12,10),new THREE.MeshStandardMaterial({color:0xc49a75}));
head.position.y=1.55; head.castShadow=true; fallback.add(head);
let mixer=null, characterReady=false;
let animationActions={},currentAnimation=null,lockedAnimation=null;
let verticalVelocity=0,isJumping=false;
let spearThrustTime=0;
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
function updateWolfHealthBar(wolf){
 if(!wolf||!wolf.healthBar)return;
 const maxHealth=wolf.id&&wolf.id.startsWith("deer-")?2:3;
 const ratio=THREE.MathUtils.clamp(wolf.health/maxHealth,0,1);
 wolf.healthBar.visible=wolf.alive&&ratio<1;
 wolf.healthFill.scale.x=ratio;
 wolf.healthFill.position.x=-.38*(1-ratio);
 wolf.healthFill.material.color.setHex(ratio>.66?0x76bd55:ratio>.33?0xe2a43b:0xd94b43);
}
function reactWolfToHit(wolf){
 if(!wolf||!wolf.alive)return;
 wolf.hitStunTime=.55;
 wolf.hitHeading=Math.atan2(wolf.x-player.position.x,wolf.z-player.position.z);
 wolf.attackWindup=0;
 wolf.attackCooldown=Math.max(wolf.attackCooldown,.9);
 wolf.warningRing.visible=false;
}
function damageWildAnimal(animal){
 if(!animal||!animal.alive)return;
 animal.health--;
 updateWolfHealthBar(animal);
 if(animal.id.startsWith("wolf-")&&animal.health>0)reactWolfToHit(animal);
 if(animal.health<=0){
  animal.alive=false;animal.object.visible=false;
  if(animal.id.startsWith("wolf-")){
   if(!state.huntedWolves.includes(animal.id))state.huntedWolves.push(animal.id);
   createCarcass(animal.x,animal.z,animal.id);
   toast("Lobo abatido com uma flecha! Recolha a carne e o couro.");
  }else{
   if(!state.huntedAnimals.includes(animal.id))state.huntedAnimals.push(animal.id);
   createCarcass(animal.x,animal.z,animal.id);
   toast("Veado abatido! Recolha a carne e o couro.");
  }
  saveGame();
 }else toast(animal.id.startsWith("wolf-")?"A flecha atingiu o lobo! Ele ainda está vivo.":"A flecha atingiu o veado! Ele está ferido.");
}
function shootArrow(){
 if(!state.bow||state.arrows<1){toast("Você precisa de um arco e flechas.");return;}
 const deer=nearestWildAnimal(16);
 const wolf=nearestWolf(16);
 const animal=wolf&&(!deer||Math.hypot(player.position.x-wolf.x,player.position.z-wolf.z)<Math.hypot(player.position.x-deer.x,player.position.z-deer.z))?wolf:deer;
 if(!animal){toast("Nenhum animal no alcance do arco.");return;}
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
 if(state.steelSpear)spearThrustTime=.34;
 playOneShot("swordslash");
 const range=state.steelSpear?5.4:3.8;
 const wolf=nearestWolf(range);
 const animal=nearestWildAnimal(range);
 if(wolf){
  wolf.health-=state.steelSword?3:state.ironSword||state.steelSpear?2:1;
  updateWolfHealthBar(wolf);
  if(wolf.health>0)reactWolfToHit(wolf);
  if(wolf.health<=0){
   wolf.alive=false;wolf.object.visible=false;
   if(!state.huntedWolves.includes(wolf.id))state.huntedWolves.push(wolf.id);
   createCarcass(wolf.x,wolf.z,wolf.id);
   toast("Lobo derrotado! Recolha 2 carnes e 2 peles.");
   updateHUD();saveGame();
  }else toast("Você atingiu o lobo! Ele ainda está vivo.");
  return;
 }
 if(animal){
  animal.health-=state.steelSpear?2:state.steelSword?3:state.ironSword?2:1;
  updateWolfHealthBar(animal);
  if(animal.health<=0){
   animal.alive=false;animal.object.visible=false;
   if(!state.huntedAnimals.includes(animal.id))state.huntedAnimals.push(animal.id);
   createCarcass(animal.x,animal.z,animal.id);
   toast("Veado abatido! Recolha a carne e o couro.");
   saveGame();
  }else toast("Você atingiu o veado! Ele está ferido.");
 }
}
const loader = new GLTFLoader();
const wildlifeModelCache=new Map();
function applyWildlifeModel(target,path,targetHeight,protectedObjects=[]){
 let pending=wildlifeModelCache.get(path);
 if(!pending){
  pending=new Promise(resolve=>{
   let finished=false;
   const timer=setTimeout(()=>{if(!finished){finished=true;resolve(null);}},18000);
   loader.load(new URL("../"+path,import.meta.url).href,g=>{
    if(finished)return;
    finished=true;clearTimeout(timer);resolve(g);
   },undefined,()=>{
    if(finished)return;
    finished=true;clearTimeout(timer);resolve(null);
   });
  });
  wildlifeModelCache.set(path,pending);
 }
 pending.then(asset=>{
  if(!asset||!target.parent)return;
  const model=cloneSkeleton(asset.scene);
  const bounds=new THREE.Box3().setFromObject(model);
  const size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<.001)return;
  const scale=targetHeight/size.y;
  model.scale.setScalar(scale);
  model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const protectedVisibility=[];
  for(const keep of protectedObjects)keep.traverse(o=>protectedVisibility.push([o,o.visible]));
  target.traverse(o=>{if(o.isMesh)o.visible=false;});
  for(const [object,visible] of protectedVisibility)object.visible=visible;
  target.add(model);
  const clip=asset.animations?.find(c=>/walk|run|move/i.test(c.name))||asset.animations?.[0];
  if(clip){
   const mixer=new THREE.AnimationMixer(model);
   const action=mixer.clipAction(clip);
   action.setEffectiveTimeScale(1);
   action.play();
   target.userData.modelMixer=mixer;
  }
  target.userData.modelRoot=model;
 });
}
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
   player.remove(fallback); player.add(model);characterVisual=model;state.characterModel=model;
   // Reposiciona as ferramentas depois que o esqueleto do personagem estiver carregado.
   if(state.axe)createToolVisual("axe");
   if(state.pickaxe)createToolVisual("pickaxe");
   if(state.leatherArmor)createLeatherArmorVisual();
   if(state.ironSword||state.steelSword)createIronSwordVisual();
   if(state.ironHelmet||state.steelHelmet)createIronHelmetVisual();
   if(state.ironChestplate||state.steelChestplate)createIronChestplateVisual();
   if(state.steelShield)createSteelShieldVisual();
    if(state.steelSpear)createSteelSpearVisual();
   if(state.reinforcedAxe)createToolVisual("axe");
   if(state.reinforcedPickaxe)createToolVisual("pickaxe");
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
 m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}}); scene.add(m); treeModels.push(m); return m;
}
function addRock(x,z,s=1,collectible=false){
 const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.7*s,1),new THREE.MeshStandardMaterial({color:0x77786b,roughness:1}));
 rock.position.set(x,terrainHeight(x,z)+.35*s,z); rock.rotation.set(worldRandom(),worldRandom(),worldRandom()); rock.scale.y=.65; rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
 if(collectible)registerResource({object:rock,x,z,type:"stone",active:true});
 return rock;
}
function addGrass(){
 // Touceiras leves com três lâminas cruzadas: decoração visual, sem colisão ou dados de salvamento.
 // Mantém exatamente as três chamadas ao RNG do mundo por tentativa, preservando a sequência dos recursos.
 const geo=new THREE.BufferGeometry(), verts=[], colors=[];
 const palette=[new THREE.Color(0x788d4c),new THREE.Color(0x91a45a),new THREE.Color(0x647d40),new THREE.Color(0xa1a968)];
 for(let i=0;i<1600;i++){
  const x=(worldRandom()-.5)*210,z=(worldRandom()-.5)*210;
  if(Math.hypot(x,z)<8)continue;
  const h=.18+worldRandom()*.35,w=.035;
  const y=terrainHeight(x,z)+.018;
  // Variação local determinística: não consome o RNG compartilhado do mundo.
  const seed=Math.abs(Math.sin(x*12.9898+z*78.233+i*37.719)*43758.5453)%1;
  const lean=(seed-.5)*.16;
  const tuftHeight=h*(.78+seed*.38);
  for(let blade=0;blade<3;blade++){
   const angle=seed*6.2831853+blade*2.0943951;
   const dx=Math.cos(angle),dz=Math.sin(angle);
   const px=-dz*w*(.72+seed*.35),pz=dx*w*(.72+seed*.35);
   const tipX=x+dx*(.045+lean),tipZ=z+dz*(.045+lean);
   verts.push(x-px,y,z-pz,x+px,y,z+pz,tipX,y+tuftHeight,tipZ);
   const shade=palette[(i+blade)%palette.length].clone().multiplyScalar(.88+seed*.2);
   colors.push(shade.r*.78,shade.g*.78,shade.b*.78,shade.r*.9,shade.g*.9,shade.b*.9,shade.r,shade.g,shade.b);
  }
 }
 geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
 geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
 geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
 mesh.castShadow=false;mesh.receiveShadow=true;scene.add(mesh);
}
let resources=[];
const wildAnimals=[];
const hostileWolves=[];
const wildFoxes=[];
function resourceId(type,x,z){return `${type}:${x.toFixed(3)}:${z.toFixed(3)}`;}
function registerResource(resource){
 resource.id=resourceId(resource.type,resource.x,resource.z);
 if(state.collectedResources.includes(resource.id)){resource.active=false;resource.object.visible=false;if(resource.target)resource.target.visible=false;}
 resources.push(resource);
}
function createCarcass(x,z,animalId=null){
 const isWolf=!!(animalId&&animalId.startsWith("wolf-"));
 const bodyMat=new THREE.MeshStandardMaterial({color:isWolf?0x454747:0x76513a,roughness:1});
 const darkMat=new THREE.MeshStandardMaterial({color:isWolf?0x292c2d:0x49382c,roughness:1});
 const carcass=new THREE.Group();
 const body=new THREE.Mesh(new THREE.SphereGeometry(isWolf ? .43 : .48,9,7),bodyMat);
 body.scale.set(isWolf ? 1.55 : 1.35,isWolf ? .62 : .55,isWolf ? .78 : .8);body.position.set(0,isWolf ? .34 : .38,0);body.castShadow=true;carcass.add(body);
 if(isWolf){
  const chest=new THREE.Mesh(new THREE.SphereGeometry(.3,8,6),bodyMat);
  chest.scale.set(1,.8,1.15);chest.position.set(0,.32,.43);carcass.add(chest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.19,8,6),bodyMat);
  head.position.set(0,.31,.83);carcass.add(head);
  const muzzle=new THREE.Mesh(new THREE.ConeGeometry(.105,.3,7),darkMat);
  muzzle.rotation.x=Math.PI/2;muzzle.position.set(0,.25,1.02);carcass.add(muzzle);
  for(const side of [-1,1]){
   const ear=new THREE.Mesh(new THREE.ConeGeometry(.065,.19,5),darkMat);
   ear.position.set(side*.13,.48,.78);ear.rotation.z=side*.2;carcass.add(ear);
  }
  for(const lx of [-.23,.23])for(const lz of [-.34,.48]){
   const leg=new THREE.Mesh(new THREE.CylinderGeometry(.065,.055,.28,6),darkMat);
   leg.position.set(lx,.13,lz);leg.rotation.x=lz<0?-.16:.16;carcass.add(leg);
  }
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.12,.48,7),bodyMat);
  tail.rotation.x=-Math.PI/2;tail.position.set(0,.36,-.72);carcass.add(tail);
 }else{
  const head=new THREE.Mesh(new THREE.SphereGeometry(.2,7,6),darkMat);
  head.position.set(0,.32,.58);head.castShadow=true;carcass.add(head);
 }
 carcass.position.set(x,terrainHeight(x,z),z);scene.add(carcass);
 registerResource({object:carcass,x,z,type:"carcass",animalId,active:true});
}
function createDeer(x,z,index){
 const id="deer-"+index;
 if(state.huntedAnimals.includes(id)){const remainsId=resourceId("carcass",x,z);if(state.collectedResources.includes(remainsId)){state.huntedAnimals=state.huntedAnimals.filter(v=>v!==id);}else{createCarcass(x,z,id);return;}}
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
 const eyeMat=new THREE.MeshStandardMaterial({color:0x1b120d,roughness:.28,metalness:.02});
 const eyes=[];
 for(const side of [-1,1]){
  const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),eyeMat);
  eye.position.set(side*.145,.045,.17);eye.scale.set(.9,.82,.72);head.add(eye);eyes.push(eye);
 }
 const nostrilMat=new THREE.MeshStandardMaterial({color:0x49352b,roughness:.9});
 for(const side of [-1,1]){
  const nostril=new THREE.Mesh(new THREE.SphereGeometry(.018,6,5),nostrilMat);
  nostril.position.set(side*.045,1.59,1.115);nostril.scale.set(1,.75,.55);deer.add(nostril);
 }
 const earMat=new THREE.MeshStandardMaterial({color:0x76513a,roughness:1});
 const ears=[];
 for(const side of [-1,1]){
  const ear=new THREE.Mesh(new THREE.SphereGeometry(.105,7,5),earMat);
  ear.position.set(side*.19,.015,-.015);ear.scale.set(.55,.42,1.65);ear.rotation.z=side*-.22;head.add(ear);ears.push(ear);
 }
 const antlerMat=new THREE.MeshStandardMaterial({color:0x8b8069,roughness:.95});
 function addAntlerSegment(from,to,radius){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),delta=b.clone().sub(a);
  const segment=new THREE.Mesh(new THREE.CylinderGeometry(radius*.62,radius,delta.length(),5),antlerMat);
  segment.position.copy(a.add(b).multiplyScalar(.5));
  segment.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  segment.castShadow=true;head.add(segment);
 }
 for(const side of [-1,1]){
  const p0=[side*.12,.14,-.015],p1=[side*.22,.34,-.025],p2=[side*.25,.55,-.035],p3=[side*.19,.72,-.045];
  addAntlerSegment(p0,p1,.047);addAntlerSegment(p1,p2,.039);addAntlerSegment(p2,p3,.031);
  addAntlerSegment([side*.21,.34,-.02],[side*.39,.44,-.025],.027);
  addAntlerSegment([side*.25,.53,-.03],[side*.43,.65,-.04],.024);
 }
 const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.12,7,6),belly);
 muzzle.scale.set(.85,.65,1.2);muzzle.position.set(0,1.58,1.01);deer.add(muzzle);
 const legs=[];
 for(const lx of [-.29,.29])for(const lz of [-.48,.48]){
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,.68,6),dark);
  leg.position.set(lx,.42,lz);leg.castShadow=true;deer.add(leg);legs.push(leg);
 }
 const tail=new THREE.Mesh(new THREE.SphereGeometry(.12,6,5),belly);
 tail.position.set(0,1.12,-.82);deer.add(tail);
 const healthBar=new THREE.Group();
 const healthBack=new THREE.Mesh(new THREE.PlaneGeometry(.86,.105),new THREE.MeshBasicMaterial({color:0x171512,transparent:true,opacity:.88,depthWrite:false,side:THREE.DoubleSide}));
 healthBar.add(healthBack);
 const healthFill=new THREE.Mesh(new THREE.PlaneGeometry(.76,.055),new THREE.MeshBasicMaterial({color:0x76bd55,depthWrite:false,side:THREE.DoubleSide}));
 healthFill.position.set(0,0,.008);healthBar.add(healthFill);
 healthBar.position.set(0,2.02,0);healthBar.visible=false;healthBar.renderOrder=5;deer.add(healthBar);
 deer.position.set(x,terrainHeight(x,z),z);scene.add(deer);
 wildAnimals.push({id,object:deer,body,x,z,heading:worldRandom()*Math.PI*2,moveSpeed:.45,health:2,alive:true,wander:1+worldRandom()*2,healthBar,healthFill,legs,tail,head,neck,ears,eyes,blinkTimer:2+worldRandom()*3,blinkTime:0,breathPhase:worldRandom()*Math.PI*2,grazeTimer:2+worldRandom()*4,grazeBlend:0,alarmBlend:0,grazing:false});
 applyWildlifeModel(deer,"assets/3d/animals/Stag.gltf",1.95,[healthBar]);
}
function createWolf(x,z,index){
 const id="wolf-"+index;
 // Lobos abatidos em sessões anteriores voltam a aparecer vivos ao iniciar um novo mundo.
 // A carcaça continua disponível durante a sessão em que o animal foi abatido.
 if(state.huntedWolves.includes(id))state.huntedWolves=state.huntedWolves.filter(v=>v!==id);
 const wolf=new THREE.Group();
 const coat=new THREE.MeshStandardMaterial({color:0x555b5c,roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:0x292d30,roughness:1});
 const muzzleMat=new THREE.MeshStandardMaterial({color:0x9a8c7a,roughness:1});
 const body=new THREE.Mesh(new THREE.SphereGeometry(.48,9,7),coat);
 body.scale.set(.82,.82,1.45);body.position.y=.82;body.castShadow=true;wolf.add(body);
 const chest=new THREE.Mesh(new THREE.SphereGeometry(.34,8,7),coat);
 chest.position.set(0,.9,.48);chest.castShadow=true;wolf.add(chest);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.27,8,7),coat);
 head.position.set(0,1.12,.92);head.castShadow=true;wolf.add(head);
 const muzzle=new THREE.Mesh(new THREE.ConeGeometry(.16,.38,7),muzzleMat);
 muzzle.rotation.x=Math.PI/2;muzzle.position.set(0,1.03,1.18);wolf.add(muzzle);
 const jaw=new THREE.Mesh(new THREE.SphereGeometry(.115,7,5),dark);
 jaw.scale.set(1,.48,1.35);jaw.position.set(0,.91,1.19);wolf.add(jaw);
 const ears=[],eyes=[];
 const eyeMat=new THREE.MeshStandardMaterial({color:0xd9b36c,emissive:0x4a2d08});
 for(const xSide of [-.17,.17]){
  const ear=new THREE.Mesh(new THREE.ConeGeometry(.085,.28,5),dark);
  ear.position.set(xSide,1.38,.86);ear.rotation.z=xSide<0?.18:-.18;wolf.add(ear);ears.push(ear);
  const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,6,5),eyeMat);
  eye.position.set(xSide*.85,1.16,1.12);wolf.add(eye);eyes.push(eye);
 }
 const legs=[];
 for(const lx of [-.25,.25])for(const lz of [-.43,.43]){
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.075,.065,.52,6),dark);
  leg.position.set(lx,.36,lz);leg.castShadow=true;wolf.add(leg);legs.push(leg);
 }
 const tail=new THREE.Mesh(new THREE.CylinderGeometry(.08,.13,.62,7),coat);
 tail.position.set(0,.78,-.86);tail.rotation.x=-1.05;wolf.add(tail);
 const healthBar=new THREE.Group();
 const healthBack=new THREE.Mesh(new THREE.PlaneGeometry(.86,.105),new THREE.MeshBasicMaterial({color:0x171512,transparent:true,opacity:.88,depthWrite:false,side:THREE.DoubleSide}));
 healthBack.position.z=0;healthBar.add(healthBack);
 const healthFill=new THREE.Mesh(new THREE.PlaneGeometry(.76,.055),new THREE.MeshBasicMaterial({color:0x76bd55,depthWrite:false,side:THREE.DoubleSide}));
 healthFill.position.set(0,0,.008);healthBar.add(healthFill);
 healthBar.position.set(0,1.78,0);healthBar.visible=false;healthBar.renderOrder=5;wolf.add(healthBar);
 const warningRing=new THREE.Mesh(new THREE.RingGeometry(.72,.94,32),new THREE.MeshBasicMaterial({color:0xff3328,transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false}));
 warningRing.rotation.x=-Math.PI/2;warningRing.position.y=.045;warningRing.visible=false;wolf.add(warningRing);
 wolf.position.set(x,terrainHeight(x,z),z);scene.add(wolf);
 hostileWolves.push({id,object:wolf,body,chest,x,z,heading:worldRandom()*Math.PI*2,health:3,alive:true,wander:1+worldRandom()*2,moveSpeed:.35,attackCooldown:1+index*.7,attackWindup:0,staggerTime:0,staggerHeading:0,hitStunTime:0,hitHeading:0,warningRing,healthBar,healthFill,legs,tail,head,jaw,ears,eyes,blinkTimer:1.5+worldRandom()*3,blinkTime:0,breathPhase:worldRandom()*Math.PI*2,sniffCooldown:5+worldRandom()*7,sniffTime:0,howlCooldown:(state.timeOfDay>=19||state.timeOfDay<6)?10+worldRandom()*12:32+worldRandom()*28,howlTime:0});
 applyWildlifeModel(wolf,"assets/3d/animals/Wolf.gltf",1.5,[healthBar,warningRing]);
}
let foxAssetPromise=null;
function loadFoxAsset(){
 if(!foxAssetPromise)foxAssetPromise=new Promise(resolve=>{
  let finished=false;
  const timer=setTimeout(()=>{if(!finished){finished=true;resolve(null);}},18000);
  loader.load(new URL("../assets/3d/animals/Fox.gltf",import.meta.url).href,g=>{
   if(finished)return;
   finished=true;clearTimeout(timer);resolve(g);
  },undefined,()=>{
   if(finished)return;
   finished=true;clearTimeout(timer);resolve(null);
  });
 });
 return foxAssetPromise;
}
function createProceduralFox(){
 const root=new THREE.Group();
 const orange=new THREE.MeshStandardMaterial({color:0xb96732,roughness:1});
 const cream=new THREE.MeshStandardMaterial({color:0xe6d4b8,roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:0x38271f,roughness:1});
 const body=new THREE.Mesh(new THREE.SphereGeometry(.34,10,8),orange);
 body.scale.set(1,.76,1.48);body.position.set(0,.43,-.04);body.castShadow=true;root.add(body);
 const chest=new THREE.Mesh(new THREE.SphereGeometry(.19,9,7),cream);
 chest.position.set(0,.42,.3);root.add(chest);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.19,9,7),orange);
 head.position.set(0,.66,.43);head.castShadow=true;root.add(head);
 const muzzle=new THREE.Mesh(new THREE.ConeGeometry(.09,.25,7),cream);
 muzzle.rotation.x=Math.PI/2;muzzle.position.set(0,.61,.61);root.add(muzzle);
 for(const side of [-1,1]){
  const ear=new THREE.Mesh(new THREE.ConeGeometry(.075,.25,6),dark);
  ear.position.set(side*.12,.88,.4);ear.rotation.z=side*-.16;root.add(ear);
 }
 const legs=[];
 for(const lx of [-.2,.2])for(const lz of [-.27,.27]){
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.34,6),dark);
  leg.position.set(lx,.19,lz);leg.castShadow=true;root.add(leg);legs.push(leg);
 }
 const tail=new THREE.Mesh(new THREE.ConeGeometry(.12,.52,8),orange);
 tail.rotation.x=-Math.PI/2;tail.position.set(0,.55,-.57);tail.castShadow=true;root.add(tail);
 const tip=new THREE.Mesh(new THREE.SphereGeometry(.105,7,6),cream);
 tip.position.set(0,.55,-.81);root.add(tip);
 return {root,legs,tail};
}
async function createFox(x,z,index){
 const id="fox-"+index;
 const fox=new THREE.Group();
 let mixer=null,legs=[],tail=null;
 const asset=await loadFoxAsset();
 if(asset){
  const model=cloneSkeleton(asset.scene);
  const bounds=new THREE.Box3().setFromObject(model);
  const size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());
  const scale=.72/Math.max(size.y,.01);
  model.scale.setScalar(scale);
  model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  fox.add(model);
  if(asset.animations?.length){
   mixer=new THREE.AnimationMixer(model);
   const clip=asset.animations.find(c=>/walk|run|move/i.test(c.name))||asset.animations[0];
   const action=mixer.clipAction(clip);
   action.setEffectiveTimeScale(1.12);
   action.play();
  }
 }else{
  const fallback=createProceduralFox();
  fox.add(fallback.root);legs=fallback.legs;tail=fallback.tail;
 }
 fox.position.set(x,terrainHeight(x,z),z);
 scene.add(fox);
 wildFoxes.push({id,object:fox,x,z,heading:index*2.094,wander:1.4+index*.35,moveSpeed:.42,phase:index*1.7,mixer,legs,tail});
}
function nearestWolf(maxDistance){
 let nearest=null,dist=maxDistance;
 for(const wolf of hostileWolves){if(!wolf.alive)continue;const d=Math.hypot(player.position.x-wolf.x,player.position.z-wolf.z);if(d<dist){dist=d;nearest=wolf;}}
 return nearest;
}
function nearestWildAnimal(maxDistance){
 let nearest=null,dist=maxDistance;
 for(const animal of wildAnimals){if(!animal.alive)continue;const d=Math.hypot(player.position.x-animal.x,player.position.z-animal.z);if(d<dist){dist=d;nearest=animal;}}
 return nearest;
}
function updateWildlife(dt){
 for(const wolf of hostileWolves){
  if(!wolf.alive)continue;
  const dx=player.position.x-wolf.x,dz=player.position.z-wolf.z,d=Math.hypot(dx,dz);
  wolf.attackCooldown=Math.max(0,wolf.attackCooldown-dt);
  wolf.staggerTime=Math.max(0,wolf.staggerTime-dt);
  wolf.hitStunTime=Math.max(0,wolf.hitStunTime-dt);
  let speed=.35;
  if(wolf.hitStunTime>0){wolf.heading=wolf.hitHeading;speed=1.8;wolf.object.rotation.x=-.12;}
  else if(wolf.staggerTime>0){wolf.heading=wolf.staggerHeading;speed=2.4;wolf.object.rotation.x=0;}
  else if(d<14){wolf.object.rotation.x=0;const chaseHeading=Math.atan2(dx,dz);const turnDelta=Math.atan2(Math.sin(chaseHeading-wolf.heading),Math.cos(chaseHeading-wolf.heading));wolf.heading+=turnDelta*Math.min(1,dt*5.2);speed=d>1.55?2.65:0;}
  else{wolf.wander-=dt;if(wolf.wander<=0){wolf.heading+=(worldRandom()-.5)*1.4;wolf.wander=2+worldRandom()*3;}}
  if(wolf.hitStunTime<=0&&wolf.staggerTime<=0&&d<1.9&&wolf.attackCooldown<=0&&!(wolf.attackWindup>0))wolf.attackWindup=.75;
  if(wolf.attackWindup>0){
   speed=0;
   wolf.attackWindup=Math.max(0,wolf.attackWindup-dt);
   wolf.object.scale.y=.9;
   wolf.warningRing.visible=true;
   const pulse=1+Math.sin((.75-wolf.attackWindup)*24)*.12;
   wolf.warningRing.scale.setScalar(pulse);
   wolf.warningRing.material.opacity=.48+Math.sin((.75-wolf.attackWindup)*24)*.2;
   if(Math.hypot(player.position.x-wolf.x,player.position.z-wolf.z)>2.2){
    wolf.attackWindup=0;wolf.attackCooldown=.35;wolf.object.scale.y=1;wolf.warningRing.visible=false;
   }else if(wolf.attackWindup<=0){
    wolf.object.scale.y=1;wolf.warningRing.visible=false;
    const impactDistance=Math.hypot(player.position.x-wolf.x,player.position.z-wolf.z);
    if(impactDistance<2.2){
     const protection=(state.leatherArmor?.65:1)*(state.steelHelmet?.55:state.ironHelmet?.75:1)*(state.steelChestplate?.35:state.ironChestplate?.55:1)*(state.steelShield?(state.steelShieldGuarding?.4:.8):1);
     state.health=Math.max(0,state.health-9*protection);
     state.energy=Math.max(0,state.energy-5);
     if(state.steelShield&&state.steelShieldGuarding){
      wolf.staggerTime=1.15;
      wolf.staggerHeading=Math.atan2(wolf.x-player.position.x,wolf.z-player.position.z);
      wolf.attackCooldown=3.2;
      toast("Bloqueio perfeito! O lobo recuou. Aproveite para contra-atacar!");
     }else{
      wolf.attackCooldown=2.4;
      toast("O lobo saltou para atacar! Afaste-se ou erga o escudo.");
     }
     updateHUD();saveGame();
    }else wolf.attackCooldown=.35;
   }
  }else{wolf.object.scale.y=1;wolf.warningRing.visible=false;}
  const targetWolfSpeed=speed;
  wolf.moveSpeed+=(targetWolfSpeed-wolf.moveSpeed)*Math.min(1,dt*(targetWolfSpeed>wolf.moveSpeed?4.8:9));
  const gaitSpeed=wolf.moveSpeed;
  wolf.x+=Math.sin(wolf.heading)*gaitSpeed*dt;
  wolf.z+=Math.cos(wolf.heading)*gaitSpeed*dt;
  wolf.object.position.set(wolf.x,terrainHeight(wolf.x,wolf.z),wolf.z);
  wolf.object.rotation.y=wolf.heading;
  if(wolf.healthBar){wolf.healthBar.quaternion.copy(wolf.object.quaternion).invert().multiply(camera.quaternion);}

  if(wolf.hitStunTime<=0&&wolf.staggerTime<=0)wolf.object.rotation.x=0;
  const runBlend=THREE.MathUtils.clamp((gaitSpeed-.35)/2.35,0,1);
  const gait=Math.sin(performance.now()*(.009+runBlend*.009)+wolf.x*1.4)*(.045+runBlend*.19);
  wolf.legs.forEach((leg,i)=>{const phase=(i===0||i===3)?1:-1;leg.rotation.x=phase*gait*(.65+runBlend*.8);leg.rotation.z=(i<2?1:-1)*runBlend*.035;});
  if(wolf.body){wolf.body.rotation.x=-.025-runBlend*.055+Math.sin(performance.now()*.014+wolf.breathPhase)*.012;wolf.body.rotation.z=Math.sin(performance.now()*.009+wolf.x)*.025*runBlend;}
  if(wolf.chest)wolf.chest.rotation.x=Math.sin(performance.now()*.012+wolf.breathPhase)*.025*runBlend;
  if(wolf.tail){const alert=d<24||wolf.attackWindup>0;wolf.tail.rotation.z=Math.sin(performance.now()*.003+wolf.x)*(alert?.065:.16);wolf.tail.rotation.x=-1.05+(alert?.13:0)+Math.sin(performance.now()*.002+wolf.z)*.025;}
  if(wolf.sniffTime>0)wolf.sniffTime=Math.max(0,wolf.sniffTime-dt);else if(d>=14&&wolf.moveSpeed<.55&&wolf.howlTime<=0){wolf.sniffCooldown-=dt;if(wolf.sniffCooldown<=0){wolf.sniffTime=.85;wolf.sniffCooldown=7+worldRandom()*8;}}else wolf.sniffCooldown=Math.max(wolf.sniffCooldown,2);
  if(wolf.howlTime>0)wolf.howlTime=Math.max(0,wolf.howlTime-dt);else if(d>=14&&wolf.moveSpeed<.55&&wolf.sniffTime<=0){wolf.howlCooldown-=dt;if(wolf.howlCooldown<=0){wolf.howlTime=1.15;wolf.howlCooldown=(state.timeOfDay>=19||state.timeOfDay<6)?14+worldRandom()*12:42+worldRandom()*30;}}
  if(wolf.head){const gazeYaw=d<24?THREE.MathUtils.clamp(Math.atan2(dx,dz)-wolf.heading,-.48,.48):0;wolf.head.rotation.y+=(gazeYaw-wolf.head.rotation.y)*Math.min(1,dt*4.5);const sniffDip=wolf.sniffTime>0?Math.sin((1-wolf.sniffTime/.85)*Math.PI)*.42:0;const howlLift=wolf.howlTime>0?-Math.sin((1-wolf.howlTime/1.15)*Math.PI)*.38:0;wolf.head.rotation.x=(wolf.attackWindup>0?-.12:0)+sniffDip+howlLift+Math.sin(performance.now()*.0018+wolf.z)*.025;}
  if(wolf.jaw)wolf.jaw.rotation.x=wolf.attackWindup>0?-.28+Math.sin((.75-wolf.attackWindup)*18)*.07:wolf.howlTime>0?-.38+Math.sin((1-wolf.howlTime/1.15)*Math.PI*3)*.08:0;
  if(wolf.ears)wolf.ears.forEach((ear,i)=>{const alert=d<24?.12:0;ear.rotation.z=(i===0?.18:-.18)+(i===0?alert:-alert)+Math.sin(performance.now()*.0022+wolf.x+i)*.035;ear.rotation.x=(d<24?-.14:0)+Math.sin(performance.now()*.0018+wolf.z+i)*.025;});
  if(wolf.eyes){
   wolf.blinkTimer-=dt;
   if(wolf.blinkTimer<=0&&wolf.blinkTime<=0){wolf.blinkTime=.16;wolf.blinkTimer=2.8+worldRandom()*4.2;}
   if(wolf.blinkTime>0){wolf.blinkTime=Math.max(0,wolf.blinkTime-dt);const blink=Math.max(.07,1-Math.sin((1-wolf.blinkTime/.16)*Math.PI)*.93);wolf.eyes.forEach(eye=>{eye.scale.y=blink;});}
   else wolf.eyes.forEach(eye=>{eye.scale.y=1;});
  }
  if(wolf.body&&wolf.chest&&wolf.attackWindup<=0&&wolf.hitStunTime<=0&&wolf.staggerTime<=0){
   const breath= Math.sin(performance.now()*.0021+wolf.breathPhase);
   wolf.body.scale.y=.82+breath*.018;
   wolf.chest.scale.y=1+breath*.025;
  }
 }
 for(const animal of wildAnimals){
  if(!animal.alive)continue;
  const dx=animal.x-player.position.x,dz=animal.z-player.position.z,d=Math.hypot(dx,dz);
  let predatorDistance=Infinity,predatorX=0,predatorZ=0;
  for(const wolf of hostileWolves){if(!wolf.alive)continue;const wd=Math.hypot(animal.x-wolf.x,animal.z-wolf.z);if(wd<predatorDistance){predatorDistance=wd;predatorX=wolf.x;predatorZ=wolf.z;}}
  const predatorThreat=predatorDistance<8;
  const threatX=predatorThreat?predatorX:player.position.x,threatZ=predatorThreat?predatorZ:player.position.z;
  const threatDistance=predatorThreat?predatorDistance:d;
  let targetSpeed=.45;
  if(d<9||predatorThreat){const fleeHeading=Math.atan2(animal.x-threatX,animal.z-threatZ);const turnDelta=Math.atan2(Math.sin(fleeHeading-animal.heading),Math.cos(fleeHeading-animal.heading));animal.heading+=turnDelta*Math.min(1,dt*(threatDistance<4?6.2:4.4));targetSpeed=threatDistance<4?4.25:3.2;}
  else{animal.wander-=dt;if(animal.wander<=0){animal.heading+=(worldRandom()-.5)*1.8;animal.wander=2+worldRandom()*3;}}
  animal.moveSpeed+=(targetSpeed-animal.moveSpeed)*Math.min(1,dt*(targetSpeed>animal.moveSpeed?4.2:2.4));
  const speed=animal.moveSpeed;
  animal.x+=Math.sin(animal.heading)*speed*dt;
  animal.z+=Math.cos(animal.heading)*speed*dt;
  animal.object.position.set(animal.x,terrainHeight(animal.x,animal.z),animal.z);
  animal.object.rotation.y=animal.heading;
  const runBlend=Math.max(0,Math.min(1,(speed-.7)/3.5));
  const gait=Math.sin(performance.now()*(.010+runBlend*.012)+animal.x*1.7)*(.10+runBlend*.29);
  animal.legs.forEach((leg,i)=>{leg.rotation.x=(i===0||i===3?1:-1)*gait*(.7+runBlend*.65);leg.rotation.z=(i<2?1:-1)*runBlend*.045;});
  animal.object.position.y=terrainHeight(animal.x,animal.z)+Math.abs(gait)*(.018+runBlend*.045);
  if(animal.body){const breath=Math.sin(performance.now()*.0019+animal.breathPhase);animal.body.scale.y=.78+breath*.012;animal.body.position.y=1.02+breath*.004;animal.body.rotation.z=Math.sin(performance.now()*.012+animal.x)*.035*runBlend;animal.body.rotation.x=-.035*runBlend+Math.sin(performance.now()*.018+animal.z)*.018*runBlend;}
  animal.alarmBlend+=( ((d<9||predatorThreat)?1:0)-animal.alarmBlend)*Math.min(1,dt*3.2);
  if(animal.tail){const alarm=animal.alarmBlend;animal.tail.rotation.x=-.18-alarm*.42+Math.sin(performance.now()*(.004+alarm*.008)+animal.z)*(.12+alarm*.12);animal.tail.rotation.z=Math.sin(performance.now()*(.0027+alarm*.009)+animal.x*1.3)*(.13+alarm*.2);}
  if(d>=9&&!predatorThreat){
   animal.grazeTimer-=dt;
   if(animal.grazeTimer<=0){animal.grazing=!animal.grazing;animal.grazeTimer=animal.grazing?2.4+worldRandom()*1.8:4+worldRandom()*4;}
  }else animal.grazing=false;
  animal.grazeBlend+=((animal.grazing?1:0)-animal.grazeBlend)*Math.min(1,dt*2.2);
  if(animal.head){const alert=d<9||predatorThreat?-.08:0;const lookX=predatorThreat?predatorX:player.position.x,lookZ=predatorThreat?predatorZ:player.position.z;const lookYaw=(d<9||predatorThreat)?THREE.MathUtils.clamp(Math.atan2(lookX-animal.x,lookZ-animal.z)-animal.heading,-.62,.62):0;animal.head.rotation.y+=(lookYaw-animal.head.rotation.y)*Math.min(1,dt*3.8);animal.head.rotation.x=alert+animal.grazeBlend*.58+Math.sin(performance.now()*.0011+animal.x*.7)*.035;}
  if(animal.neck)animal.neck.rotation.x=.48+animal.grazeBlend*.16;
  if(animal.ears)animal.ears.forEach((ear,i)=>{const side=i===0?-1:1;const alert=d<9||predatorThreat?-.16:0;ear.rotation.z=side*-.22+side*alert+Math.sin(performance.now()*.0024+animal.x+i*1.7)*.09;ear.rotation.x=Math.sin(performance.now()*.0017+animal.z+i)*.07;});
  if(animal.eyes){
   animal.blinkTimer-=dt;
   if(animal.blinkTimer<=0&&animal.blinkTime<=0){animal.blinkTime=.18;animal.blinkTimer=2.5+worldRandom()*3.5;}
   if(animal.blinkTime>0){animal.blinkTime=Math.max(0,animal.blinkTime-dt);const progress=1-animal.blinkTime/.18;const open=Math.max(.08,1-Math.sin(progress*Math.PI)*.92);animal.eyes.forEach(eye=>{eye.scale.y=.82*open;});}
   else animal.eyes.forEach(eye=>{eye.scale.y=.82;});
  }
  if(animal.healthBar){animal.healthBar.quaternion.copy(animal.object.quaternion).invert().multiply(camera.quaternion); }
 }
 for(const fox of wildFoxes){
  const playerDistance=Math.hypot(player.position.x-fox.x,player.position.z-fox.z);
  let threatDistance=playerDistance,threatX=player.position.x,threatZ=player.position.z;
  for(const wolf of hostileWolves){
   if(!wolf.alive)continue;
   const d=Math.hypot(wolf.x-fox.x,wolf.z-fox.z);
   if(d<threatDistance){threatDistance=d;threatX=wolf.x;threatZ=wolf.z;}
  }
  let targetSpeed=.42;
  if(threatDistance<10){
   const fleeHeading=Math.atan2(fox.x-threatX,fox.z-threatZ);
   const turnDelta=Math.atan2(Math.sin(fleeHeading-fox.heading),Math.cos(fleeHeading-fox.heading));
   fox.heading+=turnDelta*Math.min(1,dt*(threatDistance<4?6:4.2));
   targetSpeed=threatDistance<4?3.8:2.8;
  }else{
   fox.wander-=dt;
   if(fox.wander<=0){
    fox.heading+=(Math.sin(fox.phase+performance.now()*.00017))*.48;
    fox.wander=2.5+fox.phase%2;
   }
  }
  fox.moveSpeed+=(targetSpeed-fox.moveSpeed)*Math.min(1,dt*(targetSpeed>fox.moveSpeed?4.5:2.5));
  fox.x+=Math.sin(fox.heading)*fox.moveSpeed*dt;
  fox.z+=Math.cos(fox.heading)*fox.moveSpeed*dt;
  fox.object.position.set(fox.x,terrainHeight(fox.x,fox.z)+Math.sin(performance.now()*.006+fox.phase)*.012,fox.z);
  fox.object.rotation.y=fox.heading;
  if(fox.mixer)fox.mixer.update(dt);
  if(fox.legs.length){
   const gait=Math.sin(performance.now()*.014+fox.phase)*(.08+fox.moveSpeed*.07);
   fox.legs.forEach((leg,i)=>{leg.rotation.x=(i===0||i===3?1:-1)*gait;});
   if(fox.tail)fox.tail.rotation.z=Math.sin(performance.now()*.004+fox.phase)*.13;
  }
 }
 for(const animal of wildAnimals){const mixer=animal.object.userData.modelMixer;if(mixer)mixer.update(dt);}
 for(const wolf of hostileWolves){const mixer=wolf.object.userData.modelMixer;if(mixer)mixer.update(dt);}
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
function createMineralNode(x,z,type){
 const g=new THREE.Group();
 const base=new THREE.Mesh(new THREE.DodecahedronGeometry(.62,1),new THREE.MeshStandardMaterial({color:type==="ironOre"?0x777b80:0x242321,roughness:.95,metalness:type==="ironOre"?.28:0}));
 base.scale.set(1,.72,.9);base.position.y=.42;g.add(base);
 for(let i=0;i<4;i++){const shard=new THREE.Mesh(new THREE.DodecahedronGeometry(.16+worldRandom()*.1,0),new THREE.MeshStandardMaterial({color:type==="ironOre"?0xa66b4b:0x111110,roughness:.8,metalness:type==="ironOre"?.35:0}));const a=i*Math.PI/2;shard.position.set(Math.cos(a)*.38,.55+worldRandom()*.25,Math.sin(a)*.38);g.add(shard);}
 g.position.set(x,terrainHeight(x,z),z);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(g);
 registerResource({object:g,x,z,type,active:true});
}
function createResource(x,z,type="wood",target=null){
 const stump=new THREE.Group();
 const log=new THREE.Mesh(new THREE.CylinderGeometry(.23,.3,.9,7),new THREE.MeshStandardMaterial({color:0x76502e}));
 log.rotation.z=Math.PI/2; log.position.y=.3; stump.add(log); stump.position.set(x,terrainHeight(x,z),z); scene.add(stump);
 registerResource({object:stump,x,z,type,target,active:true});
}
async function buildForest(){
 const [common,pine,twisted,common2,common3,common4,common5,pine2,pine3,pine4,pine5,twisted2,twisted3,twisted4,twisted5,rock,grassShort,grassTall,wispyGrass,wispyGrassTall,rockPathA,rockPathB,rockPathC,rockPathThin,rockPathWide,bushFlowers,fern,clover,flowerGroup,mushroomCommon,mushroomGolden,pebbleRound1,pebbleRound2,pebbleRound3,pebbleRound4,pebbleRound5] = await Promise.all([
  loadTree("CommonTree_1"),loadTree("Pine_1"),loadTree("TwistedTree_1"),
  loadTree("CommonTree_2"),loadTree("CommonTree_3"),loadTree("CommonTree_4"),loadTree("CommonTree_5"),
  loadTree("Pine_2"),loadTree("Pine_3"),loadTree("Pine_4"),loadTree("Pine_5"),
  loadTree("TwistedTree_2"),loadTree("TwistedTree_3"),loadTree("TwistedTree_4"),loadTree("TwistedTree_5"),
  loadTree("Rock_Medium_1"),
  loadTree("Grass_Common_Short"),loadTree("Grass_Common_Tall"),loadTree("Grass_Wispy_Short"),loadTree("Grass_Wispy_Tall"),
  loadTree("RockPath_Round_Small_1"),loadTree("RockPath_Round_Small_2"),loadTree("RockPath_Round_Small_3"),loadTree("RockPath_Round_Thin"),loadTree("RockPath_Round_Wide"),
  loadTree("Bush_Common_Flowers"),loadTree("Fern_1"),loadTree("Clover_1"),loadTree("Flower_3_Group"),
  loadTree("Mushroom_Common"),loadTree("Mushroom_Laetiporus"),
  loadTree("Pebble_Round_1"),loadTree("Pebble_Round_2"),loadTree("Pebble_Round_3"),loadTree("Pebble_Round_4"),loadTree("Pebble_Round_5")
 ]);
 const treeVariants=[
  [common,common2,common3,common4,common5].filter(Boolean),
  [pine,pine2,pine3,pine4,pine5].filter(Boolean),
  [twisted,twisted2,twisted3,twisted4,twisted5].filter(Boolean)
 ];
 // Vegetação real do pacote de assets: tufos distribuídos nas encostas e clareiras, sem cobrir o acampamento inicial.
 const groundCover=[grassShort,grassTall,wispyGrass,wispyGrassTall].filter(Boolean);
 for(let i=0;i<128&&groundCover.length;i++){
  const a=worldRandom()*Math.PI*2,r=10+worldRandom()*94,x=Math.cos(a)*r,z=Math.sin(a)*r;
  const model=groundCover[i%groundCover.length];
  scatterModel(model,x,z,.48+worldRandom()*.32);
 }
 // Pedras arredondadas do próprio pacote marcam trechos rochosos do relevo.
 const rockyPatches=[rockPathA,rockPathB,rockPathC,rockPathThin,rockPathWide].filter(Boolean);
 for(let i=0;i<32&&rockyPatches.length;i++){
  const a=worldRandom()*Math.PI*2,r=16+worldRandom()*78,x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(terrainHeight(x,z)>1.2)continue;
  const detail=scatterModel(rockyPatches[i%rockyPatches.length],x,z,.34+worldRandom()*.28);
  if(detail)detail.rotation.y=worldRandom()*Math.PI*2;
 }
 treePositions.forEach((p,i)=>{
  if(Math.hypot(p.x,p.z)<10)return;
  const variants=treeVariants[i%treeVariants.length];
  const selected=variants.length?variants[Math.floor(i/3)%variants.length]:null;
  const tree=scatterModel(selected,p.x,p.z,.8+worldRandom()*.55);
  createResource(p.x,p.z,"wood",tree);
 });
 for(let i=0;i<35;i++){const a=worldRandom()*6.28,r=9+worldRandom()*85;addRock(Math.cos(a)*r,Math.sin(a)*r,.45+worldRandom()*.9,true);}
 // Veios de minério e carvão: posições determinísticas e coleta persistente.
 for(let i=0;i<12;i++){const a=worldRandom()*6.28,r=18+worldRandom()*78,x=Math.cos(a)*r,z=Math.sin(a)*r;createMineralNode(x,z,"ironOre");}
 for(let i=0;i<10;i++){const a=worldRandom()*6.28,r=15+worldRandom()*72,x=Math.cos(a)*r,z=Math.sin(a)*r;createMineralNode(x,z,"coal");}
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
 createFox(-34,22,0);createFox(37,31,1);createFox(52,-38,2);
 for(let i=0;i<3;i++){const a=i*(Math.PI*2/3)+(worldRandom()-.5)*.42,r=44+worldRandom()*12;createWolf(Math.cos(a)*r,Math.sin(a)*r,i);}
 createWaterSource(13,0);
 addGrass();
 // Decoração adicional: só é criada depois de todos os recursos persistentes,
 // preservando a sequência determinística e os IDs usados pelo salvamento local.
 // Vegetação ornamental em pequenos núcleos naturais, com variação local independente do RNG do mundo.
 // Os cinco sorteios antigos por exemplar são consumidos para manter idêntica a sequência dos recursos coletáveis.
 const decorativePatches=[
  {model:bushFlowers,count:14,legacyCount:9,minScale:.56,maxScale:.86,minSpacing:2.1},
  {model:fern,count:22,legacyCount:14,minScale:.44,maxScale:.76,minSpacing:1.25},
  {model:clover,count:36,legacyCount:24,minScale:.32,maxScale:.56,minSpacing:.72},
  {model:flowerGroup,count:18,legacyCount:10,minScale:.36,maxScale:.62,minSpacing:1.05}
 ];
 let decorationSeed=0x51f15e;
 const decorationRandom=()=>{
  decorationSeed^=decorationSeed<<13;decorationSeed^=decorationSeed>>>17;decorationSeed^=decorationSeed<<5;
  return (decorationSeed>>>0)/4294967296;
 };
 for(const patch of decorativePatches){
  if(!patch.model)continue;
  for(let i=0;i<patch.legacyCount;i++)for(let n=0;n<5;n++)worldRandom();
 }
 const naturalClearings=Array.from({length:8},(_,i)=>{
  const angle=i*2.39996322973+.31;
  const radius=28+(i%3)*17;
  return {x:Math.cos(angle)*radius,z:Math.sin(angle)*radius};
 });
 const placedGroundDetails=[];
 function isNaturalSpot(x,z,minSpacing=0){
  if(Math.hypot(x,z)<12.5||terrainHeight(x,z)>4.8)return false;
  if(treePositions.some(p=>Math.hypot(p.x-x,p.z-z)<2.7))return false;
  if(minSpacing>0&&placedGroundDetails.some(p=>Math.hypot(p.x-x,p.z-z)<minSpacing))return false;
  return true;
 }
 function addGroundDecoration(model,x,z,scale,rotation,castShadow=false){
  if(!model)return null;
  const object=model.clone(true);
  object.position.set(x,terrainHeight(x,z),z);
  object.rotation.y=rotation;
  object.scale.multiplyScalar(scale);
  object.traverse(o=>{if(o.isMesh){o.castShadow=castShadow;o.receiveShadow=true;}});
  scene.add(object);treeModels.push(object);
  placedGroundDetails.push({x,z});
  return object;
 }
 for(let patchIndex=0;patchIndex<decorativePatches.length;patchIndex++){
  const patch=decorativePatches[patchIndex];
  if(!patch.model)continue;
  for(let i=0;i<patch.count;i++){
   const center=naturalClearings[(i*3+patchIndex*2)%naturalClearings.length];
   let point=null;
   for(let attempt=0;attempt<18;attempt++){
    const angle=decorationRandom()*Math.PI*2;
    const radius=1.2+Math.sqrt(decorationRandom())*(patchIndex===2?5.8:4.8);
    const x=center.x+Math.cos(angle)*radius,z=center.z+Math.sin(angle)*radius;
    if(isNaturalSpot(x,z,patch.minSpacing)){point={x,z};break;}
   }
   if(!point)continue;
   const scale=patch.minScale+decorationRandom()*(patch.maxScale-patch.minScale);
   addGroundDecoration(patch.model,point.x,point.z,scale,.0+decorationRandom()*Math.PI*2);
  }
 }
 // Cogumelos coletáveis: gerados depois dos recursos antigos para preservar
 // posições e IDs já gravados no cronicas-floresta-save.
 const mushroomSpots=[
  {model:mushroomCommon,count:16,minScale:.42,maxScale:.62},
  {model:mushroomGolden,count:10,minScale:.38,maxScale:.56}
 ];
 for(const patch of mushroomSpots){
  if(!patch.model)continue;
  let placed=0,attempts=0;
  while(placed<patch.count&&attempts<patch.count*12){
   attempts++;
   const angle=worldRandom()*Math.PI*2,radius=14+worldRandom()*72;
   const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
   if(terrainHeight(x,z)>1.8)continue;
   const mushroom=scatterModel(patch.model,x,z,patch.minScale+worldRandom()*(patch.maxScale-patch.minScale));
   if(mushroom){registerResource({object:mushroom,x,z,type:"mushroom",active:true});placed++;}
  }
 }
 // Pedrinhas decorativas espalhadas em clareiras e trechos de floresta.
 // A sequência local mantém intactos o RNG do mundo e os IDs do salvamento.
 const pebbleModels=[pebbleRound1,pebbleRound2,pebbleRound3,pebbleRound4,pebbleRound5].filter(Boolean);
 const pebbleSpots=[];
 for(let i=0;i<36&&pebbleModels.length;i++){
  const angle=((i*137.50776405)%360)*Math.PI/180;
  const radius=13+((i*29)%68);
  const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
  if(terrainHeight(x,z)>2.2)continue;
  if(treePositions.some(p=>Math.hypot(p.x-x,p.z-z)<2.4))continue;
  if(pebbleSpots.some(p=>Math.hypot(p.x-x,p.z-z)<3.4))continue;
  pebbleSpots.push({x,z});
  const model=pebbleModels[i%pebbleModels.length].clone(true);
  model.position.set(x,terrainHeight(x,z),z);
  model.rotation.y=(i*2.39996322973)%(Math.PI*2);
  model.scale.multiplyScalar(.20+(i%3)*.035);
  model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});
  scene.add(model);treeModels.push(model);
 }
 // Pedras menores em agrupamentos irregulares junto às clareiras, sem colisão com árvores ou início do jogo.
 for(let i=0;i<18&&pebbleModels.length;i++){
  const center=naturalClearings[(i*5+1)%naturalClearings.length];
  let point=null;
  for(let attempt=0;attempt<16;attempt++){
   const angle=decorationRandom()*Math.PI*2,radius=1.1+decorationRandom()*4.2;
   const x=center.x+Math.cos(angle)*radius,z=center.z+Math.sin(angle)*radius;
   if(Math.hypot(x,z)<13||treePositions.some(p=>Math.hypot(p.x-x,p.z-z)<2.8))continue;
   if(pebbleSpots.some(p=>Math.hypot(p.x-x,p.z-z)<1.45))continue;
   point={x,z};break;
  }
  if(!point)continue;
  pebbleSpots.push(point);
  addGroundDecoration(pebbleModels[(i+2)%pebbleModels.length],point.x,point.z,.17+decorationRandom()*.13,decorationRandom()*Math.PI*2,false);
 }
 // Pequenos bosques: reforça alguns núcleos com árvores adicionais sem criar novos recursos coletáveis.
 const woodlandCenters=treePositions.filter((p,i)=>i%9===2&&Math.hypot(p.x,p.z)>20).slice(0,6);
 const extraTrees=treeVariants.flat().filter(Boolean);
 for(let c=0;c<woodlandCenters.length;c++){
  const center=woodlandCenters[c];
  for(let j=0;j<3;j++){
   const angle=decorationRandom()*Math.PI*2;
   const radius=4.2+decorationRandom()*5.5;
   const x=center.x+Math.cos(angle)*radius,z=center.z+Math.sin(angle)*radius;
   if(Math.hypot(x,z)<15||treePositions.some(p=>Math.hypot(p.x-x,p.z-z)<3.7))continue;
   const source=extraTrees[Math.floor(decorationRandom()*extraTrees.length)];
   if(!source)continue;
   const tree=source.clone(true);
   tree.position.set(x,terrainHeight(x,z),z);
   tree.rotation.y=decorationRandom()*Math.PI*2;
   tree.scale.multiplyScalar(.62+decorationRandom()*.28);
   tree.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});
   scene.add(tree);treeModels.push(tree);
  }
 }
 // Troncos caídos e raízes expostas são malhas leves, sem colisão, coleta ou dados de salvamento.
 const woodMaterial=new THREE.MeshStandardMaterial({color:0x60432c,roughness:1});
 const cutWoodMaterial=new THREE.MeshStandardMaterial({color:0x98734c,roughness:1});
 function addWoodSegment(group,start,end,radiusA,radiusB,material){
  const direction=new THREE.Vector3().subVectors(end,start);
  const length=direction.length();
  if(length<.08)return;
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radiusA,radiusB,length,5),material);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);
 }
 const fallenLogCenters=treePositions.filter((p,i)=>i%4===1&&Math.hypot(p.x,p.z)>18).slice(0,13);
 for(let i=0;i<fallenLogCenters.length;i++){
  const p=fallenLogCenters[i],angle=decorationRandom()*Math.PI*2;
  const length=1.8+decorationRandom()*1.25;
  const group=new THREE.Group();
  const start=new THREE.Vector3(-Math.cos(angle)*length*.5,.22,-Math.sin(angle)*length*.5);
  const end=new THREE.Vector3(Math.cos(angle)*length*.5,.22,Math.sin(angle)*length*.5);
  addWoodSegment(group,start,end,.16,.21,woodMaterial);
  for(const side of [-1,1]){
   const cap=new THREE.Mesh(new THREE.CircleGeometry(.145,7),cutWoodMaterial);
   cap.position.copy(side<0?start:end);
   cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(side*Math.cos(angle),0,side*Math.sin(angle)));
   group.add(cap);
  }
  if(i%2===0){
   const branchStart=new THREE.Vector3(Math.cos(angle)*.15,.28,Math.sin(angle)*.15);
   const branchEnd=branchStart.clone().add(new THREE.Vector3(Math.cos(angle+1.1)*.62,.12,Math.sin(angle+1.1)*.62));
   addWoodSegment(group,branchStart,branchEnd,.055,.09,woodMaterial);
  }
  group.position.set(p.x,terrainHeight(p.x,p.z),p.z);
  group.rotation.y=decorationRandom()*Math.PI*2;
  scene.add(group);treeModels.push(group);
 }
 // Raízes curtas e ramificadas junto à base de árvores selecionadas.
 const rootTrees=treePositions.filter((p,i)=>i%3===0&&Math.hypot(p.x,p.z)>14).slice(0,18);
 for(const p of rootTrees){
  const group=new THREE.Group();
  for(let r=0;r<4;r++){
   const angle=r*Math.PI*.5+decorationRandom()*.32;
   const reach=.75+decorationRandom()*.55;
   const start=new THREE.Vector3(0,.12,0);
   const end=new THREE.Vector3(Math.cos(angle)*reach,.035,Math.sin(angle)*reach);
   addWoodSegment(group,start,end,.045,.13,woodMaterial);
  }
  group.position.set(p.x,terrainHeight(p.x,p.z),p.z);
  group.rotation.y=decorationRandom()*Math.PI*2;
  scene.add(group);treeModels.push(group);
 }
}


 // Vagalumes decorativos: visuais apenas, sem consumir o RNG do mundo
 // e sem gravar dados no salvamento do jogador.
 const forestFireflies=[];
 let fireflyClock=0;
 function createForestFireflies(){
  const glowGeometry=new THREE.SphereGeometry(.055,8,6);
  for(let i=0;i<26;i++){
   const angle=i*2.39996322973,radius=18+((i*17)%49);
   const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
   const baseY=terrainHeight(x,z)+.65+(i%4)*.22;
   const material=new THREE.MeshBasicMaterial({color:0xcfff79,transparent:true,opacity:0,depthWrite:false});
   const object=new THREE.Mesh(glowGeometry,material);
   object.position.set(x,baseY,z);object.renderOrder=3;scene.add(object);
   forestFireflies.push({object,y:baseY,phase:i*1.71,speed:.7+(i%5)*.13});
  }
 }
 function updateForestFireflies(dt){
  fireflyClock+=dt;
  const hour=state.timeOfDay;
  const night=THREE.MathUtils.smoothstep(hour,18.2,20.1)+1-THREE.MathUtils.smoothstep(hour,4.2,6.1);
  const strength=THREE.MathUtils.clamp(night,0,1);
  for(const fly of forestFireflies){
   const wave=(Math.sin(fireflyClock*fly.speed+fly.phase)+1)*.5;
   fly.object.position.y=fly.y+Math.sin(fireflyClock*.8+fly.phase)*.22;
   fly.object.material.opacity=strength*(.18+wave*.82)*.9;
   fly.object.visible=strength>.015;
  }
 }

const state={health:100,hunger:100,thirst:100,temperature:100,energy:100,wood:0,stone:0,ironOre:0,coal:0,ironIngots:0,steelIngots:0,steelSword:false,steelHelmet:false,steelChestplate:false,steelAxe:false,steelPickaxe:false,steelShield:false,steelShieldGuarding:false,steelSpear:false,steelSpearObject:null,steelShieldObject:null,steelFurnace:null,steelFurnaceObject:null,axe:false,pickaxe:false,running:false,moveX:0,moveY:0,yaw:0,cameraYaw:0,cameraPitch:.22,day:1,timeOfDay:8,near:null,campfire:false,campfireX:null,campfireZ:null,shelter:false,shelterX:null,shelterZ:null,coldCloak:false,leatherBoots:false,fiber:0,collectedResources:[],berries:0,herbs:0,herbBeds:[],herbObjects:[],nearHerbBedIndex:-1,meat:0,cookedMeat:0,smokedMeat:0,healingSalve:0,hide:0,leather:0,leatherArmor:false,armorObject:null,reinforcedAxe:false,reinforcedPickaxe:false,ironAxe:false,ironPickaxe:false,ironSword:false,swordObject:null,swordHand:null,ironHelmet:false,helmetObject:null,helmetHead:null,ironChestplate:false,ironChestObject:null,smithy:null,smithyObject:null,nearSmithy:false,tannery:null,nearTannery:false,huntedAnimals:[],huntedWolves:[],starterKitGranted:false,bed:false,bedX:null,bedZ:null,bandages:0,storageChest:false,storageChestX:null,storageChestZ:null,storage:{wood:0,stone:0,ironOre:0,coal:0,ironIngots:0,steelIngots:0,fiber:0,berries:0,herbs:0,meat:0,cookedMeat:0,smokedMeat:0,healingSalve:0,hide:0,leather:0,bandages:0,honey:0,wool:0},waterSkin:false,waterCharges:0,bow:false,arrows:0,fenceSections:[],gates:[],floorTiles:[],wallPanels:[],windowPanels:[],roofTiles:[],gablePanels:[],ridgeCaps:[],chimneys:[],pathTiles:[],lanternPosts:[],wells:[],gardenPlots:[],gardenObjects:[],nearGardenIndex:-1,marketStalls:[],nearMarketIndex:-1,coins:0,chickenCoops:[],nearCoopIndex:-1,eggs:0,apiaries:[],nearApiaryIndex:-1,honey:0,sheepPens:[],nearSheepPenIndex:-1,wool:0,loom:null,nearLoom:false,woolGarment:false,smokehouse:null,nearSmokehouse:false,herbalistHut:null,nearHerbalist:false,watchtowers:[],doorPanels:[],doorObjects:[],nearDoorIndex:-1,windowShutters:[],shutterObjects:[],nearShutterIndex:-1,gateObjects:[],nearGateIndex:-1};
const slopeWorldUp=new THREE.Vector3(0,1,0);
const slopeWorldNormal=new THREE.Vector3();
const slopeLocalNormal=new THREE.Vector3();
const slopeInverseYaw=new THREE.Quaternion();
const slopeTilt=new THREE.Quaternion();
function updateCharacterTerrainTilt(){
 const sample=.85,x=player.position.x,z=player.position.z;
 const gradientX=(terrainHeight(x+sample,z)-terrainHeight(x-sample,z))/(sample*2);
 const gradientZ=(terrainHeight(x,z+sample)-terrainHeight(x,z-sample))/(sample*2);
 slopeWorldNormal.set(-gradientX,1,-gradientZ).normalize();
 slopeInverseYaw.setFromAxisAngle(slopeWorldUp,-state.yaw);
 slopeLocalNormal.copy(slopeWorldNormal).applyQuaternion(slopeInverseYaw);
 slopeTilt.setFromUnitVectors(slopeWorldUp,slopeLocalNormal);
 characterVisual.quaternion.copy(slopeTilt);
}
function loadGame(){
 try{
  const saved=JSON.parse(localStorage.getItem("cronicas-floresta-save")||"null");
  if(!saved)return;
  for(const key of ["health","hunger","thirst","temperature","energy","wood","stone","ironOre","coal","ironIngots","steelIngots","day","timeOfDay","berries","fiber","herbs","meat","cookedMeat","smokedMeat","healingSalve","hide","leather","bandages","waterCharges","arrows","coins","eggs","honey","wool"])if(Number.isFinite(saved[key]))state[key]=saved[key];
  state.axe=saved.axe===true;state.pickaxe=saved.pickaxe===true;
  state.starterKitGranted=saved.starterKitGranted===true;
  state.campfire=saved.campfire===true;
  state.shelter=saved.shelter===true;
  state.bed=saved.bed===true;
  state.storageChest=saved.storageChest===true;
  state.waterSkin=saved.waterSkin===true;
  state.bow=saved.bow===true;
  state.waterCharges=Math.max(0,Math.min(3,state.waterCharges));
  if(saved.storage&&typeof saved.storage==="object")for(const key of ["wood","stone","ironOre","coal","ironIngots","steelIngots","fiber","berries","herbs","meat","cookedMeat","smokedMeat","healingSalve","hide","leather","bandages","honey","wool"])if(Number.isFinite(saved.storage[key]))state.storage[key]=Math.max(0,saved.storage[key]);
  state.coldCloak=saved.coldCloak===true;
  state.leatherBoots=saved.leatherBoots===true;
  state.leatherArmor=saved.leatherArmor===true;
  state.reinforcedAxe=saved.reinforcedAxe===true;state.reinforcedPickaxe=saved.reinforcedPickaxe===true;state.ironAxe=saved.ironAxe===true;state.ironPickaxe=saved.ironPickaxe===true;state.ironSword=saved.ironSword===true;state.steelSword=saved.steelSword===true;state.ironHelmet=saved.ironHelmet===true;state.ironChestplate=saved.ironChestplate===true;state.steelHelmet=saved.steelHelmet===true;state.steelChestplate=saved.steelChestplate===true;state.steelAxe=saved.steelAxe===true;state.steelPickaxe=saved.steelPickaxe===true;state.steelShield=saved.steelShield===true;state.steelShieldGuarding=saved.steelShieldGuarding===true&&state.steelShield;state.steelSpear=saved.steelSpear===true;
  if(saved.smithy&&Number.isFinite(saved.smithy.x)&&Number.isFinite(saved.smithy.z)&&Number.isFinite(saved.smithy.yaw))state.smithy=saved.smithy;
   if(saved.steelFurnace&&Number.isFinite(saved.steelFurnace.x)&&Number.isFinite(saved.steelFurnace.z)&&Number.isFinite(saved.steelFurnace.yaw)&&Number.isFinite(saved.steelFurnace.startedAt))state.steelFurnace=saved.steelFurnace;
  state.woolGarment=saved.woolGarment===true;
  if(saved.loom&&Number.isFinite(saved.loom.x)&&Number.isFinite(saved.loom.z)&&Number.isFinite(saved.loom.yaw))state.loom=saved.loom;
  if(saved.smokehouse&&Number.isFinite(saved.smokehouse.x)&&Number.isFinite(saved.smokehouse.z)&&Number.isFinite(saved.smokehouse.yaw))state.smokehouse=saved.smokehouse;
  if(saved.herbalistHut&&Number.isFinite(saved.herbalistHut.x)&&Number.isFinite(saved.herbalistHut.z)&&Number.isFinite(saved.herbalistHut.yaw))state.herbalistHut=saved.herbalistHut;
  if(saved.tannery&&Number.isFinite(saved.tannery.x)&&Number.isFinite(saved.tannery.z)&&Number.isFinite(saved.tannery.yaw)&&Number.isFinite(saved.tannery.startedAt))state.tannery=saved.tannery;
  if(Array.isArray(saved.herbBeds))state.herbBeds=saved.herbBeds.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)&&Number.isFinite(v.plantedAt)).slice(0,6);
  if(Array.isArray(saved.collectedResources))state.collectedResources=saved.collectedResources.filter(v=>typeof v==="string");
  if(Array.isArray(saved.huntedAnimals))state.huntedAnimals=saved.huntedAnimals.filter(v=>typeof v==="string");
   if(Array.isArray(saved.huntedWolves))state.huntedWolves=saved.huntedWolves.filter(v=>typeof v==="string").slice(0,12);
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
  if(Array.isArray(saved.sheepPens))state.sheepPens=saved.sheepPens.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,3).map(v=>({...v,lastWoolAt:Number.isFinite(v.lastWoolAt)?v.lastWoolAt:Date.now()}));
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
 try{localStorage.setItem("cronicas-floresta-save",JSON.stringify({x:player.position.x,z:player.position.z,health:state.health,hunger:state.hunger,thirst:state.thirst,temperature:state.temperature,energy:state.energy,wood:state.wood,stone:state.stone,ironOre:state.ironOre,coal:state.coal,ironIngots:state.ironIngots,steelIngots:state.steelIngots,steelSword:state.steelSword,steelHelmet:state.steelHelmet,steelChestplate:state.steelChestplate,steelAxe:state.steelAxe,steelPickaxe:state.steelPickaxe,steelShield:state.steelShield,steelShieldGuarding:state.steelShieldGuarding,steelSpear:state.steelSpear,steelFurnace:state.steelFurnace,axe:state.axe,pickaxe:state.pickaxe,day:state.day,timeOfDay:state.timeOfDay,campfire:state.campfire,campfireX:state.campfireX,campfireZ:state.campfireZ,shelter:state.shelter,shelterX:state.shelterX,shelterZ:state.shelterZ,bed:state.bed,bedX:state.bedX,bedZ:state.bedZ,storageChest:state.storageChest,storageChestX:state.storageChestX,storageChestZ:state.storageChestZ,storage:state.storage,waterSkin:state.waterSkin,waterCharges:state.waterCharges,bow:state.bow,arrows:state.arrows,collectedResources:state.collectedResources,berries:state.berries,herbs:state.herbs,herbBeds:state.herbBeds,fiber:state.fiber,coldCloak:state.coldCloak,leatherBoots:state.leatherBoots,leatherArmor:state.leatherArmor,reinforcedAxe:state.reinforcedAxe,reinforcedPickaxe:state.reinforcedPickaxe,ironAxe:state.ironAxe,ironPickaxe:state.ironPickaxe,ironSword:state.ironSword,ironHelmet:state.ironHelmet,ironChestplate:state.ironChestplate,smithy:state.smithy,meat:state.meat,cookedMeat:state.cookedMeat,smokedMeat:state.smokedMeat,smokehouse:state.smokehouse,healingSalve:state.healingSalve,herbalistHut:state.herbalistHut,leather:state.leather,tannery:state.tannery,hide:state.hide,bandages:state.bandages,huntedAnimals:state.huntedAnimals,huntedWolves:state.huntedWolves,fenceSections:state.fenceSections,gates:state.gates,floorTiles:state.floorTiles,wallPanels:state.wallPanels,windowPanels:state.windowPanels,roofTiles:state.roofTiles,gablePanels:state.gablePanels,ridgeCaps:state.ridgeCaps,chimneys:state.chimneys,pathTiles:state.pathTiles,lanternPosts:state.lanternPosts,wells:state.wells,gardenPlots:state.gardenPlots,watchtowers:state.watchtowers,marketStalls:state.marketStalls,coins:state.coins,chickenCoops:state.chickenCoops,apiaries:state.apiaries,honey:state.honey,sheepPens:state.sheepPens,wool:state.wool,loom:state.loom,woolGarment:state.woolGarment,doorPanels:state.doorPanels,windowShutters:state.windowShutters,starterKitGranted:state.starterKitGranted}));}
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
if(state.woolGarment)createWoolGarmentVisual();
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
  const deerTarget=nearestWildAnimal(16);
  // Wolves are threats before they enter pursuit range; surface them up to 24m.
  const wolfTarget=nearestWolf(24);
  const huntTarget=wolfTarget||deerTarget;
  const huntStatus=$("huntTargetStatus");
  if(huntTarget){
   const dx=huntTarget.x-player.position.x,dz=huntTarget.z-player.position.z;
   const distance=Math.hypot(dx,dz).toFixed(1);
   const angle=Math.atan2(dx,dz)-state.cameraYaw;
   const relative=Math.atan2(Math.sin(angle),Math.cos(angle));
   const directions=["à frente","à frente e à direita","à direita","atrás e à direita","atrás","atrás e à esquerda","à esquerda","à frente e à esquerda"];
   const direction=directions[Math.round(relative/(Math.PI/4)+8)%8];
   const isWolf=huntTarget.id.startsWith("wolf-");
   const meters=Math.hypot(dx,dz);
   const wolfAlert=isWolf&&meters<14;
   const wolfAttacking=isWolf&&huntTarget.attackWindup>0;
   huntStatus.textContent=(wolfAttacking?"🚨 LOBO PREPARANDO O BOTE: ":wolfAlert?"🚨 LOBO PERSEGUINDO: ":isWolf?"⚠ LOBO PRÓXIMO: ":"Veado: ")+distance+" m · "+direction+" · Vida "+huntTarget.health+"/"+(isWolf?3:2);
   huntStatus.style.color=isWolf?(wolfAttacking||wolfAlert?"#ff3b30":"#e58b35"):"";
   huntStatus.style.fontWeight=isWolf?"800":"";
  }else{
   huntStatus.textContent="Caça: nenhum animal próximo (lobos até 24 m)";
   huntStatus.style.color="";
   huntStatus.style.fontWeight="";
  }
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
  $("sheepPenStatus").textContent="Apriscos: "+state.sheepPens.length+"/3 · Lã: "+state.wool;
  $("herbGardenStatus").textContent="Canteiros medicinais: "+state.herbBeds.length+"/6 · Ervas: "+state.herbs;
  $("craftHerbBed").disabled=state.herbBeds.length>=6||state.wood<3||state.fiber<2;
  $("herbGardenAction").hidden=state.nearHerbBedIndex<0;
  if(state.nearHerbBedIndex>=0){const bed=state.herbBeds[state.nearHerbBedIndex],ready=bed.plantedAt>0&&Date.now()-bed.plantedAt>=90000;$("herbGardenAction").textContent=ready?"COLHER ERVAS (+4)":bed.plantedAt>0?"ERVAS CRESCENDO":"PLANTAR 2 FRUTAS";$("herbGardenAction").disabled=!ready&&(bed.plantedAt>0||state.berries<2);}
  $("tanneryStatus").textContent=state.tannery?"Curtume construído · Couro curtido: "+state.leather+(state.tannery.startedAt>0?" · Curtimento em andamento":""):"Curtume comunitário: não construído";
  $("craftTannery").disabled=!!state.tannery||state.wood<10||state.stone<5;
  $("startTanning").hidden=!state.nearTannery;
  $("startTanning").disabled=!state.nearTannery||state.tannery?.startedAt>0||state.hide<1;
  $("collectLeather").hidden=!state.nearTannery;
  $("collectLeather").disabled=!state.nearTannery||!(state.tannery?.startedAt>0&&Date.now()-state.tannery.startedAt>=120000);
  $("smithyStatus").textContent=state.smithy?"Forja comunitária construída · "+(state.reinforcedAxe?"Machado reforçado":"Machado comum")+" · "+(state.reinforcedPickaxe?"Picareta reforçada":"Picareta comum"):"Forja comunitária: não construída";
  $("metalStatus").textContent="Minério: "+state.ironOre+" · Carvão: "+state.coal+" · Lingotes: "+state.ironIngots+" · Espada: "+(state.ironSword?"fabricada":"não fabricada")+" · Capacete: "+(state.ironHelmet?"fabricado":"não fabricado")+" · Couraça: "+(state.ironChestplate?"fabricada":"não fabricada")+" · Machado de ferro: "+(state.ironAxe?"sim":"não")+" · Picareta de ferro: "+(state.ironPickaxe?"sim":"não");
   $("steelStatus").textContent="Alto-forno: "+(state.steelFurnace?"construído":"não construído")+" · Aço: "+state.steelIngots+" lingotes"+(state.steelSword?" · Espada de aço":"")+(state.steelHelmet?" · Capacete de aço":"")+(state.steelChestplate?" · Couraça de aço":"")+(state.steelAxe?" · Machado de aço":"")+(state.steelPickaxe?" · Picareta de aço":"");
  $("craftIronHelmet").hidden=!state.nearSmithy;
  $("craftIronHelmet").disabled=!state.nearSmithy||state.ironHelmet||state.ironIngots<4||state.leather<2;
  $("craftIronChestplate").hidden=!state.nearSmithy;
  $("craftIronChestplate").disabled=!state.nearSmithy||state.ironChestplate||state.ironIngots<6||state.leather<4;
  $("craftIronAxe").hidden=!state.nearSmithy;
  $("craftIronAxe").disabled=!state.nearSmithy||!state.reinforcedAxe||state.ironAxe||state.ironIngots<3||state.leather<2;
  $("craftIronPickaxe").hidden=!state.nearSmithy;
  $("craftIronPickaxe").disabled=!state.nearSmithy||!state.reinforcedPickaxe||state.ironPickaxe||state.ironIngots<3||state.leather<2;
   $("buildSteelFurnace").hidden=!state.nearSmithy;
   $("buildSteelFurnace").disabled=!state.nearSmithy||!!state.steelFurnace||state.stone<8||state.wood<5||state.ironIngots<2;
   $("startSteelSmelt").hidden=!state.nearSmithy||!state.steelFurnace;
   $("startSteelSmelt").disabled=!state.nearSmithy||!state.steelFurnace||state.steelFurnace.startedAt>0||state.ironIngots<2||state.coal<2||state.wood<1;
   $("collectSteel").hidden=!state.nearSmithy||!state.steelFurnace||!(state.steelFurnace.startedAt>0);
   $("collectSteel").disabled=!state.nearSmithy||!state.steelFurnace||state.steelFurnace.startedAt<=0||Date.now()-state.steelFurnace.startedAt<120000;
   $("craftSteelSword").hidden=!state.nearSmithy;
   $("craftSteelSword").disabled=!state.nearSmithy||!state.ironSword||state.steelSword||state.steelIngots<4||state.leather<2;
   $("craftSteelHelmet").hidden=!state.nearSmithy;
   $("craftSteelHelmet").disabled=!state.nearSmithy||!state.ironHelmet||state.steelHelmet||state.steelIngots<5||state.leather<2;
   $("craftSteelChestplate").hidden=!state.nearSmithy;
   $("craftSteelChestplate").disabled=!state.nearSmithy||!state.ironChestplate||state.steelChestplate||state.steelIngots<8||state.leather<4;
   $("craftSteelAxe").hidden=!state.nearSmithy;
   $("craftSteelAxe").disabled=!state.nearSmithy||!state.ironAxe||state.steelAxe||state.steelIngots<4||state.leather<3;
   $("craftSteelPickaxe").hidden=!state.nearSmithy;
   $("craftSteelPickaxe").disabled=!state.nearSmithy||!state.ironPickaxe||state.steelPickaxe||state.steelIngots<4||state.leather<3;
    $("craftSteelShield").hidden=!state.nearSmithy;
    $("craftSteelShield").disabled=!state.nearSmithy||state.steelShield||state.steelIngots<5||state.leather<3;
    $("craftSteelSpear").hidden=!state.nearSmithy;
    $("craftSteelSpear").disabled=!state.nearSmithy||state.steelSpear||state.steelIngots<3||state.wood<2||state.leather<1;
   $("steelStatus").textContent="Alto-forno: "+(state.steelFurnace?"construído":"não construído")+" · Aço: "+state.steelIngots+" lingotes"+(state.steelSword?" · Espada de aço equipada":"")+(state.steelShield?" · Escudo de aço equipado":"")+(state.steelSpear?" · Lança de aço":"");
   $("guardShieldBtn").hidden=!state.steelShield;
   $("guardShieldBtn").textContent=state.steelShieldGuarding?"🛡️ BAIXAR ESCUDO":"🛡️ ERGUER ESCUDO";
  $("craftIronSword").hidden=!state.nearSmithy;
  $("craftIronSword").disabled=!state.nearSmithy||state.ironSword||state.ironIngots<3||state.wood<2||state.leather<1;
  $("smeltIron").hidden=!state.nearSmithy;
  $("smeltIron").disabled=!state.nearSmithy||state.ironOre<2||state.coal<1||state.wood<1;
  $("craftSmithy").disabled=!!state.smithy||state.wood<8||state.stone<12;
  $("upgradeAxe").hidden=!state.nearSmithy;
  $("upgradeAxe").disabled=!state.nearSmithy||!state.axe||state.reinforcedAxe||state.wood<4||state.stone<6||state.leather<2;
  $("upgradePickaxe").hidden=!state.nearSmithy;
  $("upgradePickaxe").disabled=!state.nearSmithy||!state.pickaxe||state.reinforcedPickaxe||state.wood<4||state.stone<8||state.leather<2;
  $("leatherArmorStatus").textContent=state.leatherArmor?"Armadura de couro: equipada · proteção contra danos +35%":"Armadura de couro: não fabricada";
  $("craftLeatherArmor").hidden=!state.nearTannery;
  $("craftLeatherArmor").disabled=!state.nearTannery||state.leatherArmor||state.leather<4||state.fiber<3;
  $("herbalistStatus").textContent=state.herbalistHut?"Cabana do herbalista construída · Bálsamos: "+state.healingSalve:"Cabana do herbalista: não construída";
  $("craftHerbalistHut").disabled=!!state.herbalistHut||state.wood<8||state.stone<4;
  $("craftSalve").hidden=!state.nearHerbalist;
  $("craftSalve").disabled=!state.nearHerbalist||state.herbs<2||state.fiber<1;
  $("useSalve").disabled=state.healingSalve<1||state.health>=100;
  $("smokehouseStatus").textContent=state.smokehouse?"Defumador construído · Carne defumada: "+state.smokedMeat:"Defumador comunitário: não construído";
  $("craftSmokehouse").disabled=!!state.smokehouse||state.wood<10||state.stone<4;
  $("smokeMeat").hidden=!state.nearSmokehouse;
  $("smokeMeat").disabled=!state.nearSmokehouse||state.meat<1||state.wood<1;
  $("eatSmokedMeat").disabled=state.smokedMeat<1||state.hunger>=100;
  $("loomStatus").textContent=state.loom?"Tearia construída · "+(state.woolGarment?"Roupa de lã fabricada":"Roupa de lã pendente"):"Oficina de tecelagem: não construída";
  $("craftLoom").disabled=!!state.loom||state.wood<8||state.fiber<4;
  $("craftWoolGarment").hidden=!state.nearLoom;
  $("craftWoolGarment").disabled=!state.nearLoom||state.woolGarment||state.wool<3||state.fiber<2;
  $("craftWoolGarment").textContent=state.woolGarment?"ROUPA DE LÃ FABRICADA":"FABRICAR ROUPA DE LÃ · 3 LÃ + 2 FIBRAS";
  $("craftSheepPen").disabled=state.wood<12||state.fiber<5||state.sheepPens.length>=3;
  $("collectWool").hidden=state.nearSheepPenIndex<0;
  $("collectWool").disabled=state.nearSheepPenIndex<0||!state.sheepPens[state.nearSheepPenIndex]||Math.floor((Date.now()-state.sheepPens[state.nearSheepPenIndex].lastWoolAt)/300000)<1;
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
  $("sellWool").disabled=!marketNear||state.wool<1;
  $("buyWood").disabled=!marketNear||state.coins<12;
  $("buyStone").disabled=!marketNear||state.coins<15;
  $("buyFiber").disabled=!marketNear||state.coins<10;
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
 const carried=["wood","stone","ironOre","coal","ironIngots","steelIngots","fiber","berries","herbs","meat","cookedMeat","smokedMeat","healingSalve","hide","leather","bandages"].some(k=>state[k]>0);
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
 $("hint").textContent=nearbyAnimal?"Veado por perto. Aproxime-se e toque em ATACAR.":state.near?(state.near.type==="water"?"Fonte de água encontrada. Toque em BEBER ÁGUA.":["stone","ironOre","coal"].includes(state.near.type)?"Use a picareta para minerar.":state.near.type==="wood"?"Use o machado para cortar madeira.":state.near.type==="branch"?"Galho encontrado. Toque em COLETAR.":state.near.type==="berries"?"Frutas silvestres encontradas. Toque em COLETAR.":state.near.type==="fiber"?"Planta fibrosa encontrada. Toque em COLETAR.":state.near.type==="mushroom"?"Cogumelo medicinal encontrado. Toque em COLETAR.":"Pedra solta encontrada. Toque em COLETAR."):"Procure recursos, cogumelos e arbustos de frutas pela floresta.";
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
 if(["stone","ironOre","coal"].includes(resource.type)&&!state.pickaxe){toast("Você precisa fabricar uma picareta.");return;}
 if(resource.type==="branch"){state.wood+=1;toast("Você recolheu 1 galho.");}
 else if(resource.type==="berries"){state.berries+=3;toast("Você recolheu 3 frutas silvestres.");}
 else if(resource.type==="fiber"){state.fiber+=2;toast("Você recolheu fibras vegetais.");}
 else if(resource.type==="mushroom"){state.herbs+=1;toast("Cogumelo medicinal coletado: +1 erva.");}
 else if(resource.type==="carcass"){const wolfCarcass=!!(resource.animalId&&resource.animalId.startsWith("wolf-"));state.meat+=2;state.hide+=wolfCarcass?2:1;if(resource.animalId&&resource.animalId.startsWith("deer-")){const deerId=resource.animalId;state.huntedAnimals=state.huntedAnimals.filter(v=>v!==deerId);const deerIndex=Number(deerId.slice(5));const deerX=resource.x,deerZ=resource.z;setTimeout(()=>{if(!wildAnimals.some(a=>a.id===deerId&&a.alive)){createDeer(deerX,deerZ,deerIndex);updateHUD();saveGame();}},45000);}toast(wolfCarcass?"Você aproveitou a carcaça do lobo: 2 carnes e 2 peles.":"Você recolheu 2 carnes e 1 pele. Um novo veado poderá voltar à floresta.");}
 else if(resource.type==="looseStone"){state.stone+=1;toast("Você recolheu 1 pedra solta.");}
 else if(resource.type==="stone"){const amount=state.steelPickaxe?9:state.ironPickaxe?6:state.reinforcedPickaxe?4:2;state.stone+=amount;toast("Você minerou "+amount+" pedras.");}
 else if(resource.type==="ironOre"){const amount=state.steelPickaxe?3:state.ironPickaxe?2:1;state.ironOre+=amount;toast("Você extraiu "+amount+" minério(s) de ferro.");}
 else if(resource.type==="coal"){const amount=state.steelPickaxe?4:state.ironPickaxe?3:2;state.coal+=amount;toast("Você extraiu "+amount+" carvões.");}
 else{const amount=state.steelAxe?10:state.ironAxe?7:state.reinforcedAxe?5:3;state.wood+=amount;toast("Você cortou e recolheu "+amount+" madeiras.");}
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

const craftSections=[
 {title:"SOBREVIVÊNCIA",match:/^(berryStatus|eatBerry|meatStatus|cookMeat|eatMeat|eatCookedMeat|campfireStatus|craftCampfire|shelterStatus|craftShelter|bedStatus|craftBed|drinkWell|wellStatus|craftWell|waterSkinStatus|craftWaterSkin|fillWaterSkin|drinkWaterSkin)$/},
 {title:"FERRAMENTAS E CAÇA",match:/^(axeStatus|craftAxe|pickaxeStatus|craftPickaxe|bowStatus|huntTargetStatus|craftBow|craftArrows|bandageStatus|craftBandage|useBandage)$/},
 {title:"CONSTRUÇÕES E ASSENTAMENTO",match:/^(fenceStatus|craftFence|floorTileStatus|craftFloorTile|pathTileStatus|craftPathTile|lanternPostStatus|craftLanternPost|gardenStatus|craftGarden|gardenAction|watchtowerStatus|craftWatchtower|wallPanelStatus|craftWallPanel|windowPanelStatus|craftWindowPanel|roofTileStatus|craftRoofTile|gableStatus|craftGable|ridgeCapStatus|craftRidgeCap|chimneyStatus|craftChimney|doorPanelStatus|craftDoorPanel|shutterStatus|craftShutters|gateStatus|craftGate)$/},
 {title:"ANIMAIS E CRIAÇÃO",match:/^(coopStatus|craftCoop|collectEggs|eatEgg|apiaryStatus|craftApiary|collectHoney|eatHoney|sheepPenStatus|craftSheepPen|collectWool)$/},
 {title:"OFÍCIOS E PRODUÇÃO",match:/^(loomStatus|smokehouseStatus|craftSmokehouse|smokeMeat|eatSmokedMeat|craftLoom|craftWoolGarment|tanneryStatus|craftTannery|startTanning|collectLeather|smithyStatus|metalStatus|smeltIron|steelStatus|buildSteelFurnace|startSteelSmelt|collectSteel|craftSmithy|upgradeAxe|upgradePickaxe|herbalistStatus|herbGardenStatus|craftHerbBed|herbGardenAction|craftHerbalistHut|craftSalve)$/},
 {title:"FEIRA E COMÉRCIO",match:/^(marketStatus|craftMarket|marketActions)$/},
 {title:"EQUIPAMENTOS E MEDICINA",match:/^(cloakStatus|craftCloak|bootsStatus|craftBoots|useSalve|leatherArmorStatus|craftLeatherArmor|craftIronSword|craftIronHelmet|craftIronChestplate|craftIronAxe|craftIronPickaxe|craftSteelSword|craftSteelHelmet|craftSteelChestplate|craftSteelAxe|craftSteelPickaxe|craftSteelShield|craftSteelSpear)$/},
 {title:"ARMAZENAMENTO",match:/^(storageChestStatus|craftStorageChest|storageStatus|storeResources|takeResources)$/}
];
const originalCraftChildren=[...craftPanel.children];
const craftBuckets=craftSections.map(section=>({section,nodes:[]}));
const craftOther=[];
for(const node of originalCraftChildren){
 const id=node.id||"";
 const bucket=craftBuckets.find(item=>item.section.match.test(id));
 (bucket?bucket.nodes:craftOther).push(node);
}
for(const bucket of craftBuckets){
 if(!bucket.nodes.length)continue;
 const details=document.createElement("details");
 details.className="craft-category";
 details.open=bucket.section.title==="SOBREVIVÊNCIA";
 const summary=document.createElement("summary");
 summary.textContent=bucket.section.title+" · "+bucket.nodes.filter(n=>n.tagName==="BUTTON").length+" opções";
 details.append(summary,...bucket.nodes);
 craftPanel.appendChild(details);
}
if(craftOther.length){
 const details=document.createElement("details");details.className="craft-category";
 const summary=document.createElement("summary");summary.textContent="OUTROS";
 details.append(summary,...craftOther);craftPanel.appendChild(details);
}

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
function resetBuiltStructures(){
 if(!confirm("Apagar todas as construções deste mundo? Seus recursos, itens, ferramentas, equipamentos, animais, progresso e posição serão preservados."))return;
 const resetArrays=["fenceSections","gates","floorTiles","wallPanels","windowPanels","roofTiles","gablePanels","ridgeCaps","chimneys","pathTiles","lanternPosts","wells","gardenPlots","herbBeds","watchtowers","marketStalls","chickenCoops","apiaries","sheepPens","doorPanels","windowShutters"];
 const resetObjects=["smithy","steelFurnace","loom","smokehouse","herbalistHut","tannery"];
 const resetFlags=["campfire","shelter","bed","storageChest"];
 const resetPositions=["campfireX","campfireZ","shelterX","shelterZ","bedX","bedZ","storageChestX","storageChestZ"];
 try{
  for(const key of resetArrays)state[key]=[];
  for(const key of resetObjects)state[key]=null;
  for(const key of resetFlags)state[key]=false;
  for(const key of resetPositions)state[key]=null;
  saveGame();
  const check=JSON.parse(localStorage.getItem("cronicas-floresta-save")||"null");
  if(!check||resetArrays.some(key=>!Array.isArray(check[key])||check[key].length!==0)||resetObjects.some(key=>check[key]!=null)||resetFlags.some(key=>check[key]!==false)){
   throw new Error("O salvamento não confirmou a remoção das construções.");
  }
  toast("Construções removidas! Recarregando o mundo...");
  setTimeout(()=>location.reload(),350);
 }catch(error){
  console.error("Falha ao resetar construções:",error);
  toast("Não foi possível resetar. Seu progresso foi preservado.");
 }
}
exportBackupButton.addEventListener("click",downloadSaveBackup);
importBackupButton.addEventListener("click",()=>backupFileInput.click());
backupFileInput.addEventListener("change",()=>{const file=backupFileInput.files?.[0];restoreSaveBackup(file);backupFileInput.value="";});

craftToggle.addEventListener("click",()=>{const open=craftPanel.classList.toggle("open");craftToggle.textContent=open?"FECHAR OFICINA":"FABRICAR";});
$("resetBuiltStructures").addEventListener("click",resetBuiltStructures);
$("craftAxe").addEventListener("click",()=>craftTool("axe"));
$("craftPickaxe").addEventListener("click",()=>craftTool("pickaxe"));
$("craftStorageChest").addEventListener("click",craftStorageChest);
 $("craftFence").addEventListener("click",()=>beginBuildPlacement("fence"));
 $("craftFloorTile").addEventListener("click",()=>beginBuildPlacement("floor"));
 $("craftWallPanel").addEventListener("click",()=>beginBuildPlacement("wall"));
 $("craftWindowPanel").addEventListener("click",()=>beginBuildPlacement("window"));
 $("craftDoorPanel")?.addEventListener("click",()=>beginBuildPlacement("door"));
 $("craftRoofTile").addEventListener("click",()=>beginBuildPlacement("roof"));
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
 $("craftSheepPen").addEventListener("click",craftSheepPen);
 $("craftLoom").addEventListener("click",craftLoom);
 $("craftSmokehouse").addEventListener("click",craftSmokehouse);
 $("craftHerbalistHut").addEventListener("click",craftHerbalistHut);
 $("craftHerbBed").addEventListener("click",craftHerbBed);
 $("herbGardenAction").addEventListener("click",herbGardenAction);
 $("craftSalve").addEventListener("click",craftSalve);
 $("useSalve").addEventListener("click",useSalve);
 $("smokeMeat").addEventListener("click",smokeMeat);
 $("eatSmokedMeat").addEventListener("click",eatSmokedMeat);
 $("craftWoolGarment").addEventListener("click",craftWoolGarment);
 $("collectWool").addEventListener("click",collectWool);
 $("collectHoney").addEventListener("click",collectHoney);
 $("eatHoney").addEventListener("click",eatHoney);
 $("sellBerries").addEventListener("click",()=>sellMarketGoods("berries"));
 $("sellMeat").addEventListener("click",()=>sellMarketGoods("meat"));
 $("sellHide").addEventListener("click",()=>sellMarketGoods("hide"));
 $("sellEgg").addEventListener("click",()=>sellMarketGoods("egg"));
 $("sellHoney").addEventListener("click",()=>sellMarketGoods("honey"));
 $("sellWool").addEventListener("click",()=>sellMarketGoods("wool"));
 $("sellSalve").addEventListener("click",()=>sellMarketGoods("salve"));
 $("sellLeather").addEventListener("click",()=>sellMarketGoods("leather"));
 $("craftTannery").addEventListener("click",craftTannery);
 $("startTanning").addEventListener("click",startTanning);
 $("collectLeather").addEventListener("click",collectLeather);
 $("craftLeatherArmor").addEventListener("click",craftLeatherArmor);
 $("craftSmithy").addEventListener("click",craftSmithy);
 $("smeltIron").addEventListener("click",smeltIron);
 $("craftIronSword").addEventListener("click",craftIronSword);
 $("craftIronHelmet").addEventListener("click",craftIronHelmet);
 $("craftIronChestplate").addEventListener("click",craftIronChestplate);
 $("craftIronAxe").addEventListener("click",()=>craftIronTool("axe"));
 $("craftIronPickaxe").addEventListener("click",()=>craftIronTool("pickaxe"));
 $("buildSteelFurnace").addEventListener("click",buildSteelFurnace);
 $("startSteelSmelt").addEventListener("click",startSteelSmelt);
 $("collectSteel").addEventListener("click",collectSteel);
 $("craftSteelSword").addEventListener("click",craftSteelSword);
  $("craftSteelHelmet").addEventListener("click",craftSteelHelmet);
  $("craftSteelChestplate").addEventListener("click",craftSteelChestplate);
  $("craftSteelAxe").addEventListener("click",()=>craftSteelTool("axe"));
  $("craftSteelPickaxe").addEventListener("click",()=>craftSteelTool("pickaxe"));
  $("craftSteelShield").addEventListener("click",craftSteelShield);
  $("craftSteelSpear").addEventListener("click",craftSteelSpear);
 $("upgradeAxe").addEventListener("click",()=>upgradeTool("axe"));
 $("upgradePickaxe").addEventListener("click",()=>upgradeTool("pickaxe"));
 $("buyWood").addEventListener("click",()=>buyMarketSupplies("wood"));
 $("buyStone").addEventListener("click",()=>buyMarketSupplies("stone"));
 $("buyFiber").addEventListener("click",()=>buyMarketSupplies("fiber"));
 $("gardenAction").addEventListener("click",gardenAction);
 $("drinkWell").addEventListener("click",drinkFromWell);
 $("craftDoorPanel").addEventListener("click",()=>beginBuildPlacement("door"));
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
  const candidate={x,z,yaw};
  if(state.pathTiles.some(tile=>buildPathTilesOverlap(candidate,tile))){
   toast("Os trechos de caminho ficariam sobrepostos. Ajuste sua posição para encaixar o próximo trecho.");return;
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
 function craftSheepPen(){
  if(state.sheepPens.length>=3){toast("Limite de 3 apriscos atingido.");return;}
  if(state.wood<12||state.fiber<5){toast("Faltam materiais: 12 madeiras e 5 fibras.");return;}
  const yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2);
  const x=Math.round((player.position.x+Math.sin(yaw)*7)/3)*3;
  const z=Math.round((player.position.z+Math.cos(yaw)*7)/3)*3;
  if(state.sheepPens.some(v=>Math.hypot(v.x-x,v.z-z)<7)){toast("Já existe um aprisco muito próximo. Escolha outro local.");return;}
  const pen={x,z,yaw,lastWoolAt:Date.now()};
  state.wood-=12;state.fiber-=5;state.sheepPens.push(pen);createSheepPen(pen);
  updateHUD();saveGame();toast("Aprisco construído! As ovelhas começarão a produzir lã.");
 }
 function createSheepPen(pen){
  const group=new THREE.Group();
  const woodMat=new THREE.MeshStandardMaterial({color:0x684326,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x392a20,roughness:1});
  const woolMat=new THREE.MeshStandardMaterial({color:0xe6dfc9,roughness:1});
  const faceMat=new THREE.MeshStandardMaterial({color:0x59483a,roughness:1});
  const grassMat=new THREE.MeshStandardMaterial({color:0x6b7940,roughness:1});
  const railGeo=new THREE.BoxGeometry(4.8,.13,.14);
  // Cerca retangular com postes e três travessas.
  for(const side of [-1,1]){
   for(const z of [-2.2,2.2]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.18,1.25,.18),dark);
    post.position.set(side*2.45,.62,z);group.add(post);
   }
   for(let level=0;level<3;level++){
    const rail=new THREE.Mesh(railGeo,woodMat);rail.position.set(0,.35+level*.34,side*2.2);group.add(rail);
    const cross=new THREE.Mesh(new THREE.BoxGeometry(.14,.13,4.4),woodMat);cross.position.set(side*2.4,.35+level*.34,0);group.add(cross);
   }
  }
  // Abrigo simples para as ovelhas.
  const shelter=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.45,1.5),woodMat);shelter.position.set(-1.35,.75,-.85);group.add(shelter);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(1.35,.75,4),dark);roof.rotation.y=Math.PI/4;roof.position.set(-1.35,1.82,-.85);group.add(roof);
  const straw=new THREE.Mesh(new THREE.BoxGeometry(1.55,.08,1.2),grassMat);straw.position.set(-1.35,.12,-.85);group.add(straw);
  // Três ovelhas com corpo lanoso, focinho, orelhas e patas.
  for(let i=0;i<3;i++){
   const x=.45+(i%2)*.9,z=-.8+Math.floor(i/2)*1.45;
   const body=new THREE.Mesh(new THREE.SphereGeometry(.53,12,9),woolMat);body.scale.set(1.18,1, .86);body.position.set(x,.83,z);group.add(body);
   for(let puff=0;puff<7;puff++){
    const a=puff*Math.PI*2/7;
    const fleece=new THREE.Mesh(new THREE.SphereGeometry(.22,8,7),woolMat);
    fleece.position.set(x+Math.cos(a)*.38,1.02,z+Math.sin(a)*.32);group.add(fleece);
   }
   const head=new THREE.Mesh(new THREE.SphereGeometry(.25,10,8),faceMat);head.position.set(x+.52,.9,z+.08);group.add(head);
   const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),woolMat);muzzle.position.set(x+.7,.82,z+.08);group.add(muzzle);
   for(const legX of [-.3,.3])for(const legZ of [-.22,.22]){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,.38,6),dark);leg.position.set(x+legX,.27,z+legZ);group.add(leg);
   }
   for(const earSide of [-1,1]){
    const ear=new THREE.Mesh(new THREE.BoxGeometry(.2,.07,.11),faceMat);ear.position.set(x+.47,.98,z+earSide*.23);ear.rotation.x=earSide*.25;group.add(ear);
   }
  }
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  group.position.set(pen.x,terrainHeight(pen.x,pen.z),pen.z);group.rotation.y=pen.yaw;scene.add(group);return group;
 }
 function collectWool(){
  const pen=state.sheepPens[state.nearSheepPenIndex];
  if(!pen){toast("Aproxime-se de um aprisco.");return;}
  const produced=Math.min(3,Math.floor(Math.max(0,Date.now()-pen.lastWoolAt)/300000));
  if(produced<1){toast("As ovelhas ainda estão produzindo lã. Aguarde um pouco.");return;}
  state.wool+=produced;pen.lastWoolAt+=produced*300000;
  updateHUD();saveGame();toast("Você recolheu "+produced+" porção(ões) de lã!");
 }
 function craftSmokehouse(){
  if(state.smokehouse){toast("O defumador já foi construído.");return;}
  if(state.wood<10||state.stone<4){toast("Faltam materiais: 10 madeiras e 4 pedras.");return;}
  const yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2);
  const x=Math.round((player.position.x+Math.sin(yaw)*6)/3)*3;
  const z=Math.round((player.position.z+Math.cos(yaw)*6)/3)*3;
  state.wood-=10;state.stone-=4;state.smokehouse={x,z,yaw};createSmokehouse(state.smokehouse);
  updateHUD();saveGame();toast("Defumador comunitário construído! Aproxime-se para conservar a carne.");
 }
 function createSmokehouse(data){
  const group=new THREE.Group();
  const timber=new THREE.MeshStandardMaterial({color:0x684326,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x39291e,roughness:1});
  const stone=new THREE.MeshStandardMaterial({color:0x77766d,roughness:1});
  const roofMat=new THREE.MeshStandardMaterial({color:0x51402e,roughness:1});
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.5,1.8,2.2),timber);body.position.set(0,.95,0);group.add(body);
  const door=new THREE.Mesh(new THREE.BoxGeometry(1.35,1.25,.12),dark);door.position.set(0,.72,1.12);group.add(door);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(1.9,.85,4),roofMat);roof.rotation.y=Math.PI/4;roof.position.y=2.25;group.add(roof);
  const chimney=new THREE.Mesh(new THREE.BoxGeometry(.42,.9,.42),stone);chimney.position.set(.72,2.25,-.35);group.add(chimney);
  const opening=new THREE.Mesh(new THREE.BoxGeometry(.22,.52,.44),new THREE.MeshStandardMaterial({color:0x171512,roughness:1}));opening.position.set(.72,2.12,-.35);group.add(opening);
  for(const y of [.62,1.05,1.48]){
   const rack=new THREE.Mesh(new THREE.BoxGeometry(1.55,.07,.12),dark);rack.position.set(0,y,.78);group.add(rack);
   for(let i=0;i<5;i++){const meat=new THREE.Mesh(new THREE.BoxGeometry(.16,.22,.09),new THREE.MeshStandardMaterial({color:0x874a35,roughness:1}));meat.position.set(-.62+i*.31,y-.15,.86);group.add(meat);}
  }
  for(const x of [-1.05,1.05])for(const z of [-.9,.9]){const post=new THREE.Mesh(new THREE.BoxGeometry(.13,2.05,.13),dark);post.position.set(x,1,z);group.add(post);}
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  group.position.set(data.x,terrainHeight(data.x,data.z),data.z);group.rotation.y=data.yaw;scene.add(group);state.smokehouseObject=group;
 }
 function smokeMeat(){
  if(!state.nearSmokehouse){toast("Aproxime-se do defumador comunitário.");return;}
  const portions=Math.min(state.meat,state.wood);
  if(portions<1){toast("Você precisa de carne crua e 1 madeira por porção.");return;}
  state.meat-=portions;state.wood-=portions;state.smokedMeat+=portions;
  updateHUD();saveGame();toast(portions+" porções de carne defumadas e conservadas!");
 }
 function eatSmokedMeat(){
  if(state.smokedMeat<1||state.hunger>=100){toast("Não há carne defumada para consumir ou sua fome já está satisfeita.");return;}
  state.smokedMeat--;state.hunger=Math.min(100,state.hunger+70);
  updateHUD();saveGame();toast("Você comeu carne defumada. +70 de fome.");
 }
 function craftLoom(){
  if(state.loom){toast("A oficina de tecelagem já foi construída.");return;}
  if(state.wood<8||state.fiber<4){toast("Faltam materiais: 8 madeiras e 4 fibras.");return;}
  const yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2);
  const x=Math.round((player.position.x+Math.sin(yaw)*6)/3)*3;
  const z=Math.round((player.position.z+Math.cos(yaw)*6)/3)*3;
  state.wood-=8;state.fiber-=4;state.loom={x,z,yaw};createLoom(state.loom);
  updateHUD();saveGame();toast("Oficina de tecelagem construída! Aproxime-se para fabricar roupas de lã.");
 }
 function createLoom(loom){
  const group=new THREE.Group();
  const wood=new THREE.MeshStandardMaterial({color:0x704827,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x3a281b,roughness:1});
  const thread=new THREE.MeshStandardMaterial({color:0xd8c9a5,roughness:1});
  // Estrutura vertical do tear, travessas e fios paralelos.
  for(const x of [-.85,.85]){
   const post=new THREE.Mesh(new THREE.BoxGeometry(.14,1.9,.14),dark);post.position.set(x,.95,0);group.add(post);
   for(const y of [.18,1.72]){
    const beam=new THREE.Mesh(new THREE.BoxGeometry(1.9,.14,.16),wood);beam.position.set(0,y,0);group.add(beam);
   }
  }
  for(let i=0;i<13;i++){
   const x=-.68+i*.113;
   const cord=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,1.35,5),thread);cord.position.set(x,.96,.09);group.add(cord);
  }
  const cloth=new THREE.Mesh(new THREE.PlaneGeometry(1.25,.72,8,8),new THREE.MeshStandardMaterial({color:0xb7a27a,side:THREE.DoubleSide,roughness:1}));
  cloth.position.set(0,1.03,.13);group.add(cloth);
  const feet=new THREE.Mesh(new THREE.BoxGeometry(2.05,.13,.9),wood);feet.position.set(0,.1,0);group.add(feet);
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  group.position.set(loom.x,terrainHeight(loom.x,loom.z),loom.z);group.rotation.y=loom.yaw;scene.add(group);state.loomObject=group;
 }
 function craftWoolGarment(){
  if(!state.loom||!state.nearLoom){toast("Aproxime-se da oficina de tecelagem.");return;}
  if(state.woolGarment){toast("Você já fabricou a roupa de lã.");return;}
  if(state.wool<3||state.fiber<2){toast("Faltam materiais: 3 lãs e 2 fibras.");return;}
  state.wool-=3;state.fiber-=2;state.woolGarment=true;createWoolGarmentVisual();
  updateHUD();saveGame();toast("Roupa de lã fabricada! Você agora perde menos calor.");
 }
 function createWoolGarmentVisual(){
  if(state.woolGarmentObject)player.remove(state.woolGarmentObject);
  const outfit=new THREE.Group();
  const woolMat=new THREE.MeshStandardMaterial({color:0x9b896b,roughness:1});
  const trim=new THREE.MeshStandardMaterial({color:0xd4c39b,roughness:1});
  const tunic=new THREE.Mesh(new THREE.CylinderGeometry(.39,.52,.78,9),woolMat);tunic.position.set(0,1.02,0);tunic.castShadow=true;outfit.add(tunic);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.25,.065,6,12),trim);collar.rotation.x=Math.PI/2;collar.position.set(0,1.43,.015);outfit.add(collar);
  for(const side of [-1,1]){
   const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,.52,7),woolMat);sleeve.rotation.z=side*.28;sleeve.position.set(side*.43,1.22,0);outfit.add(sleeve);
  }
  player.add(outfit);state.woolGarmentObject=outfit;
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
 function buyMarketSupplies(type){
  if(state.nearMarketIndex<0){toast("Aproxime-se de uma banca de feira para comprar materiais.");return;}
  const offers={
   wood:{amount:3,price:12,label:"3 madeiras"},
   stone:{amount:3,price:15,label:"3 pedras"},
   fiber:{amount:4,price:10,label:"4 fibras"}
  };
  const offer=offers[type];
  if(!offer)return;
  if(state.coins<offer.price){toast("Moedas insuficientes para esta compra.");return;}
  state.coins-=offer.price;state[type]+=offer.amount;
  updateHUD();saveGame();toast("Compra concluída: "+offer.label+" por "+offer.price+" moedas.");
 }
 function sellMarketGoods(type){
  if(state.nearMarketIndex<0){toast("Aproxime-se de uma banca de feira para negociar.");return;}
  let amount=0,price=0,label="";
  if(type==="berries"&&state.berries>=5){amount=5;price=10;state.berries-=amount;label="5 frutas silvestres";}
  else if(type==="meat"&&state.meat>=1){amount=1;price=7;state.meat-=amount;label="1 carne crua";}
  else if(type==="hide"&&state.hide>=1){amount=1;price=12;state.hide-=amount;label="1 couro";}
  else if(type==="egg"&&state.eggs>=1){amount=1;price=5;state.eggs-=amount;label="1 ovo fresco";}
  else if(type==="honey"&&state.honey>=1){amount=1;price=8;state.honey-=amount;label="1 pote de mel";}
  else if(type==="wool"&&state.wool>=1){amount=1;price=10;state.wool-=amount;label="1 porção de lã";}
  else if(type==="salve"&&state.healingSalve>=1){amount=1;price=9;state.healingSalve-=amount;label="1 bálsamo medicinal";}
  else if(type==="leather"&&state.leather>=1){amount=1;price=18;state.leather-=amount;label="1 couro curtido";}
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
 
let activeBuildPlacement=null;
let buildPreviewGroup=null,buildPreviewMesh=null,buildPreviewMaterial=null,buildPlacementUI=null,buildPlacementToggle=null;
function toggleBuildPlacementPanel(force){if(!activeBuildPlacement||!buildPlacementUI)return;const show=typeof force==="boolean"?force:buildPlacementUI.style.display==="none";buildPlacementUI.style.display=show?"flex":"none";if(buildPlacementToggle){buildPlacementToggle.textContent=show?"OCULTAR AJUSTES":"AJUSTAR POSIÇÃO";buildPlacementToggle.setAttribute("aria-label",show?"Ocultar controles de posicionamento":"Mostrar controles de posicionamento");}}
function buildPlacementMessage(msg){toast(msg);}
function ensureBuildPlacementUI(){
 if(buildPlacementUI)return;
 const panel=document.createElement("div");
 panel.id="buildPlacementUI";
 panel.style.cssText="position:fixed;left:auto;right:16px;top:calc(255px + env(safe-area-inset-top,0px));bottom:auto;transform:none;z-index:90;display:none;flex-direction:column;align-items:center;gap:8px;width:min(94vw,430px);max-height:60vh;overflow:auto;padding:10px;background:rgba(25,30,24,.96);border:1px solid rgba(230,220,190,.65);border-radius:14px;color:#fff;font:600 12px system-ui;box-shadow:0 4px 20px #000b;touch-action:manipulation;pointer-events:auto";
 const label=document.createElement("div");label.id="buildPlacementLabel";label.textContent="POSICIONAR CONSTRUÇÃO";label.style.cssText="font-size:13px;letter-spacing:.06em";
 const row=document.createElement("div");row.style.cssText="display:flex;gap:6px;width:100%;justify-content:center;flex-wrap:wrap";
 const make=(id,txt,action,primary=false)=>{const b=document.createElement("button");b.type="button";b.id=id;b.textContent=txt;b.style.cssText="min-height:40px;min-width:58px;padding:8px 12px;border:1px solid #c9b994;border-radius:9px;background:"+(primary?"#527b43":"#4a5046")+";color:white;font:700 12px system-ui;touch-action:manipulation";b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();action();});row.appendChild(b);return b;};
 const moveStep=()=>{if(!activeBuildPlacement)return 0;if(activeBuildPlacement.fineAdjust)return activeBuildPlacement.type==="fence"?.4:.5;return activeBuildPlacement.type==="fence"?1.6:3;};
 make("buildLeft","◀ MOVER",()=>{if(activeBuildPlacement){activeBuildPlacement.offsetX-=moveStep();updateBuildPreview();}});
 make("buildForward","▲ MOVER",()=>{if(activeBuildPlacement){activeBuildPlacement.offsetZ+=moveStep();updateBuildPreview();}});
 make("buildBack","▼ MOVER",()=>{if(activeBuildPlacement){activeBuildPlacement.offsetZ-=moveStep();updateBuildPreview();}});
 make("buildRight","MOVER ▶",()=>{if(activeBuildPlacement){activeBuildPlacement.offsetX+=moveStep();updateBuildPreview();}});
 make("buildRotate","GIRAR 90°",()=>{if(activeBuildPlacement){activeBuildPlacement.rotationStep=(activeBuildPlacement.rotationStep+1)%4;updateBuildPreview();}});
 const fineButton=make("buildFineAdjust","AJUSTE FINO: OFF",()=>{if(activeBuildPlacement){activeBuildPlacement.fineAdjust=!activeBuildPlacement.fineAdjust;fineButton.textContent="AJUSTE FINO: "+(activeBuildPlacement.fineAdjust?"ON":"OFF");toast(activeBuildPlacement.fineAdjust?"Ajuste fino ativado: movimentos de 0,5 m.":"Ajuste normal ativado.");}});
 const actions=document.createElement("div");actions.style.cssText="display:flex;gap:8px;width:100%";
 const confirm=document.createElement("button");confirm.type="button";confirm.id="buildConfirmButton";confirm.textContent="✓ CONFIRMAR";confirm.style.cssText="flex:1;min-height:44px;border:0;border-radius:9px;background:#628d4b;color:white;font:800 13px system-ui";confirm.addEventListener("click",confirmBuildPlacement);
 const cancel=document.createElement("button");cancel.type="button";cancel.textContent="✕ CANCELAR";cancel.style.cssText="flex:1;min-height:44px;border:1px solid #b99a8d;border-radius:9px;background:#633f38;color:white;font:800 13px system-ui";cancel.addEventListener("click",cancelBuildPlacement);
 actions.append(confirm,cancel);panel.append(label,row,actions);document.body.appendChild(panel);buildPlacementUI=panel;
  const toggle=document.createElement("button");toggle.type="button";toggle.id="buildPlacementToggle";toggle.textContent="OCULTAR AJUSTES";toggle.style.cssText="position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:91;display:none;min-height:44px;padding:10px 18px;border:1px solid #d2bd8c;border-radius:10px;background:#253528f2;color:#fff1cf;font:800 12px system-ui;letter-spacing:.04em;box-shadow:0 3px 12px #000b;touch-action:manipulation";toggle.addEventListener("click",()=>toggleBuildPlacementPanel());document.body.appendChild(toggle);buildPlacementToggle=toggle;
}
function buildPlacementSpec(type){
 const specs={
  floor:{label:"PISO MODULAR",wood:4,fiber:2,geometry:new THREE.BoxGeometry(3,.16,3),height:.12},
  wall:{label:"PAREDE",wood:6,fiber:2,geometry:new THREE.BoxGeometry(2.9,2.45,.18),height:1.5},
  window:{label:"PAREDE COM JANELA",wood:7,fiber:2,geometry:new THREE.BoxGeometry(2.9,2.45,.18),height:1.5},
  door:{label:"PORTA",wood:8,fiber:3,geometry:new THREE.BoxGeometry(2.9,2.45,.2),height:1.5},
  roof:{label:"TELHADO",wood:8,fiber:3,geometry:new THREE.BoxGeometry(3,1.25,3),height:2.25},
  fence:{label:"CERCA",wood:5,fiber:2,geometry:new THREE.BoxGeometry(6.4,1.25,.18),height:.63}
 };
 return specs[type];
}
function createBuildPreviewModel(type,material,height){
 const group=new THREE.Group();
 const part=(w,h,d,x,y,z,rz=0)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y-height,z);mesh.rotation.z=rz;mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);
  if(!buildPreviewMesh)buildPreviewMesh=mesh;
  return mesh;
 };
 if(type==="floor"){
  for(let i=0;i<9;i++)part(2.86,.14,.29,0,.2,-1.28+i*.32);
  for(const z of [-1.22,1.22])part(3.02,.2,.18,0,.08,z);
  for(const x of [-1.25,1.25])part(.18,.2,2.55,x,.08,0);
 }else if(type==="wall"){
  for(const x of [-1.42,1.42])part(.18,2.45,.18,x,1.225,0);
  for(const y of [.16,2.28])part(2.9,.16,.16,0,y,0);
  for(let i=0;i<11;i++)part(.23,2.05,.11,-1.25+i*.25,1.22,.015);
 }else if(type==="window"){
  for(const x of [-1.42,1.42])part(.18,2.45,.18,x,1.225,0);
  part(2.9,.16,.16,0,.16,0);part(2.9,.16,.16,0,2.28,0);
  for(let i=0;i<11;i++){const x=-1.25+i*.25;if(Math.abs(x)<.62)continue;part(.23,.78,.11,x,.56,.015);part(.23,.42,.11,x,2.04,.015);}
  part(1.05,.13,.12,0,.98,0);part(1.05,.13,.12,0,1.78,0);
  for(const x of [-.55,.55])part(.13,.8,.13,x,1.38,0);
  part(.1,.68,.08,0,1.38,.015);
  for(const x of [-.275,.275])part(.46,.68,.035,x,1.38,.025);
 }else if(type==="door"){
  for(const x of [-1.42,1.42])part(.18,2.45,.18,x,1.225,0);
  part(2.9,.18,.2,0,2.34,0);
  part(2.58,2.12,.13,0,1.18,.04);
  for(const y of [.2,.72,1.4,1.92])part(2.58,.1,.16,0,y,.1);
  for(let i=0;i<9;i++)part(.2,2.02,.15,-1.12+i*.28,1.18,.115);
  part(2.45,.12,.15,0,1.18,.16,-.55);
 }else if(type==="roof"){
  for(let i=0;i<10;i++){const z=-1.53+i*.34;part(2.12,.13,.32,-.94,2.98,z,.38);part(2.12,.13,.32,.94,2.98,z,-.38);}
  for(const x of [-1.78,0,1.78])part(.18,.18,3.42,x,x===0?3.38:2.58,0);
  for(const z of [-1.68,1.68])part(3.75,.16,.16,0,2.98,z);
 }else if(type==="fence"){
  for(let i=0;i<=4;i++)part(.16,1.25,.16,-3.2+i*1.6,.625,0);
  for(let i=0;i<4;i++){const x=-2.4+i*1.6;for(const y of [.42,.91])part(1.55,.13,.12,x,y,0);for(let j=0;j<4;j++)part(.11,.62,.1,x-.48+j*.32,.68,0);}
 }
 return group;
}
function beginBuildPlacement(type){
 const spec=buildPlacementSpec(type);if(!spec)return;
 if(activeBuildPlacement)cancelBuildPlacement(false);
 if(state.wood<spec.wood||state.fiber<spec.fiber){toast("Materiais insuficientes: "+spec.wood+" madeiras e "+spec.fiber+" fibras.");return;}
 if(type==="wall"||type==="window"||type==="door"||type==="roof"){
  if(!state.floorTiles.length){toast("Construa primeiro um piso modular.");return;}
 }
 activeBuildPlacement={type,offsetX:0,offsetZ:0,rotationStep:0,fineAdjust:false,valid:false,placement:null};
 ensureBuildPlacementUI();
 $("buildPlacementLabel").textContent="POSICIONAR: "+spec.label+" · ajuste e confirme";
 toggleBuildPlacementPanel(true);if(buildPlacementToggle)buildPlacementToggle.style.display="block";
 const mat=new THREE.MeshStandardMaterial({color:0x55e58a,transparent:true,opacity:.42,roughness:.7,metalness:0,depthWrite:false});
 buildPreviewMaterial=mat;buildPreviewMesh=null;
 buildPreviewGroup=createBuildPreviewModel(type,mat,spec.height);
 const outline=new THREE.LineSegments(new THREE.EdgesGeometry(spec.geometry),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.9}));
 buildPreviewGroup.add(outline);scene.add(buildPreviewGroup);
 updateBuildPreview();
 toast("Pré-visualização ativa. Ajuste a posição e confirme quando estiver verde.");
}
function nearestBuildFloor(x,z,maxDistance=9){
 let best=null,bestD=maxDistance;
 for(const tile of state.floorTiles){const d=Math.hypot(tile.x-x,tile.z-z);if(d<bestD){bestD=d;best=tile;}}
 return best;
}
function buildPreviewCandidate(){
 const p=activeBuildPlacement,type=p.type;
 const forward=new THREE.Vector3(Math.sin(state.cameraYaw),0,Math.cos(state.cameraYaw));
 const right=new THREE.Vector3(forward.z,0,-forward.x);
 const targetX=player.position.x+forward.x*4+right.x*p.offsetX+forward.x*p.offsetZ;
 const targetZ=player.position.z+forward.z*4+right.z*p.offsetX+forward.z*p.offsetZ;
 let x=targetX,z=targetZ,yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2),anchor=null,slot=null;
 if(type==="floor"){
  anchor=nearestBuildFloor(player.position.x,player.position.z,8);
  if(anchor){
   const dx=targetX-anchor.x,dz=targetZ-anchor.z;
   const lx=dx*Math.cos(anchor.yaw)-dz*Math.sin(anchor.yaw),lz=dx*Math.sin(anchor.yaw)+dz*Math.cos(anchor.yaw);
   const sx=Math.abs(lx)>Math.abs(lz);
   const ox=sx?Math.sign(lx||1)*3:Math.round(lx/3)*3;
   const oz=sx?Math.round(lz/3)*3:Math.sign(lz||1)*3;
   x=anchor.x+ox*Math.cos(anchor.yaw)+oz*Math.sin(anchor.yaw);
   z=anchor.z-ox*Math.sin(anchor.yaw)+oz*Math.cos(anchor.yaw);yaw=anchor.yaw;
  }else{x=Math.round(targetX/3)*3;z=Math.round(targetZ/3)*3;}
 }else if(type==="wall"||type==="window"||type==="door"){
  anchor=nearestBuildFloor(targetX,targetZ,8.5);
  if(anchor){
   const dx=targetX-anchor.x,dz=targetZ-anchor.z;
   const lx=dx*Math.cos(anchor.yaw)-dz*Math.sin(anchor.yaw),lz=dx*Math.sin(anchor.yaw)+dz*Math.cos(anchor.yaw);
   let side;
   if(Math.abs(lx)>Math.abs(lz))side=lx>=0?0:1;else side=lz>=0?2:3;
   side=(side+p.rotationStep)%4;
   const edges=[
    {ex:1.5,ez:0,yaw:anchor.yaw+Math.PI/2},
    {ex:-1.5,ez:0,yaw:anchor.yaw+Math.PI/2},
    {ex:0,ez:1.5,yaw:anchor.yaw},
    {ex:0,ez:-1.5,yaw:anchor.yaw}
   ];
   slot=edges[side];x=anchor.x+slot.ex*Math.cos(anchor.yaw)+slot.ez*Math.sin(anchor.yaw);z=anchor.z-slot.ex*Math.sin(anchor.yaw)+slot.ez*Math.cos(anchor.yaw);yaw=slot.yaw;
  }
 }else if(type==="roof"){
  anchor=nearestBuildFloor(targetX,targetZ,8.5);
  if(anchor){x=anchor.x;z=anchor.z;yaw=anchor.yaw;}
 }else if(type==="fence"){
  yaw=state.cameraYaw+p.rotationStep*Math.PI/2;
  const snapped=findFenceConnection(targetX,targetZ,3.2);
  if(snapped){x=snapped.x;z=snapped.z;yaw=snapped.yaw;}
 }
 return {x,z,yaw,anchor,slot};
}
function buildPlacementTerrainCheck(type,c,yaw){
 const samples=[[0,0]];
 if(type==="floor"){
  for(const x of [-1.38,1.38])for(const z of [-1.38,1.38])samples.push([x,z]);
 }else if(type==="fence"){
  for(const x of [-3.1,-1.55,1.55,3.1])samples.push([x,0]);
 }
 const heights=samples.map(([lx,lz])=>{
  const x=c.x+lx*Math.cos(yaw)+lz*Math.sin(yaw);
  const z=c.z-lx*Math.sin(yaw)+lz*Math.cos(yaw);
  return terrainHeight(x,z);
 });
 const min=Math.min(...heights),max=Math.max(...heights);
 const average=heights.reduce((sum,value)=>sum+value,0)/heights.length;
 const limit=type==="floor"?.7:type==="fence"?.55:Infinity;
 return {average,difference:max-min,level:max-min<=limit};
}
function buildPlacementGround(c,terrainCheck){
 if(c.anchor){
  const floorGround=Number.isFinite(c.anchor.ground)?c.anchor.ground:terrainHeight(c.anchor.x,c.anchor.z);
  return floorGround;
 }
 return terrainCheck.average;
}
function buildFloorModulesOverlap(a,b){
 const dx=b.x-a.x,dz=b.z-a.z;
 const axes=[a.yaw||0,(a.yaw||0)+Math.PI/2,b.yaw||0,(b.yaw||0)+Math.PI/2];
 for(const angle of axes){
  const ax=Math.cos(angle),az=-Math.sin(angle);
  const distance=Math.abs(dx*ax+dz*az);
  const radiusA=1.5*(Math.abs(Math.cos((a.yaw||0)-angle))+Math.abs(Math.sin((a.yaw||0)-angle)));
  const radiusB=1.5*(Math.abs(Math.cos((b.yaw||0)-angle))+Math.abs(Math.sin((b.yaw||0)-angle)));
  if(distance>=radiusA+radiusB-.035)return false;
 }
 return true;
}
function buildRoofModulesOverlap(a,b){
 const dx=b.x-a.x,dz=b.z-a.z;
 const yawA=Number.isFinite(a.yaw)?a.yaw:0,yawB=Number.isFinite(b.yaw)?b.yaw:0;
 const halfWidth=1.875,halfDepth=1.71;
 const axes=[yawA,yawA+Math.PI/2,yawB,yawB+Math.PI/2];
 for(const angle of axes){
  const ax=Math.cos(angle),az=-Math.sin(angle);
  const distance=Math.abs(dx*ax+dz*az);
  const radiusA=halfWidth*Math.abs(Math.cos(yawA-angle))+halfDepth*Math.abs(Math.sin(yawA-angle));
  const radiusB=halfWidth*Math.abs(Math.cos(yawB-angle))+halfDepth*Math.abs(Math.sin(yawB-angle));
  if(distance>=radiusA+radiusB-.04)return false;
 }
 return true;
}
function buildFenceSectionsOverlap(a,b){
 const dx=b.x-a.x,dz=b.z-a.z;
 const yawA=Number.isFinite(a.yaw)?a.yaw:0,yawB=Number.isFinite(b.yaw)?b.yaw:0;
 const halfLength=3.2,halfDepth=.09;
 const axes=[yawA,yawA+Math.PI/2,yawB,yawB+Math.PI/2];
 for(const angle of axes){
  const ax=Math.cos(angle),az=-Math.sin(angle);
  const distance=Math.abs(dx*ax+dz*az);
  const radiusA=halfLength*Math.abs(Math.cos(yawA-angle))+halfDepth*Math.abs(Math.sin(yawA-angle));
  const radiusB=halfLength*Math.abs(Math.cos(yawB-angle))+halfDepth*Math.abs(Math.sin(yawB-angle));
  if(distance>=radiusA+radiusB-.035)return false;
 }
 return true;
}
function buildPathTilesOverlap(a,b){
 const dx=b.x-a.x,dz=b.z-a.z;
 const yawA=Number.isFinite(a.yaw)?a.yaw:0,yawB=Number.isFinite(b.yaw)?b.yaw:0;
 const halfLength=1.48,halfDepth=1.48;
 const axes=[yawA,yawA+Math.PI/2,yawB,yawB+Math.PI/2];
 for(const angle of axes){
  const ax=Math.cos(angle),az=-Math.sin(angle);
  const distance=Math.abs(dx*ax+dz*az);
  const radiusA=halfLength*Math.abs(Math.cos(yawA-angle))+halfDepth*Math.abs(Math.sin(yawA-angle));
  const radiusB=halfLength*Math.abs(Math.cos(yawB-angle))+halfDepth*Math.abs(Math.sin(yawB-angle));
  if(distance>=radiusA+radiusB-.035)return false;
 }
 return true;
}
function buildFloorPlacementOccupied(candidate){
 return state.floorTiles.some(tile=>buildFloorModulesOverlap(candidate,tile));
}
function buildFloorPlacementContinuity(c,terrainCheck){
 let neighbor=null,nearest=3.35;
 for(const tile of state.floorTiles){
  const distance=Math.hypot(tile.x-c.x,tile.z-c.z);
  if(distance>2.3&&distance<nearest){nearest=distance;neighbor=tile;}
 }
 if(!neighbor)return {ok:true,ground:terrainCheck.average,step:0};
 const existingGround=Number.isFinite(neighbor.ground)?neighbor.ground:terrainHeight(neighbor.x,neighbor.z);
 const step=Math.abs(terrainCheck.average-existingGround);
 return {ok:step<=.35,ground:existingGround,step};
}
function updateBuildPreview(){
 if(!activeBuildPlacement||!buildPreviewGroup)return;
 const p=activeBuildPlacement,type=p.type,spec=buildPlacementSpec(type),c=buildPreviewCandidate();
 const hasFloor=type==="floor"||type==="fence"||!!c.anchor;
 const floorOccupied=type==="floor"&&buildFloorPlacementOccupied(c);
 const occupiedPanelSlot=(type==="wall"||type==="window"||type==="door")&&[...state.wallPanels,...state.windowPanels,...state.doorPanels].some(t=>Math.hypot(t.x-c.x,t.z-c.z)<0.45);
 const roofOccupied=type==="roof"&&state.roofTiles.some(t=>buildRoofModulesOverlap(c,t));
 const fenceOccupied=type==="fence"&&state.fenceSections.some(t=>buildFenceSectionsOverlap(c,t));
 const limits={floor:state.floorTiles.length<100,wall:state.wallPanels.length<100,window:state.windowPanels.length<100,door:state.doorPanels.length<100,roof:state.roofTiles.length<100,fence:state.fenceSections.length<200};
 const missingMaterials=state.wood<spec.wood||state.fiber<spec.fiber;
 const terrainCheck=buildPlacementTerrainCheck(type,c,c.yaw);
 const floorContinuity=type==="floor"?buildFloorPlacementContinuity(c,terrainCheck):{ok:true,ground:terrainCheck.average,step:0};
 let valid=hasFloor&&!missingMaterials&&!floorOccupied&&!occupiedPanelSlot&&!roofOccupied&&!fenceOccupied&&limits[type]&&terrainCheck.level&&floorContinuity.ok;
 const ground=type==="floor"?floorContinuity.ground:buildPlacementGround(c,terrainCheck);
 const y=ground+spec.height;
 buildPreviewGroup.position.set(c.x,y,c.z);buildPreviewGroup.rotation.y=c.yaw;
 buildPreviewMaterial.color.setHex(valid?0x55e58a:0xff514d);
 activeBuildPlacement.valid=valid;activeBuildPlacement.placement={x:c.x,z:c.z,yaw:c.yaw,ground};
 const confirm=$("buildConfirmButton");
 if(confirm){confirm.disabled=!valid;confirm.style.opacity=valid?"1":".45";}
 const label=$("buildPlacementLabel");
 if(label){
  const status=!hasFloor?"PRECISA DE UM PISO":missingMaterials?"FALTAM MATERIAIS":floorOccupied?"ESTE LOCAL JÁ TEM UM PISO":occupiedPanelSlot?"ESTE LADO JÁ TEM UMA PAREDE":roofOccupied?"ESTE PISO JÁ TEM TELHADO":fenceOccupied?"ÁREA DA CERCA SOBREPOSTA":!limits[type]?"LIMITE DE CONSTRUÇÃO ATINGIDO":!terrainCheck.level?"TERRENO MUITO INCLINADO":!floorContinuity.ok?"DESNÍVEL ENTRE PISOS":valid?"ENCAIXE LIVRE · PODE CONFIRMAR":"POSIÇÃO INVÁLIDA";
  label.textContent="POSICIONAR: "+spec.label+" · "+status;
 }
}
function cancelBuildPlacement(showMessage=true){
 if(buildPreviewGroup){scene.remove(buildPreviewGroup);buildPreviewGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
 buildPreviewGroup=null;buildPreviewMesh=null;buildPreviewMaterial=null;activeBuildPlacement=null;
 if(buildPlacementUI)buildPlacementUI.style.display="none";if(buildPlacementToggle)buildPlacementToggle.style.display="none";
 if(showMessage)toast("Construção cancelada. Nenhum material foi consumido.");
}
function confirmBuildPlacement(){
 const p=activeBuildPlacement;if(!p)return;
 updateBuildPreview();
 if(!p.valid){toast("Posição inválida: escolha um encaixe livre e confira os materiais.");return;}
 const c=p.placement,type=p.type,spec=buildPlacementSpec(type);
 if(state.wood<spec.wood||state.fiber<spec.fiber){toast("Materiais insuficientes.");return;}
 if(type==="floor"){
  const item={x:c.x,z:c.z,yaw:c.yaw,ground:c.ground};createFloorTile(item);state.floorTiles.push(item);
 }else if(type==="wall"){
  const item={x:c.x,z:c.z,yaw:c.yaw,ground:c.ground};createWallPanel(item);state.wallPanels.push(item);
 }else if(type==="window"){
  const item={x:c.x,z:c.z,yaw:c.yaw,ground:c.ground};createWindowPanel(item);state.windowPanels.push(item);
 }else if(type==="door"){
  const item={x:c.x,z:c.z,yaw:c.yaw,ground:c.ground,open:false};createDoorPanel(item);state.doorPanels.push(item);
 }else if(type==="roof"){
  const item={x:c.x,z:c.z,yaw:c.yaw,ground:c.ground};createRoofTile(item);state.roofTiles.push(item);
 }else if(type==="fence"){
  createFenceSection(c.x,c.z,c.yaw,c.ground);state.fenceSections.push({x:c.x,z:c.z,yaw:c.yaw,ground:c.ground});
 }
 state.wood-=spec.wood;state.fiber-=spec.fiber;
 cancelBuildPlacement(false);updateHUD();saveGame();
 toast(spec.label+" construído e salvo!");
}

function craftFloorTile(){
  if(state.floorTiles.length>=100){toast("Limite de 100 módulos de piso atingido.");return;}
  if(state.wood<4||state.fiber<2){toast("Faltam materiais: 4 madeiras e 2 fibras.");return;}
  const facing=player.rotation.y;
  let yaw=Math.round(facing/(Math.PI/2))*(Math.PI/2);
  const targetX=player.position.x+Math.sin(yaw)*4.5;
  const targetZ=player.position.z+Math.cos(yaw)*4.5;
  let x=Math.round(targetX/3)*3,z=Math.round(targetZ/3)*3;
  // Quando houver um módulo próximo, usa a própria grade e orientação dele.
  // Assim os novos pisos compartilham bordas sem depender da grade global do mundo.
  let anchor=null,anchorDistance=7;
  for(const existing of state.floorTiles){
   const distance=Math.hypot(player.position.x-existing.x,player.position.z-existing.z);
   if(distance<anchorDistance){anchorDistance=distance;anchor=existing;}
  }
  if(anchor){
   const dx=targetX-anchor.x,dz=targetZ-anchor.z;
   const localX=dx*Math.cos(anchor.yaw)-dz*Math.sin(anchor.yaw);
   const localZ=dx*Math.sin(anchor.yaw)+dz*Math.cos(anchor.yaw);
   const sideX=Math.abs(localX)>Math.abs(localZ);
   const offsetX=sideX?Math.sign(localX||1)*3:Math.round(localX/3)*3;
   const offsetZ=sideX?Math.round(localZ/3)*3:Math.sign(localZ||1)*3;
   x=anchor.x+offsetX*Math.cos(anchor.yaw)+offsetZ*Math.sin(anchor.yaw);
   z=anchor.z-offsetX*Math.sin(anchor.yaw)+offsetZ*Math.cos(anchor.yaw);
   yaw=anchor.yaw;
  }
  if(state.floorTiles.some(tile=>Math.hypot(tile.x-x,tile.z-z)<2.3)){
   toast("Este espaço já tem um piso. Escolha uma borda livre para encaixar o próximo módulo.");return;
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
  group.position.set(tile.x,Number.isFinite(tile.ground)?tile.ground:terrainHeight(tile.x,tile.z),tile.z);
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
  group.position.set(panel.x,(Number.isFinite(panel.ground)?panel.ground:terrainHeight(panel.x,panel.z))+.28,panel.z);
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
  const glass=new THREE.MeshStandardMaterial({color:0x9fc8d5,transparent:true,opacity:.3,roughness:.18,metalness:.08,depthWrite:false,side:THREE.DoubleSide});
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
  for(const x of [-.275,.275]){
   const pane=new THREE.Mesh(new THREE.BoxGeometry(.46,.68,.035),glass);
   pane.position.set(x,1.38,.025);pane.castShadow=false;pane.receiveShadow=true;group.add(pane);
  }
  beam(1.22,.1,.2,0,.88,.045,timber);
  beam(1.22,.09,.16,0,1.88,.035,timber);
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
  group.position.set(roof.x,(Number.isFinite(roof.ground)?roof.ground:terrainHeight(roof.x,roof.z))+.28,roof.z);
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
  group.position.set(door.x,(Number.isFinite(door.ground)?door.ground:terrainHeight(door.x,door.z))+.28,door.z);
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
 function createFenceSection(x,z,yaw,ground){
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
  group.position.set(x,Number.isFinite(ground)?ground:terrainHeight(x,z),z);group.rotation.y=yaw;scene.add(group);
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
 const keys=["wood","stone","ironOre","coal","ironIngots","steelIngots","fiber","berries","herbs","meat","cookedMeat","smokedMeat","healingSalve","hide","leather","bandages","honey","wool"];
 let total=0;
 for(const key of keys){const amount=Math.max(0,Math.floor(state[key]));state.storage[key]+=amount;state[key]=0;total+=amount;}
 if(!total){toast("Sua mochila está vazia.");return;}
 updateHUD();saveGame();toast(total+" itens guardados no baú.");
}
function takeResources(){
 if(!state.storageChest||Math.hypot(player.position.x-state.storageChestX,player.position.z-state.storageChestZ)>=3.5){toast("Aproxime-se do baú.");return;}
 const keys=["wood","stone","ironOre","coal","ironIngots","fiber","berries","herbs","meat","cookedMeat","smokedMeat","healingSalve","hide","leather","bandages","honey","wool"];
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
let campfireFlameMesh=null,campfireCoreMesh=null,campfireLightSource=null,campfireGlowMesh=null;
const campfireEmbers=[];
const campfireSmoke=[];
let campfireAnimationTime=0;
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
 const glowMat=new THREE.MeshBasicMaterial({color:0xff8738,transparent:true,opacity:.1,depthWrite:false,side:THREE.DoubleSide});
 const glow=new THREE.Mesh(new THREE.RingGeometry(.76,1.92,48),glowMat);
 glow.rotation.x=-Math.PI/2;glow.position.y=.035;glow.renderOrder=1;group.add(glow);
 const flameMat=new THREE.MeshStandardMaterial({color:0xff8a24,emissive:0xff4b08,emissiveIntensity:1.7,roughness:.4});
 const flame=new THREE.Mesh(new THREE.ConeGeometry(.22,.8,7),flameMat);flame.position.y=.68;group.add(flame);
 const core=new THREE.Mesh(new THREE.SphereGeometry(.15,8,8),new THREE.MeshBasicMaterial({color:0xffd36a}));core.position.y=.43;group.add(core);
 const light=new THREE.PointLight(0xff9a42,1.8,10);light.position.y=1.1;group.add(light);
 const emberGeometry=new THREE.SphereGeometry(.035,6,5);
 campfireEmbers.length=0;
 for(let i=0;i<7;i++){
  const emberMaterial=new THREE.MeshBasicMaterial({color:i%2?0xff9b3d:0xffd16b,transparent:true,opacity:0,depthWrite:false});
  const ember=new THREE.Mesh(emberGeometry,emberMaterial);
  const phase=i/7;
  ember.position.set(Math.sin(i*2.4)*.22,.6+phase*1.4,Math.cos(i*2.4)*.22);
  group.add(ember);
  campfireEmbers.push({object:ember,phase,speed:.42+(i%3)*.09});
 }
 const smokeGeometry=new THREE.SphereGeometry(.16,7,6);
 campfireSmoke.length=0;
 for(let i=0;i<6;i++){
  const smokeMaterial=new THREE.MeshBasicMaterial({color:0xaeb2a7,transparent:true,opacity:0,depthWrite:false});
  const puff=new THREE.Mesh(smokeGeometry,smokeMaterial);
  const phase=i/6;
  puff.position.set(0,.9+phase*2.1,0);
  puff.scale.setScalar(.45);
  group.add(puff);
  campfireSmoke.push({object:puff,phase,speed:.105+(i%3)*.012});
 }
 group.position.set(x,terrainHeight(x,z),z);scene.add(group);
 state.campfireObject=group;state.campfire=true;state.campfireX=x;state.campfireZ=z;
 campfireFlameMesh=flame;campfireCoreMesh=core;campfireLightSource=light;campfireGlowMesh=glow;campfireAnimationTime=0;
}
function updateCampfireVisuals(dt){
 if(!state.campfireObject||!campfireFlameMesh)return;
 campfireAnimationTime+=dt;
 const t=campfireAnimationTime;
 const flicker=Math.sin(t*13)+Math.sin(t*21+1.7)*.45;
 campfireFlameMesh.scale.set(1,.86+flicker*.09,1);
 campfireFlameMesh.rotation.z=Math.sin(t*8)*.075;
 campfireCoreMesh.scale.setScalar(.94+Math.sin(t*17)*.07);
 campfireLightSource.intensity=1.65+flicker*.28;
 campfireGlowMesh.material.opacity=.095+Math.sin(t*2.4)*.022;
 campfireGlowMesh.scale.setScalar(1+Math.sin(t*1.7)*.018);
 for(const ember of campfireEmbers){
  const rise=(t*ember.speed+ember.phase)%1;
  ember.object.position.y=.58+rise*1.45;
  ember.object.position.x=Math.sin(t*2.2+ember.phase*8)*(.12+rise*.2);
  ember.object.position.z=Math.cos(t*1.8+ember.phase*7)*(.12+rise*.2);
  ember.object.material.opacity=(1-rise)*.78;
 }
 for(const puff of campfireSmoke){
  const rise=(t*puff.speed+puff.phase)%1;
  puff.object.position.y=.9+rise*2.35;
  puff.object.position.x=Math.sin(t*.72+puff.phase*6.2)*(.08+rise*.28);
  puff.object.position.z=Math.cos(t*.58+puff.phase*5.4)*(.07+rise*.22);
  puff.object.scale.setScalar(.42+rise*1.15);
  puff.object.material.opacity=(1-rise)*.17;
 }
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
function craftHerbBed(){
 if(state.herbBeds.length>=6){toast("Limite de 6 canteiros medicinais atingido.");return;}
 if(state.wood<3||state.fiber<2){toast("Faltam 3 madeiras e 2 fibras.");return;}
 const yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2),x=Math.round((player.position.x+Math.sin(yaw)*5)/3)*3,z=Math.round((player.position.z+Math.cos(yaw)*5)/3)*3;
 if(state.herbBeds.some(b=>Math.hypot(b.x-x,b.z-z)<3.5)){toast("Escolha um local mais distante de outro canteiro.");return;}
 state.wood-=3;state.fiber-=2;const bed={x,z,yaw,plantedAt:0};state.herbBeds.push(bed);createHerbBed(bed);updateHUD();saveGame();toast("Canteiro medicinal construído. Plante frutas para cultivar ervas.");
}
function createHerbBed(data){
 const g=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:0x765033,roughness:1}),soil=new THREE.MeshStandardMaterial({color:0x493322,roughness:1}),leaf=new THREE.MeshStandardMaterial({color:0x527d3d,roughness:1}),flower=new THREE.MeshStandardMaterial({color:0xc5a5d5,roughness:1});
 const earth=new THREE.Mesh(new THREE.BoxGeometry(2.5,.22,1.8),soil);earth.position.y=.2;g.add(earth);
 for(const x of [-1.3,1.3]){const b=new THREE.Mesh(new THREE.BoxGeometry(.12,.32,1.95),wood);b.position.set(x,.3,0);g.add(b);}
 for(const z of [-.92,.92]){const b=new THREE.Mesh(new THREE.BoxGeometry(2.65,.32,.12),wood);b.position.set(0,.3,z);g.add(b);}
 for(let i=0;i<8;i++){const x=-.9+(i%4)*.6,z=-.45+Math.floor(i/4)*.9;const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.35,5),leaf);stem.position.set(x,.48,z);g.add(stem);const leaves=new THREE.Mesh(new THREE.SphereGeometry(.16,6,5),leaf);leaves.scale.set(.7,1,.7);leaves.position.set(x,.65,z);g.add(leaves);const bloom=new THREE.Mesh(new THREE.SphereGeometry(.07,5,4),flower);bloom.position.set(x,.79,z);g.add(bloom);}
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});g.position.set(data.x,terrainHeight(data.x,data.z),data.z);g.rotation.y=data.yaw;scene.add(g);state.herbObjects.push(g);
}
function herbGardenAction(){
 const i=state.nearHerbBedIndex;if(i<0)return;const bed=state.herbBeds[i];
 if(bed.plantedAt>0){if(Date.now()-bed.plantedAt<90000){toast("As ervas ainda estão crescendo.");return;}state.herbs+=4;bed.plantedAt=0;toast("Colheita concluída: +4 ervas medicinais.");}
 else{if(state.berries<2){toast("Você precisa de 2 frutas silvestres para plantar.");return;}state.berries-=2;bed.plantedAt=Date.now();toast("Ervas plantadas. A colheita ficará pronta em 90 segundos.");}
 updateHUD();saveGame();
}
function craftTannery(){
 if(state.tannery){toast("O curtume comunitário já foi construído.");return;}
 if(state.wood<10||state.stone<5){toast("Faltam 10 madeiras e 5 pedras.");return;}
 const yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2),x=Math.round((player.position.x+Math.sin(yaw)*7)/3)*3,z=Math.round((player.position.z+Math.cos(yaw)*7)/3)*3;
 state.wood-=10;state.stone-=5;state.tannery={x,z,yaw,startedAt:0};createTannery(state.tannery);updateHUD();saveGame();toast("Curtume construído! Use couro cru para iniciar o curtimento.");
}
function createTannery(data){
 const g=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:0x68452c,roughness:1}),dark=new THREE.MeshStandardMaterial({color:0x35271e,roughness:1}),hideMat=new THREE.MeshStandardMaterial({color:0x987348,roughness:1}),stone=new THREE.MeshStandardMaterial({color:0x77746b,roughness:1});
 for(const x of [-1.35,1.35])for(const z of [-1.05,1.05]){const p=new THREE.Mesh(new THREE.BoxGeometry(.16,2.2,.16),wood);p.position.set(x,1.1,z);g.add(p);}
 for(const z of [-1.05,1.05]){const beam=new THREE.Mesh(new THREE.BoxGeometry(2.8,.16,.16),wood);beam.position.set(0,2.05,z);g.add(beam);}
 const roof=new THREE.Mesh(new THREE.BoxGeometry(3.1,.18,2.5),wood);roof.position.y=2.25;g.add(roof);
 const vat=new THREE.Mesh(new THREE.CylinderGeometry(.72,.62,.7,10),dark);vat.position.set(0,.38,.05);g.add(vat);
 const liquid=new THREE.Mesh(new THREE.CircleGeometry(.58,16),new THREE.MeshStandardMaterial({color:0x75613d,roughness:1}));liquid.rotation.x=-Math.PI/2;liquid.position.set(0,.74,.05);g.add(liquid);
 for(let i=0;i<3;i++){const rack=new THREE.Mesh(new THREE.BoxGeometry(.1,1.35,.1),wood);rack.position.set(-1.05+i*1.05,1.0,1.38);g.add(rack);const stretched=new THREE.Mesh(new THREE.BoxGeometry(.78,.62,.07),hideMat);stretched.position.set(-1.05+i*1.05,1.05,1.35);g.add(stretched);}
 for(let i=0;i<4;i++){const block=new THREE.Mesh(new THREE.BoxGeometry(.38,.25,.34),stone);block.position.set(-.65+i*.43,.13,-1.45);g.add(block);}
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});g.position.set(data.x,terrainHeight(data.x,data.z),data.z);g.rotation.y=data.yaw;scene.add(g);state.tanneryObject=g;
}
function startTanning(){
 if(!state.nearTannery||!state.tannery)return;
 if(state.tannery.startedAt>0){toast("Já existe uma pele no processo de curtimento.");return;}
 if(state.hide<1){toast("Você precisa de 1 couro cru.");return;}
 state.hide--;state.tannery.startedAt=Date.now();updateHUD();saveGame();toast("Curtimento iniciado. O couro ficará pronto em 2 minutos.");
}
function collectLeather(){
 if(!state.nearTannery||!state.tannery||state.tannery.startedAt<=0)return;
 if(Date.now()-state.tannery.startedAt<120000){toast("O couro ainda está curtindo.");return;}
 state.tannery.startedAt=0;state.leather++;updateHUD();saveGame();toast("Couro curtido recolhido! +1 couro resistente.");
}
function craftLeatherArmor(){
 if(!state.nearTannery){toast("Aproxime-se do curtume para fabricar a armadura.");return;}
 if(state.leatherArmor){toast("Você já está usando a armadura de couro.");return;}
 if(state.leather<4||state.fiber<3){toast("A armadura exige 4 couros curtidos e 3 fibras.");return;}
 state.leather-=4;state.fiber-=3;state.leatherArmor=true;createLeatherArmorVisual();updateHUD();saveGame();toast("Armadura de couro equipada! Você recebe 35% menos dano de sobrevivência.");
}
function createLeatherArmorVisual(){
 if(state.armorObject)player.remove(state.armorObject);
 const g=new THREE.Group();
 const leather=new THREE.MeshStandardMaterial({color:0x684329,roughness:.92});
 const darkLeather=new THREE.MeshStandardMaterial({color:0x38251a,roughness:1});
 const seam=new THREE.MeshStandardMaterial({color:0xb18a55,roughness:1});
 const chest=new THREE.Mesh(new THREE.BoxGeometry(.66,.68,.31),leather);chest.position.set(0,1.12,0);g.add(chest);
 for(const x of [-.25,0,.25]){const plate=new THREE.Mesh(new THREE.BoxGeometry(.19,.62,.035),darkLeather);plate.position.set(x,1.12,.174);g.add(plate);}
 for(const x of [-.39,.39]){const shoulder=new THREE.Mesh(new THREE.BoxGeometry(.25,.2,.34),leather);shoulder.position.set(x,1.43,0);shoulder.rotation.z=x<0?-.16:.16;g.add(shoulder);const strap=new THREE.Mesh(new THREE.BoxGeometry(.09,.67,.08),darkLeather);strap.position.set(x<0?-.24:.24,1.13,-.17);strap.rotation.z=x<0?-.12:.12;g.add(strap);}
 const belt=new THREE.Mesh(new THREE.BoxGeometry(.7,.1,.34),darkLeather);belt.position.set(0,.78,0);g.add(belt);
 for(const x of [-.22,0,.22]){const rivet=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),seam);rivet.position.set(x,1.12,.2);g.add(rivet);}
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});player.add(g);state.armorObject=g;
}
function craftSmithy(){
 if(state.smithy){toast("A forja comunitária já foi construída.");return;}
 if(state.wood<8||state.stone<12){toast("A forja exige 8 madeiras e 12 pedras.");return;}
 const yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2),x=Math.round((player.position.x+Math.sin(yaw)*7)/3)*3,z=Math.round((player.position.z+Math.cos(yaw)*7)/3)*3;
 state.wood-=8;state.stone-=12;state.smithy={x,z,yaw};createSmithy(state.smithy);updateHUD();saveGame();toast("Forja comunitária construída! Aproxime-se para reforçar suas ferramentas.");
}
function createSmithy(data){
 const g=new THREE.Group(),stone=new THREE.MeshStandardMaterial({color:0x77736a,roughness:1}),dark=new THREE.MeshStandardMaterial({color:0x302b27,roughness:1}),wood=new THREE.MeshStandardMaterial({color:0x68452b,roughness:1}),iron=new THREE.MeshStandardMaterial({color:0x9ba2a3,metalness:.7,roughness:.3}),coal=new THREE.MeshStandardMaterial({color:0x171716,roughness:1});
 const base=new THREE.Mesh(new THREE.BoxGeometry(2.8,.35,2.1),stone);base.position.y=.18;g.add(base);
 for(let x of [-.9,.9])for(let z of [-.65,.65]){const post=new THREE.Mesh(new THREE.BoxGeometry(.16,2,.16),wood);post.position.set(x,1.15,z);g.add(post);}
 const roof=new THREE.Mesh(new THREE.BoxGeometry(3.1,.18,2.5),wood);roof.position.y=2.18;g.add(roof);
 const hearth=new THREE.Mesh(new THREE.BoxGeometry(1.0,.72,.8),dark);hearth.position.set(-.55,.65,-.25);g.add(hearth);
 const opening=new THREE.Mesh(new THREE.BoxGeometry(.56,.28,.05),coal);opening.position.set(-.55,.68,.17);g.add(opening);
 const anvilBase=new THREE.Mesh(new THREE.CylinderGeometry(.28,.34,.55,8),wood);anvilBase.position.set(.65,.62,.2);g.add(anvilBase);
 const anvil=new THREE.Mesh(new THREE.BoxGeometry(.8,.2,.38),iron);anvil.position.set(.65,1.0,.2);g.add(anvil);
 const horn=new THREE.Mesh(new THREE.ConeGeometry(.13,.35,8),iron);horn.rotation.z=-Math.PI/2;horn.position.set(1.12,1.0,.2);g.add(horn);
 for(let i=0;i<4;i++){const stoneBlock=new THREE.Mesh(new THREE.BoxGeometry(.34,.26,.32),stone);stoneBlock.position.set(-1.05+i*.38,.3,-1.1);g.add(stoneBlock);}
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});g.position.set(data.x,terrainHeight(data.x,data.z),data.z);g.rotation.y=data.yaw;scene.add(g);state.smithyObject=g;
}
function smeltIron(){
 if(!state.nearSmithy){toast("Aproxime-se da forja comunitária.");return;}
 if(state.ironOre<2||state.coal<1||state.wood<1){toast("Fundir exige 2 minérios de ferro, 1 carvão e 1 madeira.");return;}
 state.ironOre-=2;state.coal-=1;state.wood-=1;state.ironIngots+=1;
 updateHUD();saveGame();toast("Um lingote de ferro foi fundido na forja!");
}
function buildSteelFurnace(){
 if(!state.nearSmithy||!state.smithy){toast("Aproxime-se da forja comunitária.");return;}
 if(state.steelFurnace){toast("O alto-forno já foi construído.");return;}
 if(state.stone<8||state.wood<5||state.ironIngots<2){toast("O alto-forno exige 8 pedras, 5 madeiras e 2 lingotes de ferro.");return;}
 state.stone-=8;state.wood-=5;state.ironIngots-=2;
 state.steelFurnace={x:state.smithy.x+3.4,z:state.smithy.z+1.2,yaw:state.smithy.yaw,startedAt:0};
 createSteelFurnace(state.steelFurnace);updateHUD();saveGame();toast("Alto-forno construído! Agora você pode produzir aço.");
}
function createSteelFurnace(data){
 if(state.steelFurnaceObject)scene.remove(state.steelFurnaceObject);
 const g=new THREE.Group();
 const stone=new THREE.MeshStandardMaterial({color:0x625f59,roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:0x252321,roughness:1});
 const iron=new THREE.MeshStandardMaterial({color:0x7e898e,metalness:.72,roughness:.32});
 const ember=new THREE.MeshStandardMaterial({color:0xff6b19,emissive:0xff3b08,emissiveIntensity:1.4,roughness:.6});
 const base=new THREE.Mesh(new THREE.BoxGeometry(2.15,.42,1.8),stone);base.position.y=.22;g.add(base);
 const body=new THREE.Mesh(new THREE.BoxGeometry(1.55,1.55,1.35),stone);body.position.y=1.05;g.add(body);
 const opening=new THREE.Mesh(new THREE.BoxGeometry(.78,.72,.08),dark);opening.position.set(0,.78,.72);g.add(opening);
 const fire=new THREE.Mesh(new THREE.BoxGeometry(.48,.38,.035),ember);fire.position.set(0,.75,.77);g.add(fire);
 const chimney=new THREE.Mesh(new THREE.CylinderGeometry(.32,.42,1.55,8),stone);chimney.position.set(.45,2.45,-.25);g.add(chimney);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.34,.07,6,12),iron);rim.rotation.x=Math.PI/2;rim.position.set(.45,3.23,-.25);g.add(rim);
 for(const x of [-.62,.62]){const brace=new THREE.Mesh(new THREE.BoxGeometry(.12,1.45,.12),iron);brace.position.set(x,1.08,.72);g.add(brace);}
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 g.position.set(data.x,terrainHeight(data.x,data.z),data.z);g.rotation.y=data.yaw;scene.add(g);state.steelFurnaceObject=g;
}
function startSteelSmelt(){
 if(!state.nearSmithy||!state.steelFurnace){toast("Construa o alto-forno e aproxime-se da forja.");return;}
 if(state.steelFurnace.startedAt>0){toast("Já existe uma carga de aço no alto-forno.");return;}
 if(state.ironIngots<2||state.coal<2||state.wood<1){toast("A produção exige 2 lingotes de ferro, 2 carvões e 1 madeira.");return;}
 state.ironIngots-=2;state.coal-=2;state.wood--;state.steelFurnace.startedAt=Date.now();
 updateHUD();saveGame();toast("Aço em produção. Aguarde 2 minutos para recolher o lingote.");
}
function collectSteel(){
 if(!state.nearSmithy||!state.steelFurnace||state.steelFurnace.startedAt<=0)return;
 if(Date.now()-state.steelFurnace.startedAt<120000){toast("O aço ainda está sendo refinado no alto-forno.");return;}
 state.steelFurnace.startedAt=0;state.steelIngots++;updateHUD();saveGame();toast("Lingote de aço recolhido! +1 aço.");
}
function craftSteelSword(){
 if(!state.nearSmithy||!state.smithy){toast("Aproxime-se da forja comunitária.");return;}
 if(state.steelSword){toast("Você já fabricou uma espada de aço.");return;}
 if(!state.ironSword){toast("Fabrique primeiro a espada de ferro para aprimorá-la.");return;}
 if(state.steelIngots<4||state.leather<2){toast("A espada de aço exige 4 lingotes de aço e 2 couros.");return;}
 state.steelIngots-=4;state.leather-=2;state.steelSword=true;
 if(characterReady)createIronSwordVisual();
 updateHUD();saveGame();toast("Espada de aço fabricada! Seus golpes agora causam dano triplicado.");
}
function craftSteelHelmet(){
 if(!state.nearSmithy||!state.smithy){toast("Aproxime-se da forja comunitária.");return;}
 if(!state.ironHelmet){toast("Fabrique primeiro o capacete de ferro.");return;}
 if(state.steelHelmet){toast("O capacete já foi aprimorado para aço.");return;}
 if(state.steelIngots<5||state.leather<2){toast("O capacete de aço exige 5 lingotes de aço e 2 couros.");return;}
 state.steelIngots-=5;state.leather-=2;state.steelHelmet=true;
 if(characterReady)createIronHelmetVisual();
 updateHUD();saveGame();toast("Capacete de aço equipado! Proteção aprimorada.");
}
function craftSteelChestplate(){
 if(!state.nearSmithy||!state.smithy){toast("Aproxime-se da forja comunitária.");return;}
 if(!state.ironChestplate){toast("Fabrique primeiro a couraça de ferro.");return;}
 if(state.steelChestplate){toast("A couraça já foi aprimorada para aço.");return;}
 if(state.steelIngots<8||state.leather<4){toast("A couraça de aço exige 8 lingotes de aço e 4 couros.");return;}
 state.steelIngots-=8;state.leather-=4;state.steelChestplate=true;
 if(characterReady)createIronChestplateVisual();
 updateHUD();saveGame();toast("Couraça de aço equipada! Proteção aprimorada.");
}
function craftSteelShield(){
  if(!state.nearSmithy||!state.smithy){toast("Aproxime-se da forja comunitária.");return;}
  if(state.steelShield){toast("Você já fabricou um escudo de aço.");return;}
  if(state.steelIngots<5||state.leather<3){toast("O escudo exige 5 lingotes de aço e 3 couros.");return;}
  state.steelIngots-=5;state.leather-=3;state.steelShield=true;
  if(characterReady)createSteelShieldVisual();
  updateHUD();saveGame();toast("Escudo de aço fabricado! Ele reduz em 20% o desgaste da saúde.");
}
function craftSteelTool(type){
 if(!state.nearSmithy||!state.smithy){toast("Aproxime-se da forja comunitária.");return;}
 const axe=type==="axe",iron=axe?state.ironAxe:state.ironPickaxe,flag=axe?"steelAxe":"steelPickaxe";
 if(!iron){toast("Fabrique primeiro a ferramenta de ferro.");return;}
 if(state[flag]){toast("Esta ferramenta já foi aprimorada para aço.");return;}
 if(state.steelIngots<4||state.leather<3){toast("A melhoria exige 4 lingotes de aço e 3 couros.");return;}
 state.steelIngots-=4;state.leather-=3;state[flag]=true;
 if(characterReady)createToolVisual(type);
 updateHUD();saveGame();toast((axe?"Machado":"Picareta")+" de aço fabricado! Rendimento máximo aprimorado.");
}
function craftIronHelmet(){
 if(!state.nearSmithy||!state.smithy){toast("Aproxime-se da forja comunitária.");return;}
 if(state.ironHelmet){toast("Você já fabricou um capacete de ferro.");return;}
 if(state.ironIngots<4||state.leather<2){toast("O capacete exige 4 lingotes de ferro e 2 couros.");return;}
 state.ironIngots-=4;state.leather-=2;state.ironHelmet=true;
 if(characterReady)createIronHelmetVisual();
 updateHUD();saveGame();toast("Capacete de ferro fabricado! A proteção reduz o desgaste da saúde.");
}
function craftIronChestplate(){
 if(!state.nearSmithy||!state.smithy){toast("Aproxime-se da forja comunitária.");return;}
 if(state.ironChestplate){toast("Você já fabricou a couraça de ferro.");return;}
 if(state.ironIngots<6||state.leather<4){toast("A couraça exige 6 lingotes de ferro e 4 couros.");return;}
 state.ironIngots-=6;state.leather-=4;state.ironChestplate=true;
 if(characterReady)createIronChestplateVisual();
 updateHUD();saveGame();toast("Couraça de ferro equipada! Reduz em 45% o desgaste da saúde.");
}
function craftIronTool(type){
 if(!state.nearSmithy||!state.smithy){toast("Aproxime-se da forja comunitária.");return;}
 const axe=type==="axe",flag=axe?"ironAxe":"ironPickaxe",reinforced=axe?state.reinforcedAxe:state.reinforcedPickaxe;
 if(!reinforced){toast("Reforce primeiro a ferramenta na forja.");return;}
 if(state[flag]){toast("Esta ferramenta já possui cabeça de ferro.");return;}
 if(state.ironIngots<3||state.leather<2){toast("A melhoria exige 3 lingotes de ferro e 2 couros.");return;}
 state.ironIngots-=3;state.leather-=2;state[flag]=true;
 if(characterReady)createToolVisual(type);
 updateHUD();saveGame();toast((axe?"Machado":"Picareta")+" com cabeça de ferro fabricado! Rendimento aumentado.");
}
function craftIronSword(){
 if(!state.nearSmithy||!state.smithy){toast("Aproxime-se da forja comunitária.");return;}
 if(state.ironSword){toast("Você já fabricou uma espada de ferro.");return;}
 if(state.ironIngots<3||state.wood<2||state.leather<1){toast("A espada exige 3 lingotes, 2 madeiras e 1 couro.");return;}
 state.ironIngots-=3;state.wood-=2;state.leather-=1;state.ironSword=true;
 if(characterReady)createIronSwordVisual();
 updateHUD();saveGame();toast("Espada de ferro fabricada! Seus ataques corpo a corpo agora causam dano dobrado.");
}
function upgradeTool(type){
 if(!state.nearSmithy||!state.smithy)return;
 const axe=type==="axe",done=axe?state.reinforcedAxe:state.reinforcedPickaxe;
 if(done){toast("Esta ferramenta já está reforçada.");return;}
 if(axe&&!state.axe||!axe&&!state.pickaxe){toast("Fabrique primeiro esta ferramenta.");return;}
 const woodCost=4,stoneCost=axe?6:8,leatherCost=2;
 if(state.wood<woodCost||state.stone<stoneCost||state.leather<leatherCost){toast("Materiais insuficientes: "+woodCost+" madeiras, "+stoneCost+" pedras e 2 couros.");return;}
 state.wood-=woodCost;state.stone-=stoneCost;state.leather-=leatherCost;
 if(axe)state.reinforcedAxe=true;else state.reinforcedPickaxe=true;
 createToolVisual(type);updateHUD();saveGame();toast((axe?"Machado":"Picareta")+" reforçado! Agora rende mais recursos por coleta.");
}
function craftHerbalistHut(){
 if(state.herbalistHut){toast("A cabana do herbalista já foi construída.");return;}
 if(state.wood<8||state.stone<4){toast("Faltam materiais: 8 madeiras e 4 pedras.");return;}
 const yaw=Math.round(state.cameraYaw/(Math.PI/2))*(Math.PI/2);
 const x=Math.round((player.position.x+Math.sin(yaw)*6)/3)*3;
 const z=Math.round((player.position.z+Math.cos(yaw)*6)/3)*3;
 state.wood-=8;state.stone-=4;state.herbalistHut={x,z,yaw};createHerbalistHut(state.herbalistHut);
 updateHUD();saveGame();toast("Cabana do herbalista construída! Aproxime-se para preparar bálsamos.");
}
function createHerbalistHut(data){
 const group=new THREE.Group();
 const timber=new THREE.MeshStandardMaterial({color:0x67452c,roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:0x38291e,roughness:1});
 const plaster=new THREE.MeshStandardMaterial({color:0xb6a17b,roughness:1});
 const roofMat=new THREE.MeshStandardMaterial({color:0x4e3928,roughness:1});
 const body=new THREE.Mesh(new THREE.BoxGeometry(2.7,1.8,2.4),plaster);body.position.y=1;group.add(body);
 for(const x of [-1.38,1.38])for(const z of [-1.22,1.22]){const post=new THREE.Mesh(new THREE.BoxGeometry(.16,2.15,.16),timber);post.position.set(x,1.08,z);group.add(post);}
 const roof=new THREE.Mesh(new THREE.ConeGeometry(2.15,1.05,4),roofMat);roof.rotation.y=Math.PI/4;roof.position.y=2.45;group.add(roof);
 const door=new THREE.Mesh(new THREE.BoxGeometry(.78,1.45,.12),dark);door.position.set(0,.73,1.26);group.add(door);
 const sign=new THREE.Mesh(new THREE.BoxGeometry(.95,.42,.09),timber);sign.position.set(0,1.9,1.29);group.add(sign);
 const crossA=new THREE.Mesh(new THREE.BoxGeometry(.09,.28,.1),new THREE.MeshStandardMaterial({color:0x8e3029,roughness:1}));crossA.position.set(0,1.9,1.35);group.add(crossA);
 const crossB=new THREE.Mesh(new THREE.BoxGeometry(.28,.09,.1),new THREE.MeshStandardMaterial({color:0x8e3029,roughness:1}));crossB.position.set(0,1.9,1.35);group.add(crossB);
 for(let i=0;i<3;i++){const pot=new THREE.Mesh(new THREE.CylinderGeometry(.2,.25,.32,8),new THREE.MeshStandardMaterial({color:0x8a5636,roughness:1}));pot.position.set(-.75+i*.75,.18,1.65);group.add(pot);const herb=new THREE.Mesh(new THREE.SphereGeometry(.19,7,6),new THREE.MeshStandardMaterial({color:0x557344,roughness:1}));herb.scale.y=1.4;herb.position.set(-.75+i*.75,.48,1.65);group.add(herb);}
 group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 group.position.set(data.x,terrainHeight(data.x,data.z),data.z);group.rotation.y=data.yaw;scene.add(group);state.herbalistObject=group;
}
function craftSalve(){
 if(!state.nearHerbalist){toast("Aproxime-se da cabana do herbalista.");return;}
 if(state.herbs<2||state.fiber<1){toast("Você precisa de 2 ervas medicinais e 1 fibra por bálsamo.");return;}
 state.herbs-=2;state.fiber-=1;state.healingSalve++;
 updateHUD();saveGame();toast("Bálsamo medicinal preparado! Ele recupera até 45 pontos de vida.");
}
function useSalve(){
 if(state.healingSalve<1||state.health>=100){toast("Você não tem bálsamo ou sua vida já está completa.");return;}
 state.healingSalve--;state.health=Math.min(100,state.health+45);
 updateHUD();saveGame();toast("Bálsamo utilizado: até 45 pontos de vida recuperados.");
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
 const iron=type==="axe"?(state.ironAxe||state.steelAxe):(state.ironPickaxe||state.steelPickaxe);
 const upgraded=type==="axe"?state.reinforcedAxe:state.reinforcedPickaxe;
 const metalMat=new THREE.MeshStandardMaterial({color:iron?(type==="axe"?(state.steelAxe?0xe4edf2:0x9eafb8):(state.steelPickaxe?0xe4edf2:0x9eafb8)):upgraded?0xc68b36:0xd8e1e4,metalness:iron?.94:upgraded?.48:.2,roughness:iron?(type==="axe"?(state.steelAxe?.12:.2):(state.steelPickaxe?.12:.2)):upgraded?.24:.3,emissive:iron?0x25333a:upgraded?0x54300c:0x303b40,emissiveIntensity:.35});

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

function createIronHelmetVisual(){
 if(state.helmetObject?.parent)state.helmetObject.parent.remove(state.helmetObject);
 const g=new THREE.Group();
 const iron=new THREE.MeshStandardMaterial({color:state.steelHelmet?0xdce8ed:0x87949b,metalness:state.steelHelmet?.94:.78,roughness:state.steelHelmet?.16:.28});
 const dark=new THREE.MeshStandardMaterial({color:0x3b454b,metalness:.58,roughness:.38});
 const leather=new THREE.MeshStandardMaterial({color:0x493020,roughness:.95});
 const dome=new THREE.Mesh(new THREE.SphereGeometry(.34,14,10,0,Math.PI*2,0,Math.PI*.58),iron);dome.scale.set(1,1.12,1);dome.position.y=.12;g.add(dome);
 const brow=new THREE.Mesh(new THREE.BoxGeometry(.68,.09,.39),dark);brow.position.set(0,-.02,.02);g.add(brow);
 const nasal=new THREE.Mesh(new THREE.BoxGeometry(.075,.34,.09),iron);nasal.position.set(0,-.19,.31);g.add(nasal);
 for(const x of [-.29,.29]){const cheek=new THREE.Mesh(new THREE.BoxGeometry(.1,.34,.22),iron);cheek.position.set(x,-.24,.06);cheek.rotation.z=x<0?-.12:.12;g.add(cheek);}
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.31,.035,6,18),dark);rim.rotation.x=Math.PI/2;rim.position.y=-.06;g.add(rim);
 const liner=new THREE.Mesh(new THREE.CylinderGeometry(.25,.28,.07,12),leather);liner.position.y=-.12;g.add(liner);
 g.scale.setScalar(.88);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material.side=THREE.DoubleSide;}});
 let head=null;const rig=state.characterModel||null;
 if(rig)rig.traverse(o=>{if(!head&&/(head|neck)/i.test(o.name||""))head=o;});
 state.helmetHead=head;
 if(head){head.add(g);g.position.set(0,.12,0);}else{player.add(g);g.position.set(0,1.72,0);}
 state.helmetObject=g;
}
function createIronChestplateVisual(){
 if(state.ironChestObject?.parent)state.ironChestObject.parent.remove(state.ironChestObject);
 const g=new THREE.Group();
 const steel=new THREE.MeshStandardMaterial({color:state.steelChestplate?0xdce8ed:0x849198,metalness:state.steelChestplate?.94:.8,roughness:state.steelChestplate?.16:.3});
 const dark=new THREE.MeshStandardMaterial({color:0x465159,metalness:.68,roughness:.38});
 const brass=new THREE.MeshStandardMaterial({color:0x9b7944,metalness:.62,roughness:.36});
 // Couraça sobre a roupa, com placas articuladas e rebites dourados.
 const torso=new THREE.Mesh(new THREE.BoxGeometry(.76,.72,.38),steel);torso.position.set(0,1.13,.13);g.add(torso);
 for(const x of [-.24,0,.24]){
  const plate=new THREE.Mesh(new THREE.BoxGeometry(.22,.66,.055),dark);plate.position.set(x,1.13,.34);g.add(plate);
  for(const y of [.91,1.12,1.34]){const rivet=new THREE.Mesh(new THREE.SphereGeometry(.027,8,6),brass);rivet.position.set(x,y,.375);g.add(rivet);}
 }
 for(const x of [-.43,.43]){
  const shoulder=new THREE.Mesh(new THREE.SphereGeometry(.23,10,8),steel);shoulder.scale.set(1,.62,1.12);shoulder.position.set(x,1.48,.04);g.add(shoulder);
  const band=new THREE.Mesh(new THREE.BoxGeometry(.12,.5,.4),dark);band.position.set(x<0?-.32:.32,1.12,-.12);band.rotation.z=x<0?-.18:.18;g.add(band);
 }
 const waist=new THREE.Mesh(new THREE.BoxGeometry(.72,.13,.38),dark);waist.position.set(0,.76,.08);g.add(waist);
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
 player.add(g);state.ironChestObject=g;
}
function applySteelShieldPose(g){
  if(state.steelShieldGuarding){g.position.set(-.62,1.12,-.72);g.rotation.set(-.12,-.08,-.18);}
  else{g.position.set(-.55,1.02,-.34);g.rotation.set(0,-.22,0);}
}
function setSteelShieldGuarding(){
  if(!state.steelShield){toast("Fabrique primeiro o escudo de aço na forja.");return;}
  state.steelShieldGuarding=!state.steelShieldGuarding;
  if(state.steelShieldObject)applySteelShieldPose(state.steelShieldObject);
  $("guardShieldBtn").textContent=state.steelShieldGuarding?"🛡️ BAIXAR ESCUDO":"🛡️ ERGUER ESCUDO";
  updateHUD();saveGame();toast(state.steelShieldGuarding?"Escudo em posição de defesa. Proteção reforçada; energia será consumida.":"Escudo abaixado. Energia preservada.");
}
function createSteelShieldVisual(){
  if(state.steelShieldObject?.parent)state.steelShieldObject.parent.remove(state.steelShieldObject);
  const g=new THREE.Group();
  const steel=new THREE.MeshStandardMaterial({color:0xdce8ed,metalness:.94,roughness:.16});
  const dark=new THREE.MeshStandardMaterial({color:0x465159,metalness:.72,roughness:.3});
  const wood=new THREE.MeshStandardMaterial({color:0x684326,roughness:.9});
  const shape=new THREE.Shape();
  shape.moveTo(0,.62);shape.quadraticCurveTo(.42,.58,.48,.32);shape.lineTo(.38,-.28);shape.quadraticCurveTo(.22,-.58,0,-.72);shape.quadraticCurveTo(-.22,-.58,-.38,-.28);shape.lineTo(-.48,.32);shape.quadraticCurveTo(-.42,.58,0,.62);
  const plate=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.025}),steel);g.add(plate);
  const inset=new THREE.Mesh(new THREE.ShapeGeometry(shape),wood);inset.position.z=.105;inset.scale.set(.78,.78,1);g.add(inset);
  const boss=new THREE.Mesh(new THREE.SphereGeometry(.13,12,10),dark);boss.position.set(0,0,.15);g.add(boss);
  for(const x of [-.31,.31])for(const y of [-.2,.25]){const rivet=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),dark);rivet.position.set(x,y,.14);g.add(rivet);}
  const strap=new THREE.Mesh(new THREE.BoxGeometry(.12,.78,.07),dark);strap.position.set(0,0,-.07);g.add(strap);
  g.scale.setScalar(.78);applySteelShieldPose(g);
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  player.add(g);state.steelShieldObject=g;
}
function createSteelSpearVisual(){
  if(state.steelSpearObject?.parent)state.steelSpearObject.parent.remove(state.steelSpearObject);
  const g=new THREE.Group();
  const shaftMat=new THREE.MeshStandardMaterial({color:0x76502e,roughness:.9});
  const steel=new THREE.MeshStandardMaterial({color:0xdce8ed,metalness:.94,roughness:.18});
  const dark=new THREE.MeshStandardMaterial({color:0x4a5359,metalness:.72,roughness:.28});
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,2.25,9),shaftMat);shaft.position.y=.08;g.add(shaft);
  const blade=new THREE.Mesh(new THREE.ConeGeometry(.13,.52,6),steel);blade.position.y=1.42;g.add(blade);
  const socket=new THREE.Mesh(new THREE.CylinderGeometry(.075,.06,.22,8),dark);socket.position.y=1.15;g.add(socket);
  const butt=new THREE.Mesh(new THREE.ConeGeometry(.07,.18,6),dark);butt.rotation.z=Math.PI;butt.position.y=-1.08;g.add(butt);
  g.position.set(.38,1.12,.22);g.rotation.set(.08,0,-.48);g.scale.setScalar(.82);
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  player.add(g);state.steelSpearObject=g;
}
function craftSteelSpear(){
  if(!state.nearSmithy||!state.smithy){toast("Aproxime-se da forja comunitária.");return;}
  if(state.steelSpear){toast("Você já possui uma lança de aço.");return;}
  if(state.steelIngots<3||state.wood<2||state.leather<1){toast("A lança exige 3 lingotes de aço, 2 madeiras e 1 couro.");return;}
  state.steelIngots-=3;state.wood-=2;state.leather--;state.steelSpear=true;
  if(characterReady)createSteelSpearVisual();
  updateHUD();saveGame();toast("Lança de aço fabricada! Alcance de ataque aumentado para 5,4 m.");
}
function createIronSwordVisual(){
 if(state.swordObject?.parent)state.swordObject.parent.remove(state.swordObject);
 const group=new THREE.Group();
 const steel=new THREE.MeshStandardMaterial({color:state.steelSword?0xe0edf2:0xc8d2d8,metalness:state.steelSword?.94:.82,roughness:state.steelSword?.14:.22});
 const darkSteel=new THREE.MeshStandardMaterial({color:0x59636b,metalness:.72,roughness:.3});
 const leather=new THREE.MeshStandardMaterial({color:0x4b2d1d,roughness:.92});
 const blade=new THREE.Mesh(new THREE.BoxGeometry(.13,.92,.045),steel);blade.position.y=.56;group.add(blade);
 const tip=new THREE.Mesh(new THREE.ConeGeometry(.092,.22,4),steel);tip.rotation.z=Math.PI;tip.position.y=1.12;group.add(tip);
 const fuller=new THREE.Mesh(new THREE.BoxGeometry(.025,.62,.012),darkSteel);fuller.position.set(0,.58,.027);group.add(fuller);
 const guard=new THREE.Mesh(new THREE.BoxGeometry(.48,.09,.11),darkSteel);guard.position.y=.08;group.add(guard);
 const grip=new THREE.Mesh(new THREE.CylinderGeometry(.055,.06,.28,10),leather);grip.position.y=-.1;group.add(grip);
 const pommel=new THREE.Mesh(new THREE.SphereGeometry(.085,10,8),darkSteel);pommel.position.y=-.27;group.add(pommel);
 group.position.set(0,0,0);group.rotation.set(0,0,-.16);
 group.scale.setScalar(.82);
 group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;o.renderOrder=100;o.material.side=THREE.DoubleSide;o.material.depthTest=false;o.material.depthWrite=false;}});
 let hand=null;const rig=state.characterModel||null;
 if(rig)rig.traverse(o=>{if(!hand&&/^fist[._ ]?r$/i.test(o.name||""))hand=o;});
 state.swordHand=hand;
 if(hand){hand.add(group);group.position.set(0,0,0);}
 else{player.add(group);group.position.set(.48,1.05,-.30);}
 state.swordObject=group;
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
 if(state.swordObject){
  if(state.swordHand&&state.swordObject.parent!==state.swordHand){state.swordHand.add(state.swordObject);state.swordObject.position.set(0,0,0);}
  else if(!state.swordHand&&state.swordObject.parent!==player){player.add(state.swordObject);state.swordObject.position.set(.48,1.05,-.30);}
  state.swordObject.visible=true;
 }
 if(state.ironChestObject&&state.ironChestObject.parent!==player){player.add(state.ironChestObject);}
 if(state.ironChestObject)state.ironChestObject.visible=true;
 if(state.helmetObject){
  if(state.helmetHead&&state.helmetObject.parent!==state.helmetHead){state.helmetHead.add(state.helmetObject);state.helmetObject.position.set(0,.12,0);}
  else if(!state.helmetHead&&state.helmetObject.parent!==player){player.add(state.helmetObject);state.helmetObject.position.set(0,1.72,0);}
  state.helmetObject.visible=true;
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
 if(e.key==="Tab"&&activeBuildPlacement){e.preventDefault();toggleBuildPlacementPanel();return;}
 keys[e.key.toLowerCase()]=true;
 if(e.key.toLowerCase()==="e")collect();
 if(e.key==="Shift")state.running=true;
 if(e.code==="Space"){e.preventDefault();jumpCharacter();}
 if(e.key.toLowerCase()==="f")attackCharacter();
});
addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;if(e.key==="Shift")state.running=false;});
$("jumpBtn").addEventListener("click",jumpCharacter);
$("attackBtn").addEventListener("click",attackCharacter);
  $("guardShieldBtn").addEventListener("click",setSteelShieldGuarding);
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
function updateSteelSpearThrust(dt){
 const spear=state.steelSpearObject;
 if(!spear)return;
 if(spearThrustTime>0){
  spearThrustTime=Math.max(0,spearThrustTime-dt);
  const progress=1-spearThrustTime/.34;
  const thrust=Math.sin(progress*Math.PI);
  spear.position.z=.22+thrust*.72;
  spear.rotation.x=.08+thrust*.95;
 }else{spear.position.z=.22;spear.rotation.x=.08;}
}
function update(dt){
 const nowMs=Date.now();
 for(const r of resources){if(r.type==="fiber"&&!r.active&&r.respawnAt&&nowMs>=r.respawnAt){r.active=true;r.respawnAt=0;r.object.visible=true;toast("Uma planta fibrosa cresceu novamente.");}}
 updateWorldLighting(dt);
 updateForestFireflies(dt);
 updateCampfireVisuals(dt);
 updateSteelSpearThrust(dt);
  if(state.steelShieldGuarding){state.energy=Math.max(0,state.energy-dt*.65);if(state.energy<=0){state.steelShieldGuarding=false;if(state.steelShieldObject)applySteelShieldPose(state.steelShieldObject);$("guardShieldBtn").textContent="🛡️ ERGUER ESCUDO";toast("Você ficou sem energia e baixou o escudo.");}}
 updateWildlife(dt);
 updateFlyingArrows(dt);
 const kx=(keys.a?1:0)-(keys.d?1:0)+(keys.arrowright?1:0)-(keys.arrowleft?1:0);
 const ky=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0);
 const mx=THREE.MathUtils.clamp(state.moveX+kx,-1,1),my=THREE.MathUtils.clamp(state.moveY+ky,-1,1);
 const moving=!activeBuildPlacement&&Math.hypot(mx,my)>.08;
 const fast=(state.running||keys.shift)&&state.energy>0;
 if(moving){
  const direction=new THREE.Vector3(mx,0,my).normalize();
  const angle=state.cameraYaw;
  // Corrige o eixo horizontal relativo à câmera: direita no joystick move para a direita da tela.
  const dx=direction.x*Math.cos(angle)+direction.z*Math.sin(angle);
  const dz=-direction.x*Math.sin(angle)+direction.z*Math.cos(angle);
  // O deslocamento acompanha o relevo: subir reduz um pouco a velocidade e descer permite ganhar ritmo.
  const currentGround=terrainHeight(player.position.x,player.position.z);
  const lookAhead=1.6;
  const terrainRise=terrainHeight(player.position.x+dx*lookAhead,player.position.z+dz*lookAhead)-currentGround;
  // As botas de couro oferecem aderência extra em subidas e descidas íngremes.
   const bootGrip=state.leatherBoots?.78:1;
   const slopeSpeed=THREE.MathUtils.clamp(1-terrainRise*.24*bootGrip,.78,1.12);
  const speed=(fast?7.1:3.6)*slopeSpeed;
  player.position.x+=dx*speed*dt;player.position.z+=dz*speed*dt;
  state.yaw=Math.atan2(dx,dz);player.rotation.y=state.yaw;
  // Subidas íngremes exigem esforço; descidas suaves ajudam a recuperar o fôlego.
  const uphillEffort=THREE.MathUtils.clamp(terrainRise*.9*bootGrip,0,1.15);
  const downhillRelief=THREE.MathUtils.clamp(-terrainRise*.55,0,.55);
  if(fast)state.energy=Math.max(0,state.energy-dt*(2.5+uphillEffort*.9));
  else if(uphillEffort>.18)state.energy=Math.max(0,state.energy-dt*uphillEffort*.32);
  else state.energy=Math.min(100,state.energy+dt*(1.2+downhillRelief));
 }else{state.energy=Math.min(100,state.energy+dt*4);}
 const fireDistance=state.campfire?Math.hypot(player.position.x-state.campfireX,player.position.z-state.campfireZ):Infinity;
 const fireWarmth=THREE.MathUtils.clamp(1-(fireDistance-2)/8,0,1);
 const nearFire=fireWarmth>.5;
 const nearShelter=state.shelter&&Math.hypot(player.position.x-state.shelterX,player.position.z-state.shelterZ)<5;
 const fireStatus=$("fireWarmthStatus");
 if(fireStatus){
  fireStatus.hidden=!state.campfire||fireWarmth<=0;
  if(!fireStatus.hidden){
   $("fireWarmthFill").style.width=Math.round(fireWarmth*100)+"%";
   $("fireWarmthLabel").textContent=fireWarmth>.72?"🔥 CALOR FORTE":fireWarmth>.35?"🔥 CALOR MODERADO":"🔥 CALOR FRACO";
  }
 }
 // O calor da fogueira diminui gradualmente com a distância, em vez de desligar de uma vez.
 if(!moving)state.energy=Math.min(100,state.energy+dt*4);
 if(fireWarmth>0){
  state.energy=Math.min(100,state.energy+dt*(1.5+3.5*fireWarmth));
  state.temperature=Math.min(100,state.temperature+dt*(1.5+7.5*fireWarmth));
 }else{
  const daylight=THREE.MathUtils.clamp(Math.sin((state.timeOfDay-6)/12*Math.PI),0,1);
  let coldRate=state.timeOfDay<6||state.timeOfDay>=19?.42:.10;
  if(nearShelter)coldRate*=.2;
  if(state.coldCloak)coldRate*=.45;
  if(state.leatherBoots)coldRate*=.7;
  if(state.woolGarment)coldRate*=.72;
  state.temperature=THREE.MathUtils.clamp(state.temperature+dt*(daylight*.32-coldRate),0,100);
 }
 const floorY=terrainHeight(player.position.x,player.position.z);
 if(isJumping){
  verticalVelocity-=12*dt;
  player.position.y+=verticalVelocity*dt;
  if(player.position.y<=floorY){player.position.y=floorY;verticalVelocity=0;isJumping=false;lockedAnimation=null;}
 }else{player.position.y=floorY;}
 updateCharacterTerrainTilt();
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
  let nearSheepPen=-1,sheepPenDistance=4.8;
  for(let i=0;i<state.sheepPens.length;i++){const pen=state.sheepPens[i],d=Math.hypot(player.position.x-pen.x,player.position.z-pen.z);if(d<sheepPenDistance){sheepPenDistance=d;nearSheepPen=i;}}
  state.nearSheepPenIndex=nearSheepPen;
  state.nearLoom=!!state.loom&&Math.hypot(player.position.x-state.loom.x,player.position.z-state.loom.z)<4.5;
  state.nearSmokehouse=!!state.smokehouse&&Math.hypot(player.position.x-state.smokehouse.x,player.position.z-state.smokehouse.z)<4.8;
  state.nearHerbalist=!!state.herbalistHut&&Math.hypot(player.position.x-state.herbalistHut.x,player.position.z-state.herbalistHut.z)<4.8;
  state.nearTannery=!!state.tannery&&Math.hypot(player.position.x-state.tannery.x,player.position.z-state.tannery.z)<4.8;
  state.nearSmithy=!!state.smithy&&Math.hypot(player.position.x-state.smithy.x,player.position.z-state.smithy.z)<4.8;
  let nearHerbBed=-1,herbBedDistance=4.2;for(let i=0;i<state.herbBeds.length;i++){const bed=state.herbBeds[i],d=Math.hypot(player.position.x-bed.x,player.position.z-bed.z);if(d<herbBedDistance){herbBedDistance=d;nearHerbBed=i;}}state.nearHerbBedIndex=nearHerbBed;
  const gardenActionButton=$("gardenAction");
  gardenActionButton.hidden=nearGarden<0;
  if(nearGarden>=0){
   const plot=state.gardenPlots[nearGarden],ready=plot.plantedAt>0&&Date.now()-plot.plantedAt>=150000;
   gardenActionButton.textContent=ready?"COLHER FRUTAS (+6)":plot.plantedAt>0?"CULTIVO CRESCENDO":"PLANTAR 3 FRUTAS";
   gardenActionButton.disabled=!ready&& (plot.plantedAt>0||state.berries<3);
  }
  updateHUD();
 if(state.hunger<=0||state.thirst<=0||state.temperature<=0){state.health=Math.max(0,state.health-dt*.7*(state.leatherArmor?.65:1)*(state.steelHelmet?.55:state.ironHelmet?.75:1)*(state.steelChestplate?.35:state.ironChestplate?.55:1)*(state.steelShield?(state.steelShieldGuarding?.4:.8):1));}
}
function animate(now){
 requestAnimationFrame(animate);
 const dt=Math.min((now-last)/1000,.05);last=now;
 update(dt);if(activeBuildPlacement)updateBuildPreview();if(now-lastSave>5000){saveGame();lastSave=now;}renderer.render(scene,camera);
}
addEventListener("keydown",e=>{if(e.key==="Escape"&&activeBuildPlacement)cancelBuildPlacement();});
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));});
async function start(){
 $("loadingText").textContent="Criando o terreno e a floresta...";
 $("loadingBar").style.width="20%";
 await buildForest();
 createForestFireflies();
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
 for(const pen of state.sheepPens)createSheepPen(pen);
 if(state.loom)createLoom(state.loom);
 if(state.smokehouse)createSmokehouse(state.smokehouse);
 if(state.herbalistHut)createHerbalistHut(state.herbalistHut);
 if(state.tannery)createTannery(state.tannery);
 if(state.smithy)createSmithy(state.smithy);
  if(state.steelFurnace)createSteelFurnace(state.steelFurnace);
 for(const bed of state.herbBeds)createHerbBed(bed);
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
