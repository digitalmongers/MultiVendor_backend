import { z } from 'zod';

/**
 * Payment Gateway Validation Schema
 * Ensures data integrity and security for gateway configurations.
 */
export const updateGatewaySchema = z.object({
  body: z.object({
    title: z.string().min(2, 'Title must be at least 2 characters').max(50).optional(),
    logo: z.string().url('Logo must be a valid URL').optional().or(z.literal('')),
    isActive: z.boolean().optional(),
    config: z.object({
      apiKey: z.string().min(1).optional(),
      apiSecret: z.string().min(1).optional(),
      webhookSecret: z.string().min(1).optional(),
      clientId: z.string().min(1).optional(),
    }).optional(),
  }),
});

export default {
  updateGatewaySchema,
};
