const Redis = require('ioredis');

const redisClient = new Redis({
    password: process.env.REDIS_AUTH
});

module.exports = redisClient;