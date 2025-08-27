import { HEX_SIZE, SQRT3 } from './constants'
import type { Tile, Vertex, Edge, Resource } from './types'

// Axial -> pixel (pointy-topped)
export function axialToPixel(q: number, r: number) {
  const x = HEX_SIZE * (SQRT3 * q + (SQRT3 / 2) * r)
  const y = HEX_SIZE * (1.5 * r)
  return { x, y }
}

function hexCorner(center: {x:number,y:number}, i: number, size = HEX_SIZE) {
  // pointy top: angle offset -30 deg
  const angle = Math.PI / 180 * (60 * i - 30)
  return { x: center.x + size * Math.cos(angle), y: center.y + size * Math.sin(angle) }
}

type PresetTile = { q: number; r: number; resource: Resource; numberToken?: number }

// Standard radius-2 board axial coords (19 tiles)
function radius2Coords(): { q: number; r: number }[] {
  const coords: {q:number;r:number}[] = []
  const radius = 2
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius)
    const r2 = Math.min(radius, -q + radius)
    for (let r = r1; r <= r2; r++) coords.push({ q, r })
  }
  return coords
}

/** A fixed, balanced base-board (classic-like).
 * Desert at (0,0). Number tokens omit 7.
 * You can swap these around later if you want random boards.
 */
export function generateTiles(): Tile[] {
  // Assign resources by coordinate order for determinism
  const coords = radius2Coords()
    .sort((a, b) => a.r - b.r || a.q - b.q)

  const resources: Resource[] = [
    // 4 Lumber, 4 Wool, 4 Grain, 3 Brick, 3 Ore, 1 Desert
    'LUMBER','GRAIN','WOOL','BRICK',
    'GRAIN','ORE','LUMBER',
    'WOOL','GRAIN','DESERT','WOOL',
    'ORE','BRICK','GRAIN',
    'LUMBER','WOOL','ORE','LUMBER','BRICK'
  ]

  const numbers = [
    11, 4, 8, 3,
    6, 5, 10,
    9, 12, /* desert */ 0, 11,
    3, 6, 5,
    10, 2, 9, 4, 8
  ]

  const tiles: Tile[] = coords.map((c, i) => ({
    id: i,
    q: c.q,
    r: c.r,
    resource: resources[i],
    numberToken: resources[i] === 'DESERT' ? undefined : numbers[i] || undefined
  }))

  return tiles
}

export function buildGraph(tiles: Tile[]) {
  // Build vertices/edges by deduping hex corners
  const vertices: Record<string, Vertex> = {}
  const edges: Record<string, Edge> = {}

  function keyForPoint(x: number, y: number): string {
    // quantize to avoid fp duplicates
    const qx = Math.round(x * 10) / 10
    const qy = Math.round(y * 10) / 10
    return `${qx.toFixed(1)},${qy.toFixed(1)}`
  }

  tiles.forEach(t => {
    const c = axialToPixel(t.q, t.r)
    const corners = [...Array(6)].map((_, i) => hexCorner(c, i))
    const cornerIds = corners.map(p => {
      const id = keyForPoint(p.x, p.y)
      if (!vertices[id]) {
        vertices[id] = { id, x: parseFloat(id.split(',')[0]), y: parseFloat(id.split(',')[1]), touchingTiles: [], neighbors: [] }
      }
      vertices[id].touchingTiles.push(t.id)
      return id
    })

    // edges between consecutive corners (0-1,1-2,...5-0)
    for (let i = 0; i < 6; i++) {
      const a = cornerIds[i]
      const b = cornerIds[(i + 1) % 6]
      const eid = a < b ? `${a}|${b}` : `${b}|${a}`
      if (!edges[eid]) edges[eid] = { id: eid, a, b, touchingTiles: [] }
      edges[eid].touchingTiles.push(t.id)
    }
  })

  // neighbors
  Object.values(edges).forEach(e => {
    const A = vertices[e.a], B = vertices[e.b]
    if (!A.neighbors.includes(B.id)) A.neighbors.push(B.id)
    if (!B.neighbors.includes(A.id)) B.neighbors.push(A.id)
  })

  return { vertices, edges }
}

export function initialRobberTileId(tiles: Tile[]): number {
  const desert = tiles.find(t => t.resource === 'DESERT')
  return desert ? desert.id : 0
}
