import { useState } from "react";
import { motion } from "framer-motion";
import {
  Truck,
  Plus,
  CheckCircle2,
  XCircle,
  Search,
  ChevronRight,
  Clock,
  Thermometer,
  Package,
  AlertTriangle,
  Camera,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Supplier = {
  id: string;
  name: string;
  category: string;
  approved: boolean;
  lastDelivery?: string;
  deliveryAcceptRate: number;
};

type DeliveryLog = {
  id: string;
  supplierId: string;
  supplierName: string;
  items: string;
  temp?: number;
  tempPass?: boolean;
  packaging: "good" | "damaged" | "n/a";
  useByOk: boolean;
  accepted: boolean;
  time: string;
  date: string;
  loggedBy: string;
  note?: string;
};

const suppliers: Supplier[] = [
  { id: "s1", name: "Bakels", category: "Flour & Dry Goods", approved: true, lastDelivery: "2025-04-07", deliveryAcceptRate: 98 },
  { id: "s2", name: "Meadow Foods", category: "Dairy", approved: true, lastDelivery: "2025-04-07", deliveryAcceptRate: 95 },
  { id: "s3", name: "Local Farm Eggs", category: "Eggs", approved: true, lastDelivery: "2025-04-06", deliveryAcceptRate: 100 },
  { id: "s4", name: "Callebaut", category: "Chocolate", approved: true, lastDelivery: "2025-04-01", deliveryAcceptRate: 100 },
  { id: "s5", name: "Local Butcher", category: "Meat", approved: true, lastDelivery: "2025-04-05", deliveryAcceptRate: 92 },
  { id: "s6", name: "Packaging Direct", category: "Packaging", approved: false, lastDelivery: undefined, deliveryAcceptRate: 0 },
];

const initialDeliveries: DeliveryLog[] = [
  { id: "d1", supplierId: "s1", supplierName: "Bakels", items: "Strong bread flour x10, Plain flour x5", packaging: "good", useByOk: true, accepted: true, time: "10:15", date: "2025-04-08", loggedBy: "Sarah M." },
  { id: "d2", supplierId: "s2", supplierName: "Meadow Foods", items: "Butter x20 blocks, Cream x5L", temp: 3.8, tempPass: true, packaging: "good", useByOk: true, accepted: true, time: "11:00", date: "2025-04-08", loggedBy: "Tom B." },
  { id: "d3", supplierId: "s5", supplierName: "Local Butcher", items: "Sausage meat 10kg", temp: 6.2, tempPass: false, packaging: "good", useByOk: true, accepted: false, time: "09:30", date: "2025-04-07", loggedBy: "Sarah M.", note: "Temp too high (6.2°C). Rejected. Supplier notified." },
];

const Suppliers = () => {
  const [activeTab, setActiveTab] = useState("deliveries");
  const [deliveries, setDeliveries] = useState<DeliveryLog[]>(initialDeliveries);
  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // New delivery form state
  const [newSupplier, setNewSupplier] = useState("");
  const [newItems, setNewItems] = useState("");
  const [newTemp, setNewTemp] = useState("");
  const [newPackaging, setNewPackaging] = useState<"good" | "damaged" | "n/a">("good");
  const [newUseByOk, setNewUseByOk] = useState(true);
  const [newNote, setNewNote] = useState("");

  const handleSaveDelivery = () => {
    const supplier = suppliers.find((s) => s.id === newSupplier);
    if (!supplier || !newItems) return;
    const temp = parseFloat(newTemp);
    const tempPass = isNaN(temp) ? undefined : temp <= 5;

    const delivery: DeliveryLog = {
      id: Date.now().toString(),
      supplierId: newSupplier,
      supplierName: supplier.name,
      items: newItems,
      temp: isNaN(temp) ? undefined : temp,
      tempPass,
      packaging: newPackaging,
      useByOk: newUseByOk,
      accepted: (tempPass !== false) && newPackaging !== "damaged" && newUseByOk,
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      date: new Date().toISOString().split("T")[0],
      loggedBy: "You",
      note: newNote || undefined,
    };

    setDeliveries((prev) => [delivery, ...prev]);
    setShowNewDelivery(false);
    setNewSupplier("");
    setNewItems("");
    setNewTemp("");
    setNewPackaging("good");
    setNewUseByOk(true);
    setNewNote("");
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Suppliers & Traceability</h1>
            <p className="text-sm text-muted-foreground">
              {suppliers.filter((s) => s.approved).length} approved suppliers
            </p>
          </div>
        </div>
        <Button onClick={() => setShowNewDelivery(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Log Delivery
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="deliveries" className="flex-1">Delivery Log</TabsTrigger>
          <TabsTrigger value="suppliers" className="flex-1">Suppliers</TabsTrigger>
        </TabsList>

        {/* Delivery Log */}
        <TabsContent value="deliveries" className="mt-4 space-y-3">
          {deliveries.map((d) => (
            <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={!d.accepted ? "border-breach/30 bg-breach/5" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-semibold text-sm">{d.supplierName}</h3>
                        {d.accepted ? (
                          <Badge className="bg-success/10 text-success border-0 text-[10px]">Accepted</Badge>
                        ) : (
                          <Badge className="bg-breach/10 text-breach border-0 text-[10px]">Rejected</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{d.items}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{d.time} · {d.date}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {d.temp !== undefined && (
                      <Badge variant="outline" className={`text-[10px] ${d.tempPass ? "text-success border-success/30" : "text-breach border-breach/30"}`}>
                        <Thermometer className="h-3 w-3 mr-1" /> {d.temp}°C
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${d.packaging === "damaged" ? "text-breach border-breach/30" : ""}`}>
                      <Package className="h-3 w-3 mr-1" /> Packaging: {d.packaging}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${!d.useByOk ? "text-breach border-breach/30" : ""}`}>
                      Dates: {d.useByOk ? "OK" : "Issue"}
                    </Badge>
                  </div>

                  {d.note && (
                    <p className="text-xs text-breach mt-2 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {d.note}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">Logged by {d.loggedBy}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>

        {/* Supplier Directory */}
        <TabsContent value="suppliers" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search suppliers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          {suppliers
            .filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-semibold text-sm">{s.name}</h3>
                      {s.approved ? (
                        <Badge className="bg-success/10 text-success border-0 text-[10px]">Approved</Badge>
                      ) : (
                        <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Pending</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{s.category}</p>
                    {s.lastDelivery && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Last delivery: {new Date(s.lastDelivery).toLocaleDateString("en-GB")} · Accept rate: {s.deliveryAcceptRate}%
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>

      {/* New Delivery Dialog */}
      <Dialog open={showNewDelivery} onOpenChange={setShowNewDelivery}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Log Delivery</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Supplier</Label>
              <Select value={newSupplier} onValueChange={setNewSupplier}>
                <SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger>
                <SelectContent>
                  {suppliers.filter((s) => s.approved).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Items received</Label>
              <Textarea placeholder="e.g. Strong flour x10, Sugar x5..." value={newItems} onChange={(e) => setNewItems(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-sm">Temperature (°C) — chilled/frozen items</Label>
              <Input type="number" step="0.1" placeholder="e.g. 3.5" value={newTemp} onChange={(e) => setNewTemp(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">Packaging condition</Label>
              <Select value={newPackaging} onValueChange={(v: "good" | "damaged" | "n/a") => setNewPackaging(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="n/a">N/A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Use-by / best-before dates acceptable?</Label>
              <Select value={newUseByOk ? "yes" : "no"} onValueChange={(v) => setNewUseByOk(v === "yes")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes — dates OK</SelectItem>
                  <SelectItem value="no">No — date issue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Notes (corrective action if rejected)</Label>
              <Textarea placeholder="Optional notes..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="text-sm" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2">
                <Camera className="h-4 w-4" /> Photo
              </Button>
              <Button className="flex-1" disabled={!newSupplier || !newItems} onClick={handleSaveDelivery}>
                Save Delivery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Suppliers;
