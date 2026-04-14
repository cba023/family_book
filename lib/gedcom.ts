/**
 * GEDCOM 格式处理工具
 * GEDCOM (Genealogical Data Communication) 是家谱数据交换的标准格式
 */

import type { FamilyMember } from "@/app/family-tree/actions";

interface GedcomOptions {
  familyName: string;
  version?: string;
  encoding?: string;
}

/**
 * 生成 GEDCOM 格式的个人记录
 */
function generateIndividualRecord(member: FamilyMember, id: string): string {
  const lines: string[] = [];

  // 开始个人记录
  lines.push(`0 ${id} INDI`);

  // 姓名
  lines.push(`1 NAME ${member.name}/`);

  // 性别
  if (member.gender) {
    lines.push(`1 SEX ${member.gender === "男" ? "M" : "F"}`);
  }

  // 出生日期
  if (member.birthday) {
    const birthDate = formatGedcomDate(member.birthday);
    lines.push(`1 BIRT`);
    lines.push(`2 DATE ${birthDate}`);
  }

  // 死亡日期
  if (member.death_date) {
    const deathDate = formatGedcomDate(member.death_date);
    lines.push(`1 DEAT`);
    lines.push(`2 DATE ${deathDate}`);
  }

  // 婚姻状况（有多配偶时标记为已婚）
  if (member.spouse_ids && member.spouse_ids.length > 0) {
    lines.push(`1 MARR`);
  }

  // 居住地点
  if (member.residence_place) {
    lines.push(`1 RESI`);
    lines.push(`2 PLAC ${member.residence_place}`);
  }

  // 职业
  if (member.official_position) {
    lines.push(`1 OCCU ${member.official_position}`);
  }

  // 备注
  if (member.remarks) {
    lines.push(`1 NOTE ${member.remarks}`);
  }

  return lines.join("\n");
}

/**
 * 生成 GEDCOM 格式的家庭记录
 */
function generateFamilyRecord(
  husbandId: string,
  wifeId: string,
  childrenIds: string[],
  familyId: string
): string {
  const lines: string[] = [];

  // 开始家庭记录
  lines.push(`0 ${familyId} FAM`);

  // 丈夫
  if (husbandId) {
    lines.push(`1 HUSB @${husbandId}@`);
  }

  // 妻子
  if (wifeId) {
    lines.push(`1 WIFE @${wifeId}@`);
  }

  // 子女
  for (const childId of childrenIds) {
    lines.push(`1 CHIL @${childId}@`);
  }

  return lines.join("\n");
}

/**
 * 格式化日期为 GEDCOM 格式
 */
function formatGedcomDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const monthMap: Record<string, string> = {
      "01": "JAN", "02": "FEB", "03": "MAR", "04": "APR",
      "05": "MAY", "06": "JUN", "07": "JUL", "08": "AUG",
      "09": "SEP", "10": "OCT", "11": "NOV", "12": "DEC"
    };
    const gedcomMonth = monthMap[month] || month;
    return `${gedcomMonth} ${day} ${year}`;
  }
  return dateStr;
}

/**
 * 导出成员数据为 GEDCOM 格式
 */
