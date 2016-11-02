import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  // both
  name: 'string',
  tags: ['string'],
  type: 'string',

  // list only
  listType: 'string',
  contents: ['List'],

  // item only
  quantity: 'string',
});

// Add full-text search on the name
schema.index({name: 'text'});

export default mongoose.model('List', schema);
