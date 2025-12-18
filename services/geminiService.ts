
import { GoogleGenAI } from "@google/genai";
import { Transaction, Category, BankAccount, TransactionType, User } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getFinancialAdvice = async (
  transactions: Transaction[],
  categories: Category[],
  accounts: BankAccount[]
) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "請配置 API_KEY 以啟用 AI 功能。";

  const totalIncome = transactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
  const expenseByCategory = categories.filter(c => c.type === TransactionType.EXPENSE)
    .map(cat => ({ name: cat.name, amount: transactions.filter(t => t.categoryId === cat.id).reduce((sum, t) => sum + t.amount, 0) }))
    .filter(item => item.amount > 0);

  const prompt = `你是一位高級理財專家。請針對數據分析：總資產$${accounts.reduce((sum, acc) => sum + acc.balance, 0)}, 收入$${totalIncome}, 支出$${totalExpense}。支出細項：${expenseByCategory.map(e => `${e.name}:$${e.amount}`).join(', ')}。請提供 Markdown 報告：1.【財務健康度】 2.【消費習慣診斷】 3.【具體行動建議】。使用繁體中文。`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "分析失敗，請檢查 API 設定。";
  }
};

export const getFortuneAdvice = async (user: User, totalBalance: number) => {
  if (!user.birthday || !user.zodiac) return "請先設定您的生日資訊。";

  const prompt = `
    你是一位融合了「現代財務規劃」與「東方玄學/西方占星」的跨界理財大師。
    使用者資料：
    - 姓名：${user.name}
    - 星座：${user.zodiac}
    - 生肖：${user.chineseZodiac}
    - 目前總資產：$${totalBalance.toLocaleString()}
    
    請根據該使用者的星座特質與生肖流年，結合其資產狀況，提供一份「財富運勢占卜報告」：
    1. 【星象財運解析】：以星座角度分析其近期的偏財運與理財盲點。
    2. 【生肖流年指引】：以生肖流年角度分析其事業財富的最佳切入點。
    3. 【開運理財策略】：給予 3 個融合玄學與科學的轉運理財建議（例如：錢包顏色、投資類型、幸運方位）。
    
    報告請使用神祕、專業且具備親和力的口吻，格式為 Markdown，繁體中文。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "占卜球目前一片模糊...請稍後再試。";
  }
};
