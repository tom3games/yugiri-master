// 全項目の自動検証。node verify.mjs（shots/ にスクショを出す）
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
// 空いているポートを自動で取る（並行して他のゲームも検証するため）
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '0' } })
const PORT = await new Promise(r => server.stdout.on('data', d => { const m = String(d).match(/:(\d+)/); if (m) r(m[1]) }))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)) }
async function open(browser, opts = {}, tutDone = true) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, acceptDownloads: true, ...opts })
  await ctx.addInitScript(k => { try { localStorage.clear(); if (k) localStorage.setItem('ym.tut', '1') } catch (e) {} }, tutDone)
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__ymReady, null, { timeout: 15000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
// 一画面に収まる（縦スクロールなし・部品が画面内・右上の小ボタンと重ならない・部品同士が重ならない）
const fit = q => q.evaluate(() => {
  const H = innerHeight, W = innerWidth, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  const vis = el => el.offsetParent && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden'
  const sel = 'main:not([hidden]) button,main:not([hidden]) .order,main:not([hidden]) .st,main:not([hidden]) .rank,main:not([hidden]) .panel,main:not([hidden]) .noren,main:not([hidden]) .bubble,main:not([hidden]) .meter,main:not([hidden]) .gauge,main:not([hidden]) .tut,main:not([hidden]) .vc,main:not([hidden]) .chip,#corner button'
  const els = [...document.querySelectorAll(sel)].filter(vis)
  for (const el of els) { const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  const cr = document.querySelector('#corner').getBoundingClientRect()
  for (const el of els) { if (el.closest('#corner')) continue; const r = el.getBoundingClientRect(); if (r.left < cr.right && r.right > cr.left && r.top < cr.bottom && r.bottom > cr.top) over.push('corner-overlap:' + (el.id || el.className)) }
  // プレイ中の部品同士（ボタン・メーター・ゲージ・チュートリアル・吹き出し）
  const play = ['#bAct', '#meter', '#gauge', '#tut', '#order', '.hud'].map(s => document.querySelector(s)).filter(e => e && vis(e) && !e.closest('main[hidden]'))
  for (let i = 0; i < play.length; i++) for (let j = i + 1; j < play.length; j++) { const a = play[i].getBoundingClientRect(), b = play[j].getBoundingClientRect(); if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) over.push('overlap:' + play[i].id + '/' + (play[j].id || play[j].className)) }
  return { H, over: over.slice(0, 6) }
})
const variance3d = p => p.evaluate(() => {
  ym.dbg.render(); const src = document.querySelector('#world'), c = document.createElement('canvas'); c.width = 200; c.height = Math.round(200 * src.height / src.width)
  const x = c.getContext('2d'); x.drawImage(src, 0, 0, c.width, c.height); const d = x.getImageData(0, 0, c.width, c.height).data
  let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 3) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
})
// Xでポスト: 押すと新しいタブで x.com/intent/post が開く（x.com は偽の応答で受ける）
async function xPost(pg) {
  await pg.context().route('https://x.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>x</title>ok' }))
  const b = await pg.evaluate(() => { const el = document.querySelector('#bX'), r = el.getBoundingClientRect(); return { vis: !!el.offsetParent && getComputedStyle(el.closest('.rBtns') || el).visibility !== 'hidden' && r.width > 60 && r.height >= 38, clip: el.scrollWidth > el.clientWidth + 1, label: el.innerText.trim() } })
  const [pop] = await Promise.all([pg.waitForEvent('popup', { timeout: 6000 }), pg.click('#bX')])
  await pop.waitForLoadState().catch(() => {}); const url = pop.url(); await pop.close()
  const u = new URL(url), api = await pg.evaluate(() => ({ text: ym.xText(), url: ym.GAME_URL }))
  return { b, url, text: u.searchParams.get('text'), link: u.searchParams.get('url'), api }
}
const clipped = q => q.evaluate(() => [...document.querySelectorAll('main:not([hidden]) button')].filter(b => b.offsetParent && b.scrollWidth > b.clientWidth + 1).map(b => b.id))
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [844, 390, 'land'], [667, 375, 'land-se'], [768, 1024, 'tab'], [1440, 900, 'pc']]
const toPhase = (p, ph) => p.evaluate(ph => { ym.dbg.pause(true); return ym.dbg.toPhase(ph) }, ph)
// 本物のマウスで上下に振る（実時間で動かす。dy は画面の高さに対する割合）
async function flick(p, up, down, msUp = 120, msDown = 100) {
  const { W, H } = await p.evaluate(() => ({ W: innerWidth, H: Math.min(innerHeight, 900) })), x = W * 0.5, y0 = await p.evaluate(() => innerHeight * 0.62)
  await p.mouse.move(x, y0); await p.mouse.down()
  // headless は1回の move に 30ms ほどかかるので、経過時間から位置を決めて実際の速さを合わせる
  const seg = async (from, to, ms) => { const t0 = Date.now(); for (;;) { const k = Math.min(1, (Date.now() - t0) / ms); await p.mouse.move(x, from + (to - from) * k); if (k >= 1) break } }
  await seg(y0, y0 - up * H, msUp); await seg(y0 - up * H, y0 - up * H + down * H, msDown)
  await p.waitForTimeout(40); await p.mouse.move(x, y0 - up * H + down * H + 1); await p.mouse.up()
}
const lastSwing = p => p.evaluate(() => ({ s: ym.S.lastS == null ? null : +ym.S.lastS.toFixed(2), sw: ym.S.b.swings, W: Math.round(ym.S.b.W), splash: ym.S.b.splash, tenku: ym.S.b.tenku, ph: ym.S.ph }))

