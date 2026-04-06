
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Save, Trash2, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EntrepreneurFormProps {
  onBack: () => void;
}

export function EntrepreneurForm({ onBack }: EntrepreneurFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "Perfil Actualizado",
        description: "Los datos de tu emprendimiento han sido guardados correctamente.",
      });
      onBack();
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-primary">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h2 className="text-2xl font-bold text-primary">Mi Emprendimiento</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Información del Negocio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center mb-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-primary/30">
                  <Camera className="w-8 h-8 text-primary/40" />
                </div>
                <button className="absolute -bottom-2 -right-2 bg-primary text-white p-2 rounded-full shadow-lg">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Emprendimiento</Label>
              <Input id="name" defaultValue="Sabores del Patio" required className="rounded-xl" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea 
                id="description" 
                defaultValue="Comida casera con ingredientes orgánicos de la zona. Especialistas en empanadas y jugos naturales."
                className="min-h-[100px] rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Rubro</Label>
                <Input id="category" defaultValue="Gastronomía" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Ubicación (ID)</Label>
                <Input id="location" defaultValue="Sector Norte" className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact">WhatsApp de Contacto</Label>
              <Input id="contact" defaultValue="+56 9 1234 5678" className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule">Horarios de Atención</Label>
              <Input id="schedule" defaultValue="Lun-Vie 10:00 - 19:00" className="rounded-xl" />
            </div>
          </CardContent>
          <CardFooter className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 rounded-xl h-12 gap-2" disabled={loading}>
              <Save className="w-4 h-4" />
              {loading ? "Guardando..." : "Guardar Cambios"}
            </Button>
            <Button type="button" variant="ghost" className="text-destructive h-12 w-12 p-0 rounded-xl bg-destructive/5 hover:bg-destructive/10">
              <Trash2 className="w-5 h-5" />
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
