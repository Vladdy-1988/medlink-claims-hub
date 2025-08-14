import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { Link } from "wouter";

interface Claim {
  id: string;
  patientName?: string;
  status: string;
  amount: string;
  createdAt: string;
  insurerName?: string;
  type: string;
  referenceNumber?: string;
}

interface ClaimsTableProps {
  claims: Claim[];
  isLoading?: boolean;
}

const ITEMS_PER_PAGE = 10;

type SortField = 'createdAt' | 'amount' | 'status' | 'patientName';
type SortOrder = 'asc' | 'desc';

const statusColors = {
  draft: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300", 
  pending: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  infoRequested: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  denied: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export function ClaimsTable({ claims, isLoading = false }: ClaimsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [payerFilter, setPayerFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(claims.map(claim => claim.status));
    return Array.from(statuses);
  }, [claims]);

  const uniquePayers = useMemo(() => {
    const payers = new Set(claims.map(claim => claim.insurerName).filter(Boolean));
    return Array.from(payers);
  }, [claims]);

  const filteredAndSortedClaims = useMemo(() => {
    let filtered = claims.filter(claim => {
      const matchesSearch = !searchTerm || 
        claim.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || claim.status === statusFilter;
      const matchesPayer = payerFilter === "all" || claim.insurerName === payerFilter;
      
      return matchesSearch && matchesStatus && matchesPayer;
    });

    // Sort claims
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'amount':
          aValue = parseFloat(a.amount);
          bValue = parseFloat(b.amount);
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'patientName':
          aValue = a.patientName || '';
          bValue = b.patientName || '';
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return filtered;
  }, [claims, searchTerm, statusFilter, payerFilter, sortField, sortOrder]);

  const paginatedClaims = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedClaims.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedClaims, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedClaims.length / ITEMS_PER_PAGE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="h-10 w-64 bg-muted animate-pulse rounded" />
          <div className="h-10 w-40 bg-muted animate-pulse rounded" />
          <div className="h-10 w-40 bg-muted animate-pulse rounded" />
        </div>
        <div className="border rounded-lg">
          <div className="h-12 bg-muted animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 border-t bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No claims found</p>
        <Button asChild data-testid="button-create-claim">
          <Link href="/claims/new">Create Your First Claim</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search claims..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="sm:max-w-64"
          data-testid="input-search-claims"
        />
        <Select value={statusFilter} onValueChange={(value) => {
          setStatusFilter(value);
          setCurrentPage(1);
        }}>
          <SelectTrigger className="sm:w-40" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {uniqueStatuses.map(status => (
              <SelectItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={payerFilter} onValueChange={(value) => {
          setPayerFilter(value);
          setCurrentPage(1);
        }}>
          <SelectTrigger className="sm:w-40" data-testid="select-payer-filter">
            <SelectValue placeholder="All Payers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payers</SelectItem>
            {uniquePayers.map(payer => (
              <SelectItem key={payer} value={payer!}>
                {payer}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => handleSort('patientName')}
                  className="h-auto p-0 font-medium"
                  data-testid="sort-patient-name"
                >
                  Patient
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => handleSort('status')}
                  className="h-auto p-0 font-medium"
                  data-testid="sort-status"
                >
                  Status
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => handleSort('amount')}
                  className="h-auto p-0 font-medium"
                  data-testid="sort-amount"
                >
                  Amount
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Payer</TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => handleSort('createdAt')}
                  className="h-auto p-0 font-medium"
                  data-testid="sort-created"
                >
                  Created
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedClaims.map((claim) => (
              <TableRow key={claim.id} data-testid={`claim-row-${claim.id}`}>
                <TableCell className="font-medium">
                  {claim.patientName || 'Unknown Patient'}
                </TableCell>
                <TableCell>
                  <Badge 
                    className={statusColors[claim.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}
                    data-testid={`status-${claim.status}`}
                  >
                    {claim.status.charAt(0).toUpperCase() + claim.status.slice(1).replace(/([A-Z])/g, ' $1')}
                  </Badge>
                </TableCell>
                <TableCell>${parseFloat(claim.amount).toFixed(2)}</TableCell>
                <TableCell>{claim.insurerName || 'Unknown'}</TableCell>
                <TableCell>{format(new Date(claim.createdAt), 'MMM dd, yyyy')}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild data-testid={`button-view-claim-${claim.id}`}>
                    <Link href={`/claims/${claim.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredAndSortedClaims.length)} to{' '}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedClaims.length)} of{' '}
            {filteredAndSortedClaims.length} results
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}