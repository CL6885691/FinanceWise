
import { GoogleGenAI } from "@google/genai";
import { Transaction, Category, BankAccount, TransactionType, User } from "../types";

/**
 * 檢查 API Key 是否有效
 */
const checkApiKey = () => {
  const key = process.env.API_KEY;
  if (!key || key === "undefined" || key === "") {
    return null;
  }
  return key;
};

export const getFinancialAdvice = async (
  transactions: Transaction[],
  categories: Category[],
  accounts: BankAccount[]
) => {
  const apiKey = checkApiKey();
  if (!apiKey) {
    return "⚠️ 偵測到 API 金鑰設定缺失。\n\n解決方法：\n1. 請確保在 GitHub Repository 的 Settings > Secrets and variables > Actions 中已新增名為 `API_KEY` 的金鑰。\n2. 重新執行 GitHub Actions 的部署工作。";
  }

  const ai = new GoogleGenAI({ apiKey });
  
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
    return response.text || "AI 分析完成，但未傳回內容。";
  } catch (error: any) {
    console.error("Financial AI Error:", error);
    if (error.message?.includes("API_KEY_INVALID")) {
      return "❌ API 金鑰無效，請檢查金鑰是否正確複製。";
    }
    return `❌ 診斷發生異常：${error.message || "可能是網路不穩或 API 額度限制，請稍後再試。"}`;
  }
};

export const getFortuneAdvice = async (user: User, totalBalance: number) => {
  if (!user.birthday || !user.zodiac) return "請先在下方設定您的生日資訊。";

  const apiKey = checkApiKey();
  if (!apiKey) {
    return "⚠️ 占卜球感應不到星象，原因：API 金鑰尚未配置於 GitHub Secrets 中。";
  }

  const ai = new GoogleGenAI({ apiKey });

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
    return response.text || "占卜球目前一片空白。";
  } catch (error: any) {
    console.error("Fortune AI Error Detail:", error);
    return `🔮 占卜失敗：${error.message || "星象不穩，請確認網路連線或 API 設定。"}`;
  }
};
