import React, { useState } from 'react';
import {
  Box, Typography, Slider, Button, CircularProgress, Alert,
  FormControlLabel, Switch, Divider,
} from '@mui/material';
import { Timer } from '@mui/icons-material';
import { Channel, ChannelKey } from '@/types';
import { setChannelTimer, setChannelState } from '@/firebase/realtimeDb';
import { useUIStore } from '@/store/uiStore';

interface Props {
  deviceId: string;
  chKey: ChannelKey;
  channel: Channel;
  onDone: () => void;
}

const CountdownTimer: React.FC<Props> = ({ deviceId, chKey, channel, onDone }) => {
  const addNotification = useUIStore((s) => s.addNotification);
  const [minutes, setMinutes] = useState(30);
  const [turnOn, setTurnOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const duration = minutes * 60;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Turn on the channel immediately if requested
      if (turnOn) await setChannelState(deviceId, chKey, true);
      // Set the timer in RTDB (ESP8266 reads this and counts down)
      await setChannelTimer(deviceId, chKey, duration, true);
      addNotification(`⏱ Timer set for ${minutes} minutes`, 'success');
      onDone();
    } catch {
      setError('Failed to set timer');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await setChannelTimer(deviceId, chKey, 0, false);
      addNotification('Timer cleared', 'info');
      onDone();
    } catch {
      setError('Failed to clear timer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ pt: 1 }}>
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {channel.timer?.enabled && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          A timer is already active ({Math.floor(channel.timer.duration / 60)} min). Setting a new one will replace it.
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary" mb={1}>Duration</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Timer color="warning" />
        <Typography variant="h5" fontWeight={700} color="warning.main" sx={{ minWidth: 80 }}>
          {minutes >= 60
            ? `${Math.floor(minutes / 60)}h ${minutes % 60 > 0 ? `${minutes % 60}m` : ''}`
            : `${minutes}m`}
        </Typography>
      </Box>

      <Slider
        value={minutes}
        onChange={(_, v) => setMinutes(v as number)}
        min={1} max={480} step={1}
        color="warning"
        marks={[
          { value: 30, label: '30m' },
          { value: 60, label: '1h' },
          { value: 120, label: '2h' },
          { value: 240, label: '4h' },
          { value: 480, label: '8h' },
        ]}
        sx={{ mb: 3 }}
      />

      <Divider sx={{ mb: 2 }} />

      <FormControlLabel
        control={<Switch checked={turnOn} onChange={(e) => setTurnOn(e.target.checked)} color="success" />}
        label={<Typography variant="body2">Turn ON channel immediately</Typography>}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained" fullWidth onClick={handleSave} disabled={saving}
          color="warning" sx={{ fontWeight: 700 }}
        >
          {saving ? <CircularProgress size={20} /> : `Set ${minutes}m Timer`}
        </Button>
        {channel.timer?.enabled && (
          <Button variant="outlined" color="error" onClick={handleClear} disabled={saving}>
            Clear
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default CountdownTimer;