const browser = await chromium.launch()
const p = await open(browser, {}, false)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r)); return r
})
await t('OGP 一式がある（og:image は ?v= 付きの公開URL）', async () => {
  const r = await p.evaluate(() => ({ has: ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(document.querySelector('meta[name="twitter:card"]')?.content === 'summary_large_image'), img: document.querySelector('meta[property="og:image"]').content, url: document.querySelector('meta[property="og:url"]').content }))
  expect(r.has.every(Boolean) && r.img === 'https://tom3games.github.io/yugiri-master/og.png?v=1' && r.url === 'https://tom3games.github.io/yugiri-master/', JSON.stringify(r))
})
await t('og.png が 1200x630', async () => { const r = await p.evaluate(async () => { const im = new Image(); im.src = 'og.png'; await im.decode(); return [im.naturalWidth, im.naturalHeight] }); expect(r[0] === 1200 && r[1] === 630, r); return r })
await t('タイトルの3D（ラーメン屋）が描けている', async () => { await p.waitForTimeout(1500); const v = await variance3d(p); expect(v > 300, v); return v })
await t('タイトルの裏で店主が湯切りしている（デモ）', async () => { await p.waitForTimeout(6000); const r = await p.evaluate(() => ({ mode: ym.S.mode, bi: ym.S.bi, ph: ym.S.ph })); expect(r.mode === 'demo' && (r.bi > 0 || ['shake', 'serve', 'react', 'leave', 'lift'].includes(r.ph)), JSON.stringify(r)); return r })
await p.screenshot({ path: `${ROOT}/shots/01-title.png` })
await t('遊び方: PC はキーとマウスの説明', async () => { await p.click('#bHow'); const s = await p.textContent('#vHow'); await p.screenshot({ path: `${ROOT}/shots/02-how-pc.png` }); expect(/↑/.test(s) && /ドラッグ/.test(s) && /天空落とし/.test(s), s); await p.click('#bHowBack') })
await t('初回はチュートリアルが出る（茹で→振る→盛る）', async () => {
  await p.click('#bStart'); await toPhase(p, 'boil')
  const a = await p.evaluate(() => !document.querySelector('#tut').hidden && document.querySelector('#tutTxt').textContent)
  await p.evaluate(() => ym.dbg.step(40)); await p.screenshot({ path: `${ROOT}/shots/03-tut-boil.png` })
  await p.keyboard.down('ArrowUp'); await p.keyboard.up('ArrowUp'); await p.evaluate(() => ym.dbg.toPhase('shake'))
  const b = await p.evaluate(() => document.querySelector('#tutTxt').textContent)
  expect(/↑/.test(a) && /振り上げ/.test(b), JSON.stringify({ a, b })); return { a, b }
})
await p.close()

