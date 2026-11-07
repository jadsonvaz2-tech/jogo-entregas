const SAVE_KEY = "cronicas-floresta-settlement-economy-v1";

const GOODS = {
  wood: { label: "Madeira", buy: 12, sell: 8, pack: 3 },
  berries: { label: "Frutas", buy: 8, sell: 6, pack: 4 },
  meat: { label: "Carne", buy: 14, sell: 10, pack: 2 },
  hide: { label: "Couro cru", buy: 10, sell: 7, pack: 1 },
  wool: { label: "Lã", buy: 18, sell: 12, pack: 2 }
};

const TOWNS = [
  { id: "vale", name: "Aldeia do Vale", x: 57, z: 31, market: [57, 35], production: { wood: 7, berries: 10 } },
  { id: "colina", name: "Povoado da Colina", x: -59, z: -39, market: [-59, -35], production: { meat: 4, hide: 2, wool: 3 } }
];

export function createSettlementEconomy({ player, state, onToast, onChange }) {
  let saved = {};
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (raw && typeof raw === "object") saved = raw;
  } catch (error) {
    console.warn("Economia das povoações indisponível; iniciando estoques básicos.", error);
  }

  const towns = TOWNS.map(town => ({
    ...town,
    stock: { wood: 18, berries: 24, meat: 8, hide: 5, wool: 8, ...(saved.towns?.[town.id]?.stock || {}) }
  }));
  let lastDay = Number.isFinite(saved.lastDay) ? saved.lastDay : (Number(state.day) || 1);

  function save() {
    try {
      const data = { version: 1, lastDay, towns: {} };
      for (const town of towns) data.towns[town.id] = { stock: town.stock };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("Não foi possível salvar os estoques das povoações.", error);
    }
  }

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.hidden = true;
  trigger.textContent = "🪙 NEGOCIAR NA ALDEIA";
  trigger.style.cssText = "position:fixed;z-index:46;left:50%;bottom:184px;transform:translateX(-50%);padding:11px 16px;border:1px solid #d6b45d;border-radius:22px;background:rgba(35,49,34,.97);color:#fff1cc;font:800 11px system-ui;box-shadow:0 4px 16px #0008;touch-action:manipulation";
  document.body.appendChild(trigger);

  const panel = document.createElement("section");
  panel.hidden = true;
  panel.style.cssText = "position:fixed;z-index:78;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 28px));max-height:min(78vh,680px);overflow:auto;padding:17px;border:1px solid #d6b45d;border-radius:14px;background:linear-gradient(145deg,#293a2a,#17231b);color:#f3e8c9;box-shadow:0 18px 55px #000b;font:13px/1.45 system-ui";
  panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><div><div style="font:700 10px system-ui;letter-spacing:.12em;color:#c5c99e">MERCADO MEDIEVAL</div><h2 id="settlement-market-name" style="margin:3px 0;color:#e6c979;font:700 22px Georgia">Mercado</h2></div><button id="settlement-market-close" type="button" style="padding:8px 10px;background:transparent;color:#fff1cc;border:1px solid #b99b5c;border-radius:7px">FECHAR ✕</button></div><p id="settlement-market-coins" style="margin:8px 0;color:#e8d39b;font-weight:800"></p><p id="settlement-market-stock" style="margin:6px 0 12px;color:#c5cfb0;font-size:11px"></p><div id="settlement-market-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div><p style="margin:12px 0 0;color:#aeb99f;font-size:10px">Os trabalhadores produzem recursos ao longo dos dias. Cada povoação mantém seu próprio estoque.</p>';
  document.body.appendChild(panel);

  const title = panel.querySelector("#settlement-market-name");
  const coins = panel.querySelector("#settlement-market-coins");
  const stockText = panel.querySelector("#settlement-market-stock");
  const actions = panel.querySelector("#settlement-market-actions");
  let activeTown = null;
  let nearestTown = null;

  function refresh() {
    if (!activeTown) return;
    title.textContent = activeTown.name;
    coins.textContent = "🪙 Suas moedas: " + (Number(state.coins) || 0);
    stockText.textContent = "Estoque: " + Object.entries(activeTown.stock).map(([key, value]) => GOODS[key].label + " " + value).join(" · ");
    actions.replaceChildren();
    for (const [key, good] of Object.entries(GOODS)) {
      const buy = document.createElement("button");
      buy.type = "button";
      buy.textContent = "COMPRAR " + good.pack + " " + good.label.toUpperCase() + " · " + good.buy + "🪙";
      buy.disabled = activeTown.stock[key] < good.pack || (Number(state.coins) || 0) < good.buy;
      buy.style.cssText = "min-height:42px;padding:8px;border:1px solid #8b784e;border-radius:8px;background:#3d5138;color:#fff0c7;font:700 10px system-ui;opacity:" + (buy.disabled ? ".42" : "1");
      buy.addEventListener("click", () => trade(key, "buy"));
      actions.appendChild(buy);

      const sell = document.createElement("button");
      sell.type = "button";
      sell.textContent = "VENDER " + good.pack + " " + good.label.toUpperCase() + " · +" + good.sell + "🪙";
      sell.disabled = (Number(state[key]) || 0) < good.pack;
      sell.style.cssText = "min-height:42px;padding:8px;border:1px solid #8b784e;border-radius:8px;background:#594735;color:#fff0c7;font:700 10px system-ui;opacity:" + (sell.disabled ? ".42" : "1");
      sell.addEventListener("click", () => trade(key, "sell"));
      actions.appendChild(sell);
    }
  }

  function trade(key, direction) {
    if (!activeTown) return;
    const good = GOODS[key];
    if (direction === "buy") {
      if (activeTown.stock[key] < good.pack || (Number(state.coins) || 0) < good.buy) return;
      activeTown.stock[key] -= good.pack;
      state.coins -= good.buy;
      state[key] = (Number(state[key]) || 0) + good.pack;
      onToast("Você comprou " + good.pack + " " + good.label.toLowerCase() + " em " + activeTown.name + ".");
    } else {
      if ((Number(state[key]) || 0) < good.pack) return;
      state[key] -= good.pack;
      activeTown.stock[key] += good.pack;
      state.coins = (Number(state.coins) || 0) + good.sell;
      onToast("Você vendeu " + good.pack + " " + good.label.toLowerCase() + " e recebeu " + good.sell + " moedas.");
    }
    save();
    refresh();
    if (onChange) onChange();
  }

  function openMarket(town) {
    activeTown = town;
    refresh();
    panel.hidden = false;
    trigger.hidden = true;
  }

  trigger.addEventListener("click", () => { if (nearestTown && panel.hidden) openMarket(nearestTown); });
  panel.querySelector("#settlement-market-close").addEventListener("click", () => { panel.hidden = true; });

  function update() {
    const currentDay = Number(state.day) || 1;
    if (currentDay > lastDay) {
      const daysPassed = Math.min(currentDay - lastDay, 7);
      for (let day = 0; day < daysPassed; day++) {
        for (const town of towns) {
          for (const [resource, amount] of Object.entries(town.production)) {
            town.stock[resource] = Math.min(99, town.stock[resource] + amount);
          }
        }
      }
      lastDay = currentDay;
      save();
      if (activeTown) refresh();
    }

    nearestTown = null;
    let closest = 6;
    for (const town of towns) {
      const distance = Math.hypot(player.position.x - town.market[0], player.position.z - town.market[1]);
      if (distance < closest) { closest = distance; nearestTown = town; }
    }
    trigger.hidden = !nearestTown || !panel.hidden;
    if (nearestTown && panel.hidden) trigger.textContent = "🪙 NEGOCIAR · " + nearestTown.name.toUpperCase();
  }

  save();
  return { update, towns };
}
