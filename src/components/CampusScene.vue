<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { findBuildingId } from '../domain/simulation.js'
import { createPeoplePlan, sampleRoute, shouldAnimatePeople } from '../scene/peopleMovement.js'
import Icon from './Icon.vue'

const props = defineProps({ buildings: Array, selectedId: String, alarmIds: Array, labels: Boolean, trees: Boolean, shadows: Boolean, people: Boolean, peopleDensity: String })
const emit = defineEmits(['select', 'ready', 'view-change'])
const host = ref(null)
const status = ref('loading')
const progress = ref(0)
const error = ref('')
const peopleCount = ref(0)
const peopleState = ref('loading')
const firstPersonX = ref('0.000')
const firstPersonPosition = ref('0.000,0.000')
const labelElements = new Map()
let renderer, scene, camera, controls, model, sun, selection, alarmRing, treeLayer, resizeObserver
let animation, roots = [], pointerStart = null, transition = null, disposed = false
let lastLabelUpdate = 0
let lastPeopleStatusUpdate = 0
let lastAnimationTime = 0
let peopleElapsed = 0
let peopleLayer = null
let peopleActors = []
let cameraMode = 'perspective'
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const projected = new THREE.Vector3()
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function createPerson(actor, assets) {
  const root = new THREE.Group()
  root.name = actor.id
  root.userData = { personId: actor.id, role: actor.role, motion: actor.motion }
  const teacher = actor.role === 'teacher'
  // Slightly enlarged for legibility in the campus-wide view.
  const scale = teacher ? 1.42 : 1.28 + (actor.palette % 3) * 0.035
  const bodyMaterial = teacher ? assets.teacherBodies[actor.palette % assets.teacherBodies.length] : assets.studentBodies[actor.palette % assets.studentBodies.length]
  const trousers = teacher ? assets.teacherTrousers : assets.studentTrousers
  const skin = assets.skin[actor.palette % assets.skin.length]

  const body = new THREE.Mesh(assets.torso, bodyMaterial)
  body.position.y = 1.63
  const head = new THREE.Mesh(assets.head, skin)
  head.position.y = 2.48
  const hair = new THREE.Mesh(assets.hair, assets.hairMaterial)
  hair.position.y = 2.66
  root.add(body, head, hair)

  const limb = (geometry, material, x, y, meshY) => {
    const pivot = new THREE.Group()
    pivot.position.set(x, y, 0)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = meshY
    mesh.castShadow = true
    pivot.add(mesh)
    root.add(pivot)
    return pivot
  }
  const leftArm = limb(assets.arm, bodyMaterial, -0.48, 1.95, -0.4)
  const rightArm = limb(assets.arm, bodyMaterial, 0.48, 1.95, -0.4)
  const leftLeg = limb(assets.leg, trousers, -0.2, 1.12, -0.43)
  const rightLeg = limb(assets.leg, trousers, 0.2, 1.12, -0.43)
  if (!teacher) {
    const backpack = new THREE.Mesh(assets.backpack, assets.backpacks[actor.palette % assets.backpacks.length])
    backpack.position.set(0, 1.62, -0.29)
    backpack.castShadow = true
    root.add(backpack)
  } else {
    const folder = new THREE.Mesh(assets.folder, assets.folderMaterial)
    folder.position.set(0.56, 1.22, 0.02)
    folder.rotation.z = -0.13
    root.add(folder)
  }
  root.scale.setScalar(scale)
  root.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true } })
  return { ...actor, root, leftArm, rightArm, leftLeg, rightLeg }
}

function buildPeople() {
  if (!scene) return
  if (peopleLayer) {
    scene.remove(peopleLayer)
    release(peopleLayer)
  }
  peopleLayer = new THREE.Group()
  peopleLayer.name = 'Animated_Campus_People'
  peopleLayer.userData.layer = 'people'
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0 })
  const assets = {
    torso: new THREE.BoxGeometry(0.72, 0.96, 0.38),
    head: new THREE.IcosahedronGeometry(0.31, 1),
    hair: new THREE.SphereGeometry(0.315, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.47),
    arm: new THREE.CylinderGeometry(0.105, 0.12, 0.8, 6),
    leg: new THREE.CylinderGeometry(0.13, 0.14, 0.86, 6),
    backpack: new THREE.BoxGeometry(0.5, 0.64, 0.2),
    folder: new THREE.BoxGeometry(0.08, 0.55, 0.42),
    studentBodies: [0x3f7f99, 0x69936e, 0xb77a4d, 0x6d6e9b, 0xa45e67].map(material),
    teacherBodies: [0x465d61, 0x675b50, 0x3f596d].map(material),
    studentTrousers: material(0x394c5a),
    teacherTrousers: material(0x313c3e),
    skin: [0xe9b994, 0xd69a74, 0xbd7e58].map(material),
    hairMaterial: material(0x3f332d),
    backpacks: [0x355e68, 0x8d604e, 0x5e6a47].map(material),
    folderMaterial: material(0xb78845),
  }
  peopleActors = createPeoplePlan(props.peopleDensity).map(plan => {
    const person = createPerson(plan, assets)
    peopleLayer.add(person.root)
    return person
  })
  peopleLayer.visible = props.people
  scene.add(peopleLayer)
  peopleCount.value = peopleActors.length
  updatePeople(0)
  publishPeopleStatus()
}

