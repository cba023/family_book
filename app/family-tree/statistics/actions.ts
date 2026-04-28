"use server";

import { requireUser, numId } from "@/lib/auth/session";
import { query } from "@/lib/pg";
import { formatActionError } from "@/lib/format-action-error";

export interface StatisticsData {
  totalMembers: number;
  genderStats: { name: string; value: number; fill: string }[];
  generationStats: { name: string; value: number }[];
  statusStats: { name: string; value: number; fill: string }[];
  ageStats: { name: string; value: number }[];
  aliveAgeStats: { name: string; value: number; fill: string }[];
  commonNames: { name: string; count: number }[];
  marriedInStats: { name: string; value: number; fill: string }[];
  surnameStats: { name: string; count: number }[];
  residenceStats: { name: string; value: number }[];
  maleStats: { name: string; value: number }[];
  femaleStats: { name: string; value: number }[];
  marriedInFemaleCount: number;
  marriedInFemaleFromCount: number;
}

export async function fetchFamilyStatistics(): Promise<{
  data: StatisticsData | null;
  error: string | null;
  requireAuth: boolean;
}> {
  try {
    const data = await query<{
      id: number;
      name: string;
      gender: string | null;
      generation: number | null;
      is_alive: boolean;
      birthday: string | null;
      is_married_in: boolean;
      residence_place: string | null;
    }>(
      `SELECT id, name, gender, generation, is_alive, birthday, is_married_in, residence_place
       FROM family_members
       ORDER BY generation ASC NULLS FIRST`,
    );

    const members = data.map((m) => ({
      id: numId(m.id),
      name: String(m.name),
      gender: m.gender != null ? String(m.gender) : null,
      generation: m.generation != null ? Number(m.generation) : null,
      is_alive: Boolean(m.is_alive),
      birthday: m.birthday != null ? String(m.birthday) : null,
      is_married_in: Boolean(m.is_married_in),
      residence_place: m.residence_place != null ? String(m.residence_place) : null,
    }));

    const totalMembers = members.length;

    // 族裔（不含嫁入和始祖）性别统计
    const nativeMembers = members.filter(
      (m) => !m.is_married_in && m.generation !== 1
    );
    const nativeGenderCounts = nativeMembers.reduce(
      (acc, member) => {
        const gender = member.gender || "未知";
        acc[gender] = (acc[gender] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const genderStats = [
      { name: "男", value: nativeGenderCounts["男"] || 0, fill: "#3b82f6" },
      { name: "女", value: nativeGenderCounts["女"] || 0, fill: "#ec4899" },
    ];
    if (nativeGenderCounts["未知"]) {
      genderStats.push({
        name: "未知",
        value: nativeGenderCounts["未知"],
        fill: "#94a3b8",
      });
    }

    const generationCounts = members.reduce(
      (acc, member) => {
        const gen = member.generation ? `第${member.generation}世` : "未知";
        acc[gen] = (acc[gen] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const sortedGenerations = Object.keys(generationCounts).sort((a, b) => {
      if (a === "未知") return 1;
      if (b === "未知") return -1;
      const genA = parseInt(a.replace(/\D/g, ""), 10);
      const genB = parseInt(b.replace(/\D/g, ""), 10);
      return genA - genB;
    });

    const generationStats = sortedGenerations.map((gen) => ({
      name: gen,
      value: generationCounts[gen],
    }));

    const statusCounts = members.reduce(
      (acc, member) => {
        const status = member.is_alive ? "在世" : "已故";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const statusStats = [
      { name: "在世", value: statusCounts["在世"] || 0, fill: "#22c55e" },
      { name: "已故", value: statusCounts["已故"] || 0, fill: "#64748b" },
    ];

    const now = new Date();
    const ageGroups: Record<string, number> = {
      "0-10岁": 0,
      "11-20岁": 0,
      "21-30岁": 0,
      "31-40岁": 0,
      "41-50岁": 0,
      "51-60岁": 0,
      "61-70岁": 0,
      "71-80岁": 0,
      "81-90岁": 0,
      "90岁以上": 0,
      未知: 0,
    };

    members.forEach((member) => {
      if (!member.is_alive || !member.birthday) {
        ageGroups["未知"]++;
        return;
      }

      const birthDate = new Date(member.birthday);
      const age = now.getFullYear() - birthDate.getFullYear();

      if (age <= 10) ageGroups["0-10岁"]++;
      else if (age <= 20) ageGroups["11-20岁"]++;
      else if (age <= 30) ageGroups["21-30岁"]++;
      else if (age <= 40) ageGroups["31-40岁"]++;
      else if (age <= 50) ageGroups["41-50岁"]++;
      else if (age <= 60) ageGroups["51-60岁"]++;
      else if (age <= 70) ageGroups["61-70岁"]++;
      else if (age <= 80) ageGroups["71-80岁"]++;
      else if (age <= 90) ageGroups["81-90岁"]++;
      else ageGroups["90岁以上"]++;
    });

    const ageStats = Object.entries(ageGroups)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));

    // 在世成员年龄分布
    const aliveAgeGroups: Record<string, number> = {
      "0-30岁": 0,
      "31-50岁": 0,
      "51-60岁": 0,
      "61-70岁": 0,
      "71-80岁": 0,
      "80岁以上": 0,
      "未知": 0,
    };
    members.forEach((member) => {
      if (!member.is_alive || !member.birthday) {
        return;
      }
      const birthDate = new Date(member.birthday);
      const age = now.getFullYear() - birthDate.getFullYear();
      if (age <= 30) aliveAgeGroups["0-30岁"]++;
      else if (age <= 50) aliveAgeGroups["31-50岁"]++;
      else if (age <= 60) aliveAgeGroups["51-60岁"]++;
      else if (age <= 70) aliveAgeGroups["61-70岁"]++;
      else if (age <= 80) aliveAgeGroups["71-80岁"]++;
      else aliveAgeGroups["80岁以上"]++;
    });
    const aliveAgeStats = [
      { name: "0-30岁", value: aliveAgeGroups["0-30岁"], fill: "#22c55e" },
      { name: "31-50岁", value: aliveAgeGroups["31-50岁"], fill: "#3b82f6" },
      { name: "51-60岁", value: aliveAgeGroups["51-60岁"], fill: "#f59e0b" },
      { name: "61-70岁", value: aliveAgeGroups["61-70岁"], fill: "#f97316" },
      { name: "71-80岁", value: aliveAgeGroups["71-80岁"], fill: "#ec4899" },
      { name: "80岁以上", value: aliveAgeGroups["80岁以上"], fill: "#8b5cf6" },
    ];

    const nameCounts: Record<string, number> = {};
    members.forEach((member) => {
      if (member.name && member.name.length > 0) {
        const firstChar = member.name[0];
        nameCounts[firstChar] = (nameCounts[firstChar] || 0) + 1;
      }
    });

    const commonNames = Object.entries(nameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const marriedInCounts = members.reduce(
      (acc, member) => {
        const key = member.is_married_in ? "嫁入" : "本族";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const marriedInStats = [
      { name: "本族", value: marriedInCounts["本族"] || 0, fill: "#3b82f6" },
      { name: "嫁入", value: marriedInCounts["嫁入"] || 0, fill: "#f97316" },
    ];

    // 嫁入女性数量
    const marriedInFemaleCount = members.filter(
      (m) => m.gender === "女" && m.is_married_in
    ).length;

    // 本族女性数量（女性族裔）
    const marriedInFemaleFromCount = members.filter(
      (m) => m.gender === "女" && !m.is_married_in
    ).length;

    // 姓氏分布统计（取姓氏首字）
    const surnameCounts: Record<string, number> = {};
    members.forEach((member) => {
      if (member.name && member.name.length > 0) {
        const surname = member.name[0];
        surnameCounts[surname] = (surnameCounts[surname] || 0) + 1;
      }
    });
    const surnameStats = Object.entries(surnameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // 居所分布统计
    const residenceCounts: Record<string, number> = {};
    members.forEach((member) => {
      const place = member.residence_place || "未知";
      residenceCounts[place] = (residenceCounts[place] || 0) + 1;
    });
    const residenceStats = Object.entries(residenceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));

    // 计算在世成员的年龄分布（男女分开）
    const maleAgeGroups: Record<string, number> = {
      "0-30岁": 0,
      "31-50岁": 0,
      "51-60岁": 0,
      "61-70岁": 0,
      "71-80岁": 0,
      "80岁以上": 0,
      "未知": 0,
    };
    const femaleAgeGroups = { ...maleAgeGroups };

    members.forEach((member) => {
      if (!member.is_alive || !member.birthday) {
        if (member.gender === "男") maleAgeGroups["未知"]++;
        else if (member.gender === "女") femaleAgeGroups["未知"]++;
        return;
      }

      const birthDate = new Date(member.birthday);
      const age = now.getFullYear() - birthDate.getFullYear();

      if (member.gender === "男") {
        if (age <= 30) maleAgeGroups["0-30岁"]++;
        else if (age <= 50) maleAgeGroups["31-50岁"]++;
        else if (age <= 60) maleAgeGroups["51-60岁"]++;
        else if (age <= 70) maleAgeGroups["61-70岁"]++;
        else if (age <= 80) maleAgeGroups["71-80岁"]++;
        else maleAgeGroups["80岁以上"]++;
      } else if (member.gender === "女") {
        if (age <= 30) femaleAgeGroups["0-30岁"]++;
        else if (age <= 50) femaleAgeGroups["31-50岁"]++;
        else if (age <= 60) femaleAgeGroups["51-60岁"]++;
        else if (age <= 70) femaleAgeGroups["61-70岁"]++;
        else if (age <= 80) femaleAgeGroups["71-80岁"]++;
        else femaleAgeGroups["80岁以上"]++;
      }
    });

    const maleStats = Object.entries(maleAgeGroups)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));

    const femaleStats = Object.entries(femaleAgeGroups)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));

    const { user } = await requireUser();

    return {
      data: {
        totalMembers,
        genderStats,
        generationStats,
        statusStats,
        ageStats,
        commonNames,
        marriedInStats,
        surnameStats,
        residenceStats,
        maleStats,
        femaleStats,
        marriedInFemaleCount,
        marriedInFemaleFromCount,
        aliveAgeStats,
      },
      error: null,
      requireAuth: !user,
    };
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return {
      data: null,
      error: formatActionError(error),
      requireAuth: false,
    };
  }
}
