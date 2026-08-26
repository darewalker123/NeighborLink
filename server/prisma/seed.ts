import { PrismaClient, BookingStatus, PaymentStatus, Role, VerificationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const password = 'NeighborLink@123';
const neighborhoods = ['Central Area', 'North Neighborhood', 'South Neighborhood', 'East Neighborhood', 'West Neighborhood'];
const categories = [
  ['Tutoring', 'tutoring', 'GraduationCap'], ['Plumbing', 'plumbing', 'Wrench'], ['Electrical', 'electrical', 'Zap'],
  ['Tailoring', 'tailoring', 'Scissors'], ['Cooking', 'cooking', 'ChefHat'], ['Home Cleaning', 'cleaning', 'Sparkles'],
  ['Appliance Repair', 'repairs', 'Settings'], ['Carpentry', 'carpentry', 'Hammer'], ['Gardening', 'gardening', 'Leaf'], ['Computer Repair', 'computer-repair', 'Laptop']
];
const providerData = [
  ['Ananya Iyer', 'ananya', 'Math & Science Tutor', 'Tutoring', 650, 6, ['Mathematics', 'Physics', 'CBSE'], 4.9],
  ['Ravi Kumar', 'ravi', 'Reliable Home Plumbing', 'Plumbing', 450, 9, ['Leak repair', 'Pipes', 'Fittings'], 4.8],
  ['Priya Sharma', 'priya', 'Professional Home Cleaning', 'Home Cleaning', 550, 5, ['Deep clean', 'Sanitisation'], 4.9],
  ['Vikram Das', 'vikram', 'Electrical Repair & Installation', 'Electrical', 500, 11, ['Wiring', 'Fans', 'Safety'], 4.7],
  ['Meera Nair', 'meera', 'Fresh Home-style Meals', 'Cooking', 400, 7, ['South Indian', 'Meal prep'], 4.9],
  ['Arjun Patel', 'arjun', 'Laptop & Mobile Repair', 'Computer Repair', 600, 8, ['Screen repair', 'Diagnostics'], 4.6],
  ['Kavya Menon', 'kavya', 'Custom Tailoring', 'Tailoring', 350, 10, ['Alterations', 'Blouses', 'Suits'], 4.8],
  ['Suresh Rao', 'suresh', 'Furniture & Carpentry', 'Carpentry', 700, 14, ['Custom furniture', 'Repair'], 4.7],
  ['Divya Joseph', 'divya', 'Garden Care & Landscaping', 'Gardening', 450, 4, ['Plants', 'Landscaping'], 4.8],
  ['Nikhil Jain', 'nikhil', 'Appliance Repair Expert', 'nikhil-repair', 550, 12, ['Washing machines', 'AC'], 4.7]
] as const;

async function main() {
  const hash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.message.deleteMany(), prisma.conversationMember.deleteMany(), prisma.conversation.deleteMany(),
    prisma.notification.deleteMany(), prisma.review.deleteMany(), prisma.dispute.deleteMany(), prisma.transaction.deleteMany(),
    prisma.payment.deleteMany(), prisma.booking.deleteMany(), prisma.availability.deleteMany(), prisma.service.deleteMany(),
    prisma.verification.deleteMany(), prisma.favorite.deleteMany(), prisma.auditLog.deleteMany(), prisma.report.deleteMany(), prisma.providerProfile.deleteMany(), prisma.user.deleteMany(),
    prisma.serviceCategory.deleteMany(), prisma.platformSetting.deleteMany()
  ]);
  const categoryRows = await Promise.all(categories.map(([name, slug, icon]) => prisma.serviceCategory.create({ data: { name, slug, icon, description: `Trusted local ${name.toLowerCase()} services.` } })));
  const categoryByName = new Map(categoryRows.map((c) => [c.name, c]));
  const admin = await prisma.user.create({ data: { fullName: 'Aditi Admin', email: 'admin@neighborlink.local', passwordHash: hash, role: Role.ADMIN, neighborhood: 'Central Area', city: 'Bengaluru' } });
  const customer = await prisma.user.create({ data: { fullName: 'Kiran Customer', email: 'customer@neighborlink.local', phone: '9876543210', passwordHash: hash, neighborhood: 'Central Area', city: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 } });
  const providers = [];
  for (let i = 0; i < providerData.length; i++) {
    const [fullName, code, title, categoryName, price, years, skills, rating] = providerData[i];
    const user = await prisma.user.create({ data: { fullName, email: i === 0 ? 'provider@neighborlink.local' : `provider${i + 1}@neighborlink.local`, phone: `90000000${String(i).padStart(2, '0')}`, passwordHash: hash, role: Role.SERVICE_PROVIDER, neighborhood: neighborhoods[i % neighborhoods.length], city: 'Bengaluru', latitude: 12.9716 + i * .006, longitude: 77.5946 + i * .004 } });
    const profile = await prisma.providerProfile.create({ data: { userId: user.id, bio: `${fullName} is a friendly, dependable local professional committed to quality work and clear communication.`, skills: [...skills], experienceYears: years, serviceRadiusKm: 7, averageRating: rating, reviewCount: 2 + (i % 5), completedJobs: 12 + i * 5, verificationStatus: VerificationStatus.VERIFIED, portfolioUrls: [] } });
    const category = categoryByName.get(categoryName === 'nikhil-repair' ? 'Appliance Repair' : categoryName)!;
    const service = await prisma.service.create({ data: { providerId: profile.id, categoryId: category.id, title, description: `Professional ${title.toLowerCase()} delivered conveniently in your neighborhood.`, price, durationMin: categoryName === 'Tutoring' ? 60 : 90 } });
    await prisma.service.create({ data: { providerId: profile.id, categoryId: category.id, title: `${title} — Extended Visit`, description: `A longer, flexible option from ${fullName} for larger local jobs.`, price: Number(price) + 200, durationMin: 120 } });
    await prisma.availability.createMany({ data: [1,2,3,4,5,6].map(dayOfWeek => ({ providerId: profile.id, dayOfWeek, startTime: dayOfWeek === 6 ? '10:00' : '09:00', endTime: dayOfWeek === 6 ? '16:00' : '18:00' })) });
    providers.push({ user, profile, service, price, rating, code });
  }
  for (let i = 0; i < 18; i++) {
    await prisma.user.create({ data: { fullName: `Community Member ${i + 1}`, email: `member${i + 1}@neighborlink.local`, passwordHash: hash, neighborhood: neighborhoods[i % neighborhoods.length], city: 'Bengaluru' } });
  }
  const createdBookings = [];
  for (let i = 0; i < 32; i++) {
    const provider = providers[i % providers.length];
    const starts = new Date(); starts.setDate(starts.getDate() + (i % 12) - 7); starts.setHours(10 + (i % 4) * 2, 0, 0, 0);
    const ends = new Date(starts.getTime() + provider.service.durationMin * 60 * 1000);
    const status = i < 22 ? BookingStatus.COMPLETED : i < 26 ? BookingStatus.ACCEPTED : i < 29 ? BookingStatus.PENDING : BookingStatus.CANCELLED;
    const booking = await prisma.booking.create({ data: { customerId: customer.id, providerId: provider.profile.id, serviceId: provider.service.id, scheduledStart: starts, scheduledEnd: ends, quotedPrice: provider.price, notes: i % 2 ? 'Please call when you arrive.' : 'Looking forward to your help.', status, completedAt: status === BookingStatus.COMPLETED ? ends : null } });
    createdBookings.push(booking);
    if (status === BookingStatus.COMPLETED || status === BookingStatus.ACCEPTED) {
      const payment = await prisma.payment.create({ data: { bookingId: booking.id, stripePaymentId: `pi_demo_${i}`, amount: provider.price, status: PaymentStatus.PAID, paidAt: starts } });
      await prisma.transaction.create({ data: { bookingId: booking.id, paymentId: payment.id, grossAmount: provider.price, platformFee: Number(provider.price) * .1, providerAmount: Number(provider.price) * .9 } });
    }
    if (status === BookingStatus.COMPLETED) await prisma.review.create({ data: { bookingId: booking.id, authorId: customer.id, providerId: provider.profile.id, rating: i % 4 === 0 ? 4 : 5, comment: ['Excellent service and very punctual.', 'Friendly, skilled, and easy to work with.', 'Would absolutely book again.'][i % 3] } });
  }
  const demoBooking = createdBookings[0];
  const conversation = await prisma.conversation.create({ data: { bookingId: demoBooking.id, members: { create: [{ userId: customer.id }, { userId: providers[0].user.id }] }, messages: { create: [{ senderId: customer.id, body: 'Hi Ananya, looking forward to our session on Saturday!' }, { senderId: providers[0].user.id, body: 'Absolutely, Kiran. I will bring a few practice worksheets.' }] } } });
  await prisma.favorite.create({ data: { userId: customer.id, providerId: providers[0].profile.id } });
  await prisma.notification.createMany({ data: [
    { userId: customer.id, title: 'Booking accepted', body: 'Ananya accepted your Math Tutoring request.', type: 'BOOKING', link: `/bookings/${demoBooking.id}` },
    { userId: customer.id, title: 'New message', body: 'Ananya sent you a message.', type: 'MESSAGE', link: `/messages/${conversation.id}` },
    { userId: providers[0].user.id, title: 'New booking request', body: 'You have a booking request from Kiran.', type: 'BOOKING', link: `/bookings/${demoBooking.id}` }
  ] });
  await prisma.dispute.create({ data: { bookingId: createdBookings[13].id, raisedById: customer.id, reason: 'Service quality concern', description: 'I would like an admin to review the work completed.', status: 'UNDER_REVIEW' } });
  await prisma.platformSetting.create({ data: { key: 'platformFeePercent', value: '10' } });
  console.log(`Seeded NeighborLink. Password for all demo accounts: ${password}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
