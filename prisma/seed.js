const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const adminHash = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@afrodite.com' },
    update: {},
    create: {
      email: 'admin@afrodite.com',
      passwordHash: adminHash,
      role: 'ADMIN',
      emailVerified: true,
      profile: {
        create: {
          displayName: 'Admin',
          age: 30,
          city: 'Cotonou',
          status: 'ACTIVE',
          isVerified: true,
        }
      },
      subscription: {
        create: { status: 'ACTIVE', plan: 'vip' }
      }
    }
  });
  console.log('✅ Admin créé:', admin.email);

  // Sample profiles
  const profiles = [
    { name: 'Sofia C.', age: 24, city: 'Cotonou', price: 80, cats: ['Escorte', 'Premium'] },
    { name: 'Mia L.', age: 28, city: 'Lomé', price: 60, cats: ['Massage', 'VIP'] },
    { name: 'Amina K.', age: 26, city: 'Abidjan', price: 50, cats: ['Indépendant'] },
    { name: 'Rose D.', age: 30, city: 'Dakar', price: 120, cats: ['Agence', 'VIP'] },
    { name: 'Layla N.', age: 22, city: 'Cotonou', price: 40, cats: ['Escorte'] },
    { name: 'Fatou B.', age: 27, city: 'Lomé', price: 90, cats: ['Premium'] },
  ];

  for (const p of profiles) {
    const hash = await bcrypt.hash('Test1234!', 12);
    const email = `${p.name.toLowerCase().replace(/[^a-z]/g, '')}@test.com`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: hash,
        role: 'PREMIUM',
        emailVerified: true,
        profile: {
          create: {
            displayName: p.name,
            age: p.age,
            city: p.city,
            pricePerHour: p.price,
            categories: p.cats,
            bio: `Bonjour, je m'appelle ${p.name}. Basée à ${p.city}, je propose des prestations de qualité dans la discrétion et le respect.`,
            status: 'ACTIVE',
            isVerified: true,
            isOnline: Math.random() > 0.5,
            viewCount: Math.floor(Math.random() * 500),
          }
        },
        subscription: {
          create: { status: 'ACTIVE', plan: 'premium' }
        }
      }
    });
    console.log(`✅ Profil créé: ${p.name}`);
  }

  console.log('🎉 Seed terminé !');
  console.log('\nComptes de test:');
  console.log('Admin: admin@afrodite.com / Admin1234!');
  console.log('Test:  sofiac@test.com / Test1234!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
