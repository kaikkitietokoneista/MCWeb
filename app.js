require('dotenv').config()
const express = require('express')
const app = express()
const session = require('express-session')
const mineflayer = require('mineflayer')
const server = app.listen(process.env.PORT);
const io = require('socket.io').listen(server);
const motd2html = require('./motd2html');
const xss = require("xss");

let sess = {
    secret: 'keyboard cat',
    cookie: {}
}
if (app.get('env') === 'PRODUCTION') {
    app.set('trust proxy', 1) // trust first proxy
    sess.cookie.secure = true // serve secure cookies
}

app.use(session(sess))
app.set('view engine', 'ejs')
app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded()); // to support URL-encoded bodies
app.use(express.static('public'))

let users = new Object()
let sockets = new Object()

app.get('/', function (req, res) {
    if (req.session.user) {
        res.redirect('/chat')
    }
    res.render('index')
})

app.post('/login', function (req, res) {
    if (users[req.session.id]) {
        res.redirect('/chat')
    } else {
        if (req.body.email && req.body.password && req.body.hostname) {
            users[req.session.id] = mineflayer.createBot({
                host: req.body.hostname,
                username: req.body.email,
                password: req.body.password
            })
            res.redirect('/chat')
        } else {
            res.redirect('/')
        }
    }
})

app.get('/login', function (req, res) {
    if (users[req.session.id]) {
        res.redirect('/chat')
    } else {
        res.redirect('/')
    }
})

app.get('/chat', function (req, res) {
    if (users[req.session.id]) {
        res.render('chat', {
            sessid: req.session.id
        })
    } else {
        res.redirect('/')
    }
})

app.get('/kirjaudu-ulos', function (req, res) {
    delete users[req.session.id]
    req.session.destroy(function(err) {
        if (err) throw err
        res.redirect('/')
    })
})


io.on('connection', (socket) => {
    socket.on('chatstart', function(sessid) {
        try {
            sockets[socket.id] = sessid
            users[sessid].on('message', function (jsonMsg) {
                socket.emit('chat message', {message: motd2html.toHtml(xss(jsonMsg.toMotd()))})
            })
            socket.on('chat message', function(message) {
                users[sessid].chat(message)
            })    
        } catch (error) {
            socket.emit('chat message', {message: 'Please login again. You are currently not logged in.'})
        }
    })
    console.log('a user connected');
    socket.on('disconnect', () => {
        users[sessid].quit('Bye bye!')
        let sessid = sockets[socket.id] 
        delete users[sessid]
        console.log('user disconnected');
    })
})
