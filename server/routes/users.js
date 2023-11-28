const validator = require('email-validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const redisClient = require('../redis-client');
const { getClients, setClients } = require('../clients');

async function routes(app, options) {

    app.post('/users/signup', async (request, reply) => {
        //console.log('signup');
        //console.log(request.body);
        const { name, email, password } = request.body;
        if(!name || !email || !password) {
            //reply.code(422);
            return { error: true, message: 'Null field(s)' };
        }
        if(name.trim() === '' || email.trim() === '') {
            //reply.code(422);
            return { error: true, message: 'Blank field(s)' };
        }
        if(!validator.validate(email)) {
            //reply.code(422);
            return { error: true, message: 'Invalid email' };
        }
        try {
            const user = await redisClient.hgetall(email);
            if(user.name) {
                //reply.code(409);
                return { error: true, message: 'This email is already registered' };
            }
            const hash = await bcrypt.hash(password, 10);
            const key = crypto.randomBytes(64).toString('hex');
            const newUser = {
                name: name,
                hash: hash,
                key: key
            };
            await redisClient.hset(email, newUser);
            const transport = nodemailer.createTransport({
                host: 'localhost',
                port: 25,
                tls: { rejectUnauthorized: false }
            });
            const link = 'http://comet.cse356.compas.cs.stonybrook.edu/users/verify?email=' +
                            encodeURIComponent(email) + '&key=' + encodeURIComponent(key);
            //console.log(link);
            let message = {
                from: 'no-reply@comet.cse356.compas.cs.stonybrook.edu',
                to: email,
                subject: 'Activate your account',
                text: link
            };
            const info = await transport.sendMail(message);
            //console.log(info);
            //return reply.sendFile('html/verify.html');
            return { status: 'OK' };
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });

    app.post('/users/login', async (request, reply) => {
        const { email, password } = request.body;
        if(!email || !password) {
            //reply.code(422);
            return { error: true, message: 'Null field(s)' };
        }
        if(email.trim() === '') {
            //reply.code(422);
            return { error: true, message: 'Blank email' };
        }
        try {
            const user = await redisClient.hgetall(email);
            if(!user.name) {
                //reply.code(404);
                return { error: true, message: 'User does not exist' };
            }
            if(user.key) {
                //reply.code(409);
                return { error: true, message: 'User is not verified' };
            }
            const valid = await bcrypt.compare(password, user.hash);
            if(!valid) {
                //reply.code(401);
                return { error: true, message: 'Incorrect password' };
            }
            request.session.user = {
                name: user.name,
                email: user.email
            };
            return { name: user.name };
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });

    app.post('/users/logout', async (request, reply) => {
        if(!request.session || !request.session.user) {
            //reply.code(401);
            return { error: true, message: 'Unauthorized' };
        }
        try {
            await request.session.destroy();
            //terminateConnections(request.cookies.sessionId);
            reply.clearCookie('sessionId');
            return { status: 'OK' };
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });

    app.get('/users/verify', async (request, reply) => {
        //console.log('Received GET request for user verification');
        //console.log(request.query);
        const { email, key } = request.query;
        if(!email || !key) {
            //reply.code(422);
            return { error: true, message: 'Null field(s)' };
        }
        if(email.trim() === '' || key.trim() === '') {
            //reply.code(422);
            return { error: true, message: 'Blank field(s)' };
        }
        try {
            const user = await redisClient.hgetall(email);
            //console.log(user);
            if(!user.name) {
                //reply.code(404);
                return { error: true, message: 'User does not exist' };
            }
            if(user.key) {
                if(user.key !== key) {
                    //reply.code(401);
                    return { error: true, message: 'Invalid key' };
                }
                await redisClient.hdel(email, 'key');
            }
            return { status: 'OK' };
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });

    async function terminateConnections(sessionId) {
        //console.log('Terminating all connections with this user');
        let clients = getClients();
        let newClients = clients.filter(client => client.session_id !== sessionId);
        await Promise.all(clients
        .filter(client => client.session_id === sessionId)
        .map(async (client) => {
            client.reply.raw.end();
        }));
        setClients(newClients);
    }
}

module.exports = routes;