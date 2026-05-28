import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { isDeviceOnline } from '@/hooks/useHeartbeat';

interface Props {
  heartbeat?: number;
  size?: number;
  showTooltip?: boolean;
}

const OnlineIndicator: React.FC<Props> = ({ heartbeat, size = 10, showTooltip = true }) => {
  const online = isDeviceOnline(heartbeat);

  const dot = (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <Box
        sx={{
          width: size, height: size, borderRadius: '50%',
          bgcolor: online ? '#22C55E' : '#EF4444',
          position: 'relative', zIndex: 1,
        }}
      />
      {online && (
        <motion.div
          style={{
            position: 'absolute', top: 0, left: 0,
            width: size, height: size,
            borderRadius: '50%',
            backgroundColor: '#22C55E',
          }}
          animate={{ scale: [1, 2.2, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </Box>
  );

  if (!showTooltip) return dot;
  return (
    <Tooltip title={online ? 'Online' : 'Offline'} arrow>
      {dot}
    </Tooltip>
  );
};

export default OnlineIndicator;
