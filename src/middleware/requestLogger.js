import Logger from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request using enterprise logger
  Logger.logRequest(req);

  // Hook into response to capture body
  const originalSend = res.send;
  res.send = function (body) {
    res.locals.responseBody = body;
    return originalSend.call(this, body);
  };

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Parse response body if possible for logging
    let responseBody = res.locals.responseBody;
    try {
      if (typeof responseBody === 'string') {
        responseBody = JSON.parse(responseBody);
      }
    } catch (e) {
      // Keep as string if not JSON
    }

    Logger.logResponse(req, res, duration, responseBody);
  });

  next();
};
