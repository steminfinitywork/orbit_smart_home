import React from 'react';
import {
  Card, CardContent, Box, Typography, IconButton, Chip, Switch,
  Tooltip, useTheme,
} from '@mui/material';
import { Delete, Timer, Schedule, Repeat } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { Automation } from '@/types';
import { updateAutomation, deleteAutomation } from '@/firebase/firestore';
import { useUIStore } from '@/store/uiStore';

interface Props {
  automation: Automation;
}

const iconMap = {
  countdown: <Timer color="warning" />,
  schedule: <Schedule color="info" />,
  weekly: <Repeat color="success" />,
};

const labelMap = { countdown: 'Countdown', schedule: 'Schedule', weekly: 'Weekly' };
const colorMap = { countdown: 'warning' as const, schedule: 'info' as const, weekly: 'success' as const };

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const AutomationCard: React.FC<Props> = ({ automation }) => {
  const theme = useTheme();
  const addNotification = useUIStore((s) => s.addNotification);
  const [toggling, setToggling] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await updateAutomation(automation.id, { enabled: !automation.enabled });
      addNotification(`Automation ${automation.enabled ? 'disabled' : 'enabled'}`, 'info');
    } catch {
      addNotification('Failed to update automation', 'error');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete automation "${automation.label}"?`)) return;
    setDeleting(true);
    try {
      await deleteAutomation(automation.id);
      addNotification('Automation deleted', 'warning');
    } catch {
      addNotification('Failed to delete automation', 'error');
      setDeleting(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
    >
      <Card
        sx={{
          border: '1px solid',
          borderColor: automation.enabled
            ? `${colorMap[automation.type]}.main`
            : theme.palette.divider,
          opacity: automation.enabled ? 1 : 0.65,
          transition: 'all 0.3s ease',
        }}
      >
        <CardContent sx={{ pb: '12px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box sx={{ mt: 0.25 }}>{iconMap[automation.type]}</Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>{automation.label}</Typography>
              <Typography variant="caption" color="text.secondary">
                {automation.deviceName} · {automation.channelName}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Chip label={labelMap[automation.type]} size="small" color={colorMap[automation.type]} variant="outlined" sx={{ fontWeight: 600, fontSize: 11 }} />

                {automation.type === 'countdown' && automation.duration && (
                  <Chip label={`${Math.floor(automation.duration / 60)}m`} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                )}

                {(automation.type === 'schedule' || automation.type === 'weekly') && (
                  <>
                    {automation.onTime && <Chip label={`ON ${automation.onTime}`} size="small" color="success" variant="outlined" sx={{ fontSize: 11 }} />}
                    {automation.offTime && <Chip label={`OFF ${automation.offTime}`} size="small" color="error" variant="outlined" sx={{ fontSize: 11 }} />}
                  </>
                )}

                {automation.type === 'weekly' && automation.days && (
                  <Chip
                    label={automation.days.map((d) => DAYS_SHORT[d]).join(', ')}
                    size="small" variant="outlined" sx={{ fontSize: 11 }}
                  />
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Switch
                checked={automation.enabled}
                onChange={handleToggle}
                disabled={toggling}
                size="small"
                color={colorMap[automation.type]}
              />
              <Tooltip title="Delete">
                <IconButton size="small" onClick={handleDelete} disabled={deleting} color="error">
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AutomationCard;
