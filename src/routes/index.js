import express from 'express';
var router = express.Router();

import Item from 'models/item';
import mongoose from 'mongoose';
const PAGE_LENGTH = 20;

// item CRUD routes
router.get('/lists', (req, res) => {
  Item.find({}).exec().then(lists => {
    res.render('lists', {lists});
  });
});

router.get('/lists/:listId', (req, res) => {
  Item.findOne({_id: req.params.listId}).exec().then(list => {
    res.render('list', {list});
  });
});

module.exports = router;
