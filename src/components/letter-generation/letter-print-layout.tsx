'use client';

import type { Letter, UserProfile, Company } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { marked } from 'marked';
import { DigitalFingerprint } from '@/components/auth/digital-fingerprint';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LetterPrintLayoutProps {
  letter: Partial<Letter>;
  company: Company | null;
  addWatermark?: boolean;
  showSignatureArea?: boolean;
  addDigitalSignature?: boolean;
}

export default function LetterPrintLayout({
  letter,
  company,
  addWatermark = false,
  showSignatureArea = false,
  addDigitalSignature = false,
}: LetterPrintLayoutProps) {
  const { userProfile } = useAuth();

  const parsedContent = letter.generatedContent ? marked.parse(letter.generatedContent) as string : '';

  const basePageClass = "bg-white p-8 font-serif text-gray-800 relative print-page-break min-h-[1123px]";
  const companyLogoHeight = "max-h-20 print:max-h-16";

  return (
    <div className={cn(basePageClass, "relative overflow-hidden")}>
       {addWatermark && company?.name && (
        <div className="absolute inset-0 grid grid-cols-3 gap-x-8 gap-y-24 pointer-events-none -z-0 overflow-hidden opacity-[0.04] print:opacity-[0.03]">
          {Array(12).fill(0).map((_, i) => (
            <p key={i} className="font-extrabold text-gray-400 transform -rotate-45 whitespace-nowrap select-none uppercase text-5xl print:text-4xl" style={{ WebkitTextStroke: '1px rgba(0,0,0,0.1)', letterSpacing: '0.05em' }}>
              {company.name}
            </p>
          ))}
        </div>
      )}
      <div className="relative z-10">
        <header className="flex justify-between items-start mb-12 border-b pb-4">
            <div className="w-2/3">
                <h1 className="text-3xl font-bold text-gray-800">{company?.name || 'Your Company'}</h1>
                {company?.address && <p className="text-xs text-gray-500 mt-1">{company.address}</p>}
                {company?.contactPhone && <p className="text-xs text-gray-500">Phone: {company.contactPhone}</p>}
                {company?.contactEmail && <p className="text-xs text-gray-500">Email: {company.contactEmail}</p>}
            </div>
            <div className="w-1/3 flex justify-end">
                {company?.logoUrl && (
                    <Image src={company.logoUrl} alt={`${company.name} Logo`} width={100} height={100} className={cn("object-contain w-auto", companyLogoHeight)} data-ai-hint="company logo"/>
                )}
            </div>
        </header>

        <div className="text-right mb-8">
            <p>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="mb-8">
             <p className="font-semibold">{letter.recipient}</p>
        </div>

        <div className="mb-8">
            <h2 className="text-xl font-bold underline">Subject: {letter.generatedTitle || letter.subject}</h2>
        </div>

        <main 
            className="prose prose-sm max-w-none prose-p:mb-3 prose-li:mb-1" 
            dangerouslySetInnerHTML={{ __html: parsedContent }}
        />

        {showSignatureArea && (
            <footer className="mt-24">
                <div className="w-2/5">
                    <div className="min-h-[60px] mb-2 flex items-center justify-center relative">
                        <DigitalFingerprint
                            phrase1={userProfile?.signaturePhrase1}
                            phrase2={userProfile?.signaturePhrase2}
                            enabled={addDigitalSignature}
                        />
                        {addDigitalSignature && userProfile?.eSignature ? (
                            <Image src={userProfile.eSignature} alt="E-Signature" width={150} height={60} className="mx-auto h-[60px] object-contain relative" data-ai-hint="signature image"/>
                        ) : addDigitalSignature && userProfile?.fullName ? (
                            <p className="font-serif italic text-2xl h-[60px] flex items-center justify-center relative">{userProfile.fullName}</p>
                        ) : (
                            <div className="h-[60px]"></div>
                        )}
                    </div>
                     {addDigitalSignature && (
                        <div className="text-[8pt] text-gray-500 text-center -mt-2">
                            <p>Digitally signed by: {userProfile?.fullName || userProfile?.email}</p>
                            <p>Date: {new Date().toLocaleString()}</p>
                        </div>
                    )}
                    <div className="border-t border-gray-400 pt-2 mt-2 text-center">
                        <p className="font-semibold">{userProfile?.fullName || "Signature"}</p>
                    </div>
                </div>
            </footer>
        )}
      </div>
    </div>
  );
}