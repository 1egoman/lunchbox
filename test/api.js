"use strict";
import constructRouter, {PAGE_LENGTH} from '../src/routes/api';
const assert = require('assert');
const supertest = require('supertest');
const sinon = require('sinon');

// Given a router, bind it to a server so we can test against it.
function routerToServer(router) {
  const express = require('express');
  let app = express();
  app.use('/v1', router);

  return app;
}

describe('api router', function() {
  it('should get all items/lists', function(done) {
    let itemArray = [{foo: 'bar'}];

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
});
