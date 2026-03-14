
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { AppConfigCoinPurchasePackage } from '@/types/server-only';
import { Loader2, Coins, IndianRupee } from 'lucide-react';
import { loadScript } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

const MIN_CUSTOM_AMOUNT = 10;
const HIGH_VALUE_THRESHOLD = 3999;
const HIGH_VALUE_RATE = 9.5;

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function BuyCoinsClientPage() {
  const { user, userProfile, appConfig, refreshContext } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingRazorpay, setIsLoadingRazorpay] = useState(false);
  const [selectedTier, setSelectedTier] = useState<AppConfigCoinPurchasePackage | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  
  const coinPackages = appConfig?.coinPurchasePackages || [];

  const calculatePointsForCustomAmount = useCallback((amount: number): number => {
    if (isNaN(amount) || amount < MIN_CUSTOM_AMOUNT) return 0;
    if (!coinPackages || coinPackages.length === 0) return 0;
    
    const sortedPackages = [...coinPackages].sort((a, b) => a.amount - b.amount);
    const exactMatch = sortedPackages.find(p => p.amount === amount);
    if (exactMatch) return exactMatch.points;

    if (amount >= HIGH_VALUE_THRESHOLD) return Math.floor(amount * HIGH_VALUE_RATE);
    
    let applicableRate = 0;
    if (amount < sortedPackages[0].amount) {
        applicableRate = sortedPackages[0].points / sortedPackages[0].amount;
    } else {
        let lowerBoundPackage = sortedPackages.filter(p => p.amount < amount).pop();
        if(!lowerBoundPackage) {
           lowerBoundPackage = sortedPackages[0];
        }
        applicableRate = lowerBoundPackage.points / lowerBoundPackage.amount;
    }
    
    return Math.floor(amount * applicableRate);
  }, [coinPackages]);
  
  const getButtonProps = (isCustom: boolean, tier?: AppConfigCoinPurchasePackage) => {
    const amount = isCustom ? Number(customAmount) : (tier ? tier.amount : 0);
    const packageId = isCustom ? `custom_${amount}` : (tier ? tier.id : '');
    const points = isCustom ? calculatePointsForCustomAmount(amount) : (tier ? tier.points : 0);
    return {
      amount,
      packageId,
      points,
      isDisabled: isProcessing || isLoadingRazorpay || amount < (isCustom ? MIN_CUSTOM_AMOUNT : 0.01),
    };
  };

  const handlePayment = async (amount: number, packageId: string, points: number) => {
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
          customPointsValue: points,
          userIdForOrderNote: user.uid,
          paymentType: 'coin_purchase',
        }),
      });

      const orderData = await response.json();
      if (!response.ok) throw new Error(orderData.error || 'Failed to create payment order.');

      const options = {
        key: appConfig.razorpayKeyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: `${APP_NAME} Coin Purchase`,
        description: `Purchase: ${orderData.packageName}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
            // Here you would call your backend to verify the payment
            // For now, we will assume success for debugging
            toast({ title: "Payment Successful!", description: "Your points have been added." });
            await refreshContext();
            router.push('/dashboard');
        },
        prefill: {
          name: userProfile.fullName || 'Valued Customer',
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coinPackages.map((tier) => {
          const btnProps = getButtonProps(false, tier);
          return (
            <Card key={tier.id} className="shadow-lg flex flex-col">
              <CardHeader>
                <CardTitle>{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-3xl font-bold flex items-center">
                  <IndianRupee className="h-6 w-6 mr-1" />
                  {tier.amount}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Get <span className="font-semibold text-primary">{tier.points}</span> Resource Points
                </p>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full"
                  onClick={() => handlePayment(btnProps.amount, btnProps.packageId, btnProps.points)}
                  disabled={btnProps.isDisabled}
                >
                  {isProcessing || isLoadingRazorpay ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Coins className="mr-2 h-5 w-5" />
                  )}
                  Buy Now
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Custom Amount</CardTitle>
          <CardDescription>Enter a custom amount to purchase points. A higher amount gives you a better rate.</CardDescription>
        </CardHeader>
        <CardContent>
            <Label htmlFor="custom-amount">Enter Amount (INR)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="custom-amount"
                type="number"
                placeholder={`e.g., 501 (min ₹${MIN_CUSTOM_AMOUNT})`}
                value={customAmount}
                onChange={e => {
                  setCustomAmount(e.target.value);
                  setSelectedTier(null);
                }}
                disabled={isProcessing}
              />
            </div>
            {Number(customAmount) >= MIN_CUSTOM_AMOUNT && (
              <p className="text-sm mt-2 text-primary font-medium">
                  You will get approximately {calculatePointsForCustomAmount(Number(customAmount))} points.
              </p>
            )}
        </CardContent>
        <CardFooter>
            <Button
                className="w-full"
                onClick={() => {
                  const btnProps = getButtonProps(true);
                  handlePayment(btnProps.amount, btnProps.packageId, btnProps.points);
                }}
                disabled={getButtonProps(true).isDisabled}
            >
              {isProcessing || isLoadingRazorpay ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Coins className="mr-2 h-5 w-5" />
              )}
              Buy Now
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
