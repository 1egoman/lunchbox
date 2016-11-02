"use strict";
import constructRouter, {PAGE_LENGTH} from '../src/routes/api';
const assert = require('assert');
const supertest = require('supertest');
const sinon = require('sinon');
import {v4 as uuid} from 'uuid';
import faker from 'faker';

function mockItem() {
  return {
    _id: uuid(),
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
    _id: uuid(),
    type,
    name: "Sample item",
    listType: listType || 'recipe',
    contents,
    tags: [],
  };
}

// Given a router, bind it to a server so we can test against it.
function routerToServer(router) {
  const express = require('express');
  let app = express();
  app.use('/v1', router);

  return app;
}

describe('api router', function() {
  it.skip('should get all items/lists', function(done) {
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
    .expect(JSON.stringify({
      status: 'ok',
      data: itemArray,
    }), done)
  });
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
    .expect(JSON.stringify(item), done)
  });
});
