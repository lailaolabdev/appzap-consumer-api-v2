/**
 * Lao Landmarks Seed Data
 * Popular districts, attractions, and places in Laos
 * 
 * Run: npx ts-node src/seeds/landmarks.seed.ts
 */

import mongoose from 'mongoose';
import Landmark from '../models/Landmark';
import dotenv from 'dotenv';

dotenv.config();

const landmarks = [
  // ============================================
  // VIENTIANE CAPITAL - Districts
  // ============================================
  {
    name: 'Dongdok',
    nameLocal: 'ດົງໂດກ',
    nameThai: 'ดงโด๊ก',
    nameChinese: '东多',
    type: 'district',
    location: { type: 'Point', coordinates: [102.7833, 18.0167] },
    radius: 3000,
    province: 'Vientiane Capital',
    district: 'Xaythany',
    description: 'University area, home to NUOL. Popular with students and young people.',
    descriptionLocal: 'ເຂດມະຫາວິທະຍາໄລ, ບ້ານມະຫາວິທະຍາໄລແຫ່ງຊາດລາວ',
    searchKeywords: ['dongdok', 'dong dok', 'ດົງໂດກ', 'nuol', 'university'],
    isPopular: true,
    sortOrder: 1,
  },
  {
    name: 'Sihom',
    nameLocal: 'ສີໂຫມ',
    nameThai: 'สีโหม',
    nameChinese: '西霍姆',
    type: 'district',
    location: { type: 'Point', coordinates: [102.6167, 17.9667] },
    radius: 2000,
    province: 'Vientiane Capital',
    district: 'Chanthabouly',
    description: 'Central area near Mekong riverfront. Many restaurants and cafes.',
    descriptionLocal: 'ເຂດໃຈກາງເມືອງ ໃກ້ແຄມຂອງແມ່ນໍ້າຂອງ',
    searchKeywords: ['sihom', 'si hom', 'ສີໂຫມ', 'riverfront'],
    isPopular: true,
    sortOrder: 2,
  },
  {
    name: 'Phontan',
    nameLocal: 'ໂພນຕານ',
    nameThai: 'โพนตาน',
    type: 'district',
    location: { type: 'Point', coordinates: [102.6333, 17.9833] },
    radius: 2000,
    province: 'Vientiane Capital',
    district: 'Sisattanak',
    description: 'Residential and business area with many shops and restaurants.',
    searchKeywords: ['phontan', 'phon tan', 'ໂພນຕານ'],
    isPopular: true,
    sortOrder: 3,
  },
  {
    name: 'Thadeua',
    nameLocal: 'ທ່າເດື່ອ',
    nameThai: 'ท่าเดื่อ',
    type: 'district',
    location: { type: 'Point', coordinates: [102.7500, 17.9833] },
    radius: 3000,
    province: 'Vientiane Capital',
    district: 'Hatsaifong',
    description: 'Eastern area along Thadeua Road, many industrial and commercial zones.',
    searchKeywords: ['thadeua', 'tha deua', 'ທ່າເດື່ອ'],
    isPopular: true,
    sortOrder: 4,
  },
  {
    name: 'Nongduang',
    nameLocal: 'ໜອງດວງ',
    nameThai: 'หนองดวง',
    type: 'district',
    location: { type: 'Point', coordinates: [102.6000, 17.9500] },
    radius: 2500,
    province: 'Vientiane Capital',
    district: 'Sikhottabong',
    description: 'Western area with residential neighborhoods.',
    searchKeywords: ['nongduang', 'nong duang', 'ໜອງດວງ'],
    isPopular: false,
    sortOrder: 10,
  },
  {
    name: 'Phonxay',
    nameLocal: 'ໂພນໄຊ',
    nameThai: 'โพนไช',
    type: 'district',
    location: { type: 'Point', coordinates: [102.6500, 17.9700] },
    radius: 2000,
    province: 'Vientiane Capital',
    district: 'Saysettha',
    description: 'Central district near diplomatic area.',
    searchKeywords: ['phonxay', 'phon xay', 'ໂພນໄຊ'],
    isPopular: false,
    sortOrder: 11,
  },

  // ============================================
  // VIENTIANE CAPITAL - Attractions
  // ============================================
  {
    name: 'Patuxay',
    nameLocal: 'ປະຕູໄຊ',
    nameThai: 'ประตูชัย',
    nameChinese: '凯旋门',
    nameKorean: '파툭사이',
    type: 'attraction',
    location: { type: 'Point', coordinates: [102.6139, 17.9750] },
    radius: 500,
    province: 'Vientiane Capital',
    district: 'Chanthabouly',
    description: 'Victory Gate monument, iconic landmark of Vientiane. Great views from the top.',
    descriptionLocal: 'ອະນຸສາວະລີໄຊຊະນະ, ສັນຍາລັກຂອງນະຄອນຫຼວງ',
    searchKeywords: ['patuxay', 'patuxai', 'victory gate', 'ປະຕູໄຊ', 'arc de triomphe'],
    isPopular: true,
    sortOrder: 1,
  },
  {
    name: 'That Luang',
    nameLocal: 'ທາດຫຼວງ',
    nameThai: 'พระธาตุหลวง',
    nameChinese: '塔銮',
    nameKorean: '탓루앙',
    type: 'attraction',
    location: { type: 'Point', coordinates: [102.6350, 17.9758] },
    radius: 500,
    province: 'Vientiane Capital',
    district: 'Saysettha',
    description: 'The most important Buddhist stupa in Laos. National symbol.',
    descriptionLocal: 'ພຣະທາດຫຼວງ, ສັນຍາລັກແຫ່ງຊາດ',
    searchKeywords: ['that luang', 'pha that luang', 'ທາດຫຼວງ', 'golden stupa', 'temple'],
    isPopular: true,
    sortOrder: 2,
  },
  {
    name: 'Buddha Park (Xieng Khuan)',
    nameLocal: 'ສວນພຣະ (ຊຽງຂວາງ)',
    nameThai: 'สวนพระ',
    nameChinese: '佛像公园',
    type: 'attraction',
    location: { type: 'Point', coordinates: [102.7650, 17.9117] },
    radius: 500,
    province: 'Vientiane Capital',
    district: 'Hatsaifong',
    description: 'Sculpture park with over 200 Buddhist and Hindu statues.',
    searchKeywords: ['buddha park', 'xieng khuan', 'ສວນພຣະ', 'ຊຽງຂວາງ', 'statue'],
    isPopular: true,
    sortOrder: 3,
  },
  {
    name: 'Mekong Riverfront',
    nameLocal: 'ແຄມຂອງ',
    nameThai: 'ริมแม่น้ำโขง',
    nameChinese: '湄公河畔',
    type: 'attraction',
    location: { type: 'Point', coordinates: [102.6000, 17.9583] },
    radius: 2000,
    province: 'Vientiane Capital',
    district: 'Chanthabouly',
    description: 'Scenic riverside area perfect for sunset views, walking, and dining.',
    searchKeywords: ['mekong', 'riverfront', 'riverside', 'ແຄມຂອງ', 'sunset'],
    isPopular: true,
    sortOrder: 4,
  },
  {
    name: 'COPE Visitor Centre',
    nameLocal: 'ສູນ COPE',
    type: 'attraction',
    location: { type: 'Point', coordinates: [102.6283, 17.9683] },
    radius: 300,
    province: 'Vientiane Capital',
    district: 'Sisattanak',
    description: 'Museum about UXO (unexploded ordnance) and rehabilitation services.',
    searchKeywords: ['cope', 'museum', 'uxo', 'visitor centre'],
    isPopular: false,
    sortOrder: 10,
  },

  // ============================================
  // VIENTIANE CAPITAL - Shopping
  // ============================================
  {
    name: 'Vientiane Center',
    nameLocal: 'ວຽງຈັນເຊັນເຕີ',
    nameThai: 'เวียงจันทน์เซ็นเตอร์',
    nameChinese: '万象中心',
    type: 'mall',
    location: { type: 'Point', coordinates: [102.6125, 17.9617] },
    radius: 300,
    province: 'Vientiane Capital',
    district: 'Chanthabouly',
    description: 'Modern shopping mall with international brands, cinema, and food court.',
    searchKeywords: ['vientiane center', 'vc', 'ວຽງຈັນເຊັນເຕີ', 'mall', 'shopping'],
    isPopular: true,
    sortOrder: 1,
  },
  {
    name: 'ITECC',
    nameLocal: 'ໄອເທັກ',
    nameThai: 'ไอเทค',
    type: 'mall',
    location: { type: 'Point', coordinates: [102.6500, 17.9583] },
    radius: 300,
    province: 'Vientiane Capital',
    district: 'Saysettha',
    description: 'Exhibition and convention center with shopping and events.',
    searchKeywords: ['itecc', 'ໄອເທັກ', 'exhibition', 'convention'],
    isPopular: true,
    sortOrder: 2,
  },
  {
    name: 'Talat Sao (Morning Market)',
    nameLocal: 'ຕະຫຼາດເຊົ້າ',
    nameThai: 'ตลาดเช้า',
    nameChinese: '早市',
    type: 'market',
    location: { type: 'Point', coordinates: [102.6117, 17.9633] },
    radius: 300,
    province: 'Vientiane Capital',
    district: 'Chanthabouly',
    description: 'Traditional shopping center and market. Good for souvenirs and local goods.',
    searchKeywords: ['talat sao', 'morning market', 'ຕະຫຼາດເຊົ້າ', 'souvenir'],
    isPopular: true,
    sortOrder: 1,
  },
  {
    name: 'Night Market',
    nameLocal: 'ຕະຫຼາດກາງຄືນ',
    nameThai: 'ตลาดกลางคืน',
    nameChinese: '夜市',
    type: 'market',
    location: { type: 'Point', coordinates: [102.6033, 17.9583] },
    radius: 500,
    province: 'Vientiane Capital',
    district: 'Chanthabouly',
    description: 'Evening market along the Mekong with food, clothes, and handicrafts.',
    searchKeywords: ['night market', 'ຕະຫຼາດກາງຄືນ', 'evening market', 'food stalls'],
    isPopular: true,
    sortOrder: 2,
  },
  {
    name: 'Parkson',
    nameLocal: 'ພາກສັນ',
    type: 'mall',
    location: { type: 'Point', coordinates: [102.6150, 17.9600] },
    radius: 200,
    province: 'Vientiane Capital',
    district: 'Chanthabouly',
    description: 'Department store with clothing, electronics, and household items.',
    searchKeywords: ['parkson', 'ພາກສັນ', 'department store'],
    isPopular: false,
    sortOrder: 5,
  },

  // ============================================
  // VIENTIANE CAPITAL - Transport
  // ============================================
  {
    name: 'Wattay International Airport',
    nameLocal: 'ສະໜາມບິນສາກົນວັດໄຕ',
    nameThai: 'สนามบินนานาชาติวัตไต',
    nameChinese: '瓦岱国际机场',
    type: 'transport',
    location: { type: 'Point', coordinates: [102.5633, 17.9883] },
    radius: 1000,
    province: 'Vientiane Capital',
    district: 'Sikhottabong',
    description: 'Main international airport serving Vientiane.',
    searchKeywords: ['wattay', 'airport', 'ສະໜາມບິນ', 'vte', 'fly'],
    isPopular: true,
    sortOrder: 1,
  },
  {
    name: 'Southern Bus Station',
    nameLocal: 'ສະຖານີຂົນສົ່ງໃຕ້',
    nameThai: 'สถานีขนส่งใต้',
    type: 'transport',
    location: { type: 'Point', coordinates: [102.6367, 17.9250] },
    radius: 500,
    province: 'Vientiane Capital',
    district: 'Hatsaifong',
    description: 'Main bus station for southern destinations.',
    searchKeywords: ['southern bus station', 'bus station', 'ສະຖານີຂົນສົ່ງ'],
    isPopular: true,
    sortOrder: 2,
  },
  {
    name: 'Northern Bus Station',
    nameLocal: 'ສະຖານີຂົນສົ່ງເໜືອ',
    nameThai: 'สถานีขนส่งเหนือ',
    type: 'transport',
    location: { type: 'Point', coordinates: [102.6650, 18.0167] },
    radius: 500,
    province: 'Vientiane Capital',
    district: 'Xaythany',
    description: 'Main bus station for northern destinations including Luang Prabang.',
    searchKeywords: ['northern bus station', 'bus station north', 'ສະຖານີຂົນສົ່ງເໜືອ'],
    isPopular: true,
    sortOrder: 3,
  },
  {
    name: 'Vientiane Railway Station',
    nameLocal: 'ສະຖານີລົດໄຟວຽງຈັນ',
    nameThai: 'สถานีรถไฟเวียงจันทน์',
    nameChinese: '万象火车站',
    type: 'transport',
    location: { type: 'Point', coordinates: [102.7183, 17.9933] },
    radius: 500,
    province: 'Vientiane Capital',
    district: 'Hatsaifong',
    description: 'Railway station on the Laos-China railway.',
    searchKeywords: ['railway', 'train station', 'ສະຖານີລົດໄຟ', 'china railway'],
    isPopular: true,
    sortOrder: 4,
  },

  // ============================================
  // VIENTIANE CAPITAL - Universities
  // ============================================
  {
    name: 'National University of Laos (NUOL)',
    nameLocal: 'ມະຫາວິທະຍາໄລແຫ່ງຊາດລາວ',
    nameThai: 'มหาวิทยาลัยแห่งชาติลาว',
    type: 'university',
    location: { type: 'Point', coordinates: [102.7800, 18.0183] },
    radius: 2000,
    province: 'Vientiane Capital',
    district: 'Xaythany',
    description: 'The largest and most prestigious university in Laos.',
    searchKeywords: ['nuol', 'university', 'ມະຫາວິທະຍາໄລ', 'national university'],
    isPopular: true,
    sortOrder: 1,
  },

  // ============================================
  // VIENTIANE CAPITAL - Hospitals
  // ============================================
  {
    name: 'Mittaphab Hospital',
    nameLocal: 'ໂຮງໝໍມິດຕະພາບ',
    nameThai: 'โรงพยาบาลมิตตะภาพ',
    type: 'hospital',
    location: { type: 'Point', coordinates: [102.6217, 17.9650] },
    radius: 500,
    province: 'Vientiane Capital',
    district: 'Chanthabouly',
    description: 'Major hospital in central Vientiane.',
    searchKeywords: ['mittaphab', 'hospital', 'ໂຮງໝໍ', 'medical'],
    isPopular: true,
    sortOrder: 1,
  },
  {
    name: 'Mahosot Hospital',
    nameLocal: 'ໂຮງໝໍມະໂຫສົດ',
    nameThai: 'โรงพยาบาลมโหสถ',
    type: 'hospital',
    location: { type: 'Point', coordinates: [102.6083, 17.9617] },
    radius: 500,
    province: 'Vientiane Capital',
    district: 'Chanthabouly',
    description: 'One of the main government hospitals.',
    searchKeywords: ['mahosot', 'hospital', 'ໂຮງໝໍມະໂຫສົດ'],
    isPopular: true,
    sortOrder: 2,
  },

  // ============================================
  // LUANG PRABANG
  // ============================================
  {
    name: 'Luang Prabang Old Town',
    nameLocal: 'ຕົວເມືອງເກົ່າຫຼວງພະບາງ',
    nameThai: 'เมืองเก่าหลวงพระบาง',
    nameChinese: '琅勃拉邦古城',
    type: 'district',
    location: { type: 'Point', coordinates: [102.1350, 19.8850] },
    radius: 2000,
    province: 'Luang Prabang',
    description: 'UNESCO World Heritage Site. Ancient royal capital with beautiful temples.',
    searchKeywords: ['luang prabang', 'old town', 'ຫຼວງພະບາງ', 'unesco', 'royal palace'],
    isPopular: true,
    sortOrder: 1,
  },
  {
    name: 'Kuang Si Waterfalls',
    nameLocal: 'ນໍ້າຕົກຕາດກວາງສີ',
    nameThai: 'น้ำตกตาดกวางสี',
    nameChinese: '光西瀑布',
    type: 'attraction',
    location: { type: 'Point', coordinates: [101.9942, 19.7483] },
    radius: 500,
    province: 'Luang Prabang',
    description: 'Stunning turquoise waterfalls, perfect for swimming. Must-visit attraction.',
    searchKeywords: ['kuang si', 'waterfall', 'ນໍ້າຕົກ', 'swimming', 'turquoise'],
    isPopular: true,
    sortOrder: 2,
  },
  {
    name: 'Luang Prabang Night Market',
    nameLocal: 'ຕະຫຼາດກາງຄືນຫຼວງພະບາງ',
    type: 'market',
    location: { type: 'Point', coordinates: [102.1317, 19.8867] },
    radius: 300,
    province: 'Luang Prabang',
    description: 'Famous night market with handicrafts, textiles, and local products.',
    searchKeywords: ['night market', 'luang prabang market', 'handicrafts'],
    isPopular: true,
    sortOrder: 3,
  },

  // ============================================
  // VANG VIENG
  // ============================================
  {
    name: 'Vang Vieng Town',
    nameLocal: 'ເມືອງວັງວຽງ',
    nameThai: 'วังเวียง',
    nameChinese: '万荣',
    type: 'district',
    location: { type: 'Point', coordinates: [102.4483, 18.9217] },
    radius: 3000,
    province: 'Vientiane Province',
    description: 'Adventure town known for kayaking, tubing, and stunning karst landscapes.',
    searchKeywords: ['vang vieng', 'ວັງວຽງ', 'tubing', 'kayaking', 'adventure'],
    isPopular: true,
    sortOrder: 1,
  },
  {
    name: 'Blue Lagoon',
    nameLocal: 'ບຶງສີຟ້າ',
    nameThai: 'บลูลากูน',
    type: 'attraction',
    location: { type: 'Point', coordinates: [102.4850, 18.9317] },
    radius: 300,
    province: 'Vientiane Province',
    description: 'Popular swimming spot with clear blue water and rope swings.',
    searchKeywords: ['blue lagoon', 'swimming', 'ບຶງ', 'swing'],
    isPopular: true,
    sortOrder: 2,
  },

  // ============================================
  // SAVANNAKHET
  // ============================================
  {
    name: 'Savannakhet Old Town',
    nameLocal: 'ຕົວເມືອງເກົ່າສະຫວັນນະເຂດ',
    nameThai: 'เมืองเก่าสะหวันนะเขต',
    type: 'district',
    location: { type: 'Point', coordinates: [104.7500, 16.5500] },
    radius: 2000,
    province: 'Savannakhet',
    description: 'Colonial-era town with French architecture.',
    searchKeywords: ['savannakhet', 'ສະຫວັນນະເຂດ', 'colonial', 'french'],
    isPopular: true,
    sortOrder: 1,
  },

  // ============================================
  // PAKSE
  // ============================================
  {
    name: 'Pakse',
    nameLocal: 'ປາກເຊ',
    nameThai: 'ปากเซ',
    type: 'district',
    location: { type: 'Point', coordinates: [105.7833, 15.1167] },
    radius: 3000,
    province: 'Champasak',
    description: 'Gateway to the Bolaven Plateau and 4000 Islands.',
    searchKeywords: ['pakse', 'ປາກເຊ', 'champasak', 'gateway'],
    isPopular: true,
    sortOrder: 1,
  },
  {
    name: 'Wat Phou',
    nameLocal: 'ວັດພູ',
    nameThai: 'วัดภู',
    nameChinese: '瓦普寺',
    type: 'attraction',
    location: { type: 'Point', coordinates: [105.8233, 14.8467] },
    radius: 1000,
    province: 'Champasak',
    description: 'UNESCO World Heritage Khmer temple complex. Ancient ruins.',
    searchKeywords: ['wat phou', 'ວັດພູ', 'unesco', 'khmer', 'temple', 'ruins'],
    isPopular: true,
    sortOrder: 2,
  },
  {
    name: '4000 Islands (Si Phan Don)',
    nameLocal: 'ສີ່ພັນດອນ',
    nameThai: 'สี่พันดอน',
    nameChinese: '四千岛',
    type: 'attraction',
    location: { type: 'Point', coordinates: [105.9500, 14.0833] },
    radius: 5000,
    province: 'Champasak',
    description: 'River archipelago in the Mekong. Peaceful islands with waterfalls.',
    searchKeywords: ['4000 islands', 'si phan don', 'ສີ່ພັນດອນ', 'don det', 'mekong'],
    isPopular: true,
    sortOrder: 3,
  },
];

async function seedLandmarks() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not set');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing landmarks
    console.log('🗑️ Clearing existing landmarks...');
    await Landmark.deleteMany({});

    // Insert new landmarks
    console.log('📍 Inserting landmarks...');
    const result = await Landmark.insertMany(landmarks.map(l => ({
      ...l,
      isActive: true,
      viewCount: 0,
      searchCount: 0,
    })));

    console.log(`✅ Successfully seeded ${result.length} landmarks`);

    // Create geospatial index
    console.log('🗺️ Creating geospatial index...');
    await Landmark.collection.createIndex({ location: '2dsphere' });
    console.log('✅ Geospatial index created');

    // Summary by type
    const summary = await Landmark.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    console.log('\n📊 Landmarks by type:');
    summary.forEach(s => {
      console.log(`   ${s._id}: ${s.count}`);
    });

    // Summary by province
    const provinceSummary = await Landmark.aggregate([
      { $group: { _id: '$province', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    console.log('\n📊 Landmarks by province:');
    provinceSummary.forEach(s => {
      console.log(`   ${s._id}: ${s.count}`);
    });

  } catch (error) {
    console.error('❌ Error seeding landmarks:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  seedLandmarks()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedLandmarks, landmarks };
