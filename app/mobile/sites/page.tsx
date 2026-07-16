'use client';

import React from 'react';
import { Building2 } from 'lucide-react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { MobileRoleGate } from '@/components/mobile/MobileRoleGate';
import { SiteManagement } from '@/components/admin/sites/SiteManagement';

export default function MobileSitesPage() {
  return (
    <MobileShell title={<><Building2 size={18} /> 사업장 관리</>}>
      <MobileRoleGate roles={['admin', 'staff']}>
        <SiteManagement />
      </MobileRoleGate>
    </MobileShell>
  );
}
