import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { Room } from '@/types';
import { useDeviceStore } from '@/store/deviceStore';
import DeviceCard from './DeviceCard';

interface Props {
  room: Room | null; // null = "Unassigned"
}

const RoomSection: React.FC<Props> = ({ room }) => {
  const theme = useTheme();
  const { devices, rtdbData } = useDeviceStore();

  const roomDevices = devices.filter((d) =>
    room ? d.roomId === room.id : !d.roomId
  );

  if (roomDevices.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box sx={{
          fontSize: 20,
          lineHeight: 1,
          filter: theme.palette.mode === 'dark' ? 'brightness(1.2)' : 'none',
        }}>
          {room?.icon || '📦'}
        </Box>
        <Typography variant="h6" fontWeight={700}>
          {room?.name || 'Unassigned'}
        </Typography>
        <Box sx={{
          ml: 0.5, px: 1, py: 0.25, borderRadius: 1,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            {roomDevices.length}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {roomDevices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            rtdbData={rtdbData[device.id] ?? null}
          />
        ))}
      </Box>
    </Box>
  );
};

export default RoomSection;
