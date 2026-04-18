import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Thermometer,
  ClipboardList,
  SprayCan,
  MoreHorizontal,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";

const mobileNav = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Temps", url: "/temperatures", icon: Thermometer },
  { title: "Day Sheet", url: "/day-sheet", icon: ClipboardList },
  { title: "Cleaning", url: "/cleaning", icon: SprayCan },
  { title: "More", url: "/more", icon: MoreHorizontal },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  // "More" is active if the current path isn't one of the main 4
  const moreActive =
    !isActive("/") &&
    !(location.pathname === "/temperatures") &&
    !(location.pathname === "/day-sheet") &&
    !(location.pathname === "/cleaning");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop header */}
          <header className="hidden md:flex h-12 items-center border-b bg-card px-4 shrink-0">
            <SidebarTrigger className="mr-3" />
            <h1 className="font-heading font-semibold text-sm text-foreground">
              VenueOS
            </h1>
          </header>

          {/* Mobile header */}
          <header className="md:hidden flex h-14 items-center border-b bg-card px-4 shrink-0">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center mr-2">
              <span className="text-[10px] font-bold text-primary-foreground">V</span>
            </div>
            <h1 className="font-heading font-semibold text-sm text-foreground">VenueOS</h1>
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
