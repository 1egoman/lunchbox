import express from 'express';
import path from 'path';
import favicon from 'serve-favicon';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import Promise from 'bluebird';

import api from 'routes/api';
import mongoose from 'mongoose';
mongoose.Promise = Promise;
mongoose.connect(process.env.MONGODB_URI)

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/* GET home page. */
app.get('/', (req, res, next) => {
  res.render('index', {title: 'Lunchbox: food management'});
});

app.use('/v1', (req, res, next) => {
  // Protect routes
  if (
    req.headers.authorization &&
    req.headers.authorization === `Bearer ${process.env.SECRET_KEY}`
  ) {
    next();
  } else {
    res.status(401).send({
      status: 'err',
      msg: 'Unauthorized',
      code: 'net.rgaus.lunchbox.unauthorized'
    });
  }
}, api);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
