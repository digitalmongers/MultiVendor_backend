import { z } from 'zod';

export const updateGoogleMapSchema = z.object({
  body: z.object({
    isActive: z.boolean().optional(),
    config: z.object({
      clientKey: z.string().min(1).optional(),
      serverKey: z.string().min(1).optional(),
    }).optional(),
  }),
});

export default {
  updateGoogleMapSchema,
};
