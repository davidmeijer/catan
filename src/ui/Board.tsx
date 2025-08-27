import React from 'react'
import { RESOURCE_COLOR, HEX_SIZE, SQRT3 } from '../game/constants'
import type { GameState, Tile, Vertex, Edge } from '../game/types'
import { axialToPixel } from '../game/board'

const TOKEN_FILL: Record<number, string> = {
  2:'#f0f4ff', 3:'#e0f2f1', 4:'#e0f7fa', 5:'#e8f5e9', 6:'#ffebee',
  8:'#ffebee', 9:'#e8f5e9', 10:'#e0f7fa', 11:'#e0f2f1', 12:'#f0f4ff'
}

function Hex({ t, selected, onClick }: { t: Tile; selected?: boolean; onClick?: () => void }) {
  const { x, y } = axialToPixel(t.q, t.r)
  const r = HEX_SIZE
  const points = [...Array(6)].map((_, i) => {
    const angle = Math.PI / 180 * (60 * i - 30)
    const px = x + r * Math.cos(angle)
    const py = y + r * Math.sin(angle)
    return `${px},${py}`
  }).join(' ')
  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <polygon points={points} fill={RESOURCE_COLOR[t.resource]} stroke="#1b2233" strokeWidth={2} opacity={selected ? 0.9 : 1}/>
      {t.numberToken && t.numberToken !== 0 && (
        <g>
          <circle cx={x} cy={y} r={18} fill={TOKEN_FILL[t.numberToken]} stroke="#1b2233" />
          <text x={x} y={y + 5} textAnchor="middle" fontSize="16" fontWeight={t.numberToken === 6 || t.numberToken === 8 ? 700 : 500} fill="#0c0f14">{t.numberToken}</text>
        </g>
      )}
    </g>
  )
}

export default function Board({
  state,
  clickVertex,
  clickEdge,
  clickTile,
  highlightVertices = new Set<string>(),
  highlightEdges = new Set<string>(),
  robberTileId
}: {
  state: GameState
  clickVertex?: (id: string) => void
  clickEdge?: (id: string) => void
  clickTile?: (id: number) => void
  highlightVertices?: Set<string>
  highlightEdges?: Set<string>
  robberTileId: number
}) {
  const tiles = state.tiles
  // compute bounds
  const centers = tiles.map(t => axialToPixel(t.q, t.r))
  const minX = Math.min(...centers.map(c => c.x)) - HEX_SIZE*1.2
  const maxX = Math.max(...centers.map(c => c.x)) + HEX_SIZE*1.2
  const minY = Math.min(...centers.map(c => c.y)) - HEX_SIZE*1.2
  const maxY = Math.max(...centers.map(c => c.y)) + HEX_SIZE*1.2
  const W = maxX - minX
  const H = maxY - minY

  return (
    <svg viewBox={`${minX} ${minY} ${W} ${H}`} width="100%" height="100%" style={{ background:'#0c0f14' }}>
      {/* tiles */}
      {tiles.map(t => (
        <g key={t.id}>
          <Hex t={t} selected={false} onClick={clickTile ? () => clickTile(t.id) : undefined} />
          {state.robberTileId === t.id && (
            <g>
              <circle cx={axialToPixel(t.q, t.r).x} cy={axialToPixel(t.q, t.r).y} r={12} fill="#333" stroke="#eee" />
              <text x={axialToPixel(t.q, t.r).x} y={axialToPixel(t.q, t.r).y+5} fontSize={10} textAnchor="middle" fill="#eee">🗡</text>
            </g>
          )}
        </g>
      ))}

      {/* edges */}
      {Object.values(state.edges).map(e => {
        const a = state.vertices[e.a], b = state.vertices[e.b]
        const stroke = e.occupant ? state.players[e.occupant.player].color : (highlightEdges.has(e.id) ? '#4dd0e1' : '#24304a')
        const w = e.occupant ? 7 : 4
        return (
          <line key={e.id}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={stroke}
            strokeWidth={w}
            opacity={e.occupant ? 0.95 : 0.7}
            onClick={clickEdge ? () => clickEdge(e.id) : undefined}
            style={{ cursor: clickEdge ? 'pointer' : 'default' }}
          />
        )
      })}

      {/* vertices */}
      {Object.values(state.vertices).map(v => {
        const occ = v.occupant
        const r = occ ? (occ.type === 'CITY' ? 10 : 7) : 5
        const fill = occ ? state.players[occ.player].color : (highlightVertices.has(v.id) ? '#4dd0e1' : '#0b101a')
        const stroke = occ ? '#ffffffaa' : (highlightVertices.has(v.id) ? '#4dd0e1' : '#1b2233')
        return (
          <circle key={v.id} cx={v.x} cy={v.y} r={r}
            fill={fill} stroke={stroke} strokeWidth={2}
            onClick={clickVertex ? () => clickVertex(v.id) : undefined}
            style={{ cursor: clickVertex ? 'pointer' : 'default' }}
            opacity={occ ? 1 : (highlightVertices.has(v.id) ? 1 : 0.9)}
          />
        )
      })}
    </svg>
  )
}
