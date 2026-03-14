
'use server';

// This is a placeholder file and can be removed if a dedicated view page is not needed.
// For now, it redirects to the edit page.
import { redirect } from 'next/navigation';

export default async function ViewDocumentPage({ params }: { params: { id: string } }) {
    const docId = params.id;
    if (docId) {
        redirect(`/dashboard/documents/${docId}/edit`);
    } else {
        redirect('/dashboard/documents');
    }
}
