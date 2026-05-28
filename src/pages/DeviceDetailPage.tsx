import React, { useState } from 'react';
import { useParams as useParamsHook } from 'react-router-dom';
import {
  Box, Typography, Tab, Tabs, Breadcrumbs, Link, Chip,
} from '@mui/material';
import { NavigateNext, Router } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDeviceStore } from '@/store/deviceStore';
import OnlineIndicator from '@/components/dashboard/OnlineIndicator';
import ChannelGrid from '@/components/device/ChannelGrid';
import DeviceSettings from '@/components/device/DeviceSettings';
import { isDeviceOnline } from '@/hooks/useHeartbeat';

const DeviceDetailPage: React.FC = () => {
  const { deviceId } = useParamsHook<{ deviceId: string }>();
  const navigate = useNavigate();
  const { devices, rooms, rtdbData, setRtdbData } = useDeviceStore();
  const [tab, setTab] = useState(0);

  const device = devices.find((d) => d.id === deviceId);
  const rtdb = deviceId ? (rtdbData[deviceId] ?? null) : null;
  const online = isDeviceOnline(rtdb?.heartbeat);

  // RTDB data is kept fresh by RelayPollBridge (useRelayPolling) in App.tsx.
  // No local subscription needed — just read from the store.

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

  const channels = rtdb?.channels ?? {};

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ mb: 2 }}>
        <Link underline="hover" color="text.secondary" onClick={() => navigate('/dashboard')} sx={{ cursor: 'pointer', fontSize: 14 }}>
          Dashboard
        </Link>
        <Typography color="text.primary" fontSize={14} fontWeight={600}>{device.deviceName}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{
          p: 1.5, borderRadius: 3,
          background: online ? 'linear-gradient(135deg, rgba(99,102,241,0.85), rgba(6,182,212,0.7))' : 'action.hover',
          color: online ? '#fff' : 'text.disabled',
        }}>
          <Router sx={{ fontSize: 28 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <OnlineIndicator heartbeat={rtdb?.heartbeat} size={10} />
            <Typography variant="h5" fontWeight={800}>{device.deviceName}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
            <Chip label={online ? 'Online' : 'Offline'} size="small" color={online ? 'success' : 'error'} variant="outlined" sx={{ fontWeight: 700 }} />
            <Chip label={`${device.relayCount} Channels`} size="small" variant="outlined" />
            <Chip label={`FW ${device.firmwareVersion || 'unknown'}`} size="small" variant="outlined" />
          </Box>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab} onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, '& .MuiTab-root': { fontWeight: 600, minWidth: 0, px: 2 } }}
      >
        <Tab label={`Channels (${Object.keys(channels).length})`} id="tab-channels" />
        <Tab label="Settings" id="tab-settings" />
      </Tabs>

      {tab === 0 && (
        Object.keys(channels).length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">
              {online ? 'Waiting for device data…' : 'Device is offline. Channel data unavailable.'}
            </Typography>
          </Box>
        ) : (
          <ChannelGrid
            deviceId={device.id}
            channels={channels as any}
            online={online}
          />
        )
      )}

      {tab === 1 && (
        <DeviceSettings device={device} rtdbData={rtdb} rooms={rooms} />
      )}
    </motion.div>
  );
};

export default DeviceDetailPage;
