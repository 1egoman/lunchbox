import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: {'type': 'string'},
  tags: ['string'],
  items: [{type: mongoose.Schema.Types.ObjectId, ref: 'Item'}],
  lists: [{type: mongoose.Schema.Types.ObjectId, ref: 'List'}],
});

export default mongoose.model('List', schema);
