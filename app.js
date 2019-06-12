const https = require('https');
const fs = require('fs');
const path = require('path');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', socket => {});

function randomChar() {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return possible.charAt(Math.floor(Math.random() * possible.length));
}

let seen = {};
let diff = 0;
let founddiff = 0;
let old = 0;
let oldfound = 0;
let n = 1;
let found = 0;

let elapsed = 0;

const mimes = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif"
}

function getImage() {
    let code = "";

    for (let j = 0; j < 7; j++) {
        code += randomChar();
    }

    if (!seen[code]) {
        io.emit('get found', found);
        io.emit('get foundspermin', founddiff);

        https.get(`https://i.imgur.com/${code}.png`, res => {
            let data = "";
            res.setEncoding('binary');

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                io.emit('get crawled', n++);
                io.emit('get reqpers', diff++);

                if (data) {
                    seen[code] = 1;

                    io.emit('get found', found++);

                    fs.writeFile(path.resolve(`imgs/${code}.${mimes[res.headers["content-type"]] ? mimes[res.headers["content-type"]] : "jpg"}`), data, {
                        encoding: 'binary'
                    }, err => {
                        if (err) console.log(err);
                    });
                } else {
                    seen[code] = 0;
                }
            });

            res.on('error', err => {
                console.log(err);
            });
        }).on('error', (e) => {
            if (e.code !== 'ETIMEDOUT' && e.code !== 'ECONNRESET' && e.code !== 'ENOTFOUND') {
                console.error(`Got error: ${e.message}`);
            }
        });
    }
}

fs.readFile('seen.json', (err, data) => {
    fs.readFile('elapsed.json', (err, data) => {
        if (data) {
            elapsed = parseInt(data);
        }
    });

    if (data) {
        seen = JSON.parse(data);

        Object.keys(seen).forEach(code => {
            if (seen[code] === 1) {
                found++;
                oldfound++;
            }

            n++;
            old++;
        });
    }

    const timer = setInterval(() => {
        getImage();
    }, 0);

    const seconds = setInterval(() => {
        diff = n - old;
        old = n;

        io.emit('get elapsed', elapsed++);
    }, 1000);

    const minutes = setInterval(() => {
        oldfound = found;
    }, 60000);

    process.on('SIGINT', () => {
        clearInterval(timer);

        fs.writeFile('seen.json', JSON.stringify(seen), err => {
            fs.writeFile('elapsed.json', elapsed, err => {
                if (err) console.log(err);

                process.exit();
            });
        });
    });
});

const PORT = 3000;
http.listen(PORT, function () {
    console.log(`listening on *:${PORT}`);
});