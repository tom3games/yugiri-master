// 湯切り職人 本体。3D は Three.js（vendor/）。文言とデータは data.js、音は snd.js
import * as THREE from './vendor/three.module.js'

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)]
const STEP = 1 / 60, GAME_T = 60
// 振りの強さの境目（s は 1.0 が「強い」の上限付近）
const S_WEAK = 0.32, S_STRONG = 0.8, S_SPLASH = 1.04, S_SPLASH2 = 1.12, S_CEIL = 1.22, S_FLY = 1.45
const TENKU_LO = 0.9, TENKU_HI = 1.02, TENKU_WIND = 0.8
const Y_READY = 88, BOIL_MAX = 7, BOIL_LEAVE = 8, SHAKE_LEAVE = 14
const PH = { open: 1.0, tvin: 1.8, arrive: 0.6, order: 0.55, lift: 0.3, serve: 0.75, fail: 1.6, react: 1.4, leave: 0.45, close: 1.6 }
const POT = new THREE.Vector3(-0.35, 0, -0.45), WATER_Y = 1.1, RIM_Y = 1.16
const SEAT = new THREE.Vector3(-0.35, 0, -1.85), SIDE_SEATS = [-1.5, 0.85], CEIL_Y = 3.6
const BOWL_PREP = new THREE.Vector3(0.55, 0.92, -0.55), BOWL_SERVE = new THREE.Vector3(-0.35, 1.16, -1.3)

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 } }
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const lerp = (a, b, k) => a + (b - a) * k
const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k])
const ease = k => 1 - Math.pow(1 - clamp(k), 3)
const gauss = (r, m, sd) => { let u = 0, v = 0; while (!u) u = r(); v = r(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }

const S = {
  lang: 'ja', view: 'title', mode: 'demo', t: 0, frame: 0, rnd: Math.random, botR: Math.random, seed: 1,
  ph: 'idle', pt: 0, left: GAME_T, list: [], bi: -1, b: null, results: [], result: null, closing: false,
  tv: false, tvBowl: 2, tvRes: null, inq: [], kw: { on: false, t: 0 }, bot: null, quiet: false, tut: false,
  rt: 0, stage: 0, bannerUntil: 0, demoN: 0, lastS: null, lastSAt: -9,
}
const T = k => TXT[S.lang][k]
const L = o => o[S.lang]
const isTouch = () => matchMedia('(pointer:coarse)').matches
const ON = (o, k) => o[k + (S.lang === 'ja' ? 'Ja' : 'En')]

// ---------- 顔（Canvas で描く。3D の顔の板と、画面の丸いアイコンの両方）
const OYA = { ja: '親方', en: 'Boss', skin: '#e0a878', hair: '#222', style: 'band', mustache: true, brows: true }
function circ(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2) }
function drawFace(x, id, mood, size, full) {
  const C = CUSTS[id] || OYA, k = size / 256
  x.save(); x.scale(k, k); x.lineCap = x.lineJoin = 'round'
  if (full) {
    x.fillStyle = id === 'oyakata' ? '#4a2c1a' : '#3a2418'; x.fillRect(0, 0, 256, 256)
    x.fillStyle = C.hair
    if (C.style === 'bob' || C.style === 'long') { circ(x, 128, 132, 110); x.fill(); if (C.style === 'long') x.fillRect(22, 130, 212, 126) }
    if (C.style === 'bun') { circ(x, 128, 40, 34); x.fill() }
    x.fillStyle = C.skin; circ(x, 128, 140, C.big ? 104 : 94); x.fill()
    x.fillStyle = C.hair
    if (C.style === 'side' || C.style === 'bob' || C.style === 'long' || C.style === 'buzz' || C.style === 'bun') {
      x.beginPath(); x.ellipse(128, 86, C.style === 'buzz' ? 92 : 100, C.style === 'buzz' ? 46 : 58, 0, Math.PI, 0); x.fill()
      if (C.style === 'side') { x.beginPath(); x.moveTo(40, 90); x.quadraticCurveTo(110, 40, 210, 80); x.lineTo(150, 100); x.fill() }
    }
    if (C.style === 'bald') { x.fillStyle = C.hair; x.beginPath(); x.ellipse(40, 130, 14, 34, 0.2, 0, 7); x.ellipse(216, 130, 14, 34, -0.2, 0, 7); x.fill() }
    if (C.style === 'band') {
      x.fillStyle = C.hair; x.beginPath(); x.ellipse(128, 84, 96, 50, 0, Math.PI, 0); x.fill()
      x.fillStyle = '#f6f2ea'; x.beginPath(); x.moveTo(30, 96); x.quadraticCurveTo(128, 60, 226, 96); x.lineTo(226, 122); x.quadraticCurveTo(128, 88, 30, 122); x.fill()
      x.strokeStyle = '#c8c0b0'; x.lineWidth = 3; x.beginPath(); x.moveTo(40, 108); x.quadraticCurveTo(128, 78, 216, 108); x.stroke()
    }
  }
  const ey = 128, ex = 36, my = 178, hot = mood === 'hot', sad = mood === 'sad', mad = mood === 'mad', wow = mood === 'wow', happy = mood === 'happy', shock = mood === 'shock'
  // ほっぺ
  x.fillStyle = hot ? 'rgba(235,40,30,.55)' : 'rgba(240,110,110,.35)'
  if (hot) { x.beginPath(); x.ellipse(128, 150, 92, 50, 0, 0, 7); x.fill() } else { circ(x, 128 - 58, 160, 16); x.fill(); circ(x, 128 + 58, 160, 16); x.fill() }
  x.strokeStyle = '#26160e'; x.fillStyle = '#26160e'; x.lineWidth = 7
  // 目
  for (const sgn of [-1, 1]) {
    const cx = 128 + sgn * ex
    if (happy) { x.beginPath(); x.arc(cx, ey + 6, 14, Math.PI * 1.1, Math.PI * 1.9); x.stroke() }
    else if (wow) { x.fillStyle = '#f3bf3a'; star(x, cx, ey, 17, 7); x.fill(); x.strokeStyle = '#26160e'; x.lineWidth = 3; x.stroke(); x.lineWidth = 7; x.fillStyle = '#26160e' }
    else if (hot) { x.beginPath(); x.moveTo(cx - 13 * sgn, ey - 12); x.lineTo(cx + 9 * sgn, ey); x.lineTo(cx - 13 * sgn, ey + 12); x.stroke() }
    else if (shock) { x.fillStyle = '#fff'; circ(x, cx, ey, 17); x.fill(); x.lineWidth = 4; x.stroke(); x.fillStyle = '#26160e'; circ(x, cx, ey, 4); x.fill(); x.lineWidth = 7 }
    else if (sad) { x.beginPath(); x.arc(cx, ey - 2, 12, Math.PI * 0.15, Math.PI * 0.85); x.stroke(); x.fillStyle = 'rgba(80,170,255,.85)'; x.fillRect(cx - 5, ey + 12, 10, 40); x.fillStyle = '#26160e' }
    else if (mad) { circ(x, cx, ey + 2, 8); x.fill() }
    else { circ(x, cx, ey, 9); x.fill() }
    // まゆ
    x.lineWidth = C.brows ? 10 : 6
    x.beginPath()
    if (mad) { x.moveTo(cx - 18 * sgn, ey - 34); x.lineTo(cx + 14 * sgn, ey - 22) }
    else if (sad || hot) { x.moveTo(cx - 18 * sgn, ey - 26); x.lineTo(cx + 14 * sgn, ey - 36) }
    else if (wow || shock) { x.arc(cx, ey - 20, 16, Math.PI * 1.2, Math.PI * 1.8) }
    else { x.moveTo(cx - 16, ey - 28); x.lineTo(cx + 16, ey - 28) }
    x.stroke(); x.lineWidth = 7
  }
  if (C.glasses) { x.lineWidth = 5; x.strokeStyle = '#26160e'; for (const sgn of [-1, 1]) { circ(x, 128 + sgn * ex, ey, 25); x.stroke() } x.beginPath(); x.moveTo(128 - 11, ey); x.lineTo(128 + 11, ey); x.stroke(); if (hot) { x.fillStyle = 'rgba(255,255,255,.7)'; for (const sgn of [-1, 1]) { circ(x, 128 + sgn * ex, ey, 22); x.fill() } } x.lineWidth = 7 }
  // 鼻
  x.lineWidth = 4; x.beginPath(); x.moveTo(128, 140); x.quadraticCurveTo(122, 154, 130, 156); x.stroke(); x.lineWidth = 7
  if (C.mustache) { x.fillStyle = C.hair === '#e8e2d8' ? '#bdb6aa' : '#26160e'; x.beginPath(); x.moveTo(92, 168); x.quadraticCurveTo(128, 150, 164, 168); x.quadraticCurveTo(128, 162, 92, 168); x.fill(); x.fillStyle = '#26160e' }
  // 口
  x.lineWidth = 7
  if (happy) { x.fillStyle = '#7a1e1e'; x.beginPath(); x.arc(128, my - 8, 28, 0.1, Math.PI - 0.1); x.closePath(); x.fill() }
  else if (wow || shock) { x.fillStyle = '#7a1e1e'; x.beginPath(); x.ellipse(128, my, 16, wow ? 20 : 24, 0, 0, 7); x.fill() }
  else if (hot) { x.fillStyle = '#7a1e1e'; x.beginPath(); x.ellipse(128, my, 34, 18, 0, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.moveTo(98, my); for (let i = 0; i <= 6; i++) x.lineTo(98 + i * 10, my + (i % 2 ? -6 : 6)); x.stroke(); x.strokeStyle = '#26160e' }
  else if (sad) { x.beginPath(); x.moveTo(100, my + 4); for (let i = 1; i <= 4; i++) x.quadraticCurveTo(100 + i * 14 - 7, my - 8 + (i % 2) * 14, 100 + i * 14, my + 2); x.stroke() }
  else if (mad) { x.beginPath(); x.arc(128, my + 18, 22, Math.PI * 1.2, Math.PI * 1.8); x.stroke() }
  else if (mood === 'talk') { x.fillStyle = '#7a1e1e'; x.beginPath(); x.ellipse(128, my, 16, 12, 0, 0, 7); x.fill() }
  else { x.beginPath(); x.arc(128, my - 14, 18, Math.PI * 0.2, Math.PI * 0.8); x.stroke() }
  // 汗・湯気・怒りマーク
  if (hot) { x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 6; for (const dx of [-50, 0, 50]) { x.beginPath(); x.moveTo(128 + dx, 70); x.bezierCurveTo(128 + dx - 14, 56, 128 + dx + 14, 44, 128 + dx, 28); x.stroke() } }
  if (hot || shock || sad) { x.fillStyle = 'rgba(90,180,255,.9)'; x.beginPath(); x.moveTo(206, 90); x.quadraticCurveTo(222, 116, 206, 122); x.quadraticCurveTo(190, 116, 206, 90); x.fill() }
  if (mad) { x.strokeStyle = '#e0261c'; x.lineWidth = 6; const vx = 196, vy = 70; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { x.beginPath(); x.moveTo(vx + a * 4, vy + b * 4); x.quadraticCurveTo(vx + a * 14, vy + b * 4, vx + a * 16, vy + b * 16); x.stroke() } }
  x.restore()
}
function star(x, cx, cy, r, ri) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? ri : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) } x.closePath() }
const faceUrlCache = {}
function faceUrl(id, mood = 'normal') { const key = id + mood; if (!faceUrlCache[key]) { const c = document.createElement('canvas'); c.width = c.height = 128; drawFace(c.getContext('2d'), id, mood, 128, true); faceUrlCache[key] = c.toDataURL() } return faceUrlCache[key] }

// ---------- 3D
const renderer = new THREE.WebGLRenderer({ canvas: $('#world'), antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch() ? 1.75 : 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
const scene = new THREE.Scene(); scene.background = new THREE.Color('#1d1310'); scene.fog = new THREE.Fog('#1d1310', 7, 16)
const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 40)
scene.add(new THREE.HemisphereLight('#ffe2b8', '#3a2418', 1.25))
const key = new THREE.DirectionalLight('#fff3dc', 1.5); key.position.set(1.5, 5, 3); scene.add(key)
const warm = new THREE.PointLight('#ff9a4a', 6, 7, 1.6); warm.position.set(-0.6, 2.4, -2.6); scene.add(warm)
const potLight = new THREE.PointLight('#ffd9a0', 2.5, 3, 1.5); potLight.position.set(-0.3, 1.9, 0.2); scene.add(potLight)

function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep) } return t }
const lam = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o })
function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m }
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, parent = scene, seg = 16, open = false) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat); m.position.set(x, y, z); parent.add(m); return m }
function sph(r, mat, x = 0, y = 0, z = 0, parent = scene, ws = 16, hs = 12) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat); m.position.set(x, y, z); parent.add(m); return m }

