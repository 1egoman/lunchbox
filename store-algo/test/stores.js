"use strict";
const getItemPrice = require('../stores').getItemPrice;
const assert = require('assert');
let storeReference = {
  storeA: {
    itemId: {
      '1 cup': '$5.00',
      '1 pint': '$8.00',
    },
  },
  storeB: {
    itemId: {
      '1 cup': '$4.00',
      '1 pint': '$5.00',
    },
  },
};

describe('stores.getItemPrice', function() {
  describe('quantities', function() {
    it(`should return an amount equal to the input when a quantity of that amt is available`, function() {
      let output = getItemPrice(
        'itemId', // the item
        '2 cups', // how much we want
        {type: 'first'}, // how to pick the store to use
        undefined, // the unit to convert down to in order to compare prices. This uses the default.
        storeReference // Use the above store table when doing the test.
      );

      assert.deepEqual(output, {
        totalCost: '$8.00',
        unitsRequired: 1,
        pricePerUnit: '$8.00',
        quantityProductSoldIn: '1 pint',
        store: 'storeA',
      });
    });
    it(`should return 2 items when the quantity can only work with 2 items`, function() {
      let output = getItemPrice(
        'itemId', // the item
        '4 cups', // how much we want (two pints, twice the sold quantity)
        {type: 'first'}, // how to pick the store to use
        undefined, // the unit to convert down to in order to compare prices. This uses the default.
        storeReference // Use the above store table when doing the test.
      );

      assert.deepEqual(output, {
        totalCost: '$16.00',
        unitsRequired: 2, // we need two of them
        pricePerUnit: '$8.00',
        quantityProductSoldIn: '1 pint',
        store: 'storeA',
      });
    });
    it(`should at minimum return one item (can't buy 1/2 of an item!)`, function() {
      let output = getItemPrice(
        'itemId', // the item
        '1 oz', // how much we want (we need at least one item to fulfil this)
        {type: 'first'}, // how to pick the store to use
        undefined, // the unit to convert down to in order to compare prices. This uses the default.
        storeReference // Use the above store table when doing the test.
      );

      assert.deepEqual(output, {
        totalCost: '$5.00',
        unitsRequired: 1,
        pricePerUnit: '$5.00',
        quantityProductSoldIn: '1 cup',
        store: 'storeA',
      });
    });
    it(`should round up when 1.5 of an item is needed so that we get two of them`, function() {
      let output = getItemPrice(
        'itemId', // the item
        '1.5 pints', // how much we want (this is 1.5x the 1 pint amount)
        {type: 'first'}, // how to pick the store to use
        undefined, // the unit to convert down to in order to compare prices. This uses the default.
        storeReference // Use the above store table when doing the test.
      );

      assert.deepEqual(output, {
        totalCost: '$16.00',
        unitsRequired: 2, // we need two of them even though we only asked for 1.5 of them.
        pricePerUnit: '$8.00',
        quantityProductSoldIn: '1 pint',
        store: 'storeA',
      });
    });
    it(`should, when given the opportunity, take a better deal by buying in bulk.`, function() {
      let output = getItemPrice(
        'itemId', // the item
        '1 gallon', // how much we want (a large quantity that makes this easy to test against)
        {type: 'first'}, // how to pick the store to use
        undefined, // the unit to convert down to in order to compare prices. This uses the default.
        storeReference // Use the above store table when doing the test.
      );

      assert.deepEqual(output, {
        totalCost: '$64.00',
        unitsRequired: 8,
        pricePerUnit: '$8.00',
        quantityProductSoldIn: '1 pint', // purchace by the pint, not the cup
        store: 'storeA',
      });
    });
  });
  describe('store selectors', function() {
    it(`should pick the first store`, function() {
      let output = getItemPrice(
        'itemId', // the item
        '2 cups', // how much we want (2 cups = 1 pint)
        {type: 'first'}, // how to pick the store to use
        undefined, // the unit to convert down to in order to compare prices. This uses the default.
        storeReference // Use the above store table when doing the test.
      );

      assert.deepEqual(output, {
        totalCost: '$8.00',
        unitsRequired: 1,
        pricePerUnit: '$8.00',
        quantityProductSoldIn: '1 pint',
        store: 'storeA', // The first store that was specified
      });
    });
    it(`should pick a cheaper store to buy the item if one exists`, function() {
      let output = getItemPrice(
        'itemId', // the item
        '2 cups', // how much we want (2 cups = 1 pint)
        {type: 'cheapest'}, // how to pick the store to use
        undefined, // the unit to convert down to in order to compare prices. This uses the default.
        storeReference // Use the above store table when doing the test.
      );

      assert.deepEqual(output, {
        totalCost: '$5.00',
        unitsRequired: 1,
        pricePerUnit: '$5.00',
        quantityProductSoldIn: '1 pint',
        store: 'storeB',
      });
    });
  });
});
