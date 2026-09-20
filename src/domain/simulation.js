export function getSnapshot(data, index) {
  if (!Number.isInteger(index) || index < 0 || index >= data.frames.length) {
    throw new RangeError('模拟时间索引超出范围')
  }
  const frame = data.frames[index]
  const rule = data.alarmRule
  const buildings = data.layout.buildings.map(meta => {
    const metrics = frame.buildings.find(b => b.buildingId === meta.buildingId)
    if (!metrics) throw new Error(`缺少 ${meta.buildingId} 的模拟数据`)
    return { ...meta, ...metrics, alarm: metrics.buildingId === rule.buildingId && metrics[rule.metric] >= rule.threshold }
  })
  return {
    index, simulatedAt: frame.simulatedAt, time: frame.simulatedAt.slice(11, 16), buildings,
    totalPower: buildings.reduce((sum, b) => sum + b.powerKw, 0),
    totalOccupants: buildings.reduce((sum, b) => sum + b.occupants, 0),
    alarms: buildings.filter(b => b.alarm).map(b => ({
      buildingId: b.buildingId, name: b.name, temperatureC: b.temperatureC,
      title: '代表测点温度偏高', threshold: rule.threshold,
    })),
  }
}

export function nextFrame(index, count) {
  const next = Math.min(index + 1, count - 1)
  return { index: next, ended: next === count - 1 }
}

export function findBuildingId(object) {
  for (let node = object; node; node = node.parent) {
    if (node.userData?.buildingId) return node.userData.buildingId
  }
  return null
}

export function createReport(snapshot) {
  const lines = [
    '# 青禾校园 · 模拟运行快照', '',
    '> 模拟数据，仅用于演示。校园与数值均为虚构，非真实监测或安全判断。', '',
    `模拟时刻：${snapshot.simulatedAt}`, '',
    `六栋建筑功率合计：${snapshot.totalPower} kW`,
    `在楼人数合计：${snapshot.totalOccupants} 人`,
    `当前告警：${snapshot.alarms.length} 条`, '',
    '| 编号 | 建筑 | 当前功率 / kW | 代表测点温度 / ℃ | 在楼人数 | 状态 |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    ...snapshot.buildings.map(b => `| ${b.buildingId} | ${b.name} | ${b.powerKw} | ${b.temperatureC} | ${b.occupants} | ${b.alarm ? '温度告警' : '正常'} |`),
    '', '告警条件：仅实验楼 L01 的模拟代表测点温度 ≥ 32℃；这是演示阈值，不是安全标准。',
    'kW 表示当前功率，不是 kWh 累计用电量。温度不是整栋楼的平均值。', '',
  ]
  return lines.join('\n')
}
