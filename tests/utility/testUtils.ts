import type { User } from '@supabase/supabase-js';
import { UserRole } from '../../types/database';

export const MOCK_OWNER_ID = '2a8595e8-f182-4a95-89db-6cb54e68649f';
export const MOCK_EMPLOYEE_ID = 'f0744a3b-71d4-4d96-9e70-b2f3d4acb727';
export const MOCK_COMPANY_ID = '1504096a-8db2-40f2-8a65-8b342adb7dd8';

export const createMockUser = (role: UserRole, userId: string, companyId: string | null): User => ({
	id: userId,
	app_metadata: {},
	user_metadata: {
		role: role,
		company_id: companyId,
		name: `Mock ${UserRole[role]} ${userId.substring(0, 5)}`,
		verified: true,
		created_at: new Date().toISOString(),
		age: 30,
		hourly_wage: (role === UserRole.Employee) ? 20 : undefined,
		avatar_url: null,
	},
	aud: 'authenticated',
	created_at: new Date().toISOString(),
	email: `${userId}@test.com`,
});

export const mockOwnerUser = createMockUser(UserRole.Owner, MOCK_OWNER_ID, MOCK_COMPANY_ID);
export const mockEmployeeUser = createMockUser(UserRole.Employee, MOCK_EMPLOYEE_ID, MOCK_COMPANY_ID);