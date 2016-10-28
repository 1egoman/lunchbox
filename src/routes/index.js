import express from 'express';
var router = express.Router();

import List from 'models/list';
import mongoose from 'mongoose';
const PAGE_LENGTH = 20;

// List CRUD routes
router.get('/lists', (req, res) => {
  List.find({}).exec().then(lists => {
    res.render('lists', {lists});
  });
});

router.get('/lists/:listId', (req, res) => {
  List.findOne({_id: req.params.listId}).exec().then(list => {
    res.render('list', {list});
  });
});

module.exports = router;
