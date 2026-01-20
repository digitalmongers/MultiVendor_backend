import { z } from 'zod';
import { BANNER_TYPES, RESOURCE_TYPES } from '../constants.js';

export const createBannerSchema = z.object({
  body: z.object({
    bannerType: z.enum(Object.values(BANNER_TYPES)),
    bannerUrl: z.string().url().optional().or(z.literal('')),
    resourceType: z.enum(Object.values(RESOURCE_TYPES)),
    image: z.object({
      url: z.string().url(),
      publicId: z.string().min(1),
    }),
    published: z.boolean().optional(),
  }),
});

export const updateBannerSchema = z.object({
  body: z.object({
    bannerType: z.enum(Object.values(BANNER_TYPES)).optional(),
    bannerUrl: z.string().url().optional().or(z.literal('')),
    resourceType: z.enum(Object.values(RESOURCE_TYPES)).optional(),
    image: z.object({
      url: z.string().url(),
      publicId: z.string().min(1),
    }).optional(),
    published: z.boolean().optional(),
  }),
});
