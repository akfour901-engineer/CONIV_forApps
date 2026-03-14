
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { ListingItem, ListingItemType, ListingItemStatus, Company } from '@/types';
import { LISTING_ITEM_TYPE_OPTIONS, LISTING_ITEM_STATUS_OPTIONS } from '@/types/server-only';
import { PlusCircle, Save, Loader2, UploadCloud, Trash2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { InsufficientPointsDialog } from '@/components/dashboard/insufficient-points-dialog';
import { MARKETPLACE_LISTING_CREATION_COST } from '@/lib/constants';
import { useLoading } from '@/contexts/loading-context';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NewListingLoadingSkeleton from './loading';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MAX_FILE_SIZE_MB = 0.75;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const listingFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(100),
  description: z.string().min(10, "Description must be at least 10 characters.").max(1000),
  itemType: z.enum(LISTING_ITEM_TYPE_OPTIONS),
  category: z.string().max(100).optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(),
  exchangeFor: z.string().max(255).optional().nullable(),
  imageUrls: z.array(z.object({ value: z.string() })).max(5, `Cannot upload more than 5 images.`).optional().nullable(),
  status: z.enum(LISTING_ITEM_STATUS_OPTIONS).default('active'),
  contactName: z.string().max(100).optional().nullable(),
  contactPhone: z.string().optional().nullable().refine(val => !val || val === '' || /^\+?[0-9\s-()]{7,20}$/.test(val), { message: "Invalid phone format." }),
  contactEmail: z.string().email({ message: "Invalid email address." }).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  localityOrArea: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  district: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().optional().nullable().refine(val => !val || val === '' || /^\d{6}$/.test(val), { message: "Pincode must be 6 digits if provided." }),
  country: z.string().optional(),
  companyId: z.string().optional().nullable(),
});

type ListingFormValues = z.infer<typeof listingFormSchema>;

interface NewListingFormProps {
  listingId?: string;
}

