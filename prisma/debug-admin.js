const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@afrodite.com' }
  });

  if (!user) {
    console.log('❌ Admin introuvable en base !');
    return;
  }

  console.log('✅ Admin trouvé :');
  console.log('  email:', user.email);
  console.log('  role:', user.role);
  console.log('  emailVerified:', user.emailVerified);
  console.log('  passwordHash:', user.passwordHash);

  const ok = await bcrypt.compare('Admin1234!', user.passwordHash);
  console.log('  Mot de passe Admin1234! valide :', ok);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());