function publishPeopleStatus() {
  firstPersonX.value = peopleActors[0]?.root.position.x.toFixed(3) || '0.000'
  firstPersonPosition.value = peopleActors[0] ? `${peopleActors[0].root.position.x.toFixed(3)},${peopleActors[0].root.position.z.toFixed(3)}` : '0.000,0.000'
}

function updatePeople(deltaSeconds) {
  if (!peopleLayer) return
  const moving = shouldAnimatePeople({ enabled: props.people, hidden: document.hidden, reducedMotion })
  peopleLayer.visible = props.people
  peopleState.value = !props.people ? 'hidden' : moving ? 'moving' : 'paused'
  if (moving) peopleElapsed += Math.min(deltaSeconds, 0.05)
  for (const person of peopleActors) {
    const point = sampleRoute(person.route, person.phase + peopleElapsed * person.speed)
    person.root.position.set(point.x, 0.72, point.z)
    person.root.rotation.y = Math.atan2(point.directionX, point.directionZ)
    const cadence = person.motion === 'jog' ? 10 : 6.2
    const amplitude = person.motion === 'jog' ? 0.72 : 0.46
    const stride = moving ? Math.sin(peopleElapsed * cadence + person.phase * Math.PI * 2) * amplitude : 0
    person.leftArm.rotation.x = stride
    person.rightArm.rotation.x = -stride
    person.leftLeg.rotation.x = -stride
    person.rightLeg.rotation.x = stride
    person.root.position.y += moving ? Math.abs(Math.sin(peopleElapsed * cadence * 2 + person.phase * 4)) * (person.motion === 'jog' ? 0.12 : 0.055) : 0
  }
}

function rememberLabel(id, element) { if (element) labelElements.set(id, element); else labelElements.delete(id) }

function resize() {
  if (!renderer || !host.value) return
  const { width, height } = host.value.getBoundingClientRect()
  if (!width || !height) return
  renderer.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  if (controls && cameraMode !== 'focus') {
    transition = null
    camera.position.copy(overviewPosition(cameraMode))
    controls.target.set(0, 0, 0)
    controls.update()
  }
}

function overviewPosition(mode) {
  const direction = mode === 'top' ? new THREE.Vector3(0, 1, 0.0001).normalize() : new THREE.Vector3(275, 255, 315).normalize()
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize()
  const up = new THREE.Vector3().crossVectors(direction, right).normalize()
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const tanH = tanV * camera.aspect
  let distance = 0
  for (const x of [-162, 162]) for (const y of [-5, 40]) for (const z of [-122, 122]) {
    const point = new THREE.Vector3(x, y, z)
    distance = Math.max(distance, Math.abs(point.dot(right)) / tanH + point.dot(direction), Math.abs(point.dot(up)) / tanV + point.dot(direction))
  }
  return direction.multiplyScalar(distance * 1.14)
}

function moveCamera(position, target) {
  if (!camera) return
  if (reducedMotion) {
    camera.position.copy(position)
    controls.target.copy(target)
    controls.update()
  } else {
    transition = { start: performance.now(), from: camera.position.clone(), to: position, targetFrom: controls.target.clone(), targetTo: target }
  }
}

function setView(mode = 'perspective') {
  if (!camera) return
  cameraMode = mode
  moveCamera(overviewPosition(mode), new THREE.Vector3(0, 0, 0))
  emit('view-change', mode)
}

function focusBuilding(id) {
  const building = props.buildings.find(b => b.buildingId === id)
  if (!building || !camera) return
  cameraMode = 'focus'
  const target = new THREE.Vector3(building.centerGround.x, building.size.height * 0.35, -building.centerGround.y)
  moveCamera(target.clone().add(new THREE.Vector3(90, 92, 115)), target)
  emit('view-change', 'focus')
}

