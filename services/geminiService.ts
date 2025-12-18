
import { GoogleGenAI } from "@google/genai";
import { Transaction, Category, BankAccount, TransactionType } from "../types";

export const getFinancialAdvice = async (
  transactions: Transaction[],
  categories: Category[],
  accounts: BankAccount[]
) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key is missing. Returning placeholder advice.");
    return "系統偵測到未設定 API Key。請在 GitHub Secrets 中配置 API_KEY 以啟用完整 AI 功能。";
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
    你是一位世界級的高級理財專家。請針對以下真實財務數據進行深度的邏輯分析與前瞻性建議。
    
    數據摘要：
    - 當前總帳戶餘額：$${accounts.reduce((sum, acc) => sum + acc.balance, 0)}
    - 本期總收入：$${totalIncome}
    - 本期總支出：$${totalExpense}
    - 儲蓄率：${totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0}%
    
    支出結構明細：
    ${expenseByCategory.map(e => `- ${e.name}: $${e.amount}`).join('\n')}
    
    請以專業、權威且友善的口吻提供 Markdown 格式的財務診斷報告：
    1. 【財務健康度評估】：分析目前的收支比、儲蓄率及資產配置合理性。
    2. 【消費習慣診斷】：找出可能存在浪費的項目，或需要優化的支出分類。
    3. 【具體行動指引】：給予 3 個立即可執行的理財建議（例如：如何達成 50/30/20 法則）。
    
    語言請使用繁體中文。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Pro API Error:", error);
    return "AI 在分析數據時遇到了技術問題。請確保您的 API Key 有效且具備存取權限。";
  }
};
