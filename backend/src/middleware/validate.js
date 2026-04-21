// backend/src/middleware/validate.js
// Zod-based request validation middleware.
// Each schema matches an API route — invalid requests are rejected with
// a structured 400 response before hitting any business logic.

const { z } = require('zod');

/**
 * Creates an Express middleware that validates req.body against a Zod schema.
 * Returns 400 with field-level errors if validation fails.
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field:   e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ error: 'Validation failed', errors });
    }
    req.body = result.data;  // Use parsed/coerced data
    next();
  };
}

/**
 * Validates multipart form fields (req.body after multer processes the upload).
 * File validation is handled by multer's fileFilter.
 */
function validateFormFields(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field:   e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ error: 'Validation failed', errors });
    }
    req.validatedBody = result.data;
    next();
  };
}

// ── Schemas ───────────────────────────────────────────────────────────────────

// Name: Unicode letters, spaces, hyphens, dots, apostrophes. 2-100 chars.
const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters')
  .regex(/^[a-zA-Z\u0080-\uFFFF][a-zA-Z\u0080-\uFFFF\s'.-]*$/, 'Name contains invalid characters')
  .transform(s => s.trim());

const customerIdSchema = z
  .string()
  .min(3, 'Customer ID must be at least 3 characters')
  .max(50, 'Customer ID must be at most 50 characters')
  .regex(/^[A-Za-z0-9_\-]+$/, 'Customer ID must be alphanumeric')
  .transform(s => s.trim());

// POST /api/requests (multipart form fields)
const submitRequestSchema = z.object({
  customer_id: customerIdSchema,
  old_name:    nameSchema,
  new_name:    nameSchema,
}).refine(
  data => data.old_name.toLowerCase() !== data.new_name.toLowerCase(),
  { message: 'Old name and new name cannot be the same', path: ['new_name'] }
);

// POST /api/requests/:id/approve
const approveSchema = z.object({
  checker_id: z.string().min(2).max(50).transform(s => s.trim()),
  notes:      z.string().max(500).optional().transform(s => s?.trim()),
});

// POST /api/requests/:id/reject
const rejectSchema = z.object({
  checker_id: z.string().min(2).max(50).transform(s => s.trim()),
  reason:     z.string().min(5, 'Please provide a reason (minimum 5 characters)').max(500).transform(s => s.trim()),
});

// GET /api/requests query params
const listQuerySchema = z.object({
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['PROCESSING', 'AI_VERIFIED_PENDING_HUMAN', 'APPROVED', 'REJECTED', 'FAILED']).optional(),
});

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }));
      return res.status(400).json({ error: 'Invalid query parameters', errors });
    }
    req.query = result.data;
    next();
  };
}

module.exports = {
  validateBody,
  validateFormFields,
  validateQuery,
  schemas: {
    submitRequest: submitRequestSchema,
    approve:       approveSchema,
    reject:        rejectSchema,
    listQuery:     listQuerySchema,
  },
};
