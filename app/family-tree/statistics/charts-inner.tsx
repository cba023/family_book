"use client";

import React from "react";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { StatisticsData } from "./actions";

interface StatisticsChartsInnerProps {
    data: StatisticsData;
}

export function StatisticsChartsInner({ data }: StatisticsChartsInnerProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 概览卡片 */}
            <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                    <CardTitle>数据概览</CardTitle>
                    <CardDescription>家族成员基础数据统计</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-7 gap-4 text-center">
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-3xl font-bold">{data.totalMembers}</div>
                        <div className="text-sm text-muted-foreground">总人数</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-3xl font-bold">
                            {data.genderStats.find((g) => g.name === "男")?.value || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">男性成员</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-3xl font-bold">
                            {data.genderStats.find((g) => g.name === "女")?.value || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">女性成员</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-3xl font-bold">
                            {data.marriedInFemaleCount}
                        </div>
                        <div className="text-sm text-muted-foreground">嫁入女性</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-3xl font-bold">
                            {data.marriedInFemaleFromCount}
                        </div>
                        <div className="text-sm text-muted-foreground">女性族裔</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-3xl font-bold">
                            {data.statusStats.find((s) => s.name === "在世")?.value || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">在世成员</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-3xl font-bold">
                            {data.generationStats.length}
                        </div>
                        <div className="text-sm text-muted-foreground">繁衍世代数</div>
                    </div>
                </CardContent>
            </Card>

            {/* 族裔性别比例 */}
            <Card>
                <CardHeader>
                    <CardTitle>族裔性别比例</CardTitle>
                    <CardDescription>族裔成员（不含始祖、嫁入）性别分布</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data.genderStats}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, percent }) =>
                                    `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                                }
                            >
                                {data.genderStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => [value, "人数"]} />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* 在世成员年龄占比 */}
            <Card>
                <CardHeader>
                    <CardTitle>在世成员年龄占比</CardTitle>
                    <CardDescription>在世成员年龄分布</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data.aliveAgeStats}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, percent }) =>
                                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                                }
                            >
                                {data.aliveAgeStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => [value, "人数"]} />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* 年龄分布 */}
            <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                    <CardTitle>在世成员年龄分布</CardTitle>
                    <CardDescription>基于已录入生日的在世成员统计</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data.ageStats}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip formatter={(value) => [value, "人数"]} />
                            <Bar dataKey="value" fill="#82ca9d" name="人数" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* 世代分布 */}
            <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                    <CardTitle>世代分布</CardTitle>
                    <CardDescription>各世代成员数量统计</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data.generationStats}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip formatter={(value) => [value, "人数"]} />
                            <Bar dataKey="value" fill="#8884d8" name="人数" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
