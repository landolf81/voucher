'use client';

import React from 'react';
import { Megaphone } from 'lucide-react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { AnnouncementsPanel } from '@/components/admin/announcements/AnnouncementsPanel';

export default function MobileNoticesPage() {
  return (
    <MobileShell title={<><Megaphone size={18} /> 공지</>}>
      <AnnouncementsPanel />
    </MobileShell>
  );
}
