export interface ApiResponse<D = unknown, E = unknown> {
	status: "success" | "error"
	message: string
	data?: D
	errors?: E
}
