import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUiExpress from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Spreedly SDK Sample App',
      version: '1.0.0',
      description: 'This sample app is a proxy server for calling Spreedly payment APIs, demonstrating the implementation of a merchant backend in the sample application.'
    },
  },
  apis: ['./src/routes.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

export { swaggerSpec, swaggerUiExpress };
