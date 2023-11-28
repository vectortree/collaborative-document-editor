const redisClient = require('../redis-client');
const Y = require('yjs');
// const Base64 = require('js-base64');
const { getClients, setClients, addClient, setClientCursor } = require('../clients');
const { addUpdate, addToBuffer } = require('../update-documents');

async function routes(app, options) {

    app.get('/api/connect/:id', async (request, reply) => {
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
            const update = await redisClient.hget(id, 'update');
            if(!update) {
                //reply.code(404);
                return { error: true, message: 'Document does not exist' };
            }
            const headers = {
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Content-Type': 'text/event-stream'
            };
            reply.hijack();
            reply.raw.writeHead(200, headers);
            reply.raw.flushHeaders();
            addClient(reply, request.cookies.sessionId, request.session.user.name, {});
    
            ////console.log(update);
    
            reply.raw.write('event: sync\ndata: ' + update + '\n\n');
            //console.log('Send latest cursors of other users on same document');
            let clients = getClients();
            await Promise.all(clients
                .filter(client => (client.reply.request.params.id === id && client.session_id !== request.cookies.sessionId))
                .map(async (client) => {
                    let presence = {
                        session_id: client.session_id,
                        name: client.name,
                        cursor: client.cursor
                    };
                    //console.log(presence);
                    reply.raw.write('event: presence\ndata: ' + JSON.stringify(presence) + '\n\n');
                    //console.log('Sent presence event to client');
            }));
        
            request.socket.on('close', async () => {
                //console.log('Client closed connection');
                let clients = getClients();
                let terminatingClient = clients.find(client => client.reply === reply);
                let presence = {
                    session_id: terminatingClient.session_id,
                    name: terminatingClient.name,
                    cursor: {}
                };
                await sendCursortoClients(presence, reply.request.params.id, request.cookies.sessionId);
                let newClients = clients.filter(client => client.reply !== reply);
                setClients(newClients);
                reply.raw.end();
            });
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });
    
    app.post('/api/presence/:id', async (request, reply) => {
        if(!request.session || !request.session.user) {
            //reply.code(401);
            return { error: true, message: 'Unauthorized' };
        }
        const id = request.params.id;
        const { index, length } = request.body;
        if(!id) {
            //reply.code(422);
            return { error: true, message: 'Null document ID' };
        }
        if(id.trim() === '') {
            //reply.code(422);
            return { error: true, message: 'Blank document ID' };
        }
        //console.log('Index: ' + index);
        //console.log('Length ' + length);
        try {
            const update = await redisClient.hget(id, 'update');
            if(!update) {
                //reply.code(404);
                return { error: true, message: 'Document does not exist' };
            }
            let clients = getClients();
            let i = clients.findIndex(client => client.session_id === request.cookies.sessionId);
            if(i == -1) throw new Error();
            if((index != 0 && !index) && (length != 0 && !length)) setClientCursor(i, undefined, undefined);
            else if((index != 0 && !index) || (length != 0 && !length)) {
                //reply.code(422);
                return { error: true, message: 'Null payload' };
            }
            else setClientCursor(i, index, length);
            clients = getClients();
            let presence = { 
                session_id: clients[i].session_id,
                name: clients[i].name,
                cursor: clients[i].cursor
            };
            await sendCursortoClients(presence, id, request.cookies.sessionId);
            return { status: 'OK' };
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });
    
    app.post('/api/op/:id', async (request, reply) => {
        //console.log('op');
        let ts = Date.now();
        if(!request.session || !request.session.user) {
            //reply.code(401);
            return { error: true, message: 'Unauthorized' };
        }
        const id = request.params.id;
        const clientState = request.body;
        if(!id) {
            //reply.code(422);
            return { error: true, message: 'Null document ID' };
        }
        if(id.trim() === '') {
            //reply.code(422);
            return { error: true, message: 'Blank document ID' };
        }
        if(!clientState) {
            //reply.code(422);
            return { error: true, message: 'Null payload' };
        }
        try {
            ////console.log(clientState);
            const update = await redisClient.hget(id, 'update');
            if(!update) {
                //reply.code(404);
                return { error: true, message: 'Document does not exist' };
            }
            sendUpdatetoClients(clientState, id);
            //updateDocumentRedis(clientState, id, update);
            /*if(buffer.size >= 1) {
                console.log('Target buffer size reached');
                await updateDocumentES();
            }*/
            addUpdate(clientState, id);
            //if(updates.length >= 500) updateDocument();
            addToBuffer(id);
            console.log('Op time: ' + (Date.now() - ts));
            //updates[id] = clientState;
            //const clientQueueCount = await clientQueue.count();
            //console.log(clientQueueCount);
            //const documentQueueCount = await documentQueue.count();
            //console.log(documentQueueCount);
            //console.log('Saved changes');
            ////console.log(new QuillDeltaToHtmlConverter(ydoc.getText().toDelta(), {}).convert());
            return { status: 'OK' };
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });

    /*setInterval(() => {
        updateDocument();
    }, 1000);*/
    
    async function sendCursortoClients(presence, origin, sessionId) {
        //console.log(presence);
        //console.log(origin);
        //console.log('Start sending presence events to clients');
        let clients = getClients();
        await Promise.all(clients
            .filter(client => (client.reply.request.params.id === origin))
            .map(async (client) => {
                client.reply.raw.write('event: presence\ndata: ' + JSON.stringify(presence) + '\n\n');
                //console.log('Sent presence event to client');
        }));
        /*
        await Promise.all(clients
            .filter(client => (client.reply.request.params.id === origin && client.session_id !== sessionId))
            .map(async (client) => {
                client.reply.raw.write('event: presence\ndata: ' + JSON.stringify(presence) + '\n\n');
                //console.log('Sent presence event to client');
        }));
        */
    }
    
    async function sendUpdatetoClients(update, origin) {
        ////console.log(update);
        //console.log(origin);
        //console.log('Start sending update events to clients');
        let ts = Date.now();
        let clients = getClients();
        await Promise.all(clients
            .filter(client => client.reply.request.params.id === origin)
            .map(async (client) => {
            client.reply.raw.write('event: update\ndata: ' + JSON.stringify(update) + '\n\n');
            //console.log('Sent update event to client');
        }));
        console.log('Send update to clients: ' + (Date.now() - ts));
    }
}

module.exports = routes;