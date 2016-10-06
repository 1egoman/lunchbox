import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: {'type': 'string'},
  tags: [{'type': 'string'}],
  contents: [{type: mongoose.Schema.Types.ObjectId}],
});

export default mongoose.model(schema, 'List'):