// ---- 本物の入力で通す（マウス・キー）
const q = await open(browser)
await t('茹で: 注文の線で ↑キー → 麺が上がる（硬さの誤差が小さい）', async () => {
  await q.click('#bStart'); await toPhase(q, 'boil')
  const tgt = await q.evaluate(() => ym.S.b.target); await q.evaluate(t => { while (ym.S.b.d < t - 0.02) ym.dbg.step(1) }, tgt)
  await q.screenshot({ path: `${ROOT}/shots/04-boil.png` })
  await q.keyboard.down('ArrowUp'); await q.keyboard.up('ArrowUp'); await q.evaluate(() => ym.dbg.step(1))
  const r = await q.evaluate(() => ({ ph: ym.S.ph, d: ym.S.b.dLift, t: ym.S.b.target })); expect(r.ph === 'lift' && Math.abs(r.d - r.t) < 0.1, JSON.stringify(r)); return r
})
await t('キー: ↑を長押しした長さで強さが変わる（短い=いい／長い=強い）', async () => {
  await q.evaluate(() => ym.dbg.toPhase('shake'))
  const out = []
  for (const frames of [12, 22]) {
    await q.keyboard.down('ArrowUp'); await q.evaluate(f => ym.dbg.step(f), frames); await q.keyboard.up('ArrowUp'); await q.keyboard.down('ArrowDown'); await q.keyboard.up('ArrowDown'); await q.evaluate(() => ym.dbg.step(14))
    out.push(await lastSwing(q))
  }
  expect(out[0].s > 0.32 && out[0].s < 0.8 && out[1].s > out[0].s && out[1].sw === 2 && out[1].W < 85, JSON.stringify(out)); return out
})
await t('キー: 大きく振り上げて止めてから落とすと「天空落とし」（拍手・湯が一気に切れる）', async () => {
  const before = await lastSwing(q)
  await q.keyboard.down('ArrowUp'); await q.evaluate(() => ym.dbg.step(39)); await q.keyboard.up('ArrowUp'); await q.keyboard.down('ArrowDown'); await q.keyboard.up('ArrowDown'); await q.evaluate(() => { ym.dbg.step(3); ym.dbg.render() })
  await q.screenshot({ path: `${ROOT}/shots/05-tenku.png` })
  const r = await lastSwing(q), ban = await q.evaluate(() => document.querySelector('#banner').textContent), clap = await q.evaluate(() => ym.custs[ym.S.b.cust].clapT > 0)
  expect(r.tenku === 1 && r.W < before.W * 0.6 && /天空落とし/.test(ban) && clap, JSON.stringify({ before, r, ban, clap })); return { s: r.s, W: [before.W, r.W] }
})
await t('マウス: ゆっくり大きく振ると「いい」、いいリズムで振ると湯が切れていく', async () => {
  const rs = []; await q.evaluate(() => ym.dbg.step(20))
  for (let i = 0; i < 3; i++) { await flick(q, 0.08, 0.2, 110, 140); await q.evaluate(() => ym.dbg.step(26)); rs.push(await lastSwing(q)) }
  await q.evaluate(() => ym.dbg.render()); await q.screenshot({ path: `${ROOT}/shots/06-shake-mouse.png` })
  expect(rs.every(r => r.s >= 0.32 && r.s < 1.04) && rs[2].sw >= 6 && rs[2].splash === 0, JSON.stringify(rs)); return rs.map(r => r.s + ':' + r.W)
})
await t('盛るボタンで出す → 丼がカウンターへ → 客の感想', async () => {
  await q.evaluate(() => { while (ym.S.b.W > 14) { ym.dbg.push({ type: 'swing', s: 0.7, wind: 0 }); ym.dbg.step(27) } })
  await q.click('#bAct'); await q.evaluate(() => ym.dbg.step(1))
  await q.evaluate(() => ym.dbg.toPhase('react')); await q.evaluate(() => { ym.dbg.step(20); ym.dbg.render() }); await q.screenshot({ path: `${ROOT}/shots/07-react-good.png` })
  const r = await q.evaluate(() => ({ res: ym.S.results[0], order: document.querySelector('#order').textContent, n: document.querySelector('#nBowls').textContent }))
  expect(r.res && !r.res.fail && r.res.score >= 80 && r.res.tenku === 1 && r.order.length > 3 && r.n === '1', JSON.stringify(r)); return { score: r.res.score, Y: r.res.Y, line: r.order }
})
// 実時間のマウスは headless だと速さがぶれる。狙いの結果になるまで強さを変えて振り直す（失敗したら次の杯で続ける）
async function mouseUntil(cands, ok) {
  let r, tries = 0
  for (const [d, ms] of cands) {
    await q.evaluate(() => { if (ym.S.ph !== 'shake') ym.dbg.toPhase('shake'); ym.dbg.step(10) })
    await flick(q, 0.05, d, 70, ms); await q.evaluate(() => ym.dbg.step(2)); tries++
    r = await q.evaluate(() => ({ ...{ s: +ym.S.lastS.toFixed(2), splash: ym.S.b.splash, fail: ym.S.b.fail, ph: ym.S.ph }, mood: ym.custs[ym.S.b.cust].mood, hat: ym.custs[ym.S.b.cust].hat.visible }))
    if (ok(r)) break
  }
  return { ...r, tries }
}
await t('マウス: 気合を入れすぎるとお湯が客に飛ぶ（あっつ!!・顔が真っ赤）', async () => {
  const r = await mouseUntil([[0.3, 100], [0.32, 100], [0.3, 110], [0.28, 100], [0.34, 120], [0.3, 120], [0.26, 90], [0.32, 110]], r => r.splash > 0)
  await q.evaluate(() => ym.dbg.render()); await q.screenshot({ path: `${ROOT}/shots/08-splash.png` })
  expect(r.splash >= 1 && r.mood === 'hot', JSON.stringify(r)); return r
})
await t('マウス: 思い切り振るとてぼが飛んでいき、客の頭にかぶさる', async () => {
  const r = await mouseUntil([[0.6, 50], [0.7, 40], [0.75, 30], [0.8, 20], [0.8, 10]], r => r.fail === 'fly')
  await q.evaluate(() => { ym.dbg.step(40); ym.dbg.render() }); await q.screenshot({ path: `${ROOT}/shots/09-tebo-fly.png` })
  const hat = await q.evaluate(() => ym.custs[ym.S.b.cust].hat.visible)
  expect(r.fail === 'fly' && hat, JSON.stringify({ r, hat })); return r
})
await t('強すぎ（中くらいの暴れ）だと麺が天井に張り付き、天井に残る', async () => {
  const r = await q.evaluate(() => { ym.dbg.toPhase('shake'); ym.dbg.push({ type: 'swing', s: 1.3, wind: 0.2 }); ym.dbg.step(40); ym.dbg.render(); return { fail: ym.S.b.fail, stuck: ym.stuckN(), tilt: ym.S.vis.camTilt > 0 } })
  await q.screenshot({ path: `${ROOT}/shots/10-ceiling.png` })
  await q.evaluate(() => { ym.dbg.step(60); ym.dbg.render() }); await q.screenshot({ path: `${ROOT}/shots/10b-ceiling-after.png` })
  expect(r.fail === 'ceil' && r.stuck >= 1, JSON.stringify(r)); return r
})
await t('時間切れで閉店 → 結果発表。称号は発表まで見せない', async () => {
  await q.evaluate(() => { ym.S.left = 0.5; let k = 0; while (ym.S.view !== 'result' && k++ < 60 * 20) ym.dbg.step(1) })
  const before = await q.evaluate(() => ({ v: ym.S.view, rank: document.querySelector('#rank').classList.contains('on'), btn: getComputedStyle(document.querySelector('.rBtns')).visibility }))
  await q.evaluate(() => { ym.dbg.step(60 * 1.2); ym.dbg.render() }); await q.screenshot({ path: `${ROOT}/shots/11-result-reveal.png` })
  await q.evaluate(() => ym.dbg.step(60 * 4)); await q.waitForTimeout(600)
  const after = await q.evaluate(() => ({ rank: document.querySelector('#rank').classList.contains('on'), n: document.querySelector('#rankN').textContent, st: document.querySelectorAll('#stats .st.on').length, btn: getComputedStyle(document.querySelector('.rBtns')).visibility, voices: document.querySelectorAll('#voices .vc.on').length }))
  await q.screenshot({ path: `${ROOT}/shots/12-result.png` })
  expect(before.v === 'result' && !before.rank && before.btn === 'hidden' && after.rank && after.st === 5 && after.btn === 'visible' && after.n && after.voices >= 2, JSON.stringify({ before, after })); return after.n
})
await t('結果画像（1080x1350）を保存できる', async () => {
  const dl = q.waitForEvent('download'); await q.click('#bSave'); const d = await dl
  const path = `${ROOT}/shots/card.png`; await d.saveAs(path); const size = statSync(path).size
  const dim = await q.evaluate(async () => { const c = await ym.drawCard(); return [c.width, c.height] })
  expect(d.suggestedFilename() === 'yugiri-master.png' && size > 150000 && dim[0] === 1080 && dim[1] === 1350, JSON.stringify({ f: d.suggestedFilename(), size, dim })); return { size }
})
await t('Xでポスト: ボタンが見えて、押すと x.com/intent/post が開く（text に称号とハッシュタグ、url に公開URL）', async () => {
  const r = await xPost(q), rank = await q.evaluate(() => document.querySelector('#rankN').textContent)
  expect(r.b.vis && !r.b.clip && r.b.label === 'Xでポスト' && r.url.startsWith('https://x.com/intent/post?') && r.text.includes('「' + rank + '」') && r.text.includes('#湯切り職人') && /\d+杯/.test(r.text) && !r.text.includes('tom3games') && r.link === 'https://tom3games.github.io/yugiri-master/' && r.text === r.api.text && r.link === r.api.url, r); return r.text
})
await t('もう一回ですぐ遊べる（天井の麺も片付く）', async () => { await q.click('#bAgain'); const r = await q.evaluate(() => ({ v: ym.S.view, ph: ym.S.ph, res: ym.S.results.length, left: ym.S.left, stuck: ym.stuckN() })); expect(r.v === 'play' && r.res === 0 && r.left === 60 && r.stuck === 0, JSON.stringify(r)); return r })
await t('通しでエラーなし', async () => { expect(q.errs.length === 0, q.errs.join('|')) })
await q.close()

