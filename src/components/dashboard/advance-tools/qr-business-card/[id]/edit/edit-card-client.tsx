
'use client';

import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { DigitalBusinessCard, Company } from '@/types';
import { Edit, Save, Loader2, ArrowLeft, AlertTriangle, UploadCloud, Check } from 'lucide-react';
import Link from 'next/link';
import EditDigitalBusinessCardLoadingSkeleton from '@/app/dashboard/advance-tools/qr-business-card/[id]/edit/loading';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useLoading } from '@/contexts/loading-context';

const MAX_FILE_SIZE_MB = 2;
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
  profilePictureUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5, "Profile picture too large.").optional().nullable(),
  logoUrl: z.string().max(MAX_FILE_SIZE_BYTES * 1.5, "Logo image is too large.").optional().nullable(),
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

export default function EditCardClientPage({ cardId }: { cardId: string }) {
  const { user, loading: authLoading, dataOwnerId, currentTeamMemberPermissions, isViewingOwnAccount } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [card, setCard] = useState<DigitalBusinessCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companies, setCompanies] = useState<ComboboxOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);

  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [selectedProfilePicName, setSelectedProfilePicName] = useState<string | null>(null);
  const [selectedLogoName, setSelectedLogoName] = useState<string | null>(null);
  
  const canManageCards = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageDigitalBusinessCards;

  const form = useForm<DigitalBusinessCardFormValues>({
    resolver: zodResolver(digitalBusinessCardFormSchema),
  });

  const fetchCardData = useCallback(async () => {
    if (!user || !dataOwnerId) return;
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const [cardResponse, companyResponse] = await Promise.all([
        fetch(`/api/digital-business-cards/${cardId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
        fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      ]);
      
      if (!cardResponse.ok) throw new Error((await cardResponse.json()).error || "Failed to fetch card details.");
      const cardData: DigitalBusinessCard = await cardResponse.json();
      
      if(cardData.userId !== dataOwnerId) {
        toast({title: "Access Denied", description: "You cannot edit this card.", variant: "destructive"});
        router.push("/dashboard/advance-tools/qr-business-card");
        return;
      }
      
      setCard(cardData);
      form.reset({
        ...cardData,
        companyName: cardData.companyName || "",
        title: cardData.title || "",
        phoneNumber: cardData.phoneNumber || "",
        email: cardData.email || "",
        website: cardData.website || "",
        address: cardData.address || "",
        linkedIn: cardData.linkedIn || "",
        twitter: cardData.twitter || "",
        customColor: cardData.customColor || "#008080",
        notes: cardData.notes || "",
      });

      if (companyResponse.ok) {
        const companiesData: Company[] = await companyResponse.json();
        setCompanies(companiesData.map(c => ({ value: c.id!, label: c.name, data: c })));
      }
    } catch (e: any) {
      toast({ title: "Error", description: `Could not load data: ${e.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, dataOwnerId, cardId, toast, form, router]);

  useEffect(() => {
    if (!authLoading) fetchCardData();
  }, [authLoading, fetchCardData]);
  
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    fieldName: 'profilePictureUrl' | 'logoUrl'
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB`, variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue(fieldName, reader.result as string, { shouldValidate: true });
        if (fieldName === 'profilePictureUrl') setSelectedProfilePicName(file.name);
        else setSelectedLogoName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCompanyChange = (companyId: string) => {
    const selectedCompany = companies.find(c => c.value === companyId)?.data as Company | undefined;
    if (selectedCompany) {
      form.setValue('companyId', companyId);
      form.setValue('companyName', selectedCompany.name);
      if(!form.getValues('logoUrl')) { // Only auto-fill logo if one isn't already set
        form.setValue('logoUrl', selectedCompany.logoUrl || '');
        setSelectedLogoName(selectedCompany.logoUrl ? "Company Logo" : null);
      }
    }
  };

  const onSubmit = async (values: DigitalBusinessCardFormValues) => {
    if (!user || !canManageCards) return;
    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/digital-business-cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Failed to update card.");
      toast({ title: "Success", description: "Digital business card updated." });
      router.push('/dashboard/advance-tools/qr-business-card');
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) return <EditDigitalBusinessCardLoadingSkeleton />;
  if (!canManageCards) return <div>Access Denied.</div>;
  if (!card) return <div>Card not found.</div>;
  
  const logoPreview = form.watch('logoUrl');
  const profilePicPreview = form.watch('profilePictureUrl');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Edit Digital Business Card</h1><p className="text-muted-foreground">Editing: {card.cardName}</p></div>
        <Button variant="outline" asChild><Link href="/dashboard/advance-tools/qr-business-card"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Cards</Link></Button>
      </div>
       <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
                <CardHeader><CardTitle>Card Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="cardName" render={({ field }) => (<FormItem><FormLabel>Card Name*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} value={field.value ?? ""}/></FormControl><FormMessage /></FormItem>)} />
                     <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <Combobox options={companies} value={form.getValues('companyId') || ''} onChange={handleCompanyChange} placeholder="Select company..." searchPlaceholder="Search companies..." disabled={isLoadingCompanies} />
                        <FormDescription>Select to auto-fill name & logo.</FormDescription>
                    </FormItem>
                  </div>
                   <FormField control={form.control} name="companyName" render={({ field }) => ( <FormItem> <FormLabel>Company Name (if not in list)</FormLabel> <FormControl><Input {...field} value={field.value ?? ""} /></FormControl> <FormMessage /> </FormItem> )}/>
                   <div className="grid md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input type="tel" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                   </div>
                   <FormField control={form.control} name="website" render={({ field }) => (<FormItem><FormLabel>Website</FormLabel><FormControl><Input type="url" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                   <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                   <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="linkedIn" render={({ field }) => (<FormItem><FormLabel>LinkedIn URL</FormLabel><FormControl><Input type="url" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="twitter" render={({ field }) => (<FormItem><FormLabel>Twitter/X Handle</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                   </div>
                    <div className="grid md:grid-cols-2 gap-4 items-center">
                        <FormItem>
                            <FormLabel>Profile Picture</FormLabel>
                            <div className="flex items-center gap-2 mt-1">
                                <Button type="button" variant="outline" size="sm" onClick={() => profilePicInputRef.current?.click()}><UploadCloud className="mr-2 h-4 w-4"/>Upload</Button>
                                <span className="text-xs text-muted-foreground truncate">{selectedProfilePicName || 'No new file'}</span>
                            </div>
                            <Input id="profilePictureUpload" type="file" className="hidden" accept="image/*" ref={profilePicInputRef} onChange={(e) => handleFileChange(e, 'profilePictureUrl')} />
                        </FormItem>
                        {profilePicPreview && <Image src={profilePicPreview} alt="Profile preview" width={80} height={80} className="rounded-full border object-cover aspect-square" data-ai-hint="person avatar"/>}
                    </div>
                     <div className="grid md:grid-cols-2 gap-4 items-center">
                        <FormItem>
                            <FormLabel>Company Logo</FormLabel>
                            <div className="flex items-center gap-2 mt-1">
                                <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}><UploadCloud className="mr-2 h-4 w-4"/>Upload</Button>
                                <span className="text-xs text-muted-foreground truncate">{selectedLogoName || 'No new file'}</span>
                            </div>
                            <Input id="logoUpload" type="file" className="hidden" accept="image/*" ref={logoInputRef} onChange={(e) => handleFileChange(e, 'logoUrl')} />
                        </FormItem>
                        {logoPreview && <Image src={logoPreview} alt="Logo preview" width={80} height={80} className="rounded-md border p-1 object-contain aspect-square" data-ai-hint="company logo"/>}
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
                                <button type="button" key={color} className={cn('h-8 w-8 rounded-full border-2 transition-all', field.value === color ? 'ring-2 ring-offset-2 ring-primary' : 'border-transparent hover:scale-110')} style={{ backgroundColor: color }} onClick={() => field.onChange(color)} title={color}>
                                  {field.value === color && <Check className="h-4 w-4 text-white" />}
                                </button>
                              ))}
                              <Input type="text" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} placeholder="#008080" className="w-28 h-8"/>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Any other info for the card..." {...field} value={field.value ?? ""} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/>Save Changes</>}</Button>
                </CardFooter>
            </Card>
        </form>
      </Form>
    </div>
  );
}
