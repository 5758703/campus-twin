import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getSnapshot, nextFrame, findBuildingId, createReport } from '../src/domain/simulation.js'

const data = JSON.parse(readFileSync(new URL('../src/data/campus.json', import.meta.url)))

test('three snapshots retain documented power totals, occupants and active alarms', () => {
  for (let i = 0; i < 3; i++) {
    const s = getSnapshot(data, i)
    assert.equal(s.totalPower, [477, 492, 447][i])
    assert.equal(s.totalOccupants, 1410)
    assert.equal(s.alarms.length, [0, 1, 0][i])
    assert.equal(s.buildings.length, 6)
  }
})
test('seeking backward clears stale alarm state and does not mutate source data', () => {
  const original = JSON.stringify(data)
  assert.equal(getSnapshot(data, 1).alarms[0].buildingId, 'L01')
  assert.equal(getSnapshot(data, 2).alarms.length, 0)
  assert.equal(getSnapshot(data, 0).alarms.length, 0)
  assert.equal(JSON.stringify(data), original)
})
test('threshold is inclusive and scoped to the configured building', () => {
  const copy = structuredClone(data)
  copy.frames[0].buildings.find(b => b.buildingId === 'L01').temperatureC = 32
  copy.frames[0].buildings.find(b => b.buildingId === 'T01').temperatureC = 99
  assert.deepEqual(getSnapshot(copy, 0).alarms.map(a => a.buildingId), ['L01'])
})
test('playback stops at last frame and can explicitly replay', () => {
  assert.deepEqual(nextFrame(0, 3), { index: 1, ended: false })
  assert.deepEqual(nextFrame(1, 3), { index: 2, ended: true })
  assert.deepEqual(nextFrame(2, 3), { index: 2, ended: true })
})
test('invalid frame indices are rejected rather than mixing undefined telemetry', () => {
  for (const i of [-1, 3, NaN, 0.5]) assert.throws(() => getSnapshot(data, i), RangeError)
})
test('clicking a child mesh resolves the parent building while landscaping returns null', () => {
  const parent = { userData: { buildingId: 'L01' }, parent: null }
  assert.equal(findBuildingId({ userData: {}, parent }), 'L01')
  assert.equal(findBuildingId({ userData: {}, parent: null }), null)
})
test('export includes selected frame, simulation notice, current alarms and correct units', () => {
  const report = createReport(getSnapshot(data, 1))
  assert.match(report, /模拟数据/)
  assert.match(report, /09:05/)
  assert.match(report, /492 kW/)
  assert.match(report, /32.4/)
  assert.match(report, /L01/)
})
