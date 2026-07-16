'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { MobileRoleGate } from '@/components/mobile/MobileRoleGate';
import { UserManagement } from '@/components/admin/users/UserManagement';

export default function MobileUsersPage() {
  return (
    <MobileShell title={<><Users size={18} /> 사용자 관리</>}>
      <MobileRoleGate roles={['admin']}>
        <UserManagement />
      </MobileRoleGate>
    </MobileShell>
  );
}
