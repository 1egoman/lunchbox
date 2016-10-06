import express from 'express';
var router = express.Router();

import Item from 'models/item';
import List from 'models/list';
import mongoose from 'mongoose';
const PAGE_LENGTH = 20;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

function paginate(req, query) {
  let page = req.params.page || req.body.page;
  return query
    .skip(page * PAGE_LENGTH)
    .limit(PAGE_LENGTH);
}

// Items
router.get('/items', (req, res) => {
  let query = Item
  .find({})
  .select('-__v');

  paginate(req, query).exec().then(items => {
    res.status(200).send({
      status: 'ok',
      data: items,
    });
  });
});
router.get('/items/:itemId', (req, res) => {
  Item
  .findOne({_id: req.params.itemId})
  .select('-__v')
  .exec()
  .then(items => {
    res.status(200).send({
      status: 'ok',
      item,
    });
  });
})
router.post('/items', (req, res) => {
  let item = new Item(req.body);

  item.save()
  .then(items => {
    res.status(201).send({status: 'ok',});
  });
})
router.put('/items/:itemId', (req, res) => {
  Item
  .update({_id: req.params.itemId}, req.body)
  .exec()
  .then(item => {
    res.status(200).send({
      status: 'ok',
      nmodified: item.nModified,
    });
  });
});

// List
router.get('/lists', (req, res) => {
  let query = List
  .find({})
  .select('-__v')
  .populate('items')
  .populate('lists');

  paginate(req, query).exec().then(lists => {
    res.status(200).send({
      status: 'ok',
      data: lists,
    });
  });
});
router.get('/lists/:listId', (req, res) => {
  List
  .findOne({_id: req.params.listId})
  .select('-__v')
  .populate('items')
  .populate('lists')

  .exec()
  .then(list => {
    res.status(200).send({
      status: 'ok',
      list,
    });
  });
})
router.post('/lists', (req, res) => {
  let list = new List(req.body);

  list.save()
  .then(lists => {
    res.status(201).send({status: 'ok'});
  });
})
router.put('/lists/:listId', (req, res) => {
  List
  .update({_id: req.params.listId}, req.body)
  .exec()
  .then(list => {
    res.status(200).send({
      status: 'ok',
      nmodified: list.nModified,
    });
  });
});

// List items
router.get('/lists/:listId/items/:itemId', (req, res) => {
  List
  .findOne({_id: req.params.listId})
  .select('contents')
  .exec()
  .then(({contents}) => {
    res.status(200).send({
      status: 'ok',
      contents,
    });
  });
});
router.post('/lists/:listId/items', (req, res) => {
  // body = {item: 'itemid here'}

  Promise.all([
    Item.findOne({_id: req.body.item}).exec(),
    List.findOne({_id: req.body.item}).exec(),
  ]).then(([item, list]) => {
    console.log(item, list)

    let a = {};
    if (item) { a.items = item; }
    if (list) { a.lists = list; }

    return List
    .update({_id: req.params.listId}, {
      $push: a,
    })
    .exec()
  }).then(item => {
    res.status(201).send({status: 'ok'});
  });
});
router.put('/lists/:listId/items/:itemId')

module.exports = router;
