import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const $ = (id) => document.getElementById(id);
const raw = "https://raw.githubusercontent.com/jadsonvaz2-tech/jogo-entregas/main/";
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

scene.add(new THREE.HemisphereLight(0xdce9df,0x46513a,2.0));
const sun = new THREE.DirectionalLight(0xffe2b3,2.1);
sun.position.set(-35,65,25); sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-55; sun.shadow.camera.right=55; sun.shadow.camera.top=55; sun.shadow.camera.bottom=-55;
scene.add(sun);

const groundGeo = new THREE.PlaneGeometry(260,260,100,100);
groundGeo.rotateX(-Math.PI/2);
const pos = groundGeo.attributes.position;
for(let i=0;i<pos.count;i++){
 const x=pos.getX(i), z=pos.getZ(i);
 const hill=Math.sin(x*.035)*1.8+Math.cos(z*.041)*1.6+Math.sin((x+z)*.022)*2.4;
 const clearing=Math.exp(-(x*x+z*z)/500)*-.5;
 pos.setY(i,hill+clearing);
}
groundGeo.computeVertexNormals();
const ground = new THREE.Mesh(groundGeo,new THREE.MeshStandardMaterial({color:0x526a42,roughness:1}));
ground.receiveShadow=true; scene.add(ground);

const player = new THREE.Group(); scene.add(player);
const fallback = new THREE.Group(); player.add(fallback);
const body = new THREE.Mesh(new THREE.CapsuleGeometry(.34,.9,5,8),new THREE.MeshStandardMaterial({color:0x59402b}));
body.position.y=.85; body.castShadow=true; fallback.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(.23,12,10),new THREE.MeshStandardMaterial({color:0xc49a75}));
head.position.y=1.55; head.castShadow=true; fallback.add(head);
let mixer=null, characterReady=false;
const loader = new GLTFLoader();
function loadCharacter(){
 return new Promise(resolve=>{
  loader.load(raw+"Viking_Male.gltf",g=>{
   const model=g.scene;
   const box=new THREE.Box3().setFromObject(model);
   const size=box.getSize(new THREE.Vector3());
   const center=box.getCenter(new THREE.Vector3());
   const scale=1.8/Math.max(size.y,.01);
   model.scale.setScalar(scale);
   model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
   model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material.side=THREE.DoubleSide;}}});
   player.remove(fallback); player.add(model);
   if(g.animations?.length){mixer=new THREE.AnimationMixer(model);mixer.clipAction(g.animations[0]).play();}
   characterReady=true; resolve(true);
  },undefined,()=>resolve(false));
 });
}
const treePositions=[];
for(let i=0;i<55;i++){
 const a=Math.random()*Math.PI*2, r=12+Math.random()*88;
 treePositions.push({x:Math.cos(a)*r,z:Math.sin(a)*r});
}
const treeModels=[];
async function loadTree(name){
 return new Promise(resolve=>loader.load(raw+name+".gltf",g=>resolve(g.scene),undefined,()=>resolve(null)));
}
function scatterModel(model,x,z,scale=1){
 if(!model)return;
 const m=model.clone(true);
 m.position.set(x,0,z); m.rotation.y=Math.random()*Math.PI*2;
 const s=scale*(.78+Math.random()*.5); m.scale.multiplyScalar(s);
 m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}}); scene.add(m); treeModels.push(m);
}
function addRock(x,z,s=1){
 const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.7*s,1),new THREE.MeshStandardMaterial({color:0x77786b,roughness:1}));
 rock.position.set(x,.35*s,z); rock.rotation.set(Math.random(),Math.random(),Math.random()); rock.scale.y=.65; rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
}
function addGrass(){
 const geo=new THREE.BufferGeometry(), verts=[];
 for(let i=0;i<1600;i++){
  const x=(Math.random()-.5)*210,z=(Math.random()-.5)*210;
  if(Math.hypot(x,z)<8)continue;
  const h=.18+Math.random()*.35,w=.035;
  verts.push(x-w,0,z,x+w,0,z,x,h,z);
 }
 geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x9aa66b,side:THREE.DoubleSide}));
 scene.add(mesh);
}
let resources=[];
function createResource(x,z){
 const stump=new THREE.Group();
 const log=new THREE.Mesh(new THREE.CylinderGeometry(.23,.3,.9,7),new THREE.MeshStandardMaterial({color:0x76502e}));
 log.rotation.z=Math.PI/2; log.position.y=.3; stump.add(log); stump.position.set(x,0,z); scene.add(stump);
 resources.push({object:stump,x,z,type:"wood",active:true});
}
async function buildForest(){
 const [common,pine,twisted,rock] = await Promise.all([loadTree("CommonTree_1"),loadTree("Pine_1"),loadTree("TwistedTree_1"),loadTree("Rock_Medium_1")]);
 const choices=[common,pine,twisted];
 treePositions.forEach((p,i)=>{
  if(Math.hypot(p.x,p.z)<10)return;
  scatterModel(choices[i%choices.length],p.x,p.z,.8+Math.random()*.55);
  if(i%5===0)createResource(p.x+2,p.z+1);
 });
 for(let i=0;i<35;i++){const a=Math.random()*6.28,r=9+Math.random()*85;addRock(Math.cos(a)*r,Math.sin(a)*r,.45+Math.random()*.9);}
 if(rock){for(let i=0;i<12;i++){const a=Math.random()*6.28,r=12+Math.random()*75;scatterModel(rock,Math.cos(a)*r,Math.sin(a)*r,.7);}}
 addGrass();
}

