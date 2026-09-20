<script setup>
import { computed, ref, onBeforeUnmount } from 'vue'
import CampusScene from './components/CampusScene.vue'
import Icon from './components/Icon.vue'
import data from './data/campus.json'
import { getSnapshot, nextFrame, createReport } from './domain/simulation.js'

const frameIndex = ref(0)
const basePath = import.meta.env.BASE_URL
const selectedId = ref('L01')
const query = ref('')
const tab = ref('overview')
const playing = ref(false)
const sceneRef = ref(null)
const sceneReady = ref(false)
const view = ref('perspective')
const labels = ref(true)
const trees = ref(true)
const shadows = ref(true)
const people = ref(true)
const peopleDensity = ref('medium')
const layerPanel = ref(false)
const notice = ref('')
let playbackTimer, noticeTimer

const icons = { T01: 'building', L01: 'lab', LIB01: 'book', D01: 'home', C01: 'food', G01: 'sport' }
const descriptions = { T01: '教学区', L01: '科研区', LIB01: '公共学习区', D01: '生活区', C01: '餐饮服务区', G01: '体育活动区' }
const snapshot = computed(() => getSnapshot(data, frameIndex.value))
const selected = computed(() => snapshot.value.buildings.find(b => b.buildingId === selectedId.value))
const alarmIds = computed(() => snapshot.value.alarms.map(b => b.buildingId))
const visibleBuildings = computed(() => {
  const list = snapshot.value.buildings.filter(b => `${b.name}${b.buildingId}`.toLowerCase().includes(query.value.toLowerCase().trim()))
  return tab.value === 'energy' ? [...list].sort((a, b) => b.powerKw - a.powerKw) : list
})
const trendValues = computed(() => data.frames.map(frame => frame.buildings.find(b => b.buildingId === selectedId.value).powerKw))
const trendPoints = computed(() => trendValues.value.map((value, index) => `${34 + index * 100},${105 - value / 160 * 75}`).join(' '))
const selectedPowerShare = computed(() => Math.round(selected.value.powerKw / snapshot.value.totalPower * 100))
const visiblePeopleCount = computed(() => ({ low: 10, medium: 24, high: 42 })[peopleDensity.value])

