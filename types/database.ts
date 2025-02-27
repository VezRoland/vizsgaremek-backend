export type UserRole = "employee" | "leader" | "owner" | "admin"

export interface Ticket {
  id: string,
  title: string,
  content: string,
  closed: boolean,
  userId: string,
  companyId: string,
  created_at: string
}