import React from 'react';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Typography, Avatar, Divider, useTheme, Chip,
} from '@mui/material';
import {
  Dashboard, MeetingRoom, ElectricBolt,
  AddCircle, LightMode, DarkMode, Person,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useDeviceStore } from '@/store/deviceStore';
import { motion } from 'framer-motion';

const DRAWER_WIDTH = 264;

const navItems = [
  { label: 'Dashboard',  icon: <Dashboard />,    path: '/dashboard' },
  { label: 'Rooms',      icon: <MeetingRoom />,  path: '/rooms' },
  { label: 'Automation', icon: <ElectricBolt />, path: '/automation' },
  { label: 'Add Device', icon: <AddCircle />,    path: '/pair' },
  { label: 'Profile',    icon: <Person />,       path: '/profile' },
];

interface Props { open: boolean; onClose: () => void; }

const Sidebar: React.FC<Props> = ({ open, onClose }) => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { profile, user } = useAuthStore();
  const { darkMode, toggleDarkMode } = useUIStore();
  const { devices } = useDeviceStore();
  const theme = useTheme();

  const onlineCount = devices.filter(d => d.onlineStatus).length;

  const handleNav = (path: string) => { navigate(path); onClose(); };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Logo ── */}
      <Box sx={{ px: 2.5, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {/* Orbit animated logo */}
        <Box sx={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
          {/* Orbit rings */}
          {[44, 34, 24].map((size, i) => (
            <motion.div
              key={size}
              style={{
                position: 'absolute',
                width: size,
                height: size * 0.42,
                borderRadius: '50%',
                border: `1px solid ${i === 0 ? 'rgba(0,212,255,0.5)' : i === 1 ? 'rgba(74,144,255,0.4)' : 'rgba(0,212,255,0.6)'}`,
                top: '50%', left: '50%',
                marginTop: -(size * 0.42) / 2,
                marginLeft: -size / 2,
              }}
              animate={{ rotateZ: 360 }}
              transition={{ duration: 4 + i * 2, repeat: Infinity, ease: 'linear' }}
            />
          ))}
          {/* House icon */}
          <Box sx={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src="/icons/ORBIT.png" alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          </Box>
        </Box>

        <Box>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 800,
              lineHeight: 1.1,
              background: 'linear-gradient(90deg, #00D4FF, #4A90FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Orbit
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.08em', fontSize: 9, textTransform: 'uppercase' }}>
            Smart Home
          </Typography>
        </Box>
      </Box>

      {/* ── User card ── */}
      <Box sx={{
        mx: 1.5, mb: 2, p: 1.5, borderRadius: 3,
        background: theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg,rgba(0,30,80,0.6),rgba(0,20,60,0.4))'
          : 'rgba(13,27,62,0.06)',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark'
          ? 'rgba(0,212,255,0.12)' : 'rgba(13,27,62,0.1)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {user?.photoURL ? (
            <Avatar
              src={user.photoURL}
              sx={{ width: 36, height: 36, border: '2px solid rgba(0,212,255,0.3)' }}
            />
          ) : (
            <Avatar sx={{
              bgcolor: 'transparent',
              background: 'linear-gradient(135deg, #0D1B3E, #1a3a7a)',
              border: '2px solid rgba(0,212,255,0.3)',
              width: 36, height: 36, fontSize: 14, fontWeight: 800,
              color: '#00D4FF',
            }}>
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
          )}
          <Box sx={{ overflow: 'hidden', flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{profile?.name || 'User'}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 10 }}>
              {profile?.email}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Chip
            label={`${onlineCount} Online`} size="small" color="success" variant="outlined"
            sx={{ fontSize: 10, height: 20, '& .MuiChip-label': { px: 1 } }}
          />
          <Chip
            label={`${devices.length} Device${devices.length !== 1 ? 's' : ''}`}
            size="small" color="primary" variant="outlined"
            sx={{ fontSize: 10, height: 20, '& .MuiChip-label': { px: 1 } }}
          />
        </Box>
      </Box>

      <Divider sx={{ mx: 2, opacity: 0.4 }} />

      {/* ── Nav ── */}
      <List sx={{ px: 1, flex: 1, mt: 1 }}>
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNav(item.path)}
                sx={{
                  borderRadius: 2.5, px: 2,
                  background: active
                    ? 'linear-gradient(135deg, rgba(0,180,255,0.2), rgba(74,144,255,0.15))'
                    : 'transparent',
                  border: active ? '1px solid rgba(0,212,255,0.25)' : '1px solid transparent',
                  color: active ? '#00D4FF' : 'text.primary',
                  '&:hover': {
                    background: active
                      ? 'linear-gradient(135deg, rgba(0,180,255,0.25), rgba(74,144,255,0.2))'
                      : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: active ? '#00D4FF' : 'text.secondary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{ primary: { style: { fontWeight: active ? 700 : 500, fontSize: 14 } } }}
                />
                {active && (
                  <Box sx={{
                    width: 6, height: 6, borderRadius: '50%',
                    bgcolor: '#00D4FF',
                    boxShadow: '0 0 8px #00D4FF',
                  }} />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ mx: 2, opacity: 0.4 }} />

      {/* ── Theme Toggle ── */}
      <ListItem disablePadding sx={{ px: 1, py: 1 }}>
        <ListItemButton onClick={toggleDarkMode} sx={{ borderRadius: 2.5, px: 2 }}>
          <ListItemIcon sx={{ minWidth: 38, color: 'text.secondary' }}>
            {darkMode ? <LightMode /> : <DarkMode />}
          </ListItemIcon>
          <ListItemText
            primary={darkMode ? 'Light Mode' : 'Dark Mode'}
            slotProps={{ primary: { style: { fontWeight: 500, fontSize: 14 } } }}
          />
        </ListItemButton>
      </ListItem>
    </Box>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Permanent Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH, boxSizing: 'border-box',
            borderRight: '1px solid', borderColor: 'divider',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default Sidebar;
