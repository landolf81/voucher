'use client';

import React from 'react';
import { Home } from 'lucide-react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { AppraisalsPanel } from '@/components/admin/appraisals/AppraisalsPanel';

export default function MobileAppraisalsPage() {
  return (
    <MobileShell title={<><Home size={18} /> 감정평가</>}>
      <AppraisalsPanel />
    </MobileShell>
  );
}
