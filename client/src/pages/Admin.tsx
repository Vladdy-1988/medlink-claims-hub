import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function Admin() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

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

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
      return;
    }
  }, [isAuthenticated, isLoading, user, toast]);

  const { data: auditEvents, isLoading: auditLoading, error: auditError } = useQuery({
    queryKey: ["/api/admin/audit"],
    retry: false,
    enabled: user?.role === 'admin',
  });

  if (auditError && isUnauthorizedError(auditError as Error)) {
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

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <Card>
            <CardContent className="p-8 text-center">
              <i className="fas fa-lock text-4xl text-red-500 mb-4"></i>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Access Restricted</h3>
              <p className="text-slate-500">Only administrators can access this page.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'claim_created': return 'fas fa-plus-circle text-green-600';
      case 'claim_updated': return 'fas fa-edit text-blue-600';
      case 'claim_submitted': return 'fas fa-paper-plane text-purple-600';
      case 'attachment_created': return 'fas fa-paperclip text-orange-600';
      case 'remittance_uploaded': return 'fas fa-upload text-indigo-600';
      default: return 'fas fa-info-circle text-slate-600';
    }
  };

  const getEventTypeLabel = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Mock user data for demonstration
  const mockUsers = [
    {
      id: '1',
      name: 'Dr. Jane Doe',
      email: 'jane.doe@clinic.com',
      role: 'provider',
      status: 'active',
      lastActive: '2024-01-15T10:30:00Z',
      initials: 'JD',
    },
    {
      id: '2',
      name: 'Maria Brown',
      email: 'maria.brown@clinic.com',
      role: 'billing',
      status: 'active',
      lastActive: '2024-01-14T15:45:00Z',
      initials: 'MB',
    },
    {
      id: '3',
      name: 'Admin Smith',
      email: 'admin@clinic.com',
      role: 'admin',
      status: 'active',
      lastActive: '2024-01-15T09:15:00Z',
      initials: 'AS',
    },
  ];

  const filteredUsers = mockUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'billing': return 'bg-yellow-100 text-yellow-800';
      case 'provider': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Page Header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate">
              Administration
            </h2>
            <p className="mt-1 text-sm text-slate-500">Manage users, roles, and view system audit logs</p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Button data-testid="button-invite-user">
              <i className="fas fa-user-plus mr-2"></i>
              Invite User
            </Button>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">Users & Roles</TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit">Audit Log</TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system">System Settings</TabsTrigger>
          </TabsList>

          {/* Users & Roles Tab */}
          <TabsContent value="users">
            <Card>
              <CardContent className="p-6">
                <div className="sm:flex sm:items-center sm:justify-between mb-6">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-slate-900">Organization Users</h3>
                    <p className="mt-1 text-sm text-slate-500">Manage user access and roles for your organization</p>
                  </div>
                  <div className="mt-4 sm:mt-0 flex space-x-3">
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        data-testid="search-users"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <i className="fas fa-search text-slate-400"></i>
                      </div>
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-32" data-testid="filter-role">
                        <SelectValue placeholder="All Roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="billing">Billing</SelectItem>
                        <SelectItem value="provider">Provider</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Last Active
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {filteredUsers.map((userData) => (
                        <tr key={userData.id} className="hover:bg-slate-50" data-testid={`user-row-${userData.id}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center mr-4">
                                <span className="text-primary-600 font-medium text-sm">
                                  {userData.initials}
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-900">{userData.name}</div>
                                <div className="text-sm text-slate-500">{userData.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={getRoleBadgeClass(userData.role)}>
                              {userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {formatDate(userData.lastActive)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className="bg-green-100 text-green-800">
                              {userData.status.charAt(0).toUpperCase() + userData.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-edit-user-${userData.id}`}
                              >
                                Edit
                              </Button>
                              {userData.role !== 'admin' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  data-testid={`button-disable-user-${userData.id}`}
                                >
                                  Disable
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit">
            <Card>
              <CardContent className="p-6">
                <div className="mb-6">
                  <h3 className="text-lg leading-6 font-medium text-slate-900">System Audit Log</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Track all user actions and system events across your organization
                  </p>
                </div>

                {auditLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-slate-500">Loading audit events...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(!auditEvents || auditEvents.length === 0) ? (
                      <div className="text-center py-8 text-slate-500">
                        <i className="fas fa-history text-4xl mb-4 text-slate-300"></i>
                        <p className="text-lg font-medium">No audit events found</p>
                        <p className="text-sm">System events will appear here once activities begin</p>
                      </div>
                    ) : (
                      auditEvents.map((event: any) => (
                        <div
                          key={event.id}
                          className="flex items-start space-x-3 p-4 bg-slate-50 rounded-lg"
                          data-testid={`audit-event-${event.id}`}
                        >
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                              <i className={getEventTypeIcon(event.type)}></i>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-slate-900">
                                {getEventTypeLabel(event.type)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatDate(event.createdAt)}
                              </p>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">
                              User ID: {event.actorUserId}
                            </p>
                            {event.details && (
                              <pre className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">
                                {JSON.stringify(event.details, null, 2)}
                              </pre>
                            )}
                            {event.ip && (
                              <p className="text-xs text-slate-400 mt-1">
                                IP: {event.ip}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Settings Tab */}
          <TabsContent value="system">
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-slate-900 mb-4">System Configuration</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-900">Automatic Backups</h4>
                        <p className="text-sm text-slate-500">Daily database backups at 2:00 AM</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-900">API Rate Limiting</h4>
                        <p className="text-sm text-slate-500">1000 requests per hour per user</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-900">Data Retention</h4>
                        <p className="text-sm text-slate-500">Claims data retained for 7 years</p>
                      </div>
                      <Button variant="outline" size="sm" data-testid="button-configure-retention">
                        Configure
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-900">Webhook Endpoints</h4>
                        <p className="text-sm text-slate-500">Configure external integrations</p>
                      </div>
                      <Button variant="outline" size="sm" data-testid="button-manage-webhooks">
                        Manage
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg leading-6 font-medium text-slate-900 mb-4">System Health</h3>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">99.9%</div>
                      <div className="text-sm text-green-700">Uptime</div>
                    </div>

                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">247</div>
                      <div className="text-sm text-blue-700">Total Claims</div>
                    </div>

                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">12</div>
                      <div className="text-sm text-purple-700">Active Users</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
