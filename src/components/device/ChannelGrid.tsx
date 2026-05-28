import React, { useState } from 'react';
import {
  Box, Typography, TextField, IconButton, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Divider, Chip,
} from '@mui/material';
import { Edit, Save, Cancel, Timer, Schedule, Repeat } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { Channel, ChannelKey } from '@/types';
import { renameChannel, setChannelTimer, setChannelSchedule } from '@/firebase/realtimeDb';
import { useUIStore } from '@/store/uiStore';
import ChannelCard from '@/components/dashboard/ChannelCard';
import ScheduleForm from '@/components/automation/ScheduleForm';
import CountdownTimer from '@/components/automation/CountdownTimer';

interface Props {
  deviceId: string;
  channels: Record<ChannelKey, Channel>;
  online: boolean;
}

const ChannelGrid: React.FC<Props> = ({ deviceId, channels, online }) => {
  const addNotification = useUIStore((s) => s.addNotification);
  const [editingKey, setEditingKey] = useState<ChannelKey | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [scheduleDialog, setScheduleDialog] = useState<ChannelKey | null>(null);
  const [timerDialog, setTimerDialog] = useState<ChannelKey | null>(null);

  const chKeys = Object.keys(channels).sort() as ChannelKey[];

  const handleRename = async (chKey: ChannelKey) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await renameChannel(deviceId, chKey, editName.trim());
      addNotification(`Channel renamed to "${editName.trim()}"`, 'success');
      setEditingKey(null);
    } catch {
      addNotification('Failed to rename channel', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" fontWeight={600}
        textTransform="uppercase" letterSpacing="0.08em" mb={2}>
        Channels ({chKeys.length})
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {chKeys.map((chKey) => {
          const ch = channels[chKey];
          const isEditing = editingKey === chKey;

          return (
            <motion.div
              key={chKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
                {/* Channel toggle card */}
                <Box sx={{ p: 1.5 }}>
                  <ChannelCard
                    deviceId={deviceId}
                    chKey={chKey}
                    channel={ch}
                    online={online}
                    onEditClick={() => {
                      setEditingKey(chKey);
                      setEditName(ch.name || chKey);
                    }}
                  />
                </Box>

                <Divider />

                {/* Rename inline */}
                {isEditing && (
                  <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1, alignItems: 'center', bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Rename:</Typography>
                    <TextField
                      size="small" value={editName} fullWidth autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(chKey);
                        if (e.key === 'Escape') setEditingKey(null);
                      }}
                    />
                    <IconButton size="small" onClick={() => handleRename(chKey)} color="primary" disabled={saving}>
                      {saving ? <CircularProgress size={16} /> : <Save fontSize="small" />}
                    </IconButton>
                    <IconButton size="small" onClick={() => setEditingKey(null)}><Cancel fontSize="small" /></IconButton>
                  </Box>
                )}

                {/* Action row */}
                <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    icon={<Timer sx={{ fontSize: '14px !important' }} />}
                    label={ch.timer?.enabled ? `Timer: ${Math.floor(ch.timer.duration / 60)}m` : 'Add Timer'}
                    size="small" variant="outlined"
                    color={ch.timer?.enabled ? 'warning' : 'default'}
                    onClick={() => setTimerDialog(chKey)}
                    sx={{ cursor: 'pointer', fontWeight: 600 }}
                  />
                  <Chip
                    icon={<Schedule sx={{ fontSize: '14px !important' }} />}
                    label={ch.schedule?.enabled ? `${ch.schedule.onTime}–${ch.schedule.offTime}` : 'Add Schedule'}
                    size="small" variant="outlined"
                    color={ch.schedule?.enabled ? 'info' : 'default'}
                    onClick={() => setScheduleDialog(chKey)}
                    sx={{ cursor: 'pointer', fontWeight: 600 }}
                  />
                </Box>
              </Box>
            </motion.div>
          );
        })}
      </Box>

      {/* Timer Dialog */}
      <Dialog open={!!timerDialog} onClose={() => setTimerDialog(null)} PaperProps={{ sx: { borderRadius: 4, width: 360 } }}>
        <DialogTitle fontWeight={700}>
          <Timer sx={{ mr: 1, verticalAlign: 'middle', color: 'warning.main' }} />
          Countdown Timer
        </DialogTitle>
        <DialogContent>
          {timerDialog && (
            <CountdownTimer
              deviceId={deviceId}
              chKey={timerDialog}
              channel={channels[timerDialog]}
              onDone={() => setTimerDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={!!scheduleDialog} onClose={() => setScheduleDialog(null)} PaperProps={{ sx: { borderRadius: 4, width: 420 } }}>
        <DialogTitle fontWeight={700}>
          <Schedule sx={{ mr: 1, verticalAlign: 'middle', color: 'info.main' }} />
          Schedule Automation
        </DialogTitle>
        <DialogContent>
          {scheduleDialog && (
            <ScheduleForm
              deviceId={deviceId}
              chKey={scheduleDialog}
              channel={channels[scheduleDialog]}
              onDone={() => setScheduleDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ChannelGrid;
