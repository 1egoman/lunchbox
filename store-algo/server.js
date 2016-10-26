"use strict";
const express = require('express');
const app = express();

const priceify = require('./priceify');
const stores = require('./stores');

const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
mongoose.connect(process.env.MONGODB_URI);

const List = require('./schemas/list');

app.use(require('body-parser').json());

let pantry = [];
app.get('/lists/:id/calculate', (req, res) => {
  List.findOne({_id: req.params.id}).exec().then(groceryList => {
    let flattenedGroceryList = priceify.flattenList(groceryList);
    let itemsToBuy = priceify.removePantryItemsFromList(flattenedGroceryList, pantry);

    res.status(200).send(itemsToBuy);
  });
});

let port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log("* Port", port);
});
