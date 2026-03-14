

// This is a Server Component by default in App Router
import { adminDb } from '@/lib/firebase-admin-init';
import type { Estimate } from '@/types';
import EstimatePrintLayout from '@/components/estimates/estimate-print-layout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import type { Metadata, ResolvingMetadata } from 'next';

export const dynamic = 'force-dynamic'; // Force dynamic rendering

async function getEstimateData(id: string): Promise<Estimate | null> {
  try {
    const estimateDocRef = adminDb.collection("estimates").doc(id);
    const estimateSnap = await estimateDocRef.get();
    if (estimateSnap.exists) { 
      // Using Admin SDK bypasses security rules for server-side rendering of public pages.
      return { id: estimateSnap.id, ...estimateSnap.data() } as Estimate;
    }
    return null;
  } catch (error) {
    console.error("Error fetching estimate for public view:", error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: { estimateId: string } }, parent: ResolvingMetadata): Promise<Metadata> {
  const estimate = await getEstimateData(params.estimateId);
  const previousImages = (await parent).openGraph?.images || []

  if (!estimate) {
    return {
      title: `Estimate Not Found | ${APP_NAME}`,
      robots: { index: false, follow: false },
    };
  }
  
  return {
    title: `Estimate ${estimate.estimateNumber} from ${estimate.companyName} | ${APP_NAME}`,
    description: `View Estimate ${estimate.estimateNumber} for ${estimate.organizationName}.`,
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
}

export default async function PublicEstimateViewPage({ params }: { params: { estimateId: string } }) {
  const estimateId = params.estimateId;
  const estimate = await getEstimateData(estimateId);

  if (!estimate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Estimate Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The estimate you are looking for (ID: {estimateId}) could not be found, may have been removed, or access is restricted by security rules.
        </p>
      </div>
    );
  }

  // Default props for a clean, view-only presentation
  const printLayoutProps = {
    selectedLayout: "default",
    showBankDetails: false,
    showMyContactDetails: false, 
    addWatermark: false,
    showSignatureArea: false,
    hideValidUntil: false, // Ensure this is passed
    addDigitalSignature: false,
    setIsLoadingBankAccount: () => {},
    isLoadingBankAccount: false,
  };

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 print:p-0">
      <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none">
        <header className="p-3 border-b print:hidden flex justify-between items-center bg-gray-50">
          <h1 className="text-lg font-semibold text-primary">{APP_NAME} - Shared Estimate</h1>
        </header>
        
        <div id="printable-estimate-content-public-view">
          <EstimatePrintLayout
            estimate={estimate}
            {...printLayoutProps}
          />
        </div>
        <footer className="p-3 border-t text-center text-xs text-muted-foreground print:hidden bg-gray-50">
          Shared via {APP_NAME}
        </footer>
      </div>
    </div>
  );
}
