import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import PairDeviceWizard from '@/components/device/PairDeviceWizard';

const PairDevicePage: React.FC = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <Box sx={{ mb: 3 }}>
      <Typography variant="h5" fontWeight={800}>Pair Device</Typography>
      <Typography variant="body2" color="text.secondary">
        Enter your device credentials to add it to your account
      </Typography>
    </Box>
    <PairDeviceWizard />
  </motion.div>
);

export default PairDevicePage;
