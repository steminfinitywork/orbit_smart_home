import React from 'react';
import { Box, Typography, Button, Fab } from '@mui/material';
import { Add, DevicesOther } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useDeviceStore } from '@/store/deviceStore';
import QuickStats from '@/components/dashboard/QuickStats';
import RoomSection from '@/components/dashboard/RoomSection';
import EmptyState from '@/components/common/EmptyState';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { devices, rooms } = useDeviceStore();

  const allRooms = [...rooms, null]; // null = Unassigned section

  const getHour = () => new Date().getHours();
  const greeting = getHour() < 12 ? 'Good morning' : getHour() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800}>
          {greeting}, {profile?.name?.split(' ')[0] || 'User'} 👋
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Here's your home overview
        </Typography>
      </Box>

      {/* Quick stats */}
      <QuickStats />

      {/* Device list or empty state */}
      {devices.length === 0 ? (
        <EmptyState
          icon={<DevicesOther />}
          title="No devices yet"
          description="Pair your first smart device to start controlling your home."
          actionLabel="+ Pair Device"
          onAction={() => navigate('/pair')}
        />
      ) : (
        <AnimatePresence>
          {allRooms.map((room) => (
            <RoomSection key={room?.id || 'unassigned'} room={room} />
          ))}
        </AnimatePresence>
      )}

      {/* FAB */}
      {devices.length > 0 && (
        <Fab
          color="primary" variant="extended"
          onClick={() => navigate('/pair')}
          sx={{
            position: 'fixed', bottom: { xs: 80, md: 24 }, right: 24,
            background: 'linear-gradient(135deg, #6366F1, #06B6D4)',
            boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
            '&:hover': { background: 'linear-gradient(135deg, #4F46E5, #0891B2)' },
          }}
        >
          <Add sx={{ mr: 1 }} />
          Add Device
        </Fab>
      )}
    </motion.div>
  );
};

export default DashboardPage;
