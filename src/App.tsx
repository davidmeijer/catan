import React from 'react'
import Board from './ui/Board'
import { PlayerSetup, Controls } from './ui/Panels'
import { generateTiles, buildGraph, initialRobberTileId } from './game/board'
import type { GameState, Player } from './game/types'
import { PLAYER_COLORS } from './game/constants'
import { emptyBank, emptyResources, addLog, rollDice, distributeResources, tryBuildRoad, tryBuildSettlement, tryBuildCity, isVertexBuildableSettlement, edgesAroundVertex, bankTrade4to1, payoutSecondSettlementResources, moveRobber } from './game/logic'
import { botTakeSetupAction, botTakeTurn } from './game/ai'
import { playSfx } from './audio/sfx'

function makePlayers(total: number, humans: number): Player[] {
  const players: Player[] = []
  for (let i = 0; i < total; i++) {
    players.push({
      id: i,
      name: humans > i ? `You ${i+1}` : `Bot ${i+1 - humans}`,
      color: PLAYER_COLORS[i],
      kind: humans > i ? 'HUMAN' : 'BOT',
      resources: emptyResources(),
      vp: 0
    })
  }
  return players
}

function initialGame(totalPlayers: number, humans: number, chosenTargetVP: number): GameState {
  const tiles = generateTiles()
  const { vertices, edges } = buildGraph(tiles)
  const players = makePlayers(totalPlayers, humans)
  const target = Math.max(3, Math.min(16, Math.floor(chosenTargetVP || 10)))

  const s: GameState = {
    tiles, vertices, edges,
    players,
    currentPlayer: 0,
    phase: 'SETUP',
    setupIndex: 0,
    setupSub: 'SETTLEMENT',
    robberTileId: initialRobberTileId(tiles),
    robberMovedThisTurn: false,
    log: [],
    bank: emptyBank(),
    targetVP: target
  }
  addLog(s, `Game created: ${totalPlayers} players (${humans} human). Target VP = ${target}.`)
  addLog(s, `Setup phase: place Settlement then Road; then reverse order.`)
  return s
}

function playWinOrLoseSfx(winner: Player) {
  playSfx(winner.kind === 'BOT' ? 'lose' : 'win')
}

