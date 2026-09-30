const crypto = require('crypto');
const config = require('../config');

const { cloudName, apiKey, apiSecret } = config.cloudinary;

exports.enabled = () => Boolean(cloudName && apiKey && apiSecret);

// Signed direct uploads: the browser uploads straight to Cloudinary using this short-lived signature,
// so the API secret never leaves the server. Parameters are signed in alphabetical order.
exports.signUpload = (folder = 'netplaynation/products', now = Date.now()) => {
  const timestamp = Math.floor(now / 1000);
  const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest('hex');
  return { cloudName, apiKey, timestamp, folder, signature };
};
