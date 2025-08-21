import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Filter, MapPin, Network, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CoverageRow {
  province: string;
  program: string;
  insurer?: string;
  disciplines: string[];
  rail: 'cdanet' | 'eclaims' | 'portal';
  status: 'supported' | 'sandbox' | 'todo';
  notes?: string;
}

interface CoverageData {
  updatedAt: string;
  rows: CoverageRow[];
}

const PROVINCES = [
  { value: 'ALL', label: 'All Provinces' },
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
];

const RAILS = [
  { value: 'ALL', label: 'All Rails' },
  { value: 'cdanet', label: 'CDAnet' },
  { value: 'eclaims', label: 'TELUS eClaims' },
  { value: 'portal', label: 'Portal' },
];

const STATUSES = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'supported', label: 'Supported' },
  { value: 'sandbox', label: 'Sandbox' },
  { value: 'todo', label: 'To-Do' },
];

export default function Coverage() {
  const { toast } = useToast();
  const [provinceFilter, setProvinceFilter] = useState('ALL');
  const [railFilter, setRailFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [programSearch, setProgramSearch] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const { data: coverageData, isLoading, error } = useQuery<CoverageData>({
    queryKey: ['/api/admin/coverage'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/coverage');
      return response;
    },
  });

  // Get unique disciplines from all rows
  const allDisciplines = useMemo(() => {
    if (!coverageData) return [];
    const disciplineSet = new Set<string>();
    coverageData.rows.forEach(row => {
      row.disciplines.forEach(d => disciplineSet.add(d));
    });
    return Array.from(disciplineSet).sort();
  }, [coverageData]);

  // Filter rows based on all filters
  const filteredRows = useMemo(() => {
    if (!coverageData) return [];
    
    return coverageData.rows.filter(row => {
      if (provinceFilter !== 'ALL' && row.province !== provinceFilter) return false;
      if (railFilter !== 'ALL' && row.rail !== railFilter) return false;
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (programSearch && !row.program.toLowerCase().includes(programSearch.toLowerCase()) &&
          (!row.insurer || !row.insurer.toLowerCase().includes(programSearch.toLowerCase()))) {
        return false;
      }
      if (selectedDisciplines.length > 0 && 
          !row.disciplines.some(d => selectedDisciplines.includes(d))) {
        return false;
      }
      return true;
    });
  }, [coverageData, provinceFilter, railFilter, statusFilter, programSearch, selectedDisciplines]);

  // Pagination
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRows, currentPage]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const stats = {
      total: filteredRows.length,
      supported: 0,
      sandbox: 0,
      todo: 0,
      cdanet: 0,
      eclaims: 0,
      portal: 0,
    };

    filteredRows.forEach(row => {
      stats[row.status]++;
      stats[row.rail]++;
    });

    return stats;
  }, [filteredRows]);

  // Export to CSV
  const handleExportCSV = () => {
    const header = 'Province,Program/Insurer,Disciplines,Rail,Status,Notes\n';
    const csvRows = filteredRows.map(row => {
      const disciplines = row.disciplines.join('; ');
      const program = row.insurer ? `${row.program} (${row.insurer})` : row.program;
      const notes = row.notes || '';
      
      const escapeCSV = (val: string) => val.includes(',') ? `"${val}"` : val;
      
      return [
        row.province,
        escapeCSV(program),
        escapeCSV(disciplines),
        row.rail,
        row.status,
        escapeCSV(notes)
      ].join(',');
    });

    const csv = header + csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coverage_export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `Exported ${filteredRows.length} rows to CSV`,
    });
  };

  // Rail badge colors
  const getRailBadgeColor = (rail: string) => {
    switch (rail) {
      case 'cdanet': return 'bg-teal-100 text-teal-800';
      case 'eclaims': return 'bg-sky-100 text-sky-800';
      case 'portal': return 'bg-slate-100 text-slate-800';
      default: return '';
    }
  };

  // Status badge colors
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'supported': return 'bg-emerald-100 text-emerald-800';
      case 'sandbox': return 'bg-amber-100 text-amber-800';
      case 'todo': return 'bg-rose-100 text-rose-800';
      default: return '';
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <p>Failed to load coverage data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Coverage Dashboard</h1>
        <p className="text-gray-600 mt-1">Canada-wide EDI/portal coverage</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{kpis.total}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700">Supported</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-emerald-700">{kpis.supported}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">Sandbox</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-amber-700">{kpis.sandbox}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-rose-700">To-Do</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-rose-700">{kpis.todo}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-teal-700">CDAnet</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-teal-700">{kpis.cdanet}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-sky-700">eClaims</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-sky-700">{kpis.eclaims}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Portal</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-slate-700">{kpis.portal}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <Select value={provinceFilter} onValueChange={setProvinceFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-province">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Province" />
              </SelectTrigger>
              <SelectContent>
                {PROVINCES.map(province => (
                  <SelectItem key={province.value} value={province.value}>
                    {province.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={railFilter} onValueChange={setRailFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-rail">
                <Network className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Rail" />
              </SelectTrigger>
              <SelectContent>
                {RAILS.map(rail => (
                  <SelectItem key={rail.value} value={rail.value}>
                    {rail.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Search program/insurer..."
              value={programSearch}
              onChange={(e) => setProgramSearch(e.target.value)}
              className="w-[250px]"
              data-testid="input-search"
            />

            <Button
              onClick={handleExportCSV}
              variant="outline"
              disabled={isLoading || filteredRows.length === 0}
              data-testid="button-export"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV ({filteredRows.length})
            </Button>
          </div>

          {/* Discipline chips */}
          {allDisciplines.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 mr-2">Disciplines:</span>
              {allDisciplines.map(discipline => (
                <Badge
                  key={discipline}
                  variant={selectedDisciplines.includes(discipline) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedDisciplines(prev =>
                      prev.includes(discipline)
                        ? prev.filter(d => d !== discipline)
                        : [...prev, discipline]
                    );
                  }}
                  data-testid={`chip-discipline-${discipline}`}
                >
                  {discipline}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-12 mb-4" />
              <Skeleton className="h-64" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Filter className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No results match your filters</p>
              <p className="text-sm mt-2">Try adjusting your search criteria</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Province</TableHead>
                    <TableHead>Program/Insurer</TableHead>
                    <TableHead>Disciplines</TableHead>
                    <TableHead className="w-[120px]">Rail</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((row, index) => (
                    <TableRow key={`${row.province}-${row.program}-${index}`}>
                      <TableCell className="font-medium">{row.province}</TableCell>
                      <TableCell>
                        {row.program}
                        {row.insurer && <span className="text-gray-500 text-sm ml-1">({row.insurer})</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.disciplines.map((discipline, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {discipline}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRailBadgeColor(row.rail)}>
                          {row.rail === 'cdanet' ? 'CDAnet' : 
                           row.rail === 'eclaims' ? 'eClaims' : 'Portal'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(row.status)}>
                          {row.status === 'todo' ? 'To-Do' : 
                           row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.notes && (
                          <span className="text-sm text-gray-600" title={row.notes}>
                            {row.notes.length > 50 ? row.notes.substring(0, 50) + '...' : row.notes}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
                    {Math.min(currentPage * itemsPerPage, filteredRows.length)} of{' '}
                    {filteredRows.length} entries
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Last Updated */}
      {coverageData && (
        <p className="text-xs text-gray-500 text-right mt-4">
          Last updated: {new Date(coverageData.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}