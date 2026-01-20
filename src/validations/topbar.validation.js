import { z } from 'zod';

export const saveTopbarSchema = z.object({
  body: z.object({
    bgColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid background color format'),
    textColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid text color format'),
    text: z.string().min(1, 'Text is required'),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});
