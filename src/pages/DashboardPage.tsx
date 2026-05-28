import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { DevicesOther } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useDeviceStore } from '@/store/deviceStore';
import { useUIStore } from '@/store/uiStore';
import QuickStats from '@/components/dashboard/QuickStats';
import DeviceCard from '@/components/dashboard/DeviceCard';
import EmptyState from '@/components/common/EmptyState';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuthStore();
  const { devices, rtdbData } = useDeviceStore();
  const { editMode } = useUIStore();

  const [deviceOrder, setDeviceOrder] = useState<string[]>([]);

  // Load custom device order
  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(`device_order_${user.uid}`);
    if (stored) {
      try {
        setDeviceOrder(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, [user]);

  // Sort devices based on stored order
  const orderedDevices = [...devices].sort((a, b) => {
    let indexA = deviceOrder.indexOf(a.id);
    let indexB = deviceOrder.indexOf(b.id);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    return indexA - indexB;
  });

  const saveOrder = (newOrder: string[]) => {
    setDeviceOrder(newOrder);
    if (user) {
      localStorage.setItem(`device_order_${user.uid}`, JSON.stringify(newOrder));
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = orderedDevices.map(d => d.id);
    const temp = newOrder[index];
    newOrder[index] = newOrder[index - 1];
    newOrder[index - 1] = temp;
    saveOrder(newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (index === orderedDevices.length - 1) return;
    const newOrder = orderedDevices.map(d => d.id);
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + 1];
    newOrder[index + 1] = temp;
    saveOrder(newOrder);
  };

  const getHour = () => new Date().getHours();
  const greeting = getHour() < 12 ? 'Good morning' : getHour() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={850}>
            {greeting}, {profile?.name?.split(' ')[0] || 'User'} 👋
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Here's your home overview
          </Typography>
        </Box>
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <AnimatePresence mode="popLayout">
            {orderedDevices.map((device, idx) => (
              <DeviceCard
                key={device.id}
                device={device}
                rtdbData={rtdbData[device.id] ?? null}
                editMode={editMode}
                onMoveUp={idx > 0 ? () => handleMoveUp(idx) : undefined}
                onMoveDown={idx < orderedDevices.length - 1 ? () => handleMoveDown(idx) : undefined}
              />
            ))}
          </AnimatePresence>
        </Box>
      )}
    </motion.div>
  );
};

export default DashboardPage;
