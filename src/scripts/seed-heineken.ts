/**
 * Seed Script: Heineken Sponsor Data
 * 
 * Creates Heineken as an advertiser and their ads for AppZap Eat
 * 
 * Usage: npx ts-node src/scripts/seed-heineken.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Advertiser from '../models/Advertiser';
import Advertisement from '../models/Advertisement';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/appzap';

// Heineken brand assets (replace with actual CDN URLs in production)
const HEINEKEN_ASSETS = {
  logo: 'https://cdn.appzap.la/sponsors/heineken/logo.png',
  heroBanner: 'https://cdn.appzap.la/sponsors/heineken/hero-banner.jpg',
  dealCard: 'https://cdn.appzap.la/sponsors/heineken/deal-card.jpg',
  checkoutUpsell: 'https://cdn.appzap.la/sponsors/heineken/checkout-upsell.jpg',
  confirmation: 'https://cdn.appzap.la/sponsors/heineken/confirmation.jpg',
  homeMiddle: 'https://cdn.appzap.la/sponsors/heineken/home-middle.jpg',
  badge: 'https://cdn.appzap.la/sponsors/heineken/badge.png',
};

async function seedHeineken() {
  try {
    console.log('🍺 Seeding Heineken sponsor data...\n');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Create Heineken as an advertiser
    console.log('📝 Creating Heineken advertiser...');
    
    // Check if already exists
    let advertiser = await Advertiser.findOne({ name: 'Heineken' });
    
    if (!advertiser) {
      advertiser = await Advertiser.create({
        name: 'Heineken',
        companyName: 'Heineken Laos Co., Ltd',
        logo: HEINEKEN_ASSETS.logo,
        website: 'https://www.heineken.com',
        category: 'beverage_beer',
        contacts: [
          {
            name: 'Kelly Ching Kooh Kooh',
            email: 'kelly@heineken.com',
            phone: '+856 20 xxxx xxxx',
            role: 'Marketing Manager',
          },
        ],
        billingEmail: 'billing@heineken.com',
        contract: {
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-07-31'),
          monthlyBudget: 1000,
          totalBudget: 6000,
          currency: 'USD',
          amountSpent: 0,
          productScope: ['eat'],
          exclusivePlacements: ['eat_hero_banner', 'eat_deal_card'],
          terms: '6-month sponsorship for AppZap Eat with exclusive beverage placement',
          signedAt: new Date('2024-01-15'),
        },
        status: 'active',
        notes: 'Premium beer sponsor. Contact Kelly for renewals.',
      });
      console.log('✅ Heineken advertiser created:', advertiser._id);
    } else {
      console.log('ℹ️  Heineken advertiser already exists:', advertiser._id);
    }

    // Create Heineken ads
    console.log('\n📝 Creating Heineken advertisements...\n');

    const heinekenAds = [
      // 1. Eat Hero Banner
      {
        name: 'Heineken Eat Hero Banner',
        description: 'Main hero banner for AppZap Eat hub',
        advertiser: {
          name: 'Heineken',
          companyName: 'Heineken Laos Co., Ltd',
          phone: '+856 20 xxxx xxxx',
          email: 'kelly@heineken.com',
        },
        sponsorId: advertiser._id,
        type: 'banner',
        placement: 'eat_hero_banner',
        size: '1200x628',
        content: {
          imageUrl: HEINEKEN_ASSETS.heroBanner,
          title: 'Enjoy Heineken with Your Meal',
          subtitle: 'Premium taste, perfect pairing',
          description: 'Available at partner restaurants across Laos',
          ctaText: 'Find Restaurants',
          ctaUrl: 'appzap://eat?filter=heineken_partner',
          backgroundColor: '#165B33',
          textColor: '#FFFFFF',
        },
        targeting: {
          provinces: ['Vientiane', 'Luang Prabang', 'Savannakhet'],
          userTypes: ['returning', 'premium'],
          languages: ['en', 'lo'],
        },
        schedule: {
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-07-31'),
          timezone: 'Asia/Vientiane',
        },
        budget: {
          daily: 35,
          total: 3000,
          currency: 'USD',
          spent: 0,
        },
        pricing: {
          type: 'cpm',
          amount: 5,
          currency: 'USD',
        },
        priority: 100,
        weight: 100,
        status: 'active',
      },
      // 2. Eat Deal Card
      {
        name: 'Heineken Free Deal',
        description: 'Free Heineken with orders over $20',
        advertiser: {
          name: 'Heineken',
          companyName: 'Heineken Laos Co., Ltd',
          phone: '+856 20 xxxx xxxx',
          email: 'kelly@heineken.com',
        },
        sponsorId: advertiser._id,
        type: 'native',
        placement: 'eat_deal_card',
        content: {
          imageUrl: HEINEKEN_ASSETS.dealCard,
          title: 'Free Heineken',
          subtitle: 'With orders over $20',
          description: 'Enjoy a complimentary Heineken with any food order over $20 at participating restaurants.',
          ctaText: 'Get Deal',
          ctaUrl: 'appzap://deals/heineken-free',
          backgroundColor: '#E31937',
          textColor: '#FFFFFF',
        },
        targeting: {
          userTypes: ['returning', 'premium'],
        },
        schedule: {
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-07-31'),
          timezone: 'Asia/Vientiane',
        },
        budget: {
          daily: 20,
          total: 2000,
          currency: 'USD',
          spent: 0,
        },
        pricing: {
          type: 'cpc',
          amount: 0.50,
          currency: 'USD',
        },
        priority: 90,
        weight: 80,
        status: 'active',
      },
      // 3. Eat Checkout Upsell
      {
        name: 'Heineken Checkout Upsell',
        description: 'Add Heineken upsell at checkout',
        advertiser: {
          name: 'Heineken',
          companyName: 'Heineken Laos Co., Ltd',
          phone: '+856 20 xxxx xxxx',
          email: 'kelly@heineken.com',
        },
        sponsorId: advertiser._id,
        type: 'banner',
        placement: 'eat_checkout_upsell',
        size: '600x150',
        content: {
          imageUrl: HEINEKEN_ASSETS.checkoutUpsell,
          title: 'Add a Heineken?',
          subtitle: 'Perfect with your meal - only $3',
          ctaText: 'Add to Order',
          ctaUrl: 'appzap://add-item/heineken',
          backgroundColor: '#165B33',
          textColor: '#FFFFFF',
        },
        schedule: {
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-07-31'),
          timezone: 'Asia/Vientiane',
        },
        budget: {
          daily: 10,
          total: 500,
          currency: 'USD',
          spent: 0,
        },
        pricing: {
          type: 'cpa',
          amount: 1,
          currency: 'USD',
        },
        priority: 80,
        weight: 70,
        status: 'active',
      },
      // 4. Order Confirmation
      {
        name: 'Heineken Order Confirmation',
        description: 'Brand reminder on order confirmation',
        advertiser: {
          name: 'Heineken',
          companyName: 'Heineken Laos Co., Ltd',
          phone: '+856 20 xxxx xxxx',
          email: 'kelly@heineken.com',
        },
        sponsorId: advertiser._id,
        type: 'banner',
        placement: 'eat_confirmation',
        size: '600x200',
        content: {
          imageUrl: HEINEKEN_ASSETS.confirmation,
          title: 'Enjoy Your Meal with Heineken',
          subtitle: 'The perfect pairing',
          backgroundColor: '#165B33',
          textColor: '#FFFFFF',
        },
        schedule: {
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-07-31'),
          timezone: 'Asia/Vientiane',
        },
        pricing: {
          type: 'cpm',
          amount: 2,
          currency: 'USD',
        },
        priority: 70,
        weight: 60,
        status: 'active',
      },
      // 5. Home Middle Banner
      {
        name: 'Heineken Home Banner',
        description: 'Heineken banner on home hub',
        advertiser: {
          name: 'Heineken',
          companyName: 'Heineken Laos Co., Ltd',
          phone: '+856 20 xxxx xxxx',
          email: 'kelly@heineken.com',
        },
        sponsorId: advertiser._id,
        type: 'banner',
        placement: 'home_middle',
        size: '1200x400',
        content: {
          imageUrl: HEINEKEN_ASSETS.homeMiddle,
          title: 'Taste the Premium',
          subtitle: 'Heineken - Available at partner restaurants',
          ctaText: 'Order Now',
          ctaUrl: 'appzap://eat',
          backgroundColor: '#165B33',
          textColor: '#FFFFFF',
        },
        targeting: {
          provinces: ['Vientiane', 'Luang Prabang'],
        },
        schedule: {
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-07-31'),
          timezone: 'Asia/Vientiane',
          hoursOfDay: [11, 12, 13, 17, 18, 19, 20, 21], // Lunch and dinner times
        },
        pricing: {
          type: 'cpm',
          amount: 3,
          currency: 'USD',
        },
        priority: 80,
        weight: 70,
        status: 'active',
      },
    ];

    // Insert ads (skip if already exist)
    for (const adData of heinekenAds) {
      const existingAd = await Advertisement.findOne({ 
        name: adData.name,
        sponsorId: advertiser._id,
      });

      if (!existingAd) {
        const ad = await Advertisement.create(adData);
        console.log(`✅ Created ad: ${ad.name} (${ad.placement})`);
      } else {
        console.log(`ℹ️  Ad already exists: ${adData.name}`);
      }
    }

    console.log('\n✅ Heineken seed data complete!\n');
    console.log('Summary:');
    console.log(`- Advertiser ID: ${advertiser._id}`);
    console.log(`- Total Budget: $${advertiser.contract.totalBudget}`);
    console.log(`- Contract Period: ${advertiser.contract.startDate.toDateString()} - ${advertiser.contract.endDate.toDateString()}`);
    console.log(`- Exclusive Placements: ${advertiser.contract.exclusivePlacements.join(', ')}`);

  } catch (error) {
    console.error('❌ Error seeding Heineken data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the seed
seedHeineken();
