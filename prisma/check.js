const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.profile.findMany({ where: { status: 'ACTIVE' } });
  console.log('Profils actifs:', profiles.length);
  console.log(profiles.map(x => x.displayName));
}

main()
  .catch(e => console.error('Erreur:', e.message))
  .finally(() => prisma.$disconnect());