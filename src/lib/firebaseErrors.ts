/**
 * Traduce los códigos de error de Firebase Auth a mensajes amigables en español.
 * Úsalo en los bloques catch: setError(getFriendlyErrorMessage(error)).
 */

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/user-not-found": "No encontramos ninguna cuenta registrada con este correo.",
  "auth/wrong-password": "La contraseña es incorrecta. Inténtalo de nuevo.",
  // Firebase usa este ahora en lugar de user-not-found/wrong-password (por seguridad).
  "auth/invalid-credential": "El correo o la contraseña son incorrectos.",
  "auth/invalid-email": "El formato del correo electrónico no es válido.",
  "auth/email-already-in-use": "Este correo ya está registrado. Por favor, inicia sesión.",
  "auth/weak-password": "La contraseña es muy débil. Debe tener al menos 6 caracteres.",
  "auth/too-many-requests": "Demasiados intentos fallidos. Por seguridad, intenta de nuevo más tarde.",
  "auth/network-request-failed": "Error de conexión. Por favor, revisa tu internet.",
  // Extras comunes (mejoran la UX sin cambiar el comportamiento):
  "auth/missing-password": "Ingresa tu contraseña.",
  "auth/missing-email": "Ingresa tu correo electrónico.",
  "auth/user-disabled": "Esta cuenta ha sido deshabilitada. Contacta a soporte.",
  "auth/popup-closed-by-user": "Cerraste la ventana antes de completar el acceso.",
  "auth/operation-not-allowed": "Este método de acceso no está habilitado.",
};

export function getFriendlyErrorMessage(error: any): string {
  const code = typeof error?.code === "string" ? error.code : "";
  return AUTH_ERROR_MESSAGES[code] ?? "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.";
}
