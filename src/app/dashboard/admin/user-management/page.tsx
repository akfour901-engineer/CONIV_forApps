
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, AlertTriangle, Loader2, Search, ArrowDownUp, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { UserProfile } from '@/types';
import { format, parseISO } from 'date-fns';
import UserManagementLoadingSkeleton from './loading';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useLoading } from '@/contexts/loading-context';


export default function UserManagementPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const { toast } = useToast();
  const { setIsLoading: setGlobalIsLoading } = useLoading();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof UserProfile; direction: 'asc' | 'desc' } | null>({ key: 'dateCreated', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      setIsLoadingUsers(false);
      if (!isAdmin && user) {
         toast({ title: "Access Denied", description: "You do not have permission to access this page.", variant: "destructive"});
      }
      return;
    }

    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API request failed: ${response.status}`);
        }
        const data: UserProfile[] = await response.json();
        setUsersList(data);
      } catch (error:any) {
        console.error("Error fetching users via API:", error);
        toast({ title: "Error Loading Users", description: error.message, variant: "destructive"});
      }
      setIsLoadingUsers(false);
    };

    fetchUsers();
  }, [user, isAdmin, authLoading, toast]);
  
  const handleSortChange = (value: string) => {
    if (value === 'none') {
      setSortConfig(null);
    } else {
      const [key, direction] = value.split('_') as [keyof UserProfile, 'asc' | 'desc'];
      setSortConfig({ key, direction });
    }
  };

  const sortedAndFilteredUsers = useMemo(() => {
    let filtered = usersList.filter(u => {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        (u.fullName && u.fullName.toLowerCase().includes(searchTermLower)) ||
        (u.email && u.email.toLowerCase().includes(searchTermLower)) ||
        (u.phoneNumber && u.phoneNumber.toLowerCase().includes(searchTermLower)) ||
        (u.uid && u.uid.toLowerCase().includes(searchTermLower))
      );
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
           return (aValue - bValue) * (sortConfig.direction === 'asc' ? 1 : -1);
        }
        return 0;
      });
    }
    return filtered;
  }, [usersList, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredUsers.length / itemsPerPage);
  const paginatedUsers = sortedAndFilteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'N/A';
    try { return format(parseISO(isoString), 'dd MMM yyyy, p'); }
    catch (e) { return 'Invalid Date'; }
  };


  if (authLoading) return <UserManagementLoadingSkeleton />;

  if (!isAdmin) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">You do not have permission to access this page.</p>
            <Button asChild className="mt-6" onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/admin">Back to Admin Panel</Link>
            </Button>
        </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center">
          <Users className="mr-3 h-7 w-7 text-primary" /> User Management
        </h1>
         <Button variant="outline" asChild onClick={() => setGlobalIsLoading(true)}>
            <Link href="/dashboard/admin">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin Panel
            </Link>
          </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Registered Users</CardTitle>
          <CardDescription>
            View and manage user accounts and their details.
          </CardDescription>
           <div className="pt-2 flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Search by Name, Email, Phone, UID..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="max-w-md"
              icon={<Search className="h-4 w-4 text-muted-foreground" />}
            />
             <Select onValueChange={handleSortChange} defaultValue={sortConfig ? `${sortConfig.key}_${sortConfig.direction}` : 'none'}>
              <SelectTrigger className="w-full md:w-[180px]">
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="h-4 w-4" />
                  <SelectValue placeholder="Sort by..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dateCreated_desc">Joined: Newest</SelectItem>
                <SelectItem value="dateCreated_asc">Joined: Oldest</SelectItem>
                <SelectItem value="fullName_asc">Name (A-Z)</SelectItem>
                <SelectItem value="resourcePoints_desc">Points: High-Low</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (<UserManagementLoadingSkeleton />) : paginatedUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No users found or still loading.</p>
          ) : (
             <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="hidden sm:table-cell">Date Joined</TableHead>
                    <TableHead className="hidden lg:table-cell">Team Owner ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((u) => (
                    <TableRow key={u.uid}>
                      <TableCell className="font-medium">{u.fullName || 'N/A'}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell className="hidden md:table-cell">{u.phoneNumber || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={u.isAdmin ? "default" : "secondary"}>
                          {u.isAdmin ? 'Admin' : 'User'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{u.resourcePoints ?? 0}</TableCell>
                      <TableCell className="hidden sm:table-cell whitespace-nowrap">{formatDate(u.dateCreated)}</TableCell>
                      <TableCell className="hidden lg:table-cell truncate max-w-[100px]" title={u.ownerId || undefined}>{u.ownerId || 'N/A (Owner)'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
         {sortedAndFilteredUsers.length > 0 && !isLoadingUsers && (
          <CardFooter className="border-t pt-2">
           <DataTablePagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1); }}
            canPreviousPage={currentPage > 1}
            canNextPage={currentPage < totalPages}
            itemCount={usersList.length}
            filteredItemCount={sortedAndFilteredUsers.length}
           />
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
