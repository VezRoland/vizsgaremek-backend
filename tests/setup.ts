import { vi } from "vitest"
import { mockOwnerUser, mockEmployeeUser } from "./utility/testUtils"

// --- Global Supabase Client Mock ---
vi.mock("../backend/lib/supabase", () => {
	const mockGetUser = vi.fn()
	const mockStorageFrom = vi.fn(() => ({
		upload: vi.fn().mockResolvedValue({ data: { path: "mock/path.jpg" }, error: null }),
		createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "http://urlmockurl.com/signed" }, error: null })
	}))

	mockGetUser.mockImplementation(async (token: string) => {
		if (token === "TEST_OWNER_TOKEN") {
			return { data: { user: mockOwnerUser }, error: null }
		}
		if (token === "TEST_EMPLOYEE_TOKEN") {
			return { data: { user: mockEmployeeUser }, error: null }
		}
		return { data: { user: null }, error: { message: "Mock: Invalid token", status: 401 } }
	})

	return {
		supabase: {
			auth: { getUser: mockGetUser },
			storage: { from: mockStorageFrom }
		}
	}
})

console.log("Vitest global setup (tests/setup.ts) executed.")