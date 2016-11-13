import express from 'express';

import mongoose from 'mongoose';
export const PAGE_LENGTH = 20;

import fs from 'fs';
import Busboy from 'busboy';
import path from 'path';
import sharp from 'sharp';
import {v4 as uuid} from 'uuid';

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
      if (fieldname === 'image') {
        let imageResizer = sharp().resize(imageSize, imageSize).png();

        file
        // Resize the image to be 54x54, and convert to png
        .pipe(imageResizer)
        // Save to the filesystem
        .pipe(fs.createWriteStream(imageLocation));
      } else {
        res.status(403).send({
          status: 'err',
          msg: 'Only one image is allowed under the name of `image`' ,
          code: 'net.rgaus.lunchbox.only_one_image',
        });
      }
    });
    busboy.on('finish', () => {
      // Once it's saved, add the path to the item model
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
      fs.access(imageLocation, fs.F_OK, err => {
        if (err) {
          res.status(204).send();
        } else {
          fs.createReadStream(imageLocation).pipe(res);
        }
      })
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
  router.get('/items', (req, res) => {
    let query = Item.find({}).select('-__v');
    return paginate(req, query)
    .exec().then(items => {
      res.status(200).send({
        status: 'ok',
        data: items,
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