// 床・壁・天井
const tileTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#5d6660'; x.fillRect(0, 0, w, h); x.fillStyle = '#4b544e'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) x.fillRect(i * 64, j * 64, 64, 64); x.strokeStyle = '#2e3430'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke() } }, [6, 6])
const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), lam('#ffffff', { map: tileTex })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -1); scene.add(floor)
const plankTex = (base, line, rep) => canvasTex(256, 256, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { x.fillStyle = `rgba(0,0,0,${0.05 + (i % 3) * 0.04})`; x.fillRect(i * 32, 0, 32, h); x.fillStyle = line; x.fillRect(i * 32, 0, 2, h) } for (let i = 0; i < 30; i++) { x.strokeStyle = 'rgba(40,20,8,.18)'; x.beginPath(); const xx = Math.random() * w; x.moveTo(xx, 0); x.bezierCurveTo(xx + 6, h / 3, xx - 6, h * 2 / 3, xx + 3, h); x.stroke() } }, rep)
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.8), lam('#ffffff', { map: plankTex('#6a4428', '#3a2414', [3, 1]) })); backWall.position.set(0, 1.9, -3.3); scene.add(backWall)
const wtile = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#e8e4da'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b8b2a4'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 32); x.lineTo(w, i * 32); x.stroke() } }, [6, 4])
const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.8), lam('#ffffff', { map: wtile })); leftWall.rotation.y = Math.PI / 2; leftWall.position.set(-2.4, 1.9, -0.5); scene.add(leftWall)
const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.8), lam('#ffffff', { map: plankTex('#7a5030', '#46280f', [3, 1]) })); rightWall.rotation.y = -Math.PI / 2; rightWall.position.set(2.4, 1.9, -0.5); scene.add(rightWall)
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), lam('#ffffff', { map: plankTex('#4a3020', '#24140a', [4, 4]) })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, CEIL_Y, -0.8); scene.add(ceil)
for (const z of [-0.2, -2.2]) { box(1.2, 0.06, 0.16, new THREE.MeshBasicMaterial({ color: '#fff6e2' }), -0.2, CEIL_Y - 0.04, z) }

// 厨房: コンロと寸胴、作業台、丼
const steel = new THREE.MeshStandardMaterial({ color: '#b9bec4', metalness: 0.65, roughness: 0.35 })
const darkSteel = new THREE.MeshStandardMaterial({ color: '#4a4e54', metalness: 0.5, roughness: 0.5 })
box(0.8, 0.7, 0.7, darkSteel, POT.x, 0.35, POT.z)
cyl(0.22, 0.22, 0.03, new THREE.MeshBasicMaterial({ color: '#ff6a20' }), POT.x, 0.715, POT.z, scene, 20)
const potMesh = cyl(0.3, 0.28, 0.46, new THREE.MeshStandardMaterial({ color: '#c9ced4', metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }), POT.x, 0.93, POT.z, scene, 28, true)
cyl(0.31, 0.31, 0.03, steel, POT.x, RIM_Y, POT.z, scene, 28, true)
const waterTex = canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 64, 6, 64, 64, 64); g.addColorStop(0, '#efe9dc'); g.addColorStop(1, '#a8a294'); x.fillStyle = g; x.fillRect(0, 0, w, h) })
const water = new THREE.Mesh(new THREE.CircleGeometry(0.285, 28), new THREE.MeshLambertMaterial({ map: waterTex, emissive: '#181410' })); water.rotation.x = -Math.PI / 2; water.position.set(POT.x, WATER_Y, POT.z); scene.add(water)
const bubbleGeo = new THREE.SphereGeometry(0.025, 8, 6), bubbleMat = new THREE.MeshBasicMaterial({ color: '#fff8e8', transparent: true, opacity: 0.8 })
const bubbles = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(bubbleGeo, bubbleMat); m.visible = false; scene.add(m); return { m, t: Math.random() } })
box(1.1, 0.9, 0.7, steel, 0.65, 0.45, -0.45)
box(1.1, 0.02, 0.7, new THREE.MeshStandardMaterial({ color: '#dfe3e6', metalness: 0.6, roughness: 0.25 }), 0.65, 0.91, -0.45)
// 丼（外が赤、雷文の帯）
const bowlTex = canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#c8281e'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3e6c8'; x.lineWidth = 4; for (let i = 0; i < 8; i++) { const o = i * 32; x.beginPath(); x.moveTo(o + 4, 46); x.lineTo(o + 4, 18); x.lineTo(o + 28, 18); x.lineTo(o + 28, 40); x.lineTo(o + 12, 40); x.lineTo(o + 12, 26); x.lineTo(o + 20, 26); x.stroke() } })
function makeBowl() {
  const g = new THREE.Group()
  const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.07, 0), new THREE.Vector2(0.075, 0.02), new THREE.Vector2(0.13, 0.05), new THREE.Vector2(0.17, 0.13), new THREE.Vector2(0.18, 0.15)]
  const outer = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), new THREE.MeshLambertMaterial({ map: bowlTex, side: THREE.DoubleSide })); g.add(outer)
  const soup = new THREE.Mesh(new THREE.CircleGeometry(0.165, 24), new THREE.MeshLambertMaterial({ color: '#c88a3a', emissive: '#2a1600' })); soup.rotation.x = -Math.PI / 2; soup.position.y = 0.12; g.add(soup)
  const nood = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ map: noodleTex })); nood.scale.y = 0.35; nood.position.y = 0.12; g.add(nood)
  const chashu = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 14), lam('#b8784a')); chashu.position.set(0.07, 0.135, 0.02); chashu.rotation.z = 0.2; g.add(chashu)
  const nori = box(0.07, 0.09, 0.005, lam('#1e2a1e'), -0.08, 0.17, -0.06, g); nori.rotation.x = -0.4
  const negi = new THREE.Mesh(new THREE.CircleGeometry(0.04, 10), lam('#6ab04a')); negi.rotation.x = -Math.PI / 2; negi.position.set(-0.02, 0.165, 0.07); g.add(negi)
  g.userData = { soup, nood, chashu, nori, negi }
  scene.add(g); return g
}
const noodleTex = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#f2d27a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d9b050'; x.lineWidth = 3; for (let i = 0; i < 26; i++) { x.beginPath(); const y = Math.random() * h; x.moveTo(0, y); for (let k = 1; k <= 8; k++) x.quadraticCurveTo(k * 16 - 8, y + (k % 2 ? -8 : 8), k * 16, y); x.stroke() } x.strokeStyle = '#fff2c0'; x.lineWidth = 1.5; for (let i = 0; i < 14; i++) { x.beginPath(); const y = Math.random() * h; x.moveTo(0, y); for (let k = 1; k <= 8; k++) x.quadraticCurveTo(k * 16 - 8, y + (k % 2 ? 6 : -6), k * 16, y); x.stroke() } })
const bowl = makeBowl(); bowl.position.copy(BOWL_PREP)
for (let i = 0; i < 3; i++) { const b2 = makeBowl(); b2.position.set(0.95, 0.92 + i * 0.13, -0.6); b2.userData.soup.visible = b2.userData.nood.visible = b2.userData.chashu.visible = b2.userData.nori.visible = b2.userData.negi.visible = false }

// 客席のカウンター
const woodTop = new THREE.MeshLambertMaterial({ map: plankTex('#b07a44', '#7a4a20', [4, 1]) })
box(4.6, 0.06, 0.5, woodTop, 0, 1.15, -1.3)
box(4.6, 1.12, 0.06, lam('#5a3620'), 0, 0.56, -1.07)
box(4.6, 0.04, 0.1, lam('#3a2414'), 0, 1.19, -1.07)
// こぼしたお湯の水たまり（びしょびしょ度）
const puddleMat = new THREE.MeshBasicMaterial({ color: '#8fd0ff', transparent: true, opacity: 0.45, depthWrite: false })
const puddles = []
function addPuddle(px) { if (puddles.length > 30) return; const m = new THREE.Mesh(new THREE.CircleGeometry(0.05 + Math.random() * 0.07, 12), puddleMat); m.rotation.x = -Math.PI / 2; m.position.set(px + (Math.random() - 0.5) * 0.5, 1.185, -1.3 + (Math.random() - 0.5) * 0.3); m.scale.set(1, 0.6 + Math.random() * 0.6, 1); scene.add(m); puddles.push(m) }
// 椅子
for (const sx of [SEAT.x, ...SIDE_SEATS]) { cyl(0.2, 0.2, 0.08, lam('#a8281e'), sx, 0.72, SEAT.z - 0.05); cyl(0.04, 0.06, 0.7, darkSteel, sx, 0.35, SEAT.z - 0.05) }

// 奥の壁: のれん・品書き・ちょうちん
const norenTex = canvasTex(512, 256, (x, w, h) => drawNoren(x, w, h))
function drawNoren(x, w, h) { x.fillStyle = '#23305e'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < w; i += 6) x.fillRect(i, 0, 2, h); x.fillStyle = '#fff4e0'; x.font = `120px 'Dela Gothic One','Zen Maru Gothic','Hiragino Sans',sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; const s = S.lang === 'ja' ? '湯切' : 'RAMEN'; if (S.lang === 'ja') { x.fillText(s[0], w / 4, h * 0.55); x.fillText(s[1], w * 3 / 4, h * 0.55) } else { x.font = `86px 'Dela Gothic One',sans-serif`; x.fillText(s, w / 2, h * 0.55) } }
const door = box(1.0, 2.1, 0.04, new THREE.MeshBasicMaterial({ color: '#0e1630' }), 1.45, 1.05, -3.27)
const streetLamp = sph(0.08, new THREE.MeshBasicMaterial({ color: '#ffd27a' }), 1.7, 1.7, -3.24)
const noren = new THREE.Group(); scene.add(noren)
for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), new THREE.MeshLambertMaterial({ map: norenTex.clone(), side: THREE.DoubleSide })); m.material.map.repeat.set(0.5, 1); m.material.map.offset.set(i * 0.5, 0); m.material.map.needsUpdate = true; m.position.set(1.2 + i * 0.52, 1.75, -3.2); noren.add(m) }
box(1.2, 0.04, 0.04, lam('#6a4420'), 1.45, 2.14, -3.2)
const menuTex = canvasTex(512, 256, (x, w, h) => drawMenu(x, w, h))
function drawMenu(x, w, h) {
  x.fillStyle = '#3a2414'; x.fillRect(0, 0, w, h)
  const items = S.lang === 'ja' ? [['ラーメン', '七百'], ['チャーシュー麺', '九百'], ['替玉', '百五十'], ['味玉', '百'], ['ライス', '百']] : [['Ramen', '700'], ['Chashu', '900'], ['Refill', '150'], ['Egg', '100'], ['Rice', '100']]
  items.forEach(([a, b], i) => { const x0 = 12 + i * 100; x.fillStyle = '#efe0bc'; x.fillRect(x0, 10, 88, h - 20); x.fillStyle = '#26160e'; x.textAlign = 'center'
    if (S.lang === 'ja') { x.font = `900 30px 'Zen Maru Gothic','Hiragino Sans',sans-serif`; const n = Math.min(a.length, 6), sz = Math.min(30, 170 / n); x.font = `900 ${sz}px 'Zen Maru Gothic','Hiragino Sans',sans-serif`; [...a].slice(0, 7).forEach((ch, k) => x.fillText(ch, x0 + 44, 44 + k * sz * 1.05)); x.fillStyle = '#b8281e'; x.font = `900 18px 'Zen Maru Gothic',sans-serif`; x.fillText(b, x0 + 44, h - 22) }
    else { x.save(); x.translate(x0 + 44, h / 2); x.rotate(-Math.PI / 2); x.font = `900 30px 'Zen Maru Gothic',sans-serif`; x.fillText(a, 0, 0); x.restore(); x.fillStyle = '#b8281e'; x.font = `900 20px sans-serif`; x.fillText(b, x0 + 44, h - 22) } })
}
const menu = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), new THREE.MeshLambertMaterial({ map: menuTex })); menu.position.set(-0.75, 2.3, -3.28); scene.add(menu)
const chTex = canvasTex(256, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7a0e0e'); g.addColorStop(0.5, '#ff4a2a'); g.addColorStop(1, '#7a0e0e'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(60,0,0,.5)'; x.lineWidth = 3; for (let y = 12; y < h; y += 18) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke() } x.fillStyle = '#ffe9b0'; x.font = `110px 'Dela Gothic One','Hiragino Sans',sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('麺', w / 4, h / 2); x.fillText('麺', w * 3 / 4, h / 2) })
const chochins = []
for (const [cx, cz] of [[-1.85, -2.6], [0.6, -2.7]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshLambertMaterial({ map: chTex, emissive: '#ff5a2a', emissiveIntensity: 0.55 })); m.scale.y = 1.35; m.position.set(cx, 2.25, cz); scene.add(m); chochins.push(m); box(0.02, CEIL_Y - 2.48, 0.02, lam('#222'), cx, (CEIL_Y + 2.48) / 2, cz) }

// 湯気
const steamTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h) })
const steams = Array.from({ length: 18 }, (_, i) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 })); scene.add(m); return { m, t: i / 18, x: 0, z: 0 } })
function respawnSteam(s) { s.t = 0; s.x = POT.x + (Math.random() - 0.5) * 0.4; s.z = POT.z + (Math.random() - 0.5) * 0.4; s.sp = 0.5 + Math.random() * 0.4; s.dx = (Math.random() - 0.5) * 0.2 }
steams.forEach(s => { respawnSteam(s); s.t = Math.random() })

