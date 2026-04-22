import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Thermometer,
  ClipboardList,
  SprayCan,
  MoreHorizontal,
  MapPin,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

const mobileNav = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Temps", url: "/temperatures", icon: Thermometer },
  { title: "Day Sheet", url: "/day-sheet", icon: ClipboardList },
  { title: "Cleaning", url: "/cleaning", icon: SprayCan },
  { title: "More", url: "/more", icon: MoreHorizontal },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { currentSite, hasSelectedSite } = useSite();
  const { isHQ } = useAuth();
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  // "More" is active if the current path isn't one of the main 4
  const moreActive =
    !isActive("/") &&
    !(location.pathname === "/temperatures") &&
    !(location.pathname === "/day-sheet") &&
    !(location.pathname === "/cleaning");

  const showSiteIndicator = hasSelectedSite && currentSite;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop header */}
          <header className="hidden md:flex h-12 items-center border-b bg-card px-4 shrink-0 gap-3">
            <SidebarTrigger />
            <h1 className="font-heading font-semibold text-sm text-foreground">
              VenueOS
            </h1>
            {showSiteIndicator && (
              <Badge variant="outline" className="ml-auto gap-1.5 border-primary/30 bg-primary/5 text-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                <span className="font-medium">{currentSite.name}</span>
                {isHQ && <span className="text-[10px] text-muted-foreground ml-1">HQ view</span>}
              </Badge>
            )}
          </header>

          {/* Mobile header */}
          <header className="md:hidden flex h-14 items-center border-b bg-card px-4 shrink-0 gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary-foreground">V</span>
            </div>
            <h1 className="font-heading font-semibold text-sm text-foreground">VenueOS</h1>
            {showSiteIndicator && (
              <Badge variant="outline" className="ml-auto gap-1 border-primary/30 bg-primary/5 text-foreground max-w-[55%]">
                <MapPin className="h-3 w-3 text-primary shrink-0" />
                <span className="font-medium truncate">{currentSite.name}</span>
              </Badge>
            )}
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>

          {/* Mobile bottom tabs */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50 safe-area-bottom">
            <div className="flex justify-around items-center h-16">
              {mobileNav.map((item) => {
                const active = item.url === "/more" ? moreActive : isActive(item.url);
                return (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    end={item.url === "/"}
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-muted-foreground transition-colors"
                    activeClassName="text-primary"
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{item.title}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </SidebarProvider>
  );
}
