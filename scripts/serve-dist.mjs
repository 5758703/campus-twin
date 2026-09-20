import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, extname, sep } from 'node:path'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const port = Number(process.env.PORT || 4173)
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json; charset=utf-8' }
try { await stat(resolve(root, 'index.html')) } catch {
  console.error('未找到构建文件。请先运行 npm install 和 npm run build。')
  process.exit(1)
}
const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    let file = resolve(root, `.${pathname}`)
    if (file !== resolve(root) && !file.startsWith(resolve(root) + sep)) { response.writeHead(403); response.end(); return }
    if (!extname(file)) file = resolve(root, 'index.html')
    const content = await readFile(file)
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': content.byteLength, 'X-Content-Type-Options': 'nosniff' })
    response.end(request.method === 'HEAD' ? undefined : content)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('文件不存在')
  }
})
server.on('error', error => { console.error(`启动失败：${error.message}。可通过 PORT 环境变量修改端口。`); process.exitCode = 1 })
server.listen(port, '127.0.0.1', () => console.log(`青禾校园 Demo 已启动：http://127.0.0.1:${port}\n保持此窗口打开，按 Ctrl+C 停止。`))
