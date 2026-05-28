import React from 'react';
import { useParams as useParamsHook } from 'react-router-dom';
import {
  Box, Typography, Breadcrumbs, Link, Chip,
} from '@mui/material';
import { NavigateNext, Router } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDeviceStore } from '@/store/deviceStore';
import OnlineIndicator from '@/components/dashboard/OnlineIndicator';
import DeviceSettings from '@/components/device/DeviceSettings';
import { isDeviceOnline } from '@/hooks/useHeartbeat';

const DeviceDetailPage: React.FC = () => {
  const { deviceId } = useParamsHook<{ deviceId: string }>();
  const navigate = useNavigate();
  const { devices, rooms, rtdbData } = useDeviceStore();

  const device = devices.find((d) => d.id === deviceId);
  const rtdb = deviceId ? (rtdbData[deviceId] ?? null) : null;
  const online = isDeviceOnline(rtdb?.heartbeat);

  if (!device) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Device not found. It may have been removed.</Typography>
        <Link onClick={() => navigate('/dashboard')} sx={{ cursor: 'pointer', mt: 1, display: 'block' }}>
          ← Back to Dashboard
        </Link>
      </Box>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ mb: 2 }}>
        <Link underline="hover" color="text.secondary" onClick={() => navigate('/dashboard')} sx={{ cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          Dashboard
        </Link>
        <Typography color="text.primary" fontSize={13} fontWeight={700}>{device.deviceName}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3.5 }}>
        <Box sx={{
          p: 1.5, borderRadius: 3,
          background: online ? 'linear-gradient(135deg, #6366F1, #06B6D4)' : 'action.hover',
          color: online ? '#fff' : 'text.disabled',
          display: 'flex',
        }}>
          <Router sx={{ fontSize: 24 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <OnlineIndicator heartbeat={rtdb?.heartbeat} size={9} />
            <Typography variant="h5" fontWeight={850}>{device.deviceName}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
            <Chip label={online ? 'Online' : 'Offline'} size="small" color={online ? 'success' : 'error'} variant="outlined" sx={{ fontWeight: 700, fontSize: 10, height: 20 }} />
            <Chip label={`${device.relayCount} Channels`} size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
            <Chip label={`FW ${device.firmwareVersion || 'unknown'}`} size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
          </Box>
        </Box>
      </Box>

      {/* Settings Grid */}
      <DeviceSettings device={device} rtdbData={rtdb} rooms={rooms} />
    </motion.div>
  );
};

export default DeviceDetailPage;
