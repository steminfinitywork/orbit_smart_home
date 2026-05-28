import React, { useState } from 'react';
import {
  AppBar, Toolbar, IconButton, Typography, Badge, Box,
  Popover, List, ListItem, ListItemText, ListItemIcon,
  Divider, Button, useTheme, Avatar,
} from '@mui/material';
import {
  Menu as MenuIcon, Notifications, NotificationsNone,
  CheckCircle, Error, Warning, Info, ClearAll,
} from '@mui/icons-material';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
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
  const { notifications, markAllRead, clearNotifications } = useUIStore();
  const { profile, user } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleBellClick = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    markAllRead();
  };

  return (
    <AppBar position="sticky" elevation={0} sx={{ zIndex: theme.zIndex.drawer - 1 }}>
      <Toolbar sx={{ gap: 1 }}>

        {/* Mobile hamburger */}
        <IconButton
          onClick={onMenuClick}
          sx={{ display: { md: 'none' }, mr: 1 }}
          edge="start"
          color="inherit"
        >
          <MenuIcon />
        </IconButton>

        {/* Orbit logo — mobile only */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, mr: 'auto' }}>
          {/* Mini orbit icon */}
          <Box sx={{ position: 'relative', width: 30, height: 30 }}>
            {[30, 22].map((size, i) => (
              <motion.div
                key={size}
                style={{
                  position: 'absolute',
                  width: size,
                  height: size * 0.42,
                  borderRadius: '50%',
                  border: `1px solid ${i === 0 ? 'rgba(0,212,255,0.55)' : 'rgba(74,144,255,0.45)'}`,
                  top: '50%', left: '50%',
                  marginTop: -(size * 0.42) / 2,
                  marginLeft: -size / 2,
                }}
                animate={{ rotateZ: 360 }}
                transition={{ duration: 5 + i * 2, repeat: Infinity, ease: 'linear' }}
              />
            ))}
            <Box sx={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 12, height: 12,
            }}>
              <img src="/icons/orbit-icon.png" alt="" style={{ width: 12, height: 12, objectFit: 'contain' }} />
            </Box>
          </Box>

          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              background: 'linear-gradient(90deg, #00D4FF, #4A90FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Orbit
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

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
