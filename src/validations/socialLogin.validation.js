import { z } from 'zod';

export const updateSocialLoginSchema = z.object({
  body: z.object({
    isActive: z.boolean().optional(),
    config: z.object({
      callbackUrl: z.string().url().optional().or(z.literal('')),
      clientId: z.string().min(1).optional(),
      clientSecret: z.string().min(1).optional(),
      teamId: z.string().min(1).optional(),
      keyId: z.string().min(1).optional(),
    }).optional(),
  }),
});

export default {
  updateSocialLoginSchema,
};
