
import { GoogleGenAI } from "@google/genai";
import { Transaction, Category, BankAccount, TransactionType, User } from "../types";

// Always create a new GoogleGenAI instance right before making an API call to ensure it uses the most up-to-date API key.
export const getFinancialAdvice = async (
  transactions: Transaction[],
  categories: Category[],
  accounts: BankAccount[]
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const totalIncome = transactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
  const expenseByCategory = categories.filter(c => c.type === TransactionType.EXPENSE)
    .map(cat => ({ name: cat.name, amount: transactions.filter(t => t.categoryId === cat.id).reduce((sum, t) => sum + t.amount, 0) }))
    .filter(item => item.amount > 0);

  const prompt = `你是一位高級理財專家。請針對以下數據進行深度分析：
  - 總資產：$${accounts.reduce((sum, acc) => sum + acc.balance, 0).toLocaleString()}
  - 本月收入：$${totalIncome.toLocaleString()}
  - 本月支出：$${totalExpense.toLocaleString()}
  - 支出細項：${expenseByCategory.length > 0 ? expenseByCategory.map(e => `${e.name}:$${e.amount}`).join(', ') : '目前尚無支出紀錄'}
  
  請提供 Markdown 報告：
  1. 【財務健康度評分】：給出 0-100 分並解釋原因。
  2. 【消費習慣診斷】：分析支出結構是否合理。
  3. 【具體行動建議】：給出 3 個可以立即執行的理財建議。
  使用繁體中文，語氣專業且鼓勵。`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text || "分析結果為空。";
  } catch (error: any) {
    console.error("AI Error:", error);
    return `分析失敗：${error.message || "請稍後再試。"}`;
  }
};

export const getFortuneAdvice = async (user: User, totalBalance: number) => {
  if (!user.birthday || !user.zodiac) return "請先設定您的生日資訊以開啟算命功能。";

  // Always create a new GoogleGenAI instance right before making an API call.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    你是一位理財大師，專長是結合現代金流分析與東西方占星。
    使用者：${user.name}
    特質：${user.zodiac} (生肖：${user.chineseZodiac})
    目前總資產：$${totalBalance.toLocaleString()}
    
    請以此生成一份「理財命盤分析」：
    1. 【今日財星方位】：根據生肖星座推算的幸運方位。
    2. 【星座理財盲點】：該星座常見的消費陷阱與近期需注意的風險。
    3. 【玄學轉運建議】：結合總資產狀況，給予 3 個開運動作（如：調整錢包、投資標的建議）。
    
    語氣神祕且溫馨，使用 Markdown 格式，繁體中文。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text || "占卜球無法顯示訊息。";
  } catch (error: any) {
    console.error("Fortune AI Error:", error);
    return "占卜球目前一片模糊...可能是因為星象不穩，請確認環境設定。";
  }
};
