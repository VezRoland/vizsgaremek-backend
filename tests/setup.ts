import {vi} from "vitest"
import {AuthApiError, type Session, type User} from "@supabase/supabase-js"
import {
	mockOwnerUser,
	mockEmployeeUser,
	mockLeaderUser,
	mockAdminUser,
	MOCK_NEW_USER_ID,
	MOCK_ACCESS_TOKEN,
	MOCK_REFRESH_TOKEN,
	MOCK_ACCESS_TOKEN_2,
	MOCK_REFRESH_TOKEN_2,
	TEST_OWNER_TOKEN,
	TEST_LEADER_TOKEN,
	TEST_EMPLOYEE_TOKEN,
	TEST_ADMIN_TOKEN,
	MOCK_LOGIN_EMAIL,
	MOCK_LOGIN_PASSWORD,
	MOCK_EXISTS_EMAIL,
	MOCK_OWNER_ID,
	MOCK_LEADER_ID,
	MOCK_EMPLOYEE_ID,
	MOCK_ADMIN_ID
} from "./utility/testUtils"

// --- Global Supabase Client Mock ---
vi.mock("../lib/supabase", () => {
	const mockGetUser = vi.fn().mockImplementation(async (token: string | undefined) => {
		if (!token) {
			return {data: {user: null}, error: new AuthApiError("No token provided to getUser", 401, undefined)}
		}
		if (token === TEST_OWNER_TOKEN) return {data: {user: mockOwnerUser}, error: null}
		if (token === TEST_EMPLOYEE_TOKEN) return {data: {user: mockEmployeeUser}, error: null}
		if (token === TEST_LEADER_TOKEN) return {data: {user: mockLeaderUser}, error: null}
		if (token === TEST_ADMIN_TOKEN) return {data: {user: mockAdminUser}, error: null}
		if (token === MOCK_ACCESS_TOKEN) return {data: {user: mockEmployeeUser}, error: null}
		if (token === MOCK_ACCESS_TOKEN_2) return {data: {user: mockEmployeeUser}, error: null}

		return {data: {user: null}, error: new AuthApiError("Mock: Invalid token for getUser", 401, undefined)}
	})

	const mockSignInWithPassword = vi.fn().mockImplementation(async ({email, password}) => {
		if (email === MOCK_LOGIN_EMAIL && password === MOCK_LOGIN_PASSWORD) {
			const now = Math.floor(Date.now() / 1000)
			const sessionData: Session = {
				access_token: MOCK_ACCESS_TOKEN,
				refresh_token: MOCK_REFRESH_TOKEN,
				user: mockEmployeeUser,
				expires_in: 3600,
				expires_at: now + 3600,
				token_type: "bearer"
			}
			return {data: {session: sessionData, user: mockEmployeeUser}, error: null}
		} else {
			return {
				data: {session: null, user: null},
				error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials")
			}
		}
	})

	const mockAdminCreateUser = vi.fn().mockImplementation(async ({email, password, user_metadata}) => {
		if (email === MOCK_EXISTS_EMAIL) {
			return {
				data: {user: null},
				error: new AuthApiError("User already registered", 422, "email_exists")
			}
		} else {
			const newUser: Partial<User> = {
				id: MOCK_NEW_USER_ID,
				email: email,
				app_metadata: {provider: "email", providers: ["email"]},
				user_metadata: user_metadata,
				aud: "authenticated"
			}
			return {data: {user: newUser as User}, error: null}
		}
	})

	const mockAdminSignOut = vi.fn().mockResolvedValue({error: null})

	const mockRefreshSession = vi.fn().mockImplementation(async (args) => {
		const providedRefreshToken = args?.refresh_token
		if (providedRefreshToken === MOCK_REFRESH_TOKEN) {
			const now = Math.floor(Date.now() / 1000)
			const newSessionData: Session = {
				access_token: MOCK_ACCESS_TOKEN_2,
				refresh_token: MOCK_REFRESH_TOKEN_2,
				user: mockEmployeeUser,
				expires_in: 3600,
				expires_at: now + 3600,
				token_type: "bearer"
			}
			return {data: {session: newSessionData, user: mockEmployeeUser}, error: null}
		} else {
			return {data: {session: null, user: null}, error: new AuthApiError("Invalid refresh token", 401, undefined)}
		}
	})

	const mockAdminUpdateUserById = vi.fn().mockImplementation(async (userId, {user_metadata}) => {
		let baseUser: User | null = null
		if (userId === MOCK_OWNER_ID) baseUser = mockOwnerUser
		else if (userId === MOCK_LEADER_ID) baseUser = mockLeaderUser
		else if (userId === MOCK_EMPLOYEE_ID) baseUser = mockEmployeeUser
		else if (userId === MOCK_ADMIN_ID) baseUser = mockAdminUser

		if (!baseUser) {
			return {data: {user: null}, error: new AuthApiError("User not found", 404, "user_not_found")}
		}

		const updatedUser = JSON.parse(JSON.stringify(baseUser)) as User
		updatedUser.user_metadata = {
			...updatedUser.user_metadata,
			...user_metadata
		}
		updatedUser.updated_at = new Date().toISOString()

		return {data: {user: updatedUser}, error: null}
	})

	const mockStorageFrom = vi.fn(() => ({
		upload: vi.fn().mockResolvedValue({data: {path: "mock/path.jpg"}, error: null}),
		remove: vi.fn().mockResolvedValue({data: [{ /* a */}], error: null}),
		getPublicUrl: vi.fn().mockImplementation((pathInBucket) => ({
			data: {publicUrl: `https://mock.supabase.co/storage/v1/object/public/avatars/${pathInBucket}`},
			error: null
		})),
		createSignedUrl: vi.fn().mockResolvedValue({data: {signedUrl: "http://urlmockurl.com/signed"}, error: null})
	}))

	return {
		supabase: {
			auth: {
				getUser: mockGetUser,
				signInWithPassword: mockSignInWithPassword,
				refreshSession: mockRefreshSession,
				admin: {
					createUser: mockAdminCreateUser,
					signOut: mockAdminSignOut,
					updateUserById: mockAdminUpdateUserById
				}
			},
			storage: {from: mockStorageFrom}
		}
	}
})

console.log("Vitest global setup (tests/setup.ts) executed.")