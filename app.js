const fs = require('fs').promises;
const path = require('path');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const axios = require('axios')

const PORT = 3000
const CHAR_POSSIBILITIES = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', socket => { });

let seen = {};
let diff = 0;
let founddiff = 0;
let old = 0;
let n = 1;
let found = 0;

let elapsed = 0;

const MIMES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif"
}

async function get_image() {
    const code = [...Array(7)].map(v => CHAR_POSSIBILITIES[Math.floor(Math.random() * CHAR_POSSIBILITIES.length)]).join('')

    if (seen[code]) {
        return;
    }

    io.emit('get found', found);
    io.emit('get foundspermin', founddiff);

    try {
        const { status, headers, data, request: { res } } = await axios.get(`https://i.imgur.com/${code}.png`, {
            responseType: 'arraybuffer',
        })

        io.emit('get crawled', n++);
        io.emit('get reqpers', diff++);

        if (status === 200 && res.responseUrl !== 'https://i.imgur.com/removed.png' && data) {
            seen[code] = 1;

            io.emit('get found', found++);

            const name = `${code}.${MIMES[headers["content-type"]] || "jpg"}`
            await fs.writeFile(path.resolve(`imgs/${name}`), data, {
                encoding: 'binary',
            })
        } else {
            seen[code] = 0;
        }
    } catch (e) {
        if (e.code !== 'ETIMEDOUT' && e.code !== 'ECONNRESET' && e.code !== 'ENOTFOUND') {
            console.error(`Got error: ${e.message}`);
        }
    }
}

void async function () {
    seen = JSON.parse(await fs.readFile('seen.json'))
    elapsed = parseInt(await fs.readFile('elapsed.json'))

    const seen_count = Object.keys(seen).length
    n = seen_count
    old = seen_count

    found = Object.keys(seen).filter(code => seen[code] === 1).length

    const intervals = [
        setInterval(get_image, 0),
        setInterval(() => {
            diff = n - old;
            old = n;

            io.emit('get elapsed', elapsed++);
        }, 1000),
    ]

    process.on('SIGINT', async () => {
        for (let timer of intervals) clearInterval(timer)

        await Promise.all([
            fs.writeFile('seen.json', JSON.stringify(seen)),
            fs.writeFile('elapsed.json', elapsed),
        ])

        process.exit();
    });

    http.listen(PORT, function () {
        console.log(`Listening on http://localhost:${PORT}`);
    });
}()