function updateMarkers() {
  if (!model || !selection) return
  const selected = props.buildings.find(b => b.buildingId === props.selectedId)
  selection.visible = Boolean(selected)
  if (selected) {
    selection.position.set(selected.centerGround.x, 0.92, -selected.centerGround.y)
    selection.scale.set(selected.size.width + 9, 1, selected.size.depth + 9)
  }
  const alarm = props.buildings.find(b => props.alarmIds.includes(b.buildingId))
  alarmRing.visible = Boolean(alarm)
  if (alarm) {
    alarmRing.position.set(alarm.centerGround.x, 1.12, -alarm.centerGround.y)
    alarmRing.scale.set(alarm.size.width + 13, 1, alarm.size.depth + 13)
  }
}

function marker(color, opacity) {
  const shape = new THREE.Shape()
  shape.moveTo(-0.5, -0.5); shape.lineTo(0.5, -0.5); shape.lineTo(0.5, 0.5); shape.lineTo(-0.5, 0.5); shape.closePath()
  const hole = new THREE.Path()
  hole.moveTo(-0.477, -0.477); hole.lineTo(-0.477, 0.477); hole.lineTo(0.477, 0.477); hole.lineTo(0.477, -0.477); hole.closePath()
  shape.holes.push(hole)
  const geometry = new THREE.ShapeGeometry(shape)
  geometry.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }))
  scene.add(mesh)
  return mesh
}

function onPointerDown(event) {
  if (event.button !== 0) return
  pointerStart = { x: event.clientX, y: event.clientY }
  transition = null
}
function onPointerUp(event) {
  if (!pointerStart || !model) return
  const distance = Math.hypot(pointerStart.x - event.clientX, pointerStart.y - event.clientY)
  pointerStart = null
  if (distance > 6) return
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(roots, true)[0]
  const id = hit && findBuildingId(hit.object)
  if (id) emit('select', id)
}

function updateLabels() {
  if (!host.value || !props.labels) return
  const width = host.value.clientWidth, height = host.value.clientHeight
  for (const building of props.buildings) {
    const element = labelElements.get(building.buildingId)
    if (!element) continue
    projected.set(building.centerGround.x, building.size.height + 8, -building.centerGround.y).project(camera)
    const x = (projected.x * 0.5 + 0.5) * width, y = (-projected.y * 0.5 + 0.5) * height
    const visible = projected.z > -1 && projected.z < 1 && x > 30 && x < width - 30 && y > 20 && y < height - 20
    element.style.visibility = visible ? 'visible' : 'hidden'
    element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
  }
}

function animate(now) {
  animation = requestAnimationFrame(animate)
  if (document.hidden || disposed) return
  const deltaSeconds = lastAnimationTime ? (now - lastAnimationTime) / 1000 : 0
  lastAnimationTime = now
  if (transition) {
    const t = Math.min((now - transition.start) / 850, 1)
    const eased = 1 - (1 - t) ** 3
    camera.position.lerpVectors(transition.from, transition.to, eased)
    controls.target.lerpVectors(transition.targetFrom, transition.targetTo, eased)
    if (t === 1) transition = null
  }
  controls.update()
  updatePeople(deltaSeconds)
  renderer.render(scene, camera)
  if (now - lastLabelUpdate > 45) { updateLabels(); lastLabelUpdate = now }
  if (now - lastPeopleStatusUpdate > 250) {
    publishPeopleStatus()
    lastPeopleStatusUpdate = now
  }
}

function release(root) {
  const geometries = new Set(), materials = new Set()
  root?.traverse(node => {
    if (node.geometry) geometries.add(node.geometry)
    if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => materials.add(m))
  })
  geometries.forEach(g => g.dispose())
  materials.forEach(m => m.dispose())
}

