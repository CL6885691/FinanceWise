
import { GoogleGenAI } from "@google/genai";
import { Transaction, Category, BankAccount, TransactionType } from "../types";

export const getFinancialAdvice = async (
  transactions: Transaction[],
  categories: Category[],
  accounts: BankAccount[]
) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return "API KEY 未設定，請檢查環境變數。";
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const totalIncome = transactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalExpense = transactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);
    
  const expenseByCategory = categories
    .filter(c => c.type === TransactionType.EXPENSE)
    .map(cat => {
      const amount = transactions
        .filter(t => t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0);
      return { name: cat.name, amount };
    })
    .filter(item => item.amount > 0);

  const prompt = `
    你是一位世界級的高級理財專家。請針對以下真實財務數據進行深度的邏輯分析。
    
    數據摘要：
    - 當前總資產：$${accounts.reduce((sum, acc) => sum + acc.balance, 0)}
    - 本期總收入：$${totalIncome}
    - 本期總支出：$${totalExpense}
    - 儲蓄率：${totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0}%
    
    支出明細：
    ${expenseByCategory.map(e => `- ${e.name}: $${e.amount}`).join('\n')}
    
    請以專業、嚴謹且具有前瞻性的口吻提供 Markdown 報告：
    1. 【財務健康度評估】：分析資產流動性與收支結構。
    2. 【潛在風險與痛點】：識別不必要的支出或通膨影響。
    3. 【策略性行動計畫】：給予具體的理財策略（如 50/30/20 法則應用）。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Pro Error:", error);
    return "AI 思考時發生錯誤，請稍後再試。";
  }
};
