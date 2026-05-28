import React from 'react';
import { Box, Card, Typography, useTheme } from '@mui/material';
import { useDeviceStore } from '@/store/deviceStore';

const HEARTBEAT_THRESHOLD_MS = 45_000;

const QuickStats: React.FC = () => {
  const { devices, rooms, rtdbData } = useDeviceStore();
  const theme = useTheme();

  const onlineCount = devices.filter((d) => {
    const rtdb = rtdbData[d.id];
    return rtdb && rtdb.heartbeat && (Date.now() - rtdb.heartbeat < HEARTBEAT_THRESHOLD_MS);
  }).length;

  const stats = [
    { label: 'Online', value: onlineCount, color: '#10B981', bg: theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.06)' },
    { label: 'Offline', value: devices.length - onlineCount, color: '#EF4444', bg: theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.06)' },
    { label: 'Devices', value: devices.length, color: '#6366F1', bg: theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' },
    { label: 'Rooms', value: rooms.length, color: '#06B6D4', bg: theme.palette.mode === 'dark' ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.06)' },
  ];

  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 3, width: '100%', overflowX: 'auto', pb: 0.5, '::-webkit-scrollbar': { display: 'none' } }}>
      {stats.map((stat) => (
        <Card
          key={stat.label}
          sx={{
            flex: 1,
            minWidth: 72,
            py: 1,
            px: 1.5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: stat.bg,
            border: '1px solid',
            borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            borderRadius: 3.5,
            boxShadow: 'none',
            transition: 'transform 0.2s',
            '&:hover': { transform: 'scale(1.02)' },
          }}
        >
          <Typography variant="h6" fontWeight={850} sx={{ color: stat.color, lineHeight: 1 }}>
            {stat.value}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, fontWeight: 700, mt: 0.25, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {stat.label}
          </Typography>
        </Card>
      ))}
    </Box>
  );
};

export default QuickStats;
