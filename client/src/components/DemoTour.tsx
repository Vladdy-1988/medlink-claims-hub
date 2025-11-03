import { useEffect, useState } from "react";
import Joyride, { CallBackProps, STATUS, Step, Styles } from "react-joyride";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  Sparkles, 
  Target, 
  TrendingUp, 
  DollarSign,
  Clock,
  Wifi,
  BarChart3,
  Shield,
  Calculator,
  Rocket,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";

interface DemoTourProps {
  autoStart?: boolean;
  onFinish?: () => void;
  context?: 'investor' | 'dashboard' | 'general';
}

const tourStyles: Styles = {
  options: {
    primaryColor: '#3b82f6',
    zIndex: 10000,
    arrowColor: '#ffffff',
    backgroundColor: '#ffffff',
    textColor: '#1e293b',
    width: 380,
  },
  spotlight: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    filter: 'blur(0px)',
  },
  tooltip: {
    borderRadius: 12,
    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    padding: 20,
  },
  tooltipContainer: {
    textAlign: 'left',
  },
  tooltipTitle: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 12,
  },
  tooltipContent: {
    fontSize: 16,
    lineHeight: 1.6,
  },
  buttonNext: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 600,
    padding: '10px 20px',
    marginLeft: 8,
  },
  buttonBack: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    color: '#475569',
    fontSize: 14,
    fontWeight: 600,
    padding: '10px 20px',
  },
  buttonSkip: {
    color: '#64748b',
    fontSize: 14,
    padding: '10px 20px',
  },
  buttonClose: {
    padding: 8,
    color: '#64748b',
  },
  floater: {
    arrow: {
      padding: 0,
    },
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    mixBlendMode: 'normal',
  },
};

