
"use client";

import { useState, useEffect } from "react";
import { recommendEntrepreneurs, RecommendEntrepreneursOutput } from "@/ai/flows/recommend-entrepreneurs-flow";
import { Sparkles, RefreshCcw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function RecommendationWidget() {
  const [recommendations, setRecommendations] = useState<RecommendEntrepreneursOutput | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const result = await recommendEntrepreneurs({
        browsingHistory: ["Comida orgánica", "Artesanía local", "Viveros"],
        inferredPreferences: ["ecológico", "hecho a mano", "comunidad"]
      });
      setRecommendations(result);
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2 text-primary">
          <Sparkles className="w-5 h-5 text-accent-foreground" />
          Sugerencias para ti
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={fetchRecommendations} 
          disabled={loading}
          className="text-primary hover:bg-primary/5 rounded-lg"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 no-scrollbar scroll-smooth">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="min-w-[280px] h-40 bg-white/50 animate-pulse rounded-2xl border border-border" />
          ))
        ) : (
          recommendations?.recommendations.map((rec, i) => (
            <Card key={i} className="min-w-[280px] max-w-[280px] bg-gradient-to-br from-white to-accent/5 border-accent/20 shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <Badge className="bg-primary/10 text-primary border-none text-[10px] font-bold uppercase">
                    {rec.category}
                  </Badge>
                  <Star className="w-4 h-4 text-accent-foreground fill-accent-foreground" />
                </div>
                <h4 className="font-bold text-primary text-base line-clamp-1">{rec.entrepreneurName}</h4>
                <p className="text-xs text-muted-foreground line-clamp-3 italic leading-relaxed">
                  "{rec.recommendationReason}"
                </p>
                <Button variant="link" size="sm" className="p-0 h-auto text-primary font-bold text-xs">
                  Ver negocio
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