export function exportToGedcom(
  members: FamilyMember[],
  options: GedcomOptions
): string {
  const {
    familyName,
    version = "5.5.1",
    encoding = "UTF-8"
  } = options;

  const lines: string[] = [];

  // GEDCOM 头部
  lines.push(`0 HEAD`);
  lines.push(`1 GEDC`);
  lines.push(`2 VERS ${version}`);
  lines.push(`2 FORM LINEAGE-LINKED`);
  lines.push(`1 CHAR ${encoding}`);
  lines.push(`1 SOUR FamilyBook`);
  lines.push(`2 NAME ${familyName}氏族谱`);
  lines.push(`2 VERS 1.0`);
  lines.push(`1 SUBM @SUBM@`);
  lines.push(`1 FILE ${familyName}_family.ged`);
  lines.push(`2 DATE ${new Date().toISOString().split("T")[0]}`);

  // 提交者记录
  lines.push(`0 @SUBM@ SUBM`);
  lines.push(`1 NAME ${familyName}家族`);

  // 个人记录
  const memberIdMap = new Map<number, string>();
  members.forEach((member, index) => {
    const id = `I${String(index + 1).padStart(4, "0")}`;
    memberIdMap.set(member.id, id);
    lines.push(generateIndividualRecord(member, `@${id}@`));
  });

  // 家庭记录（每个配偶对生成一条）
  const familyMap = new Map<string, { husband: string; wife: string; children: string[] }>();

  // 构建家庭关系（支持多配偶）
  members.forEach(member => {
    const spouseIds = member.spouse_ids ?? [];
    spouseIds.forEach(spouseId => {
      const spouse = members.find(m => m.id === spouseId);
      if (spouse) {
        const familyKey = [member.id, spouse.id].sort((a, b) => a - b).join("-");
        if (!familyMap.has(familyKey)) {
          const husbandId = member.gender === "男" ? memberIdMap.get(member.id) : memberIdMap.get(spouse.id);
          const wifeId = member.gender === "女" ? memberIdMap.get(member.id) : memberIdMap.get(spouse.id);
          familyMap.set(familyKey, {
            husband: husbandId || "",
            wife: wifeId || "",
            children: []
          });
        }
      }
    });
  });

  // 添加子女到家庭
  members.forEach(member => {
    if (member.father_id) {
      const father = members.find(m => m.id === member.father_id);
      if (father) {
        const spouseIds = father.spouse_ids ?? [];
        // 为每个配偶对添加子女
        spouseIds.forEach(spouseId => {
          const familyKey = [father.id, spouseId].sort((a, b) => a - b).join("-");
          const family = familyMap.get(familyKey);
          if (family) {
            const childId = memberIdMap.get(member.id);
            if (childId && !family.children.includes(childId)) {
              family.children.push(childId);
            }
          }
        });
      }
    }
  });

  // 生成家庭记录
  let familyIndex = 1;
  familyMap.forEach((family, _key) => {
    const familyId = `F${String(familyIndex++).padStart(4, "0")}`;
    lines.push(generateFamilyRecord(
      family.husband,
      family.wife,
      family.children,
      `@${familyId}@`
    ));
  });

  // GEDCOM 尾部
  lines.push(`0 TRLR`);

  return lines.join("\n");
}

/**
 * 解析 GEDCOM 格式数据
 */
