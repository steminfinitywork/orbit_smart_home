import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Avatar, Button, TextField,
  Divider, Chip, IconButton, Alert, CircularProgress,
} from '@mui/material';
import { Edit, Save, Cancel, Logout, Email, Shield, Google } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useDeviceStore } from '@/store/deviceStore';
import { logoutUser } from '@/firebase/auth';
import { updateUserName } from '@/firebase/firestore';
import { useUIStore } from '@/store/uiStore';
import { format } from 'date-fns';

const ProfilePage: React.FC = () => {
  const { user, profile, setProfile } = useAuthStore();
  const { devices } = useDeviceStore();
  const addNotification = useUIStore((s) => s.addNotification);

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal]         = useState(profile?.name || '');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const handleSaveName = async () => {
    if (!nameVal.trim() || !user) return;
    setSaving(true);
    setError('');
    try {
      await updateUserName(user.uid, nameVal.trim());
      setProfile({ ...profile!, name: nameVal.trim() });
      setEditingName(false);
      addNotification('Display name updated', 'success');
    } catch {
      setError('Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Sign out of Orbit Smart Home?')) return;
    try {
      await logoutUser();
    } catch {
      addNotification('Logout failed', 'error');
    }
  };

  const memberSince = profile?.createdAt
    ? format((profile.createdAt as any).toDate?.() || new Date(), 'MMMM yyyy')
    : 'Unknown';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>Profile</Typography>

      {/* ── Avatar card ── */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
            {/* Google profile photo or initial avatar */}
            {user?.photoURL ? (
              <Avatar
                src={user.photoURL}
                sx={{
                  width: 72, height: 72,
                  border: '3px solid',
                  borderColor: 'primary.main',
                  boxShadow: '0 4px 20px rgba(0,212,255,0.25)',
                }}
              />
            ) : (
              <Avatar sx={{
                width: 72, height: 72, fontSize: 28, fontWeight: 800,
                background: 'linear-gradient(135deg, #0D1B3E, #1a3a7a)',
                border: '3px solid',
                borderColor: 'primary.main',
                color: '#00D4FF',
              }}>
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
            )}

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{profile?.name || 'User'}</Typography>
              <Typography variant="body2" color="text.secondary">{profile?.email || user?.email}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={profile?.role || 'owner'} size="small" color="primary" variant="outlined"
                  icon={<Shield sx={{ fontSize: '14px !important' }} />}
                  sx={{ fontWeight: 700 }}
                />
                <Chip
                  label={`Member since ${memberSince}`} size="small" variant="outlined"
                  sx={{ fontSize: 11 }}
                />
                <Chip
                  label="Google Account" size="small" variant="outlined" color="info"
                  icon={<Google sx={{ fontSize: '14px !important' }} />}
                  sx={{ fontSize: 11 }}
                />
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ── Account info ── */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography
            variant="subtitle2" color="text.secondary"
            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}
          >
            Account Information
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          {/* Display Name — editable */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Display Name
              </Typography>
              {!editingName && (
                <IconButton size="small" onClick={() => { setNameVal(profile?.name || ''); setEditingName(true); }}>
                  <Edit fontSize="small" />
                </IconButton>
              )}
            </Box>
            {editingName ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small" value={nameVal} onChange={(e) => setNameVal(e.target.value)}
                  fullWidth autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')  handleSaveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                />
                <IconButton onClick={handleSaveName} disabled={saving} color="primary">
                  {saving ? <CircularProgress size={18} /> : <Save />}
                </IconButton>
                <IconButton onClick={() => setEditingName(false)}><Cancel /></IconButton>
              </Box>
            ) : (
              <Typography variant="body1" sx={{ fontWeight: 600 }}>{profile?.name || 'Not set'}</Typography>
            )}
          </Box>

          <Divider sx={{ my: 1.5 }} />

          {/* Email — read only (from Google) */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Email sx={{ fontSize: 18, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Email Address (Google)
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ fontWeight: 600, pl: 3.5 }}>
              {profile?.email || user?.email}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* ── Stats ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography
            variant="subtitle2" color="text.secondary"
            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 2 }}
          >
            Your Stats
          </Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 800 }} color="primary.main">{devices.length}</Typography>
              <Typography variant="caption" color="text.secondary">Total Devices</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 800 }} color="success.main">
                {devices.filter((d) => d.onlineStatus).length}
              </Typography>
              <Typography variant="caption" color="text.secondary">Online Now</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ── Sign Out ── */}
      <Button
        variant="outlined" color="error" fullWidth size="large"
        startIcon={<Logout />} onClick={handleLogout}
        sx={{ borderRadius: 3, fontWeight: 700, py: 1.5 }}
      >
        Sign Out
      </Button>
    </motion.div>
  );
};

export default ProfilePage;
