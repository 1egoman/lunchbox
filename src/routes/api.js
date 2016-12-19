import express from 'express';

import mongoose from 'mongoose';
export const PAGE_LENGTH = process.env.PAGE_LENGTH || 20;

import Busboy from 'busboy';
import path from 'path';
import sharp from 'sharp';
import {v4 as uuid} from 'uuid';
import request from 'request';
import titleCase from 'title-case';

import Grid from 'gridfs-stream';
Grid.mongo = mongoose.mongo;

// TODO: make pagination work!
function paginate(req, query) {
  return query;
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
          code: 'net.rgaus.lunchbox.no_such_item',
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
    // item body = {item: 'itemid here', quantity: '1 cup'}
    // list body = {item: 'listid here', quantity: '1'}

    // Remote recipes have the shape of: {
    //   ingredients: ['one', 'two', 'three'],
    //   isRemoteRecipe: true,
    // }



    // If this is a recipe from a remote service (ie, discovered via
    // recipepuppy) then create the item before adding it
    let waitFor;
    if (req.body.item && req.body.item.isRemoteRecipe) {
      // Find the closest matching ingredients, or make them if required
      waitFor = Promise.all(req.body.item.ingredients.map(ingr => {
        return Item.findOne({type: 'item', $text: {$search: ingr}})
        .exec().then(match => {
          if (match) {
            // return the match!
            return match.toObject();
          } else {
            // If the item doesn't exist, make it.
            let item = new Item({name: titleCase(ingr), type: 'item'});
            return item.save().then(i => i.toObject());
          }
        });
      })).then(contents => {
        // Create the "master" recipe.
        let item = new Item({
          name: req.body.item.title,
          type: 'list',
          listType: 'recipe',
          recipeHref: req.body.item.href,
          contents,
        });
        return item.save();
      }).then(i => {
        // Add the id as if it was passed originally
        req.body.item = i._id;
      });
    } else {
      waitFor = Promise.resolve();
    }



    // We need to wrap this below code in the promise above because items need
    // to be created (if the item to be added is a remote recipe) before they
    // can be added to the list.
    return waitFor.then(() => {
      return Item.findOne({_id: req.body.item}).exec();
    }).then(list => {
      if (list === null) {
        res.status(404).send({
          status: 'err',
          msg: "No such item to add to the list. Try another item?",
          code: 'net.rgaus.lunchbox.item_no_exist',
        });
        return
      }

      // verify the specified quantity is allowed
      // TODO: make unit `volume` and `mass` work too
      if (list.requireQuantityIn && list.requireQuantityIn.unit === 'custom') {
        let endsInCustomQuantity = list.requireQuantityIn.customChoices.find(end => {
          return req.body.quantity.endsWith(end);
        });

        if (!endsInCustomQuantity) {
          return res.status(400).send({
            status: 'err',
            msg: `The given item doesn't end in one of the permitted quantities. It must end in ${list.requireQuantityIn.customChoices.join(' or ')}`,
            code: 'net.rgaus.lunchbox.quantity_not_permitted',
          });
        }
      }

      // Once all checks are passed, add the item to the list.
      return Item
      .update({
        _id: req.params.listId,
        type: 'list',
      }, {
        $push: {
          contents: Object.assign({}, list.toObject(), {
            quantity: req.body.quantity,
          }),
        },
      }).exec().then(item => {
        res.status(201).send({status: 'ok'});
      });
    }).catch(err => console.error(err))
  });

  // update a list item
  router.put('/lists/:listId/contents/:itemId', (req, res) => {
    // body = {data: 'goes here', acts: 'like a patch'}
    return Item.findOne({_id: req.params.listId}).exec().then(list => {
      if (list === null) {
        return res.status(404).send({
          status: 'err',
          msg: `No such list ${req.params.listId}.`,
          code: 'net.rgaus.lunchbox.no_such_list',
        });
      }

      // Is the item we're trying to update in the list? If not complain loudly.
      let isInList = list.contents.find(i => i._id.toString() === req.params.itemId);
      if (!isInList) {
        return res.status(404).send({
          status: 'err',
          msg: `No such item ${req.params.itemId} in list ${req.params.listId}.`,
          code: 'net.rgaus.lunchbox.no_such_list',
        });
      }

      // Once all checks are passed, update the item within the list.
      return Item.update({
        _id: req.params.listId,
        type: 'list',
      }, {
        contents: list.contents.map(i => {
          if (i._id.toString() === req.params.itemId) {
            return Object.assign({}, i, req.body);
          } else {
            return i;
          }
        }),
      }).exec().then(({nModified}) => {
        res.status(200).send({status: 'ok', nModified});
      });
    }).catch(err => console.error(err));
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

  // Fetch recipes from recipe puppy
  // This is just a hack to get around cors really.
  router.get('/remote-recipes', (req, res) => {
    request({
      method: 'GET',
      url: `http://www.recipepuppy.com/api/`,
      qs: req.query,
    }).pipe(res);
  });

  router.get('/match-recipes', (req, res) => {
    let recipeScores = {};
    let allRecipes = {};

    // get all data in the pantry
    return Item.findOne({listType: 'pantry'}).exec().then(({contents}) => {
      let pantry = contents.map(({_id}) => _id);

      // Loop through each ite in the pantry and find all items that include the
      // given pantry item. Increment each score.
      let all = pantry.map(_id => {
        return Item.find({
          listType: 'recipe',
          contents: {$elemMatch: {_id}},
        }).exec().then(data => {
          data.map(item => {
            // store all recipe details
            allRecipes[item._id] = item;

            // increment the score for each matching item
            if (!item) {
              return
            } else if (recipeScores[item._id]) {
              recipeScores[item._id] += 1;
            } else {
              recipeScores[item._id] = 1;
            }
          });
        });
      });

      return Promise.all(all).then(() => {
        // sort the object by value, acending
        let recipes = Object.keys(recipeScores)
        .sort((a, b) => { // sort item ids in the correct order
          return recipeScores[a] - recipeScores[b];
        }).map(i => { // map item ids to the results
          return Object.assign({}, allRecipes[i].toObject(), {
            // The score is the amount of items that are in the pantry over the
            // amount of items in the recipe. So, if 1 item in a recipe is in
            // the pantry and there are two items in total in the recipe, the
            // score would be 1/2.
            score: recipeScores[i] / allRecipes[i].contents.length,
          });
        });

        res.send({recipes});
      });
    });
  });

  return router;
}
