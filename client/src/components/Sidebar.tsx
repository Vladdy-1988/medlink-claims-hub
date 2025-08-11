import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: 'fas fa-chart-line' },
  { name: 'Claims', href: '/claims', icon: 'fas fa-file-medical' },
  { name: 'Pre-Authorizations', href: '/preauths/new', icon: 'fas fa-check-circle' },
  { name: 'Remittances', href: '/remittances', icon: 'fas fa-receipt' },
  { name: 'Settings', href: '/settings', icon: 'fas fa-cog' },
];

const adminNavigation = [
  { name: 'Users & Roles', href: '/admin', icon: 'fas fa-users' },
  { name: 'Audit Log', href: '/admin?tab=audit', icon: 'fas fa-history' },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  const isActive = (href: string) => {
    if (href === '/') return location === '/';
    return location.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 flex z-40 lg:hidden">
          <div className="fixed inset-0 bg-slate-600 bg-opacity-75" onClick={onClose} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={onClose}
                data-testid="close-sidebar"
              >
                <i className="fas fa-times text-white text-lg"></i>
              </button>
            </div>
            <SidebarContent isActive={isActive} user={user} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col flex-grow bg-white border-r border-slate-200 pt-5 pb-4 overflow-y-auto">
          <SidebarContent isActive={isActive} user={user} />
        </div>
      </div>
    </>
  );
}

function SidebarContent({ isActive, user }: { isActive: (href: string) => boolean; user: any }) {
  return (
    <>
      <div className="flex items-center flex-shrink-0 px-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <i className="fas fa-heartbeat text-white text-sm"></i>
          </div>
          <span className="ml-3 text-xl font-semibold text-slate-900">MedLink Claims</span>
        </div>
      </div>
      
      <div className="mt-8 flex-grow flex flex-col">
        <nav className="flex-1 px-2 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                isActive(item.href)
                  ? "bg-primary-50 border-r-2 border-primary-600 text-primary-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                "group flex items-center px-2 py-2 text-sm font-medium rounded-md"
              )}
              data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <i className={cn(
                item.icon,
                isActive(item.href) ? "text-primary-500" : "text-slate-400",
                "mr-3 text-sm"
              )}></i>
              {item.name}
            </Link>
          ))}
          
          {user?.role === 'admin' && (
            <div className="pt-4 mt-4 border-t border-slate-200">
              <p className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Administration
              </p>
              {adminNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    isActive(item.href)
                      ? "bg-primary-50 border-r-2 border-primary-600 text-primary-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md mt-1"
                  )}
                  data-testid={`admin-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <i className={cn(
                    item.icon,
                    isActive(item.href) ? "text-primary-500" : "text-slate-400",
                    "mr-3 text-sm"
                  )}></i>
                  {item.name}
                </Link>
              ))}
            </div>
          )}
        </nav>
      </div>

      {/* User Profile Section */}
      <div className="flex-shrink-0 flex border-t border-slate-200 p-4">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-600 font-medium text-sm" data-testid="user-initials">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-slate-700" data-testid="user-name">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-slate-500 capitalize" data-testid="user-role">
              {user?.role}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
