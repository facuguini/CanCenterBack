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
    mongo = require('mongodb').MongoClient;
  // --- END Requirements ---

  // --- App Middlewares ---
  var app = express();
  app.use(compression())
    .use(bodyParser.json({limit: '50mb'}))
    .use(bodyParser.urlencoded({limit: '50mb', extended: false}))
    .use(multer())
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
  var connect = function ConnectToMongo(callback) {
    mongo.connect("mongodb://localhost:27017/doggies", function(err, db) {
      if(!err)
        callback(null, db);
      else
        callback(err, db);
    });
  }
  // --- END Connect to MongoDB ---

  app.use('/', express.static(__dirname));
  /*app.get('/', function(req, res) {
    connect(function(err, db) {
      if(err)
        console.log(err)
      res.send("connected")
    });
  });*/

  app.get('/login', function(req, res) {
    connect(function(err, db) {
      if (err)
        console.log(err)
      var collection = db.collection('user');
      collection.findOne({username: req.username, pass: req.pass}, function(err, data) {
        if (err)
          console.log(err)
        if (data)
          res.send(true);
      });
    });
  });

  app.get('/getUserDog', function(req, res) {
    connect(function(err, db) {
      if(err)
        console.log(err);
      var collection = db.collection('dog');
      collection.find({user: "560475da85310d5c71ccb313"/*req.user_id*/}).toArray(function(err, data) {
        if (err)
          console.log(err)
        if (data)
          res.send(data)
      });
    });
  });
}
