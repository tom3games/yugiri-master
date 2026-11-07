// 台本のボットで結果の分布を測る。node sim.mjs（N=回数）
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '0' } })
const PORT = await new Promise(r => server.stdout.on('data', d => { const m = String(d).match(/:(\d+)/); if (m) r(m[1]) }))
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' })
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ymReady)
const N = Number(process.env.N || 30)
const out = await p.evaluate(N => {
  ym.dbg.pause(true); ym.dbg.quiet(true); const res = {}
  for (const bot of ['good', 'normal', 'sloppy', 'idle']) {
    const R = res[bot] = { tot: [], ranks: {}, served: 0, splash: 0, fails: 0, Y: 0, tenku: 0 }
    for (let s = 1; s <= N; s++) {
      ym.dbg.autoplay(bot); ym.startGame(s * 7919); let k = 0
      while (ym.S.view !== 'result' && k < 60 * 120) { ym.dbg.step(1); k++ }
      const r = ym.S.result; R.tot.push(r.total); R.ranks[r.rank.ja] = (R.ranks[r.rank.ja] || 0) + 1
      R.served += r.served / N; R.splash += r.splash / N; R.fails += r.bowls.filter(x => x.fail).length / N; R.Y += r.avgY / N; R.tenku += r.tenku / N
    }
    ym.dbg.autoplay(null)
  }
  return res
}, N)
for (const [k, v] of Object.entries(out)) {
  const a = v.tot, m = a.reduce((x, y) => x + y, 0) / a.length
  console.log(k.padEnd(7), 'mean', m.toFixed(0), 'min', Math.min(...a), 'max', Math.max(...a), 'served', v.served.toFixed(1), 'splash', v.splash.toFixed(1), 'fails', v.fails.toFixed(1), 'Y', v.Y.toFixed(0), 'tenku', v.tenku.toFixed(1), JSON.stringify(v.ranks))
}
console.log('errors', errs.length ? errs.slice(0, 5) : 'none')
await b.close(); server.kill()
