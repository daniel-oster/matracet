import { describe, expect, it } from 'vitest'
import { HERMANUS, galacticToEquatorial, gmstDeg, julianDate, lstDeg, project, starColor, toHorizontal } from './astro'

describe('time', () => {
  it('julian date of J2000 noon, and GMST there (280.46°)', () => {
    const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0)
    expect(julianDate(j2000)).toBeCloseTo(2451545.0, 6)
    expect(gmstDeg(j2000)).toBeCloseTo(280.46, 1)
  })
  it('a sidereal day is ~4 minutes shorter than a solar one: the sky comes round again 0.9856° early', () => {
    const t = Date.UTC(2026, 9, 26, 12, 0, 0)
    const d = lstDeg(t + 86_400_000, 19) - lstDeg(t, 19)
    expect(((d + 540) % 360) - 180).toBeCloseTo(0.9856, 3)
  })
})

describe('toHorizontal', () => {
  it('puts the south celestial pole 34.4° above the south horizon in Hermanus, whatever the time', () => {
    for (const lst of [0, 90, 200, 301]) {
      const h = toHorizontal(0, -90, HERMANUS.lat, lst)
      expect(h.alt).toBeCloseTo(34.4187, 3)
      expect(h.az).toBeCloseTo(180, 3)
    }
  })
  it('a star on the meridian at the zenith has Dec equal to the latitude', () => {
    const h = toHorizontal(100, HERMANUS.lat, HERMANUS.lat, 100)
    expect(h.alt).toBeCloseTo(90, 3)
  })
  it('stars circle the pole clockwise seen from the south: a star on the meridian below the pole moves west', () => {
    // Acrux-ish (Dec −63°) on the meridian south of zenith, 15° (one hour) later: it has moved towards the west (az > 180).
    const before = toHorizontal(187, -63, HERMANUS.lat, 187)
    const after = toHorizontal(187, -63, HERMANUS.lat, 202)
    expect(before.az).toBeCloseTo(180, 3)
    expect(after.az).toBeGreaterThan(180)
  })
  it('puts the galactic centre (Sagittarius) around RA 266°, Dec −29°', () => {
    const c = galacticToEquatorial(0, 0)
    expect(c.ra).toBeCloseTo(266.4, 0)
    expect(c.dec).toBeCloseTo(-28.94, 0)
  })
})

describe('project', () => {
  const view = { az: 180, alt: 40, fov: 100, width: 400, height: 800 }
  it('draws the point straight ahead in the middle of the screen', () => {
    const p = project({ az: 180, alt: 40 }, view)
    expect(p.x).toBeCloseTo(200, 6)
    expect(p.y).toBeCloseTo(400, 6)
    expect(p.visible).toBe(true)
  })
  it('puts higher things higher up (smaller y), and west on the right when facing south', () => {
    expect(project({ az: 180, alt: 60 }, view).y).toBeLessThan(400)
    expect(project({ az: 180, alt: 20 }, view).y).toBeGreaterThan(400)
    expect(project({ az: 200, alt: 40 }, view).x).toBeGreaterThan(200)
    expect(project({ az: 160, alt: 40 }, view).x).toBeLessThan(200)
  })
  it('hides what is behind the camera', () => {
    expect(project({ az: 0, alt: 0 }, { ...view, alt: 0 }).visible).toBe(false)
  })
})

describe('starColor', () => {
  it('is bluish for a hot star and orange-ish for a cool one', () => {
    const hot = starColor(-2)
    const cool = starColor(16)
    expect(hot[2]).toBeGreaterThan(hot[0])
    expect(cool[0]).toBeGreaterThan(cool[2])
  })
})
