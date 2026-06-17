const express = require('express');
const requireAuth = require('../middleware/auth.js');
const data = require('../data.js');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json(data.getHistory());
});

module.exports = router;
