import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ObjectUploader } from "@/components/ObjectUploader";

export default function Remittances() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: remittances, isLoading: remittancesLoading, error } = useQuery({
    queryKey: ["/api/remittances"],
    retry: false,
  });

  const { data: insurers } = useQuery({
    queryKey: ["/api/insurers"],
    retry: false,
  });

  const uploadRemittanceMutation = useMutation({
    mutationFn: async (remittanceData: any) => {
      const response = await apiRequest("POST", "/api/remittances", remittanceData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Remittance uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/remittances"] });
      setUploadDialogOpen(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to upload remittance",
        variant: "destructive",
      });
    },
  });

  if (error && isUnauthorizedError(error as Error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload", {});
    const data = await response.json();
    return { method: "PUT" as const, url: data.uploadURL };
  };

  const handleUploadComplete = (files: Array<{ url: string; name: string; size: number; type: string }>) => {
    // For now, create a basic remittance record
    // In a real application, you would parse the file content
    if (files.length > 0) {
      const file = files[0];
      uploadRemittanceMutation.mutate({
        insurerId: insurers?.[0]?.id || '',
        status: 'received',
        raw: { fileName: file.name, fileUrl: file.url },
      });
    }
  };

  const filteredRemittances = remittances?.filter((remittance: any) => {
    if (statusFilter !== "all" && remittance.status !== statusFilter) return false;
    if (dateFilter && !remittance.createdAt.includes(dateFilter)) return false;
    return true;
  });

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'received': return 'bg-blue-100 text-blue-800';
      case 'processed': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Page Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
              Remittances
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload and manage payment notifications from insurance providers
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-upload-remittance">
                  <i className="fas fa-upload mr-2"></i>
                  Upload Remittance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Remittance File</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Upload remittance advice or payment notification files from your insurance providers.
                    Supported formats: PDF, CSV, XML, EDI
                  </p>
                  
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={10485760}
                    onGetUploadParameters={handleGetUploadParameters}
                    onComplete={handleUploadComplete}
                    accept=".pdf,.csv,.xml,.edi,.txt"
                  >
                    <i className="fas fa-cloud-upload-alt mr-2"></i>
                    Select Remittance File
                  </ObjectUploader>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1" data-testid="filter-status">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="date-filter">Date Range</Label>
                <Input
                  id="date-filter"
                  type="date"
                  className="mt-1"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  data-testid="filter-date"
                />
              </div>
              
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setStatusFilter("all");
                    setDateFilter("");
                  }}
                  data-testid="button-clear-filters"
                >
                  <i className="fas fa-times mr-2"></i>
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remittances List */}
        <Card className="mt-8">
          <CardContent className="p-6">
            {remittancesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-slate-500">Loading remittances...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Remittance ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Insurance Provider
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Amount Paid
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Date Received
                      </th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {(!filteredRemittances || filteredRemittances.length === 0) ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center">
                          <div className="text-slate-500">
                            <i className="fas fa-receipt text-4xl mb-4 text-slate-300"></i>
                            <p className="text-lg font-medium">No remittances found</p>
                            <p className="text-sm">
                              {statusFilter !== "all" || dateFilter ? 
                                "Try adjusting your filters or " : 
                                ""
                              }
                              <button 
                                onClick={() => setUploadDialogOpen(true)}
                                className="text-primary-600 hover:underline"
                              >
                                upload your first remittance
                              </button>
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredRemittances.map((remittance: any) => (
                        <tr key={remittance.id} className="hover:bg-slate-50" data-testid={`remittance-row-${remittance.id}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                            {remittance.id.slice(-8)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                                <i className="fas fa-building text-primary-600 text-sm"></i>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-900">
                                  {insurers?.find((i: any) => i.id === remittance.insurerId)?.name || 'Unknown Insurer'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                            {formatCurrency(remittance.amountPaid)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(remittance.status)}`}>
                              {remittance.status.charAt(0).toUpperCase() + remittance.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {formatDate(remittance.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`button-view-remittance-${remittance.id}`}
                            >
                              <i className="fas fa-eye mr-1"></i>
                              View
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-check-circle text-green-600"></i>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-slate-500 truncate">Total Processed</dt>
                    <dd className="text-2xl font-semibold text-slate-900" data-testid="summary-processed">
                      {filteredRemittances?.filter((r: any) => r.status === 'processed').length || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-clock text-blue-600"></i>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-slate-500 truncate">Pending Review</dt>
                    <dd className="text-2xl font-semibold text-slate-900" data-testid="summary-pending">
                      {filteredRemittances?.filter((r: any) => r.status === 'received').length || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-dollar-sign text-green-600"></i>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-slate-500 truncate">Total Received</dt>
                    <dd className="text-2xl font-semibold text-slate-900" data-testid="summary-amount">
                      {formatCurrency(
                        filteredRemittances?.reduce((sum: number, r: any) => 
                          sum + (parseFloat(r.amountPaid) || 0), 0) || 0
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
