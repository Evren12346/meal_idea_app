const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

app.get('/api/meals', (req, res) => {
  const file = path.join(__dirname, 'meals.json');
  fs.readFile(file, 'utf8', (err, data) => {
    if(err){
      return res.status(500).json({error:'Could not read meals data'});
    }
    try{ const j = JSON.parse(data); return res.json(j)}catch(e){return res.status(500).json({error:'Invalid JSON'})}
  })
});

app.listen(PORT, ()=>console.log(`Meal idea app running on http://localhost:${PORT}`));
