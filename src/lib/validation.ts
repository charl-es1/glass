import { z } from 'zod';

export const logoSchema = z.object({
  url: z.string().min(1, "URL is required"),
  storagePath: z.string().min(1, "Storage path is required"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const systemSettingsSchema = z.object({
  siteTitle: z.string()
    .min(3, "Site Title must be at least 3 characters")
    .max(100, "Site Title must be at most 100 characters"),
  email: z.string()
    .email("Please enter a valid email address"),
  phone: z.string()
    .regex(/^\+?[1-9][0-9\s\-()]{5,18}$/, "Please enter a valid international phone number (e.g. +233 24 123 4567)"),
  country: z.string()
    .min(2, "Country is required"),
  defaultLanguage: z.string()
    .min(2, "Default Language is required"),
  address: z.string()
    .min(10, "Address must be at least 10 characters")
    .max(250, "Address must be at most 250 characters"),
  headerLogo: logoSchema.nullable(),
  footerLogo: logoSchema.nullable(),
  favicon: logoSchema.nullable(),
});
