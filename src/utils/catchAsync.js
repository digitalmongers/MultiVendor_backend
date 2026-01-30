/**
 * catchAsync - A wrapper to handle asynchonous route errors
 * Avoids repeated try-catch blocks in controllers.
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default catchAsync;
