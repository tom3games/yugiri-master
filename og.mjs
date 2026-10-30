// SNS用サムネ og.png（1200x630）。node og.mjs
// 遊んでいる一番おもしろい場面（気合を入れすぎて熱湯がお客さんの顔に）＋タイトル＋一言
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '0' } })
const PORT = await new Promise(r => server.stdout.on('data', d => { const m = String(d).match(/:(\d+)/); if (m) r(m[1]) }))
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, locale: 'ja-JP' })
await p.addInitScript(() => { try { localStorage.setItem('ym.tut', '1') } catch (e) {} })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ymReady)
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800)
await p.click('#bStart')
await p.evaluate(() => {
  ym.dbg.pause(true); ym.dbg.quiet(true); ym.startGame(3, { tv: false }); ym.S.list[0] = { cust: 'asei', order: 'kata' }; ym.S.bi = -1; ym.S.ph = 'open'; ym.S.pt = 9; ym.dbg.step(1)
  ym.dbg.toPhase('shake'); for (let i = 0; i < 3; i++) { ym.dbg.push({ type: 'swing', s: 0.8, wind: 0 }); ym.dbg.step(27) }
  ym.S.mode = 'demo'; ym.dbg.push({ type: 'swing', s: 1.15, wind: 0 }); ym.dbg.step(17)
  ym.dbg.cam([-1.05, 2.15, 1.05], [-0.15, 1.5, -1.25], 50); ym.dbg.render()
})
await p.addStyleTag({ content: `.hud,#corner,#bAct,#banner,.pop,#gauge,#meter,#tut,#order{display:none!important}#world{transform:translateX(-170px)}
  body::after{content:'';position:fixed;inset:0 0 0 54%;background:linear-gradient(90deg,rgba(29,19,16,0),rgba(29,19,16,.93) 18%);z-index:30}` })
await p.evaluate(() => {
  ym.dbg.render()
  const pos = ym.project(-0.35, 1.95, -1.85)
  const s = document.createElement('div'); s.style.cssText = `position:fixed;left:${pos.x - 170 - 90}px;top:${pos.y - 120}px;z-index:31;font-family:'Dela Gothic One';font-size:56px;color:#ff8a6a;-webkit-text-stroke:3px #26160e;text-shadow:0 5px 0 #26160e;transform:rotate(-8deg)`
  s.textContent = 'あっつ!!'; document.body.appendChild(s)
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;right:34px;top:0;bottom:0;width:470px;z-index:31;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:26px;text-align:center'
  d.innerHTML = `<div style="position:relative;display:flex;gap:8px;width:450px;filter:drop-shadow(0 12px 20px rgba(0,0,0,.5))">
    <div style="position:absolute;left:-12px;right:-12px;top:-10px;height:12px;border-radius:6px;background:linear-gradient(#8a5a2a,#5c3a18)"></div>
    <div style="flex:1;background:linear-gradient(#23305e,#121a3c);border-radius:0 0 10px 10px;padding:16px 8px 20px"><div style="font-family:'Zen Maru Gothic';font-weight:900;font-size:26px;letter-spacing:.2em;color:#fff4e0">ラーメン</div><div style="font-family:'Dela Gothic One';font-size:66px;line-height:1.15;white-space:nowrap;color:#f3bf3a">湯切り</div></div>
    <div style="flex:1;background:linear-gradient(#23305e,#121a3c);border-radius:0 0 10px 10px;padding:16px 8px 20px"><div style="font-size:26px">&nbsp;</div><div style="font-family:'Dela Gothic One';font-size:66px;line-height:1.15;white-space:nowrap;color:#fff">職人</div></div></div>
  <div style="font-family:'Zen Maru Gothic';font-weight:900;font-size:32px;line-height:1.5;color:#fff">気合を入れすぎると、<br><span style="color:#ff8a6a">お客さんにかかる。</span></div>`
  document.body.appendChild(d)
})
await p.waitForTimeout(400)
await p.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill()
console.log('ok')
