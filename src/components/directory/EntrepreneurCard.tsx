
"use client";

import Image from "next/image";
import { Entrepreneur } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Phone, MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EntrepreneurCardProps {
  entrepreneur: Entrepreneur;
}

export function EntrepreneurCard({ entrepreneur }: EntrepreneurCardProps) {
  return (
    <Card className="overflow-hidden group hover:shadow-md transition-all duration-300 border-border/50 bg-white">
      <div className="relative h-48 w-full overflow-hidden">
        <Image
          src={entrepreneur.imageUrl}
          alt={entrepreneur.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          data-ai-hint="business photo"
        />
        <Badge className="absolute top-3 right-3 bg-white/90 text-primary hover:bg-white backdrop-blur-sm border-none font-bold">
          {entrepreneur.category.toUpperCase()}
        </Badge>
      </div>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xl font-bold text-primary group-hover:text-primary/80 transition-colors">
          {entrepreneur.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {entrepreneur.description}
        </p>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4 text-accent-foreground" />
            <span>{entrepreneur.schedule}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-4 h-4 text-accent-foreground" />
            <span>{entrepreneur.contact}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4 text-accent-foreground" />
            <span>{entrepreneur.locationId}</span>
          </div>
        </div>

        <Link href={`/emprendedor/${entrepreneur.id}`} className="block w-full mt-2">
          <Button variant="outline" className="w-full gap-2 border-primary/20 text-primary hover:bg-primary/5">
            <ExternalLink className="w-4 h-4" />
            Ver Perfil Completo
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