// 店主（プレイヤー）: 後ろ姿
const owner = new THREE.Group(); owner.position.set(0.12, 0, 0.32); scene.add(owner)
const skinM = lam('#e0a878'), blackM = lam('#1e1e22'), whiteM = lam('#f6f2ea')
box(0.46, 0.62, 0.28, blackM, 0, 1.22, 0, owner)
box(0.5, 0.5, 0.3, lam('#2a2a30'), 0, 0.66, 0, owner)
box(0.42, 0.06, 0.29, lam('#6a4a2a'), 0, 0.92, 0, owner)
for (const sx of [-0.12, 0.12]) box(0.16, 0.42, 0.18, lam('#22242a'), sx, 0.21, 0, owner)
const oHead = sph(0.15, skinM, 0, 1.72, 0, owner)
const oHair = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), lam('#1a1410')); oHair.position.set(0, 1.73, 0.01); oHair.rotation.x = 0.5; owner.add(oHair)
const band = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.032, 8, 24), whiteM); band.rotation.x = Math.PI / 2 - 0.15; band.position.set(0, 1.76, 0); owner.add(band)
sph(0.04, whiteM, 0, 1.75, 0.16, owner)
for (const s of [-1, 1]) { const tail = box(0.05, 0.12, 0.02, whiteM, s * 0.04, 1.68, 0.16, owner); tail.rotation.z = s * 0.4 }
const arms = [0, 1].map(() => { const g = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1), blackM); g.geometry.translate(0, 0, 0.5); scene.add(g); return g })
const hands = [0, 1].map(() => sph(0.05, skinM))
const shoulders = [new THREE.Vector3(-0.24, 1.46, 0), new THREE.Vector3(0.24, 1.46, 0)]

// てぼ（湯切りのかご）
const meshTex = canvasTex(64, 64, (x, w, h) => { x.clearRect(0, 0, w, h); x.strokeStyle = '#d8dde2'; x.lineWidth = 3; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 8, 0); x.lineTo(i * 8, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 8); x.lineTo(w, i * 8); x.stroke() } }, [4, 1])
function makeTebo() {
  const g = new THREE.Group()
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.075, 0.22, 16, 1, true), new THREE.MeshStandardMaterial({ map: meshTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4, color: '#ffffff' })); g.add(basket)
  cyl(0.115, 0.115, 0.02, steel, 0, 0.11, 0, g, 16, true)
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.075, 14), new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide })); bottom.rotation.x = Math.PI / 2; bottom.position.y = -0.11; g.add(bottom)
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.55), new THREE.MeshLambertMaterial({ color: '#6a3a1a' })); handle.geometry.translate(0, 0, 0.275); handle.position.set(0, 0.1, 0.1); handle.rotation.x = -0.45; g.add(handle)
  const nood = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshLambertMaterial({ map: noodleTex, emissive: '#000000' })); nood.scale.y = 0.85; nood.position.y = -0.01; g.add(nood)
  g.userData = { nood, handle }
  return g
}
const tebo = makeTebo(); scene.add(tebo)
const gripLocal = [new THREE.Vector3(0, 0.1 + Math.sin(0.45) * 0.38, 0.1 + Math.cos(0.45) * 0.38), new THREE.Vector3(0, 0.1 + Math.sin(0.45) * 0.55, 0.1 + Math.cos(0.45) * 0.55)]
const flyTebo = makeTebo(); flyTebo.visible = false; scene.add(flyTebo)
const flyNood = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshLambertMaterial({ map: noodleTex })); flyNood.visible = false; scene.add(flyNood)
// 天井に張り付いた麺（その回の間ずっと残る）
const stuck = []
function addStuck(px, pz) {
  const g = new THREE.Group(); g.position.set(px, CEIL_Y - 0.02, pz)
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshLambertMaterial({ map: noodleTex })); m.scale.y = 0.35; g.add(m)
  for (let i = 0; i < 6; i++) { const len = 0.15 + Math.random() * 0.35, s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 5), lam('#f2d27a')); s.position.set((Math.random() - 0.5) * 0.16, -len / 2, (Math.random() - 0.5) * 0.16); g.add(s) }
  scene.add(g); stuck.push(g); return g
}

// しぶき
const dropGeo = new THREE.SphereGeometry(0.018, 6, 4), dropMat = new THREE.MeshBasicMaterial({ color: '#cfeaff', transparent: true, opacity: 0.85 })
const drops = Array.from({ length: 90 }, () => { const m = new THREE.Mesh(dropGeo, dropMat); m.visible = false; scene.add(m); return { m, v: new THREE.Vector3(), life: 0 } })
let dropI = 0
function spray(from, to, n, spread = 0.3, up = 1.2) {
  for (let i = 0; i < n; i++) {
    const d = drops[dropI++ % drops.length]; d.m.visible = true; d.m.position.copy(from); d.life = 1.4
    if (to) { const tt = 0.45 + Math.random() * 0.15; d.v.set((to.x - from.x) / tt + (Math.random() - 0.5) * spread * 3, (to.y - from.y) / tt + 4.9 * tt + (Math.random() - 0.5) * spread * 2, (to.z - from.z) / tt + (Math.random() - 0.5) * spread * 3) }
    else d.v.set((Math.random() - 0.5) * spread, -Math.random() * 0.5 + (Math.random() < 0.3 ? up * Math.random() : 0), (Math.random() - 0.5) * spread)
    d.m.scale.setScalar(0.6 + Math.random() * 0.9)
  }
}

// お客さん
const custs = {}
function makeCustomer(id) {
  const C = CUSTS[id], g = new THREE.Group(), bw = C.big ? 1.35 : 1
  const body = box(0.46 * bw, 0.6, 0.3, lam(C.body), 0, 1.12, 0, g)
  if (C.tie) { box(0.06, 0.3, 0.02, lam(C.tie), 0, 1.22, 0.16, g); box(0.16, 0.06, 0.02, lam('#f2f2f2'), 0, 1.4, 0.155, g) }
  const head = new THREE.Group(); head.position.set(0, 1.6, 0); g.add(head)
  sph(0.17 * (C.big ? 1.1 : 1), lam(C.skin), 0, 0, 0, head, 18, 14)
  const hm = lam(C.hair), hs = C.style
  if (hs !== 'bald') {
    const th = hs === 'bob' || hs === 'long' ? 0.62 : hs === 'buzz' ? 0.36 : 0.45
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.178 * (C.big ? 1.1 : 1), 18, 10, 0, Math.PI * 2, 0, Math.PI * th), hm); cap.rotation.x = -0.25; head.add(cap)
    if (hs === 'bun') sph(0.07, hm, 0, 0.17, -0.06, head)
    if (hs === 'long') box(0.34, 0.36, 0.08, hm, 0, -0.16, -0.1, head)
    if (hs === 'side') { const f = sph(0.08, hm, 0.07, 0.13, 0.08, head); f.scale.set(1.4, 0.5, 1) }
  } else { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 18, Math.PI * 1.2), hm); ring.rotation.set(Math.PI / 2, 0, -Math.PI * 0.1 + Math.PI); ring.position.y = -0.02; head.add(ring) }
  const faceC = document.createElement('canvas'); faceC.width = faceC.height = 256
  const faceT = new THREE.CanvasTexture(faceC); faceT.colorSpace = THREE.SRGBColorSpace
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: faceT, transparent: true, depthWrite: false })); face.position.z = 0.172 * (C.big ? 1.1 : 1); head.add(face)
  const armL = new THREE.Group(), armR = new THREE.Group()
  for (const [a, sx] of [[armL, -1], [armR, 1]]) { a.position.set(sx * 0.27 * bw, 1.38, 0); const m = box(0.1, 0.42, 0.1, lam(C.body), 0, -0.2, 0, a); m.userData.k = 1; sph(0.05, lam(C.skin), 0, -0.42, 0, a); g.add(a) }
  if (C.mic) { const mic = new THREE.Group(); cyl(0.015, 0.012, 0.16, lam('#222'), 0, 0.06, 0, mic); sph(0.035, lam('#444'), 0, 0.15, 0, mic); mic.position.set(0, -0.44, 0.04); armR.add(mic) }
  const hat = makeTebo(); hat.userData.nood.visible = false; hat.rotation.x = Math.PI; hat.position.set(0, 0.2, 0); hat.scale.setScalar(1.25); hat.visible = false; head.add(hat)
  const wetM = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8), new THREE.MeshBasicMaterial({ color: '#8fd0ff', transparent: true, opacity: 0.25, depthWrite: false })); wetM.visible = false; head.add(wetM)
  g.visible = false; scene.add(g)
  const o = { id, g, head, face, faceC, faceT, armL, armR, hat, wetM, mood: '', moodUntil: 0, base: 'normal', anim: null, clapT: 0, jump: 0 }
  setFace(o, 'normal'); return o
}
function setFace(o, mood) { if (o.mood === mood) return; o.mood = mood; const x = o.faceC.getContext('2d'); x.clearRect(0, 0, 256, 256); drawFace(x, o.id, mood, 256, false); o.faceT.needsUpdate = true }
function custAt(o, x, z) { o.g.position.set(x, 0, z) }
for (const id of Object.keys(CUSTS)) custs[id] = makeCustomer(id)
// テレビのカメラマン
const crew = new THREE.Group(); crew.visible = false; scene.add(crew)
box(0.44, 0.7, 0.28, lam('#2a3a4a'), 0, 1.15, 0, crew); sph(0.15, lam('#e0b08a'), 0, 1.65, 0, crew)
const capM = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam('#c8281e')); capM.position.y = 1.68; crew.add(capM)
for (const sx of [-0.1, 0.1]) box(0.15, 0.8, 0.16, lam('#22242a'), sx, 0.4, 0, crew)
const camBox = box(0.22, 0.2, 0.42, lam('#1a1a1e'), 0.2, 1.62, 0.12, crew); cyl(0.07, 0.08, 0.12, lam('#333'), 0.2, 1.62, 0.38, crew).rotation.x = Math.PI / 2
const tally = sph(0.03, new THREE.MeshBasicMaterial({ color: '#ff2a1a' }), 0.2, 1.75, 0.05, crew)
crew.position.set(1.55, 0, -1.75); crew.rotation.y = -0.6

// ---------- 状態
function pickList(r) {
  const out = []; let prev = ''
  const ord = () => { const v = r(); return v < 0.16 ? 'bari' : v < 0.46 ? 'kata' : v < 0.76 ? 'futsu' : 'yawa' }
  for (let i = 0; i < 14; i++) { let c; do c = CUST_POOL[Math.floor(r() * CUST_POOL.length)]; while (c === prev); prev = c; out.push({ cust: c, order: ord() }) }
  return out
}
let sideC = []
function setSideCustomers() {
  for (const c of sideC) c.g.visible = false
  sideC = ['hara', 'perm'].map((id, i) => { const o = custs[id]; o.wetM.visible = false; o.hat.visible = false; setFace(o, 'normal'); custAt(o, SIDE_SEATS[i], SEAT.z); o.g.visible = true; o.g.rotation.y = i ? -0.15 : 0.15; return o })
}

function startGame(seed, opt = {}) {
  S.seed = seed ?? (Math.random() * 1e9) >>> 0
  S.rnd = rng(S.seed); S.botR = rng(S.seed * 31 + 7)
  S.mode = opt.demo ? 'demo' : 'play'
  S.list = pickList(S.rnd); S.bi = -1; S.b = null; S.results = []; S.result = null; S.closing = false
  S.left = GAME_T; S.tv = opt.tv ?? S.rnd() < 0.4; S.tvBowl = 2; S.tvRes = null
  if (S.tv) S.list[S.tvBowl] = { cust: 'ana', order: S.list[S.tvBowl].order }
  S.splashN = 0; S.tenkuN = 0
  S.inq = []; S.kw = { on: false, t: 0 }; S.lastS = null; S.lastSAt = -9; S.stage = 0; S.rt = 0
  for (const m of stuck) scene.remove(m); stuck.length = 0
  for (const m of puddles) scene.remove(m); puddles.length = 0
  for (const id in custs) { const o = custs[id]; o.g.visible = false; o.hat.visible = false; o.wetM.visible = false }
  setSideCustomers()
  crew.visible = false; flyTebo.visible = false; flyNood.visible = false; tebo.visible = true; tebo.userData.nood.visible = false
  resetBowlMesh()
  if (S.mode === 'play') { try { S.tut = localStorage.getItem('ym.tut') !== '1' } catch (e) { S.tut = true } go('play'); setPhase('open'); banner(T('ready'), '', 'gold'); if (!S.quiet) Snd.sfx('go') }
  else { S.tut = false; nextBowl() }
}
function resetBowlMesh() { bowl.position.copy(BOWL_PREP); for (const k of ['nood', 'chashu', 'nori', 'negi']) bowl.userData[k].visible = false; bowl.userData.soup.material.color.set('#c88a3a') }
function setPhase(p) { S.ph = p; S.pt = 0 }
function nextBowl() {
  S.bi++
  if (S.mode === 'demo' && S.bi >= S.list.length) { S.list = pickList(S.rnd); S.bi = 0 }
  const L0 = S.list[S.bi]
  S.b = { cust: L0.cust, order: L0.order, target: ORDERS[L0.order].t, d: 0, W: 100, swings: 0, lastSw: -9, streak: 0, maxStreak: 0, tenku: 0, splash: 0, fail: null, shakeT: 0, tv: S.tv && S.bi === S.tvBowl && S.mode === 'play', dLift: null, botLift: null, botNext: 0, botTenku: false, idx: S.bi }
  if (S.mode === 'demo') S.b.demo = S.demoN++
  if (S.bot || S.mode === 'demo') botPlan()
  crew.visible = !!S.b.tv
  resetBowlMesh(); tebo.visible = true; flyTebo.visible = false; flyNood.visible = false; tebo.userData.nood.visible = false
  const o = custs[S.b.cust]; o.hat.visible = false; o.wetM.visible = false; o.g.visible = true; o.g.rotation.set(0, 0, 0); setFace(o, 'normal'); o.jump = 0
  custAt(o, SEAT.x - 2.4, SEAT.z - 0.6)
  if (S.b.tv) { setPhase('tvin'); crew.visible = true; banner(T('tvIn'), T('tvAsk'), 'gold'); if (!S.quiet) Snd.sfx('tv') } else setPhase('arrive')
  hudOrder(false)
}
const curC = () => S.b && custs[S.b.cust]

