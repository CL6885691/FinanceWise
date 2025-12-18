
import { GoogleGenAI } from "@google/genai";
import { Transaction, Category, BankAccount, TransactionType } from "../types";

export const getFinancialAdvice = async (
  transactions: Transaction[],
  categories: Category[],
  accounts: BankAccount[]
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  
  // Prepare data summary for the AI
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
    你是一位專業的個人理財顧問。請根據以下財務狀況給予具體、客觀且友善的建議。
    
    當前資產概況：
    - 總帳戶餘額：$${accounts.reduce((sum, acc) => sum + acc.balance, 0)}
    - 本期總收入：$${totalIncome}
    - 本期總支出：$${totalExpense}
    - 結餘：$${totalIncome - totalExpense}
    
    支出細分：
    ${expenseByCategory.map(e => `- ${e.name}: $${e.amount}`).join('\n')}
    
    請以 Markdown 格式回應，包含以下三個章節：
    1. 財務現況分析：分析收支比與資金運用效率。
    2. 優化建議：找出支出過高的部分或可以改進的理財習慣。
    3. 行動指南：給予 2-3 個具體的下一步行動。
    
    語言請使用繁體中文。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("AI Advice Error:", error);
    return "抱歉，目前無法產生 AI 建議。請稍後再試。";
  }
};
