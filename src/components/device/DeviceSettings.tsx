import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, MenuItem,
  Divider, Chip, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip,
} from '@mui/material';
import {
  Edit, Delete, Save, Cancel, Router, Sensors, PowerSettingsNew,
  FiberManualRecord, Wifi, WifiOff, ContentCopy,
} from '@mui/icons-material';
import { DeviceDoc, DeviceRTDB, Room } from '@/types';
import { updateDevice, deleteDeviceDoc } from '@/firebase/firestore';
import { releaseDevice } from '@/firebase/realtimeDb';
import { useDeviceStore } from '@/store/deviceStore';
import { useUIStore } from '@/store/uiStore';
import { isDeviceOnline, getLastSeenText } from '@/hooks/useHeartbeat';
import { useNavigate } from 'react-router-dom';

interface Props {
  device: DeviceDoc;
  rtdbData: DeviceRTDB | null;
  rooms: Room[];
}

const DeviceSettings: React.FC<Props> = ({ device, rtdbData, rooms }) => {
  const navigate = useNavigate();
  const { updateDevice: storeUpdate, removeDevice } = useDeviceStore();
  const addNotification = useUIStore((s) => s.addNotification);

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(device.deviceName);
  const [editingRoom, setEditingRoom] = useState(false);
  const [roomVal, setRoomVal] = useState(device.roomId || '');
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const online = isDeviceOnline(rtdbData?.heartbeat);

  const handleSaveName = async () => {
    if (!nameVal.trim()) return;
    setSaving(true);
    try {
      await updateDevice(device.id, { deviceName: nameVal.trim() });
      storeUpdate(device.id, { deviceName: nameVal.trim() });
      setEditingName(false);
      addNotification('Device renamed successfully', 'success');
    } catch {
      addNotification('Failed to rename device', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoom = async () => {
    setSaving(true);
    try {
      await updateDevice(device.id, { roomId: roomVal || null });
      storeUpdate(device.id, { roomId: roomVal || null });
      setEditingRoom(false);
      addNotification('Room updated', 'success');
    } catch {
      addNotification('Failed to update room', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await releaseDevice(device.id);
      await deleteDeviceDoc(device.id);
      removeDevice(device.id);
      addNotification(`${device.deviceName} removed`, 'warning');
      navigate('/dashboard');
    } catch {
      addNotification('Failed to remove device', 'error');
      setDeleting(false);
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(device.id);
    addNotification('Device ID copied', 'info');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Status Card */}
      <Card>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={600} mb={2} textTransform="uppercase" letterSpacing="0.08em">
            Connection Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {online ? <Wifi sx={{ color: '#22C55E' }} /> : <WifiOff sx={{ color: '#EF4444' }} />}
              <Box>
                <Typography variant="body2" fontWeight={700} color={online ? '#22C55E' : '#EF4444'}>
                  {online ? 'Online' : 'Offline'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Last seen: {getLastSeenText(rtdbData?.heartbeat)}
                </Typography>
              </Box>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="body2" fontWeight={600}>{device.firmwareVersion || 'Unknown'}</Typography>
              <Typography variant="caption" color="text.secondary">Firmware</Typography>
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600}>{device.relayCount}</Typography>
              <Typography variant="caption" color="text.secondary">Channels</Typography>
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600}>{device.deviceType}</Typography>
              <Typography variant="caption" color="text.secondary">Type</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Device ID */}
      <Card>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={600} mb={2} textTransform="uppercase" letterSpacing="0.08em">
            Device Information
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography variant="body2" fontFamily="monospace" flex={1} noWrap>{device.id}</Typography>
            <Tooltip title="Copy Device ID">
              <IconButton size="small" onClick={copyId}><ContentCopy fontSize="small" /></IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Rename */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing="0.08em">
              Device Name
            </Typography>
            {!editingName && (
              <IconButton size="small" onClick={() => setEditingName(true)}><Edit fontSize="small" /></IconButton>
            )}
          </Box>
          {editingName ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                value={nameVal} onChange={(e) => setNameVal(e.target.value)}
                size="small" fullWidth autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
              />
              <IconButton onClick={handleSaveName} disabled={saving} color="primary">
                {saving ? <CircularProgress size={18} /> : <Save />}
              </IconButton>
              <IconButton onClick={() => { setNameVal(device.deviceName); setEditingName(false); }}><Cancel /></IconButton>
            </Box>
          ) : (
            <Typography variant="body1" fontWeight={600}>{device.deviceName}</Typography>
          )}
        </CardContent>
      </Card>

      {/* Room */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing="0.08em">
              Room Assignment
            </Typography>
            {!editingRoom && (
              <IconButton size="small" onClick={() => setEditingRoom(true)}><Edit fontSize="small" /></IconButton>
            )}
          </Box>
          {editingRoom ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                select value={roomVal} onChange={(e) => setRoomVal(e.target.value)}
                size="small" fullWidth
              >
                <MenuItem value="">No Room</MenuItem>
                {rooms.map((r) => <MenuItem key={r.id} value={r.id}>{r.icon} {r.name}</MenuItem>)}
              </TextField>
              <IconButton onClick={handleSaveRoom} disabled={saving} color="primary">
                {saving ? <CircularProgress size={18} /> : <Save />}
              </IconButton>
              <IconButton onClick={() => setEditingRoom(false)}><Cancel /></IconButton>
            </Box>
          ) : (
            <Typography variant="body1" fontWeight={600}>
              {rooms.find((r) => r.id === device.roomId)
                ? `${rooms.find((r) => r.id === device.roomId)!.icon} ${rooms.find((r) => r.id === device.roomId)!.name}`
                : 'Unassigned'}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card sx={{ border: '1px solid rgba(239,68,68,0.3)', bgcolor: 'rgba(239,68,68,0.03)' }}>
        <CardContent>
          <Typography variant="subtitle2" color="error" fontWeight={600} mb={1.5} textTransform="uppercase" letterSpacing="0.08em">
            Danger Zone
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Removing this device will unlink it from your account. The physical device will be reset.
          </Typography>
          <Button
            variant="outlined" color="error" startIcon={<Delete />}
            onClick={() => setDeleteDialog(true)}
            sx={{ borderRadius: 2 }}
          >
            Remove Device
          </Button>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => !deleting && setDeleteDialog(false)} PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle fontWeight={700}>Remove Device?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove <strong>{device.deviceName}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteDialog(false)} disabled={deleting}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={20} color="inherit" /> : 'Remove Device'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeviceSettings;
