/**
 * Helpers para el sistema de roles híbrido.
 * Soporta tanto `rol` (string legacy) como `roles` (array nuevo).
 */

export const hasRole = (userData: any, role: string): boolean => {
  if (!userData) return false;
  if (Array.isArray(userData.roles) && userData.roles.length > 0) {
    return userData.roles.includes(role);
  }
  return userData.rol === role;
};

export const getUserRoles = (userData: any): string[] => {
  if (!userData) return ["cliente"];
  if (Array.isArray(userData.roles) && userData.roles.length > 0) return userData.roles;
  if (userData.rol) return [userData.rol];
  return ["cliente"];
};
