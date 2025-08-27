import type { Resource } from './types'

export const HEX_SIZE = 54 // px
export const SQRT3 = Math.sqrt(3)

export const BUILD_COST = {
  ROAD: { BRICK: 1, LUMBER: 1 },
  SETTLEMENT: { BRICK: 1, LUMBER: 1, WOOL: 1, GRAIN: 1 },
  CITY: { GRAIN: 2, ORE: 3 }
} as const

export const PIP_VALUE: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
  8: 5, 9: 4, 10: 3, 11: 2, 12: 1
}

export const RESOURCE_COLOR: Record<Resource, string> = {
  BRICK: '#8d4a30',
  LUMBER: '#2e7d32',
  WOOL: '#4db6ac',
  GRAIN: '#ffd54f',
  ORE: '#9e9e9e',
  DESERT: '#c9b380'
}

export const PLAYER_COLORS = ['#66bb6a', '#42a5f5', '#ff7043', '#ab47bc']