// ---------- 1フレーム（固定60Hz）
function update() {
  S.frame++; S.t += STEP
  if (S.view === 'result') revealUpdate()
  if (S.ph !== 'idle' && S.b !== undefined) logic()
  anim()
}
function logic() {
  if (S.bot || S.mode === 'demo') botThink()
  const evs = S.inq.splice(0)
  S.pt += STEP
  if (S.mode === 'play' && S.ph !== 'open' && S.ph !== 'close' && S.ph !== 'idle' && S.left > 0) {
    const prev = Math.ceil(S.left); S.left -= STEP
    if (Math.ceil(S.left) !== prev && S.left <= 5.01 && S.left > 0 && !S.quiet) Snd.sfx('tick')
    if (S.left <= 0) { S.left = 0; timeUp() }
  }
  const b = S.b
  switch (S.ph) {
    case 'open': if (S.pt >= PH.open) nextBowl(); break
    case 'tvin': if (S.pt >= PH.tvin) setPhase('arrive'); break
    case 'arrive': if (S.pt >= PH.arrive) { setPhase('order'); hudOrder(true); if (!S.quiet) Snd.voice(CUSTS[b.cust].pitch, 'talk'); setFace(curC(), 'talk') } break
    case 'order': if (S.pt >= PH.order) { setPhase('boil'); setFace(curC(), 'normal'); b.d = 0; if (!S.quiet) Snd.sfx('lift') } break
    case 'boil':
      b.d += STEP
      for (const e of evs) if (e.type === 'lift' || e.type === 'act' || e.type === 'kd') { doLift(); break }
      if (S.ph === 'boil' && b.d >= BOIL_LEAVE) fail('leave')
      break
    case 'lift': if (S.pt >= PH.lift) { setPhase('shake'); b.shakeT = 0; S.kw = { on: false, t: 0 } } break
    case 'shake':
      b.shakeT += STEP
      if (S.kw.on) S.kw.t += STEP
      for (const e of evs) {
        if (S.ph !== 'shake') break
        if (e.type === 'swing') swing(e.s, e.wind)
        else if (e.type === 'kd') { if (!S.kw.on && S.kw.t === 0) S.kw = { on: true, t: 0 }; else if (!S.kw.on) S.kw.on = true }
        else if (e.type === 'ku') S.kw.on = false
        else if (e.type === 'sw') { const k = S.kw; if (k.t > 0) swing(keyS(k.t), clamp(k.t / 0.45)); else swing(0.28, 0); S.kw = { on: false, t: 0 } }
        else if (e.type === 'act' || e.type === 'serve') serve()
      }
      if (S.ph === 'shake' && b.shakeT >= SHAKE_LEAVE) fail('leave')
      break
    case 'serve': if (S.pt >= PH.serve) toReact(); break
    case 'fail': if (S.pt >= PH.fail) toReact(); break
    case 'react': if (S.pt >= PH.react) { setPhase('leave'); hudOrder(false) } break
    case 'leave': if (S.pt >= PH.leave) { const o = curC(); if (o) o.g.visible = false; if (S.mode === 'play' && (S.closing || S.left <= 0)) toClose(); else nextBowl() } break
    case 'close': if (S.pt >= PH.close) finishGame(); break
  }
}
const keyS = t => t < 0.45 ? 0.25 + t / 0.45 * 0.55 : 0.8 + (t - 0.45) * 0.7
function timeUp() {
  if (['tvin', 'arrive', 'order', 'boil', 'lift', 'shake'].includes(S.ph)) { hudOrder(false); const o = curC(); if (o && S.ph !== 'tvin') { setFace(o, 'sad') } toClose() }
  else S.closing = true
}
function toClose() { setPhase('close'); banner(T('closing'), '', ''); hudOrder(false); crew.visible = false; if (!S.quiet) Snd.sfx('shutter') }
function doLift() {
  const b = S.b; b.dLift = b.d; setPhase('lift'); tebo.userData.nood.visible = true
  if (!S.quiet) Snd.sfx('lift')
  const err = b.d - b.target
  if (Math.abs(err) <= 0.2) popAt3(T('pPerfect'), tebo.position, 'gold')
  for (let i = 0; i < 6; i++) { const s = steams[i]; s.t = 0.02 }
}
// 1回振った
function swing(s, wind) {
  const b = S.b; if (b.shakeT - b.lastSw < 0.1) return
  const dt = b.shakeT - b.lastSw; b.lastSw = b.shakeT; b.swings++
  S.lastS = s; S.lastSAt = S.t
  const rhythm = b.swings === 1 ? 1 : dt < 0.2 ? 0.4 : dt < 0.3 ? 0.8 : dt <= 0.9 ? 1.15 : 0.95
  if (rhythm > 1) { b.streak++; b.maxStreak = Math.max(b.maxStreak, b.streak) } else b.streak = 0
  const from = tebo.position.clone(), c = curC()
  let r = 0, kind
  if (s >= S_FLY) return fail('fly')
  if (s >= S_CEIL) return fail('ceil')
  if (s >= S_SPLASH) {
    kind = 'splash'; r = 0.2; const hits = s >= S_SPLASH2 ? 2 : 1; b.splash += hits; S.splashN += hits; if (b.tv) S.tvRes = 'ng'
    const head = new THREE.Vector3(c.g.position.x, 1.62, c.g.position.z + 0.15)
    spray(from, head, 26, 0.25); addPuddle(c.g.position.x)
    c.moodUntil = S.t + 1.1; setFace(c, 'hot'); c.jump = 0.5; c.wetM.visible = true
    if (hits > 1) { const o = sideC[Math.floor(S.rnd() * sideC.length)]; spray(from, new THREE.Vector3(o.g.position.x, 1.62, o.g.position.z + 0.15), 16, 0.3); setFace(o, 'hot'); o.moodUntil = S.t + 1.4; o.wetM.visible = true; o.jump = 0.5; addPuddle(o.g.position.x) }
    popAt3(T('pSplash'), head, 'hot'); camShake(0.25)
    if (!S.quiet) { Snd.sfx('splash'); Snd.voice(CUSTS[b.cust].pitch, 'hot') }
  } else if (wind >= TENKU_WIND && s >= TENKU_LO && s < TENKU_HI && !b.tenku) {
    kind = 'tenku'; r = 0.45; b.tenku = 1; S.tenkuN++; if (b.tv && S.tvRes !== 'ng') S.tvRes = 'ok'
    spray(from.clone().setY(from.y - 0.1), null, 22, 0.8, 0.2)
    banner(T('pTenku'), '', 'gold'); S.vis.flash = 0.35
    for (const o of [c, ...sideC]) { o.clapT = 1.6; setFace(o, 'wow'); o.moodUntil = S.t + 1.6 }
    if (!S.quiet) { Snd.sfx('tenku'); Snd.sfx('applause', 0.8); Snd.voice(CUSTS[b.cust].pitch, 'wow') }
  } else if (s >= S_STRONG) { kind = 'strong'; r = 0.17 * rhythm; spray(from, null, 12, 0.6, 0.4) }
  else if (s >= S_WEAK) { kind = 'good'; r = lerp(0.08, 0.15, (s - S_WEAK) / (S_STRONG - S_WEAK)) * rhythm; spray(from, null, 7, 0.35, 0.2) }
  else { kind = 'weak'; r = 0.03; spray(from, null, 2, 0.1, 0) }
  if (kind !== 'splash' && kind !== 'tenku') {
    if (kind === 'weak') popAt3(T('pWeak'), from, 'meh')
    else if (rhythm < 0.5) popAt3(T('pClatter'), from, 'meh')
    else if (kind === 'strong') popAt3(rhythm > 1 && b.streak % 3 === 0 ? T('pRhythm') : T('pGreat'), from, 'good')
    else if (rhythm > 1 && b.streak % 3 === 0) popAt3(T('pRhythm'), from, 'good')
    else popAt3(T('pGood'), from, 'good')
  }
  b.W = b.W * (1 - r)
  S.vis.sw = { t: 0, s, kind }
  if (!S.quiet && kind !== 'splash' && kind !== 'tenku') { if (kind === 'weak') Snd.sfx('weak'); else Snd.sfx('swish', clamp(s)) }
}
function fail(kind) {
  const b = S.b; b.fail = kind; const c = curC()
  if (b.tv && S.mode === 'play' && kind !== 'leave') S.tvRes = 'ng'
  record()
  setPhase('fail'); hudOrder(false)
  if (kind === 'ceil') {
    tebo.userData.nood.visible = false; flyNood.visible = true; flyNood.position.copy(tebo.position)
    S.vis.fly = { kind, t: 0, from: tebo.position.clone(), to: new THREE.Vector3(POT.x + (S.rnd() - 0.5) * 1.6, CEIL_Y - 0.03, POT.z - 0.3 - S.rnd() * 0.9) }
    banner(T('pCeil'), '', 'blue'); S.vis.camTilt = 1.3
    setFace(c, 'shock'); c.moodUntil = S.t + 2.5
    if (!S.quiet) { Snd.sfx('ceil'); Snd.voice(CUSTS[b.cust].pitch, 'wow') }
  } else if (kind === 'fly') {
    tebo.visible = false; flyTebo.visible = true; flyTebo.userData.nood.visible = true; flyTebo.position.copy(tebo.position)
    S.vis.fly = { kind, t: 0, from: tebo.position.clone(), to: new THREE.Vector3(c.g.position.x, 1.88, c.g.position.z) }
    spray(tebo.position, new THREE.Vector3(c.g.position.x, 1.6, c.g.position.z), 20, 0.4); b.splash++; S.splashN++; addPuddle(c.g.position.x)
    banner(T('pFly'), '', ''); camShake(0.2)
    if (!S.quiet) { Snd.sfx('fly'); Snd.sfx('splash') }
  } else {
    setFace(c, 'mad'); c.moodUntil = S.t + 3; popAt3(T('pLeave'), new THREE.Vector3(c.g.position.x, 1.9, c.g.position.z), 'meh')
    if (!S.quiet) Snd.voice(CUSTS[b.cust].pitch, 'mad')
    S.pt = PH.fail - 0.4
  }
}
function serve() {
  const b = S.b; if (b.swings === 0 && S.mode === 'play' && !S.bot && b.shakeT < 0.25) return
  record(); setPhase('serve'); S.vis.serveFrom = tebo.position.clone()
  if (!S.quiet) Snd.sfx('serve')
}
// 1杯の採点（出した瞬間・失敗した瞬間に決まる）
function record() {
  const b = S.b, o = ORDERS[b.order], Y = Math.round(100 - b.W)
  const d = b.dLift ?? b.d, err = Math.abs(d - b.target)
  let score = 0, kind, mood
  if (b.fail) { kind = b.fail; mood = b.fail === 'fly' ? 'shock' : 'mad' }
  else {
    const boilP = 35 * clamp(1 - Math.max(0, err - 0.2) / 0.9) * clamp(Y / 70)
    const dryP = 45 * clamp((Y - 40) / (Y_READY - 40))
    const bonus = (b.tenku ? 12 : 0) + (b.maxStreak >= 4 ? 5 : 0) + (err <= 0.2 ? 3 : 0)
    const pen = b.splash * 15 + Math.max(0, b.shakeT - 6) * 2
    score = Math.round(clamp(boilP + dryP + bonus - pen, 0, 100))
    if (b.splash) { kind = 'splash'; mood = 'hot' }
    else if (b.tenku && score >= 70) { kind = 'tenku'; mood = 'wow' }
    else if (Y < 62) { kind = 'wet'; mood = 'sad' }
    else if (err > 0.9) { kind = d < b.target ? 'hard' : 'soft'; mood = 'mad' }
    else if (score >= 80) { kind = 'perfect'; mood = 'happy' }
    else { kind = 'good'; mood = 'normal' }
  }
  const arr = LINES[kind][S.lang], pick = arr[Math.floor(S.rnd() * arr.length)]
  const res = { cust: b.cust, order: b.order, d: Math.round(d * 100) / 100, err: Math.round(err * 100) / 100, Y: b.fail ? 0 : Y, swings: b.swings, tenku: b.tenku, splash: b.splash, fail: b.fail, score, kind, mood, line: fmt(pick, { o: L(o) }), lineIdx: arr.indexOf(pick), tv: b.tv }
  b.res = res
  if (S.mode === 'play') {
    S.results.push(res)
    if (b.tv) S.tvRes = (b.splash || (b.fail && b.fail !== 'leave') || S.tvRes === 'ng') ? 'ng' : b.tenku ? 'ok' : 'none'
  }
  return res
}
function toReact() {
  const b = S.b, r = b.res, c = curC(); setPhase('react')
  if (S.vis.fly && S.vis.fly.kind === 'fly') { c.hat.visible = true; flyTebo.visible = false }
  setFace(c, r.mood); c.moodUntil = S.t + 9
  if (r.kind === 'perfect' || r.kind === 'tenku') c.jump = 0.4
  hudOrder(true, r.line, r.mood)
  if (!S.quiet) Snd.voice(CUSTS[b.cust].pitch, { happy: 'ok', wow: 'wow', hot: 'mad', sad: 'meh', mad: 'mad', shock: 'sad', normal: 'ok' }[r.mood] || 'ok')
  if (b.tv && S.mode === 'play') {
    if (S.tvRes === 'ok') { banner(T('tvOk'), '', 'gold'); if (!S.quiet) Snd.sfx('cheer') }
    else if (S.tvRes === 'ng') { banner(T('tvNg'), '', 'blue'); if (!S.quiet) Snd.sfx('tvng') }
  }
  if (S.mode === 'play' && S.tut && S.results.length >= 2) { S.tut = false; try { localStorage.setItem('ym.tut', '1') } catch (e) {} }
}
function finishGame() {
  const R = S.results, served = R.filter(r => !r.fail)
  const sum = R.reduce((a, r) => a + r.score, 0), tvB = S.tvRes === 'ok' ? 40 : S.tvRes === 'ng' ? -30 : 0
  const total = Math.max(0, sum + tvB), splash = S.splashN
  const avgY = served.length ? Math.round(served.reduce((a, r) => a + r.Y, 0) / served.length) : 0
  let rank = RANKS.find(k => total >= k.min)
  if (splash >= 6) rank = RANK_WET
  else if (!served.length) rank = splash || R.some(r => r.fail && r.fail !== 'leave') ? RANK_WET : RANK_IDLE
  S.result = { served: served.length, total, sum, tvB, splash, avgY, tenku: S.tenkuN, rank, tv: S.tv ? (S.tvRes || 'none') : null, bowls: R }
  try { localStorage.setItem('ym.tut', '1') } catch (e) {}
  S.mode = 'off'; setPhase('idle'); go('result')
}

