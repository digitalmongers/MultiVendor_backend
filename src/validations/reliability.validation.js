import { z } from 'zod';

export const saveReliabilitySchema = z.object({
  body: z.object({
    key: z.enum(['delivery', 'payment', 'return', 'product']),
    title: z.string().min(1, 'Title is required'),
    image: z.object({
      url: z.string().url(),
      publicId: z.string().min(1),
    }),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});
