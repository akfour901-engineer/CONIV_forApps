
'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DigitalBusinessCard, Company } from '@/types';
import { PlusCircle, Save, Loader2, ArrowLeft, AlertTriangle, Check, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import NewDigitalBusinessCardLoadingSkeleton from '@/app/dashboard/advance-tools/qr-business-card/new/loading';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { useLoading } from '@/contexts/loading-context';
import { cn } from '@/lib/utils';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { DIGITAL_BUSINESS_CARD_CREATION_COST } from '@/lib/constants';

const MAX_FILE_SIZE_MB = 2; // Increased to 2MB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const digitalBusinessCardFormSchema = z.object({
  cardName: z.string().min(2, "Card name is required.").max(100),
  fullName: z.string().min(2, "Full name is required.").max(100),
  title: z.string().max(100).optional().or(z.literal('')),
  companyId: z.string().optional().nullable(),
  companyName: z.string().max(100).optional().or(z.literal('')),
  phoneNumber: z.string().optional().or(z.literal('')),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  website: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  linkedIn: z.string().url({ message: "Enter a valid LinkedIn URL."}).optional().or(z.literal('')),
  twitter: z.string().max(100).optional().or(z.literal('')), 
  profilePictureUrl: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  customColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, {message: "Enter a valid hex color code, e.g., #FF5733"}).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

type DigitalBusinessCardFormValues = z.infer<typeof digitalBusinessCardFormSchema>;

const COLOR_SWATCHES = [
  '#008080', // Default Teal
  '#0d47a1', // Navy Blue
  '#455a64', // Slate Gray
  '#b71c1c', // Deep Red
  '#1b5e20', // Forest Green
  '#4a148c', // Deep Purple
  '#212121', // Charcoal Black
];

