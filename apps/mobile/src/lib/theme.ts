export const Colors = {
  forest:       '#1B3A2D',
  forestLight:  '#2D6A4F',
  mint:         '#52B788',
  mintLight:    '#74C69D',
  cream:        '#F5EDD8',
  creamDark:    '#EDE2C8',
  terra:        '#E07A5F',
  terraDark:    '#C9603E',
  gold:         '#D4A853',
  white:        '#FFFFFF',
  background:   '#F9F7F3',
  text:         '#1C1C1C',
  textMuted:    '#6B7280',
  border:       '#E5E7EB',
} as const

export const Typography = {
  serif:  'PlayfairDisplay-Bold',
  serifReg: 'PlayfairDisplay-Regular',
  sans:   'DMSans-Regular',
  sansMd: 'DMSans-Medium',
  sansSb: 'DMSans-SemiBold',
} as const

export const Radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  full: 9999,
} as const

export const Shadow = {
  card: {
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHover: {
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
} as const