export default function App() {
  const [game, setGame] = React.useState<GameState | null>(null)
  const [totalPlayers, setTotalPlayers] = React.useState(3)
  const [humanCount, setHumanCount] = React.useState(1)
  const [buildMode, setBuildMode] = React.useState<'NONE'|'SETTLEMENT'|'ROAD'|'CITY'|'ROBBER'>('NONE')
  const [setupLastVertex, setSetupLastVertex] = React.useState<string | undefined>(undefined)
  const [targetVP, setTargetVP] = React.useState(10)

  function start() {
    const s = initialGame(totalPlayers, humanCount, targetVP)
    setGame({...s})
  }

  React.useEffect(() => {
    if (!game) return
    // Auto-progress bots in setup & turns
    const p = game.players[game.currentPlayer]
    if (game.phase === 'SETUP' && p.kind === 'BOT') {
      const s = clone(game)
      if (s.setupSub === 'SETTLEMENT') {
        const { placedVertex } = botTakeSetupAction(s, s.currentPlayer)
        setSetupLastVertex(placedVertex)
        s.setupSub = 'ROAD'
      } else {
        botTakeSetupAction(s, s.currentPlayer)
        advanceSetup(s)
      }
      setGame(s)
      return
    }

    if (game.phase === 'PLAY' && p.kind === 'BOT') {
      const s = clone(game)
      // roll if needed
      if (!s.lastRoll) {
        s.lastRoll = rollDice()
        addLog(s, `${s.players[s.currentPlayer].name} rolled ${s.lastRoll}.`)
        if (s.lastRoll !== 7) distributeResources(s, s.lastRoll)
      }
      botTakeTurn(s, s.currentPlayer)
      // end turn
      s.lastRoll = undefined
      if (s.players[s.currentPlayer].vp >= s.targetVP) {
        s.phase = 'GAME_OVER'
        const winner = s.players[s.currentPlayer]
        addLog(s, `${winner.name} wins!`)
        playWinOrLoseSfx(winner)
      } else {
        s.currentPlayer = (s.currentPlayer + 1) % s.players.length
      }
      setGame(s)
    }
  }, [game?.currentPlayer, game?.phase, game?.setupIndex, game?.lastRoll, game?.players])

  if (!game) {
    return (
      <div className="app">
        <div style={{display:'grid', placeItems:'center', padding:16}}>
          <h1>Catan-Lite (TS + React)</h1>
          <p style={{color:'var(--muted)'}}>A compact Catan-like game with a simple bot AI.</p>
        </div>
        <PlayerSetup
          totalPlayers={totalPlayers} setTotalPlayers={setTotalPlayers}
          humanCount={humanCount} setHumanCount={setHumanCount}
          targetVP={targetVP} setTargetVP={setTargetVP}
          start={start}
        />
      </div>
    )
  }

  const s = game
  const duringSetup = s.phase === 'SETUP' && s.players[s.currentPlayer].kind === 'HUMAN'

  const rolled = !!s.lastRoll
  const mustMoveRobber = s.lastRoll === 7 && !s.robberMovedThisTurn
  const canRoll = s.phase === 'PLAY' && !rolled
  const canAct = s.phase === 'PLAY' && rolled && !mustMoveRobber
  const canEnd = s.phase === 'PLAY' && rolled && !mustMoveRobber

  // Highlight logic for UI affordances
  const highlightVertices = new Set<string>()
  const highlightEdges = new Set<string>()

  if (s.phase === 'SETUP') {
    if (s.setupSub === 'SETTLEMENT') {
      for (const v of Object.values(s.vertices)) {
        // distance rule, ignore road connectivity
        const ok = !v.occupant && v.neighbors.every(n => !s.vertices[n].occupant)
        if (ok) highlightVertices.add(v.id)
      }
    } else {
      // must attach to last settlement
      if (setupLastVertex) {
        for (const e of edgesAroundVertex(s, s.vertices[setupLastVertex])) {
          if (!e.occupant) highlightEdges.add(e.id)
        }
      }
    }
  } else if (s.phase === 'PLAY') {
    if (buildMode === 'SETTLEMENT') {
      for (const v of Object.values(s.vertices)) {
        if (isVertexBuildableSettlement(s, v, s.currentPlayer, false)) highlightVertices.add(v.id)
      }
    } else if (buildMode === 'ROAD') {
      for (const e of Object.values(s.edges)) {
        if (!e.occupant) {
          // simple check uses logic in tryBuildRoad, but for highlighting approximate:
          const a = s.vertices[e.a].occupant?.player === s.currentPlayer
          const b = s.vertices[e.b].occupant?.player === s.currentPlayer
          const nearRoad = [s.vertices[e.a], s.vertices[e.b]]
            .flatMap(v => v.neighbors.map(n => s.edges[[v.id, n].sort().join('|')]))
            .some(ed => ed?.occupant?.player === s.currentPlayer)
          if (a || b || nearRoad) highlightEdges.add(e.id)
        }
      }
    } else if (buildMode === 'CITY') {
      for (const v of Object.values(s.vertices)) {
        if (v.occupant?.player === s.currentPlayer && v.occupant.type === 'SETTLEMENT') highlightVertices.add(v.id)
      }
    } else if (buildMode === 'ROBBER' && s.lastRoll === 7) {
      // tiles clickable via Board clickTile prop
    }
  }

  function onClickVertex(id: string) {
    const s2 = clone(s)
    if (s2.phase === 'SETUP') {
      if (s2.setupSub === 'SETTLEMENT') {
        if (tryBuildSettlement(s2, s2.currentPlayer, id, true)) {
          setSetupLastVertex(id)
          s2.setupSub = 'ROAD'
          setGame(s2)
        }
      } else if (s2.setupSub === 'ROAD') {
        // ignore, road is on edges
      }
      return
    }

    // Hard gate: must roll first; also must move robber first on a 7
    if (!s2.lastRoll || (s2.lastRoll === 7 && !s2.robberMovedThisTurn)) return

    if (s2.phase === 'PLAY') {
      if (buildMode === 'SETTLEMENT') {
        if (tryBuildSettlement(s2, s2.currentPlayer, id, false)) {
          endBuildMode()
          maybeWinOrSet(s2)
        }
      } else if (buildMode === 'CITY') {
        if (tryBuildCity(s2, s2.currentPlayer, id)) {
          endBuildMode()
          maybeWinOrSet(s2)
        }
      }
    }
  }

  function onClickEdge(id: string) {
    const s2 = clone(s)
    if (s2.phase === 'SETUP') {
      if (s2.setupSub === 'ROAD') {
        if (tryBuildRoad(s2, s2.currentPlayer, id, true, setupLastVertex)) {
          advanceSetup(s2)
          setGame(s2)
        }
      }
      return
    }

    // Hard gate: must roll first; also must move robber first on a 7
    if (!s2.lastRoll || (s2.lastRoll === 7 && !s2.robberMovedThisTurn)) return

    if (s2.phase === 'PLAY' && buildMode === 'ROAD') {
      if (tryBuildRoad(s2, s2.currentPlayer, id, false)) {
        endBuildMode()
        setGame(s2)
      }
    }
  }

  function onClickTile(id: number) {
    if (buildMode === 'ROBBER' && s.lastRoll === 7 && !s.robberMovedThisTurn && id !== s.robberTileId) {
      const s2 = clone(s)
      moveRobber(s2, id, s2.currentPlayer)  // sets robberMovedThisTurn = true 
      setBuildMode('NONE')
      setGame(s2)
    }
  }

  function onRoll() {
    const s2 = clone(s)
    if (s2.lastRoll) return
    s2.lastRoll = rollDice()
    addLog(s2, `${s2.players[s2.currentPlayer].name} rolled ${s2.lastRoll}.`)
    if (s2.lastRoll !== 7) {
      distributeResources(s2, s2.lastRoll)
    } else {
      s2.robberMovedThisTurn = false
      setBuildMode('ROBBER') // nothing else allowed until robber is moved
    }
    setGame(s2)
  }

  function onEnd() {
    const s2 = clone(s)
    // Must roll first; if a 7 was rolled, must move robber first
    if (!s2.lastRoll || (s2.lastRoll === 7 && !s2.robberMovedThisTurn)) return

    s2.lastRoll = undefined
    if (s2.players[s2.currentPlayer].vp >= s2.targetVP) {
      s2.phase = 'GAME_OVER'
      const winner = s2.players[s2.currentPlayer]
      addLog(s2, `${winner.name} wins!`)
      playWinOrLoseSfx(winner)
    } else {
      s2.currentPlayer = (s2.currentPlayer + 1) % s2.players.length
    }
    setGame(s2)
  }

  function onTrade(give: any, get: any) {
    const s2 = clone(s)
    if (!s2.lastRoll || (s2.lastRoll === 7 && !s2.robberMovedThisTurn)) return
    bankTrade4to1(s2, s2.currentPlayer, give, get)
    setGame(s2)
  }

  function onBuildSettlementBtn() {
    if (!s.lastRoll || (s.lastRoll === 7 && !s.robberMovedThisTurn)) return
    setBuildMode('SETTLEMENT')
  }
  function onBuildRoadBtn() {
    if (!s.lastRoll || (s.lastRoll === 7 && !s.robberMovedThisTurn)) return
    setBuildMode('ROAD')
  }
  function onBuildCityBtn() {
    if (!s.lastRoll || (s.lastRoll === 7 && !s.robberMovedThisTurn)) return
    setBuildMode('CITY')
  }
  function onMoveRobberBtn() { setBuildMode('ROBBER') }

  function endBuildMode() { setBuildMode('NONE') }

  const legalSettlementVertices = Object.values(s.vertices).filter(v => isVertexBuildableSettlement(s, v, s.currentPlayer, false)).length
  const legalRoadEdges = Object.values(s.edges).filter(e => !e.occupant).length // approx; shown just for info

  return (
    <div className="app">
      <Board
        state={s}
        robberTileId={s.robberTileId}
        highlightVertices={highlightVertices}
        highlightEdges={highlightEdges}
        clickVertex={onClickVertex}
        clickEdge={onClickEdge}
        clickTile={onClickTile}
      />
      <Controls
        state={s}
        canRoll={canRoll}
        canAct={canAct}
        canEnd={canEnd}
        onRoll={onRoll}
        onEnd={onEnd}
        onTrade={onTrade}
        onBuildSettlement={onBuildSettlementBtn}
        onBuildRoad={onBuildRoadBtn}
        onBuildCity={onBuildCityBtn}
        onMoveRobber={onMoveRobberBtn}
        legalSettlementVertices={legalSettlementVertices}
        legalRoadEdges={legalRoadEdges}
      />
    </div>
  )

  function maybeWinOrSet(s2: GameState) {
    if (s2.players[s2.currentPlayer].vp >= s2.targetVP) {
      s2.phase = 'GAME_OVER'
      const winner = s2.players[s2.currentPlayer]
      addLog(s2, `${winner.name} wins!`)
      playWinOrLoseSfx(winner)
    }
    setGame(s2)
  }

  function advanceSetup(s2: GameState) {
    const N = s2.players.length
    s2.setupSub = 'SETTLEMENT'
    s2.setupIndex += 1
    if (s2.setupIndex >= N * 2) {
      s2.phase = 'PLAY'
      s2.currentPlayer = 0
      s2.lastRoll = undefined
      payoutSecondSettlementResources(s2)
      addLog(s2, `Setup complete — start playing!`)
    } else {
      // determine next player in snake order
      const i = s2.setupIndex
      const round = Math.floor(i / N) // 0 or 1
      const pos = i % N
      s2.currentPlayer = round === 0 ? pos : (N - 1 - pos)
    }
  }
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x))
}
