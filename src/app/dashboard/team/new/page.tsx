'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label"; 
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { TeamPermissions, TeamInvitation, WorkOrder, UserProfile, AppConfiguration } from '@/types';
import { DEFAULT_TEAM_PERMISSIONS } from '@/types';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useLoading } from '@/contexts/loading-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2 } from 'lucide-react';
import { UserPlus, Save, ArrowLeft, AlertTriangle, Mail, Phone, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { permissionGroups } from '@/lib/permissions';

const inviteTeamMemberFormSchema = z.object({
  invitedMemberName: z.string().min(2, "Member's name is required.").max(100),
  invitationMethod: z.enum(['email', 'phone']).default('email'),
  invitedEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  invitedCountryCode: z.string().optional().or(z.literal('')),
  invitedLocalPhoneNumber: z.string().optional().or(z.literal('')),
  associatedWorkOrderId: z.string().optional().nullable(),
  permissions: z.custom<TeamPermissions>((val) => typeof val === 'object' && val !== null, {
    message: "Permissions must be a valid object.",
  }).default(DEFAULT_TEAM_PERMISSIONS),
}).superRefine((data, ctx) => {
  if (data.invitationMethod === 'email') {
    if (!data.invitedEmail) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email is required for email invitation.", path: ["invitedEmail"] });
    } else if (!z.string().email().safeParse(data.invitedEmail).success) {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please enter a valid email address.", path: ["invitedEmail"] });
    }
  } else if (data.invitationMethod === 'phone') {
    if (!data.invitedCountryCode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Country code is required for phone invitation.", path: ["invitedCountryCode"] });
    } else if (!/^\+\d{1,3}$/.test(data.invitedCountryCode)) {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid country code (e.g., +91).", path: ["invitedCountryCode"] });
    }
    if (!data.invitedLocalPhoneNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Local phone number is required for phone invitation.", path: ["invitedLocalPhoneNumber"] });
    } else if (!/^\d{7,15}$/.test(data.invitedLocalPhoneNumber)) {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Phone number must be 7-15 digits.", path: ["invitedLocalPhoneNumber"] });
    }
  }
});

type InviteTeamMemberFormValues = z.infer<typeof inviteTeamMemberFormSchema>;

