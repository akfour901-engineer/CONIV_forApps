
'use client';

import * as React from 'react';
import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { User } from 'firebase/auth';
import type { UserProfile, AppConfiguration } from '@/types';
import { Save, Loader2, UploadCloud, UserCircle, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ProfileClientPageProps {
    user: User;
    userProfile: UserProfile;
    appConfig: AppConfiguration | null;
    refreshContext: () => Promise<void>;
}

const MAX_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const profileFormSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters.").max(100),
  email: z.string().email("Invalid email format."),
  phoneNumber: z.string().optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  profilePicture: z.string().max(MAX_FILE_SIZE_BYTES * 1.5, "Profile picture too large.").optional().nullable(),
  eSignature: z.string().max(MAX_FILE_SIZE_BYTES * 1.5, "Signature image too large.").optional().nullable(),
  signaturePhrase1: z.string().max(100).optional().nullable(),
  signaturePhrase2: z.string().max(100).optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfileClientPage({ user, userProfile, appConfig, refreshContext }: ProfileClientPageProps) {
  const { toast } = useToast();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showSignaturePhrases, setShowSignaturePhrases] = useState(false);
  
  const profilePicRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: userProfile?.fullName || '', email: user?.email || '', phoneNumber: userProfile?.phoneNumber || '',
      address: userProfile?.address || '', profilePicture: userProfile?.profilePicture || null,
      eSignature: userProfile?.eSignature || null, signaturePhrase1: userProfile?.signaturePhrase1 || '',
      signaturePhrase2: userProfile?.signaturePhrase2 || '',
    }
  });

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    fieldName: 'profilePicture' | 'eSignature'
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File Too Large", description: `File size cannot exceed ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive"});
        if (fieldName === 'profilePicture' && profilePicRef.current) profilePicRef.current.value = "";
        if (fieldName === 'eSignature' && signatureRef.current) signatureRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        profileForm.setValue(fieldName, reader.result as string);
        toast({ title: "Image Ready", description: `${file.name} is ready to be uploaded upon saving.`});
      };
      reader.readAsDataURL(file);
    }
  };

  const onProfileSubmit = async (values: ProfileFormValues) => {
    setIsSavingProfile(true);
    try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/user-actions/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
            body: JSON.stringify(values),
        });

        if (!response.ok) {
            const result = await response.json().catch(() => ({ message: 'An unknown API error occurred.'}));
            throw new Error(result.message || "Failed to update profile.");
        }
        
        await refreshContext();
        toast({ title: "Success", description: "Your profile has been updated." });
    } catch(error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setIsSavingProfile(false);
    }
  };
  
  const profilePicturePreview = profileForm.watch('profilePicture');
  const eSignaturePreview = profileForm.watch('eSignature');

  return (
    <Form {...profileForm}>
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
        <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle><CardDescription>Update your name, contact details, and address.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                    <AvatarImage src={profilePicturePreview || undefined} alt={profileForm.getValues('fullName') || 'User'} />
                    <AvatarFallback>{profileForm.getValues('fullName')?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="w-full">
                    <FormField control={profileForm.control} name="profilePicture" render={({ field }) => (
                    <FormItem><FormLabel>Profile Picture</FormLabel>
                        <FormControl><Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'profilePicture')} ref={profilePicRef} /></FormControl>
                        <FormDescription>Upload a new profile picture. Recommended size: 200x200px.</FormDescription><FormMessage />
                    </FormItem>
                    )} />
                </div>
                </div>
                <FormField control={profileForm.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name*</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={profileForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl><FormDescription>Email address cannot be changed.</FormDescription><FormMessage /></FormItem>)} />
                <FormField control={profileForm.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={profileForm.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} value={field.value || ''} rows={3}/></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>E-Signature Settings</CardTitle><CardDescription>Set up your digital signature for authenticating documents.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
                <FormField control={profileForm.control} name="eSignature" render={({ field }) => (
                <FormItem><FormLabel>Signature Image</FormLabel>
                    <FormControl><div className="p-4 border rounded-md bg-secondary/30 min-h-[100px] flex justify-center items-center">
                    {eSignaturePreview ? <Image src={eSignaturePreview} alt="E-Signature Preview" width={200} height={80} className="max-h-[80px] object-contain" /> : <p className="text-sm text-muted-foreground">No signature uploaded</p>}
                    </div></FormControl>
                    <div className="flex items-center gap-2 mt-2"><Button type="button" variant="outline" size="sm" onClick={() => signatureRef.current?.click()}><UploadCloud className="mr-2 h-4 w-4" /> Upload Signature</Button><Input id="signature-upload" type="file" accept="image/png, image/jpeg" ref={signatureRef} className="hidden" onChange={(e) => handleFileChange(e, 'eSignature')} /></div>
                    <FormDescription>Upload a transparent PNG of your signature (max {MAX_FILE_SIZE_MB}MB).</FormDescription><FormMessage />
                </FormItem>
                )} />
                
                <div className="space-y-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowSignaturePhrases(!showSignaturePhrases)}>
                        {showSignaturePhrases ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                        {showSignaturePhrases ? 'Hide' : 'Show'} Signature Phrases
                    </Button>
                    {showSignaturePhrases && (
                        <div className="space-y-4 pt-2">
                             <FormField control={profileForm.control} name="signaturePhrase1" render={({ field }) => (<FormItem><FormLabel>Signature Phrase 1</FormLabel><FormControl><Input {...field} placeholder="e.g., For {COMPANY_NAME}" value={field.value || ''} /></FormControl><FormDescription>This will appear below your signature image. Use placeholders like {"{COMPANY_NAME}"}.</FormDescription><FormMessage /></FormItem>)} />
                             <FormField control={profileForm.control} name="signaturePhrase2" render={({ field }) => (<FormItem><FormLabel>Signature Phrase 2</FormLabel><FormControl><Input {...field} placeholder="e.g., Authorized Signatory" value={field.value || ''} /></FormControl><FormDescription>A second line for designation or other text.</FormDescription><FormMessage /></FormItem>)} />
                        </div>
                    )}
                </div>
            </CardContent>
            <CardFooter><Button type="submit" disabled={isSavingProfile}><span className="flex items-center">{isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}{isSavingProfile ? "Saving Profile..." : "Save Profile Changes"}</span></Button></CardFooter>
        </Card>
        </form>
    </Form>
  );
}
