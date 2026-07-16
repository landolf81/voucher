'use client';

import React from 'react';
import { User } from 'lucide-react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { MobileRoleGate } from '@/components/mobile/MobileRoleGate';
import { MobileMemberList } from '@/components/mobile/MobileMemberList';

export default function MobileMembersPage() {
  return (
    <MobileShell title={<><User size={18} /> 조합원 관리</>}>
      <MobileRoleGate roles={['admin']}>
        <MobileMemberList />
      </MobileRoleGate>
    </MobileShell>
  );
}
