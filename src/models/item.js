import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  // both
  name: 'string',
  tags: ['string'],
  type: 'string',

  // list only
  listType: 'string',
  contents: ['List'],
  recipeHref: 'string', // a link to the recipe to make the thing

  // item only
  quantity: 'string',
  // a required quantity unit, eg. loaf or tortilla
  requireQuantityIn: {
    type: 'object',
    unit: 'string', // 'all', 'mass', 'volume', 'custom' (all is default)
    customChoices: ['string'], // for custom type, pick some choices
  },
});

// Add full-text search on the name
schema.index({name: 'text'});

export default mongoose.model('List', schema);
