require('dotenv').config();
const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  maxRetriesPerRequest: null
};

const convertQueue = new Queue('convert-pdf', { connection });

module.exports = convertQueue;
