import React, { useState } from 'react';
import {
  Card, CardContent, Box, Typography, Chip, IconButton,
  Collapse, Divider, Tooltip, useTheme,
} from '@mui/material';
import {
  ExpandMore, ExpandLess, Settings, Router,
  Sensors, PowerSettingsNew,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { DeviceDoc, DeviceRTDB } from '@/types';
import OnlineIndicator from './OnlineIndicator';
import ChannelCard from './ChannelCard';
import { isDeviceOnline, getLastSeenText } from '@/hooks/useHeartbeat';

const deviceIcon = (type: string) => {
  if (type === 'sensor') return <Sensors />;
  if (type === 'plug') return <PowerSettingsNew />;
  return <Router />;
};

interface Props {
  device: DeviceDoc;
  rtdbData: DeviceRTDB | null;
}

const DeviceCard: React.FC<Props> = ({ device, rtdbData }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const online = isDeviceOnline(rtdbData?.heartbeat);
  const channels = rtdbData?.channels ?? {};
  const chKeys = Object.keys(channels).sort() as Array<keyof typeof channels>;
  const onChannels = chKeys.filter((k) => channels[k]?.state).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      layout
    >
      <Card
        sx={{
          border: '1px solid',
          borderColor: online
            ? theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'
            : theme.palette.divider,
          transition: 'all 0.3s ease',
          '&:hover': { boxShadow: online ? 8 : 2 },
        }}
      >
        <CardContent sx={{ pb: '12px !important' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box sx={{
              p: 1.25, borderRadius: 2.5, flexShrink: 0,
              background: online
                ? 'linear-gradient(135deg, rgba(99,102,241,0.85), rgba(6,182,212,0.7))'
                : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              color: online ? '#fff' : 'text.disabled',
            }}>
              {React.cloneElement(deviceIcon(device.deviceType), { sx: { fontSize: 22 } })}
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                <OnlineIndicator heartbeat={rtdbData?.heartbeat} size={8} />
                <Typography variant="subtitle1" fontWeight={700} noWrap>{device.deviceName}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {device.relayCount} ch · FW {device.firmwareVersion || 'unknown'} · {getLastSeenText(rtdbData?.heartbeat)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Device settings">
                <IconButton size="small" onClick={() => navigate(`/device/${device.id}`)}>
                  <Settings fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
          </Box>

          {/* Summary */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
            <Chip
              label={online ? 'Online' : 'Offline'}
              size="small"
              color={online ? 'success' : 'error'}
              variant="outlined"
              sx={{ fontWeight: 700, fontSize: 11 }}
            />
            {online && (
              <Chip
                label={`${onChannels}/${chKeys.length} ON`}
                size="small" color="primary" variant="outlined"
                sx={{ fontWeight: 700, fontSize: 11 }}
              />
            )}
            <Chip
              label={device.deviceType.toUpperCase()}
              size="small" variant="outlined"
              sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary' }}
            />
          </Box>

          {/* Expandable channels */}
          <Collapse in={expanded} unmountOnExit>
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1 }}>
              {chKeys.length === 0 ? (
                <Typography variant="caption" color="text.secondary">No channel data available</Typography>
              ) : (
                chKeys.map((k) => (
                  <ChannelCard
                    key={k}
                    deviceId={device.id}
                    chKey={k as any}
                    channel={channels[k as keyof typeof channels]}
                    online={online}
                    compact
                  />
                ))
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default DeviceCard;
