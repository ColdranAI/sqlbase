const crypto = require('crypto');

// Generate RSA key pair for JWT
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Convert public key to base64 for backend
const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

console.log('='.repeat(80));
console.log('🔐 JWT KEYS GENERATED');
console.log('='.repeat(80));
console.log('\n📝 Add these to your .env files:\n');

console.log('🔸 Frontend (.env):');
console.log(`BETTER_AUTH_SECRET=${crypto.randomBytes(32).toString('hex')}`);
console.log(`BETTER_AUTH_URL=http://localhost:3000`);
console.log(`NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000`);
console.log('\n🔸 Backend (.env):');
console.log(`BETTER_AUTH_PUBLIC_KEY=${publicKeyBase64}`);
console.log(`ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}`);
console.log('\n📋 Private Key (keep secure):');
console.log(privateKey);
console.log('\n📋 Public Key:');
console.log(publicKey);
console.log('\n='.repeat(80));
console.log('✅ Copy the environment variables to your .env files');
console.log('='.repeat(80)); 