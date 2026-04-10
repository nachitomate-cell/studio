
"use client";

import Image from "next/image";
import { Entrepreneur } from "@/lib/data";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface EntrepreneurCardProps {
  entrepreneur: Entrepreneur;
  fullWidth?: boolean;
}

export function EntrepreneurCard({ entrepreneur, fullWidth = false }: EntrepreneurCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <Link href={`/emprendedor/${entrepreneur.id}`} className="block group">
      <Card className="overflow-hidden border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl">
        <div className={cn("relative w-full overflow-hidden bg-slate-50", fullWidth ? "aspect-[16/7]" : "aspect-square")}>
          {!imageLoaded && (
            <div className="absolute inset-0 bg-slate-200 animate-pulse z-0" />
          )}
          <Image
            src={entrepreneur.imageUrl}
            alt={entrepreneur.name}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className={cn(
              "object-cover group-hover:scale-105 transition-all duration-700 z-10",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setImageLoaded(true)}
            data-ai-hint="business photo"
          />
          {/* Badge de rubro minimalista sobre la imagen */}
          <div className="absolute top-2 left-2">
            <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-[8px] font-bold text-[#D3B673] uppercase tracking-tighter border border-[#D3B673]/20">
              {entrepreneur.category}
            </div>
          </div>
        </div>
        <CardContent className="p-3 text-center bg-white border-t border-slate-50">
          <h3 className="text-xs font-bold text-[#4A4A4A] line-clamp-1 group-hover:text-[#D3B673] transition-colors">
            {entrepreneur.name}
          </h3>
        </CardContent>
      </Card>
    </Link>
  );
}
