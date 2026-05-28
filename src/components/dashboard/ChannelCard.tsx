import React, { useState } from 'react';
import {
  Card, Box, Typography, Switch, Chip, IconButton,
  Tooltip, useTheme, Skeleton,
} from '@mui/material';
import { Timer, Schedule, Edit } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { Channel, ChannelKey } from '@/types';
import { setChannelState } from '@/firebase/realtimeDb';
import { useUIStore } from '@/store/uiStore';

interface Props {
  deviceId: string;
  chKey: ChannelKey;
  channel: Channel;
  online: boolean;
  onEditClick?: () => void;
  compact?: boolean;
}

const ChannelCard: React.FC<Props> = ({ deviceId, chKey, channel, online, onEditClick, compact }) => {
  const theme = useTheme();
  const addNotification = useUIStore((s) => s.addNotification);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    if (!online || toggling) return;
    setToggling(true);
    try {
      await setChannelState(deviceId, chKey, !channel.state);
    } catch {
      addNotification('Failed to toggle channel', 'error');
    } finally {
      setToggling(false);
    }
  };

  const isOn = channel.state;
  const hasTimer = channel.timer?.enabled;
  const hasSchedule = channel.schedule?.enabled;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: online ? 1.02 : 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        sx={{
          p: compact ? 1.5 : 2,
          border: '1.5px solid',
          borderColor: isOn && online
            ? 'rgba(99,102,241,0.4)'
            : theme.palette.divider,
          background: isOn && online
            ? theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(6,182,212,0.12))'
              : 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,182,212,0.05))'
            : theme.palette.background.paper,
          transition: 'all 0.3s ease',
          cursor: online ? 'pointer' : 'not-allowed',
          opacity: online ? 1 : 0.7,
          position: 'relative',
          overflow: 'visible',
        }}
        onClick={handleToggle}
      >
        {/* ON glow */}
        {isOn && online && (
          <Box sx={{
            position: 'absolute', inset: -1, borderRadius: 'inherit',
            boxShadow: '0 0 20px rgba(99,102,241,0.25)',
            pointerEvents: 'none',
          }} />
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              {/* LED dot */}
              <motion.div
                animate={isOn && online ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
                transition={{ duration: 1.5, repeat: isOn && online ? Infinity : 0 }}
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: isOn && online ? '#22C55E' : '#64748B',
                  flexShrink: 0,
                }}
              />
              <Typography
                variant={compact ? 'body2' : 'body1'}
                fontWeight={600} noWrap
                sx={{ color: isOn && online ? 'primary.main' : 'text.primary' }}
              >
                {channel.name || chKey.toUpperCase()}
              </Typography>
            </Box>

            <Typography
              variant="caption" color="text.secondary" fontWeight={600}
              sx={{
                px: 1, py: 0.25, borderRadius: 1,
                bgcolor: isOn && online
                  ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
                color: isOn && online ? '#22C55E' : 'text.disabled',
                fontSize: '0.65rem', letterSpacing: '0.05em', textTransform: 'uppercase',
              }}
            >
              {isOn ? 'ON' : 'OFF'}
            </Typography>

            {/* Status chips */}
            {!compact && (hasTimer || hasSchedule) && (
              <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                {hasTimer && (
                  <Chip icon={<Timer sx={{ fontSize: '12px !important' }} />} label="Timer" size="small"
                    color="warning" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                )}
                {hasSchedule && (
                  <Chip icon={<Schedule sx={{ fontSize: '12px !important' }} />} label="Scheduled" size="small"
                    color="info" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                )}
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {onEditClick && !compact && (
              <IconButton
                size="small" onClick={(e) => { e.stopPropagation(); onEditClick(); }}
                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
              >
                <Edit fontSize="small" />
              </IconButton>
            )}
            <Switch
              checked={isOn}
              disabled={!online || toggling}
              onChange={(e) => { e.stopPropagation(); handleToggle(); }}
              color="primary"
              size="small"
              onClick={(e) => e.stopPropagation()}
            />
          </Box>
        </Box>
      </Card>
    </motion.div>
  );
};

export default ChannelCard;
