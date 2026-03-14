'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { UserPlus, Users, Trash2, Edit3, Mail, CalendarDays, CheckCircle, XCircle, AlertTriangle, Phone, Briefcase, UserCog, LogOut, Info, Home as HomeIcon, Activity, Search, ArrowDownUp } from "lucide-react";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import type { TeamMember, TeamInvitation, TeamPermissions, UserProfile, EnrichedUserProfile } from '@/types';
import { DEFAULT_TEAM_PERMISSIONS } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import EditPermissionsModal from '@/components/team/EditPermissionsModal';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import TeamLoadingSkeleton from '../../app/dashboard/team/loading';

const renderPermissionsSummary = (permissions: TeamPermissions | undefined | null): string => {
  if (!permissions) return "No permissions defined.";

  const grantedCategories: string[] = [];
  if (permissions.canManageTeam) grantedCategories.push("Team Admin");

  const estimatePermissions =
    permissions.canCreateEstimates &&
    permissions.canEditEstimates &&
    permissions.canDeleteEstimates &&
    permissions.canChangeEstimateStatus;

  const workOrderPermissions =
    permissions.canCreateWorkOrders &&
    permissions.canEditWorkOrders &&
    permissions.canDeleteWorkOrders &&
    permissions.canChangeWorkOrderStatus;

  const invoicePermissions =
    permissions.canCreateInvoices &&
    permissions.canEditInvoices &&
    permissions.canDeleteInvoices &&
    permissions.canChangeInvoiceStatus;

  if (estimatePermissions || permissions.canViewEstimates) grantedCategories.push("Estimates");
  if (workOrderPermissions || permissions.canViewWorkOrders) grantedCategories.push("Work Orders");
  if (invoicePermissions || permissions.canViewInvoices) grantedCategories.push("Invoices");

  if (
    permissions.canManageLabourRegister ||
    permissions.canRecordLabourAttendance ||
    permissions.canManageLabourPayments
  ) grantedCategories.push("Labour");

  if (permissions.canManageDocuments) grantedCategories.push("Documents");

  const assetPermissions = [
    permissions.canManageCompanies,
    permissions.canManageBankAccounts,
    permissions.canManageOwnerLicenses,
    permissions.canManageOwnerSORs,
    permissions.canManageOrganizations,
  ];
  if (assetPermissions.some(Boolean)) grantedCategories.push("Assets/Setup");

  if (permissions.canViewFinancialSummaries || permissions.canRunAudits) grantedCategories.push("Reporting/Audits");
  if (permissions.canViewActivityLog) grantedCategories.push("Activity Log");
  if (permissions.canManageListings) grantedCategories.push("Marketplace Listings");
  if (permissions.canManageDigitalBusinessCards) grantedCategories.push("Digital Cards");

  const aiPermissions = [];
  if (permissions.canUseAiEstimateGeneration) aiPermissions.push("AI Est. Gen");
  if (permissions.canUseAiDocumentAnalysis) aiPermissions.push("AI Doc Analysis");
  if (permissions.canUseAiRiskAssessment) aiPermissions.push("AI Risk Assess");
  if (aiPermissions.length > 0) grantedCategories.push(`AI (${aiPermissions.join(', ')})`);

  if (grantedCategories.length === 0) return "No specific permissions granted.";
  if (grantedCategories.length > 2) return grantedCategories.slice(0, 2).join(', ') + ', and more...';
  return grantedCategories.join(', ');
};