function InviteTeamMemberPageContent() {
  const { user, userProfile, dataOwnerId, loading: authLoading, updateGlobalUserProfile, isViewingOwnAccount, currentTeamMemberPermissions } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [workOrderOptions, setWorkOrderOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingWorkOrders, setIsLoadingWorkOrders] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  const hasPrefilledRef = React.useRef(false);

  const canInvite = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageTeam;

  const form = useForm<InviteTeamMemberFormValues>({
    resolver: zodResolver(inviteTeamMemberFormSchema),
    defaultValues: {
      invitedMemberName: "",
      invitationMethod: 'email',
      invitedEmail: "",
      invitedCountryCode: "+91",
      invitedLocalPhoneNumber: "",
      associatedWorkOrderId: "",
      permissions: { ...DEFAULT_TEAM_PERMISSIONS },
    },
  });

  const currentInvitationMethod = form.watch('invitationMethod');
  const handleMethodChange = (value: 'email' | 'phone') => {
    form.setValue('invitationMethod', value);
    form.clearErrors(); // Clear validation errors on switch
  };

  React.useEffect(() => {
    if (user && dataOwnerId && canInvite) {
      setIsLoadingWorkOrders(true);
      const fetchWorkOrders = async () => {
        try {
          const idToken = await user.getIdToken();
          const response = await fetch(`/api/work-orders?dataOwnerId=${dataOwnerId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch work orders for team invitation.');
          }
          const woData: WorkOrder[] = await response.json();
          const woOpts = woData.map(docSnap => ({
            value: docSnap.id!,
            label: `${docSnap.workOrderNumber} - ${docSnap.scopeOfWork?.substring(0,50) || 'Work Order'}...`,
          }));
          setWorkOrderOptions(woOpts);
        } catch (error) {
          console.error("Error fetching work orders for team invitation:", error);
          toast({ title: "Error", description: "Could not load work orders.", variant: "destructive" });
        }
        setIsLoadingWorkOrders(false);
      };
      fetchWorkOrders();
    }
  }, [user, dataOwnerId, toast, canInvite]);

  React.useEffect(() => {
    const workOrderIdFromParams = searchParams?.get('workOrderId');
    if (workOrderIdFromParams && workOrderOptions.length > 0 && !hasPrefilledRef.current) {
        if (workOrderOptions.some(opt => opt.value === workOrderIdFromParams)) {
            form.setValue('associatedWorkOrderId', workOrderIdFromParams, { shouldValidate: true });
            hasPrefilledRef.current = true; // Mark as prefilled
        }
    }
  }, [searchParams, workOrderOptions, form]);

  const onSubmit = async (values: InviteTeamMemberFormValues) => {
    setGlobalIsLoading(true);
    setIsSubmitting(true);
    if (!user || !userProfile || !dataOwnerId) {
      toast({ title: "Authentication Error", description: "You must be logged in to invite team members.", variant: "destructive" });
      setIsSubmitting(false);
      setGlobalIsLoading(false);
      return;
    }
    
    if (!canInvite) {
        toast({ title: "Permission Denied", description: "You do not have permission to send invitations.", variant: "destructive" });
        setIsSubmitting(false);
        setGlobalIsLoading(false);
        return;
    }

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/team/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === 'INVITATION_EXISTS') {
          toast({ title: "Invitation Exists", description: errorData.error, variant: "default" });
        } else if (errorData.code === 'INSUFFICIENT_POINTS') {
           toast({ title: "Insufficient Points", description: errorData.error, variant: "destructive", duration: 7000 });
        } else {
          throw new Error(errorData.error || 'Failed to send invitation.');
        }
        setIsSubmitting(false);
        setGlobalIsLoading(false);
        return;
      }
      
      const result = await response.json();
      if (updateGlobalUserProfile && userProfile && result.newResourcePoints !== undefined && dataOwnerId === user.uid) {
        const newProfileData = { ...userProfile, resourcePoints: result.newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() };
        updateGlobalUserProfile({ userProfile: newProfileData, teamMemberPermissions: null, teamOwnerProfileData: null }, user);
      }

      toast({ title: "Invitation Logged", description: `An invitation record has been created for ${values.invitedMemberName}. Cost: ${result.cost || 'N/A'} points.` });
      router.push('/dashboard/team');
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      toast({ title: "Invitation Failed", description: error.message || "Could not send invitation. Points were not deducted.", variant: "destructive" });
      setGlobalIsLoading(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) return <Skeleton className="h-96 w-full" />;

  if (!canInvite) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Action Not Allowed</h2>
        <p className="text-muted-foreground">You do not have permission to invite new members.</p>
        <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
          <Link href="/dashboard/team">Back to Team Management</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <UserPlus className="mr-3 h-7 w-7 text-primary" /> Invite New Team Member
          </h1>
          <p className="text-muted-foreground">Enter member details, optionally associate with a Work Order, and assign permissions.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/team" onClick={() => setGlobalIsLoading(true)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Team Management
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Member & Scope</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="invitedMemberName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Member's Full Name*</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Jane Supervisor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invitationMethod"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Invitation Method*</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => handleMethodChange(value as 'email' | 'phone')}
                        value={field.value}
                        className="flex space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="email" id="inviteByEmail" />
                          <Label htmlFor="inviteByEmail" className="flex items-center cursor-pointer font-normal">
                            <Mail className="mr-2 h-4 w-4" /> Email
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="phone" id="inviteByPhone" />
                          <Label htmlFor="inviteByPhone" className="flex items-center cursor-pointer font-normal">
                            <Phone className="mr-2 h-4 w-4" /> Phone
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {currentInvitationMethod === 'email' && (
                <FormField
                  control={form.control}
                  name="invitedEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Member's Email Address*</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="member@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {currentInvitationMethod === 'phone' && (
                <div>
                  <FormLabel htmlFor="localPhoneNumberInput">Member's Phone Number*</FormLabel>
                  <div className="flex items-start space-x-2 mt-1">
                    <FormField
                      control={form.control}
                      name="invitedCountryCode"
                      render={({ field }) => (
                        <FormItem className="w-[80px]">
                          <FormControl>
                            <Input {...field} placeholder="+91" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="invitedLocalPhoneNumber"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input id="localPhoneNumberInput" type="tel" placeholder="9876543210" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="associatedWorkOrderId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Associate with specific Work Order (Optional)</FormLabel>
                    {isLoadingWorkOrders ? <Skeleton className="h-10 w-full" /> : (
                      <Combobox
                        options={workOrderOptions}
                        value={field.value || ""}
                        onChange={(value) => field.onChange(value === "" ? null : value)}
                        placeholder="Select Work Order..."
                        searchPlaceholder="Search Work Orders..."
                        disabled={isLoadingWorkOrders || workOrderOptions.length === 0}
                        emptyResultText={isLoadingWorkOrders ? "Loading..." : "No work orders found."}
                      />
                    )}
                    <FormDescription>If selected, permissions might be scoped to this Work Order in the future.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>

            <CardHeader className="pt-4">
              <CardTitle>Assign Permissions</CardTitle>
              <CardDescription>Select the modules and actions this member will be authorized for.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {permissionGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-md font-semibold mb-3 flex items-center text-primary">
                    <group.icon className="mr-2 h-5 w-5" /> {group.title}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                    
                 

{group.permissions.map((perm) => (
  <FormField
    key={perm.id}
    control={form.control}
    // Use exact literal type assertion for dynamic key
    name={`permissions.${perm.id}` as `permissions.${keyof TeamPermissions}`}
    render={({ field }) => (
      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
        <FormControl>
          <Checkbox
            // Safe boolean check: field.value is boolean, but TS may narrow it
            checked={!!field.value}           // !! converts undefined/false → false, true → true
            onCheckedChange={(checked) => {
              field.onChange(checked === true); // ensure we always set boolean true/false
            }}
          />
        </FormControl>
        <FormLabel className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {perm.label}
        </FormLabel>
      </FormItem>
    )}
  />
))}
                  </div>
                  {permissionGroups.indexOf(group) < permissionGroups.length - 1 && <Separator className="my-6" />}
                </div>
              ))}
            </CardContent>

            <CardFooter>
              <Button type="submit" disabled={isSubmitting || isLoadingWorkOrders}>
                {isSubmitting ? (
                  <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging Invitation... </>
                ) : (
                  <> <Save className="mr-2 h-4 w-4" /> Log Invitation </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}

export default function NewTeamMemberPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InviteTeamMemberPageContent />
    </Suspense>
  )
}