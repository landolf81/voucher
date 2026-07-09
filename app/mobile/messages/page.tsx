'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { MessagesPanel } from '@/components/admin/messages/MessagesPanel';

export default function MobileMessagesPage() {
  return (
    <MobileShell title={<><MessageCircle size={18} /> 쪽지</>}>
      <MessagesPanel />
    </MobileShell>
  );
}
