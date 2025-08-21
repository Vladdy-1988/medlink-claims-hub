import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
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
import { Bell, TestTube, Smartphone } from "lucide-react";

export default function Settings() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    isSupported: notificationsSupported,
    permission: notificationPermission,
    subscribe: subscribeToNotifications,
    unsubscribe: unsubscribeFromNotifications,
    sendTestNotification,
    isSubscribing,
    isUnsubscribing,
    isSendingTest,
  } = useNotifications();
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialty: '',
    licenseNumber: '',
    preferredLanguage: 'en-CA',
  });
  const [organizationData, setOrganizationData] = useState({
    name: '',
    address: '',
    phone: '',
    website: '',
    province: '',
    preferredLanguage: 'en-CA',
    privacyOfficerName: '',
    privacyOfficerEmail: '',
    dataRetentionDays: 2555,
    privacyContactUrl: '',
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
        preferredLanguage: user.preferredLanguage || 'en-CA',
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

                  <div>
                    <Label htmlFor="userLanguage">Preferred Language</Label>
                    <select
                      id="userLanguage"
                      value={profileData.preferredLanguage}
                      onChange={(e) => setProfileData(prev => ({ ...prev, preferredLanguage: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="select-user-language"
                    >
                      <option value="en-CA">English</option>
                      <option value="fr-CA">Français</option>
                    </select>
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

                  <div>
                    <Label htmlFor="orgProvince">Province</Label>
                    <select
                      id="orgProvince"
                      value={organizationData.province}
                      onChange={(e) => setOrganizationData(prev => ({ ...prev, province: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="select-org-province"
                    >
                      <option value="">Select Province</option>
                      <option value="AB">Alberta</option>
                      <option value="BC">British Columbia</option>
                      <option value="MB">Manitoba</option>
                      <option value="NB">New Brunswick</option>
                      <option value="NL">Newfoundland and Labrador</option>
                      <option value="NS">Nova Scotia</option>
                      <option value="NT">Northwest Territories</option>
                      <option value="NU">Nunavut</option>
                      <option value="ON">Ontario</option>
                      <option value="PE">Prince Edward Island</option>
                      <option value="QC">Quebec</option>
                      <option value="SK">Saskatchewan</option>
                      <option value="YT">Yukon</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="orgLanguage">Preferred Language</Label>
                    <select
                      id="orgLanguage"
                      value={organizationData.preferredLanguage}
                      onChange={(e) => setOrganizationData(prev => ({ ...prev, preferredLanguage: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="select-org-language"
                    >
                      <option value="en-CA">English</option>
                      <option value="fr-CA">Français</option>
                    </select>
                  </div>
                </div>

                {/* Quebec Law 25 Compliance Fields */}
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Privacy & Compliance</h3>
                  
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="privacyOfficerName">Privacy Officer Name</Label>
                      <Input
                        id="privacyOfficerName"
                        value={organizationData.privacyOfficerName}
                        onChange={(e) => setOrganizationData(prev => ({ ...prev, privacyOfficerName: e.target.value }))}
                        placeholder="Name of designated privacy officer"
                        data-testid="input-privacy-officer-name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="privacyOfficerEmail">Privacy Officer Email</Label>
                      <Input
                        id="privacyOfficerEmail"
                        type="email"
                        value={organizationData.privacyOfficerEmail}
                        onChange={(e) => setOrganizationData(prev => ({ ...prev, privacyOfficerEmail: e.target.value }))}
                        placeholder="privacy@example.com"
                        data-testid="input-privacy-officer-email"
                      />
                    </div>

                    <div>
                      <Label htmlFor="dataRetentionDays">Data Retention (Days)</Label>
                      <Input
                        id="dataRetentionDays"
                        type="number"
                        value={organizationData.dataRetentionDays}
                        onChange={(e) => setOrganizationData(prev => ({ ...prev, dataRetentionDays: parseInt(e.target.value) || 2555 }))}
                        min="365"
                        max="3650"
                        data-testid="input-data-retention"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Quebec requires 7 years (2555 days) minimum</p>
                    </div>

                    <div>
                      <Label htmlFor="privacyContactUrl">Privacy Policy URL</Label>
                      <Input
                        id="privacyContactUrl"
                        type="url"
                        value={organizationData.privacyContactUrl}
                        onChange={(e) => setOrganizationData(prev => ({ ...prev, privacyContactUrl: e.target.value }))}
                        placeholder="https://example.com/privacy"
                        data-testid="input-privacy-url"
                      />
                    </div>
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
            <div className="space-y-6">
              {/* Push Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Push Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!notificationsSupported ? (
                    <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg dark:border-yellow-800 dark:bg-yellow-950">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          Push notifications are not supported in your browser.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Enable Push Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Get instant notifications about claim status changes
                          </p>
                          {notificationPermission !== 'granted' && (
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                              Permission: {notificationPermission}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {user?.notificationsEnabled && notificationPermission === 'granted' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unsubscribeFromNotifications()}
                              disabled={isUnsubscribing}
                              data-testid="button-disable-notifications"
                            >
                              {isUnsubscribing ? 'Disabling...' : 'Disable'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => subscribeToNotifications()}
                              disabled={isSubscribing}
                              data-testid="button-enable-notifications"
                            >
                              {isSubscribing ? 'Enabling...' : 'Enable'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {user?.notificationsEnabled && notificationPermission === 'granted' && (
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950 dark:border-green-800">
                          <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="text-sm text-green-800 dark:text-green-200">
                              Push notifications are enabled
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendTestNotification()}
                            disabled={isSendingTest}
                            data-testid="button-test-notification"
                          >
                            <TestTube className="h-4 w-4 mr-2" />
                            {isSendingTest ? 'Sending...' : 'Test'}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Email & SMS Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle>Email & SMS Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailNotifications">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive updates via email
                      </p>
                    </div>
                    <Switch
                      id="emailNotifications"
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))
                      }
                      data-testid="switch-email-notifications"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="smsNotifications">SMS Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive urgent updates via SMS
                      </p>
                    </div>
                    <Switch
                      id="smsNotifications"
                      checked={notificationSettings.smsNotifications}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, smsNotifications: checked }))
                      }
                      data-testid="switch-sms-notifications"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="claimUpdates">Claim Status Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when claim status changes
                      </p>
                    </div>
                    <Switch
                      id="claimUpdates"
                      checked={notificationSettings.claimUpdates}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, claimUpdates: checked }))
                      }
                      data-testid="switch-claim-updates"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="paymentReminders">Payment Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Reminders about overdue payments
                      </p>
                    </div>
                    <Switch
                      id="paymentReminders"
                      checked={notificationSettings.paymentReminders}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, paymentReminders: checked }))
                      }
                      data-testid="switch-payment-reminders"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="weeklyReports">Weekly Reports</Label>
                      <p className="text-sm text-muted-foreground">
                        Weekly summary of activity
                      </p>
                    </div>
                    <Switch
                      id="weeklyReports"
                      checked={notificationSettings.weeklyReports}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, weeklyReports: checked }))
                      }
                      data-testid="switch-weekly-reports"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button data-testid="button-save-notifications">
                      Save Preferences
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
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
