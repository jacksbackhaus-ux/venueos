import { useState } from "react";
import { motion } from "framer-motion";
import { Wheat, Search, AlertTriangle, CheckCircle2, ChevronRight, Tag, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useQuery } from "@tanstack/react-query";

const ALLERGENS = ["Celery","Cereals (gluten)","Crustaceans","Eggs","Fish","Lupin","Milk","Molluscs","Mustard","Nuts","Peanuts","Sesame","Soya","Sulphites"];

const Allergens = () => {
  const { currentSite } = useSite();
  const siteId = currentSite?.id;
  const [activeTab, setActiveTab] = useState("matrix");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const { data: ingredients = [], isLoading: ingLoading } = useQuery({
    queryKey: ["ingredients", siteId], queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("ingredients").select("*").eq("site_id", siteId).eq("active", true).order("name");
      if (error) throw error; return data;
    }, enabled: !!siteId,
  });

  const { data: recipes = [], isLoading: recLoading } = useQuery({
    queryKey: ["recipes", siteId], queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("recipes").select("*, recipe_ingredients(*, ingredients(*))").eq("site_id", siteId).eq("active", true).order("name");
      if (error) throw error; return data;
    }, enabled: !!siteId,
  });

  const getRecipeAllergens = (recipe: any): string[] => {
    const set = new Set<string>();
    (recipe.recipe_ingredients || []).forEach((ri: any) => {
      (ri.ingredients?.allergens || []).forEach((a: string) => set.add(a));
    });
    return Array.from(set);
  };

  const selectedRecipe = recipes.find((r: any) => r.id === selectedRecipeId);
  const filteredRecipes = recipes.filter((r: any) => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!siteId) return <div className="p-6 text-center text-muted-foreground">No site selected.</div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Wheat className="h-5 w-5 text-primary" /></div>
        <div><h1 className="text-xl font-heading font-bold text-foreground">Allergens & Labels</h1><p className="text-sm text-muted-foreground">{recipes.length} recipes · {ingredients.length} ingredients · 14 allergens tracked</p></div>
      </div>

      {(ingLoading || recLoading) && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {!ingLoading && !recLoading && recipes.length === 0 && ingredients.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Wheat className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No recipes or ingredients configured</p>
          <p className="text-sm mt-1">Add ingredients and recipes in Settings to view the allergen matrix.</p>
        </CardContent></Card>
      )}

      {(recipes.length > 0 || ingredients.length > 0) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="matrix" className="flex-1">Allergen Matrix</TabsTrigger>
            <TabsTrigger value="recipes" className="flex-1">Recipes</TabsTrigger>
            <TabsTrigger value="ingredients" className="flex-1">Ingredients</TabsTrigger>
          </TabsList>

          <TabsContent value="matrix" className="mt-4">
            <Card><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b">
                  <th className="text-left p-2 font-heading font-semibold sticky left-0 bg-card min-w-[140px]">Product</th>
                  {ALLERGENS.map(a => <th key={a} className="p-1.5 font-medium text-center min-w-[28px]" title={a}><span>{a.slice(0,3)}</span></th>)}
                </tr></thead>
                <tbody>{recipes.map((recipe: any) => {
                  const ra = getRecipeAllergens(recipe);
                  return (<tr key={recipe.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 font-medium sticky left-0 bg-card"><div className="flex items-center gap-1.5">{recipe.name}{!recipe.approved && <AlertTriangle className="h-3 w-3 text-warning" />}</div></td>
                    {ALLERGENS.map(allergen => <td key={allergen} className="p-1.5 text-center">{ra.includes(allergen) ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-breach/10 text-breach font-bold">✓</span> : <span className="text-muted-foreground/30">–</span>}</td>)}
                  </tr>);
                })}</tbody>
              </table>
            </div></CardContent></Card>
          </TabsContent>

          <TabsContent value="recipes" className="mt-4 space-y-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search recipes..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="pl-9" /></div>
            {filteredRecipes.map((recipe: any) => {
              const allergens = getRecipeAllergens(recipe);
              return (<motion.div key={recipe.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedRecipeId(recipe.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div><h3 className="font-heading font-semibold text-sm">{recipe.name}</h3><p className="text-xs text-muted-foreground">{recipe.category}</p></div>
                      <div className="flex items-center gap-2">
                        {recipe.approved ? <Badge className="bg-success/10 text-success border-0 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge> : <Badge className="bg-warning/10 text-warning border-0 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" /> Needs Review</Badge>}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">{allergens.map(a => <Badge key={a} variant="outline" className="text-[10px] text-breach border-breach/30">{a}</Badge>)}{allergens.length === 0 && <Badge variant="outline" className="text-[10px] text-success border-success/30">No allergens</Badge>}</div>
                  </CardContent>
                </Card>
              </motion.div>);
            })}
          </TabsContent>

          <TabsContent value="ingredients" className="mt-4">
            <Card><CardContent className="p-0"><div className="divide-y">
              {ingredients.map((ing: any) => (
                <div key={ing.id} className="flex items-center justify-between p-3">
                  <div><p className="text-sm font-medium">{ing.name}</p>{ing.supplier_name && <p className="text-xs text-muted-foreground">{ing.supplier_name}</p>}</div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {(ing.allergens || []).length > 0 ? (ing.allergens || []).map((a: string) => <Badge key={a} variant="outline" className="text-[10px] text-breach border-breach/30">{a}</Badge>) : <Badge variant="outline" className="text-[10px] text-success border-success/30">None</Badge>}
                  </div>
                </div>
              ))}
            </div></CardContent></Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!selectedRecipe} onOpenChange={open => !open && setSelectedRecipeId(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedRecipe && (<>
            <DialogHeader><DialogTitle className="font-heading">{selectedRecipe.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><h4 className="text-sm font-semibold mb-2">Ingredients</h4>
                <div className="space-y-1">{(selectedRecipe.recipe_ingredients || []).sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0)).map((ri: any) => (
                  <div key={ri.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50">
                    <div className="flex items-center gap-2"><span>{ri.ingredients?.name}</span>{(ri.ingredients?.allergens || []).map((a: string) => <Badge key={a} variant="outline" className="text-[10px] text-breach border-breach/30">{a}</Badge>)}</div>
                    {ri.weight && <span className="text-muted-foreground text-xs">{ri.weight}g</span>}
                  </div>
                ))}</div>
              </div>
              <div><h4 className="text-sm font-semibold mb-2">Contains these allergens</h4>
                <div className="flex flex-wrap gap-1.5">{getRecipeAllergens(selectedRecipe).map(a => <Badge key={a} className="bg-breach/10 text-breach border-0">{a}</Badge>)}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t"><Tag className="h-3 w-3" /> Label type: <Badge variant="secondary" className="text-[10px]">{(selectedRecipe.label_type || "ppds").toUpperCase()}</Badge></div>
            </div>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Allergens;