export default function NewListingForm({ listingId }: NewListingFormProps) {
    const { user, userProfile, loading: authLoading, dataOwnerId, appConfig, updateGlobalUserProfile } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [isPointsDialogOpen, setIsPointsDialogOpen] = useState(false);
    const [pointsInfo, setPointsInfo] = useState({ required: 0, current: 0 });
    const [companies, setCompanies] = useState<ComboboxOption[]>([]);
    const [isLoadingPrereqs, setIsLoadingPrereqs] = useState(true);
    
    const isEditing = !!listingId;

    const form = useForm<ListingFormValues>({
        resolver: zodResolver(listingFormSchema),
        defaultValues: { 
            title: '', description: '', itemType: 'sell', category: null, price: 0, exchangeFor: null,
            imageUrls: [], status: 'active', contactName: userProfile?.fullName, contactPhone: userProfile?.phoneNumber,
            contactEmail: user?.email, addressLine1: null, addressLine2: null, localityOrArea: null, city: null,
            district: null, state: null, pincode: null, country: 'India', companyId: null
        },
    });

    const itemType = form.watch('itemType');

    const { fields, append, remove } = useFieldArray({
      control: form.control,
      name: "imageUrls",
    });

    useEffect(() => {
        if (user && dataOwnerId) {
            setIsLoadingPrereqs(true);
            const fetchPrereqs = async () => {
                try {
                    const idToken = await user.getIdToken();
                    const [companyRes, listingRes] = await Promise.all([
                        fetch(`/api/companies?dataOwnerId=${dataOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
                        isEditing ? fetch(`/api/listings/${listingId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }) : Promise.resolve(null),
                    ]);

                    if (companyRes.ok) {
                        const companiesData: Company[] = await companyRes.json();
                        setCompanies(companiesData.map(c => ({ value: c.id!, label: c.name })));
                    }

                    if (isEditing && listingRes && listingRes.ok) {
                        const listingData: ListingItem = await listingRes.json();
                        form.reset({
                          ...listingData,
                          imageUrls: (listingData.imageUrls || []).map(url => ({ value: url! })),
                          country: listingData.country ?? undefined,
                        });
                    }
                } catch (error: any) {
                    toast({ title: "Error", description: `Could not load required data: ${error.message}`, variant: "destructive" });
                }
                setIsLoadingPrereqs(false);
            };
            fetchPrereqs();
        }
    }, [user, dataOwnerId, isEditing, listingId, form, toast]);

    const handleFileChange = (
      event: React.ChangeEvent<HTMLInputElement>,
      index: number
    ) => {
      const file = event.target.files?.[0];
      if (file) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast({ title: "File Too Large", description: `Max ${MAX_FILE_SIZE_MB}MB`, variant: "destructive"});
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          const newImageUrls = form.getValues('imageUrls') || [];
          newImageUrls[index] = { value: reader.result as string };
          form.setValue('imageUrls', newImageUrls);
          form.trigger('imageUrls');
        };
        reader.readAsDataURL(file);
      }
    };

    const addImageSlot = () => {
        if ((fields || []).length < 5) {
            append({ value: "" });
        }
    };

    const removeImageSlot = (index: number) => {
        remove(index);
    };

    const onSubmit = async (values: ListingFormValues) => {
        if (!user || !userProfile || !dataOwnerId || !appConfig) return;
        
        const cost = appConfig?.actionCosts?.find(c => c.key === 'MARKETPLACE_LISTING_CREATION_COST')?.cost ?? MARKETPLACE_LISTING_CREATION_COST;
        if (!isEditing && (userProfile.resourcePoints ?? 0) < cost) {
            setPointsInfo({ required: cost, current: userProfile.resourcePoints ?? 0 });
            setIsPointsDialogOpen(true);
            return;
        }

        setIsSubmitting(true);
        const url = isEditing ? `/api/listings/${listingId}` : '/api/listings';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const idToken = await user.getIdToken();
            const payload = { 
                ...values, 
                imageUrls: values.imageUrls?.map(img => img.value).filter(Boolean),
                dataOwnerId 
            };
            const response = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }, body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Failed to ${isEditing ? 'update' : 'create'} listing.`);

            if (!isEditing && result.newResourcePoints !== undefined && updateGlobalUserProfile && dataOwnerId === user.uid) {
                updateGlobalUserProfile({ userProfile: { ...userProfile, resourcePoints: result.newResourcePoints } });
            }
            toast({ title: "Success", description: `Listing ${isEditing ? 'updated' : 'created'} successfully.` });
            router.push('/dashboard/advance-tools/buy-sell-exchange');
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isLoadingPrereqs) return <NewListingLoadingSkeleton />;

    return (
        <>
            <InsufficientPointsDialog isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} requiredPoints={pointsInfo.required} currentPoints={pointsInfo.current} />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card><CardHeader><CardTitle>Basic Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title*</FormLabel><FormControl><Input placeholder="e.g., Unused Cement Bags for Sale" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description*</FormLabel><FormControl><Textarea placeholder="Describe the item, its condition, and any other relevant details." {...field} rows={5} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="itemType" render={({ field }) => (<FormItem><FormLabel>Listing Type*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{LISTING_ITEM_TYPE_OPTIONS.map(opt => <SelectItem key={opt} value={opt} className="capitalize">{opt}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/>
                            {itemType === 'sell' || itemType === 'buy' ? (
                                <FormField control={form.control} name="price" render={({ field }) => (<FormItem><FormLabel>{itemType === 'sell' ? 'Selling Price' : 'Budget'} (₹)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                            ) : itemType === 'exchange' ? (
                                <FormField control={form.control} name="exchangeFor" render={({ field }) => (<FormItem><FormLabel>Looking to Exchange For</FormLabel><FormControl><Input placeholder="e.g., Scrap metal, leftover tiles" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                            ) : null}
                             <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><FormControl><Input placeholder="e.g., Building Materials, Tools, Services" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)}/>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle>Images</CardTitle><CardDescription>Add up to 5 images for your listing.</CardDescription></CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex items-center gap-2">
                                        <div className="relative w-20 h-20 border rounded-md overflow-hidden">
                                            {form.watch(`imageUrls.${index}.value`) && <Image src={form.watch(`imageUrls.${index}.value`)!} alt={`Preview ${index + 1}`} layout="fill" objectFit="cover" />}
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name={`imageUrls.${index}.value`}
                                            render={({ field: { onChange, value, ...restField } }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                        <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, index)} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeImageSlot(index)}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                ))}
                            </div>
                            {fields.length < 5 && (
                                <Button type="button" variant="outline" size="sm" onClick={addImageSlot} className="mt-4"><PlusCircle className="mr-2 h-4 w-4"/>Add Image</Button>
                            )}
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle>Contact & Location</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="contactName" render={({ field }) => (<FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input placeholder={userProfile?.fullName || 'Your Name'} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
                            <div className="grid md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="contactPhone" render={({ field }) => (<FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input type="tel" placeholder={userProfile?.phoneNumber || 'Your Phone'} {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="contactEmail" render={({ field }) => (<FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" placeholder={user?.email || 'Your Email'} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
                            </div>
                            <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>City/Town</FormLabel><FormControl><Input placeholder="e.g., Mumbai" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
                        </CardContent>
                    </Card>
                    <CardFooter>
                      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/> {isEditing ? 'Save Changes' : 'Create Listing'}</>}</Button>
                    </CardFooter>
                </form>
            </Form>
        </>
    );
}

