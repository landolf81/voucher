'use client';

import React from 'react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { MessagesPanel } from '@/components/admin/messages/MessagesPanel';

export default function MobileMessagesPage() {
  return (
    <MobileShell title="💬 쪽지">
      <MessagesPanel />
    </MobileShell>
  );
}
