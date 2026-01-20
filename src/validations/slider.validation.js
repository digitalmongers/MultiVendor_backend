import { z } from 'zod';

export const createSliderSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    subtitle: z.string().optional().or(z.literal('')),
    buttonText: z.string().optional().or(z.literal('')),
    buttonUrl: z.string().url().optional().or(z.literal('')),
    image: z.object({
      url: z.string().url(),
      publicId: z.string().min(1),
    }),
    published: z.boolean().optional(),
  }),
});

export const updateSliderSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    subtitle: z.string().optional().or(z.literal('')),
    buttonText: z.string().optional().or(z.literal('')),
    buttonUrl: z.string().url().optional().or(z.literal('')),
    image: z.object({
      url: z.string().url(),
      publicId: z.string().min(1),
    }).optional(),
    published: z.boolean().optional(),
  }),
});
