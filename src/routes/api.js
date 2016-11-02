import express from 'express';
var router = express.Router();

import List from 'models/list';
import mongoose from 'mongoose';
const PAGE_LENGTH = 20;

import priceify from '../../store-algo/priceify';
import stores from '../../store-algo/stores';

function paginate(req, query) {
  let page = req.params.page || req.body.page || 0;
  return query
    .skip(page * PAGE_LENGTH)
    .limit(PAGE_LENGTH);
}

// Search through list names
// GET /lists/search=Search+Query
router.get('/lists/search', (req, res) => {
  let query = req.query.q || req.query.query;
  if (query) {
    return paginate(
      req,
      List.find({$text: {$search: query}})
    ).exec().then(contents => {
      res.status(200).send({status: 'ok', contents});
    });
  } else {
    res.status(400).send({
      status: 'err',
      msg: 'No query parameter specified',
      code: 'net.rgaus.lunchbox.no_search_query',
    });
  }
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
});

// Get a reference to either the pantry or the grocery list
router.get('/lists/pantry', (req, res) => {
  List
  .findOne({listType: 'pantry', type: 'list'})
  .select('-__v')
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
router.get('/lists/grocery', (req, res) => {
  List
  .findOne({listType: 'grocery', type: 'list'})
  .select('-__v')
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

// add an item to a list
router.post('/lists/:listId/contents', (req, res) => {
  // body = {item: 'itemid here', quantity: '1 cup'}

  return List.findOne({_id: req.body.item}).exec().then(list => {
    if (list === null) {
      return res.status(404).send({error: "No such list to add items into."});
    }

    return List
    .update({
      _id: req.params.listId
    }, {
      $push: {
        contents: Object.assign({}, list.toObject(), {
          // data to filter through from the body to the list contents
          quantity: req.body.quantity,
        }),
      },
    }).exec();
  }).then(item => {
    res.status(201).send({status: 'ok'});
  });
});

// remove items from list
router.delete('/lists/:listId/contents/:itemId', (req, res) => {
  return List
  .update({_id: req.params.listId}, {
    $pull: {contents: {_id: new mongoose.Types.ObjectId(req.params.itemId)}}
  }).exec().then(item => {
    res.status(201).send({status: 'ok'});
  });
});

router.get('/calc', (req, res) => {
  // Given a list item fetched from the mongo database, do a few things:
  // - convert the mongo output to a object (with list.toObject)
  // - Convert the `item` and `lists` keys into one `contents` key. This
  // involves injecting a `type` into each list or item. (this is done
  // recuresively!)
  // function traverseList(depth, level) {
  //   if (depth > 50) {
  //     throw new Error('Either lists are nested really deeply, or there is a list inside of itself.');
  //   }
  //
  //   // first, resolve all the items
  //   return Promise.all([
  //     // expand all items in the passed list
  //     Promise.all(level.items.map(item => {
  //       return Item.findOne({_id: item}).exec()
  //     })),
  //     // expand all lists in the passed list
  //     Promise.all(level.lists.map(list => {
  //       return List.findOne({_id: list}).exec()
  //     })),
  //   ]).then(([items, lists]) => {
  //     // then, recursively resolve each list's contents
  //     return Promise.all(
  //       lists.map(traverseList.bind(null, ++depth))
  //     ).then(resolvedLists => {
  //       // remove items/lists, and add contents
  //       return Object.assign({}, level.toObject(), {
  //         items: undefined,
  //         lists: undefined,
  //         contents: [
  //           ...items.map(i => {
  //             return Object.assign({}, i.toObject(), {type: 'item', store: {type: 'cheapest'}});
  //           }),
  //           ...resolvedLists.map(i => {
  //             return Object.assign({}, i, {type: 'list'});
  //           }),
  //         ],
  //       })
  //     });
  //   });
  // }

  // get the pantry and grocery list
  return List.findOne({listType: 'pantry'}).exec().then(pantry => {
    return List.findOne({listType: 'grocery'}).exec().then(list => {
      // convert to a better format
      if (!list) {
        res.status(404).send({error: "No such list with that id!"});
      }

      // first, expand the schema using `traverseList` above
      // traverseList(0, list).then(expandedList => {
      let flattenedGroceryList = priceify.flattenList(list);
      let itemsToBuy = priceify.removePantryItemsFromList(flattenedGroceryList, pantry.contents);
      res.send(itemsToBuy.map(item => {
        return {item, price: stores.getItemPrice(item.name, item.quantity, {type: "cheapest"})};
      }));
      // }).catch(e => console.error(e.stack) && res.send('error'))
    });
  });
});

module.exports = router;
