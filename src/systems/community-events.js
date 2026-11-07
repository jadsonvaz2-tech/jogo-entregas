// Eventos comunitários visuais e determinísticos; não criam nem alteram salvamentos.
export function createCommunityEvents({ THREE, scene, terrainHeight, centers, onToast = () => {} }) {
  const events = [];
  const wood = new THREE.MeshStandardMaterial({ color: 0x62452e, roughness: 1 });
  const cloth = [0x9b4938, 0xb18a42, 0x496b56, 0x526d83].map(color => new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide }));
  const lantern = new THREE.MeshStandardMaterial({ color: 0xe7b95d, emissive: 0x8b541c, emissiveIntensity: .35, roughness: .65 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x777366, roughness: 1 });
  const makeBox = (parent, size, pos, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  function bannerTexture(label) {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 160;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#493523"; ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = "#d2b477"; ctx.lineWidth = 9; ctx.strokeRect(8, 8, 496, 144);
    ctx.fillStyle = "#f4e6c7"; ctx.font = "bold 43px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, 256, 82, 470);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }
  centers.forEach((center, index) => {
    const group = new THREE.Group();
    const table = new THREE.Group();
    makeBox(table, [3.2, .22, 1.35], [0, 1.05, 0], wood);
    for (const x of [-1.35, 1.35]) for (const z of [-.5, .5]) makeBox(table, [.14, 1.0, .14], [x, .5, z], wood);
    for (let i = 0; i < 4; i++) {
      const goods = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6), i % 2 ? cloth[(index + 1) % 4] : lantern);
      goods.position.set(-1.05 + i * .7, 1.32, .05); table.add(goods);
    }
    group.add(table);
    for (const x of [-2.25, 2.25]) {
      makeBox(group, [.16, 3.1, .16], [x, 1.55, -1.05], wood);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.15, .8), cloth[(index + (x > 0 ? 1 : 0)) % 4]);
      flag.position.set(x + (x > 0 ? -.45 : .45), 2.55, -1.02); flag.rotation.y = x > 0 ? Math.PI : 0; group.add(flag);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 6), lantern); lamp.position.set(x, 2.95, -1.05); group.add(lamp);
    }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.05), new THREE.MeshStandardMaterial({ map: bannerTexture("FESTA DA ALDEIA"), roughness: .9, side: THREE.DoubleSide }));
    banner.position.set(0, 2.65, 1.15); group.add(banner);
    const fireRing = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, .22, 12), stone);
    fireRing.position.set(0, .12, 3.2); group.add(fireRing);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(.42, 1.05, 7), new THREE.MeshStandardMaterial({ color: 0xe58a32, emissive: 0xb54d12, emissiveIntensity: .65 }));
    fire.position.set(0, .72, 3.2); group.add(fire);
    group.position.set(center.x + 10, terrainHeight(center.x + 10, center.z + 5), center.z + 5);
    group.rotation.y = index * .42; group.visible = false; scene.add(group);
    events.push(group);
  });
  let lastNotice = "";
  return { update(state) {
    const day = Math.max(1, Math.floor(state.day || 1)), hour = Number(state.timeOfDay) || 0;
    const seasonal = day % 28 === 0 && hour >= 15 && hour < 22;
    const feast = !seasonal && day % 7 === 0 && hour >= 16 && hour < 22;
    const market = !seasonal && !feast && day % 3 === 0 && hour >= 9 && hour < 17;
    const active = seasonal || feast || market;
    const type = seasonal ? "Festival das Estações" : feast ? "Celebração da Colheita" : market ? "Feira Comunitária" : "";
    const key = active ? day + ":" + type : day + ":quiet";
    for (const group of events) group.visible = active;
    if (active && lastNotice !== key) { lastNotice = key; onToast(type + " nas quatro aldeias! Visite as barracas e o ponto de encontro."); }
    else if (!active) lastNotice = key;
  }};
}