// ---------- 台本のボット（検証と、タイトルのお手本）
const BOTS = {
  good: { liftSd: 0.1, sMean: 0.86, sSd: 0.06, iv: 0.46, ivSd: 0.05, tenku: 1, tSd: 0.035, serveY: 88, maxSw: 16 },
  normal: { liftSd: 0.42, sMean: 0.72, sSd: 0.2, iv: 0.42, ivSd: 0.13, tenku: 0.4, tSd: 0.09, serveY: 80, maxSw: 13 },
  sloppy: { liftSd: 1.1, sMean: 0.85, sSd: 0.38, iv: 0.3, ivSd: 0.16, tenku: 0.4, tSd: 0.25, serveY: 55, maxSw: 7 },
  idle: null,
  demo: { liftSd: 0.15, sMean: 0.84, sSd: 0.07, iv: 0.42, ivSd: 0.04, tenku: 0.7, tSd: 0.04, serveY: 86, maxSw: 14 },
}
function botPlan() {
  const B = BOTS[S.mode === 'demo' ? 'demo' : S.bot]; if (!B) return; const r = S.botR, b = S.b
  b.botLift = Math.max(0.3, ORDERS[b.order].t + gauss(r, 0, B.liftSd)); b.botTenku = r() < B.tenku
  if (S.mode === 'demo' && b.demo % 3 === 2) b.botSplash = true
}
function botThink() {
  const B = BOTS[S.mode === 'demo' ? 'demo' : S.bot], b = S.b; if (!B || !b) return
  const r = S.botR, push = e => S.inq.push(e)
  if (S.ph === 'boil' && b.d >= b.botLift) push({ type: 'lift' })
  else if (S.ph === 'shake' && b.shakeT >= b.botNext) {
    if (100 - b.W >= B.serveY || b.swings >= B.maxSw) { push({ type: 'serve' }); b.botNext = 99; return }
    let s, wind = 0.3
    if (b.botSplash && b.swings === 3) s = 1.08
    else if (b.botTenku && !b.tenku && b.swings === 0) { wind = 1; s = gauss(r, 0.96, B.tSd) }
    else s = gauss(r, B.sMean, B.sSd)
    push({ type: 'swing', s: Math.max(0.05, s), wind }); b.botNext = b.shakeT + Math.max(0.12, gauss(r, B.iv, B.ivSd))
  }
}

// ---------- 見た目の動き
S.vis = { raise: 0, raiseT: 0, sw: null, flash: 0, fly: null, camTilt: 0, shake: 0, serveFrom: null }
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3()
function camShake(v) { S.vis.shake = Math.max(S.vis.shake, v) }
function anim() {
  const t = S.t, V = S.vis, b = S.b, ph = S.ph
  // 湯気
  for (const s of steams) { s.t += STEP * (s.sp || 0.6) * 0.6; if (s.t >= 1) respawnSteam(s); const k = s.t; s.m.position.set(s.x + s.dx * k, RIM_Y + 0.05 + k * 1.1, s.z); s.m.scale.setScalar(0.25 + k * 0.6); s.m.material.opacity = Math.sin(k * Math.PI) * 0.35 }
  for (const bb of bubbles) { bb.t += STEP * 1.6; if (bb.t > 1) { bb.t = 0; bb.x = (Math.random() - 0.5) * 0.4; bb.z = (Math.random() - 0.5) * 0.4; if (S.view === 'play' && Math.random() < 0.15 && !S.quiet) Snd.bubble() } bb.m.visible = true; bb.m.position.set(POT.x + (bb.x || 0), WATER_Y + Math.sin(bb.t * Math.PI) * 0.02, POT.z + (bb.z || 0)); bb.m.scale.setScalar(Math.sin(bb.t * Math.PI) + 0.01) }
  water.position.y = WATER_Y + Math.sin(t * 7) * 0.004
  for (const [i, c] of chochins.entries()) c.rotation.z = Math.sin(t * 1.3 + i) * 0.06
  noren.children.forEach((m, i) => { m.rotation.x = Math.sin(t * 1.6 + i) * 0.05 })
  tally.visible = Math.floor(t * 2) % 2 === 0
  // 鍵盤の振り上げ（気合）
  const keyRaise = S.kw.t > 0 ? clamp(S.kw.t / 0.45) : 0
  const pRaise = ptr.raise
  const raiseTarget = ph === 'shake' ? Math.max(keyRaise, pRaise, botRaise()) : 0
  V.raise = lerp(V.raise, raiseTarget, 0.35)
  // てぼの位置
  const base = new THREE.Vector3(POT.x, 1.42, POT.z + 0.04)
  let ty = base.y, tilt = 0, tx = base.x, tz = base.z, flip = 0
  if (ph === 'boil' || ph === 'order') { ty = 1.03 + Math.sin(t * 5) * 0.01; tilt = 0.1 }
  else if (ph === 'arrive' || ph === 'tvin' || ph === 'open' || ph === 'idle' || ph === 'react' || ph === 'leave' || ph === 'close') { tx = POT.x + 0.32; ty = 1.3; tz = POT.z + 0.1; tilt = 0.3 }
  else if (ph === 'lift') { const k = ease(S.pt / PH.lift); ty = lerp(1.03, base.y, k) }
  else if (ph === 'shake') {
    ty = base.y + V.raise * 0.72; tilt = -V.raise * 0.35
    if (V.sw) { V.sw.t += STEP; const k = V.sw.t, sc = V.sw.s, low = base.y - 0.06 - Math.min(sc, 1.2) * 0.08, hold = V.sw.kind === 'tenku' ? 0.3 : 0
      if (k < 0.06) ty = lerp(V.swFrom ?? ty, low, k / 0.06)
      else if (k < 0.06 + hold) { ty = low; tilt = 0.1 }
      else if (k < 0.4 + hold) { const q = (k - 0.06 - hold) / 0.34; ty = lerp(low, ty, ease(q)) + Math.sin(q * Math.PI * 3) * 0.04 * (1 - q) * sc; tilt = Math.sin(q * Math.PI * 2) * 0.15 * sc }
      else V.sw = null }
    else V.swFrom = ty
  } else if (ph === 'serve') {
    const k = S.pt / PH.serve, k1 = clamp(k / 0.45), from = V.serveFrom || base
    tx = lerp(from.x, BOWL_PREP.x, ease(k1)); tz = lerp(from.z, BOWL_PREP.z, ease(k1)); ty = lerp(from.y, BOWL_PREP.y + 0.32, ease(k1)) + Math.sin(k1 * Math.PI) * 0.15
    if (k > 0.45) { flip = clamp((k - 0.45) / 0.15) * 2.2; if (k > 0.55 && tebo.userData.nood.visible) { tebo.userData.nood.visible = false; for (const kk of ['nood', 'chashu', 'nori', 'negi']) bowl.userData[kk].visible = true; const Y = b && b.res ? b.res.Y : 80; bowl.userData.soup.material.color.set(Y < 62 ? '#d8c0a0' : '#c88a3a') } }
    if (k > 0.7) { const q = ease((k - 0.7) / 0.3); bowl.position.set(lerp(BOWL_PREP.x, BOWL_SERVE.x, q), lerp(BOWL_PREP.y, BOWL_SERVE.y, q) + Math.sin(q * Math.PI) * 0.35, lerp(BOWL_PREP.z, BOWL_SERVE.z, q)) }
  } else if (ph === 'fail') { ty = base.y + 0.5; tilt = -0.6 }
  if (ph === 'react' && b && b.res && !b.fail) bowl.position.copy(BOWL_SERVE)
  if (ph === 'shake' && b) { const wet = b.W / 100; tebo.userData.nood.material.emissive.setRGB(0, 0.05 * wet, 0.12 * wet); if (Math.random() < wet * 0.5) spray(tmpV.copy(tebo.position).setY(tebo.position.y - 0.1), null, 1, 0.05, 0) }
  tebo.position.set(lerp(tebo.position.x, tx, 0.5), ph === 'shake' && V.sw ? ty : lerp(tebo.position.y, ty, 0.45), lerp(tebo.position.z, tz, 0.5))
  tebo.rotation.set(tilt + flip, 0, 0)
  // 腕をてぼの柄へ
  owner.updateMatrixWorld(); tebo.updateMatrixWorld()
  const gripsW = (tebo.visible ? gripLocal : [new THREE.Vector3(0, -0.3, 0.3), new THREE.Vector3(0, -0.3, 0.3)]).map((g, i) => tebo.visible ? g.clone().applyMatrix4(tebo.matrixWorld) : tmpV2.set(owner.position.x + (i ? 0.3 : -0.3), 1.2, owner.position.z - 0.1).clone())
  for (let i = 0; i < 2; i++) { const sh = shoulders[i].clone().applyMatrix4(owner.matrixWorld), gp = gripsW[1 - i]; arms[i].position.copy(sh); arms[i].lookAt(gp); arms[i].scale.set(1, 1, Math.max(0.1, sh.distanceTo(gp))); hands[i].position.copy(gp) }
  owner.rotation.x = ph === 'shake' ? -V.raise * 0.08 + (V.sw && V.sw.t < 0.12 ? 0.08 : 0) : 0
  owner.position.y = ph === 'fail' && S.vis.fly && S.vis.fly.kind === 'fly' ? Math.sin(S.pt * 20) * 0.02 : 0
  // 飛んでいく麺・てぼ
  if (V.fly && ph === 'fail') {
    V.fly.t += STEP; const k = clamp(V.fly.t / 0.55), f = V.fly
    const obj = f.kind === 'ceil' ? flyNood : flyTebo
    if (f.kind === 'ceil') { if (k < 1) { obj.position.lerpVectors(f.from, f.to, ease(k)); obj.rotation.x += 0.4 } else if (!f.stuck) { f.stuck = true; obj.visible = false; addStuck(f.to.x, f.to.z) } }
    else { obj.position.lerpVectors(f.from, f.to, k); obj.position.y += Math.sin(k * Math.PI) * 1.1; obj.rotation.x += 0.35; obj.rotation.z += 0.2; if (k >= 1 && !f.hit) { f.hit = true; const c = curC(); c.hat.visible = true; obj.visible = false; setFace(c, 'shock'); c.jump = 0.6; if (!S.quiet) { Snd.sfx('clonk'); Snd.voice(CUSTS[b.cust].pitch, 'hot') } } }
  }
  // しぶき
  for (const d of drops) { if (!d.m.visible) continue; d.life -= STEP; d.v.y -= 9.8 * STEP; d.m.position.addScaledVector(d.v, STEP); if (d.m.position.y < 1.1 && Math.abs(d.m.position.x - POT.x) < 0.3 && Math.abs(d.m.position.z - POT.z) < 0.3) d.m.visible = false; if (d.life <= 0 || d.m.position.y < 0) d.m.visible = false }
  // お客さん
  const c = curC()
  if (c && c.g.visible) {
    let x = SEAT.x, z = SEAT.z
    if (ph === 'arrive') { const k = ease(S.pt / PH.arrive); x = lerp(SEAT.x - 2.4, SEAT.x, k); z = lerp(SEAT.z - 0.6, SEAT.z, k) }
    else if (ph === 'tvin') { x = SEAT.x - 2.4; z = SEAT.z - 0.6 }
    else if (ph === 'leave') { const k = ease(S.pt / PH.leave); x = lerp(SEAT.x, SEAT.x + 2.6, k); z = lerp(SEAT.z, SEAT.z - 0.6, k) }
    custAt(c, x, z)
    if (ph === 'arrive' || ph === 'leave') c.g.position.y = Math.abs(Math.sin(S.pt * 18)) * 0.05
  }
  for (const o of [c, ...sideC]) {
    if (!o || !o.g.visible) continue
    if (o.jump > 0) { o.jump -= STEP; o.g.position.y = Math.abs(Math.sin(o.jump * 18)) * 0.12 * (o.jump / 0.6) } else if (!(o === c && (ph === 'arrive' || ph === 'leave'))) o.g.position.y = 0
    if (o.moodUntil && t > o.moodUntil && o.mood !== 'normal') { o.moodUntil = 0; setFace(o, o.wetM.visible && o !== c ? 'sad' : 'normal') }
    if (o.clapT > 0) { o.clapT -= STEP; const a = Math.abs(Math.sin(o.clapT * 22)) * 0.5; o.armL.rotation.set(-1.4, 0, -0.6 + a); o.armR.rotation.set(-1.4, 0, 0.6 - a) }
    else if (o.mood === 'hot' || o.mood === 'shock') { o.armL.rotation.set(-2.6 + Math.sin(t * 30) * 0.2, 0, -0.3); o.armR.rotation.set(-2.6 - Math.sin(t * 30) * 0.2, 0, 0.3) }
    else if (o.mood === 'mad') { o.armL.rotation.set(-0.9, 0, 0.9); o.armR.rotation.set(-0.9, 0, -0.9) }
    else { o.armL.rotation.set(-0.7, 0, 0.05); o.armR.rotation.set(-0.7, 0, -0.05) }
    o.head.rotation.z = o.mood === 'mad' ? Math.sin(t * 14) * 0.12 : o.mood === 'happy' ? Math.sin(t * 6) * 0.08 : 0
    o.head.rotation.x = o === c && ph === 'boil' ? 0.12 : 0
  }
  if (V.flash > 0) V.flash -= STEP
  if (V.camTilt > 0) V.camTilt -= STEP
  if (V.shake > 0) V.shake -= STEP
}
function botRaise() { const b = S.b; if (!b || !(S.bot || S.mode === 'demo') || S.ph !== 'shake') return 0; const dt = b.botNext - b.shakeT; return b.botTenku && !b.tenku && b.swings === 0 ? clamp(1 - dt / 0.5) : clamp(1 - dt / 0.4) * 0.5 }

