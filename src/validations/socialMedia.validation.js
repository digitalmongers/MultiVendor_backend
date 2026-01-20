import { z } from 'zod';

export const saveSocialMediaSchema = z.object({
  body: z.object({
    platform: z.enum(['Facebook', 'Instagram', 'YouTube', 'LinkedIn', 'X']),
    link: z.string().url('Invalid URL format'),
    status: z.boolean().optional(),
  }),
});

export const updateSocialMediaSchema = z.object({
  body: z.object({
    platform: z.enum(['Facebook', 'Instagram', 'YouTube', 'LinkedIn', 'X']).optional(),
    link: z.string().url('Invalid URL format').optional(),
    status: z.boolean().optional(),
  }),
});
