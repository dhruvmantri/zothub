import { z } from "zod";

// ============= Common Validators =============

// URL validation with optional empty string
const optionalUrlSchema = z.string().optional().nullable().refine(
  (val) => !val || val.trim() === "" || z.string().url().safeParse(val).success,
  { message: "Please enter a valid URL" }
).transform(val => val?.trim() || null);

// Required URL validation
const requiredUrlSchema = z.string().url({ message: "Please enter a valid URL" }).transform(val => val.trim());

// Text field with length limits
const textFieldSchema = (maxLength: number, fieldName: string) => 
  z.string()
    .max(maxLength, { message: `${fieldName} must be less than ${maxLength} characters` })
    .transform(val => val.trim());

// Required text field with length limits
const requiredTextFieldSchema = (maxLength: number, fieldName: string) => 
  z.string()
    .min(1, { message: `${fieldName} is required` })
    .max(maxLength, { message: `${fieldName} must be less than ${maxLength} characters` })
    .transform(val => val.trim());

// Date validation (must be in the future for deadlines)
const futureDateSchema = z.string().refine(
  (val) => {
    if (!val) return true; // Allow empty for optional dates
    const date = new Date(val);
    return date > new Date();
  },
  { message: "Date must be in the future" }
);

// Array of strings with length validation
const stringArraySchema = (maxItems: number, maxItemLength: number) =>
  z.array(z.string().max(maxItemLength, { message: `Each item must be less than ${maxItemLength} characters` }))
    .max(maxItems, { message: `Maximum ${maxItems} items allowed` })
    .optional()
    .transform(val => val && val.length > 0 ? val : null);

// Sanitize text to prevent XSS - removes potentially dangerous HTML/script content
export function sanitizeText(text: string): string {
  if (!text) return "";
  
  // Remove script tags and their content
  let sanitized = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  
  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
  
  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, "");
  
  // Remove data: URLs that could contain scripts
  sanitized = sanitized.replace(/data:text\/html/gi, "");
  
  return sanitized.trim();
}

// Apply sanitization to a schema
const sanitizedTextSchema = (maxLength: number, fieldName: string) =>
  z.string()
    .max(maxLength, { message: `${fieldName} must be less than ${maxLength} characters` })
    .transform(val => sanitizeText(val));

const requiredSanitizedTextSchema = (maxLength: number, fieldName: string) =>
  z.string()
    .min(1, { message: `${fieldName} is required` })
    .max(maxLength, { message: `${fieldName} must be less than ${maxLength} characters` })
    .transform(val => sanitizeText(val));

// ============= Event Validation Schema =============

export const eventSchema = z.object({
  title: requiredSanitizedTextSchema(200, "Title"),
  description: sanitizedTextSchema(5000, "Description").optional().nullable(),
  event_date: z.string().min(1, { message: "Event date is required" }).refine(
    (val) => {
      const date = new Date(val);
      return date > new Date();
    },
    { message: "Event date must be in the future" }
  ),
  location: sanitizedTextSchema(300, "Location").optional().nullable(),
  capacity: z.number()
    .int({ message: "Capacity must be a whole number" })
    .min(1, { message: "Capacity must be at least 1" })
    .max(100000, { message: "Capacity cannot exceed 100,000" })
    .optional()
    .nullable(),
  banner_url: optionalUrlSchema,
  is_active: z.boolean().default(true),
});

export type EventInput = z.infer<typeof eventSchema>;

// ============= Opportunity Validation Schema =============

const opportunityTypes = ["leadership", "project", "internship", "volunteer", "committee", "other"] as const;

const applicationQuestionSchema = z.object({
  id: z.string().max(100),
  type: z.enum(["short_text", "long_text", "single_choice", "multiple_choice"]),
  question: z.string().min(1).max(500).transform(val => sanitizeText(val)),
  required: z.boolean(),
  options: z.array(z.string().max(200).transform(val => sanitizeText(val))).max(20).optional().nullable(),
  placeholder: z.string().max(200).optional().nullable(),
});

