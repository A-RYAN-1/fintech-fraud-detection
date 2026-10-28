import { z } from "zod";

export const createTransactionSchema = z.object({
  amount: z
    .number({ message: "Amount must be a number" })
    .positive("Amount must be greater than 0")
    .max(10000000, "Amount cannot exceed $10,000,000"),
  payment_method: z.enum(["card", "upi", "bank_transfer", "wallet"], {
    message: "Payment method is required",
  }),
});

export const feedbackSchema = z.object({
  is_accurate: z.boolean(),
  user_feedback: z
    .string()
    .max(500, "Feedback cannot exceed 500 characters")
    .optional(),
});

export type CreateTransactionFormData = z.infer<typeof createTransactionSchema>;
export type FeedbackFormData = z.infer<typeof feedbackSchema>;
