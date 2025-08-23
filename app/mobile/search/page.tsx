'use client';

import React from 'react';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileSearchPage } from '@/components/mobile/MobileSearchPage';

export default function MobileSearch() {
  return (
    <MobileLayout>
      <MobileSearchPage />
    </MobileLayout>
  );
}