// Clima e estações puramente visuais: não cria nem altera dados de salvamento.
export function createWeatherSystem({THREE,scene,player,sun,ambient,mobilePerformanceMode=false}){
  const hud=document.getElementById("hud")||document.body;
  const badge=document.createElement("div");
  badge.id="dynamicWeatherBadge";
  badge.setAttribute("aria-live","polite");
  badge.style.cssText="position:fixed;top:64px;right:12px;z-index:24;padding:6px 9px;border:1px solid rgba(225,218,190,.28);border-radius:8px;background:rgba(22,31,25,.76);color:#f4edda;font:600 10px/1.2 Georgia,serif;letter-spacing:.35px;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.22);";
  hud.appendChild(badge);
  const rainCount=mobilePerformanceMode?150:420,snowCount=mobilePerformanceMode?90:240;
  const rainPositions=new Float32Array(rainCount*6),snowPositions=new Float32Array(snowCount*3);
  const randomRange=(min,max)=>min+Math.random()*(max-min);
  function resetRain(i,initial=false){
    const p=i*6,x=randomRange(-25,25),z=randomRange(-25,25),y=initial?randomRange(2,25):randomRange(12,27);
    rainPositions[p]=x;rainPositions[p+1]=y;rainPositions[p+2]=z;
    rainPositions[p+3]=x+.045;rainPositions[p+4]=y-.58;rainPositions[p+5]=z+.025;
  }
  for(let i=0;i<rainCount;i++)resetRain(i,true);
  for(let i=0;i<snowCount;i++){const p=i*3;snowPositions[p]=randomRange(-24,24);snowPositions[p+1]=randomRange(1,24);snowPositions[p+2]=randomRange(-24,24);}
  const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute("position",new THREE.BufferAttribute(rainPositions,3));
  const rainMaterial=new THREE.LineBasicMaterial({color:0xc9d9e4,transparent:true,opacity:.38,depthWrite:false});
  const rain=new THREE.LineSegments(rainGeometry,rainMaterial);rain.frustumCulled=false;rain.visible=false;scene.add(rain);
  const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute("position",new THREE.BufferAttribute(snowPositions,3));
  const snowMaterial=new THREE.PointsMaterial({color:0xf4f5f1,size:mobilePerformanceMode ? 0.09 : 0.13,transparent:true,opacity:.82,depthWrite:false});
  const snow=new THREE.Points(snowGeometry,snowMaterial);snow.frustumCulled=false;snow.visible=false;scene.add(snow);
  const seasons=["PRIMAVERA","VERÃO","OUTONO","INVERNO"];
  const weatherNames={clear:"☀️ CÉU LIMPO",cloudy:"☁️ NUBLADO",rain:"🌧️ CHUVA",mist:"🌫️ NEBLINA",snow:"❄️ NEVE"};
  let lastKey="",condition="clear",season=0;
  let lightningCooldown=randomRange(7,14),lightningStrength=0;
  const baseFog=scene.fog&&Number.isFinite(scene.fog.density)?scene.fog.density:.0068;
  function choose(day,position){
    const safeDay=Math.max(1,Math.floor(Number(day)||1)),period=Math.floor((safeDay-1)/2);
    season=Math.floor(((safeDay-1)%112)/28);
    const roll=((period*9301+49297)%233280)/233280,north=position.x>65&&position.z< -45;
    if(season===3&&north&&roll>.42)return "snow";
    if(season===0)return roll<.36?"clear":roll<.59?"cloudy":roll<.84?"rain":"mist";
    if(season===1)return roll<.51?"clear":roll<.77?"cloudy":roll<.91?"rain":"mist";
    if(season===2)return roll<.32?"clear":roll<.57?"cloudy":roll<.83?"rain":"mist";
    return roll<.34?"clear":roll<.61?"cloudy":roll<.82?(north?"snow":"rain"):"mist";
  }
  function update(dt,day,hour,position){
    const safeDay=Math.max(1,Math.floor(Number(day)||1)),period=Math.floor((safeDay-1)/2);
    const north=position.x>65&&position.z< -45,key=period+":"+Math.floor(((safeDay-1)%112)/28)+":"+(north?"north":"south");
    if(key!==lastKey){lastKey=key;condition=choose(safeDay,position);badge.textContent=seasons[season]+" · "+weatherNames[condition];rain.visible=condition==="rain";snow.visible=condition==="snow";if(condition!=="rain")lightningStrength=0;}
    const fogFactor=condition==="mist" ? .013 : condition==="rain" ? .0088 : condition==="snow" ? .0082 : condition==="cloudy" ? .0076 : baseFog;
    if(scene.fog)scene.fog.density=fogFactor;
    rain.position.set(position.x,0,position.z);snow.position.set(position.x,0,position.z);
    const windX=1.8+Math.sin(hour*.7)*2.4,windZ=Math.cos(hour*.45)*1.1;
    if(condition==="rain"){
      for(let i=0;i<rainCount;i++){const p=i*6;rainPositions[p+1]-=dt*18;rainPositions[p+4]-=dt*18;rainPositions[p]+=windX*dt;rainPositions[p+2]+=windZ*dt;rainPositions[p+3]+=windX*dt;rainPositions[p+5]+=windZ*dt;if(rainPositions[p+1]<-1)resetRain(i);}
      rainGeometry.attributes.position.needsUpdate=true;
      lightningCooldown-=dt;
      if(lightningCooldown<=0){lightningStrength=1;lightningCooldown=randomRange(9,20);}
      lightningStrength=Math.max(0,lightningStrength-dt*5.5);
      const flash=lightningStrength*lightningStrength;
      if(sun)sun.intensity+=flash*2.6;
      if(ambient)ambient.intensity+=flash*1.1;
    }else if(condition==="snow"){
      for(let i=0;i<snowCount;i++){const p=i*3;snowPositions[p+1]-=dt*(.75+(i%7)*.11);snowPositions[p]+=((Math.sin(hour*1.7+i)*.22)+windX*.18)*dt;snowPositions[p+2]+=windZ*.18*dt;if(snowPositions[p+1]<-.5){snowPositions[p]=randomRange(-24,24);snowPositions[p+1]=randomRange(12,25);snowPositions[p+2]=randomRange(-24,24);}}
      snowGeometry.attributes.position.needsUpdate=true;
    }
  }
  return {update,destroy(){scene.remove(rain,snow);rainGeometry.dispose();snowGeometry.dispose();rainMaterial.dispose();snowMaterial.dispose();badge.remove();if(scene.fog)scene.fog.density=baseFog;}};
}