// ---- 採点・境界・再現性
const s = await open(browser)
const runBot = (bot, seed, opt = {}) => s.evaluate(([bot, seed, opt]) => { ym.dbg.pause(true); ym.dbg.quiet(true); ym.dbg.autoplay(bot); ym.startGame(seed, opt); let k = 0; while (ym.S.view !== 'result' && k++ < 60 * 120) ym.dbg.step(1); ym.dbg.autoplay(null); const r = ym.S.result; return { total: r.total, rank: r.rank.ja, served: r.served, splash: r.splash, tv: r.tv, scores: r.bowls.map(b => b.score), secs: Math.round(k / 6) / 10 } }, [bot, seed, opt])
await t('同じ種と同じ手なら同じ結果（採点の再現性）', async () => { const a = await runBot('normal', 4242), b = await runBot('normal', 4242); expect(JSON.stringify(a) === JSON.stringify(b) && a.scores.length >= 3, JSON.stringify([a, b])); return a })
const dist = {}
await t('台本ボットの分布（上手い＞ふつう＞雑＞何もしない。最高位は上手い人でもたまに）', async () => {
  for (const bot of ['good', 'normal', 'sloppy', 'idle']) { dist[bot] = []; for (let i = 1; i <= 16; i++) dist[bot].push(await runBot(bot, i * 7919)) }
  const m = b => Math.round(dist[b].reduce((a, r) => a + r.total, 0) / dist[b].length)
  const cnt = (b, name) => dist[b].filter(r => r.rank === name).length
  const out = { good: m('good'), normal: m('normal'), sloppy: m('sloppy'), idle: m('idle'), goodTop: cnt('good', '湯切りの鬼'), normalTop: cnt('normal', '湯切りの鬼') + cnt('normal', '湯切り名人'), normalMid: cnt('normal', '一人前の大将') + cnt('normal', '見習い'), sloppyLow: cnt('sloppy', '店がびしょびしょ') + cnt('sloppy', '水っぽい店') + cnt('sloppy', 'まだ茹でてる'), idleRank: [...new Set(dist.idle.map(r => r.rank))] }
  expect(out.good > out.normal && out.normal > out.sloppy && out.sloppy >= out.idle && out.goodTop >= 1 && out.goodTop <= 12 && out.normalTop <= 3 && out.normalMid >= 10 && out.sloppyLow >= 13 && out.idleRank.join() === 'まだ茹でてる', JSON.stringify(out)); return out
})
await t('1回は60秒（台本ボット・何もしない時も）', async () => { const g = dist.good.map(r => r.secs), i = dist.idle.map(r => r.secs); expect(Math.max(...g) <= 66 && Math.min(...g) >= 60 && Math.max(...i) <= 66, JSON.stringify({ g, i })); return { good: g[0], idle: i[0] } })
await t('何もしないと客が帰る（茹ですぎ）', async () => { const r = await s.evaluate(() => { ym.dbg.quiet(true); ym.dbg.autoplay(null); ym.startGame(5); ym.dbg.toPhase('boil'); ym.dbg.step(60 * 8.2); return ym.S.results[0] && { fail: ym.S.results[0].fail, line: ym.S.results[0].line } }); expect(r && r.fail === 'leave', JSON.stringify(r)); return r })
const scen = fn => s.evaluate(fn)
await t('弱く振るだけだと湯が切れず「水っぽい」感想', async () => {
  const r = await scen(() => { ym.dbg.quiet(true); ym.startGame(31); ym.dbg.toPhase('shake'); for (let i = 0; i < 8; i++) { ym.dbg.push({ type: 'swing', s: 0.2, wind: 0 }); ym.dbg.step(27) } ym.dbg.push({ type: 'serve' }); ym.dbg.step(2); const x = ym.S.results[0]; return { Y: x.Y, kind: x.kind, score: x.score, line: x.line } })
  expect(r.Y < 30 && r.kind === 'wet' && r.score < 40, JSON.stringify(r)); return r
})
await t('ガチャガチャ速すぎるリズムは湯があまり切れない', async () => {
  const r = await scen(() => { const run = gap => { ym.dbg.quiet(true); ym.startGame(32); ym.dbg.toPhase('shake'); for (let i = 0; i < 8; i++) { ym.dbg.push({ type: 'swing', s: 0.7, wind: 0 }); ym.dbg.step(gap) } return Math.round(100 - ym.S.b.W) }; return { fast: run(9), good: run(27) } })
  expect(r.fast < r.good - 20, JSON.stringify(r)); return r
})
await t('強さの境目（いい／かかる／天井／てぼが飛ぶ）', async () => {
  const r = await scen(() => { const one = (s, wind = 0) => { ym.dbg.quiet(true); ym.startGame(33); ym.dbg.toPhase('shake'); ym.dbg.push({ type: 'swing', s, wind }); ym.dbg.step(1); return ym.S.b.fail || (ym.S.b.splash ? 'splash' + ym.S.b.splash : ym.S.b.tenku ? 'tenku' : 'ok') }
    return [one(1.03), one(1.05), one(1.15), one(1.25), one(1.5), one(0.95, 1), one(0.95, 0.5), one(1.05, 1)] })
  expect(r.join() === 'ok,splash1,splash2,ceil,fly,tenku,ok,splash1', JSON.stringify(r)); return r
})
await t('注文の硬さ: 早すぎ=硬い・遅すぎ=のびのびの感想', async () => {
  const r = await scen(() => { const one = dd => { ym.dbg.quiet(true); ym.startGame(34); ym.dbg.toPhase('boil'); const t = ym.S.b.target; while (ym.S.b.d < t + dd) ym.dbg.step(1); ym.dbg.push({ type: 'lift' }); ym.dbg.toPhase('shake'); for (let i = 0; i < 14; i++) { ym.dbg.push({ type: 'swing', s: 0.75, wind: 0 }); ym.dbg.step(27) } ym.dbg.push({ type: 'serve' }); ym.dbg.step(2); return ym.S.results[0].kind + ':' + ym.S.results[0].score }
    return [one(-1.3), one(0), one(1.5)] })
  expect(/^hard/.test(r[0]) && /^perfect/.test(r[1]) && /^soft/.test(r[2]), JSON.stringify(r)); return r
})
await t('テレビ取材の回: 見せ場で天空落とし → 全国で拍手（ボーナス）', async () => {
  const r = await scen(() => { ym.dbg.quiet(true); ym.dbg.autoplay(null); ym.startGame(35, { tv: true }); let k = 0
    while (k++ < 60 * 60 && !(ym.S.b && ym.S.b.tv && ym.S.ph === 'shake')) { if (ym.S.ph === 'boil' && ym.S.b.d >= ym.S.b.target) ym.dbg.push({ type: 'lift' }); if (ym.S.ph === 'shake') { ym.dbg.push({ type: 'swing', s: 0.75, wind: 0 }); ym.dbg.step(26); if (ym.S.b.W < 15) ym.dbg.push({ type: 'serve' }) } ym.dbg.step(1) }
    const crew = document.querySelector('#tvf').hidden === false, cust = ym.S.b.cust
    ym.dbg.push({ type: 'swing', s: 0.96, wind: 1 }); ym.dbg.step(27); while (ym.S.b.W > 12) { ym.dbg.push({ type: 'swing', s: 0.7, wind: 0 }); ym.dbg.step(27) } ym.dbg.push({ type: 'serve' }); ym.dbg.toPhase('react'); ym.dbg.step(2)
    return { crew, cust, tv: ym.S.tvRes, banner: document.querySelector('#banner').textContent } })
  expect(r.crew && r.cust === 'ana' && r.tv === 'ok' && /拍手/.test(r.banner), JSON.stringify(r)); return r
})
await t('テレビ取材の回: 見せ場で客にかける → 放送事故（結果に見出し）', async () => {
  const r = await scen(() => { ym.dbg.quiet(true); ym.startGame(36, { tv: true }); ym.S.bi = ym.S.tvBowl - 1; ym.S.ph = 'leave'; ym.S.pt = 9; ym.dbg.step(1); ym.dbg.toPhase('shake')
    ym.dbg.push({ type: 'swing', s: 1.08, wind: 0 }); ym.dbg.step(2); const tv = ym.S.b.tv; ym.S.left = 0.1; let k = 0; while (ym.S.view !== 'result' && k++ < 60 * 10) ym.dbg.step(1); ym.dbg.step(60 * 5)
    return { tv, res: ym.S.result.tv, head: document.querySelector('#tvHeadTxt').textContent, shown: !document.querySelector('#tvHead').hidden } })
  await s.waitForTimeout(500); await s.screenshot({ path: `${ROOT}/shots/13-result-tv-ng.png` })
  expect(r.tv && r.res === 'ng' && r.shown && /熱湯/.test(r.head), JSON.stringify(r)); return r
})
await t('客に6回以上かけると称号は「店がびしょびしょ」', async () => {
  const r = await scen(() => { ym.dbg.quiet(true); ym.startGame(37, { tv: false }); ym.dbg.toPhase('shake'); for (let i = 0; i < 3; i++) { ym.dbg.push({ type: 'swing', s: 1.15, wind: 0 }); ym.dbg.step(27) } ym.S.left = 0.05; let k = 0; while (ym.S.view !== 'result' && k++ < 60 * 10) ym.dbg.step(1); return { splash: ym.S.result.splash, rank: ym.S.result.rank.ja } })
  expect(r.splash >= 6 && r.rank === '店がびしょびしょ', JSON.stringify(r)); return r
})
await t('採点・境界でエラーなし', async () => { expect(s.errs.length === 0, s.errs.join('|')) })
await s.close()

