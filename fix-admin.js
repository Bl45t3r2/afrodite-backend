const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

async function fix() {
  const hash = await bcrypt.hash('Admin1234!', 12);
  const user = await p.user.update({
    where: { email: 'admin@afrodite.com' },
    data: { passwordHash: hash, emailVerified: true }
  });
  console.log('OK - Compte admin mis a jour:', user.email);
  await p.$disconnect();
}

fix().catch(e => { console.log('ERREUR:', e.message); p.$disconnect(); });
