"use strict";
const Unitz = require('unitz');
const util = require('util');

let input = require('./grocerylist.json')
let getItemPrice = require('./stores').getItemPrice;

// add an item to the items array while ensuring that duplicates are combined
// When it combines dupes, it adds the quantities together.
function addToItemsCombineDupes(initialItems, itemsToAdd) {
  return itemsToAdd.reduce((items, item) => {
    let itemIndex = items.findIndex(i => i._id === item._id);

    if (itemIndex === -1) {
      return [...items, item];
    } else {
      // Add an item to an already exiting quantity
      let itemsCopy = items.slice();
      itemsCopy[itemIndex].quantity = Unitz.combine(
        itemsCopy[itemIndex].quantity,
        item.quantity
      );
      return itemsCopy;
    }
  }, initialItems);
}

// Given a list, convert to an array of items that doesn't have duplicates
// Also, combine quantitys. For example, if there are two recipes that require 1
// cup of milk, the output will have one item with a quantity of 1 pint.
function parseList(list) {
  if (!Array.isArray(list.contents)) {
    throw new Error(`List ${list.name} doesn't have a .contents property that's an array!`)
  }

  // Given a nested tree of lists and items, collapse down into items
  let items = [];
  list.contents.forEach(item => {
    if (item.type === 'item') {
      items = addToItemsCombineDupes(items, [item]);
    } else {
      // must be a list?
      items = addToItemsCombineDupes(items, parseList(item));
    }
  });

  return items;
}

// Do the list assembly for realsies!
let itemList = parseList(input);

let itemPricedList = itemList.map(item => {
  return {
    item,
    price: getItemPrice(item._id, item.quantity, item.store),
  };
});
console.log('\n\n', util.inspect(itemPricedList, false, Infinity, true));
