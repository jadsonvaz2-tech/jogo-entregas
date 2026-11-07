// Hospedarias, viajantes e caravanas. O sistema usa apenas o estado já existente do jogo.
export function createTravelNetwork({ THREE, scene, terrainHeight, centers, paths, player, state, onToast = () => {}, onSave = () => {} }) {
  const wood = new THREE.MeshStandardMaterial({color:0x60432c,roughness:1});
  const timber = new THREE.MeshStandardMaterial({color:0x3d2a1d,roughness:1});
  const plaster = new THREE.MeshStandardMaterial({color:0xb9a17a,roughness:1});
  const roof = new THREE.MeshStandardMaterial({color:0x594235,roughness:1});
  const cloth = [0x8f493b,0x526c58,0x9a7945,0x536b82].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
  const skin = new THREE.MeshStandardMaterial({color:0xc69a75,roughness:1});
  const dark = new THREE.MeshStandardMaterial({color:0x342b25,roughness:1});
  const inns = [];
  function box(parent,size,pos,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function addInn(center,index){
    const g=new THREE.Group();
    box(g,[7.2,3.5,6.2],[0,1.75,0],plaster);
    box(g,[7.8,.25,6.8],[0,3.55,0],timber);
    const left=box(g,[4.25,.28,7.3],[-1.75,4.1,0],roof);left.rotation.z=.55;
    const right=box(g,[4.25,.28,7.3],[1.75,4.1,0],roof);right.rotation.z=-.55;
    box(g,[1.2,2.2,.18],[0,1.15,3.12],timber);
    for(const x of [-2.25,2.25]){
      box(g,[1.1,1.0,.16],[x,2.2,3.14],wood);
      box(g,[.78,.7,.08],[x,2.2,3.25],cloth[index]);
      box(g,[.12,1.05,.12],[x,2.2,3.32],timber);
    }
    const sign=box(g,[2.65,.72,.18],[0,3.05,3.2],wood);
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext("2d");ctx.fillStyle="#493322";ctx.fillRect(0,0,512,128);ctx.strokeStyle="#d8bd82";ctx.lineWidth=8;ctx.strokeRect(6,6,500,116);
    ctx.fillStyle="#fff0ca";ctx.font="bold 43px Georgia";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("HOSPEDARIA",256,65);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const plaque=new THREE.Mesh(new THREE.PlaneGeometry(2.55,.62),new THREE.MeshStandardMaterial({map:texture,side:THREE.DoubleSide}));plaque.position.set(0,3.05,3.3);g.add(plaque);
    g.position.set(center.x-10,terrainHeight(center.x-10,center.z-1),center.z-1);g.rotation.y=.15*index;scene.add(g);
    inns.push({center,position:new THREE.Vector3(center.x-10,0,center.z-1)});
  }
  centers.forEach(addInn);
  function traveler(color,packColor){
    const root=new THREE.Group(),body=new THREE.Group();
    const tunic=new THREE.MeshStandardMaterial({color,roughness:1}),pack=new THREE.MeshStandardMaterial({color:packColor,roughness:1});
    const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.25,.55,3,7),tunic);torso.position.y=1.05;torso.castShadow=true;body.add(torso);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.19,8,7),skin);head.position.y=1.58;head.castShadow=true;body.add(head);
    const sack=new THREE.Mesh(new THREE.BoxGeometry(.38,.48,.25),pack);sack.position.set(0,1.15,-.28);sack.castShadow=true;body.add(sack);
    const legs=[];
    for(const x of [-.12,.12]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.42,3,6),dark);leg.position.set(x,.38,0);leg.castShadow=true;body.add(leg);legs.push(leg);}
    root.add(body);root.userData={legs,phase:Math.random()*6};return root;
  }
  const caravans=paths.map((path,index)=>{
    const group=new THREE.Group(),a=traveler(cloth[index].color||[0x8f493b,0x526c58,0x9a7945,0x536b82][index],0x795735);
    const b=traveler([0x526c58,0x9a7945,0x536b82,0x8f493b][index],0x60432c);b.position.x=1.0;b.scale.setScalar(.92);
    group.add(a,b);scene.add(group);
    return {group,path:path.map(([x,z])=>new THREE.Vector3(x,terrainHeight(x,z),z)),progress:index*.23,speed:.018+index*.001};
  });
  const button=document.createElement("button");button.type="button";button.hidden=true;button.textContent="🛏️ HOSPEDAR-SE";
  button.style.cssText="position:fixed;z-index:47;left:50%;bottom:236px;transform:translateX(-50%);padding:11px 17px;border:1px solid #d6b45d;border-radius:22px;background:rgba(48,39,29,.97);color:#fff0cc;font:800 11px system-ui;box-shadow:0 4px 16px #0008;touch-action:manipulation";
  document.body.appendChild(button);
  const panel=document.createElement("section");panel.hidden=true;
  panel.style.cssText="position:fixed;z-index:79;left:50%;top:50%;transform:translate(-50%,-50%);width:min(360px,calc(100vw - 30px));padding:18px;border:1px solid #d6b45d;border-radius:14px;background:linear-gradient(145deg,#403326,#1d251e);color:#f4e8cc;box-shadow:0 18px 55px #000b;font:13px/1.5 system-ui";
  panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;color:#e6c979;font:700 22px Georgia">Hospedaria</h2><button data-close style="padding:7px 10px;border:1px solid #a98b57;border-radius:7px;background:transparent;color:#fff0cc">FECHAR ✕</button></div><p data-description>Um quarto simples, uma refeição quente e descanso seguro.</p><p data-coins style="font-weight:800;color:#e8d39b"></p><button data-stay style="width:100%;min-height:44px;border:1px solid #c6a65e;border-radius:8px;background:#536744;color:#fff2d0;font-weight:800">ALUGAR QUARTO · 5 MOEDAS</button><p style="font-size:10px;color:#c2b89e">Uma noite de descanso recupera parte da energia e da saúde.</p>';
  document.body.appendChild(panel);
  const desc=panel.querySelector("[data-description]"),coins=panel.querySelector("[data-coins]"),stay=panel.querySelector("[data-stay]");
  let near=null;
  function refresh(){coins.textContent="Moedas disponíveis: "+(Number(state.coins)||0);stay.disabled=(Number(state.coins)||0)<5;stay.style.opacity=stay.disabled?".45":"1";}
  function open(){if(!near)return;desc.textContent="Bem-vindo à hospedaria de "+near.center.name+". Um quarto simples, uma refeição quente e descanso seguro.";refresh();panel.hidden=false;button.hidden=true;}
  button.addEventListener("click",open);
  panel.querySelector("[data-close]").addEventListener("click",()=>{panel.hidden=true;});
  stay.addEventListener("click",()=>{
    if((Number(state.coins)||0)<5)return;
    state.coins-=5;state.energy=Math.min(100,(Number(state.energy)||0)+45);state.health=Math.min(100,(Number(state.health)||0)+12);
    onSave();refresh();panel.hidden=true;onToast("Você descansou na hospedaria de "+near.center.name+". Energia e saúde recuperadas.");
  });
  function pointOnPath(path,t){
    const lengths=[];let total=0;
    for(let i=1;i<path.length;i++){const d=path[i].distanceTo(path[i-1]);lengths.push(d);total+=d;}
    let target=t*total;
    for(let i=0;i<lengths.length;i++){if(target<=lengths[i])return path[i].clone().lerp(path[i+1],target/lengths[i]);target-=lengths[i];}
    return path[path.length-1].clone();
  }
  return {update(dt){
    for(const caravan of caravans){
      caravan.progress=(caravan.progress+Math.max(0,dt)*caravan.speed)%(2);
      const t=caravan.progress<=1?caravan.progress:2-caravan.progress;
      const p=pointOnPath(caravan.path,t);caravan.group.position.set(p.x,p.y,p.z);
      const ahead=pointOnPath(caravan.path,Math.min(1,t+.012)),behind=pointOnPath(caravan.path,Math.max(0,t-.012));
      caravan.group.rotation.y=Math.atan2(ahead.x-behind.x,ahead.z-behind.z)+(caravan.progress>1?Math.PI:0);
      for(const person of caravan.group.children){const phase=(person.userData.phase+=dt*5);person.userData.legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(phase+i*Math.PI)*.42;});}
    }
    near=null;let closest=7;
    for(const inn of inns){const d=Math.hypot(player.position.x-inn.position.x,player.position.z-inn.position.z);if(d<closest){closest=d;near=inn;}}
    button.hidden=!near||!panel.hidden;
  }};
}
