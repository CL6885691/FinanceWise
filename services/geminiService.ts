
import { GoogleGenAI } from "@google/genai";
import { Transaction, Category, BankAccount, TransactionType, User } from "../types";

/**
 * 檢查環境變數中的 API Key
 */
const checkApiKey = () => {
  // 檢查 process.env.API_KEY (Vite 打包後會被替換為實際字串)
  const key = process.env.API_KEY;
  if (!key || key === "undefined" || key === "" || key === "null") {
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
    return "⚠️ 偵測到 API 金鑰未注入。\n\n**解決步驟：**\n1. 前往 GitHub Repo > Settings > Secrets > Actions。\n2. 新增 `API_KEY` 並填入您的 Gemini Key。\n3. 重新推動程式碼或重新執行 Action。";
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
  
  請提供 Markdown 報告，包含財務健康評分、消費診斷與具體建議。使用繁體中文。`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "AI 分析完成，但未傳回內容。";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // 輸出具體錯誤訊息，幫助使用者排查
    return `❌ AI 分析失敗\n錯誤訊息：${error.message || '連線逾時或金鑰無效'}\n\n請確認您的 API 金鑰已啟用 "Generative Language API" 權限。`;
  }
};

export const getFortuneAdvice = async (user: User, totalBalance: number) => {
  if (!user.birthday || !user.zodiac) return "請先在下方設定您的生日資訊。";

  const apiKey = checkApiKey();
  if (!apiKey) {
    return "⚠️ 占卜球失效：環境變數中找不到 API 金鑰。";
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    你是一位理財大師，專長是結合現代金流與占星。
    使用者：${user.name}，${user.zodiac} (生肖：${user.chineseZodiac})
    目前資產：$${totalBalance.toLocaleString()}
    請生成 Markdown 格式的理財命盤，包含財星方位、理財盲點與玄學轉運建議。使用繁體中文。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "占卜球目前一片空白。";
  } catch (error: any) {
    console.error("Fortune API Error:", error);
    return `🔮 占卜系統異常\n原因：${error.message}\n\n請檢查 Google AI Studio 中的 API 使用配額是否已滿。`;
  }
};
