"use strict";
const Unitz = require('unitz');
const util = require('util');

let input = require('./grocerylist.json')
let getItemPrice = require('./stores').getItemPrice;

// This function will, given a pantry, subtract anything from the recipe ingredients that is already on
// hand. Also, if the recipe uses that item, it will be subtracted from the pantry. Unfortunately, that
// means this function has side effects (on `pantryList`). Whatever though, it works.
export function removePantryItemsFromList(list, pantryList) {
  return list.map(item => {
    // get the amount of the given item that's currently in the pantry
    let pantryItem = pantryList.find(i => i.name === item.name);

    if (pantryItem) {
      // calculate the new quantity
      let quantity = Unitz.subtract(item.quantity, pantryItem.quantity, true);
      if (!quantity.startsWith('-')) {
        // We need to buy some of the item since we don't have it on hand
        return Object.assign({}, item, {quantity});
      } else {
        // we have too much! So we don't have to buy any.
        // remove the amount from the pantry that this recipe takes up
        pantryItem.quantity = quantity.slice(1);
        return false;
      }
    } else {
      return item; // that item isn't in the pantry
    }
  })
  .filter(i => i !== false); // explicitly filter out the false that is specified above
}

// add an item to the items array while ensuring that duplicates are combined
// When it combines dupes, it adds the quantities together.
export function addToItemsCombineDupes(initialItems, itemsToAdd) {
  return itemsToAdd.reduce((items, item) => {
    let itemIndex = items.findIndex(i => i.name === item.name);

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
export function flattenList(list) {
  if (!Array.isArray(list.contents)) {
    throw new Error(`List ${list.name} doesn't have a .contents property that's an array!`)
  }

  // Given a nested tree of lists and items, collapse down into items
  let items = [];
  list.contents.forEach(item => {
    if (item.type === 'item') {
      items = addToItemsCombineDupes(items, [item]);
    } else {
      // Must be a list.
      // Get the quantity of the recipe that was specified (default to 1).
      let quantity = parseInt(item.quantity) || 1;

      // Add the items to the flattened list `quantity` times.
      for (let i = 0; i < quantity; i++) {
        items = addToItemsCombineDupes(items, flattenList(item));
      }
    }
  });

  return items;
}
