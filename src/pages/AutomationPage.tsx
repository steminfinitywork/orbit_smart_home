import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, MenuItem,
  TextField, Switch, Tabs, Tab, Button, Slider, Divider,
  CircularProgress, Alert, useTheme,
} from '@mui/material';
import { ElectricBolt, Schedule, Timer as TimerIcon, Close, PowerSettingsNew } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useDeviceStore } from '@/store/deviceStore';
import { setRelayAutomation, setRelayTimer } from '@/firebase/realtimeDb';
import { useUIStore } from '@/store/uiStore';
import { isDeviceOnline } from '@/hooks/useHeartbeat';

const PRESETS = [1, 5, 10, 15, 30, 60];

const AutomationPage: React.FC = () => {
  const theme = useTheme();
  const { devices, rtdbData } = useDeviceStore();
  const addNotification = useUIStore((s) => s.addNotification);

  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedRelay, setSelectedRelay] = useState(1);
  const [subTab, setSubTab] = useState(0); // 0 = Schedule, 1 = Timer

  // Schedule Fields
  const [autoOn, setAutoOn] = useState('22:00');
  const [autoOff, setAutoOff] = useState('22:10');

  // Timer Fields
  const [timerDuration, setTimerDuration] = useState(10);

  const [saving, setSaving] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const device = devices.find((d) => d.id === selectedDevice);
  const rtdb = device ? rtdbData[device.id] : null;
  const online = isDeviceOnline(rtdb?.heartbeat);

  // Sync state values with active automation from DB on selection change
  useEffect(() => {
    if (rtdb && rtdb.auto_channel === selectedRelay) {
      if (rtdb.auto_on) setAutoOn(rtdb.auto_on);
      if (rtdb.auto_off) setAutoOff(rtdb.auto_off);
    }
  }, [selectedDevice, selectedRelay, rtdb]);

  // Set default selection when devices load
  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0].id);
    }
  }, [devices, selectedDevice]);

  // Active status checks
  const isAutoEnabled = rtdb && rtdb.auto === 1 && rtdb.auto_channel === selectedRelay;
  const isTimerActive = rtdb && rtdb.timer === 1 && rtdb.auto_channel === selectedRelay && rtdb.auto_off;

  // Countdown timer calculation from "auto_off" HH:mm string
  useEffect(() => {
    if (!isTimerActive || !rtdb?.auto_off) {
      setTimeRemaining(null);
      return;
    }

    const updateTime = () => {
      const [h, m] = rtdb.auto_off.split(':').map(Number);
      const target = new Date();
      target.setHours(h, m, 0, 0);

      // If target has already passed today, assume it crosses midnight
      if (target.getTime() < Date.now()) {
        target.setDate(target.getDate() + 1);
      }

      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setTimeRemaining(null);
      } else {
        setTimeRemaining(diff);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isTimerActive, rtdb?.auto_off]);

  const handleSaveAutomation = async (enable: boolean) => {
    if (!selectedDevice || saving) return;
    if (!online && enable) {
      addNotification('Device is offline', 'error');
      return;
    }
    setSaving(true);
    try {
      await setRelayAutomation(selectedDevice, selectedRelay, autoOn, autoOff, enable);
      addNotification(
        enable
          ? `📅 Automation enabled: ON at ${autoOn} · OFF at ${autoOff}`
          : '📅 Automation disabled',
        enable ? 'success' : 'info'
      );
    } catch {
      addNotification('Failed to update automation', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStartTimer = async () => {
    if (!selectedDevice || saving) return;
    if (!online) {
      addNotification('Device is offline', 'error');
      return;
    }
    setSaving(true);
    try {
      await setRelayTimer(selectedDevice, selectedRelay, timerDuration, true);
      addNotification(`⏱ Timer started for ${timerDuration} mins`, 'success');
    } catch {
      addNotification('Failed to start timer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelTimer = async () => {
    if (!selectedDevice || saving) return;
    setSaving(true);
    try {
      await setRelayTimer(selectedDevice, selectedRelay, 0, false);
      addNotification('Timer cancelled', 'warning');
    } catch {
      addNotification('Failed to cancel timer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs > 0 ? `${hrs}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={850}>Automation</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Set schedules and countdown timers for device relays
        </Typography>
      </Box>

      {devices.length === 0 ? (
        <Card sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 4, py: 4 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <ElectricBolt sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.5, mb: 2 }} />
            <Typography variant="subtitle1" fontWeight={750}>No paired devices</Typography>
            <Typography variant="body2" color="text.secondary">You need to pair a device before using automation.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 500, mx: 'auto' }}>
          {/* Target Selectors */}
          <Card sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 4 }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                select label="Target Device" fullWidth
                value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}
              >
                {devices.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.deviceName} ({rtdbData[d.id]?.status === 'online' ? '🟢 Online' : '🔴 Offline'})
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select label="Target Relay" fullWidth
                value={selectedRelay} onChange={(e) => setSelectedRelay(Number(e.target.value))}
              >
                <MenuItem value={1}>Relay 1</MenuItem>
                {device && device.relayCount > 1 && (
                  <MenuItem value={2}>Relay 2</MenuItem>
                )}
              </TextField>
            </CardContent>
          </Card>

          {/* Sub-Tabs Selector */}
          <Tabs
            value={subTab}
            onChange={(_, val) => setSubTab(val)}
            centered
            sx={{
              borderBottom: 1, borderColor: 'divider',
              '& .MuiTab-root': { fontWeight: 700, fontSize: 13, textTransform: 'none' }
            }}
          >
            <Tab icon={<Schedule sx={{ fontSize: '18px !important' }} />} label="Daily Schedule" />
            <Tab icon={<TimerIcon sx={{ fontSize: '18px !important' }} />} label="Countdown Timer" />
          </Tabs>

          {/* Tab Panels */}
          <Box sx={{ minHeight: 280 }}>
            <AnimatePresence mode="wait">
              {/* Daily Schedule Tab */}
              {subTab === 0 && (
                <motion.div
                  key="schedule"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 4, p: 3 }}>
                    <AnimatePresence mode="wait">
                      {isAutoEnabled ? (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
                          <Alert severity="success" sx={{ mb: 3, borderRadius: 2.5, fontWeight: 700 }}>
                            Active: ON at {autoOn} · OFF at {autoOff}
                          </Alert>
                        </motion.div>
                      ) : (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
                          <Alert severity="info" sx={{ mb: 3, borderRadius: 2.5, fontWeight: 700 }}>
                            Schedule automation is disabled
                          </Alert>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Typography variant="subtitle2" fontWeight={750} color="text.secondary" mb={2.5}>
                      Set ON/OFF Times
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                      <TextField
                        label="Turn ON Time"
                        type="time"
                        value={autoOn}
                        onChange={(e) => setAutoOn(e.target.value)}
                        fullWidth
                        slotProps={{ htmlInput: { step: 300 } }}
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="Turn OFF Time"
                        type="time"
                        value={autoOff}
                        onChange={(e) => setAutoOff(e.target.value)}
                        fullWidth
                        slotProps={{ htmlInput: { step: 300 } }}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Box>

                    <Divider sx={{ my: 2.5 }} />

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          Enable Daily Schedule
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Triggers ON/OFF at specified times daily
                        </Typography>
                      </Box>
                      <Switch
                        checked={!!isAutoEnabled}
                        disabled={!online || saving}
                        onChange={(e) => handleSaveAutomation(e.target.checked)}
                        color="success"
                      />
                    </Box>
                  </Card>
                </motion.div>
              )}

              {/* Countdown Timer Tab */}
              {subTab === 1 && (
                <motion.div
                  key="timer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {isTimerActive && timeRemaining !== null ? (
                    /* Active Visualizer */
                    <Card sx={{
                      border: '1px solid',
                      borderColor: 'rgba(245,158,11,0.3)',
                      background: theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(20,20,20,0.4))'
                        : 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(255,255,255,0.7))',
                      boxShadow: 'none', borderRadius: 4, textAlign: 'center', py: 4, px: 3,
                    }}>
                      <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <Typography variant="subtitle1" fontWeight={750} color="warning.main">
                          Relay {selectedRelay} Timer Running
                        </Typography>

                        {/* Circular progress clock */}
                        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', my: 1.5 }}>
                          <CircularProgress
                            variant="determinate"
                            value={Math.max(0, Math.min(100, (timeRemaining / (timerDuration * 60 * 1000)) * 100))}
                            color="warning"
                            size={140}
                            thickness={2.5}
                            sx={{ filter: 'drop-shadow(0px 0px 8px rgba(245,158,11,0.3))' }}
                          />
                          <Box sx={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="h4" fontWeight={850} color="warning.main" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatTime(timeRemaining)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, fontWeight: 700, mt: 0.25 }}>
                              REMAINING
                            </Typography>
                          </Box>
                        </Box>

                        <Button
                          variant="contained"
                          color="error"
                          onClick={handleCancelTimer}
                          disabled={saving}
                          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Close />}
                          sx={{ fontWeight: 700, borderRadius: 2.5, px: 4, textTransform: 'none', mt: 1 }}
                        >
                          Cancel Timer
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    /* Setup Form */
                    <Card sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 4, p: 3 }}>
                      <Typography variant="subtitle2" fontWeight={750} color="text.secondary" mb={2}>
                        Duration (Minutes)
                      </Typography>

                      {/* Presets */}
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 3 }}>
                        {PRESETS.map((p) => (
                          <Button
                            key={p}
                            variant={timerDuration === p ? 'contained' : 'outlined'}
                            color="warning"
                            onClick={() => setTimerDuration(p)}
                            sx={{
                              borderRadius: 3,
                              fontWeight: 700,
                              py: 1,
                              fontSize: 12,
                              borderWidth: '1.5px !important',
                              boxShadow: 'none',
                              textTransform: 'none',
                            }}
                          >
                            {p}m
                          </Button>
                        ))}
                      </Box>

                      {/* Slider */}
                      <Box sx={{ px: 1, mb: 3 }}>
                        <Slider
                          value={timerDuration}
                          onChange={(_, v) => setTimerDuration(v as number)}
                          min={1} max={120} step={1}
                          color="warning"
                          valueLabelDisplay="auto"
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">1 Min</Typography>
                          <Typography variant="caption" fontWeight={700} color="warning.main">{timerDuration} Mins</Typography>
                          <Typography variant="caption" color="text.secondary">2 Hours</Typography>
                        </Box>
                      </Box>

                      <Divider sx={{ my: 2.5 }} />

                      <Button
                        variant="contained"
                        fullWidth
                        color="warning"
                        disabled={!online || saving}
                        onClick={handleStartTimer}
                        startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <PowerSettingsNew />}
                        sx={{
                          py: 1.25,
                          borderRadius: 3,
                          fontWeight: 800,
                          boxShadow: '0 4px 12px rgba(245,158,11,0.15)',
                          textTransform: 'none',
                        }}
                      >
                        {!online ? 'Device is Offline' : `Start ${timerDuration} Min Timer`}
                      </Button>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </Box>
      )}
    </motion.div>
  );
};

export default AutomationPage;
