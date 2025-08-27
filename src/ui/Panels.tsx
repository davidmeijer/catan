import React from 'react'
import type { GameState, Resource } from '../game/types'
import { RESOURCE_SHORT } from '../game/types'
import { BUILD_COST } from '../game/constants'

function ResRow({ res }: { res: Record<Exclude<Resource,'DESERT'>, number> }) {
  return (
    <div className="res">
      <span className="B">B: {res.BRICK}</span>
      <span className="L">L: {res.LUMBER}</span>
      <span className="W">W: {res.WOOL}</span>
      <span className="G">G: {res.GRAIN}</span>
      <span className="O">O: {res.ORE}</span>
    </div>
  )
}

export function Controls({
  state, canRoll, canAct, canEnd, onRoll, onEnd, onTrade, onMoveRobber,
  onBuildSettlement, onBuildRoad, onBuildCity,
  legalSettlementVertices, legalRoadEdges, lastSetupVertexId
}: {
  state: GameState
  canRoll: boolean
  canAct: boolean
  canEnd: boolean
  onRoll: () => void
  onEnd: () => void
  onTrade: (give: keyof typeof state.bank, get: keyof typeof state.bank) => void
  onMoveRobber?: () => void
  onBuildSettlement: () => void
  onBuildRoad: () => void
  onBuildCity: () => void
  legalSettlementVertices: number
  legalRoadEdges: number
  lastSetupVertexId?: string
}) {
  const p = state.players[state.currentPlayer]
  const turnTitle = state.phase === 'SETUP' ? `Setup: ${p.name} (${state.setupSub})` : `Turn: ${p.name}`

  return (
    <div className="sidebar">
      <h1>{turnTitle}</h1>
      <div className="row">
        <span className="badge">Player: <b style={{color:p.color}}>{p.name}</b></span>
        <span className="badge">VP: <b>{p.vp}</b> / {state.targetVP}</span>
        {state.lastRoll && <span className="badge">Last Roll: <b>{state.lastRoll}</b></span>}
      </div>

      <h2>Resources</h2>
      <ResRow res={p.resources} />

      <h2>Bank</h2>
      <ResRow res={state.bank} />

      <h2>Actions</h2>
      <div className="stack">
        <button onClick={onRoll} disabled={!canRoll}>Roll Dice</button>
        {state.lastRoll === 7 && !state.robberMovedThisTurn && (
          <button onClick={onMoveRobber}>Move Robber</button>
        )}
        <div className="row">
          <button onClick={onBuildRoad} disabled={!canAct}>Build Road</button>
          <small className="badge">Cost: B+L</small>
          <small className="badge">Legal: {legalRoadEdges}</small>
        </div>
        <div className="row">
          <button onClick={onBuildSettlement} disabled={!canAct}>Build Settlement</button>
          <small className="badge">Cost: B+L+W+G</small>
          <small className="badge">Legal: {legalSettlementVertices}</small>
        </div>
        <div className="row">
          <button onClick={onBuildCity} disabled={!canAct}>Build City</button>
          <small className="badge">Cost: 2G+3O</small>
        </div>
      </div>

      <h2>Trade (Bank 4:1)</h2>
      <TradeForm onTrade={onTrade} disabled={!canAct} />

      <h2>Log</h2>
      <div className="log">
        {state.log.map((l, i) => <div key={i}>• {l}</div>)}
      </div>

      <hr />
      <button onClick={onEnd} disabled={!canEnd}>End Turn</button>
      <p style={{color:'var(--muted)'}}>Tip: Click glowing vertices/edges on the board to build when a builder is active.</p>
    </div>
  )
}

function TradeForm({ onTrade, disabled }: { onTrade: (give: any, get: any) => void; disabled?: boolean }) {
  const [give, setGive] = React.useState<keyof typeof BUILD_COST.SETTLEMENT>('BRICK' as any)
  const [get, setGet] = React.useState<keyof typeof BUILD_COST.SETTLEMENT>('GRAIN' as any)
  return (
    <div className="row">
      <select value={give} onChange={e => setGive(e.target.value as any)} disabled={disabled}>
        <option value="BRICK">BRICK</option>
        <option value="LUMBER">LUMBER</option>
        <option value="WOOL">WOOL</option>
        <option value="GRAIN">GRAIN</option>
        <option value="ORE">ORE</option>
      </select>
      <span>→</span>
      <select value={get} onChange={e => setGet(e.target.value as any)} disabled={disabled}>
        <option value="BRICK">BRICK</option>
        <option value="LUMBER">LUMBER</option>
        <option value="WOOL">WOOL</option>
        <option value="GRAIN">GRAIN</option>
        <option value="ORE">ORE</option>
      </select>
      <button onClick={() => onTrade(give, get)} disabled={disabled}>Trade 4:1</button>
    </div>
  )
}

export function PlayerSetup({
  totalPlayers, setTotalPlayers, 
  humanCount, setHumanCount, 
  targetVP, setTargetVP,
  start
}: {
  totalPlayers: number; setTotalPlayers: (n:number)=>void
  humanCount: number; setHumanCount: (n:number)=>void
  targetVP: number; setTargetVP: (n:number)=>void
  start: () => void
}) {
  return (
    <div className="sidebar">
      <h1>New Game</h1>
      <div className="card stack">
        <label>Total Players (2-4)</label>
        <input type="number" min={2} max={4} value={totalPlayers} onChange={e => setTotalPlayers(+e.target.value)} />

        <label>Human Players (0-{totalPlayers})</label>
        <input type="number" min={0} max={totalPlayers} value={humanCount} onChange={e => setHumanCount(+e.target.value)} />

        <label>Target Victory Points (3-16)</label>
        <input
          type="number"
          min={3}
          max={16}
          value={targetVP}
          onChange={e => {
            const v = Math.floor(Number(e.target.value) || 3)
            setTargetVP(Math.max(3, Math.min(16, v)))
          }}
        />

        <button onClick={start}>Start Game</button>
      </div>
      <h2>What's included</h2>
      <ul>
        <li>Hex board, numbers, robber</li>
        <li>Dice, resource distribution</li>
        <li>Build roads / settlements / cities</li>
        <li>Bank trades 4:1</li>
        <li>Basic bot AI</li>
      </ul>
      <h2>Not included</h2>
      <ul>
        <li>Ports, Dev Cards, Longest Road/Largest Army</li>
        <li>Forced discards on 7</li>
      </ul>
    </div>
  )
}
