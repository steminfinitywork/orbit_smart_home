import React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { Dashboard, MeetingRoom, ElectricBolt, Person } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { label: 'Home', icon: <Dashboard />, path: '/dashboard' },
  { label: 'Rooms', icon: <MeetingRoom />, path: '/rooms' },
  { label: 'Auto', icon: <ElectricBolt />, path: '/automation' },
  { label: 'Profile', icon: <Person />, path: '/profile' },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentIndex = navItems.findIndex((n) => location.pathname === n.path);

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        display: { md: 'none' },
        borderTop: '1px solid',
        borderColor: 'divider',
        zIndex: 1200,
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation
        value={currentIndex === -1 ? false : currentIndex}
        onChange={(_, newVal) => navigate(navItems[newVal].path)}
        showLabels
        sx={{ height: 60, bgcolor: 'transparent' }}
      >
        {navItems.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            icon={item.icon}
            sx={{
              minWidth: 0,
              fontSize: 10,
              '&.Mui-selected': { color: 'primary.main' },
              '& .MuiBottomNavigationAction-label': { fontSize: '0.65rem', fontWeight: 600 },
            }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default BottomNav;
