import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Shared procedural source for the delivered GLB. No external images or map services.
export function createCampus(layout) {
  const campus = new THREE.Group()
  campus.name = 'Qinghe_Campus'
  campus.userData = { simulated: true, units: 'meters', generator: 'qinghe-campus-twin geometry script' }
  const colors = {
    base: 0xc4d1c9, lawn: 0x9cbd98, lawnLight: 0xadcba4, pavement: 0xdddcd1,
    road: 0x7c8c8a, paint: 0xf3f3df, wall: 0xece8d9, trim: 0xc5c8c0,
    roof: 0xa6b3b0, glass: 0x558a91, dark: 0x3a6064, brick: 0xb18e76,
    leaf: 0x5d9076, leafLight: 0x79a083, trunk: 0x8c7b65, track: 0xb9826d,
    field: 0x729b7b, fieldLight: 0x80a887, metal: 0x667b77, solar: 0x45697b,
  }
  const materials = Object.fromEntries(Object.entries(colors).map(([key, color]) => [key,
    new THREE.MeshStandardMaterial({ color, roughness: key === 'glass' ? 0.26 : 0.84, metalness: key === 'glass' || key === 'solar' ? 0.3 : 0.02 }),
  ]))
  const bucket = (parent) => {
    const groups = new Map()
    function add(geometry, material, x, y, z, rotation = 0) {
      geometry.rotateY(rotation)
      geometry.translate(x, y, z)
      const flat = geometry.index ? geometry.toNonIndexed() : geometry
      if (flat !== geometry) geometry.dispose()
      if (!groups.has(material)) groups.set(material, [])
      groups.get(material).push(flat)
    }
    function box(x, y, z, w, h, d, material, rotation = 0) {
      add(new THREE.BoxGeometry(w, h, d), material, x, y, z, rotation)
    }
    function flush() {
      for (const [material, geometries] of groups) {
        const merged = mergeGeometries(geometries, false)
        geometries.forEach(g => g.dispose())
        const mesh = new THREE.Mesh(merged, materials[material])
        mesh.name = `${parent.name}_${material}`
        mesh.castShadow = material !== 'paint'
        mesh.receiveShadow = true
        parent.add(mesh)
      }
    }
    return { add, box, flush }
  }

  const grounds = new THREE.Group()
  grounds.name = 'Campus_Grounds'
  campus.add(grounds)
  const g = bucket(grounds)
  g.box(0, -2.1, 0, 322, 4, 242, 'base')
  g.box(0, 0, 0, 310, 0.5, 230, 'pavement')
  g.box(0, 0.32, 0, 298, 0.25, 218, 'lawn')
  // Circulation follows the spaces between buildings.
  for (const z of [-103, 102, -52, 3]) g.box(0, 0.51, z, 284, 0.16, 9, 'road')
  for (const x of [-137, 137]) g.box(x, 0.51, 0, 9, 0.16, 214, 'road')
  g.box(0, 0.51, 58, 13, 0.16, 105, 'road')
  for (const x of [-38, 38]) g.box(x, 0.52, -25, 5, 0.12, 55, 'pavement')
  for (let x = -128; x <= 128; x += 12) {
    for (const z of [-103, 102, 3]) g.box(x, 0.62, z, 5, 0.02, 0.22, 'paint')
  }
  for (let z = 18; z < 101; z += 10) g.box(0, 0.62, z, 0.22, 0.02, 4, 'paint')
  // Crosswalk at the south gate.
  for (let x = -5; x <= 5; x += 1.7) g.box(x, 0.65, 98, 0.8, 0.04, 6, 'paint')
  // Central plaza, planting beds and a small reflecting pool.
  g.box(0, 0.52, -3, 60, 0.2, 17, 'pavement')
  g.box(-22, 0.75, 52, 23, 0.65, 32, 'pavement')
  g.box(-22, 1.12, 52, 20, 0.12, 29, 'glass')
  for (const z of [28, 77]) g.box(-22, 0.8, z, 23, 0.8, 4, 'leafLight')
  // Entrance pavilion.
  for (const x of [-13, 13]) g.box(x, 4.2, 113, 2, 8, 2.5, 'wall')
  g.box(0, 8.7, 113, 31, 1.8, 4.5, 'wall')
  g.box(0, 8.7, 115.3, 17, 0.65, 0.1, 'dark')
  for (const x of [-149, 149]) g.box(x, 1.1, 0, 0.5, 1.3, 215, 'trim')
  g.flush()

  for (const spec of layout.buildings) {
    const building = new THREE.Group()
    building.name = spec.buildingId
    building.userData = { buildingId: spec.buildingId, displayName: spec.name }
    building.position.set(spec.centerGround.x, 0.65, -spec.centerGround.y)
    const { width: w, depth: d, height: h } = spec.size
    const b = bucket(building)
    b.box(0, -0.1, 0, w + 5, 0.4, d + 5, 'pavement')
    if (spec.buildingId === 'G01') {
      b.box(0, h * 0.43, 0, w, h * 0.86, d, 'wall')
      b.box(0, h * 0.58, d / 2 + 0.05, w - 6, h * 0.35, 0.24, 'glass')
      b.box(0, h * 0.58, -d / 2 - 0.05, w - 6, h * 0.35, 0.24, 'glass')
      for (let x = -w / 2 + 3; x < w / 2; x += 6) {
        b.box(x, h * 0.85, 0, 0.9, 2.2, d + 2, 'roof')
      }
      b.box(0, h * 0.98, 0, w + 3, 1.1, d + 3, 'roof')
    } else {
      b.box(0, h / 2, 0, w, h, d, 'wall')
      const levels = Math.max(2, Math.round(h / 4))
      for (let level = 0; level < levels; level++) {
        const floorY = 2.3 + level * (h - 2) / levels
        for (let x = -w / 2 + 3.4; x < w / 2 - 1; x += 4.8) {
          for (const side of [-1, 1]) b.box(x, floorY, side * (d / 2 + 0.07), 2.8, 2.3, 0.22, 'glass')
        }
        for (let z = -d / 2 + 3; z < d / 2 - 1; z += 4.8) {
          for (const side of [-1, 1]) b.box(side * (w / 2 + 0.07), floorY, z, 0.22, 2.3, 2.6, 'glass')
        }
        b.box(0, floorY + 1.65, 0, w + 0.5, 0.35, d + 0.5, 'trim')
      }
      b.box(0, h + 0.4, 0, w + 1.8, 0.8, d + 1.8, 'roof')
      b.box(0, h + 0.9, 0, w - 3, 0.2, d - 3, 'pavement')
      if (spec.buildingId === 'LIB01') {
        b.box(0, h * 0.5, d / 2 + 0.6, 17, h - 1, 1.3, 'glass')
        for (const x of [-8, 0, 8]) b.box(x, h * 0.5, d / 2 + 1.4, 0.35, h, 0.35, 'trim')
        b.box(0, h + 3, -2, 18, 4.4, 14, 'glass')
        b.box(0, h + 5.4, -2, 20, 0.5, 16, 'roof')
        for (let step = 0; step < 3; step++) b.box(0, 0.3 + step * 0.22, d / 2 + 3 - step, 21, 0.3, 5 - step, 'trim')
      } else {
        // Raised entrance canopy and double doors.
        b.box(0, 2.2, d / 2 + 0.18, 5, 4.4, 0.4, 'dark')
        b.box(0, 5.3, d / 2 + 2.1, 10, 0.6, 5, 'wall')
        for (const x of [-4.2, 4.2]) b.box(x, 2.6, d / 2 + 3.5, 0.45, 5.2, 0.45, 'trim')
      }
      if (spec.buildingId === 'L01' || spec.buildingId === 'T01') {
        for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
          b.box(-w / 2 + 7 + col * 7.5, h + 1.5, -d / 2 + 7 + row * 10, 6, 0.35, 6, 'solar')
        }
      } else {
        for (const x of [-w / 3, w / 3]) {
          b.box(x, h + 1.7, -d / 4, 5, 1.5, 4, 'trim')
          b.box(x, h + 2.5, -d / 4, 4, 0.15, 3, 'metal')
        }
      }
      // Vertical facade accents differentiate the residential and dining blocks.
      if (spec.buildingId === 'D01' || spec.buildingId === 'C01') {
        for (const x of [-w / 2 + 0.8, w / 2 - 0.8]) b.box(x, h / 2, d / 2 + 0.25, 1.5, h, 0.5, 'brick')
      }
    }
    b.flush()
    campus.add(building)
  }

  const sports = new THREE.Group()
  sports.name = 'Sports_Field'
  sports.position.set(65, 0.6, 65)
  campus.add(sports)
  const s = bucket(sports)
  const oval = (rx, rz, material, y) => {
    const shape = new THREE.Shape()
    shape.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false)
    const geo = new THREE.ShapeGeometry(shape, 72)
    geo.rotateX(-Math.PI / 2)
    s.add(geo, material, 0, y, 0)
  }
  oval(51, 31, 'pavement', 0.02)
  oval(49, 29, 'track', 0.06)
  for (const radius of [25, 27]) {
    const geo = new THREE.TorusGeometry(radius, 0.09, 4, 96)
    geo.scale((radius + 20) / radius, 1, 1)
    geo.rotateX(-Math.PI / 2)
    s.add(geo, 'paint', 0, 0.13, 0)
  }
  oval(41, 21, 'field', 0.15)
  for (let stripe = 0; stripe < 10; stripe++) s.box(-31.5 + stripe * 7, 0.17, 0, 7, 0.02, 30, stripe % 2 ? 'field' : 'fieldLight')
  for (const z of [-15, 15]) s.box(0, 0.2, z, 70, 0.02, 0.18, 'paint')
  for (const x of [-35, 0, 35]) s.box(x, 0.2, 0, 0.18, 0.02, 30, 'paint')
  const center = new THREE.TorusGeometry(6, 0.1, 4, 48)
  center.rotateX(-Math.PI / 2)
  s.add(center, 'paint', 0, 0.2, 0)
  for (const x of [-35, 35]) {
    for (const z of [-4, 4]) s.box(x, 1.6, z, 0.2, 3, 0.2, 'paint')
    s.box(x, 3.1, 0, 0.2, 0.2, 8, 'paint')
    s.box(x * 0.77, 0.22, 0, 0.16, 0.02, 14, 'paint')
    for (const z of [-7, 7]) s.box(x * 0.885, 0.22, z, 8, 0.02, 0.16, 'paint')
  }
  s.flush()

  const nature = new THREE.Group()
  nature.name = 'Trees'
  nature.userData.layer = 'trees'
  campus.add(nature)
  const n = bucket(nature)
  let treeIndex = 0
  function tree(x, z, scale = 1) {
    const h = (5.3 + (treeIndex++ % 4) * 0.55) * scale
    n.add(new THREE.CylinderGeometry(0.32, 0.46, h * 0.65, 6), 'trunk', x, h * 0.32 + 0.5, z)
    const leaf = new THREE.IcosahedronGeometry(h * 0.4, 1)
    leaf.scale(0.9, 1.2, 0.9)
    n.add(leaf, treeIndex % 3 ? 'leaf' : 'leafLight', x, h * 0.85, z)
  }
  for (let x = -141; x <= 141; x += 12) {
    if (Math.abs(x) > 20) tree(x, 114, 0.9)
    tree(x, -113, 0.85)
  }
  for (let z = -90; z <= 90; z += 12) { tree(-148, z, 0.9); tree(148, z, 0.9) }
  for (let x = -122; x <= 122; x += 14) tree(x, -44, 0.75)
  for (let z = 20; z <= 86; z += 11) { tree(-9, z, 0.75); tree(9, z, 0.75) }
  for (const x of [-41, 41]) for (const z of [-87, -73, -60]) tree(x, z)
  n.flush()

  const furniture = new THREE.Group()
  furniture.name = 'Street_Furniture'
  campus.add(furniture)
  const f = bucket(furniture)
  for (let z = 24; z < 88; z += 20) {
    for (const x of [-11, 11]) {
      f.box(x, 3.7, z, 0.2, 6.4, 0.2, 'metal')
      f.box(x, 6.9, z, 1.7, 0.24, 1.7, 'paint')
    }
  }
  for (const x of [-30, 30]) for (const z of [-10, -42]) {
    f.box(x, 1.5, z, 5, 0.4, 1.3, 'brick')
    for (const offset of [-1.7, 1.7]) f.box(x + offset, 0.95, z, 0.3, 1.1, 1, 'metal')
  }
  // A row of parking bays, with a few restrained low-detail vehicles.
  for (let x = -113; x <= -51; x += 7) {
    f.box(x, 0.65, 32, 0.15, 0.02, 9, 'paint')
    if (x % 3) {
      f.box(x + 3, 1.6, 33, 3.2, 1.5, 6, 'trim')
      f.box(x + 3, 2.6, 33, 2.8, 0.8, 3.2, 'dark')
    }
  }
  f.flush()
  return campus
}
