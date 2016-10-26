import express from 'express';
var router = express.Router();

import Item from 'models/item';
import List from 'models/list';
import mongoose from 'mongoose';
const PAGE_LENGTH = 20;

import priceify from '../../store-algo/priceify';

function paginate(req, query) {
  let page = req.params.page || req.body.page;
  return query
    .skip(page * PAGE_LENGTH)
    .limit(PAGE_LENGTH);
}

// Item CRUD routes
router.get('/items', (req, res) => {
  let query = Item
  .find(req.query)
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
  .then(item => {
    res.status(200).send(item);
  });
})
router.post('/items', (req, res) => {
  let item = new Item(req.body);

  item.save()
  .then(items => {
    res.status(201).send({status: 'ok', id: items._id});
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
      res.status(200).send(list);
    } else {
      res.status(404).send({
        status: 'ok',
        msg: 'No such list.',
        code: 'net.rgaus.lunchbox.no_such_list',
      });
    }
  });
})
router.post('/lists', (req, res) => {
  let list = new List(req.body);

  list.save()
  .then(lists => {
    res.status(201).send({status: 'ok', id: lists._id});
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

router.get('/lists/:listId/calc', (req, res) => {
  // Given a list item fetched from the mongo database, do a few things:
  // - convert the mongo output to a object (with list.toObject)
  // - Convert the `item` and `lists` keys into one `contents` key. This
  // involves injecting a `type` into each list or item. (this is done
  // recuresively!)
  function traverseList(depth, level) {
    if (depth > 50) {
      throw new Error('Either lists are nested really deeply, or there is a list inside of itself.');
    }

    // first, resolve all the items
    return Promise.all([
      // expand all items in the passed list
      Promise.all(level.items.map(item => {
        return Item.findOne({_id: item}).exec()
      })),
      // expand all lists in the passed list
      Promise.all(level.lists.map(list => {
        return List.findOne({_id: list}).exec()
      })),
    ]).then(([items, lists]) => {
      // then, recursively resolve each list's contents
      return Promise.all(
        lists.map(traverseList.bind(null, ++depth))
      ).then(resolvedLists => {
        // remove items/lists, and add contents
        return Object.assign({}, level.toObject(), {
          items: undefined,
          lists: undefined,
          contents: [
            ...items.map(i => {
              return Object.assign({}, i.toObject(), {type: 'item'});
            }),
            ...resolvedLists.map(i => {
              return Object.assign({}, i, {type: 'list'});
            }),
          ],
        })
      });
    });
  }

  List.findOne({_id: req.params.listId}).exec().then(list => {
    // convert to a better format
    if (!list) {
      res.status(404).send({error: "No such list with that id!"});
    }

    // first, expand the schema using `traverseList` above
    traverseList(0, list).then(d => {
      res.send(priceify.flattenList(d)); // then flatten
    }).catch(e => console.error(e.stack) && res.send('error'))
  });
});

module.exports = router;
