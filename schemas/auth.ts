import { object, string } from "zod"

export const signUpSchema = object({
	name: string()
		.min(1, "Adja meg teljes nevét")
		.max(150, "Legfeljebb 150 karakteres nevet adhat meg"),
	email: string()
		.min(1, "Adja meg email címét")
		.email("Adjon meg egy érvényes email címet"),
	password: string()
		.min(1, "Adja meg jelszavát")
		.min(8, "Legalább 8 karakterből álló jelszót adjon meg")
})

export const signUpEmployeeSchema = signUpSchema.extend({
	code: string().length(8, "Adja meg a 8 karakterből álló kódot")
})
