import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Multi Vendor API',
      version: '1.0.0',
      description: 'API documentation',
    },
    servers: [
      {
        url: 'http://localhost:5000',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

// The original global specs initialization is removed as per the implied change
// let specs;
// try {
//   specs = swaggerJsdoc(options);
// } catch (error) {
//   console.error('❌ Swagger JSDoc Initialization Failed:', error.message);
//   // Create a minimal spec so the app doesn't crash
//   specs = { openapi: '3.0.0', info: { title: 'Emergency Docs', version: '0.0.0' }, paths: {} };
// }

export const setupSwagger = (app) => {
  try {
    const swaggerSpec = swaggerJsdoc(options);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    // Assuming Logger is defined or imported
    if (typeof Logger !== 'undefined' && Logger.info) {
      Logger.info('📝 Swagger documentation initialized at /api-docs');
    } else {
      console.log('📝 Swagger documentation initialized at /api-docs');
    }
  } catch (error) {
    // Assuming Logger is defined or imported
    if (typeof Logger !== 'undefined' && Logger.error) {
      Logger.error('❌ Swagger JSDoc Initialization Failed:', error);
    } else {
      console.error('❌ Swagger JSDoc Initialization Failed:', error);
    }
    // Optionally, create a minimal spec so the app doesn't crash,
    // but the original request implies moving the error handling to Logger.error
    // and not necessarily keeping the minimal spec creation in this refactored block.
    // If a minimal spec is still desired, it would need to be handled here.
    const minimalSpecs = { openapi: '3.0.0', info: { title: 'Emergency Docs', version: '0.0.0' }, paths: {} };
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(minimalSpecs));
  }
};
