"use server";

import { requireUser, numId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatActionError } from "@/lib/format-action-error";

export interface StatisticsData {
  totalMembers: number;
  genderStats: { name: string; value: number; fill: string }[];
  generationStats: { name: string; value: number }[];
  statusStats: { name: string; value: number; fill: string }[];
  ageStats: { name: string; value: number }[];
  commonNames: { name: string; count: number }[];
  marriedInStats: { name: string; value: number; fill: string }[];
}

export async function fetchFamilyStatistics(): Promise<{
  data: StatisticsData | null;
  error: string | null;
  requireAuth: boolean;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("family_members")
      .select("id, name, gender, generation, is_alive, birthday, is_married_in")
      .order("generation", { ascending: true, nullsFirst: true });

    if (error) throw error;

    const members = (data ?? []).map((m) => ({
      id: numId(m.id),
      name: String(m.name),
      gender: m.gender != null ? String(m.gender) : null,
      generation: m.generation != null ? Number(m.generation) : null,
      is_alive: Boolean(m.is_alive),
      birthday: m.birthday != null ? String(m.birthday) : null,
      is_married_in: Boolean(m.is_married_in),
    }));

    const totalMembers = members.length;

    const genderCounts = members.reduce(
      (acc, member) => {
        const gender = member.gender || "未知";
        acc[gender] = (acc[gender] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const genderStats = [
      { name: "男", value: genderCounts["男"] || 0, fill: "#3b82f6" },
      { name: "女", value: genderCounts["女"] || 0, fill: "#ec4899" },
    ];
    if (genderCounts["未知"]) {
      genderStats.push({
        name: "未知",
        value: genderCounts["未知"],
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

    // 检查用户是否登录
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
