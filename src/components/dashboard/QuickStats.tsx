import React from 'react';
import { Box, Card, Typography, useTheme } from '@mui/material';
import { WifiTethering, WifiOff, DevicesOther, MeetingRoom } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useDeviceStore } from '@/store/deviceStore';
import { isDeviceOnline } from '@/hooks/useHeartbeat';

const QuickStats: React.FC = () => {
  const { devices, rooms, rtdbData } = useDeviceStore();
  const theme = useTheme();

  const onlineCount = devices.filter((d) => {
    const rtdb = rtdbData[d.id];
    return isDeviceOnline(rtdb?.heartbeat);
  }).length;

  const stats = [
    {
      label: 'Online', value: onlineCount, icon: <WifiTethering />,
      gradient: 'linear-gradient(135deg, #22C55E, #16A34A)',
      bg: theme.palette.mode === 'dark' ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
    },
    {
      label: 'Offline', value: devices.length - onlineCount, icon: <WifiOff />,
      gradient: 'linear-gradient(135deg, #EF4444, #DC2626)',
      bg: theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
    },
    {
      label: 'Devices', value: devices.length, icon: <DevicesOther />,
      gradient: 'linear-gradient(135deg, #6366F1, #4F46E5)',
      bg: theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
    },
    {
      label: 'Rooms', value: rooms.length, icon: <MeetingRoom />,
      gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)',
      bg: theme.palette.mode === 'dark' ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.08)',
    },
  ];

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 3 }}>
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
        >
          <Card
            sx={{
              p: 2, background: stat.bg, border: '1px solid',
              borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              cursor: 'default',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                p: 1, borderRadius: 2, background: stat.gradient,
                display: 'flex', color: '#fff',
              }}>
                {React.cloneElement(stat.icon, { sx: { fontSize: 20 } })}
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={800} lineHeight={1}>{stat.value}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>{stat.label}</Typography>
              </Box>
            </Box>
          </Card>
        </motion.div>
      ))}
    </Box>
  );
};

export default QuickStats;
