import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const SAVE_KEY = "cronicas-floresta-story-v1";

export function createStoryEncounter({ THREE: T, scene, player, terrainHeight, state, onSave, onToast }) {
  const position = new T.Vector3(0, terrainHeight(0, -8), -8);
  let quest = { status: "not-started" };
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (saved && ["not-started", "active", "completed"].includes(saved.status)) quest = saved;
  } catch (error) {
    console.warn("Não foi possível carregar a missão narrativa", error);
  }

  const npc = new T.Group();
  npc.position.copy(position);
  scene.add(npc);

  const groundRing = new T.Mesh(
    new T.TorusGeometry(1.05, 0.055, 8, 36),
    new T.MeshBasicMaterial({ color: 0xd6b45d, transparent: true, opacity: 0.82 })
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.08;
  npc.add(groundRing);

  const marker = new T.Mesh(
    new T.OctahedronGeometry(0.22, 0),
    new T.MeshStandardMaterial({ color: 0xe8c76b, emissive: 0x7b5418, emissiveIntensity: 0.65, roughness: 0.35 })
  );
  marker.position.set(0, 2.65, 0);
  npc.add(marker);

  const fallback = new T.Group();
  const tunic = new T.Mesh(
    new T.CapsuleGeometry(0.34, 0.78, 4, 8),
    new T.MeshStandardMaterial({ color: 0x52634a, roughness: 0.92 })
  );
  tunic.position.y = 0.88;
  fallback.add(tunic);
  const head = new T.Mesh(
    new T.SphereGeometry(0.23, 12, 10),
    new T.MeshStandardMaterial({ color: 0xc49a75, roughness: 0.9 })
  );
  head.position.y = 1.55;
  fallback.add(head);
  npc.add(fallback);

  const loader = new GLTFLoader();
  loader.load(new URL("../../assets/3d/Knight_Male.gltf", import.meta.url).href, (gltf) => {
    const model = gltf.scene;
    const bounds = new T.Box3().setFromObject(model);
    const size = bounds.getSize(new T.Vector3());
    const center = bounds.getCenter(new T.Vector3());
    if (!Number.isFinite(size.y) || size.y < 0.01) return;
    const scale = 1.9 / size.y;
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    model.traverse((part) => {
      if (part.isMesh) {
        part.castShadow = true;
        part.receiveShadow = true;
      }
    });
    npc.remove(fallback);
    npc.add(model);
    npc.userData.model = model;
  }, undefined, (error) => {
    console.warn("Modelo de Edrik indisponível; usando personagem provisório.", error);
  });

  const tagCanvas = document.createElement("canvas");
  tagCanvas.width = 512;
  tagCanvas.height = 128;
  const ctx = tagCanvas.getContext("2d");
  ctx.fillStyle = "rgba(24, 34, 25, 0.88)";
  ctx.roundRect(8, 8, 496, 112, 24);
  ctx.fill();
  ctx.strokeStyle = "#d6b45d";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = "#f3e8c9";
  ctx.font = "bold 42px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("EDRIK · VIGIA", 256, 66);
  const tagTexture = new T.CanvasTexture(tagCanvas);
  const tag = new T.Sprite(new T.SpriteMaterial({ map: tagTexture, transparent: true, depthWrite: false }));
  tag.position.set(0, 3.15, 0);
  tag.scale.set(3.15, 0.79, 1);
  npc.add(tag);

  const style = document.createElement("style");
  style.textContent = `
    #story-quest-card{position:fixed;z-index:24;right:12px;top:174px;width:min(260px,46vw);padding:11px 13px;border:1px solid rgba(214,180,93,.55);border-radius:12px;background:rgba(24,34,25,.88);color:#f3e8c9;font:12px/1.45 system-ui;pointer-events:none;box-shadow:0 5px 18px #0005}
    #story-quest-card strong{display:block;color:#e6c979;font:700 11px system-ui;letter-spacing:.08em;margin-bottom:4px}
    #story-talk-button{position:fixed;z-index:42;left:50%;bottom:116px;transform:translateX(-50%);padding:13px 20px;border:1px solid #e6c979;border-radius:24px;background:rgba(35,49,34,.96);color:#fff1cc;font:800 13px system-ui;letter-spacing:.04em;box-shadow:0 4px 18px #0007;touch-action:manipulation}
    #story-dialog{position:fixed;z-index:70;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 32px));padding:20px;border:1px solid #d6b45d;border-radius:16px;background:linear-gradient(145deg,#293a2a,#17231b);color:#f3e8c9;box-shadow:0 18px 55px #000b;font:14px/1.55 Georgia,serif}
    #story-dialog h2{margin:0 0 10px;color:#e6c979;font-size:20px}
    #story-dialog p{margin:0 0 16px}
    #story-dialog button{padding:10px 15px;border:1px solid #d6b45d;border-radius:9px;background:#52634a;color:#fff1cc;font:700 12px system-ui}
    #story-dialog .story-close{float:right;background:transparent}
    @media(max-width:600px){#story-quest-card{top:158px;right:8px;width:190px;font-size:11px}#story-talk-button{bottom:132px}}
  `;
  document.head.appendChild(style);

  const questCard = document.createElement("div");
  questCard.id = "story-quest-card";
  document.body.appendChild(questCard);
  const talkButton = document.createElement("button");
  talkButton.id = "story-talk-button";
  talkButton.type = "button";
  talkButton.hidden = true;
  document.body.appendChild(talkButton);
  const dialog = document.createElement("section");
  dialog.id = "story-dialog";
  dialog.hidden = true;
  dialog.innerHTML = '<button class="story-close" type="button">FECHAR ✕</button><h2>EDRIK, O VIGIA</h2><p id="story-dialog-text"></p><button id="story-dialog-action" type="button">ACEITAR MISSÃO</button>';
  document.body.appendChild(dialog);
  const dialogText = dialog.querySelector("#story-dialog-text");
  const dialogAction = dialog.querySelector("#story-dialog-action");
  dialog.querySelector(".story-close").addEventListener("click", () => { dialog.hidden = true; });

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(quest)); }
    catch (error) { console.warn("Não foi possível salvar a missão narrativa", error); }
    onSave();
    renderQuest();
  }

  function renderQuest() {
    if (quest.status === "not-started") {
      questCard.innerHTML = "<strong>HISTÓRIA · NOVA MISSÃO</strong>Encontre Edrik, o vigia da Estrada Velha.";
      talkButton.textContent = "CONVERSAR COM EDRIK";
    } else if (quest.status === "active") {
      const wood = Math.min(5, state.wood || 0);
      const stone = Math.min(3, state.stone || 0);
      questCard.innerHTML = "<strong>MISSÃO · REABRIR A ESTRADA</strong>Madeira: " + wood + "/5<br>Pedra: " + stone + "/3<br>Volte até Edrik para entregar os materiais.";
      talkButton.textContent = "FALAR COM EDRIK";
    } else {
      questCard.innerHTML = "<strong>HISTÓRIA · CONCLUÍDA</strong>A primeira rota comercial foi reaberta. Novas histórias virão.";
      talkButton.textContent = "CONVERSAR COM EDRIK";
    }
  }

  function openDialogue() {
    dialog.hidden = false;
    if (quest.status === "not-started") {
      dialogText.textContent = "A estrada ao norte está abandonada desde que o antigo posto caiu. Sou Edrik, o vigia. Traga 5 madeiras e 3 pedras para reconstruirmos o posto e reabrirmos a rota para os viajantes.";
      dialogAction.textContent = "ACEITAR MISSÃO";
      dialogAction.hidden = false;
      dialogAction.onclick = () => {
        quest.status = "active";
        persist();
        dialogText.textContent = "Agradeço, viajante. Reúna 5 madeiras e 3 pedras e volte até mim. Estarei aqui, perto da clareira.";
        dialogAction.textContent = "ENTENDI";
        dialogAction.onclick = () => { dialog.hidden = true; };
      };
    } else if (quest.status === "active") {
      if ((state.wood || 0) >= 5 && (state.stone || 0) >= 3) {
        dialogText.textContent = "Você conseguiu! Com esses materiais, o posto poderá ser reconstruído. Receba 25 moedas pela ajuda. A estrada voltará a ter movimento.";
        dialogAction.textContent = "ENTREGAR E RECEBER 25 MOEDAS";
        dialogAction.hidden = false;
        dialogAction.onclick = () => {
          state.wood -= 5;
          state.stone -= 3;
          state.coins = (Number(state.coins) || 0) + 25;
          quest.status = "completed";
          persist();
          dialogText.textContent = "A rota está aberta novamente. Este é apenas o começo: outras pessoas precisarão de ajuda para erguer uma nova comunidade.";
          dialogAction.textContent = "CONTINUAR";
          dialogAction.onclick = () => { dialog.hidden = true; };
          onToast("Missão concluída! Você recebeu 25 moedas.");
        };
      } else {
        dialogText.textContent = "Ainda precisamos de 5 madeiras e 3 pedras. Continue explorando a floresta e volte quando tiver os materiais.";
        dialogAction.textContent = "VOLTAR À FLORESTA";
        dialogAction.hidden = false;
        dialogAction.onclick = () => { dialog.hidden = true; };
      }
    } else {
      dialogText.textContent = "A estrada voltou a receber viajantes. Quando tivermos mais mãos para trabalhar, poderemos erguer casas, oficinas e um verdadeiro povoado.";
      dialogAction.textContent = "ATÉ LOGO";
      dialogAction.hidden = false;
      dialogAction.onclick = () => { dialog.hidden = true; };
    }
  }

  talkButton.addEventListener("click", openDialogue);
  renderQuest();
  let lastQuestUiRefresh = 0;

  return {
    update() {
      const distance = Math.hypot(player.position.x - position.x, player.position.z - position.z);
      const nearby = distance < 4.8;
      talkButton.hidden = !nearby;
      if (nearby) {
        talkButton.textContent = quest.status === "active" ? "FALAR / ENTREGAR MATERIAIS" : "CONVERSAR COM EDRIK";
      }
      const now = performance.now();
      marker.rotation.y += 0.012;
      marker.position.y = 2.65 + Math.sin(now * 0.002) * 0.12;
      groundRing.material.opacity = 0.65 + Math.sin(now * 0.003) * 0.18;
      if (now - lastQuestUiRefresh > 500) {
        renderQuest();
        lastQuestUiRefresh = now;
      }
    }
  };
}
