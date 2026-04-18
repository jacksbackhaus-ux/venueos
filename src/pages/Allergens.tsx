import { useState } from "react";
import { motion } from "framer-motion";
import { Wheat, Search, AlertTriangle, CheckCircle2, ChevronRight, Tag, Loader2, Plus, Trash2, X, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const ALLERGENS = ["Celery","Cereals (gluten)","Crustaceans","Eggs","Fish","Lupin","Milk","Molluscs","Mustard","Nuts","Peanuts","Sesame","Soya","Sulphites"];

const Allergens = () => {
  const { currentSite, organisationId } = useSite();
  const qc = useQueryClient();
  const siteId = currentSite?.id;
  const [activeTab, setActiveTab] = useState("matrix");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const [showIngDialog, setShowIngDialog] = useState(false);
  const [ingForm, setIngForm] = useState({ name: "", supplier_name: "", allergens: [] as string[] });

  const [showRecipeDialog, setShowRecipeDialog] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    name: "", category: "General", label_type: "ppds",
    ingredients: [] as { ingredient_id: string; weight: string }[],
  });

  const { data: ingredients = [], isLoading: ingLoading } = useQuery({
    queryKey: ["ingredients", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("ingredients").select("*").eq("site_id", siteId).eq("active", true).order("name");
      if (error) throw error; return data || [];
    }, enabled: !!siteId,
  });

  const { data: recipes = [], isLoading: recLoading } = useQuery({
    queryKey: ["recipes", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("recipes").select("*, recipe_ingredients(*, ingredients(*))").eq("site_id", siteId).eq("active", true).order("name");
      if (error) throw error; return data || [];
    }, enabled: !!siteId,
  });

  const saveIngredient = useMutation({
    mutationFn: async () => {
      if (!siteId || !organisationId) throw new Error("No site");
      const { error } = await supabase.from("ingredients").insert({
        site_id: siteId, organisation_id: organisationId,
        name: ingForm.name, supplier_name: ingForm.supplier_name || null, allergens: ingForm.allergens,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ingredient added");
      setShowIngDialog(false);
      setIngForm({ name: "", supplier_name: "", allergens: [] });
      qc.invalidateQueries({ queryKey: ["ingredients", siteId] });
      qc.invalidateQueries({ queryKey: ["recipes", siteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteIngredient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ingredients").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ingredient deactivated"); qc.invalidateQueries({ queryKey: ["ingredients", siteId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveRecipe = useMutation({
    mutationFn: async () => {
      if (!siteId || !organisationId) throw new Error("No site");
      const { data: newRecipe, error } = await supabase.from("recipes").insert({
        site_id: siteId, organisation_id: organisationId,
        name: recipeForm.name, category: recipeForm.category, label_type: recipeForm.label_type,
      }).select("id").single();
      if (error) throw error;
      const valid = recipeForm.ingredients.filter(i => i.ingredient_id);
      if (valid.length > 0) {
        const { error: riErr } = await supabase.from("recipe_ingredients").insert(
          valid.map((ri, idx) => ({
            recipe_id: newRecipe!.id, ingredient_id: ri.ingredient_id,
            weight: ri.weight ? parseFloat(ri.weight) : null, sort_order: idx,
          }))
        );
        if (riErr) throw riErr;
      }
    },
    onSuccess: () => {
      toast.success("Recipe added");
      setShowRecipeDialog(false);
      setRecipeForm({ name: "", category: "General", label_type: "ppds", ingredients: [] });
      qc.invalidateQueries({ queryKey: ["recipes", siteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recipes").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Recipe deactivated"); qc.invalidateQueries({ queryKey: ["recipes", siteId] }); },
    onError: (e: any) => toast.error(e.message),
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Wheat className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Allergens & Labels</h1>
            <p className="text-sm text-muted-foreground">{recipes.length} recipes · {ingredients.length} ingredients · 14 allergens tracked</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowIngDialog(true)}>
            <Plus className="h-3 w-3" /> Ingredient
          </Button>
          <Button size="sm" className="gap-1" disabled={ingredients.length === 0} onClick={() => setShowRecipeDialog(true)}>
            <Plus className="h-3 w-3" /> Recipe
          </Button>
        </div>
      </div>

      {(ingLoading || recLoading) && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {!ingLoading && !recLoading && recipes.length === 0 && ingredients.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Wheat className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No recipes or ingredients yet</p>
          <p className="text-sm mt-1">Add ingredients first, then build your recipes.</p>
        </CardContent></Card>
      )}

      {(recipes.length > 0 || ingredients.length > 0) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="matrix" className="flex-1">Matrix</TabsTrigger>
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
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="cursor-pointer flex-1" onClick={() => setSelectedRecipeId(recipe.id)}>
                        <h3 className="font-heading font-semibold text-sm">{recipe.name}</h3>
                        <p className="text-xs text-muted-foreground">{recipe.category}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {recipe.approved ? <Badge className="bg-success/10 text-success border-0 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge> : <Badge className="bg-warning/10 text-warning border-0 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" /> Needs Review</Badge>}
                        <Button variant="ghost" size="sm" className="text-breach hover:text-breach h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); deleteRecipe.mutate(recipe.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground cursor-pointer" onClick={() => setSelectedRecipeId(recipe.id)} />
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
                <div key={ing.id} className="flex items-center justify-between p-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{ing.name}</p>
                    {ing.supplier_name && <p className="text-xs text-muted-foreground truncate">{ing.supplier_name}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {(ing.allergens || []).length > 0 ? (ing.allergens || []).map((a: string) => <Badge key={a} variant="outline" className="text-[10px] text-breach border-breach/30">{a}</Badge>) : <Badge variant="outline" className="text-[10px] text-success border-success/30">None</Badge>}
                  </div>
                  <Button variant="ghost" size="sm" className="text-breach hover:text-breach h-7 w-7 p-0 shrink-0" onClick={() => deleteIngredient.mutate(ing.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div></CardContent></Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Recipe details dialog */}
      <Dialog open={!!selectedRecipe} onOpenChange={open => !open && setSelectedRecipeId(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedRecipe && (<>
            <DialogHeader><DialogTitle className="font-heading">{selectedRecipe.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><h4 className="text-sm font-semibold mb-2">Ingredients</h4>
                <div className="space-y-1">{(selectedRecipe.recipe_ingredients || []).sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0)).map((ri: any) => (
                  <div key={ri.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50">
                    <div className="flex items-center gap-2 flex-wrap"><span>{ri.ingredients?.name}</span>{(ri.ingredients?.allergens || []).map((a: string) => <Badge key={a} variant="outline" className="text-[10px] text-breach border-breach/30">{a}</Badge>)}</div>
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

      {/* Add ingredient dialog */}
      <Dialog open={showIngDialog} onOpenChange={setShowIngDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Add Ingredient</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-sm">Name</Label><Input placeholder="e.g. Plain flour" value={ingForm.name} onChange={(e) => setIngForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className="text-sm">Supplier (optional)</Label><Input placeholder="e.g. Allinsons" value={ingForm.supplier_name} onChange={(e) => setIngForm(f => ({ ...f, supplier_name: e.target.value }))} /></div>
            <div>
              <Label className="text-sm mb-2 block">Allergens contained</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ALLERGENS.map(a => (
                  <label key={a} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox checked={ingForm.allergens.includes(a)}
                      onCheckedChange={(checked) => setIngForm(f => ({ ...f, allergens: checked ? [...f.allergens, a] : f.allergens.filter(x => x !== a) }))} />
                    <span>{a}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIngDialog(false)}>Cancel</Button>
            <Button disabled={!ingForm.name || saveIngredient.isPending} onClick={() => saveIngredient.mutate()}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add recipe dialog */}
      <Dialog open={showRecipeDialog} onOpenChange={setShowRecipeDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Add Recipe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-sm">Recipe name</Label><Input placeholder="e.g. Sourdough loaf" value={recipeForm.name} onChange={(e) => setRecipeForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">Category</Label><Input placeholder="Bread, Cake..." value={recipeForm.category} onChange={(e) => setRecipeForm(f => ({ ...f, category: e.target.value }))} /></div>
              <div>
                <Label className="text-sm">Label type</Label>
                <Select value={recipeForm.label_type} onValueChange={(v) => setRecipeForm(f => ({ ...f, label_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ppds">PPDS (full ingredient list)</SelectItem>
                    <SelectItem value="non-ppds">Non-PPDS (allergen menu)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Ingredients</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs"
                  onClick={() => setRecipeForm(f => ({ ...f, ingredients: [...f.ingredients, { ingredient_id: "", weight: "" }] }))}>
                  <Plus className="h-3 w-3" /> Row
                </Button>
              </div>
              <div className="space-y-2">
                {recipeForm.ingredients.map((row, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Select value={row.ingredient_id} onValueChange={(v) => setRecipeForm(f => {
                      const ings = [...f.ingredients]; ings[idx] = { ...ings[idx], ingredient_id: v }; return { ...f, ingredients: ings };
                    })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select ingredient..." /></SelectTrigger>
                      <SelectContent>
                        {ingredients.map((ing: any) => <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" placeholder="g" className="w-20" value={row.weight} onChange={(e) => setRecipeForm(f => {
                      const ings = [...f.ingredients]; ings[idx] = { ...ings[idx], weight: e.target.value }; return { ...f, ingredients: ings };
                    })} />
                    <Button variant="ghost" size="sm" className="text-breach hover:text-breach h-9 w-9 p-0"
                      onClick={() => setRecipeForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {recipeForm.ingredients.length === 0 && <p className="text-xs text-muted-foreground italic">Add at least one ingredient row.</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecipeDialog(false)}>Cancel</Button>
            <Button disabled={!recipeForm.name || saveRecipe.isPending} onClick={() => saveRecipe.mutate()}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Allergens;
