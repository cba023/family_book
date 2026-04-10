export function toChineseNum(num: number): string {
  const chineseNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const units = ['', '十', '百', '千'];
  
  if (num === 0) return chineseNums[0];
  
  let result = '';
  let strNum = num.toString();
  
  // 简单处理 1-99 的情况，族谱一般不会超过这个代数
  if (num < 10) {
    return chineseNums[num];
  } else if (num < 20) {
    return '十' + (num % 10 !== 0 ? chineseNums[num % 10] : '');
  } else if (num < 100) {
    const unit = Math.floor(num / 10);
    const digit = num % 10;
    return chineseNums[unit] + '十' + (digit !== 0 ? chineseNums[digit] : '');
  }
  
  // 兜底逻辑
  return num.toString();
}