function chooseBuilding(id, focus = true) {
  selectedId.value = id
  if (focus) sceneRef.value?.focusBuilding(id)
}
function pause() { clearInterval(playbackTimer); playbackTimer = undefined; playing.value = false }
function seek(index) { pause(); frameIndex.value = index }
function play() {
  if (playing.value) { pause(); return }
  if (frameIndex.value === data.frames.length - 1) frameIndex.value = 0
  playing.value = true
  playbackTimer = setInterval(() => {
    const next = nextFrame(frameIndex.value, data.frames.length)
    frameIndex.value = next.index
    if (next.ended) pause()
  }, data.playback.wallClockIntervalSeconds * 1000)
}
function reset() { pause(); frameIndex.value = 0 }
function toast(text) { notice.value = text; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.value = '' }, 3500) }
function download(content, filename, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function exportReport() { download(createReport(snapshot.value), `青禾校园_模拟快照_${snapshot.value.time.replace(':', '')}.md`); toast('当前时刻的运行快照已导出') }
function exportData() { download(JSON.stringify(data, null, 2), 'campus-simulated-data.json', 'application/json'); toast('完整模拟数据已导出') }
function screenshot() {
  const image = sceneRef.value?.captureImage()
  if (!image) { toast('请等待三维场景加载完成'); return }
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width; canvas.height = img.height
    const context = canvas.getContext('2d')
    context.drawImage(img, 0, 0)
    context.fillStyle = '#ffffffee'; context.fillRect(0, canvas.height - 52, canvas.width, 52)
    context.fillStyle = '#234b40'; context.font = '18px "Microsoft YaHei", sans-serif'
    context.fillText(`青禾校园  |  模拟场景  |  ${snapshot.value.time}`, 20, canvas.height - 20)
    canvas.toBlob(blob => {
      if (blob) { download(blob, `青禾校园_三维场景_${snapshot.value.time.replace(':', '')}.png`, 'image/png'); toast('三维场景截图已保存（不含界面标签）') }
    })
  }
  img.src = image
}
function viewCampus(mode) { sceneRef.value?.setView(mode) }
function hidePlayback() { if (document.hidden && playing.value) { pause(); toast('页面切到后台，模拟播放已暂停') } }
document.addEventListener('visibilitychange', hidePlayback)
onBeforeUnmount(() => { pause(); clearTimeout(noticeTimer); document.removeEventListener('visibilitychange', hidePlayback) })
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="青禾校园总览" @click.prevent="tab = 'overview'; viewCampus('perspective')">
        <span class="brand-mark"><Icon name="campus" :size="28" /></span>
        <span><strong>青禾校园</strong><small>校园数字孪生观察台</small></span>
      </a>
      <div class="header-context"><span class="subtle-divider"></span><span>让校园运行，看得见</span></div>
      <div class="header-actions">
        <span class="simulation-badge"><span></span>模拟演示</span>
        <button class="button export-button" @click="exportReport"><Icon name="down" :size="17" /><span>导出快照</span></button>
        <button class="avatar" aria-label="查看演示说明" @click="toast('虚构校园与模拟数据；未连接真实设备，不用于安全判断。')">青</button>
      </div>
    </header>

    <div class="navigation-row">
      <nav aria-label="功能导航" class="main-nav">
        <button :class="{ active: tab === 'overview' }" :aria-current="tab === 'overview' ? 'page' : undefined" @click="tab = 'overview'"><Icon name="grid" :size="18" />校园总览</button>
        <button :class="{ active: tab === 'energy' }" :aria-current="tab === 'energy' ? 'page' : undefined" @click="tab = 'energy'"><Icon name="bolt" :size="18" />能耗观察</button>
        <button :class="{ active: tab === 'alarms' }" :aria-current="tab === 'alarms' ? 'page' : undefined" @click="tab = 'alarms'"><Icon name="bell" :size="18" />告警中心<span v-if="snapshot.alarms.length" class="nav-count">{{ snapshot.alarms.length }}</span></button>
      </nav>
      <div class="date-line"><span class="connection-dot"></span>本地模拟场景<span class="date">2026 / 09 / 18</span></div>
    </div>

    <main class="workspace">
      <aside class="left-panel">
        <div class="panel-heading"><h2>{{ tab === 'alarms' ? '当前告警' : tab === 'energy' ? '建筑功率' : '校园空间' }}</h2><span class="count-badge">{{ tab === 'alarms' ? snapshot.alarms.length : '06' }}</span></div>
        <p class="panel-subtitle">{{ tab === 'alarms' ? '与当前模拟时刻同步' : tab === 'energy' ? '按当前功率从高到低排列' : '选择楼宇，查看空间与运行数据' }}</p>

        <template v-if="tab !== 'alarms'">
          <label class="search-box"><Icon name="search" :size="17" /><input v-model="query" aria-label="搜索建筑名称或编号" placeholder="搜索建筑名称或编号" /><button v-if="query" class="clear-search" aria-label="清空搜索" @click="query = ''"><Icon name="close" :size="15" /></button></label>
          <div class="list-caption"><span>{{ tab === 'energy' ? '楼宇功率排行' : '全部建筑' }}</span><span>{{ visibleBuildings.length }} 栋</span></div>
          <div class="building-list">
            <button v-for="building in visibleBuildings" :key="building.buildingId" class="building-row" :class="{ active: selectedId === building.buildingId, 'has-alarm': building.alarm }" :aria-pressed="selectedId === building.buildingId" :data-building="building.buildingId" @click="chooseBuilding(building.buildingId)">
              <span class="building-icon"><Icon :name="icons[building.buildingId]" :size="21" /></span>
              <span class="building-copy"><strong>{{ building.name }}</strong><small>{{ building.buildingId }}<span class="row-dot"></span>{{ descriptions[building.buildingId] }}</small><span v-if="tab === 'energy'" class="power-bar"><i :style="{ width: `${building.powerKw / 160 * 100}%` }"></i></span></span>
              <span v-if="tab === 'energy'" class="row-power">{{ building.powerKw }}<small>kW</small></span><span v-else class="status-dot" :class="{ warning: building.alarm }" :title="building.alarm ? '温度告警' : '正常'"></span>
            </button>
            <div v-if="!visibleBuildings.length" class="empty-state"><Icon name="search" :size="28" /><strong>没有找到这栋楼</strong><span>试试“实验楼”或“L01”</span></div>
          </div>
        </template>
        <div v-else class="alarm-list">
          <button v-for="alarm in snapshot.alarms" :key="alarm.buildingId" class="alarm-item" @click="chooseBuilding(alarm.buildingId)"><Icon name="alert" :size="21" /><span><strong>{{ alarm.name }} · 温度偏高</strong><small>{{ alarm.temperatureC }}℃ / 演示阈值 32℃</small><em>定位这栋建筑 <Icon name="arrow" :size="14" /></em></span></button>
          <div v-if="!snapshot.alarms.length" class="empty-state clear-state"><span class="clear-state-icon"><Icon name="check" :size="25" /></span><strong>当前没有告警</strong><span>{{ frameIndex === 2 ? '实验楼模拟测点已恢复正常' : '切换至 09:05，查看告警场景' }}</span></div>
          <div class="rule-note"><Icon name="info" :size="16" /><p>仅模拟实验楼代表测点温度 ≥ 32℃ 的场景，此阈值不作为安全标准。</p></div>
        </div>

        <div class="campus-note"><div class="note-illustration"><Icon name="tree" :size="26" /><span></span><Icon name="campus" :size="38" /><span></span><Icon name="tree" :size="23" /></div><strong>一座可探索的模拟校园</strong><p>六栋建筑，一片运动场。<br />从空间出发，了解每一处变化。</p><div class="campus-dimensions"><span>300 × 220 <small>米</small></span><span>规划场地</span></div></div>
        <div class="data-source"><span class="connection-dot"></span>数据来源：本地模拟数据集</div>
      </aside>

      <section class="center-panel" aria-label="校园总览与三维场景">
        <div class="summary-grid">
          <div class="summary-item"><span class="summary-icon"><Icon name="building" :size="20" /></span><div><span class="metric-label">已建模建筑</span><div class="metric-value">06<small>栋</small></div></div><span class="metric-footnote">均可点选</span></div>
          <div class="summary-item"><span class="summary-icon energy"><Icon name="bolt" :size="20" /></span><div><span class="metric-label">建筑功率合计</span><div class="metric-value" data-testid="total-power">{{ snapshot.totalPower }}<small>kW</small></div></div><span class="metric-footnote">当前时刻</span></div>
          <div class="summary-item"><span class="summary-icon people"><Icon name="people" :size="20" /></span><div><span class="metric-label">在楼人数合计</span><div class="metric-value">{{ snapshot.totalOccupants.toLocaleString() }}<small>人</small></div></div><span class="metric-footnote">六栋建筑</span></div>
          <button class="summary-item alarm-summary" :class="{ warning: snapshot.alarms.length }" @click="tab = 'alarms'"><span class="summary-icon alert"><Icon name="bell" :size="20" /></span><div><span class="metric-label">当前告警</span><div class="metric-value" data-testid="alarm-count">{{ snapshot.alarms.length.toString().padStart(2, '0') }}<small>条</small></div></div><Icon name="arrow" :size="16" /></button>
        </div>

        <div class="scene-card">
          <CampusScene ref="sceneRef" :buildings="data.layout.buildings" :selected-id="selectedId" :alarm-ids="alarmIds" :labels="labels" :trees="trees" :shadows="shadows" :people="people" :people-density="peopleDensity" @select="chooseBuilding" @ready="sceneReady = true" @view-change="view = $event" />
          <div class="scene-title"><span class="scene-kicker"><span></span>校园空间</span><h1>全景观察</h1><p>从每一栋楼，读懂校园</p><span v-if="people" class="people-status-chip"><Icon name="people" :size="13" />{{ visiblePeopleCount }} 人活动中</span></div>
          <div class="view-switch" aria-label="场景视角"><button :class="{ active: view !== 'top' }" :aria-pressed="view !== 'top'" @click="viewCampus('perspective')">三维</button><button :class="{ active: view === 'top' }" :aria-pressed="view === 'top'" @click="viewCampus('top')">俯视</button></div>
          <div class="scene-toolbar">
            <button class="scene-tool" title="回到全景" aria-label="回到全景" @click="viewCampus('perspective')"><Icon name="target" /></button>
            <button class="scene-tool" :class="{ active: layerPanel }" title="图层设置" aria-label="图层设置" :aria-expanded="layerPanel" @click="layerPanel = !layerPanel"><Icon name="layers" /></button>
            <button class="scene-tool" title="保存三维场景图片" aria-label="保存三维场景图片" :disabled="!sceneReady" @click="screenshot"><Icon name="camera" /></button>
          </div>
          <div v-if="layerPanel" class="layer-panel"><h3>场景图层</h3><label><span><Icon name="pin" :size="16" />建筑名称</span><input v-model="labels" type="checkbox" /></label><label><span><Icon name="tree" :size="16" />校园绿化</span><input v-model="trees" type="checkbox" /></label><label><span><Icon name="sun" :size="16" />日照阴影</span><input v-model="shadows" type="checkbox" /></label><label><span><Icon name="people" :size="16" />校园人物</span><input v-model="people" type="checkbox" /></label><label class="density-control"><span>人物密度</span><select v-model="peopleDensity" aria-label="人物密度"><option value="low">低 · 10 人</option><option value="medium">中 · 24 人</option><option value="high">高 · 42 人</option></select></label><p class="motion-note">学生在道路和跑道活动，老师沿校园道路步行。系统减少动态效果时，人物保持静止。</p></div>
          <div class="compass" aria-label="方位参考，俯视图上方为北"><span>北</span><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m20 6-7 26 7-5Z" fill="#42705f"/><path d="m20 6 7 26-7-5Z" fill="#b1c6ba"/></svg></div>
          <div class="scene-legend"><span><i class="legend-normal"></i>正常</span><span><i class="legend-selected"></i>已选择</span><span><i class="legend-alarm"></i>温度告警</span><span v-if="people"><i class="legend-people"></i>校园人物</span></div>
          <div class="scene-hint"><Icon name="eye" :size="15" /><span>拖动旋转 · 滚轮缩放 · 点击建筑</span></div>
          <span class="scene-caption">模拟校园 / 非实景测绘</span>
        </div>

        <section class="timeline" aria-label="模拟时间控制">
          <div class="timeline-heading"><div><span class="timeline-dot"></span><h2>场景回放</h2><span class="timeline-note">每 5 秒推进一个模拟时刻</span></div><strong class="simulation-time" data-testid="simulation-time">{{ snapshot.time }}<small>模拟时间</small></strong></div>
          <div class="timeline-controls"><button class="play-button" :aria-label="playing ? '暂停模拟' : frameIndex === 2 ? '重新播放模拟' : '播放模拟'" @click="play"><Icon :name="playing ? 'pause' : 'play'" :size="18" /></button><button class="replay-button" title="回到起点" aria-label="回到起点" @click="reset"><Icon name="reset" :size="18" /></button><div class="timeline-track"><span class="track-line"></span><span class="track-progress" :style="{ width: `${frameIndex * 50}%` }"></span><button v-for="(frame, index) in data.frames" :key="frame.simulatedAt" class="time-stop" :class="{ active: frameIndex === index, past: frameIndex > index }" :aria-label="`切换至 ${frame.simulatedAt.slice(11, 16)}`" :aria-pressed="frameIndex === index" @click="seek(index)"><span class="time-node"></span><strong>{{ frame.simulatedAt.slice(11, 16) }}</strong><small>{{ ['正常运行', '温度告警', '恢复正常'][index] }}</small></button></div></div>
        </section>
      </section>

      <aside class="right-panel" aria-label="建筑详情">
        <div class="panel-heading"><h2>建筑详情</h2><span class="detail-status" :class="{ warning: selected.alarm }"><i></i>{{ selected.alarm ? '温度告警' : '正常运行' }}</span></div>
        <div class="detail-cover"><div class="cover-grid"></div><Icon :name="icons[selectedId]" :size="70" /><span class="cover-code">{{ selectedId }}</span><div class="cover-meta"><span>{{ descriptions[selectedId] }}</span><strong>{{ selected.name }}</strong></div></div>
        <div class="building-title"><div><h3 data-testid="selected-name">{{ selected.name }}</h3><p>{{ selected.size.height }} 米建筑高度 <span>·</span> {{ selected.size.width }} × {{ selected.size.depth }} 米占地</p></div><button class="icon-button" aria-label="定位当前建筑" title="定位当前建筑" @click="chooseBuilding(selectedId)"><Icon name="target" :size="19" /></button></div>
        <div class="detail-metrics">
          <div><span><Icon name="bolt" :size="17" />当前功率</span><strong>{{ selected.powerKw }}<small>kW</small></strong></div>
          <div :class="{ warning: selected.alarm }"><span><Icon name="temp" :size="17" />代表测点温度</span><strong data-testid="selected-temperature">{{ selected.temperatureC.toFixed(1) }}<small>℃</small></strong></div>
          <div><span><Icon name="people" :size="17" />在楼人数</span><strong>{{ selected.occupants }}<small>人</small></strong></div>
        </div>
        <section class="trend-section"><div class="section-heading"><h3>功率变化</h3><span>模拟序列 · kW</span></div><svg class="trend-chart" viewBox="0 0 256 142" role="img" :aria-label="`${selected.name}三个时刻的功率：${trendValues.join('、')}千瓦`"><defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#439b82" stop-opacity="0.2"/><stop offset="100%" stop-color="#439b82" stop-opacity="0.01"/></linearGradient></defs><path d="M34 30H234M34 67H234M34 105H234" stroke="#e7eee9" stroke-dasharray="3 4" fill="none"/><text x="0" y="33" class="chart-axis">160</text><text x="3" y="70" class="chart-axis">80</text><text x="9" y="108" class="chart-axis">0</text><polygon :points="`34,105 ${trendPoints} 234,105`" fill="url(#trend-fill)"/><polyline :points="trendPoints" fill="none" stroke="#2d8068" stroke-width="2.5" stroke-linejoin="round"/><g v-for="(value, index) in trendValues" :key="index"><circle :cx="34 + index * 100" :cy="105 - value / 160 * 75" :r="index === frameIndex ? 5 : 3" :fill="index === frameIndex ? '#176759' : '#ffffff'" stroke="#2d8068" stroke-width="2"/><text :x="34 + index * 100" :y="105 - value / 160 * 75 - 12" class="chart-value" text-anchor="middle">{{ value }}</text><text :x="34 + index * 100" y="130" class="chart-time" text-anchor="middle">{{ ['09:00', '09:05', '09:10'][index] }}</text></g></svg><div class="share-caption"><span>占六栋建筑当前功率</span><strong>{{ selectedPowerShare }}%</strong></div><div class="share-track"><span :style="{ width: `${selectedPowerShare}%` }"></span></div></section>
        <div class="building-alert" :class="{ warning: selected.alarm }"><Icon :name="selected.alarm ? 'alert' : 'check'" :size="19" /><div><strong>{{ selected.alarm ? '代表测点温度偏高' : selectedId === 'L01' && frameIndex === 2 ? '模拟温度已恢复' : '当前无模拟告警' }}</strong><p>{{ selected.alarm ? '当前 32.4℃，已达到演示阈值 32℃。' : '数据随场景回放更新。' }}</p></div></div>
        <p class="detail-disclaimer">数值为模拟数据。温度来自单个演示测点，非整栋楼平均值；告警不作为安全判断。</p>
        <button class="data-download" @click="exportData"><Icon name="down" :size="16" />下载完整模拟数据<Icon name="arrow" :size="15" /></button>
      </aside>
    </main>

    <footer class="footer"><span>青禾校园数字孪生 Demo <i></i> 模拟数据，仅供演示</span><a :href="`${basePath}models/campus.glb`" download="campus.glb"><Icon name="layers" :size="14" />下载三维模型</a></footer>
    <div v-if="notice" class="toast" role="status"><Icon name="check" :size="18" />{{ notice }}</div>
  </div>
</template>
