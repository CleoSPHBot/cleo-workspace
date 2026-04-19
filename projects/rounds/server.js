const express = require('express');
const path = require('path');
const app = express();
const PORT = 8766;

// No-cache for fast iteration
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(express.static(path.join(__dirname, 'prototype')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rounds prototype running on http://0.0.0.0:${PORT}`);
});
