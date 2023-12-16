// import express
const express = require('express')
const bodyParser = require('body-parser');

//import queue
var queue = require('express-queue');
const app = express();

//use queue in middleware
app.use(queue({ activeLimit: 2, queuedLimit: -1 }));

//import .env file
require('dotenv').config()

//request format middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

//import github routes
const router = express.Router();
require('./routes/githubRoutes')(router);

//use github routes
app.use('/api/v1',router);

//define the initial port
const port = process.env.API_PORT || 5000;

//set json space to beautify json response..
app.set('json spaces', 40);

//start the server
app.listen(port,() => {
  console.info(`Server listening on ${port}`);  
});