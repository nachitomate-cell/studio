"use client";

import Image from "next/image";
import { Entrepreneur } from "@/lib/data";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

interface EntrepreneurCardProps {
  entrepreneur: Entrepreneur;
}

export function EntrepreneurCard({ entrepreneur }: EntrepreneurCardProps) {
  return (
    <Link href={`/emprendedor/${entrepreneur.id}`} className="block group">
      <Card className="overflow-hidden border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl">
        <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
          <Image
            src={entrepreneur.imageUrl}
            alt={entrepreneur.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            data-ai-hint="business photo"
          />
          {/* Badge de rubro minimalista sobre la imagen */}
          <div className="absolute top-2 left-2">
            <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-[8px] font-bold text-[#8dc63f] uppercase tracking-tighter border border-[#8dc63f]/20">
              {entrepreneur.category}
            </div>
          </div>
        </div>
        <CardContent className="p-3 text-center bg-white border-t border-slate-50">
          <h3 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-[#8dc63f] transition-colors">
            {entrepreneur.name}
          </h3>
        </CardContent>
      </Card>
    </Link>
  );
}
