
'use client';

import React, { createContext, useEffect, useState, useContext, type ReactNode, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import type { UserProfile, TeamMember, TeamPermissions, EnrichedUserProfile, AppConfiguration } from '@/types';
import { addDays, isBefore } from 'date-fns';
import { StartupSplashScreen } from '@/components/layout/startup-splash-screen';

// Import Firebase types but not the initialized services directly
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  
  appConfig: AppConfiguration | null; 

  activeContextOwnerId: string | null; 
  setActiveContextOwnerId: (ownerId: string | null) => void; 

  dataOwnerId: string | null; 
  isViewingOwnAccount: boolean; 
  
  isSupervisingTeamAccount: boolean;
  currentTeamOwnerProfile: UserProfile | null;
  currentTeamMemberPermissions: TeamPermissions | null;

  isUserActuallyATeamMember: boolean; 
  teamOwnerProfileFromInitialLoad: UserProfile | null; 
  teamMemberPermissionsFromInitialLoad: TeamPermissions | null; 
  teamMemberPermissions?: TeamPermissions | null; 

  updateGlobalUserProfile: (newEnrichedProfile: Partial<EnrichedUserProfile>, userObject?: User | null) => void;
  refreshContext: () => Promise<void>;
  
  isPinEnabled: boolean;
  isPinVerified: boolean;
  verifyPin: (pin: string) => boolean;

  isPasswordChangeRequired: boolean;
  isPinChangeRequired: boolean;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  canManageSvr: boolean;
  authLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [_userProfile, _setUserProfile] = useState<UserProfile | null>(null);
  const [enrichedProfile, setEnrichedProfile] = useState<EnrichedUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [appConfig, setAppConfig] = useState<AppConfiguration | null>(null);
  const [activeContextOwnerId, setActiveContextOwnerIdState] = useState<string | null>(null);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [isPinChangeRequired, setIsPinChangeRequired] = useState(false);

  const { userProfile, teamMemberPermissions: teamMemberPermissionsFromInitialLoad, teamOwnerProfileData: teamOwnerProfileFromInitialLoad } = enrichedProfile || {};
  const isAdmin = userProfile?.isAdmin || false;
  const isUserActuallyATeamMember = !!(userProfile?.ownerId && userProfile.ownerId !== userProfile.uid);
  
  const isViewingOwnAccount = useMemo(() => activeContextOwnerId === user?.uid, [activeContextOwnerId, user]);
  const dataOwnerId = activeContextOwnerId;
  
  const isSupervisingTeamAccount = useMemo(() => isUserActuallyATeamMember && !isViewingOwnAccount, [isUserActuallyATeamMember, isViewingOwnAccount]);
  
  const currentTeamOwnerProfile = useMemo(() => isSupervisingTeamAccount ? teamOwnerProfileFromInitialLoad ?? null : null, [isSupervisingTeamAccount, teamOwnerProfileFromInitialLoad]);
  const currentTeamMemberPermissions = useMemo(() => isSupervisingTeamAccount ? teamMemberPermissionsFromInitialLoad : null, [isSupervisingTeamAccount, teamMemberPermissionsFromInitialLoad]);

  const isPinEnabled = !!userProfile?.isPinEnabled;
  const isPasswordChangeRequired = useMemo(() => {
      if (userProfile?.passwordChangeDays && userProfile.lastPasswordChangeDate) {
        const expiryDate = addDays(new Date(userProfile.lastPasswordChangeDate), userProfile.passwordChangeDays);
        return isBefore(expiryDate, new Date());
      }
      return false;
  }, [userProfile?.passwordChangeDays, userProfile?.lastPasswordChangeDate]);


  const verifyPin = useCallback((pin: string): boolean => {
    if (userProfile?.isPinEnabled && userProfile.appPin === pin) {
      setIsPinVerified(true);
      // Check for PIN expiry *after* successful verification
      if (userProfile.pinChangeDays !== null && userProfile.pinChangeDays !== undefined && userProfile.lastPinChangeDate) {
        const expiryDate = addDays(new Date(userProfile.lastPinChangeDate), userProfile.pinChangeDays);
        if (isBefore(expiryDate, new Date())) {
          setIsPinChangeRequired(true);
        }
      }
      return true;
    }
    return false;
  }, [userProfile]);


  const setActiveContextOwnerId = useCallback((newOwnerId: string | null) => {
    setActiveContextOwnerIdState(newOwnerId);
    if (typeof window !== 'undefined') {
      if (newOwnerId) {
        localStorage.setItem('activeContextOwnerId', newOwnerId);
      } else {
        localStorage.removeItem('activeContextOwnerId');
      }
    }
  }, []);

  const updateGlobalUserProfile = useCallback((newEnrichedProfile: Partial<EnrichedUserProfile>, userObject: User | null = user) => {
    setEnrichedProfile(current => {
      // If either current or new profile is null, handle it gracefully
      if (!current && !newEnrichedProfile) return null;
      if (!current) return (newEnrichedProfile as EnrichedUserProfile) || null;
      if (!newEnrichedProfile) return current;

      return {
        userProfile: newEnrichedProfile.userProfile ? { ...current.userProfile, ...newEnrichedProfile.userProfile } as UserProfile : current.userProfile,
        teamMemberPermissions: newEnrichedProfile.teamMemberPermissions !== undefined ? newEnrichedProfile.teamMemberPermissions : current.teamMemberPermissions,
        teamOwnerProfileData: newEnrichedProfile.teamOwnerProfileData !== undefined ? newEnrichedProfile.teamOwnerProfileData : current.teamOwnerProfileData,
      };
    });
  }, [user]);


  const performFullContextRefresh = useCallback(async (currentUser: User) => {
    try {
      const idToken = await currentUser.getIdToken(true);
      const [profileResponse, configResponse] = await Promise.all([
        fetch('/api/get-profile', { headers: { 'Authorization': `Bearer ${idToken}` } }),
        fetch('/api/app-configuration', { headers: { 'Authorization': `Bearer ${idToken}` } })
      ]);
      
      let fetchedEnrichedProfile: EnrichedUserProfile | null = null;
      if (profileResponse.ok) {
        fetchedEnrichedProfile = await profileResponse.json() || null;
      }
      
      if (configResponse.ok) {
        setAppConfig(await configResponse.json());
      } else {
         setAppConfig(null);
      }
      return fetchedEnrichedProfile;
    } catch (error) {
      console.error("Error during full context refresh:", error);
      return null;
    }
  }, []);
  
  const refreshContext = useCallback(async () => {
    const { getFirebaseAuth } = await import('@/lib/firebase');
    const auth = await getFirebaseAuth();
    if (auth && auth.currentUser) {
      setLoading(true);
      const fetchedProfile = await performFullContextRefresh(auth.currentUser);
      setEnrichedProfile(fetchedProfile);
      
      if (fetchedProfile?.userProfile?.isPinEnabled) {
          setIsPinVerified(false);
      } else {
          setIsPinVerified(true);
      }
      setLoading(false);
    }
  }, [performFullContextRefresh]);


  useEffect(() => {
    const initializeAuth = async () => {
        const { getFirebaseAuth } = await import('@/lib/firebase');
        const { onAuthStateChanged } = await import('firebase/auth');
        const auth = await getFirebaseAuth();

        if (!auth) { setLoading(false); return; }

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          setLoading(true);
          setIsPinVerified(false);
          setIsPinChangeRequired(false);

          if (currentUser) {
            setUser(currentUser);
            const fetchedEnrichedProfile = await performFullContextRefresh(currentUser);
            setEnrichedProfile(fetchedEnrichedProfile);
            
            const userProfileAfterFetch = fetchedEnrichedProfile?.userProfile;
            
            if (userProfileAfterFetch?.isPinEnabled) {
              setIsPinVerified(false);
            } else {
              setIsPinVerified(true); 
            }

            const isActualMember = !!(userProfileAfterFetch?.ownerId && userProfileAfterFetch.ownerId !== currentUser.uid);
            const storedContextId = typeof window !== 'undefined' ? localStorage.getItem('activeContextOwnerId') : null;
            
            let initialActiveId: string | null = currentUser.uid;
            if (isActualMember && userProfileAfterFetch?.ownerId) {
                if (storedContextId === currentUser.uid || storedContextId === userProfileAfterFetch.ownerId) {
                    initialActiveId = storedContextId;
                }
            }
            setActiveContextOwnerIdState(initialActiveId);
          } else {
            setUser(null);
            setEnrichedProfile(null);
            setActiveContextOwnerIdState(null);
            setAppConfig(null);
            setIsPinVerified(true); // No user, so no PIN needed
          }
          setLoading(false);
        });
        return () => unsubscribe();
    };

    initializeAuth();
  }, [performFullContextRefresh]);

  const contextValue: AuthContextType = useMemo(() => ({
    user, userProfile: userProfile ?? null, loading, isAdmin, appConfig, activeContextOwnerId, setActiveContextOwnerId, dataOwnerId,
    isViewingOwnAccount, isSupervisingTeamAccount,
    currentTeamOwnerProfile: currentTeamOwnerProfile ?? null, currentTeamMemberPermissions: currentTeamMemberPermissions ?? null, isUserActuallyATeamMember, 
    teamOwnerProfileFromInitialLoad: teamOwnerProfileFromInitialLoad ?? null,
    teamMemberPermissionsFromInitialLoad: teamMemberPermissionsFromInitialLoad ?? null,
    updateGlobalUserProfile, refreshContext, isPinEnabled, isPinVerified, verifyPin, isPasswordChangeRequired, isPinChangeRequired,
    setUserProfile: _setUserProfile,
    teamMemberPermissions: teamMemberPermissionsFromInitialLoad,
    authLoading: loading,
    canManageSvr: !!currentTeamMemberPermissions?.canManageSvr,
  }), [
    user, userProfile, loading, isAdmin, appConfig, activeContextOwnerId, setActiveContextOwnerId, dataOwnerId, isViewingOwnAccount, isSupervisingTeamAccount,
    currentTeamOwnerProfile, currentTeamMemberPermissions, isUserActuallyATeamMember, teamOwnerProfileFromInitialLoad, teamMemberPermissionsFromInitialLoad,
    updateGlobalUserProfile, refreshContext, isPinEnabled, isPinVerified, verifyPin, isPasswordChangeRequired, isPinChangeRequired, _setUserProfile
  ]);

  if (loading) {
    return <StartupSplashScreen />;
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
