import React, { useState } from 'react';
import {
  Box, Typography, Button, Tab, Tabs, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, CircularProgress,
  Alert, Fab,
} from '@mui/material';
import { Add, ElectricBolt } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useAutomations } from '@/hooks/useAutomation';
import { useDeviceStore } from '@/store/deviceStore';
import { createAutomation } from '@/firebase/firestore';
import { useUIStore } from '@/store/uiStore';
import AutomationCard from '@/components/automation/AutomationCard';
import EmptyState from '@/components/common/EmptyState';
import CountdownTimer from '@/components/automation/CountdownTimer';
import ScheduleForm from '@/components/automation/ScheduleForm';

const AutomationPage: React.FC = () => {
  const { user } = useAuthStore();
  const { automations, loading } = useAutomations(user?.uid);
  const { devices, rtdbData } = useDeviceStore();
  const addNotification = useUIStore((s) => s.addNotification);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [selectedType, setSelectedType] = useState<'countdown' | 'schedule' | 'weekly'>('schedule');
  const [label, setLabel] = useState('');

  const device = devices.find((d) => d.id === selectedDevice);
  const channels = device ? (rtdbData[device.id]?.channels ?? {}) : {};
  const chKeys = Object.keys(channels).sort();

  const resetDialog = () => {
    setStep(0); setSelectedDevice(''); setSelectedChannel('');
    setSelectedType('schedule'); setLabel(''); setDialogOpen(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Automation</Typography>
          <Typography variant="body2" color="text.secondary">Schedule and timer rules</Typography>
        </Box>
        <Button
          variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}
          sx={{ background: 'linear-gradient(135deg, #6366F1, #06B6D4)', fontWeight: 700, display: { xs: 'none', sm: 'flex' } }}
        >
          New Rule
        </Button>
      </Box>

      {/* Filter tabs */}
      <Tabs value={0} sx={{ mb: 2, '& .MuiTab-root': { fontWeight: 600 } }}>
        <Tab label={`All (${automations.length})`} />
      </Tabs>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
      ) : automations.length === 0 ? (
        <EmptyState
          icon={<ElectricBolt />}
          title="No automations yet"
          description="Create countdown timers, daily schedules, and weekly routines for your devices."
          actionLabel="+ Create Automation"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <AnimatePresence>
            {automations.map((a) => <AutomationCard key={a.id} automation={a} />)}
          </AnimatePresence>
        </Box>
      )}

      <Fab
        color="primary" onClick={() => setDialogOpen(true)}
        sx={{
          position: 'fixed', bottom: { xs: 80, md: 24 }, right: 24,
          display: { sm: 'none' },
          background: 'linear-gradient(135deg, #6366F1, #06B6D4)',
        }}
      >
        <Add />
      </Fab>

      {/* Create Automation Dialog */}
      <Dialog open={dialogOpen} onClose={resetDialog} PaperProps={{ sx: { borderRadius: 4, width: 440 } }}>
        <DialogTitle fontWeight={700}>
          {step === 0 ? 'New Automation — Select Device' : step === 1 ? 'Configure Rule' : 'Label & Save'}
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          {step === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                select label="Device" fullWidth
                value={selectedDevice} onChange={(e) => { setSelectedDevice(e.target.value); setSelectedChannel(''); }}
              >
                {devices.map((d) => <MenuItem key={d.id} value={d.id}>{d.deviceName}</MenuItem>)}
              </TextField>
              <TextField
                select label="Channel" fullWidth disabled={!selectedDevice}
                value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)}
              >
                {chKeys.map((k) => (
                  <MenuItem key={k} value={k}>
                    {channels[k as keyof typeof channels]?.name || k.toUpperCase()}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select label="Automation Type" fullWidth
                value={selectedType} onChange={(e) => setSelectedType(e.target.value as any)}
              >
                <MenuItem value="countdown">⏱ Countdown Timer</MenuItem>
                <MenuItem value="schedule">📅 Daily Schedule</MenuItem>
                <MenuItem value="weekly">🔁 Weekly Schedule</MenuItem>
              </TextField>
              <TextField
                label="Rule Label" fullWidth value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Bedroom Fan — Morning"
              />
            </Box>
          )}

          {step === 1 && device && selectedChannel && selectedType === 'countdown' && (
            <CountdownTimer
              deviceId={device.id}
              chKey={selectedChannel as any}
              channel={channels[selectedChannel as keyof typeof channels]}
              onDone={() => { addNotification(`Automation "${label}" created`, 'success'); resetDialog(); }}
            />
          )}

          {step === 1 && device && selectedChannel && (selectedType === 'schedule' || selectedType === 'weekly') && (
            <ScheduleForm
              deviceId={device.id}
              chKey={selectedChannel as any}
              channel={channels[selectedChannel as keyof typeof channels]}
              onDone={() => { addNotification(`Automation "${label}" created`, 'success'); resetDialog(); }}
            />
          )}
        </DialogContent>
        {step === 0 && (
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={resetDialog}>Cancel</Button>
            <Button
              variant="contained" disabled={!selectedDevice || !selectedChannel || !label.trim()}
              onClick={() => setStep(1)}
              sx={{ background: 'linear-gradient(135deg, #6366F1, #06B6D4)', fontWeight: 700 }}
            >
              Next →
            </Button>
          </DialogActions>
        )}
        {step === 1 && (
          <DialogActions sx={{ px: 3, pb: 1 }}>
            <Button onClick={() => setStep(0)} size="small">← Back</Button>
          </DialogActions>
        )}
      </Dialog>
    </motion.div>
  );
};

export default AutomationPage;
