import express from 'express';

import mongoose from 'mongoose';
export const PAGE_LENGTH = process.env.PAGE_LENGTH || 20;

import Busboy from 'busboy';
import path from 'path';
import sharp from 'sharp';
import {v4 as uuid} from 'uuid';

import Grid from 'gridfs-stream';
Grid.mongo = mongoose.mongo;

function paginate(req, query) {
  let page = req.query.page || req.body.page || 0;
  return query
    .skip(page * PAGE_LENGTH)
    .limit(PAGE_LENGTH);
}

export default function constructRouter(Item, storeAlgoMethods) {
  // Pull out all store algorithm methods
  let {flattenList, removePantryItemsFromList, getItemPrice} = (storeAlgoMethods || {});

  let router = express.Router();

  // Post a new image to an item.
  const imageSize = parseInt(process.env.IMAGE_RESIZE_TO) || 54;
  const imagePath = process.env.IMAGE_PATH || 'images/';
  router.post('/items/:id/image', (req, res) => {
    let imageLocation = path.join(imagePath, `${req.params.id}.png`);

    let busboy = new Busboy({headers: req.headers});
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      // Create a new gridfs connection
      let gfs = Grid(mongoose.connection.db);
      if (fieldname === 'image') {
        let imageResizer = sharp().resize(imageSize, imageSize).png();

        gfs.remove({filename: imageLocation}, err => {
          file
          // Resize the image to be 54x54, and convert to png
          .pipe(imageResizer)
          // Save to the filesystem
          // .pipe(fs.createWriteStream(imageLocation));
          // Save to GridFs
          .pipe(gfs.createWriteStream({filename: imageLocation}));
        });
      } else {
        res.status(403).send({
          status: 'err',
          msg: 'Only one image is allowed under the name of `image`' ,
          code: 'net.rgaus.lunchbox.only_one_image',
        });
      }
    });
    busboy.on('finish', () => {
      // Once it's saved, report success!
      res.status(201).send({
        status: 'ok',
        path: `/v1/items/${req.params.id}/image`,
      });
    });
    req.pipe(busboy);
  });

  router.get('/items/:id/image', (req, res) => {
    return Item.findOne({_id: req.params.id}).exec().then(item => {
      let imageLocation = path.join(imagePath, `${item._id}.png`);

      // Is there an image at the specified image path?
      let gfs = Grid(mongoose.connection.db);
      gfs.exist({filename: imageLocation}, (err, found) => {
        if (err || !found) {
          res.status(204).send();
        } else {
          gfs.createReadStream({filename: imageLocation}).pipe(res);
        }
      });
    });
  });

  // Search through item names
  // GET /item/search=Search+Query
  router.get('/items/search', (req, res) => {
    let query = req.query.q || req.query.query;
    if (query) {
      return paginate(
        req,
        Item.find({$text: {$search: query}})
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


  // Item CRUD routes

  // Get an item.
  // THere's some fancyness going on here. Because items are stored within lists
  // "by value" (because stuff like quantity needs to be added), if a change
  // happens on the parent item, that won't be reflected in any children.
  // Therefore, to get the "by reference" while still storeing "by value", each
  // item in a list's item' document is fetched. Then, an Object.assign is done
  // so that any unset properties in the list item "inherit" from the full item
  // document. THe Benefit of this is that schema changes don't require costly
  // recursive migrations, and we only have to migrate on a document-by-document
  // basis instead of having to recursively dive into each list's `contents`.
  function doInherit(item) {
    return (function() {
      if (item.contents) {
        // Get the base items.
        return Promise.all(item.contents.map(item => {
          return Item.findOne({_id: item._id}).exec();
        })).then((baseItems, ct) => {
          return baseItems.map(baseItem => {
            // Each list item inherits from each base item
            return Object.assign({}, baseItem, item.contents[ct]);
          });
        });
      } else {
        return Promise.resolve(item.contents);
      }
    })().then(() => {
      return Object.assign(5)
    });
  }
  router.get('/items', (req, res) => {
    let query = Item.find({}).select('-__v');
    let items;
    return paginate(req, query)
    .exec().then(itemValues => {
      // Get the base items.
      items = itemValues;
      return Promise.all(items.map(item => {
        return Item.findOne({_id: item._id}).exec();
      }));
    }).then(baseItems => {
      res.status(200).send({
        status: 'ok',
        data: items.map((item, ct) => {
          // Inherit from base items
          return Object.assign({}, baseItems[ct].toObject(), item.toObject());
        }),
      });
    });
  });
  router.get('/items/:listId', (req, res) => {
    return Item
    .findOne({_id: req.params.listId})
    .select('-__v')

    .exec()
    .then(list => {
      if (list) {
        res.status(200).send(list);
      } else {
        res.status(404).send({
          status: 'ok',
          msg: 'No such item.',
          code: 'net.rgaus.lunchbox.no_such_list',
        });
      }
    });
  });
  router.post('/items', (req, res) => {
    let item = new Item(req.body);

    return item.save()
    .then(lists => {
      res.status(201).send({status: 'ok', id: lists._id});
    });
  })
  router.put('/items/:itemId', (req, res) => {
    return Item
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
    return Item
    .remove({_id: req.params.itemId})
    .exec()
    .then(item => {
      res.status(204).send({
        status: 'ok',
        nmodified: item.nModified,
      });
    });
  });

  // Get a reference to either the pantry or the grocery list
  router.get('/lists/pantry', (req, res) => {
    return Item
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
  });
  router.get('/lists/grocery', (req, res) => {
    return Item
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
  });

  // add an item to a list
  router.post('/lists/:listId/contents', (req, res) => {
    // body = {item: 'itemid here', quantity: '1 cup'}

    return Item.findOne({_id: req.body.item}).exec().then(list => {
      if (list === null) {
        res.status(404).send({
          status: 'err',
          msg: "No such item to add to the list. Try another item?",
          code: 'net.rgaus.lunchbox.item_no_exist',
        });
        return
      }

      return Item
      .update({
        _id: req.params.listId,
        type: 'list',
      }, {
        $push: {
          contents: Object.assign({}, list.toObject(), {
            // data to filter through from the body to the list contents
            quantity: list.type === "item" ? req.body.quantity : undefined,
          }),
        },
      }).exec().then(item => {
        res.status(201).send({status: 'ok'});
      });
    })
    .catch(err => console.error(err))
  });

  // remove items from list
  router.delete('/lists/:listId/contents/:itemId', (req, res) => {
    return Item
    .update({_id: req.params.listId, type: 'list'}, {
      $pull: {contents: {_id: new mongoose.Types.ObjectId(req.params.itemId)}}
    }).exec().then(({nModified}) => {
      if (nModified > 0) {
        res.status(200).send({status: 'ok'});
      } else {
        res.status(404).send({
          status: 'err',
          msg: 'No matching items in the specified list.',
          code: 'net.rgaus.lunchbox.no_items_in_list',
        });
      }
    })
    .catch(err => console.error(err))
  });

  router.get('/calc', (req, res) => {
    // get the pantry and grocery list
    return Item.findOne({listType: 'pantry'}).exec().then(pantry => {
      return Item.findOne({listType: 'grocery'}).exec().then(list => {
        // convert to a better format
        if (!list) {
          res.status(404).send({
            status: 'err',
            msg: 'No lists of grocery list type.',
            code: 'net.rgaus.lunchbox.no_grocery_list',
          });
        }

        let flattenedGroceryItem = flattenList(list);
        let itemsToBuy = removePantryItemsFromList(flattenedGroceryItem, pantry.contents);
        res.send(itemsToBuy.map(item => {
          return {item, price: getItemPrice(item.name, item.quantity, {type: "cheapest"})};
        }));
      });
    });
  });

  return router;
}