// ---------- 入力（指・マウス・キー）
const ptr = { down: false, id: null, refY: 0, minY: 0, tMin: 0, maxY: 0, tMax: 0, lastY: 0, lastT: 0, swinging: false, raise: 0, wind: 0, lifted: false }
const H = () => Math.min(innerHeight, 900)
const VREF = 2.6   // 振り下ろしの平均の速さ（画面の高さ/秒）がこの値で s=1.0
function pushIn(e) { if (S.mode !== 'play' || S.bot) return; S.inq.push(e) }
function onDown(e) {
  if (e.target.closest('button') || S.view !== 'play') return
  Snd.init(); ptr.down = true; ptr.id = e.pointerId; ptr.refY = ptr.minY = ptr.lastY = e.clientY; ptr.tMin = ptr.lastT = e.timeStamp; ptr.swinging = false; ptr.lifted = false; ptr.raise = 0
  try { e.target.setPointerCapture(e.pointerId) } catch (er) {}
}
function onMove(e) {
  if (!ptr.down || e.pointerId !== ptr.id) return
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : []
  for (const ev of (evs.length ? evs : [e])) moveTo(ev.clientY, ev.timeStamp)
}
function moveTo(y, ts) {
  const h = H()
  if (S.ph === 'boil' && !ptr.lifted && ptr.refY - y > 0.06 * h) { ptr.lifted = true; pushIn({ type: 'lift' }); ptr.refY = ptr.minY = y; ptr.tMin = ts }
  if (!ptr.swinging) {
    if (y <= ptr.minY + 0.008 * h) { if (y < ptr.minY) ptr.minY = y; ptr.tMin = ts }
    ptr.raise = clamp((ptr.refY - ptr.minY) / (0.3 * h))
    if (y - ptr.minY > 0.03 * h) { ptr.swinging = true; ptr.wind = ptr.raise; ptr.maxY = y; ptr.tMax = ts }
  } else {
    if (y > ptr.maxY + 0.002 * h) { ptr.maxY = y; ptr.tMax = ts }
    else if (y < ptr.maxY - 0.015 * h || ts - ptr.tMax > 70) emitSwing(y, ts)
  }
  ptr.lastY = y; ptr.lastT = ts
}
function emitSwing(y, ts) {
  const h = H(), dist = (ptr.maxY - ptr.minY) / h, dur = Math.max(0.03, (ptr.tMax - ptr.tMin) / 1000)
  if (S.ph === 'shake' && dist > 0.04) pushIn({ type: 'swing', s: dist / dur / VREF, wind: ptr.wind })
  S.ptrLast = { dist: +dist.toFixed(3), dur: +dur.toFixed(3) }
  ptr.swinging = false; ptr.refY = ptr.minY = y; ptr.tMin = ts; ptr.raise = 0
}
function onUp(e) { if (!ptr.down || (e.pointerId !== undefined && e.pointerId !== ptr.id)) return; if (ptr.swinging) emitSwing(ptr.lastY, ptr.lastT); ptr.down = false; ptr.raise = 0 }
function onKey(e, down) {
  if (S.view !== 'play') return
  const k = e.code
  if (k === 'ArrowUp' || k === 'KeyW') { e.preventDefault(); if (e.repeat) return; pushIn({ type: down ? 'kd' : 'ku' }) }
  else if (k === 'ArrowDown' || k === 'KeyS') { e.preventDefault(); if (down && !e.repeat) pushIn({ type: 'sw' }) }
  else if ((k === 'Space' || k === 'Enter') && down) { e.preventDefault(); if (!e.repeat) pushIn({ type: 'act' }) }
}

// ---------- 画面
function go(v) {
  S.view = v
  for (const [id, n] of [['#vTitle', 'title'], ['#vHow', 'how'], ['#vPlay', 'play'], ['#vResult', 'result']]) $(id).hidden = v !== n
  document.body.classList.remove('party', 'rain', 'dim')
  if (v === 'title' || v === 'how') { Snd.setTrack('title'); Snd.ambient(true); if (S.mode !== 'demo') { S.quiet = true; startGame(undefined, { demo: true }) } }
  if (v === 'play') { Snd.setTrack('play'); Snd.ambient(true); S.quiet = false }
  $('#fx').innerHTML = ''
  if (v === 'result') { Snd.setTrack(null); Snd.ambient(false); document.body.classList.add('dim'); buildResult() }
  if (v === 'how') document.body.classList.add('dim')
  $('#banner').hidden = true; $('#order').hidden = true
  fitCamera()
}
function banner(main, sub, cls) { if (S.mode !== 'play') return; const el = $('#banner'); el.className = 'banner ' + (cls || ''); el.innerHTML = `<b>${main}</b>${sub ? `<small>${sub}</small>` : ''}`; el.hidden = false; S.bannerUntil = S.t + 1.4 }
function popAt3(text, p, cls) { if (S.quiet || S.mode !== 'play') return; tmpV.copy(p).project(camera); const x = (tmpV.x + 1) / 2 * innerWidth, y = (1 - tmpV.y) / 2 * innerHeight; const d = document.createElement('div'); d.className = 'pop ' + (cls || ''); d.textContent = text; d.style.left = clamp(x, 70, innerWidth - 70) + 'px'; d.style.top = clamp(y - 30, 80, innerHeight - 60) + 'px'; $('#fx').appendChild(d); setTimeout(() => d.remove(), 950) }
let orderState = { on: false, line: null, mood: null }
function hudOrder(on, line, mood) { orderState = { on, line, mood }; renderOrder() }
function renderOrder() {
  const el = $('#order'), b = S.b
  if (!orderState.on || S.mode !== 'play' || !b) { el.hidden = true; return }
  const C = CUSTS[b.cust], o = ORDERS[b.order]
  if (orderState.line) { el.className = 'order big ' + (orderState.mood === 'hot' ? 'hot' : orderState.mood === 'wow' || orderState.mood === 'happy' ? 'wow' : ''); el.innerHTML = `<small>${L(C)}</small>`; el.append(orderState.line) }
  else { el.className = 'order'; el.innerHTML = `<small>${L(C)}${S.lang === 'ja' ? ' ・ ' : ' · '}${T('order')}</small>${ON(o, 'say')}` }
  el.hidden = false
}
function zoneOf(s) { return s < S_WEAK ? 0 : s < S_STRONG ? 1 : s < S_SPLASH ? 2 : 3 }
const M_MAX = 1.6
function buildMeter() {
  const zs = [[S_WEAK, '#8a8178'], [S_STRONG, '#4cc46a'], [S_SPLASH, '#f3bf3a'], [S_CEIL, '#ff8a3a'], [M_MAX, '#e0261c']]
  let prev = 0; $('#mBar').innerHTML = zs.map(([v, c]) => { const w = (v - prev) / M_MAX * 100; prev = v; return `<i style="width:${w}%;background:${c}"></i>` }).join('')
  $('#mZ').innerHTML = [T('zWeak'), T('zGood'), T('zStrong'), T('zDanger')].map(s => `<span>${s}</span>`).join('')
}
function hudUpdate() {
  if (S.bannerUntil && S.t > S.bannerUntil) { $('#banner').hidden = true; S.bannerUntil = 0 }
  if (S.view !== 'play') return
  const b = S.b, ph = S.ph
  $('#tLeft').textContent = Math.ceil(S.left); $('#cTime').classList.toggle('low', S.left <= 10 && S.left > 0)
  $('#nBowls').textContent = S.results.filter(r => !r.fail).length
  $('#tvf').hidden = !(b && b.tv && ['tvin', 'arrive', 'order', 'boil', 'lift', 'shake', 'serve', 'fail', 'react'].includes(ph))
  // ゲージ
  const g = $('#gauge'), boil = ph === 'boil' || ph === 'order', shake = ph === 'shake' || ph === 'lift'
  g.style.visibility = b && (boil || shake) ? '' : 'hidden'
  if (b && boil) {
    if (g.dataset.m !== 'boil' + b.order) { g.dataset.m = 'boil' + b.order; g.className = 'gauge'; $('#gLab').textContent = T('boilLabel'); $$('#gTube .mk').forEach(m => m.remove()); for (const [k, o] of Object.entries(ORDERS)) { const m = document.createElement('div'); m.className = 'mk' + (k === b.order ? ' on' : ''); m.style.bottom = (o.t / BOIL_MAX * 100) + '%'; m.innerHTML = `<i>${L(o)}</i>`; $('#gTube').appendChild(m) } }
    $('#gFill').style.height = `calc(${clamp(b.d / BOIL_MAX) * 100}% - 6px)`; $('#gNum').textContent = ''
  } else if (b && shake) {
    if (g.dataset.m !== 'yu') { g.dataset.m = 'yu'; g.className = 'gauge yu'; $('#gLab').textContent = T('yuLabel'); $$('#gTube .mk').forEach(m => m.remove()); const m = document.createElement('div'); m.className = 'mk on'; m.style.bottom = Y_READY + '%'; m.innerHTML = '<i>OK</i>'; $('#gTube').appendChild(m) }
    const Y = 100 - b.W; $('#gFill').style.height = `calc(${clamp(Y / 100) * 100}% - 6px)`; $('#gNum').textContent = Math.round(Y) + '%'
  }
  // 強さメーター
  const showM = b && (ph === 'shake' || ph === 'lift'); $('#meter').hidden = !showM
  if (showM) {
    const live = S.kw.t > 0 ? keyS(S.kw.t) : null, s = live ?? (S.t - S.lastSAt < 1.2 ? S.lastS : null)
    $('#mNeedle').style.visibility = s == null ? 'hidden' : ''; if (s != null) $('#mNeedle').style.left = clamp(s / M_MAX) * 100 + '%'
    $('#mWind').style.width = (ptr.raise > 0.02 ? clamp(ptr.raise) * (TENKU_LO / M_MAX) * 100 : 0) + '%'
  }
  // ボタン
  const act = $('#bAct'), canLift = ph === 'boil', canServe = ph === 'shake'
  act.style.visibility = canLift || canServe ? '' : 'hidden'
  const label = canServe ? T('serve') : T('lift'); if ($('#actTxt').textContent !== label) $('#actTxt').textContent = label
  act.classList.toggle('ready', canServe && 100 - b.W >= Y_READY)
  if (act.dataset.ic !== String(canServe)) act.dataset.ic = String(canServe), act.querySelector('svg').innerHTML = canServe ? '<path d="M3 11h18c0 6-4 9-9 9s-9-3-9-9z"/><path d="M8 7q2-3 4 0t4 0"/>' : '<path d="M12 19V5M6 11l6-6 6 6"/>'
  // チュートリアル
  const tut = $('#tut'), tx = S.tut ? (canLift ? T(isTouch() ? 'tutBoilT' : 'tutBoilM') : canServe ? (100 - b.W >= Y_READY ? T('tutServe') : T(isTouch() ? 'tutShakeT' : 'tutShakeM')) : '') : ''
  tut.hidden = !tx; if (tx && $('#tutTxt').textContent !== tx) $('#tutTxt').textContent = tx
  // 吹き出しはお客さんの頭の上に
  const el = $('#order'), c = curC()
  if (!el.hidden && c) {
    tmpV.set(c.g.position.x, 2.12, c.g.position.z).project(camera)
    const bw = el.offsetWidth / 2 + 8, bh = el.offsetHeight
    let x = (tmpV.x + 1) / 2 * innerWidth, y = (1 - tmpV.y) / 2 * innerHeight
    x = clamp(x, bw, Math.max(bw, innerWidth - bw)); const tr = $('#tut').hidden ? null : $('#tut').getBoundingClientRect(); y = clamp(y, (tr && tr.top < 120 ? tr.bottom + 8 : 58) + bh, innerHeight * 0.7)
    el.style.left = x + 'px'; el.style.top = y + 'px'
  }
}

