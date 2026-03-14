
'use client';

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function UpcomingToolsPage() {
    return (
        <div className="p-4 sm:p-6">
            <h1 className="text-2xl font-bold mb-4">Upcoming Features</h1>
            <Card>
                <CardHeader>
                    <CardTitle>This Page is No Longer Used</CardTitle>
                    <CardDescription>
                        All new and upcoming features are now integrated directly into the main dashboard and `Advanced Tools` sections. Please explore the sidebar to discover them.
                    </CardDescription>
                </CardHeader>
            </Card>
             <Button asChild className="mt-4">
                <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
        </div>
    );
}
