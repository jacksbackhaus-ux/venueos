import { Wheat } from "lucide-react";

const Allergens = () => (
  <div className="p-4 md:p-6 space-y-4">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Wheat className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">Allergens & Labels</h1>
        <p className="text-sm text-muted-foreground">Ingredient library, recipes, and allergen matrix</p>
      </div>
    </div>
    <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
      <Wheat className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p className="font-medium">Coming soon</p>
      <p className="text-sm">14-allergen tracking, recipe builder, and label generation</p>
    </div>
  </div>
);

export default Allergens;
