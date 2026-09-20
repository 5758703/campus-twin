import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createPeoplePlan,
  sampleRoute,
  shouldAnimatePeople,
} from '../src/scene/peopleMovement.js'

test('medium density creates twenty students and four teachers', () => {
  const plan = createPeoplePlan('medium')

  assert.equal(plan.length, 24)
  assert.equal(plan.filter(person => person.role === 'student').length, 20)
  assert.equal(plan.filter(person => person.role === 'teacher').length, 4)
})

test('density levels change crowd size without changing the teacher distinction', () => {
  const low = createPeoplePlan('low')
  const high = createPeoplePlan('high')

  assert.equal(low.length, 10)
  assert.equal(high.length, 42)
  assert.ok(low.some(person => person.role === 'teacher'))
  assert.ok(high.some(person => person.role === 'teacher'))
  assert.ok(high.every(person => person.speed > 0 && person.route.length >= 4))
})

test('the running track receives students while teachers remain on campus paths', () => {
  const plan = createPeoplePlan('medium')
  const runners = plan.filter(person => person.motion === 'jog')

  assert.equal(runners.length, 4)
  assert.ok(runners.every(person => person.role === 'student'))
  assert.ok(plan.filter(person => person.role === 'teacher').every(person => person.motion === 'walk'))
})

test('route sampling loops and reports a forward-facing tangent', () => {
  const route = [[0, 0], [10, 0], [10, 10], [0, 10]]

  assert.deepEqual(sampleRoute(route, 0), { x: 0, z: 0, directionX: 1, directionZ: 0 })
  assert.deepEqual(sampleRoute(route, 0.25), { x: 10, z: 0, directionX: 0, directionZ: 1 })
  assert.deepEqual(sampleRoute(route, 1), sampleRoute(route, 0))
  assert.deepEqual(sampleRoute(route, 1.125), { x: 5, z: 0, directionX: 1, directionZ: 0 })
})

test('people animation pauses for hidden pages, disabled layers and reduced motion', () => {
  assert.equal(shouldAnimatePeople({ enabled: true, hidden: false, reducedMotion: false }), true)
  assert.equal(shouldAnimatePeople({ enabled: false, hidden: false, reducedMotion: false }), false)
  assert.equal(shouldAnimatePeople({ enabled: true, hidden: true, reducedMotion: false }), false)
  assert.equal(shouldAnimatePeople({ enabled: true, hidden: false, reducedMotion: true }), false)
})