export function parseGedcom(gedcomContent: string): FamilyMember[] {
  const lines = gedcomContent.split("\n");
  const members: FamilyMember[] = [];
  const memberMap = new Map<string, Partial<FamilyMember>>();
  const familyMap = new Map<string, { husband: string; wife: string; children: string[] }>();

  let currentId: string | null = null;
  let currentTag: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    const match = line.match(/^(\d+)\s+(@[^@]+@|\w+)\s*(.*)$/);
    if (!match) continue;

    const [, level, tagOrId, value] = match;
    const lvl = parseInt(level, 10);

    if (lvl === 0) {
      if (tagOrId.startsWith("@") && value === "INDI") {
        currentId = tagOrId.replace(/@/g, "");
        memberMap.set(currentId, {
          id: members.length + 1,
          name: "",
          generation: null,
          sibling_order: null,
          father_id: null,
          father_name: null,
          gender: null,
          official_position: null,
          is_alive: true,
          spouse_ids: [],
          spouse_names: [],
          is_married_in: false,
          remarks: null,
          birthday: null,
          death_date: null,
          residence_place: null,
          updated_at: new Date().toISOString()
        });
        currentTag = null;
      } else if (tagOrId.startsWith("@") && value === "FAM") {
        currentId = tagOrId.replace(/@/g, "");
        familyMap.set(currentId, { husband: "", wife: "", children: [] });
        currentTag = null;
      }
    } else if (currentId) {
      if (memberMap.has(currentId)) {
        const member = memberMap.get(currentId)!;

        if (tagOrId === "NAME" && value) {
          member.name = value.replace(/\//g, "");
        } else if (tagOrId === "SEX" && value) {
          member.gender = value === "M" ? "男" : value === "F" ? "女" : null;
        } else if (tagOrId === "BIRT") {
          currentTag = "BIRT";
        } else if (tagOrId === "DEAT") {
          currentTag = "DEAT";
        } else if (tagOrId === "DATE" && currentTag) {
          if (currentTag === "BIRT") {
            member.birthday = parseGedcomDate(value);
          } else if (currentTag === "DEAT") {
            member.death_date = parseGedcomDate(value);
            member.is_alive = false;
          }
        } else if (tagOrId === "OCCU" && value) {
          member.official_position = value;
        } else if (tagOrId === "RESI") {
          currentTag = "RESI";
        } else if (tagOrId === "PLAC" && currentTag === "RESI" && value) {
          member.residence_place = value;
        } else if (tagOrId === "NOTE" && value) {
          member.remarks = value;
        }
      } else if (familyMap.has(currentId)) {
        const family = familyMap.get(currentId)!;
        if (tagOrId === "HUSB" && value) {
          family.husband = value.replace(/@/g, "");
        } else if (tagOrId === "WIFE" && value) {
          family.wife = value.replace(/@/g, "");
        } else if (tagOrId === "CHIL" && value) {
          family.children.push(value.replace(/@/g, ""));
        }
      }
    }
  }

  // 构建成员关系
  const idToMemberId = new Map<string, number>();
  memberMap.forEach((member, id) => {
    const memberId = members.length + 1;
    idToMemberId.set(id, memberId);
    member.id = memberId;
    members.push(member as FamilyMember);
  });

  // 处理家庭关系（支持多配偶）
  familyMap.forEach(family => {
    const husbandId = idToMemberId.get(family.husband);
    const wifeId = idToMemberId.get(family.wife);

    if (husbandId && wifeId) {
      const husband = members.find(m => m.id === husbandId);
      const wife = members.find(m => m.id === wifeId);
      if (husband && wife) {
        if (!husband.spouse_ids) husband.spouse_ids = [];
        if (!wife.spouse_ids) wife.spouse_ids = [];
        if (!husband.spouse_names) husband.spouse_names = [];
        if (!wife.spouse_names) wife.spouse_names = [];
        if (!husband.spouse_ids.includes(wifeId)) {
          husband.spouse_ids.push(wifeId);
          husband.spouse_names.push(wife.name);
        }
        if (!wife.spouse_ids.includes(husbandId)) {
          wife.spouse_ids.push(husbandId);
          wife.spouse_names.push(husband.name);
        }
        wife.is_married_in = true;
      }
    }

    // 处理子女关系
    family.children.forEach(childId => {
      const childMemberId = idToMemberId.get(childId);
      if (childMemberId && husbandId) {
        const child = members.find(m => m.id === childMemberId);
        const father = members.find(m => m.id === husbandId);
        if (child && father) {
          child.father_id = husbandId;
          child.father_name = father.name;
        }
      }
    });
  });

  return members;
}

/**
 * 解析 GEDCOM 日期格式
 */
function parseGedcomDate(gedcomDate: string): string {
  const parts = gedcomDate.trim().split(/\s+/);
  if (parts.length === 3) {
    const [month, day, year] = parts;
    const monthMap: Record<string, string> = {
      "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04",
      "MAY": "05", "JUN": "06", "JUL": "07", "AUG": "08",
      "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12"
    };
    const monthNum = monthMap[month] || "01";
    const dayNum = day.padStart(2, "0");
    return `${year}-${monthNum}-${dayNum}`;
  }
  return gedcomDate;
}
