import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { createCampus } from '../src/scene/createCampus.js'

// GLTFExporter uses the browser FileReader API; Blob itself is provided by Node.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buffer => { this.result = buffer; this.onloadend?.() }).catch(error => this.onerror?.(error))
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`
      this.onloadend?.()
    }).catch(error => this.onerror?.(error))
  }
}
const data = JSON.parse(await readFile(new URL('../src/data/campus.json', import.meta.url), 'utf8'))
const scene = createCampus(data.layout)
scene.updateMatrixWorld(true)
const binary = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true })
const directory = new URL('../public/models/', import.meta.url)
await mkdir(directory, { recursive: true })
await writeFile(new URL('campus.glb', directory), Buffer.from(binary))
console.log(`Exported campus.glb: ${(binary.byteLength / 1024 / 1024).toFixed(2)} MB`)
