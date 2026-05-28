import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { lightTheme, darkTheme } from '@/theme/theme';
import { useAuth } from '@/hooks/useAuth';
import { useDevices, RelayPollBridge } from '@/hooks/useDevices';
import { useRooms } from '@/hooks/useRooms';
import { useAutomations, useScheduleRunner } from '@/hooks/useAutomation';
import AppShell from '@/components/layout/AppShell';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import AuthPage from '@/pages/AuthPage';
import DashboardPage from '@/pages/DashboardPage';
import RoomsPage from '@/pages/RoomsPage';
import DeviceDetailPage from '@/pages/DeviceDetailPage';
import AutomationPage from '@/pages/AutomationPage';
import ProfilePage from '@/pages/ProfilePage';
import PairDevicePage from '@/pages/PairDevicePage';

// Inner component that has access to auth state
const AppRoutes: React.FC = () => {
  const { isAuthenticated, loading, user } = useAuth();

  // Bootstrap data when authenticated
  const { devices } = useDevices(user?.uid);
  useRooms(user?.uid);
  const { automations } = useAutomations(user?.uid);

  // Client-side schedule runner — writes pendingBits when a schedule fires
  useScheduleRunner(automations);

  if (loading) return <LoadingSpinner message="Connecting to Orbit…" />;

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*"    element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      {/* Start smart relay polling for every paired device */}
      {devices.map((dev) => (
        <RelayPollBridge key={dev.id} deviceId={dev.id} />
      ))}

      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/rooms"     element={<RoomsPage />} />
          <Route path="/device/:deviceId" element={<DeviceDetailPage />} />
          <Route path="/automation" element={<AutomationPage />} />
          <Route path="/pair"      element={<PairDevicePage />} />
          <Route path="/profile"   element={<ProfilePage />} />
          <Route path="*"          element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AnimatePresence>
    </AppShell>
  );
};

const App: React.FC = () => {
  const darkMode = useUIStore((s) => s.darkMode);

  return (
    <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
