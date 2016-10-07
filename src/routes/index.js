import express from 'express';
var router = express.Router();

import Item from 'models/item';
import List from 'models/list';
import mongoose from 'mongoose';
const PAGE_LENGTH = 20;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {title: 'Lunchbox: food management'});
});

function paginate(req, query) {
  let page = req.params.page || req.body.page;
  return query
    .skip(page * PAGE_LENGTH)
    .limit(PAGE_LENGTH);
}

// Item CRUD routes
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
router.delete('/items/:itemId', (req, res) => {
  Item
  .remove({_id: req.params.itemId})
  .exec()
  .then(item => {
    res.status(200).send({
      status: 'ok',
      nmodified: item.nModified,
    });
  });
  1
});

// List CRUD routes
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
    if (list) {
      res.status(200).send({
        status: 'ok',
        list,
      });
    } else {
      res.status(404).send({
        status: 'ok',
        msg: 'No such list.',
        code: 'com.github.1egoman.lunchbox.no_such_list',
      });
    }
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
router.delete('/lists/:listId', (req, res) => {
  List
  .remove({_id: req.params.listId})
  .exec()
  .then(list => {
    res.status(200).send({
      status: 'ok',
      nmodified: list.nModified,
    });
  });
  1
});

// List items
router.get('/lists/:listId/items/:itemId', (req, res) => {
  List
  .findOne({_id: req.params.listId})
  .exec()
  .then(({contents}) => {
    res.status(200).send({
      status: 'ok',
      contents,
    });
  });
});

// add an item to a list
router.post('/lists/:listId/contents', (req, res) => {
  // body = {item: 'itemid here'}

  Promise.all([
    Item.findOne({_id: req.body.item}).exec(),
    List.findOne({_id: req.body.item}).exec(),
  ]).then(([item, list]) => {
    // construct a query with both a list and an item
    let query = {};
    if (item) { query.items = item; }
    if (list) { query.lists = list; }

    return List
    .update({_id: req.params.listId}, {$push: query})
    .exec()
  }).then(item => {
    res.status(201).send({status: 'ok'});
  });
});

// remove items from list
router.delete('/lists/:listId/contents/:itemId', (req, res) => {
  Promise.all([
    Item.findOne({_id: req.params.itemId}).exec(),
    List.findOne({_id: req.params.itemId}).exec(),
  ]).then(([item, list]) => {
    // construct a query with both a list and an item
    let query = {};
    if (item) { query.items = item._id; }
    if (list) { query.lists = list._id; }

    return List
    .update({_id: req.params.listId}, {$pull: query})
    .exec();
  }).then(item => {
    res.status(201).send({status: 'ok'});
  });
});

module.exports = router;
