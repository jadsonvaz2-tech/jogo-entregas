// Feiras, celebrações da colheita e festivais sazonais nas quatro povoações.
export function createCommunityEvents({THREE,scene,terrainHeight,centers,onToast=()=>{}}){
  const wood=new THREE.MeshStandardMaterial({color:0x65452d,roughness:1});
  const cloth=[0x9c493b,0x536f55,0xb28a45,0x526b83].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
  const gold=new THREE.MeshStandardMaterial({color:0xd0ad62,roughness:.8,metalness:.12});
  const stone=new THREE.MeshStandardMaterial({color:0x77756b,roughness:1});
  const fire=new THREE.MeshStandardMaterial({color:0xe18b39,emissive:0x8c3e10,emissiveIntensity:.7});
  const makeBox=(parent,size,pos,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const makePole=(parent,x,z,height,color)=>{
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,height,6),wood);pole.position.set(x,height/2,z);pole.castShadow=true;parent.add(pole);
    const flag=makeBox(parent,[.72,.42,.055],[x+.38,height-.3,z],cloth[color%cloth.length]);flag.rotation.z=-.12;
  };
  function buildFair(center,index){
    const g=new THREE.Group();g.position.set(center.x,terrainHeight(center.x,center.z),center.z);
    for(const side of [-1,1]){
      const x=side*5;makeBox(g,[3.8,.16,2.6],[x,1.55,0],wood);
      for(const dx of [-1.65,1.65])for(const z of [-1.05,1.05])makeBox(g,[.14,1.5,.14],[x+dx,.75,z],wood);
      const canopy=makeBox(g,[4.1,.22,2.9],[x,2.45,0],cloth[(index+side+4)%4]);canopy.rotation.z=.025;
      for(let n=0;n<3;n++){const basket=new THREE.Mesh(new THREE.CylinderGeometry(.32,.25,.38,8),wood);basket.position.set(x-1.1+n*1.1,1.83,.25);g.add(basket);const goods=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),cloth[(index+n)%4]);goods.position.set(x-1.1+n*1.1,2.08,.25);g.add(goods);}
    }
    makePole(g,-8,-2.6,3.4,index);makePole(g,8,-2.6,3.4,index+1);g.visible=false;scene.add(g);return g;
  }
  function buildHarvest(center,index){
    const g=new THREE.Group();g.position.set(center.x,terrainHeight(center.x,center.z),center.z);
    const platform=new THREE.Mesh(new THREE.CylinderGeometry(2.8,3.1,.22,12),stone);platform.position.y=.12;g.add(platform);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,fruit=new THREE.Mesh(new THREE.SphereGeometry(.32,10,8),cloth[(index+i)%4]);fruit.position.set(Math.cos(a)*1.9,.55,Math.sin(a)*1.9);g.add(fruit);}
    for(const x of [-4.2,4.2])makePole(g,x,0,3.1,index+2);g.visible=false;scene.add(g);return g;
  }
  function buildFestival(center,index){
    const g=new THREE.Group();g.position.set(center.x,terrainHeight(center.x,center.z),center.z);
    for(const x of [-5,5])makePole(g,x,0,4,index+1);
    makeBox(g,[10,.07,.07],[0,3.55,0],wood);
    for(let i=0;i<7;i++){const flag=makeBox(g,[.62,.72,.06],[-4.2+i*1.4,3.12,0],cloth[(i+index)%4]);flag.rotation.z=.08;}
    const hearth=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.45,.35,10),stone);hearth.position.y=.2;g.add(hearth);
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.42,1.25,8),fire);flame.position.y=1.05;g.add(flame);
    g.visible=false;scene.add(g);return g;
  }
  const villages=centers.map((center,index)=>({fair:buildFair(center,index),harvest:buildHarvest(center,index),festival:buildFestival(center,index)}));
  let activeKey="";
  function update(state){
    const day=Math.max(1,Math.floor(Number(state.day)||1)),hour=Number(state.timeOfDay)||0;
    let type="";
    if(day%28===0&&hour>=15&&hour<22)type="festival";
    else if(day%7===0&&hour>=16&&hour<22)type="harvest";
    else if(day%3===0&&hour>=9&&hour<17)type="fair";
    const key=type?day+":"+type:"";
    for(const village of villages){village.fair.visible=type==="fair";village.harvest.visible=type==="harvest";village.festival.visible=type==="festival";}
    if(key&&key!==activeKey){const names={fair:"A feira comunitária começou nas quatro aldeias.",harvest:"As aldeias celebram a colheita desta semana.",festival:"O festival sazonal reúne as quatro povoações."};onToast(names[type]);}
    activeKey=key;
  }
  return {update,destroy(){for(const village of villages){scene.remove(village.fair,village.harvest,village.festival);}}};
}
