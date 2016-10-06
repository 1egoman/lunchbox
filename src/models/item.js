import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: {'type': 'string'},
  tags: [{'type': 'string'}],
  price: {'type': 'number'},
});
