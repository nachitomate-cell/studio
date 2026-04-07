/**
 * @fileOverview Definición de errores personalizados para Firestore.
 */

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;
  
  constructor(context: SecurityRuleContext) {
    const message = `Firestore: Permisos insuficientes en [${context.operation}] -> ${context.path}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
  }
}
