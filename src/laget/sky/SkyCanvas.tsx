import { useEffect, useRef } from 'react'
import data from './skyData.json'
import { HERMANUS, galacticToEquatorial, lstDeg, project, starColor, toHorizontal, type View } from './astro'

// Night sky over Hermanus, drawn on a canvas. Stars, constellation figures and the Magellanic Clouds are
// where the catalogue and the date put them. The Milky Way is only "felt": a soft band laid along the
// galactic plane's real position (brightest towards the galactic centre), textured from random blobs.

export interface SkyPreset {
  az: number
  alt: number
  fov: number
}

/** Where the camera looks. The pole preset is the one the household asked for. */
export const SKY_PRESETS: Record<'pol' | 'zenit' | 'norr', SkyPreset & { label: string }> = {
  pol: { label: 'Mot sydpolen', az: 180, alt: 38, fov: 105 },
  zenit: { label: 'Rakt upp', az: 180, alt: 90, fov: 120 },
  norr: { label: 'Mot norr', az: 0, alt: 35, fov: 105 },
}

interface Props {
  /** Time speed: 1 = the sky as it is now; 300 = a turn around the pole in a few minutes. */
  speed: number
  preset: SkyPreset
  /** Constellation figures and name labels (the sky page); off for the quiet background. */
  labels?: boolean
  /** Called about once a second with the sky's current (possibly fast-forwarded) time. */
  onTime?: (ms: number) => void
  className?: string
}

const STARS = data.stars as number[]
const LINES = data.lines as number[][][]

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Blob {
  ra: number
  dec: number
  /** Angular radius in radians. */
  size: number
  alpha: number
  tint: 'warm' | 'cool' | 'rose'
}

/** The made-up Milky Way: blobs along the real galactic plane, thicker and brighter towards l = 0. */
function buildMilkyWay(): { blobs: Blob[]; dust: { ra: number; dec: number; a: number }[] } {
  const r = rng(26)
  const gauss = () => (r() + r() + r() + r() - 2) / 0.58
  const blobs: Blob[] = []
  for (let i = 0; i < 340; i++) {
    const l = r() * 360
    const toCentre = 0.5 + 0.5 * Math.cos((l * Math.PI) / 180) // 1 at the galactic centre, 0 opposite it
    const b = gauss() * (3 + 5 * toCentre)
    const { ra, dec } = galacticToEquatorial(l, b)
    blobs.push({
      ra,
      dec,
      size: ((5 + r() * 9 + toCentre * 6) * Math.PI) / 180,
      alpha: 0.012 + 0.02 * toCentre + r() * 0.008,
      tint: r() < 0.18 ? 'rose' : r() < 0.55 ? 'warm' : 'cool',
    })
  }
  const dust: { ra: number; dec: number; a: number }[] = []
  for (let i = 0; i < 1100; i++) {
    const l = r() * 360
    const toCentre = 0.5 + 0.5 * Math.cos((l * Math.PI) / 180)
    const { ra, dec } = galacticToEquatorial(l, gauss() * (2.5 + 5 * toCentre))
    dust.push({ ra, dec, a: 0.12 + r() * 0.3 })
  }
  return { blobs, dust }
}

/** Real objects that are drawn as glows: name, position, angular radius (°), tint, strength. */
const GLOWS = [
  { name: 'Stora Magellanska molnet', ra: 80.9, dec: -69.8, size: 4.2, tint: 'cool' as const, alpha: 0.2 },
  { name: 'Lilla Magellanska molnet', ra: 13.2, dec: -72.8, size: 2.6, tint: 'cool' as const, alpha: 0.17 },
  { name: 'Carinanebulosan', ra: 161.3, dec: -59.9, size: 2.4, tint: 'rose' as const, alpha: 0.2 },
  { name: 'Omega Centauri', ra: 201.7, dec: -47.5, size: 1.2, tint: 'warm' as const, alpha: 0.2 },
]

