import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-slate-200">
      <button
        type="button"
        className="px-4 border-r border-slate-200 text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
        onClick={onMenuClick}
        data-testid="mobile-menu-button"
      >
        <i className="fas fa-bars text-lg"></i>
      </button>
      
      <div className="flex-1 px-4 flex justify-between">
        <div className="flex-1 flex">
          <form className="w-full flex md:ml-0" action="#" method="GET">
            <div className="relative w-full text-slate-400 focus-within:text-slate-600">
              <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                <i className="fas fa-search text-sm ml-3"></i>
              </div>
              <input
                className="block w-full h-full pl-10 pr-3 py-2 border-transparent text-slate-900 placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-0 focus:border-transparent sm:text-sm"
                placeholder="Search claims, patients, or providers..."
                type="search"
                name="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-input"
              />
            </div>
          </form>
        </div>
        
        <div className="ml-4 flex items-center md:ml-6">
          {/* Notifications */}
          <button
            className="bg-white p-1 rounded-full text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            data-testid="notifications-button"
          >
            <i className="fas fa-bell text-lg"></i>
          </button>
          
          {/* Profile dropdown */}
          <div className="ml-3 relative">
            <button
              className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              onClick={handleLogout}
              data-testid="profile-button"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-600 font-medium text-sm" data-testid="profile-initials">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
