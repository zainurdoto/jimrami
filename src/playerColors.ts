export const PLAYER_COLORS = [
  {
    key: 'sky',
    name: 'Sky',
    hex: '#78A7F4',
  },
  {
    key: 'cyan',
    name: 'Cyan',
    hex: '#67C7D8',
  },
  {
    key: 'teal',
    name: 'Teal',
    hex: '#5FC0B1',
  },
  {
    key: 'mint',
    name: 'Mint',
    hex: '#82C99F',
  },
  {
    key: 'lime',
    name: 'Lime',
    hex: '#A9C779',
  },
  {
    key: 'amber',
    name: 'Amber',
    hex: '#E0B65C',
  },
  {
    key: 'orange',
    name: 'Orange',
    hex: '#E69A61',
  },
  {
    key: 'coral',
    name: 'Coral',
    hex: '#E08078',
  },
  {
    key: 'rose',
    name: 'Rose',
    hex: '#DF8B9D',
  },
  {
    key: 'pink',
    name: 'Pink',
    hex: '#D78BC4',
  },
  {
    key: 'violet',
    name: 'Violet',
    hex: '#B491DF',
  },
  {
    key: 'periwinkle',
    name: 'Periwinkle',
    hex: '#989FEB',
  },
] as const

export type PlayerColorKey =
  (typeof PLAYER_COLORS)[number]['key']

export const DEFAULT_PLAYER_COLOR_KEY:
  PlayerColorKey = 'sky'

export function getPlayerColor(
  colorKey?: string
) {
  return (
    PLAYER_COLORS.find(
      (color) =>
        color.key === colorKey
    )?.hex ??
    PLAYER_COLORS[0].hex
  )
}

export function getPlayerColorName(
  colorKey?: string
) {
  return (
    PLAYER_COLORS.find(
      (color) =>
        color.key === colorKey
    )?.name ??
    PLAYER_COLORS[0].name
  )
}