export function DemoTour({ autoStart = false, onFinish, context = 'general' }: DemoTourProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Check if tour should auto-start
  useEffect(() => {
    const tourCompleted = localStorage.getItem('tourCompleted');
    const urlParams = new URLSearchParams(window.location.search);
    const demoParam = urlParams.get('demo');
    
    if (demoParam === 'true') {
      // Force start from URL parameter
      startTour();
    } else if (autoStart && !tourCompleted && context === 'investor') {
      // Auto-start on first visit to investor dashboard
      setTimeout(() => {
        startTour();
      }, 1000);
    }
  }, [autoStart, context]);

  const startTour = () => {
    setRun(true);
    setStepIndex(0);
    
    // Add pulse animation class to body
    document.body.classList.add('demo-tour-active');
    
    // Trigger demo data population
    if (window.location.pathname === '/investor-dashboard') {
      triggerDemoDataAnimation();
    }
  };

  const stopTour = () => {
    setRun(false);
    document.body.classList.remove('demo-tour-active');
    localStorage.setItem('tourCompleted', 'true');
    onFinish?.();
  };

  const triggerDemoDataAnimation = () => {
    // Dispatch custom event to trigger animations in the dashboard
    window.dispatchEvent(new CustomEvent('demo-tour-start'));
  };

  const investorSteps: Step[] = [
    {
      target: 'body',
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
            <h3 className="text-xl font-bold">Welcome to MedLink Claims Hub</h3>
          </div>
          <p className="text-gray-600">
            Canada's First Digital Claims Platform 🇨🇦
          </p>
          <p className="text-sm text-gray-500">
            Let's take a quick tour of how MedLink is revolutionizing healthcare claims processing
            for Canadian providers.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Rocket className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-600 font-medium">2-minute guided tour</span>
          </div>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-testid="kpi-total-value"]',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold">Impressive Traction</h4>
          </div>
          <p>Processing <strong>$2.3M+ in claims</strong> with an <strong>87% approval rate</strong>.</p>
          <p className="text-sm text-gray-600">
            Our platform has processed over 5,400 claims in just 6 months, with 342% month-over-month growth.
          </p>
        </div>
      ),
      placement: 'bottom',
      spotlightPadding: 8,
    },
    {
      target: '[data-testid="button-new-claim"]',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold">Lightning-Fast Claims</h4>
          </div>
          <p>Providers can submit claims in <strong>under 2 minutes</strong>.</p>
          <p className="text-sm text-gray-600">
            Our streamlined workflow reduces claim submission time by 90% compared to traditional methods.
          </p>
        </div>
      ),
      placement: 'bottom',
      spotlightPadding: 4,
    },
    {
      target: '[data-testid="smart-validation"]',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            <h4 className="font-semibold">AI-Powered Intelligence</h4>
          </div>
          <p>Smart validation catches errors <strong>before submission</strong>.</p>
          <p className="text-sm text-gray-600">
            Reduces claim rejections by 73% through real-time validation and automatic code suggestions.
          </p>
        </div>
      ),
      placement: 'left',
      spotlightPadding: 8,
    },
    {
      target: '[data-testid="offline-banner"]',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-orange-600" />
            <h4 className="font-semibold">Works Offline</h4>
          </div>
          <p>Critical for <strong>rural and remote clinics</strong> across Canada.</p>
          <p className="text-sm text-gray-600">
            Claims are automatically synced when connection is restored. Never lose work due to connectivity issues.
          </p>
        </div>
      ),
      placement: 'bottom',
      spotlightPadding: 4,
    },
    {
      target: '[data-testid="recent-activity"]',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h4 className="font-semibold">Real-Time Tracking</h4>
          </div>
          <p>Track claims status in <strong>real-time</strong> with live updates.</p>
          <p className="text-sm text-gray-600">
            Automated notifications keep providers informed at every step, reducing follow-up calls by 85%.
          </p>
        </div>
      ),
      placement: 'left',
      spotlightPadding: 8,
    },
    {
      target: '[data-testid="analytics-chart"]',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold">Powerful Analytics</h4>
          </div>
          <p>Insights to <strong>optimize revenue cycle</strong> management.</p>
          <p className="text-sm text-gray-600">
            Identify bottlenecks, track performance metrics, and make data-driven decisions to improve cash flow.
          </p>
        </div>
      ),
      placement: 'top',
      spotlightPadding: 8,
    },
    {
      target: '[data-testid="compliance-badge"]',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold">Canadian Compliance</h4>
          </div>
          <p>Built for Canadian healthcare - <strong>PIPEDA & Quebec Law 25 ready</strong>.</p>
          <p className="text-sm text-gray-600">
            End-to-end encryption, field-level security, and full audit trails ensure complete compliance.
          </p>
        </div>
      ),
      placement: 'left',
      spotlightPadding: 8,
    },
    {
      target: '[data-testid="roi-calculator"]',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold">Proven ROI</h4>
          </div>
          <p>Saves providers <strong>$15,000+ per month</strong> in admin costs.</p>
          <p className="text-sm text-gray-600">
            72% reduction in administrative overhead with automated workflows and intelligent claim routing.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
            <p className="text-sm font-semibold text-green-800">Ready to scale?</p>
            <p className="text-xs text-green-700 mt-1">
              Currently processing for 142 providers with capacity for 10,000+
            </p>
          </div>
        </div>
      ),
      placement: 'left',
      spotlightPadding: 8,
    },
  ];

  const dashboardSteps: Step[] = [
    {
      target: 'body',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Welcome to Your Dashboard</h3>
          <p>Let's explore the key features that help you manage claims efficiently.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-testid="quick-action-new-claim"]',
      content: 'Create new claims in under 2 minutes with our streamlined workflow.',
      placement: 'bottom',
    },
    {
      target: '[data-testid="current-date"]',
      content: 'Track your daily operations and stay organized with real-time updates.',
      placement: 'bottom',
    },
  ];

  const steps = context === 'investor' ? investorSteps : dashboardSteps;

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, index, type, action } = data;
    
    if (type === 'step:after') {
      setStepIndex(index + (action === 'prev' ? -1 : 1));
      
      // Trigger animations for specific steps
      if (index === 1) {
        // Animate numbers counting up
        window.dispatchEvent(new CustomEvent('demo-animate-numbers'));
      } else if (index === 2) {
        // Show sample claim being filled
        window.dispatchEvent(new CustomEvent('demo-fill-claim'));
      } else if (index === 5) {
        // Show notification popup
        toast({
          title: "Real-time Update",
          description: "Claim #2024-1234 approved! Payment of $450 processed.",
        });
      }
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      stopTour();
      
      if (status === STATUS.FINISHED) {
        toast({
          title: "Tour Complete! 🎉",
          description: "You've seen the key features of MedLink Claims Hub.",
        });
      }
    }
  };

  return (
    <>
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        continuous
        showProgress
        showSkipButton
        disableScrolling
        disableOverlayClose
        spotlightClicks
        styles={tourStyles}
        locale={{
          back: (
            <span className="flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              Back
            </span>
          ),
          close: <X className="w-4 h-4" />,
          last: 'Finish Tour',
          next: (
            <span className="flex items-center gap-1">
              Next
              <ChevronRight className="w-4 h-4" />
            </span>
          ),
          skip: 'Skip Tour',
        }}
        floaterProps={{
          disableAnimation: false,
          hideArrow: false,
        }}
        callback={handleJoyrideCallback}
      />
      
      {/* Add custom styles for pulse animations */}
      <style jsx global>{`
        .demo-tour-active [data-testid="kpi-total-value"],
        .demo-tour-active [data-testid="button-new-claim"],
        .demo-tour-active [data-testid="smart-validation"],
        .demo-tour-active [data-testid="recent-activity"],
        .demo-tour-active [data-testid="analytics-chart"],
        .demo-tour-active [data-testid="compliance-badge"],
        .demo-tour-active [data-testid="roi-calculator"] {
          animation: pulse-highlight 2s ease-in-out infinite;
        }
        
        @keyframes pulse-highlight {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(59, 130, 246, 0.1);
          }
        }
        
        .react-joyride__spotlight {
          border-radius: 8px;
        }
        
        .react-joyride__progress {
          background-color: #e2e8f0 !important;
          height: 4px !important;
        }
        
        .react-joyride__progress-bar {
          background: linear-gradient(90deg, #3b82f6, #8b5cf6) !important;
          height: 4px !important;
        }
        
        .react-joyride__tooltip {
          animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}