
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
      <Card className="overflow-hidden border border-slate-100 bg-white shadow-md hover:shadow-xl transition-all duration-300 rounded-[24px] group-hover:-translate-y-0.5">
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
          {/* Badge de rubro */}
          {entrepreneur.category && (
            <div
              className="absolute"
              style={{ top: "10px", left: "10px" }}
            >
              <span
                style={{
                  background: "rgba(0,0,0,0.55)",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "20px",
                  padding: "4px 10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "inline-block",
                }}
              >
                {entrepreneur.category}
              </span>
            </div>
          )}
        </div>
        <CardContent className="p-3 text-center bg-white border-t border-slate-50">
          <h3 className="text-xs font-bold text-[#4A4A4A] line-clamp-1 group-hover:text-[#C9920A] transition-colors">
            {entrepreneur.name}
          </h3>
        </CardContent>
      </Card>
    </Link>
  );
}
