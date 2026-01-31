import { z } from 'zod';

export const updateSocialMediaChatSchema = z.object({
  body: z.object({
    value: z.string().min(1, 'Value is required').optional(),
    isActive: z.boolean().optional(),
  }),
});

export default {
  updateSocialMediaChatSchema,
};
