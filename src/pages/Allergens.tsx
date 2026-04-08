import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wheat,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Tag,
  FileText,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ALLERGENS = [
  "Celery", "Cereals (gluten)", "Crustaceans", "Eggs", "Fish",
  "Lupin", "Milk", "Molluscs", "Mustard", "Nuts",
  "Peanuts", "Sesame", "Soya", "Sulphites",
];

type Ingredient = {
  id: string;
  name: string;
  allergens: string[];
  supplier?: string;
};

type Recipe = {
  id: string;
  name: string;
  category: string;
  ingredients: { ingredientId: string; weight: number }[];
  approved: boolean;
  lastReviewed?: string;
  labelType: "prepacked" | "ppds" | "non-prepacked";
};

const ingredients: Ingredient[] = [
  { id: "i1", name: "Plain Flour", allergens: ["Cereals (gluten)"], supplier: "Bakels" },
  { id: "i2", name: "Butter", allergens: ["Milk"], supplier: "Meadow Foods" },
  { id: "i3", name: "Free Range Eggs", allergens: ["Eggs"], supplier: "Local Farm" },
  { id: "i4", name: "Caster Sugar", allergens: [], supplier: "Tate & Lyle" },
  { id: "i5", name: "Ground Almonds", allergens: ["Nuts"], supplier: "Bakels" },
  { id: "i6", name: "Dark Chocolate", allergens: ["Milk", "Soya"], supplier: "Callebaut" },
  { id: "i7", name: "Vanilla Extract", allergens: [], supplier: "Nielsen-Massey" },
  { id: "i8", name: "Baking Powder", allergens: [], supplier: "Dr Oetker" },
  { id: "i9", name: "Sesame Seeds", allergens: ["Sesame"], supplier: "Bakels" },
  { id: "i10", name: "Sausage Meat", allergens: ["Sulphites"], supplier: "Local Butcher" },
  { id: "i11", name: "Puff Pastry", allergens: ["Cereals (gluten)", "Milk"], supplier: "Bakels" },
];

const recipes: Recipe[] = [
  {
    id: "r1", name: "Victoria Sponge", category: "Cakes",
    ingredients: [
      { ingredientId: "i1", weight: 225 },
      { ingredientId: "i2", weight: 225 },
      { ingredientId: "i3", weight: 4 },
      { ingredientId: "i4", weight: 225 },
      { ingredientId: "i8", weight: 5 },
      { ingredientId: "i7", weight: 5 },
    ],
    approved: true, lastReviewed: "2024-12-01", labelType: "ppds",
  },
  {
    id: "r2", name: "Almond Croissant", category: "Pastries",
    ingredients: [
      { ingredientId: "i1", weight: 300 },
      { ingredientId: "i2", weight: 200 },
      { ingredientId: "i5", weight: 150 },
      { ingredientId: "i3", weight: 2 },
      { ingredientId: "i4", weight: 100 },
    ],
    approved: true, lastReviewed: "2024-11-15", labelType: "ppds",
  },
  {
    id: "r3", name: "Sausage Roll", category: "Savoury",
    ingredients: [
      { ingredientId: "i11", weight: 300 },
      { ingredientId: "i10", weight: 400 },
      { ingredientId: "i9", weight: 10 },
      { ingredientId: "i3", weight: 1 },
    ],
    approved: false, lastReviewed: undefined, labelType: "ppds",
  },
  {
    id: "r4", name: "Chocolate Brownie", category: "Cakes",
    ingredients: [
      { ingredientId: "i6", weight: 200 },
      { ingredientId: "i2", weight: 150 },
      { ingredientId: "i3", weight: 3 },
      { ingredientId: "i4", weight: 250 },
      { ingredientId: "i1", weight: 60 },
    ],
    approved: true, lastReviewed: "2025-01-10", labelType: "ppds",
  },
];

