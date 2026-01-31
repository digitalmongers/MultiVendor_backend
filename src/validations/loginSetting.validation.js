import { z } from 'zod';

export const updateLoginSettingSchema = z.object({
  body: z.object({
    maxOtpHit: z.number().int().min(1).optional(),
    otpResendTime: z.number().int().min(1).optional(),
    temporaryBlockTime: z.number().int().min(1).optional(),
    maxLoginHit: z.number().int().min(1).optional(),
    temporaryLoginBlockTime: z.number().int().min(1).optional(),
  }),
});

export default {
  updateLoginSettingSchema,
};
