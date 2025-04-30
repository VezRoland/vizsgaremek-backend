import { vi } from "vitest"
import { AuthApiError, type User } from "@supabase/supabase-js"
import {
	mockOwnerUser,
	mockEmployeeUser,
	mockLeaderUser,
	mockAdminUser,
	MOCK_NEW_USER_ID,
	MOCK_ACCESS_TOKEN
} from "./utility/testUtils"


// --- Global Supabase Client Mock ---
vi.mock("../lib/supabase", () => {
	// --- Mock implementations ---
	const mockGetUser = vi.fn().mockImplementation(async (token: string) => {
		if (token === "TEST_OWNER_TOKEN") return { data: { user: mockOwnerUser }, error: null }
		if (token === "TEST_EMPLOYEE_TOKEN") return { data: { user: mockEmployeeUser }, error: null }
		if (token === "TEST_LEADER_TOKEN") return { data: { user: mockLeaderUser }, error: null }
		if (token === "TEST_ADMIN_TOKEN") return { data: { user: mockAdminUser }, error: null }
		if (token === MOCK_ACCESS_TOKEN) {
			return { data: { user: mockEmployeeUser }, error: null }
		}
		// Default fallback
		return { data: { user: null }, error: new AuthApiError("Mock: Invalid token", 401, undefined) }
	})

	const mockSignInWithPassword = vi.fn().mockImplementation(async ({ email, password }) => {
		// Simulate success for specific test credentials, fail for others
		if (email === "employee@test.com" && password === "password123") {
			// Simulate successful login, return mock session data
			return {
				data: {
					session: {
						access_token: MOCK_ACCESS_TOKEN,
						refresh_token: "mock-refresh-token",
						user: mockEmployeeUser,
						expires_in: 3600,
						expires_at: Math.floor(Date.now() / 1000) + 3600,
						token_type: "bearer"
					},
					user: mockEmployeeUser
				},
				error: null
			}
		} else {
			// Simulate invalid credentials
			return {
				data: { session: null, user: null },
				// Use correct Supabase error structure
				error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials")
			}
		}
	})

	const mockAdminCreateUser = vi.fn().mockImplementation(async ({ email, password, user_metadata }) => {
		// Simulate user creation success or failure
		if (email === "exists@test.com") {
			// Simulate email already exists error
			return {
				data: { user: null },
				error: new AuthApiError("User already registered", 422, "email_exists") // Use 422 based on schema
			}
		} else {
			// Simulate successful creation
			const newUser: Partial<User> = {
				id: MOCK_NEW_USER_ID,
				email: email,
				app_metadata: { provider: "email", providers: ["email"] },
				user_metadata: user_metadata,
				aud: "authenticated"
			}
			return { data: { user: newUser as User }, error: null }
		}
	})

	const mockAdminSignOut = vi.fn().mockResolvedValue({ error: null }) // Simulate successful sign out

	const mockStorageFrom = vi.fn(() => ({
		upload: vi.fn().mockResolvedValue({ data: { path: "mock/path.jpg" }, error: null }),
		createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "http://urlmockurl.com/signed" }, error: null })
	}))

	return {
		supabase: {
			auth: {
				getUser: mockGetUser,
				signInWithPassword: mockSignInWithPassword,
				admin: {
					createUser: mockAdminCreateUser,
					signOut: mockAdminSignOut
				}
			},
			storage: {
				from: mockStorageFrom
			}
		}
	}
})

console.log("Vitest global setup (tests/setup.ts) executed.")