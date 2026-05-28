import React, { useState } from 'react';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import { useHeartbeat } from '@/hooks/useHeartbeat';

interface Props { children: React.ReactNode; }

const DRAWER_WIDTH = 260;

const AppShell: React.FC<Props> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  useHeartbeat();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <Box sx={{ flex: 1, p: { xs: 2, sm: 3 }, pb: { xs: '80px', md: 3 } }}>
          {children}
        </Box>
      </Box>

      <BottomNav />
    </Box>
  );
};

export default AppShell;
