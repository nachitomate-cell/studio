"use client";

/**
 * @fileOverview Componente que escucha y muestra errores de permisos de Firestore.
 */

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = errorEmitter.on('permission-error', (error: FirestorePermissionError) => {
      console.error('🔥 Error de Seguridad Firestore:', error.context);
      
      toast({
        variant: "destructive",
        title: "Error de Seguridad",
        description: `No tienes permisos para realizar la operación [${error.context.operation}] en ${error.context.path}.`,
      });
    });

    return () => unsubscribe();
  }, [toast]);

  return null;
}
