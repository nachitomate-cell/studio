interface UserLike {
  roles?: string[];
  rol?: string;
}

export const hasRole = (userData: UserLike | null | undefined, role: string): boolean => {
  if (!userData) return false;
  if (Array.isArray(userData.roles) && userData.roles.length > 0) {
    return userData.roles.includes(role);
  }
  return userData.rol === role;
};

export const getUserRoles = (userData: UserLike | null | undefined): string[] => {
  if (!userData) return ["cliente"];
  if (Array.isArray(userData.roles) && userData.roles.length > 0) return userData.roles;
  if (userData.rol) return [userData.rol];
  return ["cliente"];
};
