import { GoogleGenAI } from "@google/genai";
import { Transaction, Category, BankAccount, TransactionType, User } from "../types";

/**
 * 安全取得環境變數中的 API Key
 */
const getSafeApiKey = () => {
  const key = process.env.API_KEY;
  // 檢查是否為空字串、undefined 或 null 字符串
  if (!key || key === "undefined" || key === "" || key === "null") {
    return null;
  }
  return key;
};

const handleApiError = (error: any) => {
  console.error("Gemini API Error:", error);
  const msg = error.message || "";
  
  if (msg.includes("leaked")) {
    return `### 🔐 安全警告：API 金鑰已洩漏\n\n系統偵測到您的金鑰已在公開環境流出。為了保護您的帳戶，Google 已自動停用此金鑰。\n\n**解決步驟：**\n1. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 刪除舊金鑰並產生「新金鑰」。\n2. **切記：不要將金鑰寫在程式碼中**。\n3. 將新金鑰填入 GitHub 專案的 **Settings > Secrets > API_KEY**。`;
  }
  
  if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
    return `### 🚫 存取受拒 (403)\n\n目前無法連接到 AI 服務。請確認 API 金鑰是否正確填入 GitHub Secrets。`;
  }

  if (msg.includes("429") || msg.includes("quota")) {
    return `### 📊 流量達到上限 (429)\n\n免費版 API 每分鐘有調用次數限制。請稍候 60 秒後再試。`;
  }

  return `### ⚠️ 分析暫時中斷\n\n系統訊息：${msg || "網路連線異常"}\n\n建議：請檢查網路或稍後重試。`;
};

export const getFinancialAdvice = async (
  transactions: Transaction[],
  categories: Category[],
  accounts: BankAccount[]
) => {
  const apiKey = getSafeApiKey();
  if (!apiKey) return "### 🔑 尚未設定 API 金鑰\n\n請在專案的環境變數或 GitHub Secrets 中設定 `API_KEY` 以啟用 AI 理財診斷功能。";

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

  const prompt = `你是一位專業的個人理財 AI。
  分析對象：${accounts.length} 個帳戶。
  財務概況：
  - 總資產：$${totalBalance.toLocaleString()}
  - 本月收入：$${totalIncome.toLocaleString()}
  - 本月支出：$${totalExpense.toLocaleString()}
  - 詳細支出分佈：${JSON.stringify(expenseByCategory)}
  
  請生成一份 Markdown 格式的專業分析報告：
  1. 【資產健康度評估】
  2. 【消費習慣警示】
  3. 【下個月的理財具體目標建議】
  請使用繁體中文，口吻要專業、條理清晰。`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "AI 忙碌中，請稍後再試。";
  } catch (error: any) {
    return handleApiError(error);
  }
};

export const getFortuneAdvice = async (user: User, totalBalance: number) => {
  if (!user.birthday) return "### 🔮 缺少資訊\n\n請先輸入您的出生日期，占卜球才能連結您的財富星圖。";

  const apiKey = getSafeApiKey();
  if (!apiKey) return "### 🔑 API 未就緒\n\n占卜球需要 `API_KEY` 才能看透財運，請確認環境設定。";

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `你是一位融合「西方占星」與「現代金融數據」的神祕學理財大師。
  用戶資訊：
  - 姓名：${user.name}
  - 星座：${user.zodiac}
  - 生肖：${user.chineseZodiac}
  - 存款：$${totalBalance.toLocaleString()}
  
  請根據今日星象生成 Markdown 格式的「財運報告」：
  - 【今日財運指數】(給予 1-100 分)
  - 【理財吉方位與幸運色】
  - 【玄學理財建議】(例如：今天適合簽約嗎？適合買入嗎？)
  - 【性格盲點警示】
  請使用繁體中文，風格要神祕、有趣且具啟發性。`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "占卜球目前一片迷霧，請稍候重試。";
  } catch (error: any) {
    return handleApiError(error);
  }
};