// ---- 音
const a = await open(browser)
await t('音: BGM・湯切り・しぶき・声・拍手が鳴り、エラーなし', async () => {
  await a.click('#bStart')
  await a.evaluate(() => { ym.dbg.pause(true); ym.dbg.toPhase('shake'); for (const s of [0.6, 0.96, 1.08]) { ym.dbg.push({ type: 'swing', s, wind: s > 0.9 && s < 1 ? 1 : 0 }); ym.dbg.step(27) } ym.dbg.pause(false) })
  await a.waitForTimeout(1500)
  const r = await a.evaluate(() => ({ played: ym.Snd.played, st: ym.Snd.ctx && ym.Snd.ctx.state, lvl: ym.Snd.level() }))
  await a.evaluate(() => { for (const n of ['lift', 'serve', 'ceil', 'fly', 'clonk', 'tv', 'tvng', 'shutter', 'cheer', 'boo']) ym.Snd.sfx(n); ym.Snd.voice(1, 'hot') })
  const keys = Object.keys(r.played)
  expect(r.st === 'running' && ['bgm:play', 'swish', 'splash', 'tenku', 'applause', 'voice:hot'].every(k => keys.includes(k)) && a.errs.length === 0, JSON.stringify(r) + a.errs.join('|')); return { keys: keys.length }
})
await t('ミュートで音量が0', async () => { await a.click('#bMute'); const m = await a.evaluate(() => ym.Snd.master.gain.value); await a.click('#bMute'); expect(m === 0, m) })
await a.close()

