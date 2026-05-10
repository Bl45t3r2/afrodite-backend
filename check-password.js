const bcrypt = require('bcryptjs');

const hash = '$2a$12$wGn6MrEJJCCIIxhdo18A2.zBV8xfgvBXaZakfWeYHdFqwv9eTa0Oq';
const passwords = ['Admin1234!', 'Admin1234', 'admin1234!', 'admin1234'];

async function check() {
  for (const pwd of passwords) {
    const match = await bcrypt.compare(pwd, hash);
    console.log(`"${pwd}" => ${match ? '✅ CORRECT' : '❌ incorrect'}`);
  }
}

check();
