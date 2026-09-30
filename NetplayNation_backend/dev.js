// Local development launcher: uses an in-memory MongoDB unless MONGODB_URL is set in .env.
require('dotenv').config({ quiet: true });

(async () => {
  if (!process.env.MONGODB_URL) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URL = mongod.getUri('netplaynation');
    process.env.DEV_MEMORY_DB = '1';
    console.log('No MONGODB_URL set: using a temporary in-memory database (data resets on restart).');
  }
  require('./index');
})();
