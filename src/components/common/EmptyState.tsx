import React from 'react';
import { Box, Typography, Button, SvgIconProps } from '@mui/material';
import { motion } from 'framer-motion';

interface Props {
  icon: React.ReactElement<SvgIconProps>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<Props> = ({ icon, title, description, actionLabel, onAction }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
    <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
      <Box sx={{ mb: 2, '& .MuiSvgIcon-root': { fontSize: 72, color: 'text.disabled', opacity: 0.5 } }}>
        {icon}
      </Box>
      <Typography variant="h6" fontWeight={700} mb={1}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" mb={3} sx={{ maxWidth: 320, mx: 'auto' }}>
        {description}
      </Typography>
      {actionLabel && onAction && (
        <Button
          variant="contained" onClick={onAction}
          sx={{ background: 'linear-gradient(135deg, #6366F1, #06B6D4)', fontWeight: 700 }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  </motion.div>
);

export default EmptyState;
