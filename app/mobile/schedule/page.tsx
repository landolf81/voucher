'use client';

import React from 'react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { ScheduleCalendar } from '@/components/admin/schedule/ScheduleCalendar';

export default function MobileSchedulePage() {
  return (
    <MobileShell title="📅 일정">
      <ScheduleCalendar />
    </MobileShell>
  );
}
