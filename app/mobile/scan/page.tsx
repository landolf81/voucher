'use client';

import React from 'react';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileScanPage } from '@/components/mobile/MobileScanPage';

export default function MobileScan() {
  return (
    <MobileLayout>
      <MobileScanPage />
    </MobileLayout>
  );
}