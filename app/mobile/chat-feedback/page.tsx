'use client';

import React from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { MobileRoleGate } from '@/components/mobile/MobileRoleGate';
import { ChatFeedbackPanel } from '@/components/admin/chat/ChatFeedbackPanel';

export default function MobileChatFeedbackPage() {
  return (
    <MobileShell title={<><MessageSquareWarning size={18} /> 챗봇 피드백</>}>
      <MobileRoleGate roles={['admin']}>
        <ChatFeedbackPanel />
      </MobileRoleGate>
    </MobileShell>
  );
}
