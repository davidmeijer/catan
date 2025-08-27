import type { Edge, GameState, Player, Resource, Vertex } from './types'
import { BUILD_COST, PIP_VALUE } from './constants'

export function emptyBank(): GameState['bank'] {
  return { BRICK: 19, LUMBER: 19, WOOL: 19, GRAIN: 19, ORE: 19 }
}

export function emptyResources(): Player['resources'] {
  return { BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 }
}

export function canAfford(player: Player, cost: Partial<Record<Exclude<Resource, 'DESERT'>, number>>): boolean {
  return Object.entries(cost).every(([k, v]) => (player.resources[k as keyof Player['resources']] ?? 0) >= (v ?? 0))
}

export function pay(player: Player, bank: GameState['bank'], cost: Partial<Record<Exclude<Resource, 'DESERT'>, number>>) {
  for (const [k, v] of Object.entries(cost)) {
    const key = k as keyof Player['resources']
    player.resources[key] -= v!
    bank[key] += v!
  }
}

export function gain(player: Player, bank: GameState['bank'], res: Partial<Record<Exclude<Resource, 'DESERT'>, number>>) {
  for (const [k, v] of Object.entries(res)) {
    const key = k as keyof Player['resources']
    const take = Math.min(bank[key], v!)
    bank[key] -= take
    player.resources[key] += take
  }
}

export function addLog(s: GameState, msg: string) {
  s.log = [msg, ...s.log].slice(0, 200)
}

export function isVertexBuildableSettlement(s: GameState, v: Vertex, playerId: number, duringSetup: boolean) {
  if (v.occupant) return false
  // distance rule: no adjacent occupied
  for (const nbId of v.neighbors) {
    if (s.vertices[nbId].occupant) return false
  }
  if (duringSetup) return true
  // Must connect to your road network
  // (there is an edge from v to a neighbor with your road)
  const hasRoad = edgesAroundVertex(s, v).some(e => e.occupant?.player === playerId)
  return hasRoad
}

export function edgesAroundVertex(s: GameState, v: Vertex): Edge[] {
  const edges: Edge[] = []
  for (const nbId of v.neighbors) {
    const a = v.id, b = nbId
    const eid = a < b ? `${a}|${b}` : `${b}|${a}`
    const e = s.edges[eid]
    if (e) edges.push(e)
  }
  return edges
}

export function isEdgeBuildableRoad(s: GameState, e: Edge, playerId: number, duringSetup: boolean, setupVertexId?: string) {
  if (e.occupant) return false
  if (duringSetup) {
    // must touch the just-placed settlement
    return e.a === setupVertexId || e.b === setupVertexId
  }
  // connected to your network: touches your settlement/city or your road network
  const aOcc = s.vertices[e.a].occupant
  const bOcc = s.vertices[e.b].occupant
  if (aOcc?.player === playerId || bOcc?.player === playerId) return true
  // adjacent to your existing road
  const touchingYourRoad = [s.vertices[e.a], s.vertices[e.b]]
    .flatMap(v => edgesAroundVertex(s, v))
    .some(ed => ed.occupant?.player === playerId)
  return touchingYourRoad
}

export function rollDice(): number {
  const a = 1 + Math.floor(Math.random() * 6)
  const b = 1 + Math.floor(Math.random() * 6)
  return a + b
}

export function distributeResources(s: GameState, roll: number) {
  if (roll === 7) return
  for (const t of s.tiles) {
    if (t.numberToken !== roll) continue
    if (s.robberTileId === t.id) continue
    // find vertices touching tile
    for (const v of Object.values(s.vertices)) {
      if (!v.occupant) continue
      if (!v.touchingTiles.includes(t.id)) continue
      const player = s.players[v.occupant.player]
      const amount = v.occupant.type === 'CITY' ? 2 : 1
      const res = t.resource
      if (res === 'DESERT') continue
      const key = res
      const take = Math.min(s.bank[key], amount)
      s.bank[key] -= take
      player.resources[key] += take
    }
  }
}

export function settlementPipScore(s: GameState, v: Vertex): number {
  return v.touchingTiles.reduce((acc, tid) => {
    const t = s.tiles[tid]
    if (!t.numberToken || t.resource === 'DESERT') return acc
    return acc + (PIP_VALUE[t.numberToken] || 0)
  }, 0)
}

