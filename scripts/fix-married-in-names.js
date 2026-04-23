#!/usr/bin/env node
/**
 * 修复嫁入女性的名字
 * 规则：is_married_in = true 的女性应该是外姓（如王氏、李氏等）
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:postgres@192.168.1.8:33213/postgres';

const OTHER_SURNAMES = [
  '王', '李', '张', '刘', '杨', '黄', '赵', '吴', '周', '徐',
  '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗', '郑',
  '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭',
  '曾', '肖', '田', '董', '袁', '潘', '于', '蒋', '蔡', '余'
];

const FEMALE_NAMES = [
  '芳', '娟', '敏', '静', '丽', '艳', '娜', '秀', '英', '华', '慧', '巧', '美', '霞', '平',
  '红', '兰', '玉', '珍', '贞', '莉', '桂', '娣', '叶', '璧', '璐', '娅', '琦', '妍', '瑶',
  '婷', '莹', '雯', '思', '怡', '倩', '颖', '佳', '嘉', '雅', '欣', '蕾', '薇', '莲', '洁',
  '梅', '菊', '凤', '芝', '萍', '翠', '云', '仙', '月', '花', '香', '芹', '竹', '桃', '柳',
  '香', '芬', '莲', '珠', '琴', '琳', '玫', '璐', '媚', '菁', '莲', '翠', '蕙', '燕', '芬'
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('数据库连接成功\n');

    // 1. 找出所有 is_married_in = true 但姓陈的女性
    const toFix = await client.query(`
      SELECT id, name 
      FROM family_members 
      WHERE gender = '女' 
        AND is_married_in = true
        AND LEFT(name, 1) = '陈'
    `);

    console.log(`需要修复名字的嫁入女性: ${toFix.rows.length} 人\n`);

    // 2. 逐个修改名字
    let fixed = 0;
    for (const row of toFix.rows) {
      // 提取原名的第二个字
      const secondChar = row.name.length > 1 ? row.name[1] : randomChoice(FEMALE_NAMES);
      // 生成外姓
      const newSurname = randomChoice(OTHER_SURNAMES);
      const newName = newSurname + secondChar;

      await client.query(`
        UPDATE family_members SET name = $1 WHERE id = $2
      `, [newName, row.id]);

      fixed++;
      if (fixed <= 10) {
        console.log(`  [修复] ${row.name} -> ${newName}`);
      } else if (fixed === 11) {
        console.log(`  ... 还有 ${toFix.rows.length - 10} 个`);
      }
    }

    console.log(`\n共修复 ${fixed} 个名字`);

    // 3. 验证结果
    console.log('\n========== 验证 ==========\n');

    const afterCheck = await client.query(`
      SELECT 
        is_married_in,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE LEFT(name, 1) = '陈') as chen_count,
        COUNT(*) FILTER (WHERE LEFT(name, 1) != '陈') as other_count
      FROM family_members 
      WHERE gender = '女'
      GROUP BY is_married_in
    `);

    console.log('修复后女性分布:');
    afterCheck.rows.forEach(r => {
      console.log(`  嫁入女性 (is_married_in=${r.is_married_in}): ${r.count} 人`);
      console.log(`    姓陈: ${r.chen_count}, 外姓: ${r.other_count}`);
    });

    // 4. 展示一些样本
    const samples = await client.query(`
      SELECT name 
      FROM family_members 
      WHERE gender = '女' AND is_married_in = true
      ORDER BY id
      LIMIT 10
    `);

    console.log('\n嫁入女性名字样本:');
    samples.rows.forEach(r => console.log(`  ${r.name}`));

    console.log('\n========== 完成 ==========');

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await client.end();
  }
}

main();
