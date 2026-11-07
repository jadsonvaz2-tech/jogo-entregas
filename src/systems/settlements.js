// Núcleos de povoação estáticos e determinísticos: não alteram nem migram os salvamentos existentes.
export function createWorldSettlements({ THREE, scene, terrainHeight }) {
  const materials = {
    plaster: new THREE.MeshStandardMaterial({ color: 0xb7a17b, roughness: 1 }),
    plasterLight: new THREE.MeshStandardMaterial({ color: 0xc8b58f, roughness: 1 }),
    timber: new THREE.MeshStandardMaterial({ color: 0x493322, roughness: 1 }),
    timberLight: new THREE.MeshStandardMaterial({ color: 0x765438, roughness: 1 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x55483a, roughness: 1 }),
    roofWarm: new THREE.MeshStandardMaterial({ color: 0x70513a, roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x77776b, roughness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x28251f, roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x607a7a, roughness: .45, metalness: .08 }),
    path: new THREE.MeshStandardMaterial({ color: 0x766348, roughness: 1 }),
    fence: new THREE.MeshStandardMaterial({ color: 0x60452d, roughness: 1 })
  };
  const centers = [
    { name: "Aldeia do Vale", x: 57, z: 31, radius: 17, kind: "vale" },
    { name: "Povoado da Colina", x: -59, z: -39, radius: 16, kind: "colina" }
  ];
  const paths = [
    [[0, 0], [10, 3], [21, 5], [31, 12], [43, 19], [57, 31]],
    [[0, 0], [-11, -7], [-22, -13], [-34, -20], [-47, -29], [-59, -39]]
  ];

  function addBox(parent, size, position, material, rotation = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addHouse(x, z, yaw, variant = 0, large = false) {
    const group = new THREE.Group();
    const width = large ? 7.4 : 5.8;
    const depth = large ? 6.8 : 5.3;
    const wallHeight = large ? 3.35 : 2.9;
    const wallMaterial = variant % 2 ? materials.plasterLight : materials.plaster;
    const roofMaterial = variant % 2 ? materials.roofWarm : materials.roof;
    addBox(group, [width + .45, .34, depth + .45], [0, .17, 0], materials.stone);
    addBox(group, [width, wallHeight, depth], [0, .34 + wallHeight / 2, 0], wallMaterial);
    // Estrutura de madeira aparente, como nas casas medievais do povoado.
    for (const side of [-1, 1]) {
      addBox(group, [.22, wallHeight + .12, .24], [side * (width / 2 - .16), .34 + wallHeight / 2, depth / 2 - .08], materials.timber);
      addBox(group, [.22, wallHeight + .12, .24], [side * (width / 2 - .16), .34 + wallHeight / 2, -depth / 2 + .08], materials.timber);
    }
    addBox(group, [width + .18, .2, .22], [0, .55, depth / 2 - .12], materials.timber);
    addBox(group, [width + .18, .2, .22], [0, wallHeight + .26, depth / 2 - .12], materials.timber);
    // Telhado de duas águas.
    const roofHalf = width * .59;
    addBox(group, [roofHalf * 1.15, .24, depth + .72], [-roofHalf * .48, wallHeight + .62, 0], roofMaterial, [0, 0, .58]);
    addBox(group, [roofHalf * 1.15, .24, depth + .72], [roofHalf * .48, wallHeight + .62, 0], roofMaterial, [0, 0, -.58]);
    addBox(group, [.24, .28, depth + .82], [0, wallHeight + 1.42, 0], materials.timber);
    // Porta frontal e janelas com moldura.
    addBox(group, [1.05, 2.15, .16], [0, 1.42, depth / 2 + .09], materials.timber);
    addBox(group, [.72, 1.75, .08], [0, 1.35, depth / 2 + .19], materials.timberLight);
    for (const wx of [-width * .31, width * .31]) {
      addBox(group, [1.0, .92, .13], [wx, 2.03, depth / 2 + .12], materials.timber);
      addBox(group, [.72, .66, .06], [wx, 2.03, depth / 2 + .2], materials.glass);
      addBox(group, [.09, .78, .08], [wx, 2.03, depth / 2 + .25], materials.timberLight);
      addBox(group, [.82, .09, .08], [wx, 2.03, depth / 2 + .25], materials.timberLight);
    }
    // Chaminé simples de pedra.
    addBox(group, [.72, 1.65, .72], [-width * .28, wallHeight + 1.05, -depth * .2], materials.stone);
    addBox(group, [.86, .18, .86], [-width * .28, wallHeight + 1.92, -depth * .2], materials.dark);
    group.position.set(x, terrainHeight(x, z), z);
    group.rotation.y = yaw;
    scene.add(group);
    return group;
  }

  function addWell(x, z) {
    const group = new THREE.Group();
    const stoneRing = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, .72, 10), materials.stone);
    stoneRing.position.y = .38; stoneRing.castShadow = true; stoneRing.receiveShadow = true; group.add(stoneRing);
    const water = new THREE.Mesh(new THREE.CircleGeometry(.82, 16), new THREE.MeshStandardMaterial({ color: 0x476a70, roughness: .25, metalness: .12 }));
    water.rotation.x = -Math.PI / 2; water.position.y = .76; group.add(water);
    for (const sx of [-.82, .82]) addBox(group, [.16, 2.5, .16], [sx, 1.9, 0], materials.timber);
    addBox(group, [2.2, .16, 1.7], [0, 3.1, 0], materials.roofWarm);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.05, 4), materials.roofWarm);
    roof.position.y = 3.65; roof.rotation.y = Math.PI / 4; roof.castShadow = true; group.add(roof);
    group.position.set(x, terrainHeight(x, z), z);
    scene.add(group);
  }

  function addBarn(x, z, yaw) {
    addHouse(x, z, yaw, 1, true);
    const sign = new THREE.Group();
    addBox(sign, [1.5, .72, .12], [0, 2.05, 0], materials.timber);
    addBox(sign, [1.18, .45, .04], [0, 2.05, .09], materials.plasterLight);
    sign.position.set(x + Math.sin(yaw) * 4.2, terrainHeight(x, z) + .34, z + Math.cos(yaw) * 4.2);
    sign.rotation.y = yaw;
    scene.add(sign);
  }

  function addSign(center) {
    const group = new THREE.Group();
    addBox(group, [.18, 2.35, .18], [-.95, 1.18, 0], materials.timber);
    addBox(group, [.18, 2.35, .18], [.95, 1.18, 0], materials.timber);
    addBox(group, [2.25, .82, .18], [0, 2.05, 0], materials.timberLight);
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 160;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#463322"; ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = "#c4a56d"; ctx.lineWidth = 9; ctx.strokeRect(8, 8, 496, 144);
    ctx.fillStyle = "#f0dfb8"; ctx.font = "bold 40px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(center.name.toUpperCase(), 256, 82, 470);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.12, .66), new THREE.MeshStandardMaterial({ map: texture, roughness: .85 }));
    plaque.position.set(0, 2.05, .105); group.add(plaque);
    group.position.set(center.x, terrainHeight(center.x, center.z), center.z);
    group.rotation.y = Math.atan2(-center.x, center.z);
    scene.add(group);
  }

  function addRoad(points) {
    const curvePoints = points.map(([x, z]) => new THREE.Vector3(x, terrainHeight(x, z) + .055, z));
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const samples = curve.getPoints(150);
    const vertices = [], indices = [];
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      const before = samples[Math.max(0, i - 1)];
      const after = samples[Math.min(samples.length - 1, i + 1)];
      const dx = after.x - before.x, dz = after.z - before.z;
      const length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length, nz = dx / length;
      for (const side of [-1, 1]) {
        const x = p.x + nx * 1.45 * side, z = p.z + nz * 1.45 * side;
        vertices.push(x, terrainHeight(x, z) + .07, z);
      }
      if (i < samples.length - 1) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const road = new THREE.Mesh(geometry, materials.path);
    road.receiveShadow = true; road.castShadow = false; scene.add(road);
  }

  centers.forEach((center, index) => {
    const offsets = index === 0
      ? [[-7, -5], [7, -5], [-7, 7], [7, 7]]
      : [[-6, -6], [7, -5], [-7, 7], [7, 7]];
    offsets.forEach(([dx, dz], i) => addHouse(center.x + dx, center.z + dz, (i % 2 ? 1 : -1) * .16 + index * .22, i + index));
    addBarn(center.x + (index ? 0 : 1), center.z - 12, index ? .35 : -.2);
    addWell(center.x, center.z);
    addSign(center);
  });
  paths.forEach(addRoad);
  return { centers, paths };
}
