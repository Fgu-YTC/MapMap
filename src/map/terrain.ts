import type { CSSProperties } from 'react'

export type Biome =
  | 'plains'
  | 'forest'
  | 'hills'
  | 'mountain'
  | 'lake'
  | 'marsh'
  | 'dunes'
  | 'mesa'

export interface TerrainProfile {
  biome: Biome
  label: string
  elevation: number
  moisture: number
  hue: number
  sat: number
  lit: number
  accent: string
  base: string
  pattern: 'dots' | 'stripes' | 'blocks' | 'waves' | 'noise'
}

const BIOMES: Array<{
  biome: Biome
  label: string
  hue: number
  sat: number
  lit: number
  pattern: TerrainProfile['pattern']
}> = [
  { biome: 'plains', label: '平原', hue: 92, sat: 42, lit: 38, pattern: 'dots' },
  { biome: 'forest', label: '森林', hue: 140, sat: 48, lit: 28, pattern: 'noise' },
  { biome: 'hills', label: '丘陵', hue: 78, sat: 35, lit: 34, pattern: 'stripes' },
  { biome: 'mountain', label: '山地', hue: 40, sat: 12, lit: 42, pattern: 'blocks' },
  { biome: 'lake', label: '湖泊', hue: 195, sat: 55, lit: 32, pattern: 'waves' },
  { biome: 'marsh', label: '濕地', hue: 160, sat: 30, lit: 26, pattern: 'noise' },
  { biome: 'dunes', label: '沙丘', hue: 38, sat: 48, lit: 48, pattern: 'stripes' },
  { biome: 'mesa', label: '台地', hue: 18, sat: 42, lit: 36, pattern: 'blocks' },
]

export function hashId(id: string | number): number {
  const s = String(id)
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function unit(n: number, salt: number): number {
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function terrainFromBitmapId(id: string | number): TerrainProfile {
  const h = hashId(id)
  const meta = BIOMES[h % BIOMES.length]
  const elevation = unit(h, 1)
  const moisture = unit(h, 2)
  const hueJitter = (unit(h, 3) - 0.5) * 16
  const hue = (meta.hue + hueJitter + 360) % 360
  const sat = Math.min(70, Math.max(18, meta.sat + (unit(h, 4) - 0.5) * 14))
  const lit = Math.min(55, Math.max(18, meta.lit + (elevation - 0.5) * 12))

  return {
    biome: meta.biome,
    label: meta.label,
    elevation,
    moisture,
    hue,
    sat,
    lit,
    base: `hsl(${hue} ${sat}% ${lit}%)`,
    accent: `hsl(${hue} ${sat + 10}% ${Math.min(70, lit + 18)}%)`,
    pattern: meta.pattern,
  }
}

export function terrainCss(profile: TerrainProfile): CSSProperties {
  const { base, accent, pattern, elevation, hue, sat, lit } = profile
  const deep = `hsl(${hue} ${sat}% ${Math.max(12, lit - 14)}%)`

  let backgroundImage = `linear-gradient(145deg, ${accent}55, transparent 55%), linear-gradient(${base}, ${deep})`

  if (pattern === 'dots') {
    backgroundImage = `radial-gradient(circle at 30% 30%, ${accent}66 0 2px, transparent 3px), radial-gradient(circle at 70% 65%, ${accent}44 0 1.5px, transparent 2.5px), linear-gradient(160deg, ${base}, ${deep})`
  } else if (pattern === 'stripes') {
    backgroundImage = `repeating-linear-gradient(118deg, ${accent}33 0 6px, transparent 6px 14px), linear-gradient(160deg, ${base}, ${deep})`
  } else if (pattern === 'blocks') {
    backgroundImage = `linear-gradient(90deg, ${deep} 0 12%, transparent 12%), linear-gradient(${accent}40 0 18%, transparent 18%), linear-gradient(160deg, ${base}, ${deep})`
  } else if (pattern === 'waves') {
    backgroundImage = `repeating-radial-gradient(circle at 50% 120%, ${accent}33 0 8px, transparent 8px 18px), linear-gradient(180deg, ${accent}, ${deep})`
  } else {
    backgroundImage = `radial-gradient(ellipse at ${20 + elevation * 60}% ${30 + elevation * 40}%, ${accent}55, transparent 50%), linear-gradient(155deg, ${base}, ${deep})`
  }

  return {
    backgroundColor: base,
    backgroundImage,
  }
}

/** Soft-blend base color toward neighbor biomes for stitched look */
export function blendWithNeighbors(
  self: TerrainProfile,
  neighbors: TerrainProfile[],
): string {
  if (neighbors.length === 0) return self.base
  let h = self.hue
  let s = self.sat
  let l = self.lit
  const wSelf = 0.62
  const wN = (1 - wSelf) / neighbors.length
  h = self.hue * wSelf
  s = self.sat * wSelf
  l = self.lit * wSelf
  for (const n of neighbors) {
    h += n.hue * wN
    s += n.sat * wN
    l += n.lit * wN
  }
  return `hsl(${h} ${s}% ${l}%)`
}
