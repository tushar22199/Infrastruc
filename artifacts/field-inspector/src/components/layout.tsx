import { useOfflineSync } from "@/lib/offline-sync";
import { Link, useLocation } from "wouter";
import { Activity, Map as MapIcon, PlusSquare, Database, Menu, Wifi, WifiOff, User, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@workspace/replit-auth-web";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isOnline, queueCount, isSyncing } = useOfflineSync();
  const { user, logout } = useAuth();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/map", label: "Map View", icon: MapIcon },
    { href: "/inspections", label: "Inspections", icon: Database },
    { href: "/log", label: "Log Issue", icon: PlusSquare },
  ];

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.email || "Engineer";

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user?.firstName
      ? user.firstName[0]
      : "E";

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border text-sidebar-foreground w-64 p-4">
      <div className="flex items-center gap-2 mb-8 px-2">
        <Activity className="h-6 w-6 text-primary" />
        <span className="font-bold tracking-tight text-lg leading-tight uppercase">AUDITOR</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-sidebar-border pt-4 space-y-2">
        {/* Connection status */}
        <div
          className={`flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-md ${
            isOnline ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
          }`}
        >
          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {isOnline ? "SYS.ONLINE" : "SYS.OFFLINE"}
        </div>
        {queueCount > 0 && (
          <div className="flex items-center justify-between text-xs px-3 py-2 bg-accent/10 text-accent rounded-md">
            <span>Pending Sync</span>
            <span className="font-mono bg-accent/20 px-1.5 py-0.5 rounded">{queueCount}</span>
          </div>
        )}
        {isSyncing && (
          <div className="text-xs text-muted-foreground px-3 animate-pulse">Syncing...</div>
        )}

        {/* User profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent/50 transition-colors text-left">
              {user?.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={displayName}
                  className="h-6 w-6 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-primary uppercase">{initials}</span>
                </div>
              )}
              <span className="flex-1 truncate text-xs font-medium text-muted-foreground">{displayName}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="text-xs font-mono text-muted-foreground cursor-default" disabled>
              <User className="h-3 w-3 mr-2" />
              {displayName}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-xs text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="h-3 w-3 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex w-full dark">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <SidebarContent />
      </div>

      {/* Mobile Header & Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 border-b border-border flex items-center justify-between px-4 bg-card">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold uppercase tracking-tight">AUDITOR</span>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
