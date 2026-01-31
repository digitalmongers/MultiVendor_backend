import { z } from 'zod';

export const updateSmsGatewaySchema = z.object({
  body: z.object({
    isActive: z.boolean().optional(),
    config: z.object({
      apiKey: z.string().min(1).optional(),
      sid: z.string().min(1).optional(),
      token: z.string().min(1).optional(),
      messagingServiceSid: z.string().min(1).optional(),
      from: z.string().optional(),
      otpTemplate: z.string().optional(),
    }).optional(),
  }),
});

export default {
  updateSmsGatewaySchema,
};
