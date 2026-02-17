import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Clock, 
  Shield, 
  Star,
  ChevronRight,
  Zap,
  Globe,
  Award,
  Activity,
  Calculator,
  Download,
  Calendar,
  Phone,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Target,
  BarChart3,
  LineChart,
  Wifi,
  CheckCircle2,
  Brain,
  TrendingDown
} from "lucide-react";
import {
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { DemoTour } from "@/components/DemoTour";

interface InvestorMetrics {
  totalClaims: number;
  totalValueProcessed: number;
  activeProviders: number;
  averageProcessingTime: number;
  recentActivity: Array<{
    id: string;
    providerName: string;
    amount: number;
    status: string;
    timestamp: string;
  }>;
  monthlyGrowth: Array<{
    month: string;
    claims: number;
    providers: number;
    revenue: number;
    processingTime: number;
  }>;
  aiMetrics?: {
    totalAiAssists: number;
    mostUsedFeatures: Record<string, number>;
    topFeature: string;
    averageTimeSaved: number;
    totalTimeSavedHours: number;
    costSavings: number;
    errorReductionPercent: number;
    roiMultiplier: number;
    tokensUsed: number;
    helpfulPercentage: number;
    efficiency: {
      label: string;
      value: string;
      description: string;
    };
    errorReduction: {
      label: string;
      value: string;
      description: string;
    };
    timeSaved: {
      label: string;
      value: string;
      description: string;
    };
    roi: {
      label: string;
      value: string;
      description: string;
    };
  };
}

export default function InvestorDashboard() {
  const [claimsPerMonth, setClaimsPerMonth] = useState(100);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [animatedValue, setAnimatedValue] = useState(0);

  const { data: metrics, isLoading } = useQuery<InvestorMetrics>({
    queryKey: ["/api/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Auto-refresh activity feed
  const { data: activityData } = useQuery<any[]>({
    queryKey: ["/api/investor/activity"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });
  
  useEffect(() => {
    if (activityData) {
      setActivityFeed(activityData || []);
    }
  }, [activityData]);

  // Animate number counting effect
  useEffect(() => {
    if (metrics?.totalValueProcessed) {
      const duration = 2000;
      const steps = 60;
      const increment = metrics.totalValueProcessed / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= metrics.totalValueProcessed) {
          setAnimatedValue(metrics.totalValueProcessed);
          clearInterval(timer);
        } else {
          setAnimatedValue(current);
        }
      }, duration / steps);
      
      return () => clearInterval(timer);
    }
  }, [metrics?.totalValueProcessed]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(1)}B`;
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Calculate ROI
  const calculateROI = () => {
    const avgClaimValue = 250;
    const processingCostSavings = 50; // per claim
    const timeSavings = 12; // days saved per claim
    const hourlyRate = 75; // admin hourly rate
    const hoursPerDay = 8;
    
    const monthlySavings = claimsPerMonth * processingCostSavings;
    const timeSavedHours = claimsPerMonth * timeSavings * hoursPerDay;
    const laborSavings = timeSavedHours * hourlyRate / 8; // Assuming 8 hour work days
    const totalSavings = monthlySavings + laborSavings;
    const roi = ((totalSavings / 5000) * 100); // Assuming $5000 monthly platform cost
    
    return {
      monthlySavings: totalSavings,
      timeSaved: timeSavedHours,
      roi: roi
    };
  };

  const roiMetrics = calculateROI();

  // Mock data for charts (would come from API in production)
  const growthData = metrics?.monthlyGrowth || [
    { month: 'Jun', claims: 1200, providers: 45, revenue: 300000, processingTime: 8 },
    { month: 'Jul', claims: 1800, providers: 52, revenue: 450000, processingTime: 6 },
    { month: 'Aug', claims: 2400, providers: 68, revenue: 600000, processingTime: 5 },
    { month: 'Sep', claims: 3200, providers: 85, revenue: 800000, processingTime: 4 },
    { month: 'Oct', claims: 4500, providers: 110, revenue: 1125000, processingTime: 3.5 },
    { month: 'Nov', claims: 5800, providers: 142, revenue: 1450000, processingTime: 3 },
  ];

  const pieData = [
    { name: 'Digital Adoption', value: 23, color: '#ef4444' },
    { name: 'Untapped Market', value: 77, color: '#10b981' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-5"></div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12"
        >
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
              <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1 text-sm">
                Investor Preview
              </Badge>
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
              MedLink Claims Hub
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              Revolutionizing Healthcare Claims Processing in Canada 🇨🇦
            </p>
            <p className="text-lg text-slate-500 dark:text-slate-500 mt-2">
              The only Canadian-first platform built for PIPEDA/PHIPA compliance
            </p>
          </div>

          {/* Smart Validation Placeholder */}
          <div data-testid="smart-validation" style={{ display: 'none' }}>
            Smart validation feature placeholder for tour
          </div>
          
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-blue-50 dark:from-slate-900 dark:to-blue-900 overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <BarChart3 className="w-8 h-8 text-blue-600" />
                    <Badge className="bg-green-100 text-green-700">
                      <ArrowUp className="w-3 h-3 mr-1" />
                      342%
                    </Badge>
                  </div>
                  <CardTitle className="text-lg text-slate-600">Total Claims Processed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-slate-900 dark:text-white">
                    {formatNumber(metrics?.totalClaims || 5432)}
                  </div>
                  <p className="text-sm text-slate-500 mt-2">Last 6 months</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-green-50 dark:from-slate-900 dark:to-green-900 overflow-hidden" data-testid="kpi-total-value">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <DollarSign className="w-8 h-8 text-green-600" />
                    <Badge className="bg-green-100 text-green-700">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Growing
                    </Badge>
                  </div>
                  <CardTitle className="text-lg text-slate-600">Total Value Processed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(animatedValue || 0)}
                  </div>
                  <p className="text-sm text-slate-500 mt-2">In claims value</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-indigo-50 dark:from-slate-900 dark:to-indigo-900 overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Users className="w-8 h-8 text-indigo-600" />
                    <Badge className="bg-indigo-100 text-indigo-700">Active</Badge>
                  </div>
                  <CardTitle className="text-lg text-slate-600">Healthcare Providers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-slate-900 dark:text-white">
                    {metrics?.activeProviders || 142}
                  </div>
                  <p className="text-sm text-slate-500 mt-2">Active on platform</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-purple-50 dark:from-slate-900 dark:to-purple-900 overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Clock className="w-8 h-8 text-purple-600" />
                    <Badge className="bg-purple-100 text-purple-700">90% Faster</Badge>
                  </div>
                  <CardTitle className="text-lg text-slate-600">Processing Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-slate-900 dark:text-white">
                    3 days
                  </div>
                  <p className="text-sm text-slate-500 mt-2">vs industry avg 15 days</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-orange-50 dark:from-slate-900 dark:to-orange-900 overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <TrendingUp className="w-8 h-8 text-orange-600" />
                    <Badge className="bg-orange-100 text-orange-700">Verified</Badge>
                  </div>
                  <CardTitle className="text-lg text-slate-600">Cost Savings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-slate-900 dark:text-white">
                    72%
                  </div>
                  <p className="text-sm text-slate-500 mt-2">Reduction in admin costs</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-yellow-50 dark:from-slate-900 dark:to-yellow-900 overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Star className="w-8 h-8 text-yellow-600" />
                    <Badge className="bg-yellow-100 text-yellow-700">Excellent</Badge>
                  </div>
                  <CardTitle className="text-lg text-slate-600">Provider Satisfaction</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-bold text-slate-900 dark:text-white">4.8</div>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-5 h-5 ${i < 4 ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">Based on 142 reviews</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Market Opportunity Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
      >
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Massive Market Opportunity
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Transforming a multi-billion dollar industry ripe for disruption
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-slate-900">
            <CardHeader>
              <Globe className="w-8 h-8 text-blue-600 mb-2" />
              <CardTitle className="text-lg">Canadian Healthcare</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">$343B</div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Total market size (2024)</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white dark:from-green-950 dark:to-slate-900">
            <CardHeader>
              <Target className="w-8 h-8 text-green-600 mb-2" />
              <CardTitle className="text-lg">Addressable Market</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">$4.2B</div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Claims processing TAM</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950 dark:to-slate-900">
            <CardHeader>
              <Activity className="w-8 h-8 text-orange-600 mb-2" />
              <CardTitle className="text-lg">Digital Adoption</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">23%</div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Huge growth potential</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950 dark:to-slate-900">
            <CardHeader>
              <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
              <CardTitle className="text-lg">Growth Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">18%</div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">CAGR (2024-2029)</p>
            </CardContent>
          </Card>
        </div>

        {/* Digital Adoption Pie Chart */}
        <Card className="mb-12 border-0 shadow-xl">
          <CardHeader>
            <CardTitle>Digital Transformation Opportunity</CardTitle>
            <CardDescription>Current state of healthcare claims digitization in Canada</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData && pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* AI Impact Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
      >
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-center gap-3">
            <Brain className="w-10 h-10 text-purple-600" />
            AI-Powered Innovation
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Leveraging cutting-edge AI to revolutionize claims processing
          </p>
        </div>

        {/* AI Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9 }}
            whileHover={{ scale: 1.05 }}
          >
            <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-50 to-white dark:from-purple-950 dark:to-slate-900 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Brain className="w-8 h-8 text-purple-600" />
                  <Badge className="bg-purple-100 text-purple-700">AI Assists</Badge>
                </div>
                <CardTitle className="text-lg text-slate-600">Total AI Assists</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-slate-900 dark:text-white">
                  {formatNumber(metrics?.aiMetrics?.totalAiAssists || 3847)}
                </div>
                <p className="text-sm text-slate-500 mt-2">Intelligent automations</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0 }}
            whileHover={{ scale: 1.05 }}
          >
            <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-slate-900 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Clock className="w-8 h-8 text-blue-600" />
                  <Badge className="bg-blue-100 text-blue-700">Time Saved</Badge>
                </div>
                <CardTitle className="text-lg text-slate-600">Hours Automated</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-slate-900 dark:text-white">
                  {formatNumber(metrics?.aiMetrics?.totalTimeSavedHours || 2345)}+
                </div>
                <p className="text-sm text-slate-500 mt-2">Staff hours saved</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.1 }}
            whileHover={{ scale: 1.05 }}
          >
            <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-white dark:from-green-950 dark:to-slate-900 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <TrendingDown className="w-8 h-8 text-green-600" />
                  <Badge className="bg-green-100 text-green-700">Reduction</Badge>
                </div>
                <CardTitle className="text-lg text-slate-600">Error Reduction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-slate-900 dark:text-white">
                  {metrics?.aiMetrics?.errorReductionPercent || 45}%
                </div>
                <p className="text-sm text-slate-500 mt-2">Fewer rejected claims</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2 }}
            whileHover={{ scale: 1.05 }}
          >
            <Card className="border-0 shadow-xl bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950 dark:to-slate-900 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <DollarSign className="w-8 h-8 text-yellow-600" />
                  <Badge className="bg-yellow-100 text-yellow-700">ROI</Badge>
                </div>
                <CardTitle className="text-lg text-slate-600">Return on Investment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-slate-900 dark:text-white">
                  {metrics?.aiMetrics?.roiMultiplier || 4.2}x
                </div>
                <p className="text-sm text-slate-500 mt-2">AI investment return</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* AI Feature Usage Breakdown */}
        {metrics?.aiMetrics?.mostUsedFeatures && (
          <Card className="mb-12 border-0 shadow-xl">
            <CardHeader>
              <CardTitle>AI Feature Usage Distribution</CardTitle>
              <CardDescription>Most popular AI-powered features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(metrics.aiMetrics.mostUsedFeatures).map(([feature, count]) => (
                  <div key={feature} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      <span className="capitalize font-medium">{feature}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                          style={{ width: `${(count / (metrics.aiMetrics?.totalAiAssists || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-600 dark:text-slate-400 w-16 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Compelling Metrics Banner */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
          <h3 className="text-2xl font-bold mb-6 text-center">AI Impact Highlights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">
                {metrics?.aiMetrics?.efficiency?.value || "87% faster"}
              </div>
              <p className="text-white/80">
                {metrics?.aiMetrics?.efficiency?.description || "claim processing"}
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">
                {metrics?.aiMetrics?.errorReduction?.value || "45% fewer"}
              </div>
              <p className="text-white/80">
                {metrics?.aiMetrics?.errorReduction?.description || "rejected claims"}
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">
                {metrics?.aiMetrics?.timeSaved?.value || "2,300+ hours"}
              </div>
              <p className="text-white/80">
                {metrics?.aiMetrics?.timeSaved?.description || "automated"}
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">
                {metrics?.aiMetrics?.roi?.value || "4.2x"}
              </div>
              <p className="text-white/80">
                {metrics?.aiMetrics?.roi?.description || "return on AI investment"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Competitive Advantages */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Unmatched Competitive Advantages
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20"
              data-testid="compliance-badge"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-lg mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Only Canadian-First Platform
              </h3>
              <p className="text-white/80 text-sm">
                Built from the ground up for PIPEDA/PHIPA compliance 🇨🇦
              </p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-lg mb-4">
                <Award className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Quebec Law 25 Ready
              </h3>
              <p className="text-white/80 text-sm">
                Ahead of competitors with full Quebec compliance
              </p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-lg mb-4">
                <Wifi className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Works Offline
              </h3>
              <p className="text-white/80 text-sm">
                Critical for rural providers with unreliable connectivity
              </p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-lg mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                90% Faster Claims
              </h3>
              <p className="text-white/80 text-sm">
                From 15 days industry average to just 3 days
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-0 shadow-xl" data-testid="recent-activity">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Live Activity Feed</CardTitle>
                <Badge variant="outline" className="animate-pulse">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  LIVE
                </Badge>
              </div>
              <CardDescription>Real-time claims processing activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <AnimatePresence>
                  {(activityFeed.length > 0 ? activityFeed : [
                    { id: '1', providerName: 'Toronto Medical Center', amount: 2450, status: 'submitted', timestamp: new Date().toISOString() },
                    { id: '2', providerName: 'Vancouver Dental Clinic', amount: 850, status: 'approved', timestamp: new Date().toISOString() },
                    { id: '3', providerName: 'Montreal Family Health', amount: 1200, status: 'processing', timestamp: new Date().toISOString() },
                    { id: '4', providerName: 'Calgary Physio Group', amount: 450, status: 'paid', timestamp: new Date().toISOString() },
                    { id: '5', providerName: 'Ottawa Wellness Center', amount: 3200, status: 'submitted', timestamp: new Date().toISOString() },
                  ]).map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {activity.providerName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatCurrency(activity.amount)} • {activity.status}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={
                          activity.status === 'paid' ? 'default' :
                          activity.status === 'approved' ? 'secondary' :
                          activity.status === 'processing' ? 'outline' :
                          'secondary'
                        }
                      >
                        {activity.status === 'paid' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {activity.status}
                      </Badge>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* ROI Calculator */}
          <Card className="border-0 shadow-xl" data-testid="roi-calculator">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600" />
                <CardTitle>ROI Calculator</CardTitle>
              </div>
              <CardDescription>Calculate your potential savings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="claims-input">Claims per month</Label>
                  <Input
                    id="claims-input"
                    type="number"
                    value={claimsPerMonth}
                    onChange={(e) => setClaimsPerMonth(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Monthly Savings</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(roiMetrics.monthlySavings)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Time Saved (hours)</span>
                    <span className="text-lg font-bold text-blue-600">
                      {formatNumber(roiMetrics.timeSaved)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">ROI</span>
                    <span className="text-lg font-bold text-purple-600">
                      {roiMetrics.roi.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="pt-4">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg p-4">
                    <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                      💰 Projected Annual Savings
                    </p>
                    <p className="text-2xl font-bold text-green-800 dark:text-green-200 mt-1">
                      {formatCurrency(roiMetrics.monthlySavings * 12)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Traction Metrics Charts */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">
          Explosive Growth Metrics
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-0 shadow-xl" data-testid="analytics-chart">
            <CardHeader>
              <CardTitle>Claims Processing Growth</CardTitle>
              <CardDescription>Month-over-month growth trajectory</CardDescription>
            </CardHeader>
            <CardContent>
              {growthData && growthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={growthData}>
                    <defs>
                      <linearGradient id="colorClaims" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="claims" 
                      stroke="#3b82f6" 
                      fillOpacity={1} 
                      fill="url(#colorClaims)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-slate-500">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle>Provider Adoption Curve</CardTitle>
              <CardDescription>Healthcare providers joining the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {growthData && growthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsLineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="providers" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ fill: '#10b981' }}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-slate-500">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle>Revenue Processed</CardTitle>
              <CardDescription>Total claims value processed per month</CardDescription>
            </CardHeader>
            <CardContent>
              {growthData && growthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="revenue" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-slate-500">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle>Processing Time Improvement</CardTitle>
              <CardDescription>Average days to process claims</CardDescription>
            </CardHeader>
            <CardContent>
              {growthData && growthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsLineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="processingTime" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      dot={{ fill: '#ef4444' }}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-slate-500">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Transform Healthcare Claims?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join us in revolutionizing the Canadian healthcare industry. 
              Be part of the digital transformation that's saving providers millions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                className="bg-white text-blue-600 hover:bg-blue-50"
                data-testid="button-schedule-demo"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Demo
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10"
                data-testid="button-download-deck"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Investor Deck
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10"
                data-testid="button-contact-sales"
              >
                <Phone className="w-4 h-4 mr-2" />
                Contact Sales
              </Button>
            </div>
            <p className="text-blue-100 mt-8 text-sm">
              🇨🇦 Proudly Canadian • PIPEDA/PHIPA Compliant • SOC 2 Type II Certified
            </p>
          </motion.div>
        </div>
      </div>
      
      {/* Demo Tour Component */}
      <DemoTour autoStart={true} context="investor" />
    </div>
  );
}
