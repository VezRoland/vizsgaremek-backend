import type {User} from "@supabase/supabase-js"
import {UserRole} from "../../types/database"

export const MOCK_OWNER_ID = "2a8595e8-f182-4a95-89db-6cb54e68649f"
export const MOCK_EMPLOYEE_ID = "f0744a3b-71d4-4d96-9e70-b2f3d4acb727"
export const MOCK_COMPANY_ID = "1504096a-8db2-40f2-8a65-8b342adb7dd8"
export const MOCK_LEADER_ID = "c1a9b0d2-e3f4-4a5b-8c6d-7e8f9a0b1c2d"
export const MOCK_UNDER18_EMPLOYEE_ID = "e5b1c4d0-a2b3-4c5d-8e6f-7a8b9c0d1e2f"
export const MOCK_ADMIN_ID = "a1b2c3d4-e5f6-4a5b-8c6d-9a8b7c6d5e4f"
export const MOCK_NEW_USER_ID = "ba7fc46e-95b2-4cd5-ad54-739bee523839"
export const MOCK_OTHER_COMPANY_ID = "a9b8c7d6-e5f4-a3b2-c1d0-e9f8a7b6c5d4";
export const MOCK_UNVERIFIED_EMPLOYEE_ID = "b1c2d3e4-f5a6-b7c8-d9e0-a1b2c3d4e5f6";
export const MOCK_OTHER_EMPLOYEE_ID = "c3d4e5f6-a1b2-c3d4-e5f6-a1b2c3d4e5f6";
export const MOCK_SECOND_OWNER_ID = "d4e5f6a1-b2c3-d4e5-f6a1-b2c3d4e5f6a1"; // For testing owner updates owner

export const MOCK_ACCESS_TOKEN = "MOCK_ACCESS_TOKEN_FROM_LOGIN"
export const MOCK_REFRESH_TOKEN = "MOCK_REFRESH_TOKEN_FROM_LOGIN"
export const MOCK_ACCESS_TOKEN_2 = "MOCK_ACCESS_TOKEN_AFTER_REFRESH"
export const MOCK_REFRESH_TOKEN_2 = "MOCK_REFRESH_TOKEN_AFTER_REFRESH"
export const TEST_OWNER_TOKEN = "TEST_OWNER_TOKEN"
export const TEST_LEADER_TOKEN = "TEST_LEADER_TOKEN"
export const TEST_EMPLOYEE_TOKEN = "TEST_EMPLOYEE_TOKEN"
export const TEST_ADMIN_TOKEN = "TEST_ADMIN_TOKEN"

export const MOCK_LOGIN_EMAIL = "employee@test.com"
export const MOCK_LOGIN_PASSWORD = "password123"
export const MOCK_EXISTS_EMAIL = "exists@test.com"

const userNames: Record<string, string> = {
	[MOCK_OWNER_ID]: "Seed Owner",
	[MOCK_LEADER_ID]: "Seed Leader",
	[MOCK_EMPLOYEE_ID]: "Seed Employee",
	[MOCK_ADMIN_ID]: "Seed Admin",
	[MOCK_SECOND_OWNER_ID]: "Second Owner",
	[MOCK_UNVERIFIED_EMPLOYEE_ID]: "Unverified Employee",
	[MOCK_OTHER_EMPLOYEE_ID]: "Other Employee",
};

export const createMockUser = (role: UserRole, userId: string, companyId: string | null): User => ({
	id: userId,
	app_metadata: {},
	user_metadata: {
		role: role,
		company_id: companyId,
		name: userNames[userId] || `Mock User ${userId.substring(0, 5)}`,
		verified: true,
		created_at: new Date().toISOString(),
		age: (role === UserRole.Admin) ? 40 : 30,
		hourly_wage: (role === UserRole.Employee) ? 20 : undefined,
		avatar_url: null
	},
	aud: "authenticated",
	created_at: new Date().toISOString(),
	email: `${userId}@test.com`,
	updated_at: new Date().toISOString()
})

export const mockOwnerUser = createMockUser(UserRole.Owner, MOCK_OWNER_ID, MOCK_COMPANY_ID)
export const mockEmployeeUser = createMockUser(UserRole.Employee, MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID)
export const mockLeaderUser = createMockUser(UserRole.Leader, MOCK_LEADER_ID, MOCK_COMPANY_ID)
export const mockAdminUser = createMockUser(UserRole.Admin, MOCK_ADMIN_ID, null)