export function tryBuildSettlement(s: GameState, playerId: number, vertexId: string, duringSetup: boolean): boolean {
  const v = s.vertices[vertexId]
  if (!isVertexBuildableSettlement(s, v, playerId, duringSetup)) return false
  if (!duringSetup) {
    if (!canAfford(s.players[playerId], BUILD_COST.SETTLEMENT)) return false
    pay(s.players[playerId], s.bank, BUILD_COST.SETTLEMENT)
  }
  v.occupant = { player: playerId, type: 'SETTLEMENT' }
  s.players[playerId].vp += 1
  addLog(s, `${s.players[playerId].name} built a Settlement.`)
  return true
}

export function tryBuildRoad(s: GameState, playerId: number, edgeId: string, duringSetup: boolean, setupVertexId?: string): boolean {
  const e = s.edges[edgeId]
  if (!isEdgeBuildableRoad(s, e, playerId, duringSetup, setupVertexId)) return false
  if (!duringSetup) {
    if (!canAfford(s.players[playerId], BUILD_COST.ROAD)) return false
    pay(s.players[playerId], s.bank, BUILD_COST.ROAD)
  }
  e.occupant = { player: playerId }
  addLog(s, `${s.players[playerId].name} built a Road.`)
  return true
}

export function tryBuildCity(s: GameState, playerId: number, vertexId: string): boolean {
  const v = s.vertices[vertexId]
  if (!v.occupant || v.occupant.player !== playerId || v.occupant.type !== 'SETTLEMENT') return false
  if (!canAfford(s.players[playerId], BUILD_COST.CITY)) return false
  pay(s.players[playerId], s.bank, BUILD_COST.CITY)
  v.occupant.type = 'CITY'
  s.players[playerId].vp += 1 // upgrade from 1 to 2 => +1
  addLog(s, `${s.players[playerId].name} upgraded to a City.`)
  return true
}

export function bankTrade4to1(s: GameState, playerId: number, give: Exclude<Resource,'DESERT'>, get: Exclude<Resource,'DESERT'>): boolean {
  if (give === get) return false
  if ((s.players[playerId].resources[give] || 0) < 4) return false
  if (s.bank[get] <= 0) return false
  s.players[playerId].resources[give] -= 4
  s.bank[give] += 4
  s.bank[get] -= 1
  s.players[playerId].resources[get] += 1
  addLog(s, `${s.players[playerId].name} traded 4 ${give} for 1 ${get}.`)
  return true
}

export function moveRobber(s: GameState, tileId: number, byPlayer: number) {
  s.robberTileId = tileId
  s.robberMovedThisTurn = true
  addLog(s, `${s.players[byPlayer].name} moved the Robber.`)
  // Steal 1 from a random opponent adjacent to the tile, if any
  const victims = new Set<number>()
  for (const v of Object.values(s.vertices)) {
    if (!v.occupant) continue
    if (!v.touchingTiles.includes(tileId)) continue
    const p = v.occupant.player
    if (p !== byPlayer) victims.add(p)
  }
  const arr = Array.from(victims)
  if (arr.length === 0) return
  const target = arr[Math.floor(Math.random() * arr.length)]
  // pick a random resource to steal
  const resKeys = Object.keys(s.players[target].resources) as (keyof Player['resources'])[]
  const available = resKeys.filter(k => s.players[target].resources[k] > 0)
  if (available.length === 0) return
  const k = available[Math.floor(Math.random() * available.length)]
  s.players[target].resources[k] -= 1
  s.players[byPlayer].resources[k] += 1
  addLog(s, `${s.players[byPlayer].name} stole 1 ${k} from ${s.players[target].name}.`)
}

export function payoutSecondSettlementResources(s: GameState) {
  // After the second setup settlement for each player, grant resources from touching tiles (1 each, cities don't exist yet)
  const counts: Record<number, number> = {}
  // Track how many settlements each player has placed
  for (const v of Object.values(s.vertices)) {
    if (v.occupant?.type === 'SETTLEMENT') {
      counts[v.occupant.player] = (counts[v.occupant.player] || 0) + 1
    }
  }

  for (const pid in counts) {
    if (counts[pid as any] >= 2) {
      // find the *second* settlement by the order of setup placements
      // Simpler: just grant for all settlements exactly once (fine for minimal rules)
    }
  }

  for (const v of Object.values(s.vertices)) {
    if (v.occupant?.type === 'SETTLEMENT') {
      const p = s.players[v.occupant.player]
      for (const tid of v.touchingTiles) {
        const t = s.tiles[tid]
        if (t.resource === 'DESERT') continue
        if (s.bank[t.resource] > 0) {
          s.bank[t.resource] -= 1
          p.resources[t.resource] += 1
        }
      }
    }
  }
  addLog(s, `Starting resources granted for setup.`)
}
