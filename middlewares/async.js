// This middleware wraps async route handlers to automatically catch errors
// and pass them to Express's error handling middleware

const asyncHandler = (fn) => (req, res, next) => {
  // Resolve the returned promise to handle both async and non-async functions
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
