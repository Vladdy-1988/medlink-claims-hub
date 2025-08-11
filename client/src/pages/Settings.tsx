import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialty: '',
    licenseNumber: '',
  });
  const [organizationData, setOrganizationData] = useState({
    name: '',
    address: '',
    phone: '',
    website: '',
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    claimUpdates: true,
    paymentReminders: true,
    weeklyReports: false,
  });

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

  // Initialize form data when user data is loaded
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: '',
        specialty: '',
        licenseNumber: '',
      });
    }
  }, [user]);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl">Settings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage your account settings and preferences
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
            <TabsTrigger value="organization" data-testid="tab-organization">Organization</TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                      data-testid="input-first-name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                      data-testid="input-last-name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                      data-testid="input-email"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      data-testid="input-phone"
                    />
                  </div>

                  <div>
                    <Label htmlFor="specialty">Specialty/Discipline</Label>
                    <Input
                      id="specialty"
                      value={profileData.specialty}
                      onChange={(e) => setProfileData(prev => ({ ...prev, specialty: e.target.value }))}
                      placeholder="e.g., Physiotherapy, Massage Therapy"
                      data-testid="input-specialty"
                    />
                  </div>

                  <div>
                    <Label htmlFor="licenseNumber">License Number</Label>
                    <Input
                      id="licenseNumber"
                      value={profileData.licenseNumber}
                      onChange={(e) => setProfileData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                      data-testid="input-license"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button data-testid="button-save-profile">
                    <i className="fas fa-save mr-2"></i>
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Organization Settings */}
          <TabsContent value="organization">
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={organizationData.name}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="input-org-name"
                  />
                </div>

                <div>
                  <Label htmlFor="orgAddress">Address</Label>
                  <Textarea
                    id="orgAddress"
                    rows={3}
                    value={organizationData.address}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Street address, city, province, postal code"
                    data-testid="textarea-org-address"
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="orgPhone">Phone Number</Label>
                    <Input
                      id="orgPhone"
                      type="tel"
                      value={organizationData.phone}
                      onChange={(e) => setOrganizationData(prev => ({ ...prev, phone: e.target.value }))}
                      data-testid="input-org-phone"
                    />
                  </div>

                  <div>
                    <Label htmlFor="orgWebsite">Website</Label>
                    <Input
                      id="orgWebsite"
                      type="url"
                      value={organizationData.website}
                      onChange={(e) => setOrganizationData(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="https://example.com"
                      data-testid="input-org-website"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button data-testid="button-save-organization">
                    <i className="fas fa-save mr-2"></i>
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailNotifications">Email Notifications</Label>
                      <p className="text-sm text-slate-500">Receive notifications via email</p>
                    </div>
                    <Switch
                      id="emailNotifications"
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))}
                      data-testid="switch-email-notifications"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="smsNotifications">SMS Notifications</Label>
                      <p className="text-sm text-slate-500">Receive notifications via text message</p>
                    </div>
                    <Switch
                      id="smsNotifications"
                      checked={notificationSettings.smsNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, smsNotifications: checked }))}
                      data-testid="switch-sms-notifications"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="claimUpdates">Claim Status Updates</Label>
                      <p className="text-sm text-slate-500">Get notified when claim status changes</p>
                    </div>
                    <Switch
                      id="claimUpdates"
                      checked={notificationSettings.claimUpdates}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, claimUpdates: checked }))}
                      data-testid="switch-claim-updates"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="paymentReminders">Payment Reminders</Label>
                      <p className="text-sm text-slate-500">Receive reminders for outstanding payments</p>
                    </div>
                    <Switch
                      id="paymentReminders"
                      checked={notificationSettings.paymentReminders}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, paymentReminders: checked }))}
                      data-testid="switch-payment-reminders"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="weeklyReports">Weekly Reports</Label>
                      <p className="text-sm text-slate-500">Receive weekly summary reports</p>
                    </div>
                    <Switch
                      id="weeklyReports"
                      checked={notificationSettings.weeklyReports}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, weeklyReports: checked }))}
                      data-testid="switch-weekly-reports"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button data-testid="button-save-notifications">
                    <i className="fas fa-save mr-2"></i>
                    Save Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">Authentication Method</h4>
                      <p className="text-sm text-slate-500">Currently using Replit Auth</p>
                    </div>
                    <div className="flex items-center text-sm text-green-600">
                      <i className="fas fa-shield-alt mr-2"></i>
                      Secure
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">Current Role</h4>
                      <p className="text-sm text-slate-500 capitalize">{user?.role || 'Provider'}</p>
                    </div>
                    <div className="text-sm text-slate-600">
                      Contact admin to change role
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>API Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600">
                    API keys allow external applications to access your account. Keep them secure and never share them publicly.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-900">Development API Key</h4>
                        <p className="text-xs text-slate-500">Created 2 days ago</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" data-testid="button-copy-api-key">
                          <i className="fas fa-copy mr-1"></i>
                          Copy
                        </Button>
                        <Button size="sm" variant="outline" data-testid="button-revoke-api-key">
                          <i className="fas fa-times mr-1"></i>
                          Revoke
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" data-testid="button-generate-api-key">
                    <i className="fas fa-key mr-2"></i>
                    Generate New API Key
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                    <div>
                      <h4 className="text-sm font-medium text-red-900">Sign Out</h4>
                      <p className="text-sm text-red-600">Sign out of your account on this device</p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={handleLogout}
                      data-testid="button-sign-out"
                    >
                      <i className="fas fa-sign-out-alt mr-2"></i>
                      Sign Out
                    </Button>
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
