const swaggerAutogen = require('swagger-autogen')()

const outputFile = './swagger_output.json'
const endpointsFiles = ['./router/device.js', './router/interpolate.js', 
      './router/login.js', './router/measurement.js', './router/river.js']

swaggerAutogen(outputFile, endpointsFiles)
