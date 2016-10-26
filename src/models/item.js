import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: {type: 'string'},
  quantity: {type: 'string'},
  store: {
    type: {type: 'string'},
  },
  tags: ['string'],
});

export default mongoose.model('Item', schema);
