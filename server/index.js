require('dotenv').config();
const app = require('fastify')();
const path = require('path');
const autoload = require('@fastify/autoload');
const cookie = require('@fastify/cookie');
const session = require('@fastify/session');
const RedisStore = require('connect-redis')(session);
const redisClient = require('./redis-client');
const QuillDeltaToHtmlConverter = require('quill-delta-to-html').QuillDeltaToHtmlConverter;

app.addHook('onSend', async (request, reply) => {
    reply.header('X-CSE356', '6306e45058d8bb3ef7f6c3ab');
});

app.register(cookie);
app.register(session, {
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
    cookie: {
        secure: 'auto',
        maxAge: 86400000 // 24 * 60 * 60 * 1000
    },
    store: new RedisStore({
        client: redisClient,
        ttl: 86400 // 24 * 60 * 60
    })
});
app.register(require('@fastify/elasticsearch'), { node: process.env.ELASTICSEARCH_URL });
app.register(require('@fastify/multipart'));
app.register(require('@fastify/formbody'));
app.register(require('@fastify/static'), {
    root: path.join(__dirname, '../public')
});
app.register(autoload, { dir: path.join(__dirname, 'routes') });

app.get('/library/crdt.js', async (request, reply) => {
    return reply.sendFile('dist/crdt.js');
});

app.get('/home', async (request, reply) => {
    if(request.session && request.session.user) {
        // Return the HTML shown to logged in users
        return reply.sendFile('html/home.html');
    }
    else {
        // Return the login page (or unauthorized JSON response)
        //reply.code(401);
        //return { error: true, message: 'Unauthorized' };
        return reply.sendFile('html/login.html');
    }
});

app.get('/edit/:id', async (request, reply) => {
    if(!request.session || !request.session.user) {
        //reply.code(401);
        return { error: true, message: 'Unauthorized' };
    }
    const id = request.params.id;
    if(!id) {
        //reply.code(422);
        return { error: true, message: 'Null document ID' };
    }
    if(id.trim() === '') {
        //reply.code(422);
        return { error: true, message: 'Blank document ID' };
    }
    try {
        const name = await redisClient.hget(id, 'name');
        if(!name) {
            //reply.code(404);
            return { error: true, message: 'Document does not exist' };
        }
        // Serve the editor UI for document with ID :id
        return reply.sendFile('html/editor.html');
    } catch(err) {
        //console.log(err);
        //reply.code(500);
        return { error: true, message: 'Internal server error' };
    }
});

// Extra route for front-end
app.get('/getname/:id', async (request, reply) => {
    if(!request.session || !request.session.user) {
        //reply.code(401);
        return { error: true, message: 'Unauthorized' };
    }
    const id = request.params.id;
    if(!id) {
        //reply.code(422);
        return { error: true, message: 'Null document ID' };
    }
    if(id.trim() === '') {
        //reply.code(422);
        return { error: true, message: 'Blank document ID' };
    }
    try {
        const name = await redisClient.hget(id, 'name');
        if(!name) {
            //reply.code(404);
            return { error: true, message: 'Document does not exist' };
        }
        return JSON.stringify(name);
    } catch(err) {
        //console.log(err);
        //reply.code(500);
        return { error: true, message: 'Internal server error' };
    }
});

// Extra route for front-end
app.get('/signup', async (request, reply) => {
    return reply.sendFile('html/signup.html');
});

const start = async () => {
    try {
        await app.listen({ port: process.env.PORT });
    } catch(err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
/*app.listen({ port: process.env.PORT }, (err, address) => {
    if(err) {
      app.log.error(err);
      process.exit(1);
    }
    //console.log(`Server is now listening on ${address}`);
});*/
module.exports = app;