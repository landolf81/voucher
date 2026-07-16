'use client';

import React from 'react';
import { Wheat } from 'lucide-react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { MobileRoleGate } from '@/components/mobile/MobileRoleGate';
import { AssociationManagement } from '@/components/admin/associations/AssociationManagement';

export default function MobileAssociationsPage() {
  return (
    <MobileShell title={<><Wheat size={18} /> 영농회 관리</>}>
      <MobileRoleGate roles={['admin']}>
        <AssociationManagement />
      </MobileRoleGate>
    </MobileShell>
  );
}
