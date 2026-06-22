'use client';

import React from 'react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { AnnouncementsPanel } from '@/components/admin/announcements/AnnouncementsPanel';

export default function MobileNoticesPage() {
  return (
    <MobileShell title="📢 공지">
      <AnnouncementsPanel />
    </MobileShell>
  );
}
