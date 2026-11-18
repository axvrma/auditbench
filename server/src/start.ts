import { startServer } from './index.js';

startServer(4001).once('listening', () => {
  console.log('Lighthouse API listening at http://127.0.0.1:4001');
});
