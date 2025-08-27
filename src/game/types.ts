export type Resource = 'BRICK' | 'LUMBER' | 'WOOL' | 'GRAIN' | 'ORE' | 'DESERT'
export type ResourceShort = 'B' | 'L' | 'W' | 'G' | 'O'
export const RESOURCE_SHORT: Record<Exclude<Resource, 'DESERT'>, ResourceShort> = {
  BRICK: 'B', LUMBER: 'L', WOOL: 'W', GRAIN: 'G', ORE: 'O'
}

export type PlayerKind = 'HUMAN' | 'BOT'

export interface Tile {
  id: number
  q: number
  r: number
  resource: Resource
  numberToken?: number // 2..12, except 7; undefined for DESERT
}

export interface Vertex {
  id: string
  x: number
  y: number
  touchingTiles: number[] // tile ids
  occupant?: { player: number; type: 'SETTLEMENT' | 'CITY' }
  neighbors: string[] // adjacent vertex ids (via edges)
}

export interface Edge {
  id: string
  a: string
  b: string
  touchingTiles: number[]
  occupant?: { player: number }
}

export interface Player {
  id: number
  name: string
  color: string
  kind: PlayerKind
  resources: Record<Exclude<Resource, 'DESERT'>, number>
  vp: number
}

export type Phase = 'SETUP' | 'PLAY' | 'GAME_OVER'
export type SetupSub = 'SETTLEMENT' | 'ROAD'

export interface GameState {
  tiles: Tile[]
  vertices: Record<string, Vertex>
  edges: Record<string, Edge>
  currentPlayer: number
  players: Player[]
  phase: Phase
  setupIndex: number // 0..(players*2-1) which placement step we are on
  setupSub: SetupSub
  robberTileId: number
  robberMovedThisTurn: boolean
  log: string[]
  lastRoll?: number
  bank: Record<Exclude<Resource, 'DESERT'>, number>
  targetVP: number
}
