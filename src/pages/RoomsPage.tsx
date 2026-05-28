import React, { useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Grid, Fab, Chip,
} from '@mui/material';
import { Add, Edit, Delete, MeetingRoom } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { createRoom, updateRoom as updateRoomFS, deleteRoom as deleteRoomFS } from '@/firebase/firestore';
import { useDeviceStore } from '@/store/deviceStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import EmptyState from '@/components/common/EmptyState';
import { Room } from '@/types';

const ROOM_ICONS = ['🏠', '🛋️', '🛏️', '🍳', '🚿', '🚗', '🌿', '📚', '💻', '🎮', '🏋️', '🌊'];

const RoomsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { rooms, devices, addRoom, updateRoom, removeRoom } = useDeviceStore();
  const addNotification = useUIStore((s) => s.addNotification);

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
    } catch {
      addNotification('Failed to delete room', 'error');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Rooms</Typography>
          <Typography variant="body2" color="text.secondary">Organize your devices by room</Typography>
        </Box>
        <Button
          variant="contained" startIcon={<Add />} onClick={openCreate}
          sx={{ background: 'linear-gradient(135deg, #6366F1, #06B6D4)', fontWeight: 700, display: { xs: 'none', sm: 'flex' } }}
        >
          New Room
        </Button>
      </Box>

      {rooms.length === 0 ? (
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
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ y: -4 }}
                >
                  <Card sx={{
                    height: '100%', cursor: 'pointer',
                    border: '1px solid', borderColor: 'divider',
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: 6 },
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Typography fontSize={40} lineHeight={1.2} mb={1}>{room.icon}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.25 }}>
                          <IconButton size="small" onClick={() => openEdit(room)}><Edit fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => handleDelete(room)} color="error"><Delete fontSize="small" /></IconButton>
                        </Box>
                      </Box>
                      <Typography variant="subtitle1" fontWeight={700} noWrap>{room.name}</Typography>
                      <Chip
                        label={`${devCount} device${devCount !== 1 ? 's' : ''}`}
                        size="small" color={devCount > 0 ? 'primary' : 'default'}
                        variant="outlined" sx={{ mt: 0.75, fontSize: 11, fontWeight: 600 }}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </Box>
      )}

      {/* Mobile FAB */}
      <Fab
        color="primary" onClick={openCreate}
        sx={{
          position: 'fixed', bottom: { xs: 80, md: 24 }, right: 24,
          display: { sm: 'none' },
          background: 'linear-gradient(135deg, #6366F1, #06B6D4)',
        }}
      >
        <Add />
      </Fab>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} PaperProps={{ sx: { borderRadius: 4, width: 360 } }}>
        <DialogTitle fontWeight={700}>{editRoom ? 'Edit Room' : 'New Room'}</DialogTitle>
        <DialogContent sx={{ pt: '12px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Room Name" fullWidth value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Living Room" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>Icon</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {ROOM_ICONS.map((ic) => (
                <Box
                  key={ic}
                  onClick={() => setIcon(ic)}
                  sx={{
                    fontSize: 28, cursor: 'pointer', p: 0.75, borderRadius: 2,
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
