import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: {'type': 'string'},
  tags: ['string'],
  price: {'type': 'number'},
});

export default mongoose.model('Item', schema);
