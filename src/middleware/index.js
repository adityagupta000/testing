/**
 * Middleware Index
 * Centralized export of all middleware modules
 */

const auth = require("./auth");
const authorization = require("./authorization");
const featureToggle = require("./featureToggle");
const rateGuard = require("./rateGuard");
const validation = require("./validation");
const errorHandler = require("./errorHandler");
const requestLogger = require("./requestLogger");

module.exports = {
  // Authentication
  ...auth,

  // Authorization
  ...authorization,

  // Feature Toggles
  ...featureToggle,

  // Rate Limiting
  ...rateGuard,

  // Validation
  ...validation,

  // Error Handling
  ...errorHandler,

  // Request Logging
  ...requestLogger,
};
