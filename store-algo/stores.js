"use strict";
const accounting = require('accounting');
const bluebird = require('bluebird');
const Unitz = require('unitz');

let defaultStoreReference = {
  wegmans: {
    'Carrot': {
      '1 carrot': '$3.00',
    },
    'Tortillas': {
      '8 tortillas': '$8.00',
    },
    'Cheddar Cheese': {
      '8 oz': '$2.00',
    },
  },
};


// Given an itemid and store search strategy, find the price and the store to
// buy an item at.
exports.getItemPrice = function getItemPrice(itemId, quantityRequested, store, compareAtUnit, storeReference) {
  compareAtUnit = compareAtUnit || 'cup'; // TODO: what happens if a cup isn't a valid unit in this context?
  storeReference = storeReference || defaultStoreReference;
  let prices = [];
  let stores = [];

  // Which store do we want to buy the item at?
  for (let storeName in storeReference) {
    let storePrices = storeReference[storeName][itemId];
    if (storePrices) {
      // the given store has the item!
      // Find the best deal on that item at the store
      let bestPrice = Object.keys(storePrices).reduce((acc, qty) => {
        // get the units of the item in a standard format that can be used to
        // make a fair compairison
        let commonComparisonQuantity = Unitz.parse(qty).convert(compareAtUnit);

        // Round up to the next whole package, since we can't buy half a package
        commonComparisonQuantity = Math.ceil(commonComparisonQuantity);
        if (commonComparisonQuantity === 0) {
          commonComparisonQuantity = 1; // a minumum of one is allowed
        }
        // console.log('commonComparisonQuantity', commonComparisonQuantity)
        // if (commonComparisonQuantity > 1) {
        //   console.warn('partial package was attempted, rounding up to 1 whole package')
        //   commonComparisonQuantity = 1;
        // }

        // calculate how many of the units that can be bought would be required
        // to have enough ingredient for the given item
        // multiplier = the amount needed in the comparison unit
        let multiplier = Unitz.parse(quantityRequested).convert(compareAtUnit) || 1;
        // commonComparisonQuantity = Math.ceil(commonComparisonQuantity / multiplier) * multiplier;

        // Compute the cost per comparison unit, in units of cost per unit
        let totalCost = accounting.unformat(storePrices[qty]) / commonComparisonQuantity;
        totalCost *= multiplier; // multiply by the number of units we need
        // console.log('It costs', totalCost, `(${totalCost/multiplier} * ${multiplier})`, 'to get', quantityRequested, 'of this item. It comes in', qty, `sized packages`)

        // if we only calculated for part of a package
        // if our calculated price ended up being less than the price of one
        // package
        if (totalCost < accounting.unformat(storePrices[qty])) {
          return acc;
        }

        // If this is the lowest, make it the one to beat.
        if (
          Math.min(
            totalCost, // our current cost
            accounting.unformat(acc.totalCost) // the so-far lowest cost
          ) === totalCost
        ) {
          // Round up. If we needed a fractional part of an item, make sure that
          // we get "an extra". For example, if we need 1.5 of something, we
          // need to buy 2 of them.
          let unitsRequired = Math.ceil(totalCost / accounting.unformat(storePrices[qty]));
          let unRoundedTotalCost = unitsRequired * accounting.unformat(storePrices[qty]);

          return {
            totalCost: accounting.formatMoney(unRoundedTotalCost), // "the total cost of all jars"
            unitsRequired, // "the amount of jars"
            pricePerUnit: storePrices[qty], // "the cost per jar"
            quantityProductSoldIn: qty, // "the size of the jar"
          };
        } else {
          return acc;
        }
      }, {totalCost: Infinity});

      // make sure the store actually carries the item
      if (bestPrice.totalCost !== Infinity) {
        // add the store to the comparison
        prices.push(bestPrice);
        stores.push(storeName);
      }
    }
  }

  switch (store && store.type) {
    // "first" method: just pick the first store.
    case 'first':
      if (prices.length) {
        return Object.assign({}, prices[0], {store: stores[0]})
      } else {
        return Promise.reject(new Error(`There are no matching prices for this item at the given stores.`));
      }
    // "cheapest" method: pick the cheapest store
    case undefined:
    case 'cheapest':
      let parsedPrices = prices.map(p => accounting.unformat(p.totalCost));
      let index = parsedPrices.indexOf(Math.min.apply(null, parsedPrices));
      return Object.assign({}, prices[index], {store: stores[index]})
    default:
      return Promise.reject(new Error(`No such store type: ${store.type}`));
  }
}


// console.log(exports.getItemPrice(
//   'milk-id', // item id
//   '2 cups', // how much of the item is needed
//   {type: 'first'} // the store selector to pick which store to use
// ))
