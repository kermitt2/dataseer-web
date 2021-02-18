/*
 * @prettier
 */

const express = require('express'),
  app = express(),
  http = require('http').Server(app),
  path = require('path'),
  url = require('url'),
  fs = require('fs'),
  fileUpload = require('express-fileupload'),
  logger = require('morgan'),
  methodOverride = require('method-override'),
  session = require('express-session'),
  bodyParser = require('body-parser'),
  multer = require('multer'),
  errorHandler = require('errorhandler'),
  passport = require('passport'),
  LocalStrategy = require('passport-local').Strategy,
  request = require('request'),
  flash = require('connect-flash');

const indexRouter = require('./routes/index'),
  documentsRouter = require('./routes/api/documents'),
  dataseerMLRouter = require('./routes/api/dataseer-ml'),
  backOfficeRouter = require('./routes/backoffice'),
  viewsRouter = require('./routes/documents');

const conf = require('./conf/conf.json'),
  extractor = require('./lib/extractor.js');

// mongoose object
const mongoose = require('mongoose');
mongoose.set('useCreateIndex', true);

// URL to mongoDB
const urlmongo = conf.services.mongodb;

// API connection
mongoose.connect(urlmongo, {
  useNewUrlParser: true,
  useFindAndModify: false,
  useUnifiedTopology: true
});

let db = mongoose.connection;
db.on('error', function () {
  console.log('Connection to MongoDB failed');
  process.exit(0);
});
db.once('open', function () {
  console.log('Connection to MongoDB succeeded');
  request.get(conf.services['dataseer-ml'] + '/jsonDataTypes', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log('GET on /jsonDataTypes route of dataseer-ml service succeeded');
      app.set('dataTypes.json', extractor.buildDataTypes(JSON.parse(body)));
      fs.readFile('./conf/private.key', 'utf-8', function (err, privateKey) {
        if (err) {
          console.log('file conf/private.key not found');
          process.exit(0);
        }
        console.log('file conf/private.key loaded');
        app.set('private.key', privateKey);

        app.disable('x-powered-by');

        // all environments
        app.set('port', process.env.PORT || 3000);
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'pug');
        app.use(logger('dev'));
        app.use(methodOverride());
        app.use(
          fileUpload({
            limits: { fileSize: 50 * 1024 * 1024 }
          })
        );
        app.use(bodyParser.json({ limit: '50mb', extended: true }));
        app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
        // app.use(multer());
        app.use(
          session({
            cookieName: 'session',
            secret: privateKey,
            resave: false,
            saveUninitialized: false
          })
        );
        app.use(flash());

        // Configure passport middleware
        app.use(passport.initialize());
        app.use(passport.session());

        // Configure passport-local to use account model for authentication
        const Accounts = require('./models/accounts.js');
        passport.use(new LocalStrategy(Accounts.authenticate()));

        // use static serialize and deserialize of model for passport session support
        passport.serializeUser(Accounts.serializeUser());
        passport.deserializeUser(Accounts.deserializeUser());

        app.use(express.static('public'));

        app.use('/', indexRouter);
        app.use('/api/documents', documentsRouter);
        app.use('/api/dataseer-ml', dataseerMLRouter);
        app.use('/documents', viewsRouter);
        app.use('/backoffice', backOfficeRouter);
      });
    } else {
      console.log(error);
      console.log('GET on /jsonDataTypes route of dataseer-ml service failed');
      process.exit(0);
    }
  });
});

module.exports = app;
