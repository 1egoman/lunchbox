import express from 'express';
var router = express.Router();

import Item from 'models/item';
import List from 'models/list';

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

// Items
router.get('/items')
router.get('/items/:itemId')
router.post('/items')
router.put('/items/:itemId')

// List
router.get('/lists')
router.get('/lists/:listId')
router.post('/lists')
router.put('/lists/:listId')

// List items
router.get('/lists/:listId/items/:itemId')
router.post('/lists/:listId/items')
router.put('/lists/:listId/items/:itemId')

module.exports = router;
