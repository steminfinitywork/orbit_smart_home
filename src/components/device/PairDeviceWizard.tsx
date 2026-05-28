import React, { useState } from 'react';
import {
  Box, TextField, Button, Typography, Stepper, Step, StepLabel,
  Alert, CircularProgress, MenuItem, InputAdornment, Paper, Divider, Chip,
} from '@mui/material';
import { Router, Lock, Label, MeetingRoom, CheckCircle } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getDeviceInfo, claimDevice } from '@/firebase/realtimeDb';
import { createDevice } from '@/firebase/firestore';
import { useAuthStore } from '@/store/authStore';
import { useDeviceStore } from '@/store/deviceStore';
import { useUIStore } from '@/store/uiStore';
import { DeviceInfo } from '@/types';
import { useNavigate } from 'react-router-dom';

// Simple SHA-256 using SubtleCrypto
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const steps = ['Device Credentials', 'Device Found', 'Name & Room'];

const step1Schema = z.object({
  deviceId: z.string().min(3, 'Device ID is required'),
  password: z.string().min(4, 'Password is required'),
});
type Step1Data = z.infer<typeof step1Schema>;

const step3Schema = z.object({
  deviceName: z.string().min(1, 'Device name is required'),
  roomId: z.string().optional(),
});
type Step3Data = z.infer<typeof step3Schema>;

const PairDeviceWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { rooms } = useDeviceStore();
  const addNotification = useUIStore((s) => s.addNotification);

  const [activeStep, setActiveStep] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [foundDevice, setFoundDevice] = useState<DeviceInfo | null>(null);
  const [deviceId, setDeviceId] = useState('');

  const step1Form = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const step3Form = useForm<Step3Data>({ resolver: zodResolver(step3Schema), defaultValues: { deviceName: '', roomId: '' } });

  const handleVerify = async (data: Step1Data) => {
    setVerifying(true);
    setError('');
    try {
      const info = await getDeviceInfo(data.deviceId);
      if (!info) {
        setError('Device not found. Check the Device ID and try again.');
        return;
      }
      if (info.ownerId && info.ownerId !== '') {
        setError('This device is already paired to an account.');
        return;
      }
      const inputHash = await sha256(data.password);
      if (info.password !== inputHash) {
        setError('Invalid device password.');
        return;
      }
      setFoundDevice(info);
      setDeviceId(data.deviceId);
      step3Form.setValue('deviceName', `Device ${data.deviceId.slice(-6)}`);
      setActiveStep(1);
      setTimeout(() => setActiveStep(2), 1500);
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handlePair = async (data: Step3Data) => {
    if (!user || !foundDevice) return;
    setVerifying(true);
    try {
      await claimDevice(deviceId, user.uid);
      await createDevice(deviceId, {
        ownerUid: user.uid,
        deviceName: data.deviceName,
        roomId: data.roomId || null,
        relayCount: foundDevice.relayCount,
        deviceType: foundDevice.deviceType as any,
        firmwareVersion: foundDevice.firmwareVersion,
        onlineStatus: false,
        lastHeartbeat: null,
      } as any);
      addNotification(`✅ ${data.deviceName} added successfully!`, 'success');
      navigate('/dashboard');
    } catch {
      setError('Failed to pair device. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto' }}>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      <AnimatePresence mode="wait">
        {/* Step 0 — Enter credentials */}
        {activeStep === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <Paper sx={{ p: 3, borderRadius: 4 }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box sx={{
                  width: 64, height: 64, borderRadius: 3, mx: 'auto', mb: 2,
                  background: 'linear-gradient(135deg, #6366F1, #06B6D4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Router sx={{ color: '#fff', fontSize: 32 }} />
                </Box>
                <Typography variant="h6" fontWeight={700}>Enter Device Credentials</Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Found on the device label or packaging
                </Typography>
              </Box>

              {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

              <Box component="form" onSubmit={step1Form.handleSubmit(handleVerify)}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Device ID" fullWidth placeholder="e.g. ESP8266-A7F3B2"
                  {...step1Form.register('deviceId')}
                  error={!!step1Form.formState.errors.deviceId}
                  helperText={step1Form.formState.errors.deviceId?.message}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Router sx={{ fontSize: 20, color: 'text.disabled' }} /></InputAdornment> }}
                />
                <TextField
                  label="Device Password" type="password" fullWidth placeholder="e.g. M8K92QZ1"
                  {...step1Form.register('password')}
                  error={!!step1Form.formState.errors.password}
                  helperText={step1Form.formState.errors.password?.message}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Lock sx={{ fontSize: 20, color: 'text.disabled' }} /></InputAdornment> }}
                />
                <Button
                  type="submit" variant="contained" size="large" fullWidth
                  disabled={verifying}
                  sx={{
                    py: 1.5, fontWeight: 700, mt: 1,
                    background: 'linear-gradient(135deg, #6366F1, #06B6D4)',
                    '&:hover': { background: 'linear-gradient(135deg, #4F46E5, #0891B2)' },
                  }}
                >
                  {verifying ? <CircularProgress size={22} color="inherit" /> : 'Verify Device'}
                </Button>
              </Box>
            </Paper>
          </motion.div>
        )}

        {/* Step 1 — Found animation */}
        {activeStep === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
            <Paper sx={{ p: 4, borderRadius: 4, textAlign: 'center' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, ease: 'easeInOut' }}
              >
                <CheckCircle sx={{ fontSize: 72, color: '#22C55E' }} />
              </motion.div>
              <Typography variant="h6" fontWeight={700} mt={2}>Device Found!</Typography>
              <Typography color="text.secondary">Verifying credentials…</Typography>
              <CircularProgress size={28} sx={{ mt: 2 }} />
            </Paper>
          </motion.div>
        )}

        {/* Step 2 — Name and room */}
        {activeStep === 2 && foundDevice && (
          <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
            <Paper sx={{ p: 3, borderRadius: 4 }}>
              {/* Device info summary */}
              <Box sx={{ mb: 2.5, p: 2, borderRadius: 3, bgcolor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Typography variant="subtitle2" fontWeight={700} mb={1}>Device Detected</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={`Type: ${foundDevice.deviceType}`} size="small" color="primary" variant="outlined" />
                  <Chip label={`${foundDevice.relayCount} Channels`} size="small" color="secondary" variant="outlined" />
                  <Chip label={`FW: ${foundDevice.firmwareVersion}`} size="small" variant="outlined" />
                </Box>
              </Box>

              {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

              <Box component="form" onSubmit={step3Form.handleSubmit(handlePair)}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Device Name" fullWidth placeholder="e.g. Living Room Controller"
                  {...step3Form.register('deviceName')}
                  error={!!step3Form.formState.errors.deviceName}
                  helperText={step3Form.formState.errors.deviceName?.message}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Label sx={{ fontSize: 20, color: 'text.disabled' }} /></InputAdornment> }}
                />
                <TextField
                  select label="Assign to Room (optional)" fullWidth
                  {...step3Form.register('roomId')}
                  InputProps={{ startAdornment: <InputAdornment position="start"><MeetingRoom sx={{ fontSize: 20, color: 'text.disabled' }} /></InputAdornment> }}
                >
                  <MenuItem value="">No Room</MenuItem>
                  {rooms.map((r) => (
                    <MenuItem key={r.id} value={r.id}>{r.icon} {r.name}</MenuItem>
                  ))}
                </TextField>
                <Button
                  type="submit" variant="contained" size="large" fullWidth disabled={verifying}
                  sx={{
                    py: 1.5, fontWeight: 700, mt: 1,
                    background: 'linear-gradient(135deg, #6366F1, #06B6D4)',
                  }}
                >
                  {verifying ? <CircularProgress size={22} color="inherit" /> : '🔗 Pair Device'}
                </Button>
              </Box>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default PairDeviceWizard;
