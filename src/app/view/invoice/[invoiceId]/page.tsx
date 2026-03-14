

// This is a Server Component by default in App Router
import { adminDb } from '@/lib/firebase-admin-init';
import type { Invoice } from '@/types';
import InvoicePrintLayout from '@/components/invoices/invoice-print-layout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import type { Metadata, ResolvingMetadata } from 'next';

export const dynamic = 'force-dynamic'; // Force dynamic rendering

async function getInvoiceData(id: string): Promise<Invoice | null> {
  try {
    const invoiceDocRef = adminDb.collection("invoices").doc(id);
    const invoiceSnap = await invoiceDocRef.get();
    if (invoiceSnap.exists) {
      // Using Admin SDK bypasses security rules for server-side rendering of public pages.
      return { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;
    }
    return null;
  } catch (error) {
    console.error("Error fetching invoice for public view:", error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: { invoiceId: string } }): Promise<Metadata> {
  const invoice = await getInvoiceData(params.invoiceId);
  if (!invoice) {
    return {
      title: `Invoice Not Found | ${APP_NAME}`,
      robots: { index: false, follow: false },
    };
  }
  
  return {
    title: `Invoice ${invoice.invoiceNumber} | ${APP_NAME}`,
    description: `View Invoice ${invoice.invoiceNumber} from ${invoice.companyName}.`,
    openGraph: {
      type: 'website',
    },
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
}

export default async function PublicInvoiceViewPage({ params }: { params: { invoiceId: string } }) {
  const invoiceId = params.invoiceId;
  const invoice = await getInvoiceData(invoiceId);

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Invoice Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The invoice you are looking for (ID: {invoiceId}) could not be found, may have been removed, or access is restricted.
        </p>
      </div>
    );
  }

  // Default props for a clean, view-only presentation
  const printLayoutProps = {
    selectedLayout: "invoice-style",
    showBankDetails: true,
    showMyContactDetails: true,
    addWatermark: false,
    showSignatureArea: false, 
    addDigitalSignature: false,
    setIsLoadingBankAccount: () => {},
    isLoadingBankAccount: false,
  };

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 print:p-0">
      <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none">
        <header className="p-3 border-b print:hidden flex justify-between items-center bg-gray-50">
          <h1 className="text-lg font-semibold text-primary">{APP_NAME} - Shared Invoice</h1>
        </header>
        
        <div id="printable-invoice-content-public-view">
          <InvoicePrintLayout
            invoice={invoice}
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
