/**
 * KIDS TRADE — Material Design 3 tema tokenları (v2).
 * Marka yeşili (#1f6b4f) primary seed olarak alınıp M3 tonal palete
 * genişletildi; şeftali aksanı tertiary rolünde.
 */
export const colors = {
  primary: '#1f6b4f',
  onPrimary: '#ffffff',
  primaryContainer: '#a8f2cd',
  onPrimaryContainer: '#00210f',

  secondary: '#4e6356',
  secondaryContainer: '#d3e8d8',
  onSecondaryContainer: '#0b1f14',

  tertiary: '#9a5c3f',
  tertiaryContainer: '#ffdbcb',
  onTertiaryContainer: '#380d00',

  error: '#ba1a1a',
  errorContainer: '#ffdad6',

  surface: '#fbfcf7',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f4f6ef',
  surfaceContainer: '#eef1e9',
  surfaceContainerHigh: '#e8ebe2',
  surfaceContainerHighest: '#e2e5dc',

  onSurface: '#171d17',
  onSurfaceVariant: '#3f493f',
  outline: '#6f7a6e',
  outlineVariant: '#bfc9bc',

  gold: '#b8862b',

  /** Marka gradyanları */
  balanceGradient: ['#23795a', '#1f6b4f', '#0e3d2c'] as const,
  coverGradient: ['#23795a', '#0e3d2c'] as const,
  onDark: '#ffffff',
} as const;

/** M3 shape scale */
export const shape = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

/** M3 elevation (RN shadow + Android elevation eşlemesi) */
export const elevation = {
  level1: {
    shadowColor: '#141e16',
    shadowOpacity: 0.16,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  level2: {
    shadowColor: '#141e16',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  level3: {
    shadowColor: '#141e16',
    shadowOpacity: 0.2,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;
