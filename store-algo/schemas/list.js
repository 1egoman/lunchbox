"use strict";
const mongoose = require('mongoose');

let list = new mongoose.Schema({
  name: {type: 'string'},
  contents: Object,
});

module.exports = mongoose.model('list', list);
