<script setup>
defineProps({ name: String, size: { type: Number, default: 20 } })
const paths = {
  campus: ['M3 21h18M5 21V8l7-4 7 4v13M9 21V11h6v10M12 1v3'],
  layers: ['m12 3 10 5-10 5L2 8l10-5Z', 'm2 12 10 5 10-5M2 16l10 5 10-5'],
  grid: ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
  bolt: ['m13 2-9 12h7l-1 8 10-12h-7l1-8Z'],
  people: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', 'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  alert: ['m10.3 3.9-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4'],
  down: ['M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5'],
  arrow: ['M5 12h14m-5-5 5 5-5 5'],
  search: ['M21 21l-5-5', 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0'],
  building: ['M4 21V5h11v16M15 10h5v11M2 21h20M8 9h3M8 13h3M8 17h3'],
  book: ['M12 21V5M12 5C8 2 4 2 2 3v16c4-1 7-1 10 2 3-3 6-3 10-2V3c-3-1-7-1-10 2Z'],
  lab: ['M9 3h6M10 3v7L4 19a1.3 1.3 0 0 0 1 2h14a1.3 1.3 0 0 0 1-2l-6-9V3M7 15h10'],
  home: ['m3 10 9-7 9 7v11H3V10ZM9 21v-8h6v8'],
  food: ['M4 3v7c0 3 6 3 6 0V3M7 3v18M20 3c-5 3-5 10 0 10V3Zm0 10v8'],
  sport: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2v20M5 5c10 2 12 9 14 14M19 5C9 7 7 14 5 19'],
  pin: ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z', 'M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  temp: ['M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0ZM12 8v9'],
  eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  target: ['M12 2v3M12 19v3M2 12h3M19 12h3', 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  play: ['m8 4 12 8-12 8V4Z'],
  pause: ['M7 4h3v16H7zM14 4h3v16h-3z'],
  reset: ['M3 11a9 9 0 1 1 2 7M3 4v7h7'],
  camera: ['M3 6h4l2-3h6l2 3h4v15H3V6Z', 'M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  check: ['m5 12 4 4L19 6'],
  info: ['M12 11v6M12 7h.01', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
  close: ['m6 6 12 12M18 6 6 18'],
  tree: ['m12 2 7 8h-3l5 7H3l5-7H5l7-8ZM12 17v5'],
  sun: ['M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1', 'M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0'],
}
</script>
<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="(path, index) in (paths[name] || paths.building)" :key="index" :d="path" />
  </svg>
</template>
