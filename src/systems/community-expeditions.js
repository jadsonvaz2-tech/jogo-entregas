const SAVE_KEY = "cronicas-floresta-community-expeditions-v1";
const DESTINATIONS = {
  mines:{label:"Serra das Minas",duration:90000,detail:"Trilhas rochosas e veios de minério nas encostas.",rewards:[["ironOre",4,7],["coal",3,5],["ironIngots",1,2]]},
  ruins:{label:"Ruínas do Norte",duration:120000,detail:"Antigas muralhas, ferramentas perdidas e ervas raras.",rewards:[["cutStone",3,6],["herbs",3,6],["honey",1,2]]},
  marsh:{label:"Pântano Antigo",duration:150000,detail:"Terreno alagado, fibras resistentes e peles raras.",rewards:[["herbs",4,7],["hide",2,4],["fiber",3,6],["leather",1,2]]}
};
const clampInt=(n,min,max)=>Math.max(min,Math.min(max,Math.floor(Number(n)||0)));
export function createCommunityExpeditions({villageResidents,state,onToast,onDiscovery=null,root=document.getElementById("communityExpeditionsPanel")}){
 if(!root||!villageResidents)return null;
 let saved={active:null,history:[],completed:0};
 const parse=value=>{try{const data=JSON.parse(value||"null");return data&&typeof data==="object"?data:null;}catch{return null;}};
 const primary=parse(localStorage.getItem(SAVE_KEY));
 const backup=parse(localStorage.getItem(SAVE_KEY+"-backup"));
 if(primary)saved={...saved,...primary};else if(backup)saved={...saved,...backup};
 if(!Array.isArray(saved.history))saved.history=[];
 saved.completed=clampInt(saved.completed,0,999999);
 let active=saved.active&&typeof saved.active==="object"?saved.active:null;
 let lastRender=0;
 const allRoster=()=>villageResidents.getExpeditionRoster?.()||[];
 const roster=()=>allRoster().filter(person=>!person.away);
 const stock=key=>villageResidents.getStockpile?.(key)||0;
 const persist=()=>{
  try{const previous=localStorage.getItem(SAVE_KEY);if(previous&&parse(previous))localStorage.setItem(SAVE_KEY+"-backup",previous);
   localStorage.setItem(SAVE_KEY,JSON.stringify({active,history:saved.history.slice(0,8),completed:saved.completed}));
  }catch(error){console.warn("Não foi possível salvar a expedição.",error);}
 };
 const el=id=>root.querySelector("#"+id);
 const makeRoster=()=>{
  const holder=el("expeditionParty");
  if(!holder)return;
  holder.innerHTML="";
  const people=roster();
  if(!people.length){holder.textContent="Não há moradores disponíveis no momento.";return;}
  people.forEach(person=>{
   const label=document.createElement("label");label.className="expedition-person";
   const input=document.createElement("input");input.type="checkbox";input.value=person.id;input.name="expedition-member";
   const name=document.createElement("span");name.textContent=person.name+" · "+person.role;
   label.append(input,name);holder.append(label);
  });
 };
 const requirements=()=>{
  const gear={weapon:stock("steelSwords")>0||stock("steelSpears")>0,armor:stock("steelHelmets")>0||stock("steelChestplates")>0,shield:stock("steelShields")>0};
  return gear;
 };
 const formatTime=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+"m "+String(s%60).padStart(2,"0")+"s";};
 const EVENT_DEFS={
  creature:{title:"ENCONTRO NA TRILHA",text:"Uma criatura selvagem surge entre as árvores e bloqueia a passagem. O grupo precisa decidir como agir.",choices:[{id:"stand",label:"Enfrentar a criatura",result:"O grupo manteve a posição e afastou a criatura.",rewards:[["hide",1,2],["meat",1,2]]},{id:"sneak",label:"Desviar silenciosamente",result:"Os moradores contornaram a ameaça sem se ferir, mas perderam tempo.",delay:18000,rewards:[["herbs",1,2]]},{id:"camp",label:"Montar um acampamento defensivo",result:"Uma pequena barricada protegeu o grupo durante a noite.",rewards:[["fiber",2,4],["meat",1,1]]}]},
  ruins:{title:"DESCOBERTA DE RUÍNAS",text:"O grupo encontrou uma construção antiga escondida pela vegetação. Há sinais de ferramentas e objetos esquecidos.",choices:[{id:"search",label:"Explorar as ruínas",result:"Os moradores vasculharam as salas e encontraram materiais raros.",rewards:[["cutStone",2,4],["ironIngots",1,1]]},{id:"careful",label:"Investigar com cautela",result:"O grupo mapeou a entrada e recolheu ervas e pedras úteis.",rewards:[["herbs",2,4],["cutStone",1,2]]},{id:"leave",label:"Registrar e seguir viagem",result:"A descoberta foi registrada para uma expedição futura.",rewards:[["honey",1,2]]}]},
  camp:{title:"ACAMPAMENTO TEMPORÁRIO",text:"A trilha se abre em uma clareira protegida. O grupo pode descansar e organizar os suprimentos antes de continuar.",choices:[{id:"rest",label:"Descansar e preparar alimentos",result:"O descanso renovou o ânimo dos moradores e melhorou a organização da carga.",rewards:[["berries",2,4],["herbs",1,2]]},{id:"scout",label:"Enviar batedores ao redor",result:"Os batedores encontraram recursos escondidos perto da clareira.",rewards:[["fiber",2,4],["hide",1,1]]},{id:"move",label:"Levantar acampamento e seguir",result:"O grupo aproveitou a pausa curta e manteve o ritmo da viagem.",rewards:[["berries",1,2]]}]}
 };
 const rollRewards=entries=>entries.map(([key,min,max])=>({key,amount:min+Math.floor(Math.random()*(max-min+1))}));
 const showEvent=()=>{
  if(!active||active.event||active.eventResolved)return;
  const types=active.destination==="ruins"?["ruins","creature","camp"]:active.destination==="marsh"?["creature","camp","ruins"]:["creature","ruins","camp"];
  const type=types[Math.floor(Math.random()*types.length)];
  const def=EVENT_DEFS[type];
  active.event={type,title:def.title,text:def.text,choices:def.choices.map(({id,label})=>({id,label}))};
  persist();renderEvent();
 };
 const renderEvent=()=>{
  const panel=el("expeditionEvent");
  if(!panel)return;
  panel.innerHTML="";
  if(!active?.event){panel.hidden=true;return;}
  panel.hidden=false;
  const heading=document.createElement("strong");heading.textContent=active.event.title;panel.append(heading);
  const description=document.createElement("p");description.textContent=active.event.text;panel.append(description);
  if(active.eventResolved){const outcome=document.createElement("p");outcome.className="expedition-event-result";outcome.textContent=active.eventResult||"O grupo concluiu o acontecimento.";panel.append(outcome);return;}
  const choices=EVENT_DEFS[active.event.type]?.choices||[];
  for(const choice of choices){const button=document.createElement("button");button.type="button";button.className="expedition-event-choice";button.textContent=choice.label;button.addEventListener("click",()=>resolveEvent(choice.id));panel.append(button);}
 };
 const resolveEvent=id=>{
  if(!active?.event||active.eventResolved)return;
  const choice=(EVENT_DEFS[active.event.type]?.choices||[]).find(item=>item.id===id);
  if(!choice)return;
  if(choice.delay)active.returnAt+=choice.delay;
  active.bonusRewards=rollRewards(choice.rewards||[]);
  active.eventResolved=true;
  active.eventResult=choice.result;
  // Uma chance pequena de encontrar um item raro durante a exploração.
  if(active.event.type==="ruins"&&id==="search"&&Math.random()<.22)active.bonusRewards.push({key:"honey",amount:2});
  if(active.event.type==="camp"&&id==="scout"&&Math.random()<.18)active.bonusRewards.push({key:"leather",amount:1});
  persist();renderEvent();refresh();
  onToast(choice.result);
 };

 const refresh=()=>{
  const people=roster(),gear=requirements();
  if(!active){el("expeditionActive").textContent="Nenhum grupo está fora da aldeia.";el("expeditionProgress").style.width="0%";el("expeditionStart").disabled=false;}
  else{
   const d=DESTINATIONS[active.destination]||DESTINATIONS.mines;
   const remain=Math.max(0,active.returnAt-Date.now());
   const progress=clampInt((1-remain/Math.max(1,active.returnAt-active.departedAt))*100,0,100);
   el("expeditionActive").textContent="Grupo em viagem para "+d.label+" · "+active.members.length+" moradores · retorno em "+formatTime(remain);
   el("expeditionProgress").style.width=progress+"%";el("expeditionStart").disabled=true;
  }
  el("expeditionGearStatus").textContent="Equipamento comunitário: "+(gear.weapon?"arma de aço ✓":"arma de aço em falta")+" · "+(gear.armor?"armadura de aço ✓":"armadura de aço em falta")+" · "+(gear.shield?"escudo ✓":"escudo opcional");
  el("expeditionKitStatus").textContent="Depósito: "+stock("fieldKits")+" kits comuns · "+stock("reinforcedFieldKits")+" reforçados · "+stock("berries")+" frutas · "+stock("meat")+" carnes";
  el("expeditionCompleted").textContent="Expedições concluídas: "+saved.completed;
  el("expeditionHistory").textContent=saved.history.length?saved.history.slice(0,3).map(item=>item.destination+" · "+item.members+" moradores · "+item.result).join(" | "):"As primeiras descobertas ainda aguardam.";
  renderEvent();
  root.querySelectorAll("input[name=expedition-member]").forEach(input=>{input.disabled=!!active;});
  el("expeditionDestination").disabled=!!active;el("expeditionLoad").disabled=!!active;
 };
 const start=()=>{
  if(active){onToast("Já existe um grupo em expedição.");return;}
  if(!Array.isArray(state?.expeditionTents)||state.expeditionTents.length<1){onToast("Monte ao menos uma tenda de expedição antes de enviar o grupo.");return;}
  const selected=[...root.querySelectorAll("input[name=expedition-member]:checked")].map(input=>input.value);
  if(selected.length<2||selected.length>4){onToast("Escolha de 2 a 4 moradores para a expedição.");return;}
  const available=new Set(roster().map(person=>person.id));
  if(selected.some(id=>!available.has(id))){onToast("Atualize a lista de moradores antes de partir.");makeRoster();return;}
  if(!villageResidents.getStockpile||!villageResidents.takeFromStockpile||!villageResidents.depositToStockpile){onToast("O depósito comunitário não está disponível.");return;}
  const gear=requirements();
  if(!gear.weapon||!gear.armor){onToast("Prepare uma arma e uma peça de armadura de aço no depósito comunitário.");return;}
  const load=el("expeditionLoad").value;
  const needs=load==="reinforced"?{reinforcedFieldKits:1,meat:2,berries:4}:{fieldKits:2,berries:5};
  for(const [key,amount] of Object.entries(needs))if(stock(key)<amount){onToast("Carga insuficiente: faltam "+amount+" "+key+".");return;}
  const destination=el("expeditionDestination").value;
  const d=DESTINATIONS[destination]||DESTINATIONS.mines;
  const weapon=stock("steelSwords")>0?"steelSwords":"steelSpears";
  const armor=stock("steelChestplates")>0?"steelChestplates":"steelHelmets";
  const gearItems=[weapon,armor];
  if(gear.shield)gearItems.push("steelShields");
  const costs=[...gearItems.map(key=>[key,1]),...Object.entries(needs)];
  for(const [key,amount] of costs)if(stock(key)<amount){onToast("O depósito não tem equipamento ou suprimentos suficientes.");return;}
  const deducted=[];
  for(const [key,amount] of costs){if(!villageResidents.takeFromStockpile(key,amount)){for(const [refundKey,refundAmount] of deducted)villageResidents.depositToStockpile(refundKey,refundAmount);onToast("Não foi possível preparar a carga. Nada foi enviado.");return;}deducted.push([key,amount]);}
  const now=Date.now();
  active={destination,members:selected,memberNames:selected.map(id=>roster().find(person=>person.id===id)?.name||"Morador"),departedAt:now,returnAt:now+d.duration,eventAt:now+Math.max(18000,Math.floor(d.duration*.32)),event:null,eventResolved:false,bonusRewards:[],gearItems,load};
  villageResidents.setExpeditionAway?.(selected,true);
  persist();refresh();onToast("A expedição partiu para "+d.label+" com "+selected.length+" moradores.");
 };
 const finish=()=>{
  if(!active)return;
  const mission=active,d=DESTINATIONS[mission.destination]||DESTINATIONS.mines;
  const rewards=[];
  // Devolve primeiro o equipamento emprestado para garantir que não seja bloqueado por recompensas que encham o depósito.
  for(const key of mission.gearItems||[])villageResidents.depositToStockpile(key,1);
  for(const [key,min,max] of d.rewards){const amount=min+Math.floor(Math.random()*(max-min+1));const stored=villageResidents.depositToStockpile(key,amount);if(stored)rewards.push(stored+" "+key);}
  for(const item of mission.bonusRewards||[]){const stored=villageResidents.depositToStockpile(item.key,item.amount);if(stored)rewards.push(stored+" "+item.key+" (evento)");}
  if(mission.event&&!mission.eventResolved)mission.eventResult="O grupo preferiu não se arriscar e seguiu viagem."; 
  try{onDiscovery?.({destination:mission.destination,eventType:mission.event?.type||null,eventResolved:!!mission.eventResolved,memberNames:mission.memberNames||[]});}catch(error){console.warn("Não foi possível registrar a descoberta da expedição.",error);}
  villageResidents.setExpeditionAway?.(mission.members,false);
  saved.completed++;
  const record={destination:d.label,members:mission.members.length,result:rewards.join(", ")||"retorno sem carga adicional",at:Date.now()};
  saved.history.unshift(record);saved.history=saved.history.slice(0,8);active=null;persist();makeRoster();refresh();
  onToast("Expedição concluída! "+record.result+". Os moradores voltaram à aldeia.");
 };
 const update=()=>{
  if(active&&Date.now()>=active.returnAt)finish();
  else if(active&&!active.event&&Date.now()>=active.eventAt)showEvent();
  if(Date.now()-lastRender>900){refresh();lastRender=Date.now();}
 };
 if(active){
  const known=new Set(allRoster().map(person=>person.id));
  const away=active.members.filter(id=>known.has(id));
  if(away.length){active.members=away;villageResidents.setExpeditionAway?.(away,true);}
  else{active=null;persist();}
 }
 root.innerHTML='<div class="expedition-panel-heading">🧭 EXPEDIÇÕES COMUNITÁRIAS</div><p class="expedition-intro">Monte um grupo, prepare armas, armaduras e mantimentos. Os moradores ficam fora das rotinas da aldeia até retornarem.</p><div class="expedition-label">ESCOLHA O GRUPO · 2 A 4 MORADORES</div><div id="expeditionParty" class="expedition-party"></div><label class="expedition-label" for="expeditionDestination">DESTINO</label><select id="expeditionDestination"><option value="mines">Serra das Minas · 1m30</option><option value="ruins">Ruínas do Norte · 2m</option><option value="marsh">Pântano Antigo · 2m30</option></select><label class="expedition-label" for="expeditionLoad">CARGA E MANTIMENTOS</label><select id="expeditionLoad"><option value="standard">Carga padrão · 2 kits + 5 frutas</option><option value="reinforced">Carga reforçada · 1 kit reforçado + 2 carnes + 4 frutas</option></select><div id="expeditionGearStatus" class="expedition-info"></div><div id="expeditionKitStatus" class="expedition-info"></div><button id="expeditionStart" type="button">⚑ PREPARAR E PARTIR</button><div id="expeditionActive" class="expedition-active"></div><div id="expeditionEvent" class="expedition-event" hidden></div><div class="expedition-progress"><i id="expeditionProgress"></i></div><div id="expeditionCompleted" class="expedition-info"></div><div class="expedition-history" id="expeditionHistory"></div>';
 el("expeditionStart").addEventListener("click",start);
 makeRoster();refresh();
 return {update,getStatus:()=>({active:!!active,completed:saved.completed})};
}