const Allergens = () => {
  const [activeTab, setActiveTab] = useState("matrix");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const getRecipeAllergens = (recipe: Recipe): string[] => {
    const allergenSet = new Set<string>();
    recipe.ingredients.forEach((ri) => {
      const ing = ingredients.find((i) => i.id === ri.ingredientId);
      ing?.allergens.forEach((a) => allergenSet.add(a));
    });
    return Array.from(allergenSet);
  };

  const getRecipeIngredients = (recipe: Recipe) => {
    return recipe.ingredients
      .map((ri) => ({
        ...ri,
        ingredient: ingredients.find((i) => i.id === ri.ingredientId)!,
      }))
      .sort((a, b) => b.weight - a.weight);
  };

  const filteredRecipes = recipes.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wheat className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Allergens & Labels</h1>
            <p className="text-sm text-muted-foreground">
              {recipes.length} recipes · {ingredients.length} ingredients · 14 allergens tracked
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="matrix" className="flex-1">Allergen Matrix</TabsTrigger>
          <TabsTrigger value="recipes" className="flex-1">Recipes</TabsTrigger>
          <TabsTrigger value="ingredients" className="flex-1">Ingredients</TabsTrigger>
        </TabsList>

        {/* Allergen Matrix */}
        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-heading font-semibold sticky left-0 bg-card min-w-[140px]">Product</th>
                      {ALLERGENS.map((a) => (
                        <th key={a} className="p-1.5 font-medium text-center min-w-[28px]" title={a}>
                          <span className="writing-mode-vertical">{a.slice(0, 3)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recipes.map((recipe) => {
                      const recipeAllergens = getRecipeAllergens(recipe);
                      return (
                        <tr key={recipe.id} className="border-b hover:bg-muted/30">
                          <td className="p-2 font-medium sticky left-0 bg-card">
                            <div className="flex items-center gap-1.5">
                              {recipe.name}
                              {!recipe.approved && (
                                <AlertTriangle className="h-3 w-3 text-warning" />
                              )}
                            </div>
                          </td>
                          {ALLERGENS.map((allergen) => (
                            <td key={allergen} className="p-1.5 text-center">
                              {recipeAllergens.includes(allergen) ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-breach/10 text-breach font-bold">✓</span>
                              ) : (
                                <span className="text-muted-foreground/30">–</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recipes */}
        <TabsContent value="recipes" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredRecipes.map((recipe) => {
            const allergens = getRecipeAllergens(recipe);
            return (
              <motion.div key={recipe.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedRecipe(recipe)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-heading font-semibold text-sm">{recipe.name}</h3>
                        <p className="text-xs text-muted-foreground">{recipe.category}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {recipe.approved ? (
                          <Badge className="bg-success/10 text-success border-0 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                          </Badge>
                        ) : (
                          <Badge className="bg-warning/10 text-warning border-0 text-[10px]">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Needs Review
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {allergens.map((a) => (
                        <Badge key={a} variant="outline" className="text-[10px] text-breach border-breach/30">
                          {a}
                        </Badge>
                      ))}
                      {allergens.length === 0 && (
                        <Badge variant="outline" className="text-[10px] text-success border-success/30">
                          No allergens
                        </Badge>
                      )}
                    </div>
                    {recipe.lastReviewed && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Last reviewed: {new Date(recipe.lastReviewed).toLocaleDateString("en-GB")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </TabsContent>

        {/* Ingredients */}
        <TabsContent value="ingredients" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {ingredients.map((ing) => (
                  <div key={ing.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium">{ing.name}</p>
                      {ing.supplier && (
                        <p className="text-xs text-muted-foreground">{ing.supplier}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {ing.allergens.length > 0 ? (
                        ing.allergens.map((a) => (
                          <Badge key={a} variant="outline" className="text-[10px] text-breach border-breach/30">
                            {a}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-success border-success/30">
                          None
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recipe Detail Dialog */}
      <Dialog open={!!selectedRecipe} onOpenChange={(open) => !open && setSelectedRecipe(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedRecipe && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading">{selectedRecipe.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Ingredients (descending weight)</h4>
                  <div className="space-y-1">
                    {getRecipeIngredients(selectedRecipe).map((ri) => (
                      <div key={ri.ingredientId} className="flex items-center justify-between text-sm py-1 border-b border-border/50">
                        <div className="flex items-center gap-2">
                          <span>{ri.ingredient.name}</span>
                          {ri.ingredient.allergens.map((a) => (
                            <Badge key={a} variant="outline" className="text-[10px] text-breach border-breach/30">
                              {a}
                            </Badge>
                          ))}
                        </div>
                        <span className="text-muted-foreground text-xs">{ri.weight}g</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Contains these allergens</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {getRecipeAllergens(selectedRecipe).map((a) => (
                      <Badge key={a} className="bg-breach/10 text-breach border-0">{a}</Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                  <Tag className="h-3 w-3" />
                  Label type: <Badge variant="secondary" className="text-[10px]">{selectedRecipe.labelType.toUpperCase()}</Badge>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Allergens;
