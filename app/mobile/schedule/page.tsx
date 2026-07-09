'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { ScheduleCalendar } from '@/components/admin/schedule/ScheduleCalendar';

export default function MobileSchedulePage() {
  return (
    <MobileShell title={<><Calendar size={18} /> 일정</>}>
      <ScheduleCalendar />
    </MobileShell>
  );
}
