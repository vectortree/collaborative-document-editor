const redisClient = require('../redis-client');
const Y = require('yjs');
// const Base64 = require('js-base64');
const { v1: uuidv1 } = require('uuid');

async function routes(app, options) {

    app.post('/collection/create', async (request, reply) => {
        // Question: Should document names be unique?
        if(!request.session || !request.session.user) {
            //reply.code(401);
            return { error: true, message: 'Unauthorized' };
        }
        const { name } = request.body;
        if(!name) {
            //reply.code(422);
            return { error: true, message: 'Null document name' };
        }
        if(name.trim() === '') {
            //reply.code(422);
            return { error: true, message: 'Blank document name' };
        }
        const ydoc = new Y.Doc();
        const id = uuidv1();
        const update = JSON.stringify(Array.from(Y.encodeStateAsUpdateV2(ydoc)));
        const document = {
            name: name,
            update: update
        };
        try {
            await redisClient.hset(id, document);
            const timestamp = Date.now();
            await redisClient.zadd('documents', timestamp, id);
            const indexExists = await app.elastic.indices.exists({
                index: 'documents'
            });
            console.log(indexExists);
            if(!indexExists) {
                await app.elastic.indices.create({
                    index: 'documents',
                    settings: {
                        analysis: {
                            analyzer: {
                                default: {
                                    tokenizer: 'standard',
                                    filter: ['lowercase', 'stemmer', 'stop']
                                }
                            }
                        }
                    },
                    mappings: {
                        properties: {
                            suggest: {
                                type: 'completion',
                                analyzer: 'standard'
                            }
                        }
                    }
                });
            }
            const documentText = ydoc.getText().toString();
            await app.elastic.index({
                index: 'documents',
                id: id,
                document: {
                    name: name,
                    text: documentText,
                    suggest: []
                }
            });
            return { id: id };
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }

    });

    app.post('/collection/delete', async (request, reply) => {
        if(!request.session || !request.session.user) {
            //reply.code(401);
            return { error: true, message: 'Unauthorized' };
        }
        const { id } = request.body;
        if(!id) {
            //reply.code(422);
            return { error: true, message: 'Null document ID' };
        }
        if(id.trim() === '') {
            //reply.code(422);
            return { error: true, message: 'Blank document ID' };
        }
        try {
            await redisClient.del(id);
            await redisClient.zrem('documents', id);
            await app.elastic.delete({
                index: 'documents',
                id: id,
                refresh: true,
            });
            return { status: 'OK' };
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });

    app.get('/collection/list', async (request, reply) => {
        if(!request.session || !request.session.user) {
            //reply.code(401);
            return { error: true, message: 'Unauthorized' };
        }
        try {
            const documentIds = await redisClient.zrange('documents', -10, -1);
            const list = [];
            await Promise.all(documentIds.map(async (id) => {
                const name = await redisClient.hget(id, 'name');
                if(!name) throw new Error();
                const document = { id: id, name: name };
                list.push(document);
            }));
            //console.log(list);
            return JSON.stringify(list.reverse());
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });
}

module.exports = routes;