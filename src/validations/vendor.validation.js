import { z } from 'zod';
import { REGEX } from '../constants.js';

const signupStep1 = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }).email('Invalid email address').lowercase().trim(),
    phoneNumber: z.string({ required_error: 'Phone number is required' }).regex(REGEX.PHONE, 'Invalid phone number'),
    password: z.string({ required_error: 'Password is required' }).min(8).regex(REGEX.PASSWORD, 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
    confirmPassword: z.string({ required_error: 'Please confirm your password' }),
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
});

const signupStep2 = z.object({
  body: z.object({
    firstName: z.string({ required_error: 'First name is required' }).min(2).max(50).trim(),
    lastName: z.string({ required_error: 'Last name is required' }).min(2).max(50).trim(),
    businessName: z.string({ required_error: 'Business name is required' }).min(2).trim(),
    businessAddress: z.string({ required_error: 'Business address is required' }).min(5).trim(),
    termsAndConditions: z.boolean().refine(val => val === true, {
      message: 'You must agree to the terms and conditions',
    }),
    
    // Optional Sections
    businessTin: z.object({
      number: z.string().optional(),
      expiryDate: z.string().optional(),
    }).optional(),

    taxAndLegal: z.object({
      gstNumber: z.string({ required_error: 'GST number is required if tax section is provided' }),
      panNumber: z.string({ required_error: 'PAN number is required if tax section is provided' }),
      taxRegistrationNumber: z.string({ required_error: 'Tax registration number is required if tax section is provided' }),
    }).optional(),
  }),
});

const login = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required' }).email('Invalid email address').lowercase().trim(),
    password: z.string({ required_error: 'Password is required' }).min(8),
  }),
});

const updateProfile = z.object({
  body: z.object({
    firstName: z.string().min(2).max(50).trim().optional(),
    lastName: z.string().min(2).max(50).trim().optional(),
    phoneNumber: z.string().regex(REGEX.PHONE, 'Invalid phone number').optional(),
    businessName: z.string().min(2).trim().optional(),
    businessAddress: z.string().min(5).trim().optional(),
    
    // Optional Sections
    businessTin: z.object({
      number: z.string().optional(),
      expiryDate: z.string().optional(),
    }).optional(),

    taxAndLegal: z.object({
      gstNumber: z.string().optional(),
      panNumber: z.string().optional(),
      taxRegistrationNumber: z.string().optional(),
    }).optional(),
    
    // Note: Email is intentionally excluded to make it read-only
  }),
});

const updateBankDetails = z.object({
  body: z.object({
    bankName: z.string({ required_error: 'Bank name is required' }).min(2).trim(),
    accountHolderName: z.string({ required_error: 'Account holder name is required' }).min(2).trim(),
    accountNumber: z.string({ required_error: 'Account number is required' }).min(8).trim(),
    ifscCode: z.string({ required_error: 'IFSC code is required' }).regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code').trim(),
  }),
});

const adminCreateVendor = z.object({
  body: z.object({
    // Compulsory Fields
    email: z.string({ required_error: 'Email is required' }).email('Invalid email address').lowercase().trim(),
    phoneNumber: z.string({ required_error: 'Phone number is required' }).regex(REGEX.PHONE, 'Invalid phone number'),
    password: z.string({ required_error: 'Password is required' }).min(8, 'Password must be at least 8 characters'),
    firstName: z.string({ required_error: 'First name is required' }).min(2).max(50).trim(),
    lastName: z.string({ required_error: 'Last name is required' }).min(2).max(50).trim(),

    // Optional Business Fields
    businessName: z.string().min(2).trim().optional(),
    businessAddress: z.string().min(5).trim().optional(),
    businessDescription: z.string().optional(),
    
    // Optional Business TIN
    businessTin: z.object({
      number: z.string().optional(),
      expiryDate: z.string().optional(),
    }).optional(),

    // Optional Tax & Legal
    taxAndLegal: z.object({
      gstNumber: z.string().optional(),
      panNumber: z.string().optional(),
      taxRegistrationNumber: z.string().optional(),
    }).optional(),

    // Optional Bank Details
    bankDetails: z.object({
      bankName: z.string().optional(),
      accountHolderName: z.string().optional(),
      accountNumber: z.string().optional(),
      ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code').optional(),
    }).optional(),
  }),
});

const updatePassword = z.object({
  body: z.object({
    newPassword: z.string({ required_error: 'New password is required' }).min(8).regex(REGEX.PASSWORD, 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
    confirmPassword: z.string({ required_error: 'Please confirm your new password' }),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  }),
});

export default {
  signupStep1,
  signupStep2,
  login,
  updateProfile,
  updateBankDetails,
  adminCreateVendor,
  updatePassword,
};
