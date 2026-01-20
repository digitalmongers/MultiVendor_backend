import { z } from 'zod';

export const createTrustedBySchema = z.object({
  body: z.object({
    image: z.object({
      url: z.string().url(),
      publicId: z.string().min(1),
    }),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

export const updateTrustedBySchema = z.object({
  body: z.object({
    image: z.object({
      url: z.string().url(),
      publicId: z.string().min(1),
    }).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});