const state={health:100,hunger:100,thirst:100,energy:100,wood:0,stone:0,running:false,moveX:0,moveY:0,yaw:0,cameraYaw:0,cameraPitch:.22,day:1,near:null};
const cameraTarget=new THREE.Vector3();
let last=performance.now(),toastTimer=0;
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("show"),1900);}
function updateHUD(){
 $("healthBar").style.width=state.health+"%";$("hungerBar").style.width=state.hunger+"%";$("thirstBar").style.width=state.thirst+"%";$("energyBar").style.width=state.energy+"%";
 $("wood").textContent=state.wood;$("stone").textContent=state.stone;$("day").textContent=state.day;
 $("collectBtn").disabled=!state.near;
 $("hint").textContent=state.near?"Toque em COLETAR para pegar madeira.":"Explore a floresta e encontre recursos.";
}
function collect(){
 if(!state.near)return;
 state.wood+=2;state.near.object.visible=false;state.near.active=false;state.near=null;toast("Você coletou 2 madeiras.");updateHUD();
}
$("collectBtn").addEventListener("click",collect);
$("runBtn").addEventListener("click",()=>{state.running=!state.running;$("runBtn").textContent=state.running?"ANDAR":"CORRER";});
const joy=$("joystick"),stick=$("stick");
let joyPointer=null;
joy.addEventListener("pointerdown",e=>{joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e);});
joy.addEventListener("pointermove",e=>{if(e.pointerId===joyPointer)moveJoy(e);});
function moveJoy(e){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy),max=35;if(len>max){dx=dx/len*max;dy=dy/len*max;}stick.style.transform=`translate(${dx}px,${dy}px)`;state.moveX=dx/max;state.moveY=-dy/max;}
function resetJoy(e){if(e.pointerId!==joyPointer)return;joyPointer=null;state.moveX=0;state.moveY=0;stick.style.transform="translate(0,0)";}
joy.addEventListener("pointerup",resetJoy);joy.addEventListener("pointercancel",resetJoy);
const keys={};
addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==="e")collect();if(e.key==="Shift")state.running=true;});
addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;if(e.key==="Shift")state.running=false;});
let lookPointer=null,lastX=0,lastY=0;
renderer.domElement.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"||e.clientX>innerWidth*.38){lookPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);}});
renderer.domElement.addEventListener("pointermove",e=>{if(e.pointerId!==lookPointer)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;state.cameraYaw-=dx*.005;state.cameraPitch=THREE.MathUtils.clamp(state.cameraPitch+dy*.003,-.05,.75);});
renderer.domElement.addEventListener("pointerup",e=>{if(e.pointerId===lookPointer)lookPointer=null;});
renderer.domElement.addEventListener("pointercancel",e=>{if(e.pointerId===lookPointer)lookPointer=null;});
function update(dt){
 const kx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
 const ky=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0);
 const mx=THREE.MathUtils.clamp(state.moveX+kx,-1,1),my=THREE.MathUtils.clamp(state.moveY+ky,-1,1);
 const moving=Math.hypot(mx,my)>.08;
 const fast=state.running||keys.shift;
 if(moving){
  const direction=new THREE.Vector3(mx,0,my).normalize();
  const angle=state.cameraYaw;
  const dx=direction.x*Math.cos(angle)-direction.z*Math.sin(angle);
  const dz=direction.x*Math.sin(angle)+direction.z*Math.cos(angle);
  const speed=fast?7.1:3.6;
  player.position.x+=dx*speed*dt;player.position.z+=dz*speed*dt;
  state.yaw=Math.atan2(dx,dz);player.rotation.y=state.yaw;
  if(fast)state.energy=Math.max(0,state.energy-dt*2.5);else state.energy=Math.min(100,state.energy+dt*1.2);
 }else{state.energy=Math.min(100,state.energy+dt*4);}
 state.hunger=Math.max(0,state.hunger-dt*.055);state.thirst=Math.max(0,state.thirst-dt*.085);
 if(mixer)mixer.update(dt);
 cameraTarget.set(player.position.x,1.25,player.position.z);
 const distance=7.2,cp=Math.cos(state.cameraPitch),sp=Math.sin(state.cameraPitch);
 camera.position.set(player.position.x+Math.sin(state.cameraYaw)*distance*cp,1.25+distance*sp,player.position.z+Math.cos(state.cameraYaw)*distance*cp);
 camera.lookAt(cameraTarget);
 let closest=null,dist=4.5;
 for(const r of resources){if(!r.active)continue;const d=Math.hypot(player.position.x-r.x,player.position.z-r.z);if(d<dist){dist=d;closest=r;}}
 state.near=closest;updateHUD();
 if(state.hunger<=0||state.thirst<=0){state.health=Math.max(0,state.health-dt*.7);}
}
function animate(now){
 requestAnimationFrame(animate);
 const dt=Math.min((now-last)/1000,.05);last=now;
 update(dt);renderer.render(scene,camera);
}
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));});
async function start(){
 $("loadingText").textContent="Criando o terreno e a floresta...";
 $("loadingBar").style.width="20%";
 await buildForest();
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
start().catch(err=>{console.error(err);$("loadingText").textContent="Não foi possível carregar o cenário. Atualize a página.";toast("Falha ao iniciar o mundo.");});
