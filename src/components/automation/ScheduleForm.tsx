import React, { useState } from 'react';
import {
  Box, TextField, Button, FormControlLabel, Switch, Alert,
  CircularProgress, Typography, Divider, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import { Channel, ChannelKey } from '@/types';
import { setChannelSchedule } from '@/firebase/realtimeDb';
import { useUIStore } from '@/store/uiStore';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  deviceId: string;
  chKey: ChannelKey;
  channel: Channel;
  onDone: () => void;
}

const ScheduleForm: React.FC<Props> = ({ deviceId, chKey, channel, onDone }) => {
  const addNotification = useUIStore((s) => s.addNotification);
  const [onTime, setOnTime] = useState(channel.schedule?.onTime || '08:00');
  const [offTime, setOffTime] = useState(channel.schedule?.offTime || '18:00');
  const [days, setDays] = useState<number[]>(channel.schedule?.days || [1, 2, 3, 4, 5]);
  const [enabled, setEnabled] = useState(channel.schedule?.enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!onTime || !offTime) { setError('Both ON and OFF times are required.'); return; }
    setSaving(true);
    setError('');
    try {
      await setChannelSchedule(deviceId, chKey, { enabled, onTime, offTime, days });
      addNotification(enabled ? `📅 Schedule set: ${onTime} – ${offTime}` : 'Schedule disabled', enabled ? 'success' : 'info');
      onDone();
    } catch {
      setError('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleDayToggle = (_: React.MouseEvent, newDays: number[]) => {
    setDays(newDays);
  };

  return (
    <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

      <FormControlLabel
        control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} color="info" />}
        label={<Typography variant="body2" fontWeight={600}>Enable Schedule</Typography>}
      />

      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField
          label="ON Time" type="time" size="small" fullWidth
          value={onTime} onChange={(e) => setOnTime(e.target.value)}
          InputLabelProps={{ shrink: true }}
          disabled={!enabled}
        />
        <TextField
          label="OFF Time" type="time" size="small" fullWidth
          value={offTime} onChange={(e) => setOffTime(e.target.value)}
          InputLabelProps={{ shrink: true }}
          disabled={!enabled}
        />
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
          Repeat Days (empty = daily)
        </Typography>
        <ToggleButtonGroup
          value={days} onChange={handleDayToggle}
          size="small" sx={{ flexWrap: 'wrap', gap: 0.5 }}
          disabled={!enabled}
        >
          {DAYS.map((d, i) => (
            <ToggleButton
              key={i} value={i}
              sx={{
                borderRadius: '8px !important',
                border: '1px solid !important',
                borderColor: 'divider !important',
                minWidth: 40, fontWeight: 700, fontSize: 11,
                '&.Mui-selected': {
                  bgcolor: 'info.main',
                  color: '#fff',
                  '&:hover': { bgcolor: 'info.dark' },
                },
              }}
            >
              {d}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Button
        variant="contained" fullWidth onClick={handleSave} disabled={saving}
        color="info" sx={{ fontWeight: 700, py: 1.25 }}
      >
        {saving ? <CircularProgress size={20} color="inherit" /> : 'Save Schedule'}
      </Button>
    </Box>
  );
};

export default ScheduleForm;
