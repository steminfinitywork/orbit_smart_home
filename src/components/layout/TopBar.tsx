import React, { useState } from 'react';
import {
  AppBar, Toolbar, IconButton, Typography, Badge, Box,
  Popover, List, ListItem, ListItemText, ListItemIcon,
  Divider, Button, useTheme, Avatar, Menu, MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon, Notifications, NotificationsNone,
  CheckCircle, Error, Warning, Info, ClearAll, Add, Edit, Check,
} from '@mui/icons-material';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useDeviceStore } from '@/store/deviceStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const iconMap = {
  success: <CheckCircle fontSize="small" sx={{ color: '#22C55E' }} />,
  error:   <Error       fontSize="small" sx={{ color: '#EF4444' }} />,
  warning: <Warning     fontSize="small" sx={{ color: '#F59E0B' }} />,
  info:    <Info        fontSize="small" sx={{ color: '#00D4FF' }} />,
};

interface Props { onMenuClick: () => void; }

const TopBar: React.FC<Props> = ({ onMenuClick }) => {
  const theme    = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { notifications, markAllRead, clearNotifications, editMode, setEditMode } = useUIStore();
  const { profile, user } = useAuthStore();
  const { devices } = useDeviceStore();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [plusAnchor, setPlusAnchor] = useState<HTMLElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleBellClick = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    markAllRead();
  };

  return (
    <AppBar position="sticky" elevation={0} sx={{ zIndex: theme.zIndex.drawer - 1 }}>
      <Toolbar sx={{ gap: 1 }}>

        {/* Removed mobile hamburger "3 lines" per request */}

        {/* Orbit logo — mobile only */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mr: 'auto' }}>
          <img src="/icons/orbit_alone.png" alt="Orbit" style={{ width: 28, height: 28, objectFit: 'contain', display: 'block' }} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              background: 'linear-gradient(90deg, #00D4FF, #4A90FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1,
            }}
          >
            Orbit
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Edit/Reorder Toggle Icon (Dashboard only) */}
        {location.pathname === '/dashboard' && devices.length > 0 && (
          <IconButton
            onClick={() => setEditMode(!editMode)}
            color={editMode ? "success" : "inherit"}
            size="large"
            id="toggle-edit-mode-btn"
          >
            {editMode ? <Check /> : <Edit />}
          </IconButton>
        )}

        {/* Dynamic Add (+) Option */}
        {devices.length > 0 && (
          <>
            <IconButton onClick={(e) => setPlusAnchor(e.currentTarget)} color="inherit" size="large" id="add-shortcut-btn">
              <Add />
            </IconButton>
            <Menu
              anchorEl={plusAnchor}
              open={Boolean(plusAnchor)}
              onClose={() => setPlusAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{ paper: { sx: { borderRadius: 3, minWidth: 150 } } }}
            >
              <MenuItem onClick={() => { setPlusAnchor(null); navigate('/pair'); }}>
                Add Device
              </MenuItem>
              <MenuItem onClick={() => { setPlusAnchor(null); navigate('/rooms'); }}>
                Add Room
              </MenuItem>
            </Menu>
          </>
        )}

        {/* Notification Bell */}
        <IconButton onClick={handleBellClick} size="large" color="inherit" id="notif-bell-btn">
          <Badge badgeContent={unreadCount} color="error" max={99}>
            {unreadCount > 0 ? <Notifications /> : <NotificationsNone />}
          </Badge>
        </IconButton>

        {/* Avatar — Google photo or initial */}
        <IconButton onClick={() => navigate('/profile')} size="small" id="profile-avatar-btn">
          {user?.photoURL ? (
            <Avatar
              src={user.photoURL}
              sx={{ width: 34, height: 34, border: '2px solid rgba(0,212,255,0.4)' }}
            />
          ) : (
            <Avatar sx={{
              background: 'linear-gradient(135deg, #0D1B3E, #1a3a7a)',
              border: '2px solid rgba(0,212,255,0.3)',
              width: 34, height: 34, fontSize: 13, fontWeight: 800,
              color: '#00D4FF',
            }}>
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
          )}
        </IconButton>

        {/* Notification Popover */}
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { width: 360, maxHeight: 480, borderRadius: 3, overflow: 'hidden' } } }}
        >
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Notifications</Typography>
            {notifications.length > 0 && (
              <Button size="small" startIcon={<ClearAll />} onClick={clearNotifications} color="error">
                Clear all
              </Button>
            )}
          </Box>
          <Divider />
          <Box sx={{ overflowY: 'auto', maxHeight: 380 }}>
            {notifications.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <NotificationsNone sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary" variant="body2">No notifications</Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {notifications.map((n, i) => (
                  <React.Fragment key={n.id}>
                    <ListItem sx={{ py: 1, px: 2, alignItems: 'flex-start' }}>
                      <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>{iconMap[n.type]}</ListItemIcon>
                      <ListItemText
                        primary={n.message}
                        secondary={format(new Date(n.timestamp), 'hh:mm a · MMM d')}
                        slotProps={{
                          primary: { style: { fontSize: 13, fontWeight: 500 } },
                          secondary: { style: { fontSize: 11 } },
                        }}
                      />
                    </ListItem>
                    {i < notifications.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        </Popover>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
