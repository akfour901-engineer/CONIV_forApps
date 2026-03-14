'use client';

import React, { Suspense } from 'react';
import ChatClientPage from '@/components/chat/chat-client';
import ChatLoading from '@/components/chat/loading';

export default function ChatPage() {
    return (
        <Suspense fallback={<ChatLoading />}>
            {/* The outer div is removed to allow the parent flex container to control the height */}
            <ChatClientPage />
        </Suspense>
    );
}
