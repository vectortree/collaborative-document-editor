const redisClient = require('./redis-client');
const Y = require('yjs');
const app = require('./index');

const buffer = new Set();

let updates = [];

const addUpdate = (clientState, id) => (updates.push({
    clientState: clientState,
    id: id
}));

const addToBuffer = (id) => (buffer.add(id));

const updateDocuments = async () => {
    for(const data of updates) {
        //console.log(data);
        await updateDocumentsRedis(data.clientState, data.id);
    }
    if(updates.length > 0) updates = [];
    await updateDocumentsES();
}

const updateDocumentsRedis = async (clientState, id) => {
    try {
        let ts = Date.now();
        console.log('Writing to redis...');
        const update = await redisClient.hget(id, 'update');
        const serverState = Uint8Array.from(JSON.parse(update));
        const serverVector = Y.encodeStateVectorFromUpdateV2(serverState);
        const diff = Y.diffUpdateV2(Uint8Array.from(clientState), serverVector);
        const newUpdate = Y.mergeUpdatesV2([serverState, diff]);
        await redisClient.hset(id, 'update', JSON.stringify(Array.from(newUpdate)));
        /*const ydoc = new Y.Doc();
        Y.applyUpdateV2(ydoc, Uint8Array.from(JSON.parse(update)));
        Y.applyUpdateV2(ydoc, Uint8Array.from(clientState));
        await redisClient.hset(id, 'update', JSON.stringify(Array.from(Y.encodeStateAsUpdateV2(ydoc))));*/
        const timestamp = Date.now();
        await redisClient.zadd('documents', timestamp, id);
        console.log('Writing to redis: ' + (Date.now() - ts));
    } catch(err) {
        console.log(err);
        //reply.code(500);
    }
}

const updateDocumentsES = async () => {
    try {
        if(buffer.size == 0) return;
        let ts = Date.now();
        console.log('Writing to elastic search...');
        let bulkData = [];
        let ids = Array.from(buffer);
        await Promise.all(ids.map(async (id) => {
            const data = await redisClient.hgetall(id);
            const ydoc = new Y.Doc();
            Y.applyUpdateV2(ydoc, Uint8Array.from(JSON.parse(data.update)));
            const documentText = ydoc.getText().toString();
            let index = {
                _id: id
            };
            let document = {
                name: data.name,
                text: documentText,
                suggest: documentText.split(/\W+/)
            };
            bulkData.push({ index: index });
            bulkData.push(document);
        }));
        await app.elastic.bulk({
            index: 'documents',
            refresh: true,
            body: bulkData
        });
        buffer.clear();
        //await app.elastic.index(data);
        console.log('Writing to ES: ' + (Date.now() - ts));
    } catch(err) {
        console.log(err);
        //reply.code(500);
    }
}

module.exports = {
    addUpdate,
    addToBuffer,
    updateDocuments,
    updateDocumentsRedis,
    updateDocumentsES
};