import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Calendar,
  User,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from "lucide-react";
import type { Claim } from "@shared/schema";

interface ClaimsTableProps {
  showFilters?: boolean;
  pageSize?: number;
  compactView?: boolean;
}

interface ClaimsQueryParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ClaimsResponse {
  claims: Claim[];
  total: number;
  page: number;
  totalPages: number;
}

const statusConfig = {
  draft: { label: "Draft", variant: "secondary" as const, icon: FileText },
  submitted: { label: "Submitted", variant: "default" as const, icon: Clock },
  processing: { label: "Processing", variant: "default" as const, icon: Clock },
  approved: { label: "Approved", variant: "default" as const, icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive" as const, icon: XCircle },
  paid: { label: "Paid", variant: "default" as const, icon: CheckCircle },
  portal_upload_required: { label: "Upload Required", variant: "destructive" as const, icon: AlertTriangle },
};

export function ClaimsTable({ 
  showFilters = true, 
  pageSize = 10, 
  compactView = false 
}: ClaimsTableProps) {
  const [queryParams, setQueryParams] = useState<ClaimsQueryParams>({
    page: 1,
    limit: pageSize,
    sortBy: 'serviceDate',
    sortOrder: 'desc',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });
    return params.toString();
  }, [queryParams]);

  const { data: claimsData, isLoading, error } = useQuery<ClaimsResponse>({
    queryKey: ['/api/claims', queryString],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Handle filter changes
  const handleSearch = () => {
    setQueryParams(prev => ({
      ...prev,
      page: 1,
      search: searchTerm,
      status: statusFilter,
      dateFrom: dateFromFilter,
      dateTo: dateToFilter,
    }));
  };

  const handleSort = (column: string) => {
    setQueryParams(prev => ({
      ...prev,
      page: 1,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePageChange = (newPage: number) => {
    setQueryParams(prev => ({ ...prev, page: newPage }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setQueryParams({
      page: 1,
      limit: pageSize,
      sortBy: 'serviceDate',
      sortOrder: 'desc',
    });
  };

  if (isLoading) {
    return <ClaimsTableSkeleton compactView={compactView} />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <p>Unable to load claims data. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const claims = claimsData?.claims || [];
  const totalPages = claimsData?.totalPages || 1;
  const currentPage = claimsData?.page || 1;
  const total = claimsData?.total || 0;

  return (
    <Card data-testid="claims-table">
      {showFilters && (
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Claims ({total})</span>
          </CardTitle>
          
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="search-input">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-input"
                  placeholder="Patient, claim #..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-search"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter" data-testid="select-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <SelectItem key={status} value={status}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                data-testid="input-date-from"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                data-testid="input-date-to"
              />
            </div>

            <div className="flex items-end space-x-2">
              <Button onClick={handleSearch} data-testid="button-apply-filters">
                <Filter className="h-4 w-4 mr-2" />
                Apply
              </Button>
              <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters">
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('claimNumber')}
                  data-testid="header-claim-number"
                >
                  Claim #
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('patientName')}
                  data-testid="header-patient"
                >
                  Patient
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('serviceDate')}
                  data-testid="header-service-date"
                >
                  Service Date
                </TableHead>
                {!compactView && (
                  <>
                    <TableHead>Provider</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('totalAmount')}
                    >
                      Amount
                    </TableHead>
                  </>
                )}
                <TableHead>Status</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('updatedAt')}
                >
                  Last Updated
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={compactView ? 6 : 8} className="text-center py-8">
                    <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p>No claims found</p>
                      <p className="text-sm">Try adjusting your filters or create a new claim</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                claims.map((claim) => {
                  const statusInfo = statusConfig[claim.status as keyof typeof statusConfig] || statusConfig.draft;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <TableRow key={claim.id} data-testid={`row-claim-${claim.id}`}>
                      <TableCell className="font-medium">
                        <Link href={`/claims/${claim.id}`}>
                          <span className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200">
                            {claim.claimNumber}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{claim.patientFirstName} {claim.patientLastName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{new Date(claim.serviceDate).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      {!compactView && (
                        <>
                          <TableCell>{claim.providerName}</TableCell>
                          <TableCell className="font-medium">
                            ${claim.totalAmount?.toFixed(2) || '0.00'}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Badge variant={statusInfo.variant} className="inline-flex items-center space-x-1">
                          <StatusIcon className="h-3 w-3" />
                          <span>{statusInfo.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(claim.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/claims/${claim.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-view-${claim.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {Math.min((currentPage - 1) * pageSize + 1, total)} to {Math.min(currentPage * pageSize, total)} of {total} claims
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      data-testid={`button-page-${pageNum}`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClaimsTableSkeleton({ compactView }: { compactView: boolean }) {
  return (
    <Card data-testid="claims-table-skeleton">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Service Date</TableHead>
              {!compactView && (
                <>
                  <TableHead>Provider</TableHead>
                  <TableHead>Amount</TableHead>
                </>
              )}
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                {!compactView && (
                  <>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </>
                )}
                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}