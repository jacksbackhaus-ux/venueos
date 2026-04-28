import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, ArrowRight, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";

export default function SitePicker() {
  const { sites, setCurrentSiteId, isLoading } = useSite();
  const { appUser } = useAuth();
  const navigate = useNavigate();

  // Single-site users should never see this — bounce them through.
  useEffect(() => {
    if (isLoading) return;
    if (sites.length === 1) {
      setCurrentSiteId(sites[0].id);
      navigate("/", { replace: true });
    }
  }, [isLoading, sites, setCurrentSiteId, navigate]);

  const handleSelect = (id: string) => {
    setCurrentSiteId(id);
    navigate("/", { replace: true });
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-background flex items-start md:items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-heading font-bold text-xl mb-4">
            M
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">
            Choose a site
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {appUser?.display_name ? `Welcome back, ${appUser.display_name}. ` : ""}
            Select which site you want to work on today.
          </p>
        </div>

        {sites.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-3 opacity-50" />
              You don't have access to any sites yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sites.map((site, i) => (
              <motion.button
                key={site.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => handleSelect(site.id)}
                className="w-full text-left group"
              >
                <Card className="transition-all hover:border-primary hover:shadow-md active:scale-[0.99]">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-semibold text-base truncate">
                        {site.name}
                      </div>
                      {site.address && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{site.address}</span>
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </CardContent>
                </Card>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