// ---- 英語
const e = await open(browser)
await t('英語表示（タイトル・遊び方・プレイ・結果に日本語が残らない）', async () => {
  await e.click('#bLang'); const jp = /[぀-ヿ一-鿿]/
  const tt = await e.evaluate(() => document.querySelector('#vTitle').innerText); await e.screenshot({ path: `${ROOT}/shots/en-title.png` })
  await e.click('#bHow'); const ht = await e.evaluate(() => document.querySelector('#vHow').innerText); await e.screenshot({ path: `${ROOT}/shots/en-how.png` })
  await e.click('#bHowStart'); await toPhase(e, 'shake'); await e.evaluate(() => { ym.dbg.push({ type: 'swing', s: 0.7, wind: 0 }); ym.dbg.step(10); ym.dbg.render() }); const pt = await e.evaluate(() => document.querySelector('#vPlay').innerText); await e.screenshot({ path: `${ROOT}/shots/en-play.png` })
  await e.evaluate(() => { ym.dbg.autoplay('normal'); ym.dbg.quiet(true); ym.startGame(77, { tv: true }); let k = 0; while (ym.S.view !== 'result' && k++ < 60 * 120) ym.dbg.step(1); ym.dbg.step(60 * 5); ym.dbg.quiet(false) }); await e.waitForTimeout(600)
  const rt = await e.evaluate(() => document.querySelector('#vResult').innerText); await e.screenshot({ path: `${ROOT}/shots/en-result.png` })
  const card = await e.evaluate(async () => { const c = await ym.drawCard(); return c.width })
  const x = await xPost(e), rank = await e.evaluate(() => document.querySelector('#rankN').textContent)
  expect(x.b.vis && !x.b.clip && x.b.label === 'Post on X' && x.url.startsWith('https://x.com/intent/post?') && x.text.includes(rank) && x.text.includes('#NoodleFlickMaster') && !jp.test(x.text) && x.link === 'https://tom3games.github.io/yugiri-master/', x)
  const bad = [tt, ht, pt, rt].filter(x => jp.test(x)).map(x => x.match(/.{0,8}[぀-ヿ一-鿿].{0,8}/)[0])
  expect(!bad.length && card === 1080 && e.errs.length === 0, JSON.stringify(bad) + e.errs.join('|')); return rt.slice(0, 60).replace(/\n/g, ' / ')
})
await e.close()