// ---------- 結果
function stampSvg(r) {
  const col = { gold: '#f3bf3a', red: '#d6372b', gray: '#8f8aa0', black: '#3a8ad8' }[r.tier], txt = L(r)
  const lines = S.lang === 'ja' ? r.sj : txt.split(' ')
  const fs = S.lang === 'ja' ? Math.min(lines.length > 1 ? 22 : 26, 150 / Math.max(...lines.map(l => l.length))) : 15
  return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="rgba(255,244,224,.94)" stroke="${col}" stroke-width="7"/><circle cx="50" cy="50" r="36" fill="none" stroke="${col}" stroke-width="2.5"/>${lines.map((l, i) => `<text x="50" y="${50 + (i - (lines.length - 1) / 2) * fs * 1.1 + fs * 0.35}" text-anchor="middle" font-family="'Zen Maru Gothic','Hiragino Sans',sans-serif" font-weight="900" font-size="${fs}" fill="${col === '#f3bf3a' ? '#a87a08' : col}">${l}</text>`).join('')}</svg>`
}
function pickVoices(R) {
  const arr = [...R.bowls]; if (!arr.length) return []
  const out = [], add = r => { if (r && !out.includes(r) && out.length < 3) out.push(r) }
  add(arr.find(r => r.fail === 'fly') || arr.find(r => r.fail === 'ceil')); add(arr.find(r => r.splash)); add([...arr].sort((a, b) => b.score - a.score)[0]); add(arr.find(r => r.kind === 'tenku')); add([...arr].sort((a, b) => a.score - b.score)[0])
  return out
}
function buildResult() {
  const R = S.result; if (!R) return
  const st = (k, v, u, cls = '') => `<div class="st ${cls}"><span>${T(k)}</span><b>${v}<small>${u}</small></b></div>`
  $('#stats').innerHTML = st('resServed', R.served, T('cups')) + st('resYu', R.avgY, T('pct')) + st('resSplash', R.splash, T('times'), R.splash ? 'bad' : '') + st('resTenku', R.tenku, T('times')) + st('resScore', R.total, T('pts'), 'wide')
  $('#tvHead').hidden = !R.tv; if (R.tv) $('#tvHeadTxt').textContent = T(R.tv === 'ok' ? 'tvHeadOk' : R.tv === 'ng' ? 'tvHeadNg' : 'tvHeadNone')
  $('#voices').innerHTML = pickVoices(R).map(r => `<div class="vc"><i class="fc" style="background-image:url(${faceUrl(r.cust, r.mood)})"></i><p><small>${L(CUSTS[r.cust])}</small>${lineFor(r)}</p></div>`).join('')
  $('#rank').className = 'rank tier-' + R.rank.tier; $('#stamp').innerHTML = stampSvg(R.rank)
  $('#rankN').textContent = L(R.rank); $('#rankT').textContent = S.lang === 'ja' ? R.rank.cja : R.rank.cen
  $('#saveTxt').textContent = canShareFiles() ? T('share') : T('save')
  if (S.stage < 99) { $('#skip').hidden = false; $('.rBtns').style.visibility = 'hidden' }
  applyStage()
}
function lineFor(r) { const arr = LINES[r.kind][S.lang]; return fmt(arr[Math.max(0, r.lineIdx)] || arr[0], { o: L(ORDERS[r.order]) }) }
const STAGES = [0.3, 0.65, 1.0, 1.35, 1.8, 2.5, 3.1, 3.3, 3.5, 4.1]
function applyStage() {
  const n = S.stage, sts = $$('#stats .st'), vcs = $$('#voices .vc')
  sts.forEach((el, i) => el.classList.toggle('on', n > i))
  $('#tvHead').classList.toggle('on', n > 5)
  vcs.forEach((el, i) => el.classList.toggle('on', n > 6 + i))
  const done = n >= STAGES.length
  $('#rank').classList.toggle('on', done); $('.rBtns').style.visibility = done ? '' : 'hidden'; $('#skip').hidden = done
}
function revealUpdate() {
  if (!S.result || S.stage >= STAGES.length) return
  S.rt += STEP
  while (S.stage < STAGES.length && S.rt >= STAGES[S.stage]) {
    S.stage++; applyStage(); const R = S.result
    if (S.quiet) continue
    if (S.stage <= 4) Snd.sfx('ding', 4 + S.stage)
    if (S.stage === 5) Snd.sfx('roll', 1)
    if (S.stage === 6 && R.tv) Snd.sfx(R.tv === 'ok' ? 'tv' : 'tvng')
    if (S.stage === STAGES.length) finishReveal()
  }
}
function finishReveal() {
  const R = S.result, tier = R.rank.tier
  document.body.classList.add(tier === 'gold' ? 'party' : tier === 'black' || tier === 'gray' ? 'rain' : 'dim')
  if (S.quiet) return
  Snd.sfx('slam'); Snd.sfx(tier === 'gold' ? 'cheer' : tier === 'red' ? 'applause' : 'boo', tier === 'red' ? 0.6 : 1)
  Snd.setTrack(tier === 'gold' || tier === 'red' ? 'win' : 'sad')
}
function skipReveal() { if (S.view !== 'result' || S.stage >= STAGES.length) return; S.rt = 9; S.stage = STAGES.length - 1; revealUpdate(); if (S.stage >= STAGES.length && S.quiet) finishReveal() }

// 結果を1枚の画像に（1080x1350）
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath() }
function fitText(x, s, cx, cy, maxW) { let sz = parseFloat(x.font.match(/(\d+)px/)[1]); const pre = x.font.slice(0, x.font.indexOf(sz + 'px')), fam = x.font.slice(x.font.indexOf('px') + 2); while (x.measureText(s).width > maxW && sz > 12) { sz -= 2; x.font = `${pre}${sz}px${fam}` } x.fillText(s, cx, cy) }
const imgCache = {}
function loadImg(src) { return imgCache[src] || (imgCache[src] = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src })) }
function snapScene(w, h) {
  // 3D の店内を撮る（天井の麺・ぬれた客が入る角度）
  const keep = { p: camera.position.clone(), q: camera.quaternion.clone(), a: camera.aspect, v: camera.view ? { ...camera.view } : null }
  const W0 = renderer.domElement.width, H0 = renderer.domElement.height, pr = renderer.getPixelRatio()
  renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.clearViewOffset(); camera.aspect = w / h; camera.fov = 50; camera.updateProjectionMatrix()
  camera.fov = 58; camera.updateProjectionMatrix(); camera.position.set(-1.25, 2.1, 1.75); camera.lookAt(-0.15, 2.2, -1.6); camera.updateMatrixWorld()
  renderer.render(scene, camera)
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(renderer.domElement, 0, 0, w, h)
  renderer.setPixelRatio(pr); renderer.setSize(W0 / pr, H0 / pr, false); camera.position.copy(keep.p); camera.quaternion.copy(keep.q); fitCamera()
  return c
}
async function drawCard() {
  const R = S.result, ja = S.lang === 'ja'
  try { await Promise.all([document.fonts.load(`40px 'Dela Gothic One'`), document.fonts.load(`900 30px 'Zen Maru Gothic'`)]) } catch (e) {}
  const vs = pickVoices(R), faces = await Promise.all(vs.map(r => loadImg(faceUrl(r.cust, r.mood))))
  const shot = snapScene(1000, 470)
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d')
  const DISP = `'Dela Gothic One','Zen Maru Gothic','Hiragino Sans',sans-serif`, BODY = `'Zen Maru Gothic','Hiragino Sans',sans-serif`
  const bg = x.createLinearGradient(0, 0, 0, 1350); bg.addColorStop(0, '#3a2216'); bg.addColorStop(1, '#170d09'); x.fillStyle = bg; x.fillRect(0, 0, 1080, 1350)
  for (const [cx, cy] of [[80, 60], [1000, 60]]) { const g = x.createRadialGradient(cx, cy, 10, cx, cy, 260); g.addColorStop(0, 'rgba(255,120,60,.4)'); g.addColorStop(1, 'rgba(255,120,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 1080, 400) }
  // のれん
  const nx = 150, nw = 780; x.fillStyle = '#6a4420'; x.fillRect(nx - 20, 28, nw + 40, 16)
  for (let i = 0; i < 2; i++) { x.fillStyle = '#23305e'; roundRect(x, nx + i * (nw / 2 + 6), 44, nw / 2 - 6, 140, 10); x.fill() }
  x.textAlign = 'center'; x.fillStyle = '#fff4e0'; x.font = `900 28px ${BODY}`; x.fillText(T('titleA'), nx + nw / 4, 90)
  x.font = `${ja ? 76 : 50}px ${DISP}`; x.fillStyle = '#f3bf3a'; fitText(x, T('titleB'), nx + nw / 4, ja ? 166 : 160, nw / 2 - 30); x.font = `${ja ? 76 : 50}px ${DISP}`; x.fillStyle = '#fff'; fitText(x, T('titleC'), nx + nw * 3 / 4, ja ? 166 : 160, nw / 2 - 30)
  // 店内の写真
  x.save(); roundRect(x, 40, 210, 1000, 470, 24); x.clip(); x.drawImage(shot, 40, 210); x.restore()
  x.strokeStyle = '#fff4e0'; x.lineWidth = 6; roundRect(x, 40, 210, 1000, 470, 24); x.stroke()
  if (R.tv) { x.fillStyle = '#e0261c'; roundRect(x, 64, 234, 230, 46, 8); x.fill(); x.fillStyle = '#fff'; x.font = `900 26px ${BODY}`; x.textAlign = 'left'; fitText(x, T('tvBadge'), 80, 267, 200)
    x.fillStyle = 'rgba(255,255,255,.95)'; x.fillRect(40, 610, 1000, 70); x.fillStyle = '#e0261c'; x.fillRect(40, 610, 14, 70); x.fillStyle = '#111'; x.font = `900 32px ${BODY}`; fitText(x, T(R.tv === 'ok' ? 'tvHeadOk' : R.tv === 'ng' ? 'tvHeadNg' : 'tvHeadNone'), 74, 656, 940) }
  // 称号のハンコ
  const col = { gold: '#f3bf3a', red: '#d6372b', gray: '#8f8aa0', black: '#3a8ad8' }[R.rank.tier]
  x.save(); x.translate(200, 830); x.rotate(-0.2); x.fillStyle = '#fff4e0'; x.beginPath(); x.arc(0, 0, 118, 0, 7); x.fill(); x.strokeStyle = col; x.lineWidth = 14; x.stroke(); x.lineWidth = 4; x.beginPath(); x.arc(0, 0, 96, 0, 7); x.stroke()
  x.fillStyle = col === '#f3bf3a' ? '#a87a08' : col; x.textAlign = 'center'; x.textBaseline = 'middle'
  const rn = L(R.rank), parts = ja ? R.rank.sj : rn.split(' ')
  parts.forEach((p, i) => { x.font = `900 ${ja ? 50 : 34}px ${BODY}`; fitText(x, p, 0, (i - (parts.length - 1) / 2) * 56, 170) }); x.restore()
  x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.fillStyle = '#fff4e0'; x.font = `900 30px ${BODY}`; x.fillText(T('resRank'), 360, 760)
  x.font = `${ja ? 78 : 60}px ${DISP}`; x.fillStyle = R.rank.tier === 'gold' ? '#f3bf3a' : R.rank.tier === 'black' ? '#7ec8ff' : '#fff'; fitText(x, rn, 356, 850, 680)
  x.font = `900 32px ${BODY}`; x.fillStyle = '#f3bf3a'; fitText(x, '「' + (ja ? R.rank.cja : R.rank.cen) + '」', 360, 905, 680)
  // 数字
  const stats = [[T('resServed'), R.served + T('cups')], [T('resYu'), R.avgY + '%'], [T('resSplash'), R.splash + T('times')], [T('resScore'), R.total + T('pts')]]
  stats.forEach(([k, v], i) => { const X = 40 + i * 253, Y = 970; x.fillStyle = 'rgba(255,244,224,.1)'; roundRect(x, X, Y, 240, 120, 18); x.fill(); x.fillStyle = '#e8d8c0'; x.font = `900 24px ${BODY}`; x.textAlign = 'center'; fitText(x, k, X + 120, Y + 40, 220); x.fillStyle = i === 2 && R.splash ? '#7ec8ff' : i === 3 ? '#f3bf3a' : '#fff'; x.font = `52px ${DISP}`; fitText(x, v, X + 120, Y + 100, 220) })
  // 客の声
  vs.forEach((r, i) => { const Y = 1120 + i * 66; if (faces[i]) { x.save(); x.beginPath(); x.arc(76, Y + 26, 28, 0, 7); x.clip(); x.drawImage(faces[i], 48, Y - 2, 56, 56); x.restore() } x.fillStyle = '#fff4e0'; roundRect(x, 118, Y, 920, 54, 14); x.fill(); x.fillStyle = '#86190f'; x.font = `900 20px ${BODY}`; x.textAlign = 'left'; x.fillText(L(CUSTS[r.cust]), 136, Y + 35); x.fillStyle = '#26160e'; x.font = `900 26px ${BODY}`; fitText(x, lineFor(r), 270, Y + 37, 750) })
  x.textAlign = 'right'; x.fillStyle = 'rgba(255,244,224,.7)'; x.font = `900 24px ${BODY}`; x.fillText(T('cardFoot'), 1040, 1336)
  return c
}
// Xでポスト（クリックの中で同期的に開く。URL は url パラメータで渡す）
const GAME_URL = 'https://tom3games.github.io/yugiri-master/'
function xText() { const R = S.result; if (!R) return ''; return fmt(T('xText'), { rank: L(R.rank), n: R.served, p: R.total }) + ' ' + T('xTag') }
function xIntent() { return 'https://x.com/intent/post?text=' + encodeURIComponent(xText()) + '&url=' + encodeURIComponent(GAME_URL) }
function postX() { if (!S.result) return; window.open(xIntent(), '_blank', 'noopener') }
const canShareFiles = () => { try { return !!(navigator.canShare && navigator.share && isTouch() && navigator.canShare({ files: [new File([new Blob(['x'])], 'a.png', { type: 'image/png' })] })) } catch (e) { return false } }
async function cardBlob() { const c = await drawCard(); return new Promise(r => c.toBlob(r, 'image/png')) }
async function saveImage() {
  const blob = await cardBlob(); if (!blob) return 'fail'
  const file = new File([blob], 'yugiri-master.png', { type: 'image/png' })
  if (canShareFiles()) {
    try { await navigator.share({ files: [file], title: T('title'), text: fmt(T('shareText'), { rank: L(S.result.rank) }) + ' https://tom3games.github.io/yugiri-master/' }); toast(T('shared')); return 'shared' }
    catch (e) { if (e && e.name === 'AbortError') return 'abort' }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'yugiri-master.png'; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast(T('saved')); return 'download'
}
function toast(s) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = s; document.body.appendChild(d); setTimeout(() => d.remove(), 1600) }

// ---------- カメラ（店主の斜め後ろから。画面の形に合わせて寄り引きを決める）
const camBase = { p: new THREE.Vector3(), l: new THREE.Vector3() }
function fitCamera() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false)
  const land = w > h, short = land && h < 560, v = new THREE.Vector3()
  camera.fov = land ? 44 : 52; camera.aspect = w / h; camera.clearViewOffset(); camera.updateProjectionMatrix()
  let m, pts, dir, Lk
  if (S.view === 'play') {
    m = short ? { t: 56, b: 14, l: 92, r: 210 } : land ? { t: 70, b: 150, l: 100, r: 30 } : { t: 140, b: 168, l: 84, r: 14 }
    dir = new THREE.Vector3(land ? -0.42 : -0.2, land ? 0.4 : 0.85, 1).normalize(); Lk = new THREE.Vector3(-0.3, 1.4, -1.05)
    pts = [[POT.x - 0.3, RIM_Y, POT.z + 0.3], [POT.x + 0.3, RIM_Y, POT.z + 0.3], [POT.x - 0.3, RIM_Y, POT.z - 0.3], [POT.x, 2.2, POT.z], [SEAT.x - 0.3, 1.92, SEAT.z], [SEAT.x + 0.3, 1.92, SEAT.z], [SEAT.x, 1.15, SEAT.z + 0.5]]
    pts.push(land ? [0.3, 1.95, 0.32] : [0.2, 1.9, 0.32, 1])
  } else if (S.view === 'result') {
    m = { t: 20, b: 20, l: 20, r: 20 }; dir = new THREE.Vector3(-0.4, 0.3, 1).normalize(); Lk = new THREE.Vector3(-0.3, 1.7, -1.4)
    pts = [[POT.x, RIM_Y, POT.z], [SEAT.x - 1.3, 1.9, SEAT.z], [SEAT.x + 1.3, 1.9, SEAT.z]]
  } else {
    const side = short
    m = side ? { t: 50, b: 20, l: 20, r: w * 0.5 } : land ? { t: h * 0.3, b: h * 0.28, l: 30, r: 30 } : { t: h * 0.33, b: h * 0.36, l: 10, r: 10 }
    dir = new THREE.Vector3(-0.45, 0.38, 1).normalize(); Lk = new THREE.Vector3(-0.2, 1.4, -1.2)
    pts = [[POT.x - 0.3, RIM_Y, POT.z], [SEAT.x - 1.2, 1.9, SEAT.z], [SEAT.x + 1.25, 1.9, SEAT.z], [0.12, 1.85, 0.32]]
  }
  const cx = (m.l + (w - m.r)) / 2, cy = (m.t + (h - m.b)) / 2
  camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h); camera.updateProjectionMatrix()
  const top = 1 - 2 * m.t / h, bot = -1 + 2 * m.b / h, lft = -1 + 2 * m.l / w, rgt = 1 - 2 * m.r / w
  let d = 1.5
  for (let tries = 0; tries < 6; tries++) {
    for (d = 1.5; d < 16; d += 0.04) { camera.position.copy(Lk).addScaledVector(dir, d); camera.lookAt(Lk); camera.updateMatrixWorld(); if (pts.every(p => { v.set(p[0], p[1], p[2]).project(camera); return p[3] ? Math.abs(v.x) < 1.2 && v.y > -1.1 && v.y < 1 && v.z < 1 : v.x > lft && v.x < rgt && v.y < top && v.y > bot && v.z < 1 })) break }
    if (camera.position.y < CEIL_Y - 0.25 && camera.position.z < 3.2) break
    camera.fov += 5; camera.updateProjectionMatrix()
  }
  camBase.p.copy(camera.position); camBase.l.copy(Lk); S.camD = Math.round(d * 100) / 100
}
function applyCamFx() {
  const V = S.vis; camera.position.copy(camBase.p); const look = tmpV2.copy(camBase.l)
  if (V.camTilt > 0) { const k = Math.sin(clamp(V.camTilt / 1.3) * Math.PI); look.y += k * 1.6; look.z += k * 0.2 }
  if (V.shake > 0) { camera.position.x += (Math.random() - 0.5) * V.shake * 0.15; camera.position.y += (Math.random() - 0.5) * V.shake * 0.15 }
  if (V.flash > 0 && S.view === 'play') camera.position.addScaledVector(tmpV.copy(look).sub(camera.position).normalize(), V.flash * 0.6)
  camera.lookAt(look)
}

// ---------- ループ（固定60Hz。時計は performance.now）
let acc = 0, lastT = performance.now(), paused = false, fpsN = 0, fpsT = performance.now(), fps = 0
function render() { applyCamFx(); renderer.render(scene, camera) }
function frame() {
  const now = performance.now(); let dt = (now - lastT) / 1000; lastT = now; if (dt > 0.25) dt = 0.25
  if (!paused) { acc += dt; let n = 0; while (acc >= STEP && n < 8) { update(); acc -= STEP; n++ } if (n === 8) acc = 0 }
  hudUpdate(); render(); Snd.tick()
  fpsN++; if (now - fpsT > 1000) { fps = fpsN * 1000 / (now - fpsT); fpsN = 0; fpsT = now }
  requestAnimationFrame(frame)
}

// ---------- 言語
function applyLang() {
  document.documentElement.lang = S.lang
  for (const el of $$('[data-t]')) { const v = TXT[S.lang][el.dataset.t]; if (v !== undefined) el.textContent = v }
  const touch = isTouch()
  $('#how1').innerHTML = T(touch ? 'how1T' : 'how1M'); $('#how2').innerHTML = T(touch ? 'how2T' : 'how2M'); $('#how3').innerHTML = T('how3'); $('#how4').innerHTML = T('how4')
  $('#langTxt').textContent = T('lang')
  $('#logoB').innerHTML = `<span>${T('titleB')}</span>`; $('#logoC').textContent = T('titleC'); $('#noren').classList.toggle('en', S.lang === 'en')
  document.title = T('title')
  buildMeter(); renderOrder()
  redrawTex()
  $('#gauge').dataset.m = ''
  if (S.view === 'result' && S.result) buildResult()
}
function redrawTex() { const x = norenTex.image.getContext('2d'); drawNoren(x, 512, 256); noren.children.forEach(m => { m.material.map.image = norenTex.image; m.material.map.needsUpdate = true }); drawMenu(menuTex.image.getContext('2d'), 512, 256); menuTex.needsUpdate = true }

// ---------- 起動
function boot() {
  try { const l = localStorage.getItem('ym.lang'); S.lang = l || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en') } catch (e) { S.lang = (navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en' }
  try { if (localStorage.getItem('ym.mute') === '1') { Snd.muted = true; $('#icOn').hidden = true; $('#icOff').hidden = false } } catch (e) {}
  for (const el of $$('[data-face]')) el.style.backgroundImage = `url(${faceUrl(el.dataset.face)})`
  applyLang()
  const on = (id, fn) => $(id).addEventListener('click', e => { Snd.init(); fn(e) })
  on('#bStart', () => { Snd.sfx('tap'); startGame() })
  on('#bHowStart', () => { Snd.sfx('tap'); startGame() })
  on('#bHow', () => { Snd.sfx('tap'); go('how') })
  on('#bHowBack', () => { Snd.sfx('tap'); go('title') })
  on('#bAgain', () => { Snd.sfx('tap'); startGame() })
  on('#bSave', () => saveImage())
  on('#bX', () => { Snd.sfx('tap'); postX() })
  on('#bTitle', () => { Snd.sfx('tap'); S.mode = 'off'; go('title') })
  on('#bAct', () => pushIn({ type: 'act' }))
  on('#bLang', () => { S.lang = S.lang === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('ym.lang', S.lang) } catch (e) {} applyLang() })
  on('#bMute', () => { Snd.setMute(!Snd.muted); $('#icOn').hidden = Snd.muted; $('#icOff').hidden = !Snd.muted; try { localStorage.setItem('ym.mute', Snd.muted ? '1' : '0') } catch (e) {} })
  const vp = $('#vPlay')
  vp.addEventListener('pointerdown', onDown); vp.addEventListener('pointermove', onMove)
  for (const n of ['pointerup', 'pointercancel']) vp.addEventListener(n, onUp)
  $('#vResult').addEventListener('pointerdown', e => { if (!e.target.closest('button')) skipReveal() })
  window.addEventListener('keydown', e => onKey(e, true)); window.addEventListener('keyup', e => onKey(e, false))
  window.addEventListener('resize', () => fitCamera())
  document.addEventListener('visibilitychange', () => { lastT = performance.now(); acc = 0 })
  document.fonts?.ready.then(() => redrawTex())
  S.mode = 'off'; go('title')
  requestAnimationFrame(frame)
  window.__ymReady = true
}

// 検証用の窓口
window.ym = {
  S, ORDERS, RANKS, BOTS, custs, startGame, go, drawCard, saveImage, xText, xIntent, postX, GAME_URL, fitCamera, skipReveal, cardBlob, Snd, record, keyS,
  setLang: l => { S.lang = l; applyLang() },
  project: (x, y, z) => { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x + 1) / 2 * innerWidth, y: (1 - tmpV.y) / 2 * innerHeight, z: tmpV.z } },
  stuckN: () => stuck.length,
  dbg: {
    pause: v => { paused = v; acc = 0; lastT = performance.now() },
    step: n => { for (let i = 0; i < n; i++) update(); hudUpdate() },
    render: () => render(),
    autoplay: m => { S.bot = m },
    fps: () => fps,
    quiet: v => { S.quiet = v },
    push: e => S.inq.push(e),
    cam: (p, l, fov) => { camera.clearViewOffset(); if (fov) camera.fov = fov; camera.updateProjectionMatrix(); camBase.p.set(...p); camBase.l.set(...l) },
    // 目的の場面まで進める（ボットがいない時は、注文どおりの硬さで麺を上げる）
    toPhase: (ph, max = 60 * 40) => { let k = 0; while (S.ph !== ph && k++ < max) { if (S.ph === 'boil' && ph !== 'boil' && !S.bot && S.b.d >= S.b.target) S.inq.push({ type: 'lift' }); update() } hudUpdate(); return S.ph },
  },
}
boot()
