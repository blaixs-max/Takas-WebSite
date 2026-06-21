/**
 * KIDS TRADE — Material Design 3 tema tokenları.
 * Marka yeşili (#1f6b4f) primary seed olarak alınıp M3 tonal palete
 * genişletildi; şeftali aksanı tertiary rolünde.
 */
export const colors = {
  primary: '#1f6b4f',
  onPrimary: '#ffffff',
  primaryContainer: '#a8f2cd',
  onPrimaryContainer: '#00210f',

  secondary: '#4e6356',
  secondaryContainer: '#d1e8d7',
  onSecondaryContainer: '#0c1f15',

  tertiary: '#9a5c3f',
  tertiaryContainer: '#ffdbcb',
  onTertiaryContainer: '#380d00',

  error: '#ba1a1a',
  errorContainer: '#ffdad6',

  surface: '#f7f8f3',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f1f4ec',
  surfaceContainer: '#ebeee6',
  surfaceContainerHigh: '#e6e8e1',
  surfaceContainerHighest: '#e0e3db',

  onSurface: '#181d18',
  onSurfaceVariant: '#414941',
  outline: '#717971',
  outlineVariant: '#c1c9bf',
} as const;

/** M3 shape scale */
export const shape = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 28,
  full: 999,
} as const;

/** M3 elevation (RN shadow + Android elevation eşlemesi) */
export const elevation = {
  level1: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  level2: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  level3: {
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;
