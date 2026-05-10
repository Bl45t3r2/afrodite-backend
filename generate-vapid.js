const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
console.log('\n=== Copiez ces clés dans votre .env backend ===\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('\n=== Copiez la clé publique dans .env.local frontend ===\n');
console.log(`NEXT_PUBLIC_VAPID_KEY=${keys.publicKey}`);
console.log('');
