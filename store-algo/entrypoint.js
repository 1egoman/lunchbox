"use strict";
const priceify = require('./priceify');
const stores = require('./stores');

// Step one: Define all the inputs:
// The list of what meals 
const groceryList = require('./grocerylist.json'); // get a list of items to make
// The pantry is what is currently on-hand.
const pantry = [
  {_id: "cream-cheese", name: "Cream Cheese", quantity: "1 cup"},
];
// The store proeprties are defined in stores.js. Check them ot there!

// Step two: Flatten the list
// This takes all the nested lists and converts to a flat list of items.
// Duplicate items within lists are combined as part of this process.
let flattenedGroceryList = priceify.flattenList(groceryList);

// Step three: Remove items in the pantry already since those don't have to be
// bought. This function has side-effects on `pantry`.
let itemsToBuy = priceify.removePantryItemsFromList(flattenedGroceryList, pantry);

// Step four: Figure out where each item should be bought to get the best deal.
// Each item is fed through, and as an output, a store and a volume tto purchace
// is produced. CHeck out stores.js for more details.
let pricedList = itemsToBuy.map(item => {
  return {
    item,
    price: stores.getItemPrice(item._id, item.quantity, item.store),
  };
});

console.log(pricedList)