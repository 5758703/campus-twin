const ROUTES = {
  centralLoop: [
    [-130, 48], [-130, -46], [-42, -46], [-42, 48], [42, 48],
    [42, -46], [130, -46], [130, 48], [42, 48], [0, 92], [-42, 48],
  ],
  northLoop: [
    [-128, -96], [-128, -54], [-45, -54], [-45, -96],
    [45, -96], [45, -54], [128, -54], [128, -96],
  ],
  gateToLibrary: [
    [-6, 101], [-6, 48], [-42, 48], [-42, -5], [0, -5],
    [42, -5], [42, 48], [6, 48], [6, 101],
  ],
  westWalk: [
    [-132, 94], [-132, 48], [-42, 48], [-42, 7], [-132, 7],
  ],
  eastWalk: [
    [132, 94], [132, 48], [42, 48], [42, 7], [132, 7],
  ],
  track: Array.from({ length: 32 }, (_, index) => {
    const angle = Math.PI * 2 * index / 32
    return [65 + Math.cos(angle) * 46, 65 + Math.sin(angle) * 26]
  }),
}

const DENSITIES = {
  low: { students: 8, teachers: 2, runners: 2 },
  medium: { students: 20, teachers: 4, runners: 4 },
  high: { students: 36, teachers: 6, runners: 8 },
}

function routeLength(route) {
  let total = 0
  for (let index = 0; index < route.length; index++) {
    const [x1, z1] = route[index]
    const [x2, z2] = route[(index + 1) % route.length]
    total += Math.hypot(x2 - x1, z2 - z1)
  }
  return total
}

export function sampleRoute(route, progress) {
  if (!Array.isArray(route) || route.length < 2) throw new RangeError('人物路线至少需要两个点')
  const wrapped = ((progress % 1) + 1) % 1
  const total = routeLength(route)
  let remaining = wrapped * total
  for (let index = 0; index < route.length; index++) {
    const [x1, z1] = route[index]
    const [x2, z2] = route[(index + 1) % route.length]
    const segment = Math.hypot(x2 - x1, z2 - z1)
    if (remaining < segment || index === route.length - 1) {
      const ratio = segment ? remaining / segment : 0
      return {
        x: x1 + (x2 - x1) * ratio,
        z: z1 + (z2 - z1) * ratio,
        directionX: segment ? (x2 - x1) / segment : 0,
        directionZ: segment ? (z2 - z1) / segment : 1,
      }
    }
    remaining -= segment
  }
}

export function createPeoplePlan(density = 'medium') {
  const definition = DENSITIES[density] || DENSITIES.medium
  const people = []
  const walkingRoutes = ['centralLoop', 'northLoop', 'gateToLibrary', 'westWalk', 'eastWalk']
  const walkingStudents = definition.students - definition.runners
  for (let index = 0; index < walkingStudents; index++) {
    const routeName = walkingRoutes[index % walkingRoutes.length]
    people.push({
      id: `student-${index + 1}`,
      role: 'student',
      motion: 'walk',
      routeName,
      route: ROUTES[routeName],
      phase: (index * 0.173) % 1,
      speed: 0.00145 + (index % 4) * 0.00012,
      palette: index % 5,
    })
  }
  for (let index = 0; index < definition.runners; index++) {
    people.push({
      id: `runner-${index + 1}`,
      role: 'student',
      motion: 'jog',
      routeName: 'track',
      route: ROUTES.track,
      phase: index / definition.runners,
      speed: 0.0085 + (index % 3) * 0.0006,
      palette: (index + 2) % 5,
    })
  }
  for (let index = 0; index < definition.teachers; index++) {
    const routeName = walkingRoutes[(index * 2 + 1) % walkingRoutes.length]
    people.push({
      id: `teacher-${index + 1}`,
      role: 'teacher',
      motion: 'walk',
      routeName,
      route: ROUTES[routeName],
      phase: (0.11 + index * 0.237) % 1,
      speed: 0.00115 + (index % 2) * 0.0001,
      palette: index % 3,
    })
  }
  return people
}

export function shouldAnimatePeople({ enabled, hidden, reducedMotion }) {
  return Boolean(enabled && !hidden && !reducedMotion)
}
