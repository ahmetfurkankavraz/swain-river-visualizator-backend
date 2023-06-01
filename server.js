const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const swaggerUi = require('swagger-ui-express')
const swaggerFile = require('./swagger_output.json')
const {connectToDb} = require('./db/db');
require('dotenv').config();

// init app
var app = express();
app.use(cors());

// db connection
connectToDb((err) => {
   if (!err) {
      let server = app.listen(process.env.port || 8080, function () {
         let host = server.address().address
         let port = server.address().port
         
         console.log("River Visualizator app listening at http://%s:%s", host, port)
      })
   }
})

// convert to json
app.use(bodyParser.json({limit: '200mb'}));

// routers
app.use('/river', require("./router/river"));
app.use('/device', require("./router/device"));
app.use('/measurement', require("./router/measurement"));
app.use('/interpolate', require("./router/interpolate"));
app.use('/river-catalog', require("./router/rivercatalog").router);
app.use('/login', require("./router/login"));
app.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerFile))
