import React, { useState } from 'react';
import {
  Box, Typography, Button, Tabs, Tab, Card, CardContent,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Divider, Grid, useTheme, Chip,
} from '@mui/material';
import { Add, Edit, Delete, MeetingRoom, Settings, Check } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { createRoom, updateRoom as updateRoomFS, deleteRoom as deleteRoomFS } from '@/firebase/firestore';
import { useDeviceStore } from '@/store/deviceStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import EmptyState from '@/components/common/EmptyState';
import DeviceCard from '@/components/dashboard/DeviceCard';
import { Room } from '@/types';

const ROOM_ICONS = ['🏠', '🛋️', '🛏️', '🍳', '🚿', '🚗', '🌿', '📚', '💻', '🎮', '🏋️', '🌊'];

const RoomsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { rooms, devices, rtdbData, addRoom, updateRoom, removeRoom } = useDeviceStore();
  const addNotification = useUIStore((s) => s.addNotification);
  const theme = useTheme();

  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [manageMode, setManageMode] = useState(false);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏠');
  const [saving, setSaving] = useState(false);

  const openCreate = () => { setEditRoom(null); setName(''); setIcon('🏠'); setDialogOpen(true); };
  const openEdit = (room: Room) => { setEditRoom(room); setName(room.name); setIcon(room.icon); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    try {
      if (editRoom) {
        await updateRoomFS(editRoom.id, { name: name.trim(), icon });
        updateRoom(editRoom.id, { name: name.trim(), icon });
        addNotification(`Room "${name.trim()}" updated`, 'success');
      } else {
        const id = await createRoom(user.uid, name.trim(), icon);
        addRoom({ id, name: name.trim(), ownerUid: user.uid, icon, createdAt: null as any });
        addNotification(`Room "${name.trim()}" created`, 'success');
      }
      setDialogOpen(false);
    } catch {
      addNotification('Failed to save room', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (room: Room) => {
    const devCount = devices.filter((d) => d.roomId === room.id).length;
    if (!window.confirm(`Delete "${room.name}"?${devCount > 0 ? ` ${devCount} device(s) will be unassigned.` : ''}`)) return;
    try {
      await deleteRoomFS(room.id);
      removeRoom(room.id);
      addNotification(`Room "${room.name}" deleted`, 'warning');
      if (selectedTab === room.id) setSelectedTab('all');
    } catch {
      addNotification('Failed to delete room', 'error');
    }
  };

  // Filter devices by selected room tab
  const filteredDevices = devices.filter((d) => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'unassigned') return !d.roomId;
    return d.roomId === selectedTab;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={850}>Rooms</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Slide tabs to access room devices
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={manageMode ? <Check /> : <Settings />}
            onClick={() => setManageMode(!manageMode)}
            sx={{
              borderRadius: 2.5,
              fontWeight: 700,
              textTransform: 'none',
              borderColor: manageMode ? 'success.main' : 'divider',
              color: manageMode ? 'success.main' : 'text.primary',
              '&:hover': {
                borderColor: manageMode ? 'success.dark' : 'text.primary',
                bgcolor: manageMode ? 'rgba(46,125,50,0.04)' : 'rgba(255,255,255,0.04)',
              }
            }}
          >
            {manageMode ? 'Done' : 'Manage Rooms'}
          </Button>
          {manageMode && (
            <Button
              size="small"
              variant="contained"
              startIcon={<Add />}
              onClick={openCreate}
              sx={{
                borderRadius: 2.5,
                fontWeight: 700,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #6366F1, #06B6D4)',
              }}
            >
              Add Room
            </Button>
          )}
        </Box>
      </Box>

      {/* Sliding Room Tabs (Inactive in Manage Mode) */}
      {!manageMode && rooms.length > 0 && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={selectedTab}
            onChange={(_, val) => setSelectedTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              '& .MuiTab-root': {
                fontWeight: 700,
                fontSize: 13,
                textTransform: 'none',
                minWidth: 80,
                px: 2,
              },
            }}
          >
            <Tab label="✨ All Rooms" value="all" />
            {rooms.map((room) => (
              <Tab
                key={room.id}
                label={`${room.icon} ${room.name}`}
                value={room.id}
              />
            ))}
            <Tab label="📦 Unassigned" value="unassigned" />
          </Tabs>
        </Box>
      )}

      {/* Manage Rooms Mode Content */}
      {manageMode ? (
        rooms.length === 0 ? (
          <EmptyState
            icon={<MeetingRoom />}
            title="No rooms yet"
            description="Create rooms to organize your devices — Living Room, Kitchen, Bedroom, and more."
            actionLabel="+ Create Room"
            onAction={openCreate}
          />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(4,1fr)' }, gap: 2 }}>
            <AnimatePresence>
              {rooms.map((room) => {
                const devCount = devices.filter((d) => d.roomId === room.id).length;
                return (
                  <motion.div
                    key={room.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -2 }}
                  >
                    <Card sx={{
                      height: '100%',
                      border: '1px solid', borderColor: 'divider',
                      boxShadow: 'none',
                      borderRadius: 3.5,
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                    }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography fontSize={32} lineHeight={1}>{room.icon}</Typography>
                          <Box sx={{ display: 'flex', gap: 0.25 }}>
                            <IconButton size="small" onClick={() => openEdit(room)}><Edit sx={{ fontSize: 16 }} /></IconButton>
                            <IconButton size="small" onClick={() => handleDelete(room)} color="error"><Delete sx={{ fontSize: 16 }} /></IconButton>
                          </Box>
                        </Box>
                        <Typography variant="subtitle1" fontWeight={750} noWrap>{room.name}</Typography>
                        <Chip
                          label={`${devCount} device${devCount !== 1 ? 's' : ''}`}
                          size="small"
                          color={devCount > 0 ? 'primary' : 'default'}
                          variant="outlined"
                          sx={{ mt: 0.75, fontSize: 10, fontWeight: 700, height: 20 }}
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </Box>
        )
      ) : (
        /* Regular Tab View Content */
        rooms.length === 0 ? (
          <EmptyState
            icon={<MeetingRoom />}
            title="No rooms yet"
            description="Turn on Manage Rooms to create and customize rooms for organizing your home."
            actionLabel="Setup Rooms"
            onAction={() => setManageMode(true)}
          />
        ) : filteredDevices.length === 0 ? (
          <Box sx={{ py: 6, textStyle: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <MeetingRoom sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.5, mb: 1.5 }} />
            <Typography variant="body2" color="text.secondary">
              No devices paired in this room
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <AnimatePresence mode="popLayout">
              {filteredDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  rtdbData={rtdbData[device.id] ?? null}
                />
              ))}
            </AnimatePresence>
          </Box>
        )
      )}

      {/* Create/Edit Room Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} PaperProps={{ sx: { borderRadius: 4, width: 360 } }}>
        <DialogTitle fontWeight={700}>{editRoom ? 'Edit Room' : 'New Room'}</DialogTitle>
        <DialogContent sx={{ pt: '12px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Room Name" fullWidth value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Living Room" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" mb={1}>Icon</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {ROOM_ICONS.map((ic) => (
                <Box
                  key={ic}
                  onClick={() => setIcon(ic)}
                  sx={{
                    fontSize: 24, cursor: 'pointer', p: 0.75, borderRadius: 2,
                    border: '2px solid',
                    borderColor: icon === ic ? 'primary.main' : 'transparent',
                    bgcolor: icon === ic ? 'rgba(99,102,241,0.12)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {ic}
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSave} disabled={!name.trim() || saving}
            sx={{ background: 'linear-gradient(135deg, #6366F1, #06B6D4)', fontWeight: 700 }}
          >
            {saving ? 'Saving…' : editRoom ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
};

export default RoomsPage;
