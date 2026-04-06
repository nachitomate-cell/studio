
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
      <Card className="overflow-hidden border-none bg-white shadow-sm hover:shadow-md transition-shadow duration-300 rounded-xl">
        <div className="relative aspect-square w-full overflow-hidden">
          <Image
            src={entrepreneur.imageUrl}
            alt={entrepreneur.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            data-ai-hint="business photo"
          />
        </div>
        <CardContent className="p-3 text-center">
          <h3 className="text-sm font-bold text-foreground line-clamp-1">
            {entrepreneur.name}
          </h3>
          <p className="text-[10px] text-muted-foreground uppercase font-medium mt-0.5">
            {entrepreneur.category}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
