"use strict";
import constructRouter, {PAGE_LENGTH} from '../src/routes/api';
const assert = require('assert');
const supertest = require('supertest');
const sinon = require('sinon');
import {v4 as uuid} from 'uuid';
import faker from 'faker';

// just for the mongoose.Types.ObjectId constructor
import mongoose from 'mongoose';

function generateId() {
  return uuid().replace(/-/g, '').slice(0, 24);
}

function mockItem() {
  return {
    _id: generateId(),
    name: faker.internet.userName(),
    type: 'item',
    quantity: '1 cup',
  };
}

function mockList({listType}) {
  let contents = [];
  let howManyItems = Math.floor(Math.random() * 10);

  for (let i = 0; i < howManyItems; i++) {
    contents.push(mockItem());
  }

  return {
    _id: generateId(),
    type: 'list',
    name: faker.internet.userName(),
    listType: listType || 'recipe',
    contents,
    tags: [],
  };
}

// Given a router, bind it to a server so we can test against it.
function routerToServer(router) {
  const express = require('express');
  let app = express();
  app.use(require('body-parser').json());
  app.use('/v1', router);

  return app;
}

describe('api router', function() {
  // GET /items
  it('should get all items/lists', function(done) {
    let itemArray = [mockItem(), mockItem(), mockItem()];

    // Mock out the model
    let model = {};
    model.find = sinon.stub().withArgs({}).returns(model);
    model.select = sinon.stub().withArgs('-__v').returns(model);
    model.exec = sinon.stub().withArgs().resolves(itemArray); // response!

    // Paginate
    model.skip = sinon.stub().withArgs(0).returns(model);
    model.limit = sinon.stub().withArgs(PAGE_LENGTH).returns(model);

    // Create the roter with the specified model
    let router = constructRouter(model);

    supertest(routerToServer(router))
    .get('/v1/items?page=0')
    .expect(200, JSON.stringify({
      status: 'ok',
      data: itemArray,
    }), done)
  });

  // GET /items/:id
  it('should get one item/list', function(done) {
    let item = mockItem();

    // Mock out the model
    let model = {};
    model.findOne = sinon.stub().withArgs({_id: item._id}).returns(model);
    model.select = sinon.stub().withArgs('-__v').returns(model);
    model.exec = sinon.stub().withArgs().resolves(item); // response!

    // Create the roter with the specified model
    let router = constructRouter(model);

    supertest(routerToServer(router))
    .get(`/v1/items/${item._id}`)
    .expect(200, JSON.stringify(item), done)
  });
  it(`should not get one item/list when it doesn't exist`, function(done) {
    // Mock out the model
    let model = {};
    model.findOne = sinon.stub().withArgs({_id: "foo"}).returns(model);
    model.select = sinon.stub().withArgs('-__v').returns(model);
    model.exec = sinon.stub().withArgs().resolves(null); // response!

    // Create the roter with the specified model
    let router = constructRouter(model);

    supertest(routerToServer(router))
    .get(`/v1/items/foo`) // foo isn't an item id
    .expect(404, JSON.stringify({
      status: 'ok',
      msg: 'No such item.',
      code: 'net.rgaus.lunchbox.no_such_list',
    }), done)
  });

  // POST /items
  it(`should create a new item`, function(done) {
    let item = mockItem();

    // Mock out the model methods
    let methods = {};
    methods.save = sinon.stub().withArgs().resolves(item); // response!

    // Add methods to the model
    let model = sinon.stub().returns(methods);

    // Create the roter with the specified model
    let router = constructRouter(model);

    supertest(routerToServer(router))
    .post(`/v1/items`) // foo isn't an item id
    .send(item)
    .expect(201, JSON.stringify({
      status: 'ok',
      id: item._id,
    }), done);
  });

  // PUT /items/:id
  it(`should update an item`, function(done) {
    let item = mockItem();
    let changeset = {foo: 'bar'};

    // Mock out the model
    let model = {};
    model.update = sinon.stub().withArgs({_id: item._id}, changeset).returns(model);
    model.exec = sinon.stub().withArgs().resolves({nModified: 1}); // success response!

    // Create the roter with the specified model
    let router = constructRouter(model);

    supertest(routerToServer(router))
    .put(`/v1/items/${item._id}`)
    .send(changeset)
    .expect(JSON.stringify({
      status: 'ok',
      nmodified: 1,
    }), done);
  });

  // DELETE /items/:id
  // FIXME: Why is the response body empty?
  it.skip(`should remove an item`, function(done) {
    let item = mockItem();

    // Mock out the model
    let model = {};
    model.remove = sinon.stub().withArgs({_id: item._id}).returns(model);
    model.exec = sinon.stub().withArgs().resolves({nModified: 1}); // success response!

    // Create the roter with the specified model
    let router = constructRouter(model);

    supertest(routerToServer(router))
    .delete(`/v1/items/${item._id}`)
    .expect(JSON.stringify({
      status: 'ok',
      nmodified: 1,
    }), done);
  });

  it(`should add an item to a list`, function(done) {
    let list = mockList({listType: 'recipe'});
    let item = mockItem();
    item.toObject = () => item; // a stupid mongoose mock thing

    // Mock out the model
    let model = {};
    let findOneExec = sinon.stub().withArgs().resolves(item);
    model.findOne = sinon.stub().withArgs({_id: item._id}).returns({exec: findOneExec});
    let updateExec = sinon.stub().withArgs().resolves({nModified: 1}); // success response!
    model.update = sinon.stub().withArgs({
      _id: list._id,
      type: 'list',
    }, {
      $push: {
        contents: Object.assign({}, item, {quantity: '1 cup'}),
      },
    }).returns({exec: updateExec});

    // Create the roter with the specified model
    let router = constructRouter(model);

    supertest(routerToServer(router))
    .post(`/v1/lists/${list._id}/contents`)
    .send({item: item._id, quantity: '1 cup'})
    .expect(201, JSON.stringify({status: 'ok'}), done);
  });
  it(`should fail to add an item that doesn't exist to a list`, function(done) {
    let list = mockList({listType: 'recipe'});
    let item = mockItem();
    item.toObject = () => item; // a stupid mongoose mock thing

    // Mock out the model
    let model = {};
    let findOneExec = sinon.stub().withArgs().resolves(null); // no item found!
    model.findOne = sinon.stub().withArgs({_id: item._id}).returns({exec: findOneExec});

    // Create the roter with the specified model
    let router = constructRouter(model);

    supertest(routerToServer(router))
    .post(`/v1/lists/${list._id}/contents`)
    .send({item: item._id, quantity: '1 cup'})
    .expect(404, JSON.stringify({
        status: 'err',
        msg: "No such item to add to the list. Try another item?",
        code: 'net.rgaus.lunchbox.item_no_exist',
    }), done);
  });
  it(`should fail to add a new item to a list with an unpermitted unit`, function(done) {
    let item = Object.assign({}, mockItem(), {
      requireQuantityIn: {
        unit: 'custom', customChoices: ['foo'],
      },
    });
    let list = mockList({listType: 'recipe'});
    item.toObject = () => item; // a stupid mongoose mock thing

    // Mock out the model
    let model = {};
    let findOneExec = sinon.stub().withArgs().resolves(item);
    model.findOne = sinon.stub().withArgs({_id: item._id}).returns({exec: findOneExec});
    let updateExec = sinon.stub().withArgs().resolves({nModified: 1}); // success response!
    model.update = sinon.stub().withArgs({
      _id: list._id,
      type: 'list',
    }, {
      $push: {
        contents: Object.assign({}, item, {quantity: '1 cup'}),
      },
    }).returns({exec: updateExec});

    // Create the roter with the specified model
    let router = constructRouter(model);

    supertest(routerToServer(router))
    .post(`/v1/lists/${list._id}/contents`)
    .send({item: item._id, quantity: '1 cup'})
    .expect(400, JSON.stringify({
      status: 'err',
      msg: `The given item doesn't end in one of the permitted quantities. It must end in foo`,
      code: 'net.rgaus.lunchbox.quantity_not_permitted',
    }), done);
  });

  it(`should delete an item from a list`, function(done) {
    let list = mockList({listType: 'recipe'});
    let item = mockItem();
    item.toObject = () => item; // a stupid mongoose mock thing

    // Mock out the model
    let model = {};
    let findOneExec = sinon.stub().withArgs().resolves({nModified: 1}); // response!
    model.update = sinon.stub().withArgs({
      _id: list._id, type: 'list',
    }, {
      $pull: {
        contents: {
          _id: new mongoose.Types.ObjectId(item._id),
        },
      },
    }).returns({exec: findOneExec});

    // Create the roter with the specified model
    let router = constructRouter(model);

    supertest(routerToServer(router))
    .delete(`/v1/lists/${list._id}/contents/${item._id}`)
    .send({item: item._id, quantity: '1 cup'})
    .expect(JSON.stringify({
      status: 'ok',
    }), done);
  });
  it(`should fail to delete an item when that item id idn't in the list`, function(done) {
    let list = mockList({listType: 'recipe'});
    let item = mockItem();
    item.toObject = () => item; // a stupid mongoose mock thing

    // Mock out the model
    let model = {};
    let findOneExec = sinon.stub().withArgs().resolves({nModified: 0}); // couldn't perform the action
    model.update = sinon.stub().withArgs({
      _id: list._id, type: 'list',
    }, {
      $pull: {
        contents: {
          _id: new mongoose.Types.ObjectId(item._id),
        },
      },
    }).returns({exec: findOneExec});

    // Create the roter with the specified model
    let router = constructRouter(model);

    supertest(routerToServer(router))
    .delete(`/v1/lists/${list._id}/contents/${item._id}`)
    .send({item: item._id, quantity: '1 cup'})
    .expect(JSON.stringify({
      status: 'err',
      msg: 'No matching items in the specified list.',
      code: 'net.rgaus.lunchbox.no_items_in_list',
    }), done);
  });

  it(`should calculate all the given items for a list`, function(done) {
    let pantry = mockList({listType: 'pantry'});
    let grocery = mockList({listType: 'grocery'});
    let list = mockList({listType: 'recipe'});

    let item = mockItem();
    item.toObject = () => item; // a stupid mongoose mock thing

    // Mock out the model
    let model = {};
    model.findOne = sinon.stub();
    let pantryExec = sinon.stub().resolves(pantry);
    model.findOne.withArgs({listType: 'pantry'}).returns({exec: pantryExec});
    let groceryExec = sinon.stub().resolves(grocery);
    model.findOne.withArgs({listType: 'grocery'}).returns({exec: groceryExec});

    // mock out the store-algo functions
    // "flattenList"
    // "itemsToBuy"
    // "getItemPrice"

    let storeAlgoMethods = {
      flattenList: sinon.stub().withArgs(list).returns([1, 2, 3]),
      removePantryItemsFromList: sinon.stub().withArgs([1, 2, 3], pantry.contents).returns([4, 5, 6]),
      getItemPrice: sinon.stub().withArgs([4, 5, 6]).returns("item price data"),
    };

    // Create the roter with the specified model
    let router = constructRouter(
      model,
      storeAlgoMethods
    );

    supertest(routerToServer(router))
    .get(`/v1/calc`)
    .expect(JSON.stringify([
      {
        item: 4,
        price: "item price data",
      },
      {
        item: 5,
        price: "item price data",
      },
      {
        item: 6,
        price: "item price data",
      },
    ]), done);
  });
});
