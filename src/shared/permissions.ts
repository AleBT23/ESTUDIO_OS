export type Role = "owner" | "admin" | "collaborator" | "reader";
export function canManageCommercial(role: Role) {
  return role === "owner" || role === "admin";
}
export function canReadFinance(role: Role) {
  return role === "owner" || role === "admin";
}
export function canWriteProject(role: Role) {
  return role === "owner" || role === "admin" || role === "collaborator";
}