async function loadModel() {
  status.value = 'loading'; error.value = ''; progress.value = 0
  try {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/campus.glb`, event => {
      if (event.total) progress.value = Math.round(event.loaded / event.total * 100)
    })
    if (disposed) { release(gltf.scene); return }
    model = gltf.scene
    model.traverse(node => {
      if (node.isMesh) {
        node.castShadow = !/_(paint|field|fieldLight|track|lawn|lawnLight|road|pavement)$/.test(node.name)
        node.receiveShadow = !/_paint$/.test(node.name)
      }
      if (node.userData.buildingId) roots.push(node)
      if (node.userData.layer === 'trees') treeLayer = node
    })
    const ids = new Set(roots.map(node => node.userData.buildingId))
    if (!props.buildings.every(b => ids.has(b.buildingId))) {
      release(model); model = null; roots = []
      throw new Error('模型缺少六栋建筑的 buildingId，请恢复随附模型或按说明重新导出。')
    }
    scene.add(model)
    if (treeLayer) treeLayer.visible = props.trees
    updateMarkers()
    status.value = 'ready'
    emit('ready')
  } catch (e) {
    status.value = 'error'
    error.value = `校园模型加载失败。${e.message || '请检查模型文件是否存在，再重试。'}`
  }
}

function captureImage() {
  if (!renderer || status.value !== 'ready') return null
  renderer.render(scene, camera)
  return renderer.domElement.toDataURL('image/png')
}

onMounted(() => {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7))
    renderer.shadowMap.enabled = props.shadows
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.3
    renderer.domElement.setAttribute('aria-label', '可旋转的校园三维模型；也可通过建筑列表选择楼宇')
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); status.value = 'context-lost'; error.value = '三维显示已中断。请刷新页面重新加载，或尝试启用浏览器图形加速。'
    })
    host.value.prepend(renderer.domElement)
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0xe9f0ed)
    scene.add(new THREE.HemisphereLight(0xf8ffff, 0x97a08d, 2.1))
    sun = new THREE.DirectionalLight(0xfff4df, 3)
    sun.position.set(-140, 220, 110)
    sun.castShadow = true
    Object.assign(sun.shadow.camera, { left: -225, right: 225, top: 225, bottom: -225, near: 1, far: 650 })
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.normalBias = 0.12
    scene.add(sun)
    camera = new THREE.PerspectiveCamera(42, 1, 1, 2000)
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 55
    controls.maxDistance = 950
    controls.maxPolarAngle = Math.PI / 2 - 0.07
    controls.addEventListener('start', () => { transition = null })
    resize()
    camera.position.copy(overviewPosition('perspective'))
    controls.target.set(0, 0, 0)
    controls.update()
    selection = marker(0x287e69, 0.9)
    alarmRing = marker(0xe08733, 1)
    selection.visible = false; alarmRing.visible = false
    buildPeople()
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host.value)
    animation = requestAnimationFrame(animate)
    loadModel()
  } catch (e) {
    status.value = 'unsupported'
    error.value = '无法启动三维视图。请使用支持 WebGL 2 的浏览器并启用图形加速。楼宇数据和时间切换仍可使用。'
  }
})

watch(() => [props.selectedId, ...props.alarmIds], updateMarkers)
watch(() => props.trees, value => { if (treeLayer) treeLayer.visible = value })
watch(() => props.shadows, value => { if (renderer) renderer.shadowMap.enabled = value })
watch(() => props.people, value => { if (peopleLayer) { peopleLayer.visible = value; updatePeople(0) } })
watch(() => props.peopleDensity, buildPeople)
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(animation)
  resizeObserver?.disconnect()
  controls?.dispose()
  release(scene)
  renderer?.dispose()
  renderer?.domElement.remove()
})
defineExpose({ setView, focusBuilding, captureImage })
</script>

<template>
  <div ref="host" class="campus-canvas" :data-status="status" :data-people-count="peopleCount" :data-people-state="peopleState" :data-first-person-x="firstPersonX" :data-first-person-position="firstPersonPosition">
    <div v-if="status === 'loading'" class="scene-message" role="status">
      <span class="loading-ring"></span><strong>正在展开青禾校园</strong><span>加载三维模型 {{ progress ? `${progress}%` : '' }}</span>
    </div>
    <div v-else-if="status !== 'ready'" class="scene-message scene-error" role="alert">
      <Icon name="info" :size="32" /><strong>三维场景暂不可用</strong><p>{{ error }}</p>
      <button v-if="status === 'error'" class="button primary" @click="loadModel">重新加载模型</button>
    </div>
    <div v-show="labels && status === 'ready'" class="scene-labels">
      <button v-for="building in buildings" :key="building.buildingId" :ref="element => rememberLabel(building.buildingId, element)"
        class="building-label" :class="{ selected: selectedId === building.buildingId, warning: alarmIds.includes(building.buildingId) }"
        :aria-label="`在三维场景中选择${building.name}`" :aria-pressed="selectedId === building.buildingId" @click="emit('select', building.buildingId)">
        <span class="label-dot"></span>{{ building.name }}<Icon v-if="alarmIds.includes(building.buildingId)" name="alert" :size="13" />
      </button>
    </div>
  </div>
</template>
