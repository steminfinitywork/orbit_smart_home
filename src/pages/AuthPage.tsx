import React, { useState } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { signInWithGoogle } from '@/firebase/auth';

// ─── Animated orbital ring ─────────────────────────────────────────────────

const OrbitRing: React.FC<{ size: number; duration: number; delay?: number; color?: string }> = ({
  size, duration, delay = 0, color = 'rgba(0,212,255,0.35)',
}) => (
  <motion.div
    style={{
      position: 'absolute',
      width: size,
      height: size * 0.42,
      borderRadius: '50%',
      border: `1.5px solid ${color}`,
      top: '50%',
      left: '50%',
      marginTop: -(size * 0.42) / 2,
      marginLeft: -size / 2,
      boxShadow: `0 0 8px ${color}`,
    }}
    animate={{ rotateZ: 360 }}
    transition={{ duration, repeat: Infinity, ease: 'linear', delay }}
  />
);

// ─── Auth Page ─────────────────────────────────────────────────────────────

const AuthPage: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      // onAuthStateChanged in useAuth will handle the rest
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please try again.');
      } else if (code === 'auth/popup-blocked') {
        setError('Pop-up blocked by browser. Please allow pop-ups for this site.');
      } else {
        setError('Sign-in failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: isDark
        ? 'linear-gradient(135deg, #050D1F 0%, #0D1B3E 50%, #071428 100%)'
        : 'linear-gradient(135deg, #0D1B3E 0%, #1A2F6E 50%, #0A2447 100%)',
    }}>
      {/* Animated background glow blobs */}
      <Box sx={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
      }}>
        <motion.div style={{
          position: 'absolute', width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,180,255,0.08) 0%, transparent 70%)',
          top: '-20%', left: '-10%',
        }} animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div style={{
          position: 'absolute', width: 500, height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
          bottom: '-15%', right: '-5%',
        }} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 3 }} />
      </Box>

      {/* Auth card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: '100%', maxWidth: 400, padding: '0 20px', position: 'relative', zIndex: 1 }}
      >
        <Box sx={{
          borderRadius: 5,
          p: { xs: 3.5, sm: 5 },
          background: 'rgba(13, 27, 62, 0.7)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(0, 212, 255, 0.15)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
        }}>
          {/* Orbit logo icon area */}
          <Box sx={{ position: 'relative', width: 120, height: 120, mb: 3 }}>
            {/* Orbital rings */}
            <OrbitRing size={120} duration={6}  color="rgba(0,212,255,0.4)" />
            <OrbitRing size={90}  duration={9}  delay={0.5} color="rgba(74,144,255,0.35)" />
            <OrbitRing size={60}  duration={4}  delay={1}   color="rgba(0,212,255,0.5)" />
            {/* House icon centre */}
            <Box sx={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src="/icons/orbit-icon.png" alt="Orbit" style={{ width: 38, height: 38, objectFit: 'contain' }} />
            </Box>
          </Box>

          {/* Brand name */}
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              mb: 0.5,
            }}
          >
            Orbit
          </Typography>
          <Typography
            variant="subtitle2"
            sx={{
              color: 'rgba(0,212,255,0.85)',
              letterSpacing: '0.18em',
              fontWeight: 600,
              textTransform: 'uppercase',
              fontSize: 11,
              mb: 4,
            }}
          >
            Smart Home
          </Typography>

          {/* Tagline */}
          <Typography
            variant="body2"
            sx={{ color: 'rgba(255,255,255,0.55)', textAlign: 'center', mb: 3, px: 1 }}
          >
            Control every device in your home<br />from anywhere in the world
          </Typography>

          {/* Error */}
          {error && (
            <Alert
              severity="error"
              sx={{ width: '100%', mb: 2, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              {error}
            </Alert>
          )}

          {/* Google Sign-In button */}
          <Button
            id="google-signin-btn"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            onClick={handleGoogleSignIn}
            sx={{
              py: 1.6,
              borderRadius: 3,
              fontWeight: 700,
              fontSize: '0.95rem',
              background: 'rgba(255,255,255,0.96)',
              color: '#1a1a2e',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              '&:hover': {
                background: '#fff',
                boxShadow: '0 6px 28px rgba(0,212,255,0.25)',
                transform: 'translateY(-1px)',
              },
              '&:active': { transform: 'translateY(0)' },
              transition: 'all 0.2s ease',
              gap: 1.5,
            }}
          >
            {loading ? (
              <CircularProgress size={22} sx={{ color: '#1a1a2e' }} />
            ) : (
              <>
                {/* Google G icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          {/* Footer note */}
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', mt: 3, textAlign: 'center' }}>
            By signing in you agree to Orbit's terms of service
          </Typography>
        </Box>
      </motion.div>
    </Box>
  );
};

export default AuthPage;
