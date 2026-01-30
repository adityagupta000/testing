const Joi = require("joi");
const logger = require("../utils/logger");

/**
 * Validate request using Joi schema
 */
const validate = (schema) => {
  return (req, res, next) => {
    const validationOptions = {
      abortEarly: false, // Return all errors, not just the first one
      allowUnknown: true, // Allow unknown keys in the request
      stripUnknown: true, // Remove unknown keys from validated data
    };

    // Determine what to validate (body, query, params)
    const toValidate = {};
    if (schema.body) toValidate.body = req.body;
    if (schema.query) toValidate.query = req.query;
    if (schema.params) toValidate.params = req.params;

    const { error, value } = Joi.object(schema).validate(
      toValidate,
      validationOptions,
    );

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        type: detail.type,
      }));

      logger.warn("Validation error:", { errors, path: req.path });

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Replace request data with validated data
    if (value.body) req.body = value.body;
    if (value.query) req.query = value.query;
    if (value.params) req.params = value.params;

    next();
  };
};

/**
 * Common Joi schemas
 */
const schemas = {
  // MongoDB ObjectId validation
  objectId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .message("Invalid ID format"),

  // Email validation
  email: Joi.string().email().lowercase().trim(),

  // Password validation
  password: Joi.string().min(6).max(128),

  // Pagination
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().default("-createdAt"),
    search: Joi.string().trim().allow(""),
  },

  // Date range
  dateRange: {
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().greater(Joi.ref("startDate")),
  },

  // User registration
  register: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      firstName: Joi.string().trim().allow(""),
      lastName: Joi.string().trim().allow(""),
    }),
  },

  // User login
  login: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
  },

  // Feature toggle creation
  createFeatureToggle: {
    body: Joi.object({
      featureName: Joi.string().trim().required(),
      description: Joi.string().trim().allow(""),
      enabled: Joi.boolean().default(true),
      allowedRoles: Joi.array().items(
        Joi.string().valid("admin", "user", "guest"),
      ),
      rolloutPercentage: Joi.number().min(0).max(100).default(100),
      environments: Joi.object({
        development: Joi.object({ enabled: Joi.boolean() }),
        staging: Joi.object({ enabled: Joi.boolean() }),
        production: Joi.object({ enabled: Joi.boolean() }),
      }),
    }),
  },

  // Rate guard creation
  createRateGuard: {
    body: Joi.object({
      routePath: Joi.string().trim().required(),
      method: Joi.string()
        .valid("GET", "POST", "PUT", "PATCH", "DELETE", "ALL")
        .default("ALL"),
      description: Joi.string().trim().allow(""),
      enabled: Joi.boolean().default(true),
      limits: Joi.object({
        admin: Joi.object({
          maxRequests: Joi.number().integer().min(1),
          windowMs: Joi.number().integer().min(1000),
        }),
        user: Joi.object({
          maxRequests: Joi.number().integer().min(1),
          windowMs: Joi.number().integer().min(1000),
        }),
        guest: Joi.object({
          maxRequests: Joi.number().integer().min(1),
          windowMs: Joi.number().integer().min(1000),
        }),
      }),
      ipBased: Joi.boolean().default(false),
      errorMessage: Joi.string().trim(),
    }),
  },

  // Update user
  updateUser: {
    body: Joi.object({
      firstName: Joi.string().trim(),
      lastName: Joi.string().trim(),
      email: Joi.string().email(),
      role: Joi.string().valid("admin", "user", "guest"),
      isActive: Joi.boolean(),
    }).min(1),
  },

  // ID parameter
  idParam: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          "string.pattern.base": "Invalid ID format",
        }),
    }),
  },
};

/**
 * Sanitize user input
 */
const sanitize = (req, res, next) => {
  // Basic XSS protection - strip potential script tags
  const sanitizeString = (str) => {
    if (typeof str !== "string") return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .trim();
  };

  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== "object") return obj;

    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === "string") {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === "object") {
        obj[key] = sanitizeObject(obj[key]);
      }
    });

    return obj;
  };

  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);

  next();
};

module.exports = {
  validate,
  schemas,
  sanitize,
};
