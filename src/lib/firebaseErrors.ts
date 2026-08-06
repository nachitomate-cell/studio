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

  // ── Errores que NO son de Auth ─────────────────────────────────────────────
  // El registro crea la cuenta y después escribe en Firestore. Si esa escritura
  // falla, el error que llega acá no tiene prefijo "auth/" y antes caía todo en
  // el mensaje genérico: el cliente veía "error inesperado" y nadie podía saber
  // qué pasó. Ocurrió de verdad — una regla rechazaba el saldo inicial y dejó
  // el registro caído sin ninguna señal de por qué.
  "permission-denied": "No pudimos guardar tu cuenta por una restricción del sistema. Avísanos y lo corregimos.",
  "unavailable": "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
  "deadline-exceeded": "La conexión tardó demasiado. Inténtalo de nuevo.",
  "resource-exhausted": "El servicio está saturado en este momento. Inténtalo en unos minutos.",
  "unauthenticated": "Tu sesión expiró. Vuelve a intentarlo.",
  "storage/unauthorized": "No tienes permiso para subir ese archivo.",
  "storage/retry-limit-exceeded": "La subida falló por la conexión. Inténtalo de nuevo.",
};

/**
 * Mensaje para el usuario. El código crudo se agrega entre paréntesis cuando no
 * lo conocemos: es feo, pero es la diferencia entre que alguien reporte "me dio
 * error" y que reporte algo accionable. Un error que no se puede diagnosticar
 * cuesta más que uno con un paréntesis raro.
 */
export function getFriendlyErrorMessage(error: any): string {
  const code = typeof error?.code === "string" ? error.code : "";
  const conocido = AUTH_ERROR_MESSAGES[code];
  if (conocido) return conocido;

  // Se registra en consola para que quede en los logs del navegador.
  if (typeof console !== "undefined") {
    console.error("[error sin mapear]", code || "(sin código)", error?.message ?? error);
  }

  const pista = code ? ` (${code})` : "";
  return `Ocurrió un error inesperado. Por favor, inténtalo de nuevo${pista}.`;
}
