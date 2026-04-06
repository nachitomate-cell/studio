
"use client";

import { MAP_LOCATIONS } from "@/lib/data";
import { MapPin, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function InteractiveMap() {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl p-4 border border-border shadow-sm overflow-hidden relative min-h-[400px]">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-primary">
          <MapPin className="w-5 h-5" />
          Plano de Patio Curauma
        </h3>
        
        {/* Placeholder for actual interactive map graphic */}
        <div className="relative w-full aspect-square bg-accent/20 rounded-xl border-2 border-dashed border-accent/40 overflow-hidden">
          {/* Stylized background paths */}
          <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100">
            <rect x="10" y="10" width="80" height="80" fill="white" rx="8" />
            <path d="M50 0 V100 M0 50 H100" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>

          {MAP_LOCATIONS.map((loc) => (
            <TooltipProvider key={loc.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group"
                  >
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping group-hover:animate-none" />
                      <div className="bg-primary text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform">
                        <MapPin className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-bold">{loc.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
            <Info className="w-4 h-4" />
            Puntos de Interés
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {MAP_LOCATIONS.map((loc) => (
              <div key={loc.id} className="text-xs bg-accent/10 border border-accent/20 p-2 rounded-lg flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full" />
                {loc.name}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <Button className="w-full h-12 rounded-xl text-lg font-bold shadow-lg shadow-primary/20">
        ¿Cómo llegar al Patio?
      </Button>
    </div>
  );
}
