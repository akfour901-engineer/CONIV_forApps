
'use server';

// This is a placeholder file and can be removed if a dedicated view page is not needed.
// For now, it redirects to the edit page.
import { redirect } from 'next/navigation';

export default async function ViewEstimatePage({ params }: { params: { id: string } }) {
    const estimateId = params.id;
    if (estimateId) {
        redirect(`/dashboard/estimates/${estimateId}/edit`);
    } else {
        redirect('/dashboard/estimates');
    }
}