/** Labels on the sky page. */
const LABELS = [
  { text: 'Södra korset', ra: 187.8, dec: -60.0 },
  { text: 'Alfa Centauri', ra: 219.9, dec: -60.8 },
  { text: 'Canopus', ra: 95.99, dec: -52.7 },
  { text: 'Achernar', ra: 24.4, dec: -57.2 },
  { text: 'Stora Magellanska molnet', ra: 80.9, dec: -69.8 },
  { text: 'Lilla Magellanska molnet', ra: 13.2, dec: -72.8 },
  { text: 'Carinanebulosan', ra: 161.3, dec: -59.9 },
  { text: 'Antares', ra: 247.35, dec: -26.43 },
  { text: 'Fomalhaut', ra: 344.4, dec: -29.6 },
]

function sprite(rgb: [number, number, number]): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, `rgba(${rgb.join(',')},1)`)
  grad.addColorStop(0.35, `rgba(${rgb.join(',')},0.45)`)
  grad.addColorStop(1, `rgba(${rgb.join(',')},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return c
}

export default function SkyCanvas({ speed, preset, labels = false, onTime, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef({ speed, preset, labels, onTime })
  live.current = { speed, preset, labels, onTime }
  // Virtual time carries over between speed changes, so switching speed never makes the sky jump.
  const clock = useRef({ ms: Date.now(), last: performance.now() })

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sprites = { warm: sprite([255, 236, 205]), cool: sprite([190, 210, 255]), rose: sprite([255, 170, 205]) }
    const { blobs, dust } = buildMilkyWay()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let timer = 0
    let lastReport = 0
    let stopped = false

    const frame = () => {
      if (stopped) return
      const { speed: sp, preset: pr, labels: lab, onTime: report } = live.current
      const now = performance.now()
      const effective = reduce ? 1 : sp
      clock.current.ms += (now - clock.current.last) * effective
      clock.current.last = now
      const ms = clock.current.ms

      const dpr = Math.min(window.devicePixelRatio || 1, lab ? 2 : 1.5)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const view: View = { az: pr.az, alt: pr.alt, fov: pr.fov, width: w, height: h }
      const lst = lstDeg(ms, HERMANUS.lon)

      // Sky: near-black, a little lighter towards the horizon (airglow).
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, '#01020a')
      bg.addColorStop(0.7, '#050a1c')
      bg.addColorStop(1, '#0d1630')
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Milky Way band, nebulae and the Clouds: soft glows added on top of each other.
      ctx.globalCompositeOperation = 'lighter'
      const glow = (ra: number, dec: number, size: number, alpha: number, tint: keyof typeof sprites) => {
        const hz = toHorizontal(ra, dec, HERMANUS.lat, lst)
        if (hz.alt < -8) return
        const p = project(hz, view)
        if (!p.visible) return
        const r = p.scale * size * 2
        if (p.x < -r || p.x > w + r || p.y < -r || p.y > h + r) return
        ctx.globalAlpha = alpha
        ctx.drawImage(sprites[tint], p.x - r, p.y - r, r * 2, r * 2)
      }
      for (const b of blobs) glow(b.ra, b.dec, b.size, b.alpha, b.tint)
      for (const g of GLOWS) glow(g.ra, g.dec, (g.size * Math.PI) / 180, g.alpha, g.tint)

      // Dust: faint grains along the band.
      ctx.globalAlpha = 1
      ctx.fillStyle = '#cfd8ff'
      for (const d of dust) {
        const hz = toHorizontal(d.ra, d.dec, HERMANUS.lat, lst)
        if (hz.alt < 0) continue
        const p = project(hz, view)
        if (!p.visible) continue
        ctx.globalAlpha = d.a
        ctx.fillRect(p.x, p.y, 0.8, 0.8)
      }

      // Constellation figures (sky page only).
      ctx.globalCompositeOperation = 'source-over'
      if (lab) {
        ctx.globalAlpha = 0.28
        ctx.strokeStyle = '#8fa8ff'
        ctx.lineWidth = 0.7
        ctx.beginPath()
        for (const stroke of LINES) {
          let pen = false
          for (const [ra, dec] of stroke) {
            const hz = toHorizontal(ra, dec, HERMANUS.lat, lst)
            const p = project(hz, view)
            if (hz.alt < 0 || !p.visible) {
              pen = false
              continue
            }
            if (pen) ctx.lineTo(p.x, p.y)
            else ctx.moveTo(p.x, p.y)
            pen = true
          }
        }
        ctx.stroke()
      }

      // Stars.
      for (let i = 0; i < STARS.length; i += 4) {
        const mag = STARS[i + 2] / 10
        const hz = toHorizontal(STARS[i], STARS[i + 1], HERMANUS.lat, lst)
        if (hz.alt < 0) continue
        const p = project(hz, view)
        if (!p.visible || p.x < -4 || p.x > w + 4 || p.y < -4 || p.y > h + 4) continue
        const [cr, cg, cb] = starColor(STARS[i + 3])
        const rad = Math.max(0.45, 2.3 - 0.36 * mag)
        ctx.globalAlpha = Math.max(0.3, Math.min(1, 0.4 + (6.2 - mag) * 0.14))
        ctx.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2)
        ctx.fill()
        if (mag < 1.6) {
          ctx.globalAlpha = 0.18
          ctx.beginPath()
          ctx.arc(p.x, p.y, rad * 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1

      // The south celestial pole, marked on the sky page.
      if (lab) {
        const pole = project({ alt: -HERMANUS.lat, az: 180 }, view)
        ctx.strokeStyle = 'rgba(255,200,120,0.8)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(pole.x, pole.y, 7, 0, Math.PI * 2)
        ctx.moveTo(pole.x - 12, pole.y)
        ctx.lineTo(pole.x + 12, pole.y)
        ctx.moveTo(pole.x, pole.y - 12)
        ctx.lineTo(pole.x, pole.y + 12)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,214,150,0.95)'
        ctx.font = '12px Georgia, serif'
        ctx.fillText('Sydpolen', pole.x + 12, pole.y - 10)
        ctx.fillStyle = 'rgba(210,222,255,0.85)'
        for (const l of LABELS) {
          const hz = toHorizontal(l.ra, l.dec, HERMANUS.lat, lst)
          if (hz.alt < 3) continue
          const p = project(hz, view)
          if (!p.visible || p.x < 0 || p.x > w - 10 || p.y < 10 || p.y > h - 6) continue
          ctx.fillText(l.text, p.x + 6, p.y - 6)
        }
      }

      // Ground: a low, uneven horizon with a faint glow above it.
      const edge = (offset: number) => {
        const pts: [number, number][] = []
        for (let az = view.az - 150; az <= view.az + 150; az += 3) {
          const hill = 1.1 + 0.9 * Math.sin(az * 0.21) + 0.6 * Math.sin(az * 0.63 + 1) + 0.5 * Math.sin(az * 1.7)
          const p = project({ az: ((az % 360) + 360) % 360, alt: Math.max(0, hill) * 0.6 + offset }, view)
          if (p.visible) pts.push([p.x, p.y])
        }
        return pts
      }
      const fillBelow = (pts: [number, number][], style: string | CanvasGradient) => {
        if (pts.length < 2) return
        ctx.beginPath()
        ctx.moveTo(pts[0][0], h + 40)
        for (const [x, y] of pts) ctx.lineTo(x, y)
        ctx.lineTo(pts[pts.length - 1][0], h + 40)
        ctx.closePath()
        ctx.fillStyle = style
        ctx.fill()
      }
      ctx.globalAlpha = 1
      const haze = ctx.createLinearGradient(0, h * 0.6, 0, h)
      haze.addColorStop(0, 'rgba(60,90,160,0)')
      haze.addColorStop(1, 'rgba(60,90,160,0.18)')
      fillBelow(edge(2.2), haze)
      fillBelow(edge(0), '#010208')

      if (report && now - lastReport > 900) {
        lastReport = now
        report(ms)
      }
      if (effective === 1) timer = window.setTimeout(() => (raf = requestAnimationFrame(frame)), 1000)
      else raf = requestAnimationFrame(frame)
    }

    const onVis = () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      clock.current.last = performance.now()
      if (!document.hidden) frame()
    }
    document.addEventListener('visibilitychange', onVis)
    frame()
    // A change of speed or view should show at once, not after the next tick.
    const redraw = () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      frame()
    }
    window.addEventListener('resize', redraw)
    window.addEventListener('laget-sky-redraw', redraw)
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('resize', redraw)
      window.removeEventListener('laget-sky-redraw', redraw)
    }
  }, [])

  // Preset or speed changed: redraw right away.
  useEffect(() => {
    window.dispatchEvent(new Event('laget-sky-redraw'))
  }, [speed, preset.az, preset.alt, preset.fov])

  return <canvas ref={ref} className={className} />
}
