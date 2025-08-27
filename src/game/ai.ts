import type { GameState } from './types'
import { bankTrade4to1, edgesAroundVertex, moveRobber, settlementPipScore, tryBuildCity, tryBuildRoad, tryBuildSettlement } from './logic'
import { BUILD_COST } from './constants'

type Plan = 'CITY' | 'SETTLEMENT' | 'ROAD' | 'NONE'

function missingFor(cost: Record<string, number>, have: Record<string, number>) {
  const miss: Record<string, number> = {}
  for (const [k, v] of Object.entries(cost)) {
    const h = have[k as keyof typeof have] || 0
    miss[k] = Math.max(0, v - h)
  }
  return miss
}

function chooseBestSettlementVertex(s: GameState, pid: number, duringSetup: boolean) {
  const verts = Object.values(s.vertices).filter(v => !v.occupant)
  const legal = verts.filter(v => {
    // distance + connectivity (in setup connectivity is ignored)
    // We'll reuse the same logic as UI, approximated:
    // distance rule
    if (v.neighbors.some(n => s.vertices[n].occupant)) return false
    if (!duringSetup) {
      const connected = edgesAroundVertex(s, v).some(e => e.occupant?.player === pid)
      if (!connected) return false
    }
    return true
  })
  legal.sort((a, b) => settlementPipScore(s, b) - settlementPipScore(s, a))
  return legal[0]
}

function chooseBestRoadEdge(s: GameState, pid: number, duringSetup: boolean, setupVertexId?: string) {
  // Prefer edges that help reach good settlement spots
  const edges = Object.values(s.edges).filter(e => !e.occupant)
  let candidates = edges.filter(e => {
    if (duringSetup) return e.a === setupVertexId || e.b === setupVertexId
    // touches your structure or connected to your road
    const aOcc = s.vertices[e.a].occupant
    const bOcc = s.vertices[e.b].occupant
    const touches = aOcc?.player === pid || bOcc?.player === pid
    const nearRoad = [s.vertices[e.a], s.vertices[e.b]]
      .flatMap(v => v.neighbors.map(n => s.edges[[v.id, n].sort().join('|')]))
      .some(ed => ed?.occupant?.player === pid)
    return touches || nearRoad
  })
  // heuristic: edges incident to high pip vertices
  candidates.sort((e1, e2) => {
    const v1 = [s.vertices[e1.a], s.vertices[e1.b]].reduce((m, v) => Math.max(m, settlementPipScore(s, v)), 0)
    const v2 = [s.vertices[e2.a], s.vertices[e2.b]].reduce((m, v) => Math.max(m, settlementPipScore(s, v)), 0)
    return v2 - v1
  })
  return candidates[0]
}

function planNext(s: GameState, pid: number): Plan {
  // prefer city if possible, then settlement, then road
  const have = s.players[pid].resources
  const wantCity = missingFor(BUILD_COST.CITY, have)
  if (Object.values(wantCity).every(v => v === 0)) return 'CITY'
  const wantSettle = missingFor(BUILD_COST.SETTLEMENT, have)
  if (Object.values(wantSettle).every(v => v === 0)) return 'SETTLEMENT'
  const wantRoad = missingFor(BUILD_COST.ROAD, have)
  if (Object.values(wantRoad).every(v => v === 0)) return 'ROAD'
  // else target settlement path
  return 'SETTLEMENT'
}

export function botTakeSetupAction(s: GameState, pid: number) {
  if (s.setupSub === 'SETTLEMENT') {
    const v = chooseBestSettlementVertex(s, pid, true)
    if (v) {
      if (tryBuildSettlement(s, pid, v.id, true)) {
        return { placedVertex: v.id }
      }
    }
  } else {
    // Place road attached to last settlement (try best)
    // Find last settlement by pid with no adjacent road (rough heuristic)
    const myVerts = Object.values(s.vertices).filter(v => v.occupant?.player === pid)
    const last = myVerts[myVerts.length - 1]
    if (!last) return {}
    const e = chooseBestRoadEdge(s, pid, true, last.id)
    if (e) tryBuildRoad(s, pid, e.id, true, last.id)
    return {}
  }
  return {}
}

export function botTakeTurn(s: GameState, pid: number) {
  // If last roll was 7 and robber needs moving, do it:
  if (s.lastRoll === 7 && !s.robberMovedThisTurn) {
    // choose tile with most opponent adjacency (and non-desert)
    const scores = s.tiles.map(t => {
      if (t.resource === 'DESERT') return -1
      let score = 0
      for (const v of Object.values(s.vertices)) {
        if (!v.occupant) continue
        if (!v.touchingTiles.includes(t.id)) continue
        if (v.occupant.player !== pid) score += 1
      }
      return score
    })
    let best = 0, bestScore = -1
    for (let i = 0; i < scores.length; i++) if (scores[i] > bestScore) { best = i; bestScore = scores[i] }
    moveRobber(s, best, pid)
  }

  // Try to build in priority order; a couple of trade attempts if close
  for (let loops = 0; loops < 4; loops++) {
    const plan = planNext(s, pid)
    if (plan === 'CITY') {
      // pick a settlement to upgrade with best pips
      const mySetts = Object.values(s.vertices).filter(v => v.occupant?.player === pid && v.occupant.type === 'SETTLEMENT')
      mySetts.sort((a, b) => settlementPipScore(s, b) - settlementPipScore(s, a))
      const target = mySetts[0]
      if (target && tryBuildCity(s, pid, target.id)) continue
    } else if (plan === 'SETTLEMENT') {
      const v = chooseBestSettlementVertex(s, pid, false)
      if (v && tryBuildSettlement(s, pid, v.id, false)) continue
    } else if (plan === 'ROAD') {
      const e = chooseBestRoadEdge(s, pid, false)
      if (e && tryBuildRoad(s, pid, e.id, false)) continue
    }

    // Try 4:1 trade to move toward target
    const need = plan === 'CITY' ? BUILD_COST.CITY : plan === 'SETTLEMENT' ? BUILD_COST.SETTLEMENT : BUILD_COST.ROAD
    const inv = s.players[pid].resources
    const lacks = Object.entries(need).filter(([k, v]) => (inv as any)[k] < v)
    if (lacks.length === 0) continue
    // if we have at least 4 of something not needed, trade
    const have4 = (Object.keys(inv) as (keyof typeof inv)[]).find(k => inv[k] >= 4 && !lacks.some(([lk]) => lk === k))
    if (have4) {
      const want = lacks[0][0] as keyof typeof inv
      if (bankTrade4to1(s, pid, have4, want)) continue
    }
    break
  }
  // done; bot ends turn in UI controller
}
