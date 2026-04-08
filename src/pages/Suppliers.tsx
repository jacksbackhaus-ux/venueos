import { Truck } from "lucide-react";

const Suppliers = () => (
  <div className="p-4 md:p-6 space-y-4">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Truck className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">Suppliers & Traceability</h1>
        <p className="text-sm text-muted-foreground">Supplier directory, deliveries, and batch tracking</p>
      </div>
    </div>
    <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
      <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p className="font-medium">Coming soon</p>
      <p className="text-sm">Delivery logging, batch tracking, and recall workflows</p>
    </div>
  </div>
);

export default Suppliers;
