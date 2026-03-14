
'use client';

import * as React from 'react';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Heart, IndianRupee } from 'lucide-react';
import { loadScript } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

const SUPPORT_TIERS = [
  { id: 'support_tier_1', name: 'Bronze Supporter', amount: 199 },
  { id: 'support_tier_2', name: 'Silver Supporter', amount: 499 },
  { id: 'support_tier_3', name: 'Gold Supporter', amount: 999 },
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function SupportContributionCard() {
  const { user, userProfile, appConfig } = useAuth();
  const { toast } = useToast();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingRazorpay, setIsLoadingRazorpay] = useState(false);

  const handlePayment = async (amount: number, packageId: string) => {
    if (!user || !userProfile || !appConfig) {
      toast({ title: "Error", description: "User or app configuration not loaded.", variant: "destructive" });
      return;
    }

    setIsLoadingRazorpay(true);
    const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!res) {
      toast({ title: "Error", description: "Razorpay SDK failed to load. Are you online?", variant: "destructive" });
      setIsLoadingRazorpay(false);
      return;
    }

    setIsProcessing(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          packageId: packageId,
          customAmountValue: amount,
          userIdForOrderNote: user.uid,
          paymentType: 'support_contribution',
        }),
      });

      const orderData = await response.json();
      if (!response.ok) throw new Error(orderData.error || 'Failed to create payment order.');

      const options = {
        key: appConfig.razorpayKeyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: `${APP_NAME} Support`,
        description: `Contribution: ${orderData.packageName}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
            toast({ title: "Payment Successful!", description: "Thank you so much for your support." });
        },
        prefill: {
          name: userProfile.fullName || 'Valued Supporter',
          email: user.email || '',
          contact: userProfile.phoneNumber || '',
        },
        notes: orderData.notes,
        theme: { color: '#008080' },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();

    } catch (error: any) {
      toast({ title: "Payment Error", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setIsLoadingRazorpay(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SUPPORT_TIERS.map(tier => (
          <Button
            key={tier.id}
            variant={selectedAmount === tier.amount ? "default" : "outline"}
            className="h-auto p-4 flex flex-col items-center justify-center gap-1"
            onClick={() => { setSelectedAmount(tier.amount); setCustomAmount(''); }}
            disabled={isProcessing}
          >
            <span className="text-lg font-semibold">{tier.name}</span>
            <span className="text-2xl font-bold flex items-center">
              <IndianRupee className="h-5 w-5 mr-1" />
              {tier.amount}
            </span>
          </Button>
        ))}
      </div>
      
      <div>
        <Label htmlFor="custom-amount">Or Enter a Custom Amount</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            id="custom-amount"
            type="number"
            placeholder="e.g., 501"
            value={customAmount}
            onChange={e => {
              setCustomAmount(e.target.value);
              setSelectedAmount(null);
            }}
            disabled={isProcessing}
          />
        </div>
      </div>
      
      <Button
        size="lg"
        className="w-full"
        onClick={() => handlePayment(Number(customAmount) || selectedAmount || 0, customAmount ? `support_custom_${customAmount}` : SUPPORT_TIERS.find(t=>t.amount === selectedAmount)?.id || 'support_custom')}
        disabled={isProcessing || isLoadingRazorpay || (!selectedAmount && !(Number(customAmount) > 0))}
      >
        {isProcessing || isLoadingRazorpay ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <Heart className="mr-2 h-5 w-5" />
        )}
        Contribute Now
      </Button>
    </div>
  );
}