// ---- 6サイズ × 全画面
for (const [w, h, name] of SIZES) {
  const v = await open(browser, { viewport: { width: w, height: h } }, false)
  const views = {}; await v.waitForTimeout(400)
  views.title = await fit(v); await v.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await v.click('#bHow'); views.how = await fit(v); await v.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` }); await v.click('#bHowBack')
  await v.click('#bStart'); await v.evaluate(() => ym.dbg.autoplay('normal'))
  await toPhase(v, 'boil'); await v.evaluate(() => { ym.dbg.step(40); ym.dbg.render() }); views.boil = await fit(v); await v.screenshot({ path: `${ROOT}/shots/fit-${name}-boil.png` })
  await toPhase(v, 'shake'); await v.evaluate(() => { ym.dbg.step(50); ym.dbg.render() }); views.shake = await fit(v); await v.screenshot({ path: `${ROOT}/shots/fit-${name}-shake.png` })
  await toPhase(v, 'react'); await v.evaluate(() => { ym.dbg.step(30); ym.dbg.render() }); views.react = await fit(v); await v.screenshot({ path: `${ROOT}/shots/fit-${name}-react.png` })
  await v.evaluate(() => { ym.dbg.quiet(true); let k = 0; while (ym.S.view !== 'result' && k++ < 60 * 120) ym.dbg.step(1); ym.dbg.step(60 * 5) }); await v.waitForTimeout(700)
  views.result = await fit(v); await v.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  for (const [vn, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${vn}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: 寸胴・お客さんが画面内（HUDに隠れない）`, async () => {
    const r = await v.evaluate(() => { ym.go('play'); ym.S.ph = 'shake'; ym.fitCamera(); ym.dbg.render(); const pot = ym.project(-0.35, 1.16, -0.45), head = ym.project(-0.35, 1.6, -1.85); ym.go('result'); return { pot, head, W: innerWidth, H: innerHeight } })
    const inside = o => o.x > 60 && o.x < r.W - 10 && o.y > 50 && o.y < r.H - 60
    expect(inside(r.pot) && inside(r.head), JSON.stringify(r)); return { pot: [Math.round(r.pot.x), Math.round(r.pot.y)], head: [Math.round(r.head.x), Math.round(r.head.y)] }
  })
  await t(`${name}: 結果のボタン（Xでポスト含む）の文字が切れない`, async () => { const c = await clipped(v), x = await v.evaluate(() => !!document.querySelector('#bX').offsetParent); expect(!c.length && x, c) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(v); expect(o.sw <= o.W && !o.bad.length && !v.errs.length, JSON.stringify(o) + v.errs.join('|')) })
  await v.close()
}
await browser.close()

