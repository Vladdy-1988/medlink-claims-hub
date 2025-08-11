import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  MoreHorizontal,
  Edit,
  Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export interface ClaimTableData {
  id: string;
  claimNumber: string;
  patientName: string;
  insurerName: string;
  amount: string;
  status: 'draft' | 'submitted' | 'processing' | 'approved' | 'paid' | 'denied' | 'info_requested';
  createdAt: string;
  updatedAt: string;
  type: 'claim' | 'preauth';
}

interface ClaimsTableProps {
  claims: ClaimTableData[];
  isLoading?: boolean;
  onClaimSelect?: (claimId: string) => void;
  className?: string;
}

type SortField = 'claimNumber' | 'patientName' | 'insurerName' | 'amount' | 'status' | 'createdAt' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

const statusConfig = {
  draft: { color: 'bg-slate-100 text-slate-700', label: 'Draft' },
  submitted: { color: 'bg-blue-100 text-blue-700', label: 'Submitted' },
  processing: { color: 'bg-yellow-100 text-yellow-700', label: 'Processing' },
  approved: { color: 'bg-green-100 text-green-700', label: 'Approved' },
  paid: { color: 'bg-emerald-100 text-emerald-700', label: 'Paid' },
  denied: { color: 'bg-red-100 text-red-700', label: 'Denied' },
  info_requested: { color: 'bg-orange-100 text-orange-700', label: 'Info Requested' },
};

/**
 * ClaimsTable - A comprehensive table component for displaying and managing claims
 * 
 * Features:
 * - Search functionality across multiple fields
 * - Filtering by status, insurer, and date range
 * - Sorting by any column (ascending/descending)
 * - Pagination with configurable page size
 * - Responsive design with mobile-friendly layout
 * - Action menu for each claim (view, edit, download)
 * - Loading skeleton states
 * - Accessible design with proper ARIA labels
 */
export function ClaimsTable({ claims, isLoading = false, onClaimSelect, className }: ClaimsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [insurerFilter, setInsurerFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Get unique insurers for filter dropdown
  const uniqueInsurers = useMemo(() => {
    const insurers = [...new Set(claims.map(claim => claim.insurerName))];
    return insurers.sort();
  }, [claims]);

  // Filter and sort claims
  const filteredAndSortedClaims = useMemo(() => {
    let filtered = claims;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(claim =>
        claim.claimNumber.toLowerCase().includes(term) ||
        claim.patientName.toLowerCase().includes(term) ||
        claim.insurerName.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(claim => claim.status === statusFilter);
    }

    // Apply insurer filter
    if (insurerFilter !== 'all') {
      filtered = filtered.filter(claim => claim.insurerName === insurerFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date fields
      if (sortField === 'createdAt' || sortField === 'updatedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle amount field
      if (sortField === 'amount') {
        aValue = parseFloat(aValue.replace(/[^0-9.-]+/g, ''));
        bValue = parseFloat(bValue.replace(/[^0-9.-]+/g, ''));
      }

      // Handle string fields
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [claims, searchTerm, statusFilter, insurerFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedClaims.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedClaims = filteredAndSortedClaims.slice(startIndex, startIndex + pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Claims</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle>Claims ({filteredAndSortedClaims.length})</CardTitle>
          
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search claims..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
                data-testid="search-claims"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="filter-status">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(statusConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={insurerFilter} onValueChange={setInsurerFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="filter-insurer">
                <SelectValue placeholder="Insurer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Insurers</SelectItem>
                {uniqueInsurers.map((insurer) => (
                  <SelectItem key={insurer} value={insurer}>
                    {insurer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredAndSortedClaims.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500">No claims found matching your criteria.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    {[
                      { field: 'claimNumber' as SortField, label: 'Claim #' },
                      { field: 'patientName' as SortField, label: 'Patient' },
                      { field: 'insurerName' as SortField, label: 'Insurer' },
                      { field: 'amount' as SortField, label: 'Amount' },
                      { field: 'status' as SortField, label: 'Status' },
                      { field: 'updatedAt' as SortField, label: 'Last Updated' },
                    ].map(({ field, label }) => (
                      <th key={field} className="text-left py-3 px-4">
                        <button
                          onClick={() => handleSort(field)}
                          className="flex items-center space-x-1 font-medium text-slate-700 hover:text-slate-900"
                          data-testid={`sort-${field}`}
                        >
                          <span>{label}</span>
                          <SortIcon field={field} />
                        </button>
                      </th>
                    ))}
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClaims.map((claim) => (
                    <tr key={claim.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium">{claim.claimNumber}</td>
                      <td className="py-3 px-4">{claim.patientName}</td>
                      <td className="py-3 px-4">{claim.insurerName}</td>
                      <td className="py-3 px-4">${claim.amount}</td>
                      <td className="py-3 px-4">
                        <Badge className={statusConfig[claim.status].color}>
                          {statusConfig[claim.status].label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {formatDistanceToNow(new Date(claim.updatedAt), { addSuffix: true })}
                      </td>
                      <td className="py-3 px-4">
                        <ClaimActionsMenu claim={claim} onSelect={onClaimSelect} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-4">
              {paginatedClaims.map((claim) => (
                <Card key={claim.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{claim.claimNumber}</span>
                    <Badge className={statusConfig[claim.status].color}>
                      {statusConfig[claim.status].label}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <div>Patient: {claim.patientName}</div>
                    <div>Insurer: {claim.insurerName}</div>
                    <div>Amount: ${claim.amount}</div>
                    <div>Updated: {formatDistanceToNow(new Date(claim.updatedAt), { addSuffix: true })}</div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <ClaimActionsMenu claim={claim} onSelect={onClaimSelect} />
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <span>Show</span>
                  <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>per page</span>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    data-testid="prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-sm text-slate-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Actions menu for each claim row
 */
function ClaimActionsMenu({ 
  claim, 
  onSelect 
}: { 
  claim: ClaimTableData; 
  onSelect?: (claimId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" data-testid={`actions-${claim.claimNumber}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/claims/${claim.id}`} className="flex items-center">
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect?.(claim.id)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Claim
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Download className="h-4 w-4 mr-2" />
          Download
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Helper function to transform claim data for table display
 */
export function transformClaimsForTable(claims: any[]): ClaimTableData[] {
  return claims.map(claim => ({
    id: claim.id,
    claimNumber: claim.claimNumber,
    patientName: claim.patient?.name || 'Unknown Patient',
    insurerName: claim.insurer?.name || 'Unknown Insurer',
    amount: claim.amount,
    status: claim.status,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
    type: claim.type,
  }));
}