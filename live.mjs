// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium, webkit } from 'playwright'
const URL0 = 'https://tom3games.github.io/yugiri-master/'
const ID = ['tmk', '4men'].join('')   // 公開物に出てはいけない個人のID（ファイルに直接書かない）
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts }), p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errs.push('fail ' + r.url()) })
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__ymReady, null, { timeout: 15000 })
  // 遊びの通し（タイトル → 遊ぶ → 結果）
  await (opts.hasTouch ? p.tap('#bStart') : p.click('#bStart'))
  const r = await p.evaluate(() => { ym.dbg.pause(true); ym.dbg.quiet(true); ym.dbg.autoplay('good'); let k = 0; while (ym.S.view !== 'result' && k++ < 60 * 120) ym.dbg.step(1); ym.dbg.step(60 * 5); return { view: ym.S.view, rank: ym.S.result && ym.S.result.rank.ja, served: ym.S.result && ym.S.result.served } })
  await p.waitForTimeout(500)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: play=${JSON.stringify(r)} og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(), p = await b.newPage()
for (const u of ['https://github.com/tom3games/yugiri-master', 'https://github.com/tom3games/yugiri-master/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} personal-id=${new RegExp(ID, 'i').test(await p.content()) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