// ---- fps（GPU を使う Chromium・390x844・プレイ中）
{
  const fb = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
  const fp = await open(fb)
  await t('fps: プレイ中に 50fps 以上（GPU あり Chromium）', async () => {
    const empty = await fp.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n) }; requestAnimationFrame(f) }))
    await fp.evaluate(() => ym.dbg.autoplay('normal')); await fp.click('#bStart'); await fp.waitForTimeout(4000)
    const fps = await fp.evaluate(() => Math.round(ym.dbg.fps()))
    expect(fps >= 50 || fps >= empty * 0.85, JSON.stringify({ fps, empty })); return { fps, emptyPage: empty }
  })
  await fb.close()
}

// ---- WebKit（iPhone 相当）でタッチの通し
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: 遊び方はスマホ向けの言い方（フリック）', async () => { await wp.tap('#bHow'); const s = await wp.textContent('#vHow'); await wp.tap('#bHowBack'); expect(/フリック/.test(s) && !/↑キー/.test(s), s) })
await t('WebKit: タップで開始 → 上フリックで麺を上げ → 上下フリックで湯切り → 盛る', async () => {
  await wp.tap('#bStart'); await toPhase(wp, 'boil'); await wp.evaluate(() => { while (ym.S.b.d < ym.S.b.target) ym.dbg.step(1) })
  const fl = (up, down, msU, msD) => wp.evaluate(async ([up, down, msU, msD]) => {
    const vp = document.querySelector('#vPlay'), H = Math.min(innerHeight, 900), x = innerWidth / 2, y0 = innerHeight * 0.6, wait = ms => new Promise(r => setTimeout(r, ms))
    const ev = (type, y) => vp.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true }))
    ev('pointerdown', y0); let y = y0
    for (let i = 1; i <= Math.round(msU / 16); i++) { y = y0 - up * H * i / Math.round(msU / 16); ev('pointermove', y); await wait(16) }
    const y1 = y; for (let i = 1; i <= Math.round(msD / 16); i++) { y = y1 + down * H * i / Math.round(msD / 16); ev('pointermove', y); await wait(16) }
    await wait(40); ev('pointerup', y)
  }, [up, down, msU, msD])
  await fl(0.15, 0, 120, 0); await wp.evaluate(() => ym.dbg.step(2)); const lifted = await wp.evaluate(() => ym.S.ph)
  await wp.evaluate(() => ym.dbg.toPhase('shake'))
  for (let i = 0; i < 4; i++) { await fl(0.08, 0.2, 100, 130); await wp.evaluate(() => ym.dbg.step(26)) }
  const sw = await wp.evaluate(() => ({ n: ym.S.b.swings, W: Math.round(ym.S.b.W), s: ym.S.lastS }))
  await wp.evaluate(() => { ym.dbg.render() }); await wp.screenshot({ path: `${ROOT}/shots/webkit-shake.png` })
  await wp.tap('#bAct'); await wp.evaluate(() => { ym.dbg.step(2) })
  const r = await wp.evaluate(() => ({ ph: ym.S.ph, res: ym.S.results.length }))
  expect(lifted === 'lift' && sw.n >= 3 && sw.W < 80 && r.ph === 'serve' && r.res === 1, JSON.stringify({ lifted, sw, r })); return { sw, r }
})
await t('WebKit: 3Dが描けている', async () => { const v = await variance3d(wp); expect(v > 200, v); return v })
await t('WebKit: 最後まで遊んで結果画像が作れる', async () => {
  const r = await wp.evaluate(async () => { ym.dbg.quiet(true); ym.dbg.autoplay('good'); let k = 0; while (ym.S.view !== 'result' && k++ < 60 * 120) ym.dbg.step(1); ym.dbg.step(60 * 5); const c = await ym.drawCard(); return { v: ym.S.view, w: c.width, rank: ym.S.result.rank.ja } })
  await wp.waitForTimeout(500); await wp.screenshot({ path: `${ROOT}/shots/webkit-result.png` })
  expect(r.v === 'result' && r.w === 1080, JSON.stringify(r)); return r
})
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
