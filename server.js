"use strict";
var environment = require("./conf/environment.json")[process.env.NODE_ENV || "ic"];
var cluster = require('cluster'),
  numCPUs = require('os').cpus().length;

// --- Error Middleware ---
process.on('uncaughtException', function(err, stack) {
  console.log('[Process][' + (cluster.isMaster ? "MASTER" : "CHILDREN") + ':' + process.pid + '][Caught exception] Error: ' + err.stack);
  setTimeout(function(){
    process.exit(1);
  }, 1000);
});
// --- END Error Middleware ---

//Cluster Fork Settings.
if(cluster.isMaster) {
  for(var i = numCPUs; i--;) {
    cluster.fork();
  }

  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
    cluster.fork();
  });
} else {
  // --- Requirements ---
  var express = require("express"),
    path = require("path"),
    bodyParser = require("body-parser"),
    methodOverride = require("method-override"),
    multer = require("multer"),
    compression = require("compression"),
    errorhandler = require("errorhandler"),
    base = express(),
    server = require('http').Server(base).listen((process.env.PORT || 5000)),
    io = require("socket.io")(server, {path: environment.server.path + "/socket.io"}),
    mysql = require('mysql');
  // --- END Requirements ---

  // ---- CORS ----
  var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.sendStatus(200);
    }
    else {
      next();
    }
  };
  // ---- END CORS ----

  // --- App Middlewares ---
  var app = express();
  app.use(compression())
    .use(bodyParser.json({limit: '50mb'}))
    .use(bodyParser.urlencoded({limit: '50mb', extended: false}))
    .use(multer())
    .use(allowCrossDomain)
    //.use(express.static(path.join(__dirname, "public")))
    .use(methodOverride())
  // --- END App Middlewares ---

  base.use(environment.server.path , app);

  // --- Socket Web Service ---
  io.on('connection', function(socket) {
    console.log("Socket conected.");
  });
  // --- END Socket Web Service --- 

  // --- Connect to MongoDB ---
  var connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : 'Pastilla20',
    database : 'doggies'
  });

  var connect = function() {
    connection.connect(function(err) {
      if(err){
        console.log('Error connecting to Db');
        return;
      }
      console.log('Connection established');
    });
  };

  app.post('/login', function(req, res) {    
    connect();

    connection.query("SELECT * FROM user WHERE username = ?", req.body.username, function(err, rows, fields) {
      if(!err) 
        if(req.body.pass === rows[0].password)
          connection.query("SELECT * FROM dog WHERE user_id = ?", rows[0].id, function(err, rows) {
            if(!err)
              res.send(rows);
            else
              console.log("Error: " + JSON.stringify(err));
          });
        else
          res.send("error: password incorrecta.")
      else 
        console.log("Error: " + JSON.stringify(err));
    });
  });

  app.get('/getDogMatch', function(req, res) {
    connect();
    console.log(req.body.user_id)
    connection.query("SELECT * FROM dog WHERE user_id <> ?", 1, function(err, rows) {
      if(!err)
        res.send(rows);
      else
        console.log(err)
    });
  });
}
