import { GoogleGenAI } from "@google/genai";
import { Transaction, Category, BankAccount, TransactionType, User } from "../types";

/**
 * 取得 API Key 的安全封裝
 */
const getSafeApiKey = () => {
  const key = process.env.API_KEY;
  if (!key || key === "undefined" || key === "" || key === "null") {
    return null;
  }
  return key;
};

const handleApiError = (error: any) => {
  console.error("Gemini API Error Detail:", error);
  const msg = error.message || "";
  
  if (msg.includes("leaked")) {
    return `### 🔐 安全性封鎖：金鑰已洩漏\n\n偵測到此 API 金鑰曾在網路公開。請執行以下步驟：\n1. 到 [AI Studio](https://aistudio.google.com/app/apikey) 刪除舊金鑰並產生**新金鑰**。\n2. **絕對不要**將金鑰寫在程式碼裡。\n3. 將新金鑰填入 GitHub 專案的 **Settings > Secrets > API_KEY**。`;
  }
  
  if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
    return `### 🚫 存取受限 (403)\n\n請確認您的 API 金鑰是否有效，且已在 Google Cloud 中啟用了 Generative Language API。`;
  }

  if (msg.includes("429") || msg.includes("quota")) {
    return `### 📊 配額已滿 (429)\n\n目前 API 使用量已達到免費版上限，請稍候再試，或檢查 Google AI Studio 中的 Quota 設定。`;
  }

  return `### ⚠️ 分析暫時無法完成\n\n原因：${msg || "網路連線不穩定"}\n\n請稍後再試。`;
};

export const getFinancialAdvice = async (
  transactions: Transaction[],
  categories: Category[],
  accounts: BankAccount[]
) => {
  const apiKey = getSafeApiKey();
  if (!apiKey) return "❌ 系統偵測不到 API 金鑰。請檢查環境變數設定。";

  const ai = new GoogleGenAI({ apiKey });
  
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalIncome = transactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
  
  const expenseByCategory = categories.filter(c => c.type === TransactionType.EXPENSE)
    .map(cat => ({ 
      name: cat.name, 
      amount: transactions.filter(t => t.categoryId === cat.id).reduce((sum, t) => sum + t.amount, 0) 
    }))
    .filter(item => item.amount > 0);

  const prompt = `你是一位擁有 20 年經驗的資深理財顧問。
  請針對以下財務數據進行專業診斷：
  - 目前總資產：$${totalBalance.toLocaleString()}
  - 本月總收入：$${totalIncome.toLocaleString()}
  - 本月總支出：$${totalExpense.toLocaleString()}
  - 支出分佈：${JSON.stringify(expenseByCategory)}
  
  請提供一份 Markdown 格式的財務報告，包含：
  1. 【資產健康評分】(0-100)
  2. 【支出警示】分析哪些項目花費過多。
  3. 【增長策略】根據餘額給予投資或儲蓄建議。
  使用繁體中文，口吻要專業且具鼓勵性。`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "AI 診斷完成，但未產生文字內容。";
  } catch (error: any) {
    return handleApiError(error);
  }
};

export const getFortuneAdvice = async (user: User, totalBalance: number) => {
  if (!user.birthday) return "🔮 占卜球需要您的生日才能運作。";

  const apiKey = getSafeApiKey();
  if (!apiKey) return "❌ 占卜球失效：找不到 API 金鑰。";

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `你是一位融合「現代金融」與「東方易經」的命理大師。
  使用者資訊：
  - 姓名：${user.name}
  - 星座：${user.zodiac}
  - 生肖：${user.chineseZodiac}
  - 當前資產：$${totalBalance.toLocaleString()}
  
  請生成一份 Markdown 格式的「今日財運命盤」：
  - 【財運指數】(用五顆星表示)
  - 【開運方位與顏色】
  - 【理財盲點】結合性格給予警示。
  - 【玄學建議】如何轉運。
  口吻要神祕且有趣，使用繁體中文。`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "占卜球目前一片混濁，請稍後再試。";
  } catch (error: any) {
    return handleApiError(error);
  }
};