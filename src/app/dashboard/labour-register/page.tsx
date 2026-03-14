
'use client';

import React, { Suspense, useState } from 'react';
import LabourRegisterClientPage from '@/components/labour/labour-register-client';
import LabourRegisterLoading from './loading';
import type { LabourRegister } from '@/types';
import { LabourDocStatusModal } from '@/components/labour/labour-doc-status-modal';

// We introduce state management here in the page component.
function LabourRegisterPageContent() {
    const [isDocStatusModalOpen, setIsDocStatusModalOpen] = useState(false);
    const [labourers, setLabourers] = useState<LabourRegister[]>([]);
    
    // The button is now part of this component's layout.
    return (
        <>
            <LabourDocStatusModal 
                isOpen={isDocStatusModalOpen} 
                onOpenChange={setIsDocStatusModalOpen} 
                labourers={labourers} 
            />
            <LabourRegisterClientPage 
                setLabourers={setLabourers}
                onDocStatusClick={() => setIsDocStatusModalOpen(true)}
            />
        </>
    );
}

export default function LabourRegisterPage() {
    return (
        <Suspense fallback={<LabourRegisterLoading />}>
            <LabourRegisterPageContent />
        </Suspense>
    );
}
