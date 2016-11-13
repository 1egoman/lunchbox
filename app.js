import express from 'express';
import path from 'path';
import favicon from 'serve-favicon';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import Promise from 'bluebird';
import cors from 'express-cors';

import api from 'routes/api';
import index from 'routes/index';
import mongoose from 'mongoose';
mongoose.Promise = Promise;
mongoose.connect(process.env.MONGODB_URI)

import {
  flattenList,
  removePantryItemsFromList,
} from './store-algo/priceify';
import {getItemPrice} from './store-algo/stores';


import Item from 'models/item';

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

// disable cors while in development
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, HEAD");
  next();
});

/* GET home page. */
app.get('/', (req, res, next) => {
  res.render('index', {title: 'Lunchbox: food management'});
});

app.use('/v1', (req, res, next) => {
  // Preflight CORS does OPTIONS request without headers. Let's not require Authorization then
  if (!req.query.token) {
    return res.status(401).send({
      status: 'err',
      msg: 'Unauthorized, please specifiy a token',
      code: 'net.rgaus.lunchbox.unauthorized_noheader'
    });
  }

  // Protect routes
  if (req.query.token !== process.env.SECRET_KEY) {
    return res.status(401).send({
      status: 'err',
      msg: 'Unauthorized',
      code: 'net.rgaus.lunchbox.unauthorized'
    });
  }
  return next();
}, api(Item, {flattenList, removePantryItemsFromList, getItemPrice}));

app.use('/', index);

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
