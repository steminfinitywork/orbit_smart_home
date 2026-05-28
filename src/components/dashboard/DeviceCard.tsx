import React, { useState } from 'react';
import {
  Card, CardContent, Box, Typography, IconButton,
  Tooltip, useTheme, Switch, Button, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import { Settings, Router, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { DeviceDoc, DeviceRTDB } from '@/types';
import { setRelayState } from '@/firebase/realtimeDb';
import { useUIStore } from '@/store/uiStore';
import { isDeviceOnline, getLastSeenText } from '@/hooks/useHeartbeat';
import { motion } from 'framer-motion';

interface Props {
  device: DeviceDoc;
  rtdbData: DeviceRTDB | null;
  editMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const DeviceCard: React.FC<Props> = ({ device, rtdbData, editMode = false, onMoveUp, onMoveDown }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const addNotification = useUIStore((s) => s.addNotification);
  const [toggling, setToggling] = useState<Record<number, boolean>>({});

  // Offline confirm state
  const [offlineConfirmOpen, setOfflineConfirmOpen] = useState(false);
  const [pendingRelayIndex, setPendingRelayIndex] = useState<number | null>(null);
  const [pendingCurrentState, setPendingCurrentState] = useState<boolean>(false);

  const online = isDeviceOnline(rtdbData?.heartbeat);

  const executeToggle = async (relayIndex: number, currentState: boolean) => {
    setToggling(prev => ({ ...prev, [relayIndex]: true }));
    try {
      await setRelayState(device.id, relayIndex as any, !currentState);
      addNotification(`Relay ${relayIndex} instruction queued`, 'success');
    } catch {
      addNotification(`Failed to toggle Relay ${relayIndex}`, 'error');
    } finally {
      setToggling(prev => ({ ...prev, [relayIndex]: false }));
    }
  };

  const handleToggle = async (relayIndex: number, currentState: boolean) => {
    if (toggling[relayIndex]) return;

    if (!online) {
      setPendingRelayIndex(relayIndex);
      setPendingCurrentState(currentState);
      setOfflineConfirmOpen(true);
      return;
    }

    await executeToggle(relayIndex, currentState);
  };

  const handleConfirmOfflineToggle = async () => {
    setOfflineConfirmOpen(false);
    if (pendingRelayIndex !== null) {
      await executeToggle(pendingRelayIndex, pendingCurrentState);
      setPendingRelayIndex(null);
    }
  };

  const ch1State = rtdbData?.ch1 === 1;
  const ch2State = rtdbData?.ch2 === 1;
  const relayCount = device.relayCount || 2;

  const relays = [
    { index: 1, name: 'Relay 1', state: ch1State },
    { index: 2, name: 'Relay 2', state: ch2State },
  ].slice(0, relayCount);

  return (
    <motion.div layout transition={{ duration: 0.2 }}>
      <Card
        sx={{
          border: '1px solid',
          borderColor: online
            ? theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)'
            : theme.palette.divider,
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(13,27,62,0.4), rgba(20,30,60,0.2))'
            : 'rgba(255,255,255,0.7)',
          boxShadow: online ? '0 4px 20px rgba(99,102,241,0.05)' : 'none',
          transition: 'all 0.3s ease',
          borderRadius: 4,
          overflow: 'visible',
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {/* Main Info Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            {/* Edit Mode Reorder Arrows */}
            {editMode && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mr: 0.5 }}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }} disabled={!onMoveUp}>
                  <ArrowUpward fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }} disabled={!onMoveDown}>
                  <ArrowDownward fontSize="small" />
                </IconButton>
              </Box>
            )}

            {/* Device Icon */}
            <Box sx={{
              p: 1, borderRadius: 3, flexShrink: 0,
              background: online
                ? 'linear-gradient(135deg, #6366F1, #06B6D4)'
                : 'rgba(100,116,139,0.12)',
              color: online ? '#fff' : 'text.disabled',
              display: 'flex',
            }}>
              <Router sx={{ fontSize: 20 }} />
            </Box>

            {/* Title & Heartbeat */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{
                  width: 7, height: 7, borderRadius: '50%',
                  bgcolor: online ? '#10B981' : '#EF4444',
                  boxShadow: online ? '0 0 6px #10B981' : 'none',
                }} />
                <Typography variant="subtitle1" fontWeight={750} noWrap>{device.deviceName}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                {device.id} · {online ? 'Online' : 'Offline'} · {getLastSeenText(rtdbData?.heartbeat)}
              </Typography>
            </Box>

            {/* Settings Button */}
            {!editMode && (
              <Tooltip title="Device Settings">
                <IconButton size="small" onClick={() => navigate(`/device/${device.id}`)}>
                  <Settings sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Relays Direct Toggle Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
            {relays.map((relay) => (
              <Box
                key={relay.index}
                onClick={() => handleToggle(relay.index, relay.state)}
                sx={{
                  p: 1.5,
                  borderRadius: 3.5,
                  border: '1px solid',
                  borderColor: relay.state && online
                    ? 'rgba(99,102,241,0.35)'
                    : 'transparent',
                  background: relay.state && online
                    ? theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(6,182,212,0.12))'
                      : 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,182,212,0.04))'
                    : theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  opacity: online ? 1 : 0.8,
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  '&:hover': {
                    borderColor: 'rgba(99,102,241,0.45)',
                  },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} noWrap sx={{ color: relay.state && online ? 'primary.main' : 'text.primary' }}>
                    {relay.name}
                  </Typography>
                  <Typography variant="caption" sx={{
                    fontSize: 9, fontWeight: 800, px: 0.75, py: 0.15, borderRadius: 1,
                    bgcolor: relay.state && online ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                    color: relay.state && online ? '#10B981' : 'text.secondary',
                    textTransform: 'uppercase', letterSpacing: '0.02em',
                  }}>
                    {relay.state ? 'ON' : 'OFF'}
                  </Typography>
                </Box>
                <Switch
                  checked={relay.state}
                  disabled={toggling[relay.index]}
                  onChange={(e) => { e.stopPropagation(); handleToggle(relay.index, relay.state); }}
                  onClick={(e) => e.stopPropagation()}
                  size="small"
                  color="primary"
                />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Offline state-toggle confirmation reminder dialog */}
      <Dialog
        open={offlineConfirmOpen}
        onClose={() => setOfflineConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, maxWidth: 320, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1, textTransform: 'none' }}>
          Device is Offline 🔴
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            The device is currently offline. Do you still want to change the relay state? It will be applied automatically once the device reconnects.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setOfflineConfirmOpen(false)} sx={{ fontWeight: 700, borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmOfflineToggle}
            sx={{ fontWeight: 800, borderRadius: 2 }}
          >
            Okay
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
};

export default DeviceCard;
