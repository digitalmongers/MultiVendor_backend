import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';

/**
 * Enterprise Zod Validation Middleware
 * Transforms Zod errors into standardized ApiError format.
 */
const validate = (schema) => (req, res, next) => {
  try {
    const validData = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Replace req data with validated and parsed data (important for type coercion)
    // We use a safe assignment to avoid "getter only" errors on req.query/req.params
    req.body = validData.body;

    if (validData.query) {
      try {
        req.query = validData.query;
      } catch (e) {
        // Fallback: update properties if object is frozen/getter-only
        Object.assign(req.query, validData.query);
      }
    }

    if (validData.params) {
      try {
        req.params = validData.params;
      } catch (e) {
        // Fallback: update properties if object is frozen/getter-only
        Object.assign(req.params, validData.params);
      }
    }

    next();
  } catch (error) {
    // Handle Zod validation errors
    if (error.errors && Array.isArray(error.errors)) {
      const errors = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      return next(new AppError('Validation failed', HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', errors));
    }

    // Pass unexpected errors to global error handler
    next(error);
  }
};

export default validate;
