#!/usr/bin/env node
/**
 * 生成5000个家族成员测试数据
 * 规则：一个祖宗发出来，12代传承，辈分清晰，配偶完整关联
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:postgres@192.168.1.8:33213/postgres';

const SURNAME = '陈';
const TARGET_GENERATIONS = 12;
const TARGET_COUNT = 5000;

// 辈分用字
const GENERATION_NAMES = {
  1: '', 2: '永', 3: '振', 4: '家', 5: '声', 6: '启',
  7: '大', 8: '业', 9: '传', 10: '千', 11: '古', 12: '长'
};

const GIVEN_NAMES_MALE = [
  '伟', '强', '磊', '洋', '勇', '军', '杰', '涛', '超', '明', '刚', '平', '辉', '鹏', '飞',
  '华', '波', '斌', '宇', '浩', '凯', '亮', '睿', '毅', '俊', '峰', '健', '龙', '文', '志',
  '海', '国', '建', '林', '成', '东', '立', '科', '博', '祥', '福', '瑞', '洪', '武', '广',
  '田', '学', '进', '正', '德', '义', '良', '根', '生', '元', '庆', '春', '夏', '秋', '冬'
];

const GIVEN_NAMES_FEMALE = [
  '芳', '娟', '敏', '静', '丽', '艳', '娜', '秀', '英', '华', '慧', '巧', '美', '霞', '平',
  '红', '兰', '玉', '珍', '贞', '莉', '桂', '娣', '叶', '璧', '璐', '娅', '琦', '妍', '瑶',
  '婷', '莹', '雯', '思', '怡', '倩', '颖', '佳', '嘉', '雅', '欣', '蕾', '薇', '莲', '洁',
  '梅', '菊', '凤', '芝', '萍', '翠', '云', '仙', '月', '花', '香', '芹', '竹', '桃', '柳'
];

const BIRTH_PLACES = [
  '广东广州', '广东深圳', '广东佛山', '广东东莞', '广东珠海',
  '广东中山', '广东江门', '广东汕头', '广东潮州', '广东揭阳',
  '广东惠州', '广东河源', '广东梅州', '广东韶关', '广东清远',
  '广东肇庆', '广东云浮', '广东阳江', '广东湛江', '广东茂名'
];

// 外姓列表（用于嫁入的女性）
const OTHER_SURNAMES = [
  '王', '李', '张', '刘', '杨', '黄', '赵', '吴', '周', '徐',
  '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗', '郑',
  '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭',
  '曾', '肖', '田', '董', '袁', '潘', '于', '蒋', '蔡', '余',
  '杜', '叶', '程', '苏', '魏', '吕', '丁', '任', '沈', '姚',
  '卢', '姜', '崔', '钟', '谭', '陆', '汪', '范', '金', '石'
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(startYear, endYear) {
  const year = randomInt(startYear, endYear);
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function generateName(gender, genNum, usedNames) {
  const pool = gender === '男' ? GIVEN_NAMES_MALE : GIVEN_NAMES_FEMALE;
  const genChar = GENERATION_NAMES[genNum] || '';
  let name;
  let attempts = 0;
  do {
    name = genChar + randomChoice(pool);
    attempts++;
  } while (usedNames.has(name) && attempts < 30);
  usedNames.add(name);
  return name;
}

function getGenerationSize(generation) {
  if (generation === 1) return 1;
  const distribution = {
    2: { min: 4, max: 8 },
    3: { min: 8, max: 16 },
    4: { min: 16, max: 32 },
    5: { min: 35, max: 60 },
    6: { min: 70, max: 120 },
    7: { min: 150, max: 250 },
    8: { min: 300, max: 450 },
    9: { min: 500, max: 700 },
    10: { min: 650, max: 900 },
    11: { min: 800, max: 1000 },
    12: { min: 1948, max: 1968 }
  };
  const range = distribution[generation] || { min: 100, max: 200 };
  return randomInt(range.min, range.max);
}

async function insertMember(client, userId, member) {
  const result = await client.query(`
    INSERT INTO family_members (user_id, name, generation, sibling_order, father_id, gender, official_position, is_alive, spouse_ids, is_married_in, remarks, birthday, death_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id
  `, [
    userId, member.name, member.generation, member.sibling_order, member.father_id,
    member.gender, member.official_position, member.is_alive, member.spouse_ids,
    member.is_married_in, member.remarks, member.birthday, member.death_date
  ]);
  return result.rows[0].id;
}

async function updateSpouseIds(client, memberId, spouseIds) {
  if (spouseIds.length > 0) {
    await client.query(`
      UPDATE family_members SET spouse_ids = $1 WHERE id = $2
    `, [spouseIds, memberId]);
  }
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('数据库连接成功');

    // 获取或创建测试用户
    let userId;
    const userResult = await client.query('SELECT id FROM app_users LIMIT 1');
    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
      console.log(`使用已有用户: ${userId}`);
    } else {
      const newUser = await client.query(`
        INSERT INTO app_users (password_hash) VALUES ($1) RETURNING id
      `, ['$2a$10$dummy']);
      userId = newUser.rows[0].id;
      await client.query(`
        INSERT INTO profiles (id, role, username, full_name)
        VALUES ($1, 'super_admin', 'testuser', '测试用户')
      `, [userId]);
      console.log(`创建新用户: ${userId}`);
    }

    await client.query('DELETE FROM family_members');
    console.log('已清空现有数据');

    const usedNames = new Set();
    const generations = new Map(); // generation -> [{id, dbId, gender, birthday, spouse_ids}]
    const START_YEAR = 1850;
    const GENERATION_INTERVAL = 25;

    console.log('\n开始生成家族数据...\n');

    // ==================== 第1代：祖宗 ====================
    const ancestor = {
      name: SURNAME + '始祖',
      generation: 1,
      sibling_order: 1,
      father_id: null,
      gender: '男',
      official_position: '始祖',
      is_alive: false,
      spouse_ids: [],
      is_married_in: false,
      remarks: null,
      birthday: randomDate(START_YEAR - 5, START_YEAR + 5),
      death_date: randomDate(START_YEAR + 65, START_YEAR + 80),
      residence_place: randomChoice(BIRTH_PLACES),
    };

    const ancestorDbId = await insertMember(client, userId, ancestor);
    generations.set(1, [{ id: 1, dbId: ancestorDbId, gender: '男', birthday: ancestor.birthday, spouse_ids: [] }]);
    console.log(`第1代 [始祖]: ${ancestor.name} (DB ID: ${ancestorDbId})`);

    // ==================== 逐步生成2-12代 ====================
    for (let gen = 2; gen <= TARGET_GENERATIONS; gen++) {
      const parentGeneration = generations.get(gen - 1);
      // 只从土生陈姓成员中选择父亲（排除外姓嫁入女性）
      const validParents = parentGeneration.filter(p => p.gender === '男');
      const children = [];
      let targetSize = getGenerationSize(gen);
      let remaining = targetSize;
      const birthYear = START_YEAR + (gen - 1) * GENERATION_INTERVAL;

      for (let pIdx = 0; pIdx < validParents.length && remaining > 0; pIdx++) {
        const parent = validParents[pIdx];
        const proportion = targetSize / validParents.length;
        const minKids = gen === 2 ? 1 : Math.max(1, Math.floor(proportion * 0.5));
        const maxKids = gen === 2 ? 5 : Math.ceil(proportion * 1.8);

        const isLastParent = pIdx === validParents.length - 1;
        const numKids = isLastParent ? remaining : randomInt(minKids, Math.min(maxKids, remaining));

        // 先确定这个父亲有几个孩子（陈姓的）
        const childCount = numKids;
        // 嫁入女性的数量约为陈姓孩子的60%
        const marriedInCount = Math.floor(childCount * 0.6);
        
        // 生成陈姓孩子
        let chenSiblingIndex = 0;
        for (let i = 0; i < childCount && remaining > 0; i++) {
          chenSiblingIndex++;
          const gender = Math.random() > 0.5 ? '男' : '女';
          // 先用陈姓生成名字
          let name = SURNAME + generateName(gender, gen, usedNames);

          const isAlive = birthYear > 1960 && Math.random() > 0.1;
          const childBirthYear = birthYear + randomInt(-3, 3);
          const deathYear = isAlive ? null : childBirthYear + randomInt(60, 85);

          // 如果是女性，约40%会嫁入（改姓），需要记录用于后续处理
          let willMarryIn = gender === '女' && Math.random() > 0.6;

          const child = {
            name,
            generation: gen,
            sibling_order: chenSiblingIndex, // 陈姓孩子排行独立计算
            father_id: parent.dbId,
            gender,
            official_position: null,
            is_alive: isAlive,
            spouse_ids: [],
            is_married_in: false,
            remarks: null,
            birthday: randomDate(childBirthYear - 2, childBirthYear + 2),
            death_date: isAlive ? null : randomDate(deathYear - 5, deathYear + 5),
            residence_place: parent.residence_place || randomChoice(BIRTH_PLACES),
            willMarryIn,
          };

          const dbId = await insertMember(client, userId, child);
          children.push({
            id: children.length + 1,
            dbId,
            gender,
            birthday: child.birthday,
            spouse_ids: [],
            residence_place: child.residence_place,
            willMarryIn
          });
          remaining--;
        }
        
        // 生成嫁入女性（作为丈夫的配偶，不算陈姓孩子的排行）
        // 嫁入女性的 sibling_order 设为 NULL（不参与世系图排行）
        for (let j = 0; j < marriedInCount && j < childCount; j++) {
          // 找到这个父亲的一个陈姓男性孩子作为丈夫
          const husbands = children.filter(c => c.gender === '男' && !c.willMarryIn);
          if (husbands.length === 0) break;
          
          const husband = husbands[j % husbands.length];
          const marriedInName = randomChoice(OTHER_SURNAMES) + randomChoice(GIVEN_NAMES_FEMALE);
          const marriedInBirthYear = birthYear + randomInt(-3, 3);

          const marriedIn = {
            name: marriedInName,
            generation: gen,
            sibling_order: null, // 嫁入女性不参与排行
            father_id: parent.dbId,
            gender: '女',
            official_position: null,
            is_alive: true,
            spouse_ids: [],
            is_married_in: false,
            remarks: null,
            birthday: randomDate(marriedInBirthYear - 2, marriedInBirthYear + 2),
            death_date: null,
            residence_place: parent.residence_place || randomChoice(BIRTH_PLACES),
            willMarryIn: true,
          };

          const dbId = await insertMember(client, userId, marriedIn);
          children.push({
            id: children.length + 1,
            dbId,
            gender: '女',
            birthday: marriedIn.birthday,
            spouse_ids: [],
            residence_place: marriedIn.residence_place,
            willMarryIn: true
          });
        }
      }

      generations.set(gen, children);
      console.log(`第${gen}代 [${GENERATION_NAMES[gen]}]: ${children.length}人 (累计${[...generations.values()].flat().length + 1}人)`);
    }

    // ==================== 配对配偶关系 ====================
    console.log('\n配对配偶关系...');

    for (let gen = 2; gen <= TARGET_GENERATIONS; gen++) {
      const genMembers = generations.get(gen);
      const males = genMembers.filter(m => m.gender === '男');
      // 只从嫁入女性中找配偶
      const marriedInFemales = genMembers.filter(m => m.gender === '女' && m.willMarryIn);

      const malesToMarry = males.slice(0, Math.floor(males.length * 0.8));

      for (const male of malesToMarry) {
        const maleBirthYear = parseInt(male.birthday.split('-')[0]);

        // 只从嫁入女性中找配偶（同代优先）
        let candidates = marriedInFemales.filter(f => {
          const fBirthYear = parseInt(f.birthday.split('-')[0]);
          return Math.abs(maleBirthYear - fBirthYear) <= 10;
        });

        // 如果同代不够，向下一代延伸找嫁入女性
        if (candidates.length < malesToMarry.length * 0.3 && gen < TARGET_GENERATIONS) {
          const nextGen = generations.get(gen + 1);
          if (nextGen) {
            const nextMarriedIn = nextGen.filter(m => m.gender === '女' && m.willMarryIn);
            const nextCandidates = nextMarriedIn.filter(f => {
              const fBirthYear = parseInt(f.birthday.split('-')[0]);
              return Math.abs(maleBirthYear - fBirthYear) <= 10;
            });
            candidates = [...candidates, ...nextCandidates];
          }
        }

        if (candidates.length > 0) {
          const wife = randomChoice(candidates);
          male.spouse_ids.push(wife.dbId);
          wife.spouse_ids.push(male.dbId);
          await updateSpouseIds(client, male.dbId, male.spouse_ids);
          await updateSpouseIds(client, wife.dbId, wife.spouse_ids);

          // 如果是嫁入女性，更新为外姓
          if (wife.willMarryIn) {
            const otherSurname = randomChoice(OTHER_SURNAMES);
            const newName = otherSurname + randomChoice(GIVEN_NAMES_FEMALE);
            await client.query(`UPDATE family_members SET name = $1, is_married_in = true, residence_place = $2 WHERE id = $3`,
              [newName, randomChoice(BIRTH_PLACES), wife.dbId]);
          }
        }
      }
    }

    // ==================== 统计结果 ====================
    const stats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE gender = '男') as male_count,
        COUNT(*) FILTER (WHERE gender = '女') as female_count,
        COUNT(*) FILTER (WHERE is_alive = true) as alive_count,
        COUNT(*) FILTER (WHERE is_married_in = true) as married_in_count,
        MAX(generation) as max_generation
      FROM family_members
    `);

    const genStats = await client.query(`
      SELECT generation, COUNT(*) as count,
             COUNT(*) FILTER (WHERE gender = '男') as male,
             COUNT(*) FILTER (WHERE gender = '女') as female
      FROM family_members GROUP BY generation ORDER BY generation
    `);

    const spouseStats = await client.query(`
      SELECT COUNT(*) FILTER (WHERE array_length(spouse_ids, 1) > 0) as with_spouse
      FROM family_members
    `);

    console.log('\n========== 生成完成 ==========');
    console.log(`总记录数: ${stats.rows[0].total}`);
    console.log(`男性: ${stats.rows[0].male_count}`);
    console.log(`女性: ${stats.rows[0].female_count}`);
    console.log(`在世: ${stats.rows[0].alive_count}`);
    console.log(`嫁入: ${stats.rows[0].married_in_count}`);
    console.log(`有配偶: ${spouseStats.rows[0].with_spouse}`);
    console.log(`代数: 1 - ${stats.rows[0].max_generation} 代`);

    console.log('\n----- 每代人数 -----');
    genStats.rows.forEach(r => {
      const genName = GENERATION_NAMES[r.generation] || '';
      console.log(`第${r.generation}代 [${genName}]: ${r.count}人 (男${r.male}, 女${r.female})`);
    });

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await client.end();
  }
}

main();
