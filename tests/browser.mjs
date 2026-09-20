import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

const baseURL = process.env.DEMO_URL || 'http://127.0.0.1:5173'
const results = new URL('../test-results/', import.meta.url)
await mkdir(results, { recursive: true })
const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : existsSync(localChrome) ? { executablePath: localChrome } : {}),
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1, acceptDownloads: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const checks = []
async function check(label, action) { await action(); checks.push(label); console.log(`PASS ${label}`) }

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.locator('.campus-canvas[data-status="ready"]').waitFor({ timeout: 40000 })
  await page.waitForTimeout(1200)
  await check('GLB loads into a real WebGL canvas', async () => {
    assert.equal(await page.locator('.campus-canvas canvas').count(), 1)
    assert.equal(await page.locator('.building-label').count(), 6)
    assert.match(await page.getByTestId('total-power').textContent(), /477/)
    assert.equal(await page.getByTestId('selected-name').textContent(), '实验楼')
  })
  await check('students and teachers move through the live campus scene', async () => {
    const canvasHost = page.locator('.campus-canvas')
    assert.equal(await canvasHost.getAttribute('data-people-count'), '24')
    assert.equal(await canvasHost.getAttribute('data-people-state'), 'moving')
    const startPosition = await canvasHost.getAttribute('data-first-person-position')
    await page.waitForTimeout(650)
    assert.notEqual(await canvasHost.getAttribute('data-first-person-position'), startPosition)
  })
  await page.screenshot({ path: new URL('desktop-overview.png', results).pathname.replace(/^\/(?=[A-Za-z]:)/, ''), fullPage: true })
  await check('all six building list selections update detail data', async () => {
    for (const [id, name] of [['T01', '教学楼'], ['L01', '实验楼'], ['LIB01', '图书馆'], ['D01', '宿舍楼'], ['C01', '食堂'], ['G01', '体育馆']]) {
      await page.locator(`[data-building="${id}"]`).click()
      assert.equal(await page.getByTestId('selected-name').textContent(), name)
    }
  })
  await check('search and empty state work', async () => {
    await page.getByRole('textbox', { name: '搜索建筑名称或编号' }).fill('不存在')
    assert.equal(await page.locator('.building-row').count(), 0)
    await page.getByRole('textbox', { name: '搜索建筑名称或编号' }).fill('l01')
    assert.equal(await page.locator('.building-row').count(), 1)
    await page.getByRole('button', { name: '清空搜索', exact: true }).click()
  })
  await page.locator('[data-building="L01"]').click()
  await page.getByRole('button', { name: '回到全景', exact: true }).click()
  await page.waitForTimeout(1100)
  await check('alert frame drives metrics, labels and alarm list together', async () => {
    await page.getByRole('button', { name: '切换至 09:05', exact: true }).click()
    assert.match(await page.getByTestId('total-power').textContent(), /492/)
    assert.match(await page.getByTestId('selected-temperature').textContent(), /32.4/)
    assert.match(await page.getByTestId('alarm-count').textContent(), /01/)
    assert.equal(await page.locator('.building-label.warning').count(), 1)
    await page.getByRole('button', { name: /告警中心/ }).click()
    assert.equal(await page.locator('.alarm-item').count(), 1)
    await page.locator('.alarm-item').click()
    assert.equal(await page.getByTestId('selected-name').textContent(), '实验楼')
  })
  await page.getByRole('button', { name: '回到全景', exact: true }).click()
  await page.waitForTimeout(1100)
  await page.screenshot({ path: new URL('desktop-alarm.png', results).pathname.replace(/^\/(?=[A-Za-z]:)/, ''), fullPage: true })
  await check('recovery and backward seeking clear active alarms', async () => {
    await page.getByRole('button', { name: '切换至 09:10', exact: true }).click()
    assert.match(await page.getByTestId('total-power').textContent(), /447/)
    assert.match(await page.getByTestId('alarm-count').textContent(), /00/)
    assert.equal(await page.locator('.building-label.warning').count(), 0)
    assert.equal(await page.locator('.alarm-item').count(), 0)
    await page.getByRole('button', { name: '切换至 09:00', exact: true }).click()
    assert.match(await page.getByTestId('total-power').textContent(), /477/)
  })
  await check('power view ranks actual current values', async () => {
    await page.getByRole('button', { name: '能耗观察', exact: true }).click()
    assert.equal(await page.locator('.building-row').first().getAttribute('data-building'), 'L01')
  })
  await check('layer controls hide and restore labels', async () => {
    await page.getByRole('button', { name: '图层设置', exact: true }).click()
    const labelSwitch = page.getByRole('checkbox', { name: '建筑名称' })
    await labelSwitch.uncheck()
    assert.equal(await page.locator('.scene-labels').isVisible(), false)
    await labelSwitch.check()
    assert.equal(await page.locator('.scene-labels').isVisible(), true)
    await page.getByRole('checkbox', { name: '校园绿化' }).uncheck()
    await page.getByRole('checkbox', { name: '日照阴影' }).uncheck()
    await page.getByRole('checkbox', { name: '校园绿化' }).check()
    await page.getByRole('checkbox', { name: '日照阴影' }).check()
    const peopleSwitch = page.getByRole('checkbox', { name: '校园人物' })
    const density = page.getByRole('combobox', { name: '人物密度' })
    await density.selectOption('high')
    assert.equal(await page.locator('.campus-canvas').getAttribute('data-people-count'), '42')
    await peopleSwitch.uncheck()
    assert.equal(await page.locator('.campus-canvas').getAttribute('data-people-state'), 'hidden')
    await density.selectOption('low')
    assert.equal(await page.locator('.campus-canvas').getAttribute('data-people-count'), '10')
    await peopleSwitch.check()
    assert.equal(await page.locator('.campus-canvas').getAttribute('data-people-state'), 'moving')
    await density.selectOption('medium')
    assert.equal(await page.locator('.campus-canvas').getAttribute('data-people-count'), '24')
    await page.getByRole('button', { name: '图层设置', exact: true }).click()
  })
  await check('top view and 3D label picking work', async () => {
    await page.getByRole('button', { name: '俯视', exact: true }).click()
    await page.waitForTimeout(1000)
    // Click the teaching-building roof itself, below its HTML label.
    const canvas = await page.locator('.campus-canvas canvas').boundingBox()
    await page.mouse.click(canvas.x + canvas.width * 0.34, canvas.y + canvas.height * 0.445)
    assert.equal(await page.getByTestId('selected-name').textContent(), '教学楼')
    await page.getByRole('button', { name: '俯视', exact: true }).click()
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: '在三维场景中选择图书馆', exact: true }).click()
    assert.equal(await page.getByTestId('selected-name').textContent(), '图书馆')
  })
  await check('snapshot, source JSON, GLB and scene image download', async () => {
    for (const [selector, expected] of [
      [page.getByRole('button', { name: '导出快照', exact: true }), /\.md$/],
      [page.getByRole('button', { name: '下载完整模拟数据', exact: true }), /\.json$/],
      [page.getByRole('link', { name: '下载三维模型', exact: true }), /\.glb$/],
      [page.getByRole('button', { name: '保存三维场景图片', exact: true }), /\.png$/],
    ]) {
      const [download] = await Promise.all([page.waitForEvent('download'), selector.click()])
      assert.match(download.suggestedFilename(), expected)
      assert.equal(await download.failure(), null)
    }
  })
  await check('play advances and stops at the final frame; replay and pause work', async () => {
    await page.getByRole('button', { name: '回到起点', exact: true }).click()
    await page.getByRole('button', { name: '播放模拟', exact: true }).click()
    await page.waitForTimeout(5400)
    assert.equal(await page.getByTestId('simulation-time').innerText(), '09:05模拟时间')
    await page.waitForTimeout(5100)
    assert.match(await page.getByTestId('simulation-time').textContent(), /09:10/)
    assert.equal(await page.getByRole('button', { name: '重新播放模拟', exact: true }).count(), 1)
    await page.getByRole('button', { name: '重新播放模拟', exact: true }).click()
    assert.match(await page.getByTestId('simulation-time').textContent(), /09:00/)
    await page.getByRole('button', { name: '暂停模拟', exact: true }).click()
    await page.waitForTimeout(5200)
    assert.match(await page.getByTestId('simulation-time').textContent(), /09:00/)
  })
  await page.getByRole('button', { name: '校园总览', exact: true }).click()
  await page.getByRole('button', { name: '回到全景', exact: true }).click()
  await check('mobile layout has no horizontal overflow and retains interactions', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(1100)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    await page.screenshot({ path: new URL('mobile.png', results).pathname.replace(/^\/(?=[A-Za-z]:)/, ''), fullPage: true })
    await page.locator('[data-building="C01"]').click()
    assert.equal(await page.getByTestId('selected-name').textContent(), '食堂')
  })
  await check('failed model loading exposes actionable retry and leaves data usable', async () => {
    const failPage = await context.newPage()
    await failPage.route('**/models/campus.glb', route => route.abort())
    await failPage.goto(baseURL)
    await failPage.locator('.campus-canvas[data-status="error"]').waitFor({ timeout: 15000 })
    assert.equal(await failPage.getByRole('button', { name: '重新加载模型' }).count(), 1)
    await failPage.getByRole('button', { name: '切换至 09:05', exact: true }).click()
    assert.match(await failPage.getByTestId('total-power').textContent(), /492/)
    await failPage.unroute('**/models/campus.glb')
    await failPage.getByRole('button', { name: '重新加载模型' }).click()
    await failPage.locator('.campus-canvas[data-status="ready"]').waitFor({ timeout: 15000 })
    await failPage.close()
  })
  await check('WebGL unavailability shows an explanation without breaking data controls', async () => {
    const unsupported = await context.newPage()
    await unsupported.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type.startsWith('webgl') ? null : original.call(this, type, ...args)
      }
    })
    await unsupported.goto(baseURL)
    await unsupported.locator('.campus-canvas[data-status="unsupported"]').waitFor()
    await unsupported.getByRole('button', { name: '切换至 09:05', exact: true }).click()
    assert.match(await unsupported.getByTestId('total-power').textContent(), /492/)
    await unsupported.close()
  })
  await check('reduced-motion preference keeps people visible but stationary', async () => {
    const quietPage = await context.newPage()
    await quietPage.emulateMedia({ reducedMotion: 'reduce' })
    await quietPage.goto(baseURL, { waitUntil: 'networkidle' })
    await quietPage.locator('.campus-canvas[data-status="ready"]').waitFor({ timeout: 15000 })
    const host = quietPage.locator('.campus-canvas')
    assert.equal(await host.getAttribute('data-people-count'), '24')
    assert.equal(await host.getAttribute('data-people-state'), 'paused')
    const before = await host.getAttribute('data-first-person-position')
    await quietPage.waitForTimeout(650)
    assert.equal(await host.getAttribute('data-first-person-position'), before)
    await quietPage.close()
  })
  assert.deepEqual(errors, [], 'browser has unhandled exceptions')
  await writeFile(new URL('browser-results.json', results), JSON.stringify({ checkedAt: new Date().toISOString(), url: baseURL, checks, errors }, null, 2))
  console.log(`Browser checks passed: ${checks.length}`)
} catch (error) {
  await page.screenshot({ path: new URL('failure.png', results).pathname.replace(/^\/(?=[A-Za-z]:)/, ''), fullPage: true }).catch(() => {})
  throw error
} finally {
  await context.close().catch(() => {})
  await browser.close().catch(() => {})
}
