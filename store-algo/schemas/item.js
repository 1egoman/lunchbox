"use strict";
const mongoose = require('mongoose');

let item = new mongoose.Schema({
  name: {type: 'string'},
  quantity: {type: 'string'},
  store: {
    type: {type: 'string'},
  },
});

module.exports = mongoose.model('Item', item);