export default function TeamPageContent() {
  const {
    user,
    userProfile,
    loading: authLoading,
    activeContextOwnerId,
    setActiveContextOwnerId,
    currentTeamOwnerProfile,
    isUserActuallyATeamMember,
    isViewingOwnAccount,
    teamOwnerProfileFromInitialLoad,
    teamMemberPermissionsFromInitialLoad,
    updateGlobalUserProfile: updateGlobalUserProfileAndContext,
    currentTeamMemberPermissions,
  } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [activeMembers, setActiveMembers] = useState<TeamMember[]>([]);
  const [pendingSentInvitations, setPendingSentInvitations] = useState<TeamInvitation[]>([]);
  const [pendingReceivedInvitations, setPendingReceivedInvitations] = useState<TeamInvitation[]>([]);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);

  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isEditPermissionsModalOpen, setIsEditPermissionsModalOpen] = useState(false);
  const [isLeaveTeamConfirmOpen, setIsLeaveTeamConfirmOpen] = useState(false);
  const { setIsLoading: setGlobalIsLoading } = useLoading();

  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [memberSortConfig, setMemberSortConfig] = useState<{ key: keyof TeamMember; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
  const [memberCurrentPage, setMemberCurrentPage] = useState(1);
  const [memberItemsPerPage, setMemberItemsPerPage] = useState(5);

  const [inviteSearchTerm, setInviteSearchTerm] = useState('');
  const [inviteSortConfig, setInviteSortConfig] = useState<{ key: keyof TeamInvitation; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });
  const [inviteCurrentPage, setInviteCurrentPage] = useState(1);
  const [inviteItemsPerPage, setInviteItemsPerPage] = useState(5);

  const isMemberViewingSupervisorMode = !isViewingOwnAccount && isUserActuallyATeamMember;
  const canManageTeam = isViewingOwnAccount || !!currentTeamMemberPermissions?.canManageTeam;

  const fetchData = useCallback(async () => {
    if (!user || !activeContextOwnerId) {
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);

    try {
      const idToken = await user.getIdToken();
      const requestsToRun: Promise<any>[] = [
        fetch(`/api/dashboard/pending-invitations`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
        fetch(`/api/team/members?dataOwnerId=${activeContextOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }),
      ];

      if (canManageTeam) {
        requestsToRun.push(fetch(`/api/team/invitations?dataOwnerId=${activeContextOwnerId}`, { headers: { 'Authorization': `Bearer ${idToken}` } }));
      } else {
        setPendingSentInvitations([]);
      }

      const responses = await Promise.allSettled(requestsToRun);

      if (responses[0].status === 'fulfilled') {
        const res = responses[0].value;
        if (res.ok) setPendingReceivedInvitations(await res.json());
        else {
          const errorData = await res.json().catch(() => ({ error: "Could not fetch received invitations." }));
          toast({ title: "Error fetching received invitations", description: errorData.error, variant: "destructive" });
        }
      }

      if (responses[1].status === 'fulfilled') {
        const res = responses[1].value;
        if (res.ok) setActiveMembers(await res.json());
        else {
          const errorData = await res.json().catch(() => ({ error: "Could not fetch team members." }));
          toast({ title: "Error fetching team members", description: errorData.error, variant: "destructive" });
        }
      }

      if (canManageTeam && responses.length > 2 && responses[2].status === 'fulfilled') {
        const res = responses[2].value;
        if (res.ok) setPendingSentInvitations(await res.json());
        else {
          const errorData = await res.json().catch(() => ({ error: "Could not fetch sent invitations." }));
          toast({ title: "Error fetching sent invitations", description: errorData.error, variant: "destructive" });
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to load team data: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [user, activeContextOwnerId, toast, isViewingOwnAccount, canManageTeam]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, activeContextOwnerId, fetchData]);

  const handleInvitationResponse = async (invitationId: string, accept: boolean) => {
    if (!user || !userProfile || !invitationId) return;
    setProcessingItemId(invitationId);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/team/invitations/${invitationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ status: accept ? 'accepted' : 'declined' }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "An unknown error occurred." }));
        throw new Error(errorData.error || 'Failed to respond to invitation.');
      }
      toast({ title: `Invitation ${accept ? 'Accepted' : 'Declined'}`, description: `You have ${accept ? 'joined' : 'declined'} the team.` });

      if (accept && updateGlobalUserProfileAndContext && userProfile) {
        const updatedInviteData = await response.json();
        const newProfileData: Partial<UserProfile> = {
          ownerId: updatedInviteData.ownerId,
          teamMemberId: user.uid,
        };
        const fullyUpdatedProfile = { ...userProfile, ...newProfileData } as UserProfile;
        const ownerProfileData = null;

        updateGlobalUserProfileAndContext(
          { userProfile: fullyUpdatedProfile, teamMemberPermissions: updatedInviteData.permissions, teamOwnerProfileData: ownerProfileData },
          user
        );
        setActiveContextOwnerId(updatedInviteData.ownerId);
        setGlobalIsLoading(true);
        router.push('/dashboard');
      } else {
        fetchData();
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to respond to invitation: ${error.message}`, variant: "destructive" });
    }
    setProcessingItemId(null);
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!user) return;
    setIsProcessingAction(true);
    setProcessingItemId(invitationId);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/team/invitations/${invitationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "An unknown error occurred." }));
        throw new Error(errorData.error || 'Failed to cancel invitation.');
      }
      toast({ title: "Invitation Cancelled" });
      setPendingSentInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to cancel invitation: ${error.message}`, variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
      setProcessingItemId(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!user) return;
    setIsProcessingAction(true);
    setProcessingItemId(memberId);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/team/members/${memberId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "An unknown error occurred." }));
        throw new Error(errorData.error || 'Failed to remove member.');
      }
      toast({ title: "Member Removed" });
      setActiveMembers(prev => prev.filter(m => m.memberUid !== memberId));
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to remove member: ${error.message}`, variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
      setProcessingItemId(null);
    }
  };

  const handleLeaveTeam = async () => {
    if (!user || !isUserActuallyATeamMember) return;
    setIsProcessingAction(true);
    setProcessingItemId(user.uid);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/team/members/${user.uid}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${idToken}` } });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "An unknown error occurred." }));
        throw new Error(errorData.error || "Failed to leave team.");
      }
      toast({ title: "Successfully Left Team", description: "Your data context has reverted to your own account." });

      if (updateGlobalUserProfileAndContext && userProfile) {
        const newProfileData: Partial<UserProfile> = { ownerId: null, teamMemberId: null, updatedAt: new Date().toISOString() };
        const updatedEnrichedProfile: EnrichedUserProfile = { userProfile: { ...userProfile, ...newProfileData }, teamMemberPermissions: null, teamOwnerProfileData: null };
        updateGlobalUserProfileAndContext(updatedEnrichedProfile, user);
      }
      setGlobalIsLoading(true);
      setActiveContextOwnerId(user.uid);
      router.push('/dashboard');
    } catch (error: any) {
      toast({ title: "Error Leaving Team", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
      setProcessingItemId(null);
      setIsLeaveTeamConfirmOpen(false);
    }
  };

  const handleOpenEditPermissionsModal = (member: TeamMember) => {
    setEditingMember(member);
    setIsEditPermissionsModalOpen(true);
  };

  const handleSavePermissions = async (memberUid: string, permissions: TeamPermissions) => {
    if (!user || !canManageTeam) return;
    setIsProcessingAction(true);
    setProcessingItemId(memberUid);
  
    try {
      // Create mutable copy first → TypeScript allows overriding
      const mutableDefaults = { ...DEFAULT_TEAM_PERMISSIONS };
  
      // Now override safely (TypeScript sees mutable booleans)
      const updatedPermissions: TeamPermissions = {
        ...mutableDefaults,
        ...permissions,
      };
  
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/team/members/${memberUid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ permissions: updatedPermissions }),
      });
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "An unknown error occurred." }));
        throw new Error(errorData.error || "Failed to update permissions.");
      }
  
      toast({ title: "Permissions Updated" });
      setActiveMembers(prev => prev.map(m =>
        m.memberUid === memberUid ? { ...m, permissions: updatedPermissions } : m
      ));
      setIsEditPermissionsModalOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to update permissions: ${error.message}`, variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
      setProcessingItemId(null);
    }
  };

  const sortedAndFilteredMembers = useMemo(() => {
    let filtered = activeMembers.filter(member => {
      const term = memberSearchTerm.toLowerCase();
      return (
        member.name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        (member.phoneNumber && member.phoneNumber.includes(term))
      );
    });

    if (memberSortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[memberSortConfig.key];
        const bValue = b[memberSortConfig.key];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue) * (memberSortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [activeMembers, memberSearchTerm, memberSortConfig]);

  const memberTotalPages = Math.ceil(sortedAndFilteredMembers.length / memberItemsPerPage);
  const paginatedMembers = sortedAndFilteredMembers.slice((memberCurrentPage - 1) * memberItemsPerPage, memberCurrentPage * memberItemsPerPage);

  const sortedAndFilteredInvitations = useMemo(() => {
    let filtered = pendingSentInvitations.filter(invite => {
      const term = inviteSearchTerm.toLowerCase();
      return (
        invite.invitedMemberName.toLowerCase().includes(term) ||
        (invite.invitedEmail && invite.invitedEmail.toLowerCase().includes(term)) ||
        (invite.invitedPhoneNumber && invite.invitedPhoneNumber.includes(term))
      );
    });

    if (inviteSortConfig) {
      filtered.sort((a, b) => {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * (inviteSortConfig.direction === 'asc' ? 1 : -1);
      });
    }
    return filtered;
  }, [pendingSentInvitations, inviteSearchTerm, inviteSortConfig]);

  const inviteTotalPages = Math.ceil(sortedAndFilteredInvitations.length / inviteItemsPerPage);
  const paginatedInvitations = sortedAndFilteredInvitations.slice((inviteCurrentPage - 1) * inviteItemsPerPage, inviteCurrentPage * inviteItemsPerPage);

  const handleMemberSortChange = (value: string) => {
    if (value === 'none') {
      setMemberSortConfig(null);
    } else {
      const [key, direction] = value.split('_') as [keyof TeamMember, 'asc' | 'desc'];
      setMemberSortConfig({ key, direction });
    }
  };

  if (authLoading || !userProfile) {
    return <TeamLoadingSkeleton />;
  }
  if (!user) { return <p className="p-4 text-center">Please sign in to manage your team.</p>; }

  const currentContextName = isViewingOwnAccount
    ? "My Account"
    : (currentTeamOwnerProfile?.fullName || currentTeamOwnerProfile?.email || "Team Account");

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center">
            <UserCog className="mr-3 h-7 w-7 text-primary" /> Team Management
          </h1>
          <p className="text-muted-foreground">View your team status, invitations, and manage members.</p>
        </div>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Info className="mr-2 h-5 w-5" /> Current Data Context
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            You are currently managing: <strong>{currentContextName}</strong>.
          </p>
          {isUserActuallyATeamMember && (
            <p className="text-xs mt-1">
              To switch context, use the User Menu (top-right) or the `Team` icon in the bottom bar (mobile).
            </p>
          )}
        </CardContent>
      </Card>

      {isUserActuallyATeamMember && (
        <Card className="shadow-lg border-green-500/70 bg-green-50/50">
          <CardHeader>
            <CardTitle className="text-lg text-green-800">Your Team Membership</CardTitle>
            <CardDescription>Your role within another user`s team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              You are a member of <strong>{teamOwnerProfileFromInitialLoad?.fullName || 'your team'}</strong>`s team. Your actions in `My Account` view affect your own data. In `Supervisor Mode` you act on behalf of the owner.
            </p>
            {teamMemberPermissionsFromInitialLoad && (
              <p className="text-xs text-muted-foreground mt-1">
                Your assigned permissions for their team: {renderPermissionsSummary(teamMemberPermissionsFromInitialLoad)}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <AlertDialog open={isLeaveTeamConfirmOpen} onOpenChange={setIsLeaveTeamConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isProcessingAction && processingItemId === user?.uid}>
                  <span className="flex items-center">
                    {isProcessingAction && processingItemId === user?.uid ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="mr-2 h-4 w-4" />
                    )}{' '}
                    Leave Team
                  </span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to leave this team?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will lose access to your team`s data, and your permissions will be revoked. This action cannot be undone by you.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isProcessingAction && processingItemId === user?.uid}>Stay in Team</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLeaveTeam}
                    className="bg-destructive hover:bg-destructive/90"
                    disabled={isProcessingAction && processingItemId === user?.uid}
                  >
                    <span className="flex items-center">
                      {isProcessingAction && processingItemId === user?.uid ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="mr-2 h-4 w-4" />
                      )}{' '}
                      {isProcessingAction && processingItemId === user?.uid ? "Leaving..." : "Confirm & Leave Team"}
                    </span>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      )}

      {isViewingOwnAccount && (
        <Card className="shadow-lg border-blue-500/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-blue-600">
              <Mail className="mr-3 h-6 w-6" /> Invitations For You
            </CardTitle>
            <CardDescription>Team invitations that are awaiting your response.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <Skeleton className="h-20 w-full" />
            ) : pendingReceivedInvitations.length === 0 ? (
              <p className="text-muted-foreground text-sm">No pending invitations for you.</p>
            ) : (
              <div className="space-y-4">
                {pendingReceivedInvitations.map((invite) => (
                  <Card key={invite.id} className="p-3 shadow-sm border">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-medium">
                          Invited by: <span className="text-primary">{invite.ownerName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          To collaborate on: {invite.associatedWorkOrderNumber ? `Work Order #${invite.associatedWorkOrderNumber}` : "General Tasks"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Invited: {format(new Date(invite.createdAt), "dd MMM yyyy")}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 sm:mt-0 sm:text-right max-w-xs">
                        <p className="font-medium text-foreground mb-0.5">Permissions Summary:</p>
                        <p
                          className="line-clamp-2"
                          title={Object.entries(invite.permissions)
                            .filter(([, value]) => value)
                            .map(([key]) => key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))
                            .join(', ')}
                        >
                          {renderPermissionsSummary(invite.permissions)}
                        </p>
                      </div>
                    </div>
                    <CardFooter className="p-0 pt-2.5 mt-2.5 border-t flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleInvitationResponse(invite.id!, false)}
                        disabled={processingItemId === invite.id}
                      >
                        <span className="flex items-center">
                          {processingItemId === invite.id && invite.status !== 'accepted' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="mr-1.5 h-3 w-3 text-destructive" /> Decline
                            </>
                          )}
                        </span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleInvitationResponse(invite.id!, true)}
                        disabled={processingItemId === invite.id}
                      >
                        <span className="flex items-center">
                          {processingItemId === invite.id && invite.status !== 'declined' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="mr-1.5 h-3 w-3" /> Accept
                            </>
                          )}
                        </span>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Separator className="my-8" />

      {canManageTeam && (
        <>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Manage Your Team</CardTitle>
              <CardDescription>Invite and manage members who can access your data.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/team/new" onClick={() => setGlobalIsLoading(true)}>
                <Button>
                  <span className="flex items-center">
                    <UserPlus className="mr-2 h-5 w-5" /> Invite New Member
                  </span>
                </Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Active Team Members</CardTitle>
              <CardDescription>Members who have accepted your invitation.</CardDescription>
              <div className="pt-2 flex flex-col md:flex-row gap-2">
                <Input
                  placeholder="Search by Name, Email, Phone..."
                  value={memberSearchTerm}
                  onChange={(e) => {
                    setMemberSearchTerm(e.target.value);
                    setMemberCurrentPage(1);
                  }}
                  className="max-w-md"
                  icon={<Search className="h-4 w-4 text-muted-foreground" />}
                />
                <Select
                  onValueChange={handleMemberSortChange}
                  defaultValue={memberSortConfig ? memberSortConfig.key : 'name'}
                >
                  <SelectTrigger className="w-full md:w-[180px]">
                    <div className="flex items-center gap-2">
                      <ArrowDownUp className="h-4 w-4" />
                      <SelectValue placeholder="Sort by..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                    <SelectItem value="joinedAt_desc">Joined Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <Skeleton className="h-20 w-full" />
              ) : paginatedMembers.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {memberSearchTerm ? "No members match search." : "No active team members yet."}
                </p>
              ) : (
                <div className="space-y-4">
                  {paginatedMembers.map(member => (
                    <Card key={member.memberUid} className="p-4 shadow-sm border">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-2 flex-wrap">
                        <div>
                          <h3 className="font-semibold text-md">{member.name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center">
                            <Mail className="mr-1.5 h-3 w-3" />
                            {member.email}
                          </p>
                          {member.phoneNumber && (
                            <p className="text-sm text-muted-foreground flex items-center">
                              <Phone className="mr-1.5 h-3 w-3" />
                              {member.phoneNumber}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end gap-2 mt-2 sm:mt-0 w-full sm:w-auto flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditPermissionsModal(member)}
                            disabled={isProcessingAction}
                          >
                            <span className="flex items-center">
                              <Edit3 className="mr-2 h-4 w-4" />
                              {isProcessingAction && processingItemId === member.memberUid ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Manage Permissions
                            </span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={isProcessingAction && processingItemId === member.memberUid}
                              >
                                <span className="flex items-center">
                                  <Trash2 className="mr-2 h-4 w-4" /> Remove
                                </span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
                                <AlertDialogDescription>Are you sure? Their access will be revoked.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isProcessingAction && processingItemId === member.memberUid}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveMember(member.memberUid, member.name)}
                                  className="bg-destructive hover:bg-destructive/90"
                                  disabled={isProcessingAction && processingItemId === member.memberUid}
                                >
                                  <span className="flex items-center">
                                    {isProcessingAction && processingItemId === member.memberUid ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="mr-2 h-4 w-4" />
                                    )}
                                    {isProcessingAction && processingItemId === member.memberUid ? "Removing..." : "Remove"}
                                  </span>
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
            {sortedAndFilteredMembers.length > 0 && !isLoadingData && (
              <CardFooter className="border-t pt-2">
                <DataTablePagination
                  currentPage={memberCurrentPage}
                  totalPages={memberTotalPages}
                  onPageChange={setMemberCurrentPage}
                  itemsPerPage={memberItemsPerPage}
                  onItemsPerPageChange={(value) => {
                    setMemberItemsPerPage(value);
                    setMemberCurrentPage(1);
                  }}
                  canPreviousPage={memberCurrentPage > 1}
                  canNextPage={memberCurrentPage < memberTotalPages}
                  itemCount={activeMembers.length}
                  filteredItemCount={sortedAndFilteredMembers.length}
                />
              </CardFooter>
            )}
          </Card>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Pending Sent Invitations</CardTitle>
              <CardDescription>Invitations you`ve sent that are awaiting a response.</CardDescription>
              <div className="pt-2 flex flex-col md:flex-row gap-2">
                <Input
                  placeholder="Search by Name, Email, Phone..."
                  value={inviteSearchTerm}
                  onChange={(e) => {
                    setInviteSearchTerm(e.target.value);
                    setInviteCurrentPage(1);
                  }}
                  className="max-w-md"
                  icon={<Search className="h-4 w-4 text-muted-foreground" />}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingData ? (
                <Skeleton className="h-20 w-full" />
              ) : paginatedInvitations.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {inviteSearchTerm ? "No invitations match search." : "No pending invitations sent."}
                </p>
              ) : (
                <div className="space-y-4">
                  {paginatedInvitations.map(invite => (
                    <Card key={invite.id} className="p-3 shadow-sm border">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-2 flex-wrap">
                        <div>
                          <p className="text-sm font-medium">
                            Invited: <span className="text-primary">{invite.invitedMemberName}</span> (
                            {invite.invitedEmail || invite.invitedPhoneNumber})
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Scope: {invite.associatedWorkOrderNumber ? `Work Order #${invite.associatedWorkOrderNumber}` : "General Tasks"}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancelInvitation(invite.id!)}
                          disabled={isProcessingAction && processingItemId === invite.id}
                        >
                          <span className="flex items-center">
                            {isProcessingAction && processingItemId === invite.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Cancel Invitation
                          </span>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
            {sortedAndFilteredInvitations.length > 0 && !isLoadingData && (
              <CardFooter className="border-t pt-2">
                <DataTablePagination
                  currentPage={inviteCurrentPage}
                  totalPages={inviteTotalPages}
                  onPageChange={setInviteCurrentPage}
                  itemsPerPage={inviteItemsPerPage}
                  onItemsPerPageChange={(value) => {
                    setInviteItemsPerPage(value);
                    setInviteCurrentPage(1);
                  }}
                  canPreviousPage={inviteCurrentPage > 1}
                  canNextPage={inviteCurrentPage < inviteTotalPages}
                  itemCount={pendingSentInvitations.length}
                  filteredItemCount={sortedAndFilteredInvitations.length}
                />
              </CardFooter>
            )}
          </Card>
        </>
      )}

      {editingMember && (
        <EditPermissionsModal
          isOpen={isEditPermissionsModalOpen}
          onOpenChange={setIsEditPermissionsModalOpen}
          member={editingMember}
          onSave={handleSavePermissions}
          isProcessing={isProcessingAction && processingItemId === editingMember.memberUid}
        />
      )}
    </div>
  );
}