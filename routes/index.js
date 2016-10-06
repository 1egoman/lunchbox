var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

// Items
router.get('/items')
router.get('/items/:id')
router.post('/items')
router.put('/items/:id')

// List
router.get('/lists')
router.get('/lists/:id')
router.post('/lists')
router.put('/lists')

module.exports = router;
