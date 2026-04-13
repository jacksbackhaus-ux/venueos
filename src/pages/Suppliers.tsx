import { useState } from "react";
import { motion } from "framer-motion";
import { Truck, Plus, CheckCircle2, XCircle, Search, ChevronRight, Clock, Thermometer, Package, AlertTriangle, Camera, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const Suppliers = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userName = appUser?.display_name || staffSession?.display_name || "Unknown";
  const [activeTab, setActiveTab] = useState("deliveries");
  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [newItems, setNewItems] = useState("");
  const [newTemp, setNewTemp] = useState("");
  const [newPackaging, setNewPackaging] = useState<"good" | "damaged" | "n/a">("good");
  const [newUseByOk, setNewUseByOk] = useState(true);
  const [newNote, setNewNote] = useState("");

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("suppliers").select("*").eq("site_id", siteId).eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["delivery_logs", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("delivery_logs").select("*, suppliers(name)").eq("site_id", siteId).order("logged_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  const insertDelivery = useMutation({
    mutationFn: async () => {
      const temp = parseFloat(newTemp);
      const tempPass = isNaN(temp) ? null : temp <= 5;
      const accepted = (tempPass !== false) && newPackaging !== "damaged" && newUseByOk;
      const { error } = await supabase.from("delivery_logs").insert({
        site_id: siteId!, organisation_id: organisationId!, supplier_id: newSupplier,
        items: newItems, temp: isNaN(temp) ? null : temp, temp_pass: tempPass,
        packaging: newPackaging, use_by_ok: newUseByOk, accepted, note: newNote || null,
        logged_by_user_id: appUser?.id || null, logged_by_name: userName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_logs", siteId] });
      setShowNewDelivery(false);
      setNewSupplier(""); setNewItems(""); setNewTemp(""); setNewPackaging("good"); setNewUseByOk(true); setNewNote("");
      toast.success("Delivery logged!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!siteId) return <div className="p-6 text-center text-muted-foreground">No site selected.</div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Truck className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Suppliers & Traceability</h1>
            <p className="text-sm text-muted-foreground">{suppliers.filter((s: any) => s.approved).length} approved suppliers</p>
          </div>
        </div>
        <Button onClick={() => setShowNewDelivery(true)} className="gap-2"><Plus className="h-4 w-4" /> Log Delivery</Button>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {!isLoading && suppliers.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Truck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No suppliers configured</p>
          <p className="text-sm mt-1">Add suppliers in Settings to start logging deliveries.</p>
        </CardContent></Card>
      )}

      {suppliers.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="deliveries" className="flex-1">Delivery Log</TabsTrigger>
            <TabsTrigger value="suppliers" className="flex-1">Suppliers</TabsTrigger>
          </TabsList>
          <TabsContent value="deliveries" className="mt-4 space-y-3">
            {deliveries.map((d: any) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={!d.accepted ? "border-breach/30 bg-breach/5" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-heading font-semibold text-sm">{d.suppliers?.name || "Unknown"}</h3>
                          {d.accepted ? <Badge className="bg-success/10 text-success border-0 text-[10px]">Accepted</Badge> : <Badge className="bg-breach/10 text-breach border-0 text-[10px]">Rejected</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{d.items}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(d.logged_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {d.temp !== null && <Badge variant="outline" className={`text-[10px] ${d.temp_pass ? "text-success border-success/30" : "text-breach border-breach/30"}`}><Thermometer className="h-3 w-3 mr-1" /> {d.temp}°C</Badge>}
                      <Badge variant="outline" className={`text-[10px] ${d.packaging === "damaged" ? "text-breach border-breach/30" : ""}`}><Package className="h-3 w-3 mr-1" /> {d.packaging}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${!d.use_by_ok ? "text-breach border-breach/30" : ""}`}>Dates: {d.use_by_ok ? "OK" : "Issue"}</Badge>
                    </div>
                    {d.note && <p className="text-xs text-breach mt-2 flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {d.note}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">Logged by {d.logged_by_name}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {deliveries.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No deliveries logged yet.</p>}
          </TabsContent>
          <TabsContent value="suppliers" className="mt-4 space-y-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search suppliers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" /></div>
            {suppliers.filter((s: any) => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map((s: any) => (
              <Card key={s.id}><CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2"><h3 className="font-heading font-semibold text-sm">{s.name}</h3>{s.approved ? <Badge className="bg-success/10 text-success border-0 text-[10px]">Approved</Badge> : <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Pending</Badge>}</div>
                  <p className="text-xs text-muted-foreground">{s.category}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent></Card>
            ))}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={showNewDelivery} onOpenChange={setShowNewDelivery}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Log Delivery</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-sm">Supplier</Label><Select value={newSupplier} onValueChange={setNewSupplier}><SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger><SelectContent>{suppliers.filter((s: any) => s.approved).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-sm">Items received</Label><Textarea placeholder="e.g. Strong flour x10, Sugar x5..." value={newItems} onChange={(e) => setNewItems(e.target.value)} className="text-sm" /></div>
            <div><Label className="text-sm">Temperature (°C)</Label><Input type="number" step="0.1" placeholder="e.g. 3.5" value={newTemp} onChange={(e) => setNewTemp(e.target.value)} /></div>
            <div><Label className="text-sm">Packaging</Label><Select value={newPackaging} onValueChange={(v: any) => setNewPackaging(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="good">Good</SelectItem><SelectItem value="damaged">Damaged</SelectItem><SelectItem value="n/a">N/A</SelectItem></SelectContent></Select></div>
            <div><Label className="text-sm">Use-by dates OK?</Label><Select value={newUseByOk ? "yes" : "no"} onValueChange={(v) => setNewUseByOk(v === "yes")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div>
            <div><Label className="text-sm">Notes</Label><Textarea placeholder="Optional..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="text-sm" /></div>
            <Button className="w-full" disabled={!newSupplier || !newItems} onClick={() => insertDelivery.mutate()}>Save Delivery</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Suppliers;