function NewDigitalBusinessCardPageContent() {
  const { user, userProfile, currentTeamMemberPermissions, isViewingOwnAccount, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
  const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });

  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [selectedProfilePicName, setSelectedProfilePicName] = useState<string | null>(null);
  const [selectedLogoName, setSelectedLogoName] = useState<string | null>(null);

  const canManageCards = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageDigitalBusinessCards;

  const form = useForm<DigitalBusinessCardFormValues>({
    resolver: zodResolver(digitalBusinessCardFormSchema),
    defaultValues: {
      cardName: "",
      fullName: userProfile?.fullName || "",
      title: "",
      companyId: null,
      companyName: "",
      phoneNumber: userProfile?.phoneNumber || "",
      email: user?.email || "",
      website: "",
      address: userProfile?.address || "",
      linkedIn: "",
      twitter: "",
      profilePictureUrl: userProfile?.profilePicture || "",
      logoUrl: "",
      customColor: "#008080",
      notes: "",
    },
  });

  useEffect(() => {
    if (userProfile || user) {
      form.reset({
        cardName: form.getValues('cardName') || "",
        fullName: userProfile?.fullName || "",
        title: form.getValues('title') || "",
        companyId: form.getValues('companyId') || null,
        companyName: form.getValues('companyName') || "",
        phoneNumber: userProfile?.phoneNumber || "",
        email: user?.email || "",
        website: form.getValues('website') || "",
        address: userProfile?.address || "",
        linkedIn: form.getValues('linkedIn') || "",
        twitter: form.getValues('twitter') || "",
        profilePictureUrl: userProfile?.profilePicture || "",
        logoUrl: form.getValues('logoUrl') || "",
        customColor: form.getValues('customColor') || "#008080",
        notes: form.getValues('notes') || "",
      });
    }
  }, [user, userProfile, form]);

  useEffect(() => {
    if (user && dataOwnerId && canManageCards) {
      const fetchCompanies = async () => {
        setIsLoadingCompanies(true);
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (!response.ok) throw new Error('Failed to fetch companies');
          const companiesData: Company[] = await response.json();
          const companyOptions = companiesData.map(doc => ({ value: doc.id!, label: doc.name, data: { id: doc.id, ...doc } as Company }));
          setCompanies(companyOptions);
        } catch (error) {
          console.error("Error fetching companies:", error);
          toast({ title: "Error", description: "Could not load your companies.", variant: "destructive" });
        }
        setIsLoadingCompanies(false);
      };
      fetchCompanies();
    }
  }, [user, dataOwnerId, toast, canManageCards]);

  const handleCompanyChange = (companyId: string) => {
    const selectedCompany = companies.find(c => c.value === companyId)?.data as Company | undefined;
    if (selectedCompany) {
      form.setValue('companyId', companyId);
      form.setValue('companyName', selectedCompany.name);
      form.setValue('logoUrl', selectedCompany.logoUrl || '');
      setSelectedLogoName(selectedCompany.logoUrl ? "Company Logo" : null);
    }
  };
  
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    fieldName: 'profilePictureUrl' | 'logoUrl'
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`, variant: "destructive" });
        if (event.target) event.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue(fieldName, reader.result as string, { shouldValidate: true });
        if (fieldName === 'profilePictureUrl') setSelectedProfilePicName(file.name);
        else if (fieldName === 'logoUrl') setSelectedLogoName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: DigitalBusinessCardFormValues) => {
    if (!user || !dataOwnerId || !userProfile || !appConfig) {
      toast({ title: "Authentication Error", description: "You must be logged in and system config must be loaded.", variant: "destructive" });
      return;
    }
    if (!canManageCards) {
        toast({ title: "Permission Denied", description: "You do not have permission to add cards.", variant: "destructive" });
        return;
    }

    const cost = appConfig?.actionCosts?.find(c => c.key === 'DIGITAL_BUSINESS_CARD_CREATION_COST')?.cost ?? DIGITAL_BUSINESS_CARD_CREATION_COST;
    const currentPoints = userProfile.resourcePoints ?? 0;

    if (currentPoints < cost) {
        setPointsInfo({ required: cost, current: currentPoints });
        setIsPointsDialogOpen(true);
        return;
    }
    
    setIsSubmitting(true);
    setGlobalIsLoading(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/digital-business-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ ...values, dataOwnerId: dataOwnerId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if(errorData.code === 'INSUFFICIENT_POINTS') {
            toast({ title: "Insufficient Resource Points", description: errorData.error, variant: "destructive", duration: 7000 });
        } else {
            throw new Error(errorData.error || 'Failed to create card.');
        }
        setIsSubmitting(false);
        setGlobalIsLoading(false);
        return;
      }
      
      const createdCard: DigitalBusinessCard & { newResourcePoints?: number; cost?: number } = await response.json();
      if (updateGlobalUserProfile && userProfile && createdCard.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: createdCard.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() }});
      }
      
      toast({ title: "Success", description: "Digital Business Card created successfully." });
      router.push('/dashboard/advance-tools/qr-business-card');
    } catch (error: any) {
      console.error("Error creating card (API):", error);
      toast({ title: "Error Creating Card", description: error.message, variant: "destructive" });
      setGlobalIsLoading(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedItemType = form.watch("customColor");

  if (authLoading && !userProfile) return <NewDigitalBusinessCardLoadingSkeleton />;
  if (!user || !userProfile) { 
    router.push('/auth/signin'); 
    return <NewDigitalBusinessCardLoadingSkeleton />; 
  }
  if (!canManageCards) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Permission Denied</h2>
        <p className="text-muted-foreground">You do not have permission to create Digital Business Cards.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/advance-tools/qr-business-card">Back to Cards</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              <PlusCircle className="mr-3 h-7 w-7 text-primary" /> Create Digital Business Card
            </h1>
            <p className="text-muted-foreground">Enter details for your new digital card.</p>
          </div>
          <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}><Link href="/dashboard/advance-tools/qr-business-card"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Cards</Link></Button>
        </div>

        <Card className="shadow-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader><CardTitle>Card Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="cardName" render={({ field }) => (<FormItem><FormLabel>Card Name*</FormLabel><FormControl><Input placeholder="My Main Card" {...field} /></FormControl><FormDescription>A name for you to identify this card.</FormDescription><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name*</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="CEO" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <Combobox
                      options={companies}
                      value={form.getValues('companyId') || ''}
                      onChange={handleCompanyChange}
                      placeholder="Select company..."
                      searchPlaceholder="Search companies..."
                      disabled={isLoadingCompanies}
                    />
                    <FormDescription>Select to auto-fill name & logo.</FormDescription>
                  </FormItem>
                </div>
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name (if not in list)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="website" render={({ field }) => (<FormItem><FormLabel>Website</FormLabel><FormControl><Input type="url" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="linkedIn" render={({ field }) => (<FormItem><FormLabel>LinkedIn</FormLabel><FormControl><Input type="url" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="twitter" render={({ field }) => (<FormItem><FormLabel>Twitter</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormItem>
                    <FormLabel>Profile Picture</FormLabel>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => profilePicInputRef.current?.click()}
                      >
                        <UploadCloud className="mr-2 h-4 w-4" /> Upload
                      </Button>
                      <span className="text-xs text-muted-foreground truncate">
                        {selectedProfilePicName || 'No file chosen'}
                      </span>
                    </div>
                    <Input 
                        id="profilePictureUpload" 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        ref={profilePicInputRef} 
                        onChange={(e) => handleFileChange(e, 'profilePictureUrl')} 
                    />
                    <FormDescription>Link to an image or upload one.</FormDescription>
                  </FormItem>
                  <FormItem>
                    <FormLabel>Company Logo</FormLabel>
                    <div className="flex items-center gap-2 mt-1">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => logoInputRef.current?.click()}
                      >
                        <UploadCloud className="mr-2 h-4 w-4" />Upload
                      </Button>
                      <span className="text-xs text-muted-foreground truncate">
                        {selectedLogoName || "No file chosen"}
                      </span>
                      <Input 
                        id="logoUpload" 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        ref={logoInputRef} 
                        onChange={(e) => handleFileChange(e, 'logoUrl')} 
                      />
                    </div>
                    <FormDescription>Auto-filled on company selection, or upload.</FormDescription>
                  </FormItem>
                </div>
                <FormField
                  control={form.control}
                  name="customColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Accent Color</FormLabel>
                      <FormControl>
                        <div className="flex flex-wrap gap-2 items-center">
                          {COLOR_SWATCHES.map((color) => (
                            <button
                              type="button"
                              key={color}
                              className={cn(
                                'h-8 w-8 rounded-full border-2 transition-all',
                                field.value === color ? 'ring-2 ring-offset-2 ring-primary' : 'border-transparent hover:scale-110'
                              )}
                              style={{ backgroundColor: color }}
                              onClick={() => field.onChange(color)}
                              title={color}
                            >
                              {field.value === color && <Check className="h-4 w-4 text-white" />}
                            </button>
                          ))}
                          <Input
                            type="text"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value)}
                            placeholder="#008080"
                            className="w-28 h-8"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>Select a color or enter a custom hex code.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any other info for the card..." {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmitting || authLoading}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> Save Card
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </>
  );
}

function NewDigitalBusinessCardPageWrapper() {
  return (
    <Suspense fallback={<NewDigitalBusinessCardLoadingSkeleton />}>
        <NewDigitalBusinessCardPageContent />
    </Suspense>
  )
}
export default NewDigitalBusinessCardPageWrapper;
