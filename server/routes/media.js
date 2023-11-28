const fs = require('fs');
const util = require('util');
const { pipeline } = require('stream');
const pump = util.promisify(pipeline);
const { v1: uuidv1 } = require('uuid');
const redisClient = require('../redis-client');

async function routes(app, options) {

    app.post('/media/upload', async (request, reply) => {
        console.log('upload media');
        if(!request.session || !request.session.user) {
            //reply.code(401);
            return { error: true, message: 'Unauthorized' };
        }
        try {
            const data = await request.file();
            //console.log(data.mimetype);
            if(data.mimetype !== 'image/jpeg' && data.mimetype !== 'image/png' && data.mimetype !== 'image/gif') {
                //reply.code(415);
                return { error: true, message: 'Unsupported media type' };
            }
            let extension = '.' + data.mimetype.split('/')[1]; // data.mimetype === 'image/jpeg' ? '.jpeg' : '.png';
            const id = uuidv1();
            await pump(data.file, fs.createWriteStream(__dirname + `/../../public/uploads/${id}` + extension));
            await redisClient.set(id, extension);
            return { mediaid: id };
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });

    app.get('/media/access/:mediaid', async (request, reply) => {
        console.log('access media');
        if(!request.session || !request.session.user) {
            //reply.code(401);
            return { error: true, message: 'Unauthorized' };
        }
        const id = request.params.mediaid;
        if(!id) {
            //reply.code(422);
            return { error: true, message: 'Null media ID' };
        }
        if(id.trim() === '') {
            //reply.code(422);
            return { error: true, message: 'Blank media ID' };
        }
        try {
            const extension = await redisClient.get(id);
            if(!extension) {
                //reply.code(404);
                return { error: true, message: 'File does not exist' };
            }
            //console.log(extension);
            try {
                await fs.promises.access(__dirname + `/../../public/uploads/${id}` + extension);
                return reply.sendFile(`uploads/${id}` + extension);
            } catch(err) {
                //console.log(err);
                //reply.code(404);
                return { error: true, message: 'File does not exist' };
            }
        } catch(err) {
            //console.log(err);
            //reply.code(500);
            return { error: true, message: 'Internal server error' };
        }
    });
}

module.exports = routes;