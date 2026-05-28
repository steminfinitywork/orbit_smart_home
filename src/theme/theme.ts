import { createTheme, Theme } from '@mui/material/styles';

const commonTypography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  h1: { fontWeight: 800 },
  h2: { fontWeight: 700 },
  h3: { fontWeight: 700 },
  h4: { fontWeight: 600 },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  button: { textTransform: 'none' as const, fontWeight: 600 },
};

const commonComponents = {
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        padding: '10px 24px',
        fontSize: '0.9375rem',
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 20,
        backgroundImage: 'none',
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: { backgroundImage: 'none' },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { borderRadius: 8, fontWeight: 600 },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 12,
        },
      },
    },
  },
  MuiSwitch: {
    styleOverrides: {
      root: {
        width: 52,
        height: 28,
        padding: 0,
        '& .MuiSwitch-switchBase': {
          padding: 4,
          '&.Mui-checked': {
            transform: 'translateX(24px)',
          },
        },
        '& .MuiSwitch-thumb': {
          width: 20,
          height: 20,
        },
        '& .MuiSwitch-track': {
          borderRadius: 14,
          opacity: 1,
        },
      },
    },
  },
  MuiFab: {
    styleOverrides: {
      root: { borderRadius: 16 },
    },
  },
};

export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#6366F1', light: '#818CF8', dark: '#4F46E5', contrastText: '#fff' },
    secondary: { main: '#06B6D4', light: '#22D3EE', dark: '#0891B2', contrastText: '#fff' },
    success: { main: '#22C55E', light: '#4ADE80', dark: '#16A34A' },
    error: { main: '#EF4444', light: '#F87171', dark: '#DC2626' },
    warning: { main: '#F59E0B', light: '#FCD34D', dark: '#D97706' },
    background: { default: '#F1F5F9', paper: '#FFFFFF' },
    text: { primary: '#0F172A', secondary: '#475569' },
    divider: 'rgba(100,116,139,0.15)',
  },
  typography: commonTypography,
  shape: { borderRadius: 12 },
  components: {
    ...commonComponents,
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          color: '#0F172A',
          boxShadow: '0 1px 0 rgba(100,116,139,0.12)',
        },
      },
    },
  },
});

export const darkTheme: Theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#818CF8', light: '#A5B4FC', dark: '#6366F1', contrastText: '#fff' },
    secondary: { main: '#22D3EE', light: '#67E8F9', dark: '#06B6D4', contrastText: '#0F172A' },
    success: { main: '#4ADE80', light: '#86EFAC', dark: '#22C55E' },
    error: { main: '#F87171', light: '#FCA5A5', dark: '#EF4444' },
    warning: { main: '#FCD34D', light: '#FDE68A', dark: '#F59E0B' },
    background: { default: '#0B1120', paper: '#131C2E' },
    text: { primary: '#F1F5F9', secondary: '#94A3B8' },
    divider: 'rgba(148,163,184,0.12)',
  },
  typography: commonTypography,
  shape: { borderRadius: 12 },
  components: {
    ...commonComponents,
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#131C2E',
          backgroundImage: 'none',
          boxShadow: '0 1px 0 rgba(148,163,184,0.08)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0F172A',
          backgroundImage: 'none',
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: { backgroundColor: '#131C2E' },
      },
    },
  },
});
