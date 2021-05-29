const express = require('express');
const app = express();
//const PORT = 8080;
const PORT = process.env.PORT || 8080;

app.use(express.static(__dirname + '/src'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/src/index.html'));
});

app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));