export const opportunitySchema = z.object({
  title: requiredSanitizedTextSchema(200, "Title"),
  type: z.enum(opportunityTypes, { errorMap: () => ({ message: "Please select an opportunity type" }) }),
  description: sanitizedTextSchema(5000, "Description").optional().nullable(),
  requirements: sanitizedTextSchema(3000, "Requirements").optional().nullable(),
  deadline: futureDateSchema.optional().nullable(),
  is_active: z.boolean().default(true),
  application_questions: z.array(applicationQuestionSchema).max(50, { message: "Maximum 50 questions allowed" }).optional(),
});

export type OpportunityInput = z.infer<typeof opportunitySchema>;

// ============= Application Submission Schema =============

const applicationAnswerSchema = z.object({
  question_id: z.string().max(100),
  question: z.string().max(500).transform(val => sanitizeText(val)),
  answer: z.union([
    z.string().max(10000).transform(val => sanitizeText(val)),
    z.array(z.string().max(500).transform(val => sanitizeText(val))).max(20),
  ]),
});

export const applicationSchema = z.object({
  opportunity_id: z.string().uuid({ message: "Invalid opportunity" }),
  answers: z.array(applicationAnswerSchema).max(50),
  resume_url: optionalUrlSchema,
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

// ============= Student Profile Schema =============

const yearOptions = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate", "PhD"] as const;

export const studentProfileSchema = z.object({
  full_name: sanitizedTextSchema(100, "Full name").optional().nullable(),
  major: sanitizedTextSchema(100, "Major").optional().nullable(),
  year: z.enum(yearOptions).optional().nullable(),
  graduation_date: z.string().optional().nullable().refine(
    (val) => {
      if (!val) return true;
      const date = new Date(val);
      return !isNaN(date.getTime());
    },
    { message: "Invalid date format" }
  ),
  skills: stringArraySchema(50, 100),
  interests: stringArraySchema(50, 100),
  resume_url: optionalUrlSchema,
  linkedin_url: optionalUrlSchema,
  github_url: optionalUrlSchema,
  portfolio_url: optionalUrlSchema,
  avatar_url: optionalUrlSchema,
});

export type StudentProfileInput = z.infer<typeof studentProfileSchema>;

// ============= Club Profile Schema =============

const categoryOptions = [
  "Academic", "Arts & Culture", "Business & Finance", "Community Service",
  "Engineering", "Gaming & Esports", "Health & Wellness", "Media & Journalism",
  "Music & Performance", "Political & Advocacy", "Professional Development",
  "Religious & Spiritual", "Science & Research", "Social", "Sports & Recreation",
  "Technology", "Other"
] as const;

export const clubProfileSchema = z.object({
  club_name: requiredSanitizedTextSchema(100, "Club name"),
  description: sanitizedTextSchema(3000, "Description").optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  logo_url: optionalUrlSchema,
  banner_url: optionalUrlSchema,
  website_url: optionalUrlSchema,
  linkedin_url: optionalUrlSchema,
  instagram_url: optionalUrlSchema,
  discord_url: optionalUrlSchema,
});

export type ClubProfileInput = z.infer<typeof clubProfileSchema>;

// ============= RSVP Schema =============

export const rsvpSchema = z.object({
  event_id: z.string().uuid({ message: "Invalid event" }),
  status: z.enum(["confirmed", "cancelled"]).default("confirmed"),
});

export type RsvpInput = z.infer<typeof rsvpSchema>;

// ============= Bookmark Schema =============

export const bookmarkSchema = z.object({
  event_id: z.string().uuid().optional().nullable(),
  opportunity_id: z.string().uuid().optional().nullable(),
}).refine(
  (data) => data.event_id || data.opportunity_id,
  { message: "Either event_id or opportunity_id is required" }
);

export type BookmarkInput = z.infer<typeof bookmarkSchema>;

// ============= Helper function to validate and return errors =============

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join(".");
    if (!errors[path]) {
      errors[path] = err.message;
    }
  });
  
  return { success: false, errors };
}

// ============= Format validation errors for toast =============

export function formatValidationErrors(errors: Record<string, string>): string {
  const messages = Object.values(errors).slice(0, 3);
  return messages.join(". ");
}
