// The astronomy behind Läget's night sky: where a star stands, seen from a place on Earth at a moment,
// and how that is drawn on a flat screen. Pure functions, degrees in and out, no DOM.

export const HERMANUS = { name: 'Hermanus', lat: -34.4187, lon: 19.2345 }

const RAD = Math.PI / 180
const mod = (a: number, n: number) => ((a % n) + n) % n

/** Julian date of a JS timestamp (ms since 1970). */
export function julianDate(ms: number): number {
  return ms / 86_400_000 + 2_440_587.5
}

/** Greenwich mean sidereal time in degrees. Good to a few arc-seconds for dates near J2000, which is far
 *  more than a picture of the sky needs. */
export function gmstDeg(ms: number): number {
  const d = julianDate(ms) - 2_451_545.0
  return mod(280.46061837 + 360.98564736629 * d, 360)
}

/** Local sidereal time in degrees for an east longitude. */
export function lstDeg(ms: number, lonEast: number): number {
  return mod(gmstDeg(ms) + lonEast, 360)
}

export interface Horizontal {
  /** Degrees above the horizon (negative = below). */
  alt: number
  /** Degrees from north, clockwise: 0 N, 90 E, 180 S, 270 W. */
  az: number
}

/** Equatorial (RA, Dec) to the sky as seen from latitude `lat` at local sidereal time `lst`. */
export function toHorizontal(raDeg: number, decDeg: number, lat: number, lst: number): Horizontal {
  const H = (lst - raDeg) * RAD
  const dec = decDeg * RAD
  const phi = lat * RAD
  const sinAlt = Math.sin(dec) * Math.sin(phi) + Math.cos(dec) * Math.cos(phi) * Math.cos(H)
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)))
  const az = Math.atan2(-Math.cos(dec) * Math.sin(H), Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(H))
  return { alt: alt / RAD, az: mod(az / RAD, 360) }
}

/** Galactic coordinates (l, b) to equatorial (RA, Dec), J2000. Used to put the Milky Way's band where it
 *  really runs; the texture drawn along it is made up. */
export function galacticToEquatorial(l: number, b: number): { ra: number; dec: number } {
  const poleRa = 192.85948 * RAD
  const poleDec = 27.12825 * RAD
  const lNcp = 122.93192 * RAD
  const lr = l * RAD
  const br = b * RAD
  const sinDec = Math.sin(br) * Math.sin(poleDec) + Math.cos(br) * Math.cos(poleDec) * Math.cos(lNcp - lr)
  const dec = Math.asin(sinDec)
  const y = Math.cos(br) * Math.sin(lNcp - lr)
  const x = Math.sin(br) * Math.cos(poleDec) - Math.cos(br) * Math.sin(poleDec) * Math.cos(lNcp - lr)
  return { ra: mod(Math.atan2(y, x) / RAD + poleRa / RAD, 360), dec: dec / RAD }
}

export interface View {
  /** Where the camera points: azimuth and altitude in degrees. */
  az: number
  alt: number
  /** The vertical angle the screen height covers, in degrees. */
  fov: number
  width: number
  height: number
}

export interface Projected {
  x: number
  y: number
  /** True when the point is in front of the camera and drawable. */
  visible: boolean
  /** Pixels per radian at this spot, for sizing glows in angular terms. */
  scale: number
}

/** Stereographic projection of a point (alt/az) on a screen looking at `view`. Straight lines through the
 *  centre stay straight and circles stay circles, which keeps star trails round and the horizon curved. */
export function project(h: Horizontal, view: View): Projected {
  const az = h.az * RAD
  const alt = h.alt * RAD
  const v = [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)]
  const a0 = view.az * RAD
  const al0 = view.alt * RAD
  const a = [Math.cos(al0) * Math.sin(a0), Math.cos(al0) * Math.cos(a0), Math.sin(al0)]
  const right = [Math.cos(a0), -Math.sin(a0), 0]
  const up = [right[1] * a[2] - right[2] * a[1], right[2] * a[0] - right[0] * a[2], right[0] * a[1] - right[1] * a[0]]
  const dot = (p: number[], q: number[]) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2]
  const dx = dot(v, right)
  const dy = dot(v, up)
  const dz = dot(v, a)
  const S = view.height / (2 * Math.tan((view.fov * RAD) / 4))
  const k = S / (1 + dz)
  return { x: view.width / 2 + dx * k, y: view.height / 2 - dy * k, visible: dz > -0.9, scale: S / 2 }
}

/** A star's colour from its B−V index (×10 as stored), blue-white to orange. */
export function starColor(bv10: number): [number, number, number] {
  const bv = Math.max(-0.3, Math.min(2, bv10 / 10))
  if (bv < 0.3) return [175 + (bv + 0.3) * 40, 200 + (bv + 0.3) * 30, 255]
  if (bv < 0.8) return [255, 255 - (bv - 0.3) * 30, 245 - (bv - 0.3) * 130]
  return [255, 240 - (bv - 0.8) * 90, 180 - (bv - 0.8) * 110]
}
