import { z } from 'zod';

export const updateSystemSettingSchema = z.object({
  body: z.object({
    appName: z.string().min(1, 'App name is required').max(100).optional(),
    appDebug: z.boolean().optional(),
    appMode: z.enum(['Live', 'Dev', 'Maintenance']).optional(),
    appUrl: z.string().url('Invalid App URL').optional(),
  })
});
