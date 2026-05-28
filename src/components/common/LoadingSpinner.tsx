import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { WifiTethering } from '@mui/icons-material';
import { motion } from 'framer-motion';

interface Props { message?: string; }

const LoadingSpinner: React.FC<Props> = ({ message = 'Loading…' }) => (
  <Box sx={{
    position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 3,
    background: 'linear-gradient(135deg, #0B1120 0%, #131C2E 100%)',
    zIndex: 9999,
  }}>
    <motion.div
      animate={{ scale: [1, 1.1, 1], opacity: [1, 0.7, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Box sx={{
        width: 72, height: 72, borderRadius: 4,
        background: 'linear-gradient(135deg, #6366F1, #06B6D4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <WifiTethering sx={{ color: '#fff', fontSize: 36 }} />
      </Box>
    </motion.div>
    <CircularProgress size={28} sx={{ color: '#818CF8' }} />
    <Typography variant="body2" color="text.secondary">{message}</Typography>
  </Box>
);

export default LoadingSpinner;
