export interface ApiResponse<D = unknown, E = unknown> {
	status: "success" | "error" | "ignore"
	message: string
	data?: D
	errors?: E
}
