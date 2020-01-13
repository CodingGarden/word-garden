const path = require('path');
const http = require('http');
const express = require('express');

const sockets = require('./sockets');

const app = express();
const staticPath = path.join(__dirname, '../public');
app.use(express.static(staticPath, { extensions: [ 'html' ] }));

const server = http.createServer(app);

sockets(server);

const port = process.env.PORT || 3453;
server.listen(port, () => {
	console.log(`Listening http://localhost:${port}`);
});