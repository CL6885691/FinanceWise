import { GoogleGenAI } from "@google/genai";
import { Transaction, Category, BankAccount, TransactionType, User } from "../types";

/**
 * 處理 API 錯誤並回傳易讀的 Markdown 訊息
 */
const handleApiError = (error: any) => {
  console.error("Gemini API Error:", error);
  const msg = error.message || "";
  
  if (msg.includes("leaked")) {
    return `### 🔐 安全警告：API 金鑰已洩漏\n\n偵測到您的金鑰曾在公開環境流出。為了保護帳戶，Google 已停用此金鑰。\n\n**修復方式：**\n1. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 刪除舊金鑰並產生「新金鑰」。\n2. **請勿**在程式碼中貼上金鑰。\n3. 將新金鑰填入 GitHub 專案的 **Settings > Secrets > API_KEY**。`;
  }
  
  if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
    return `### 🚫 存取受拒 (403)\n\n無法連接 AI 服務。請檢查 GitHub Secrets 中的 \`API_KEY\` 是否正確且已啟用。`;
  }

  if (msg.includes("429") || msg.includes("quota")) {
    return `### 📊 流量限制 (429)\n\n免費版 API 已達上限。請等待 60 秒後重試。`;
  }

  return `### ⚠️ 分析暫時無法完成\n\n系統訊息：${msg || "網路連線異常"}`;
};

export const getFinancialAdvice = async (
  transactions: Transaction[],
  categories: Category[],
  accounts: BankAccount[]
) => {
  if (!process.env.API_KEY) return "### 🔑 尚未偵測到 API 金鑰\n\n請在專案環境變數中設定 `API_KEY`。";

  // 每次調用時建立新實例以確保使用最新密鑰
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
  請使用繁體中文，口吻專業。`;

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
  if (!user.birthday) return "### 🔮 缺少資訊\n\n請輸入出生日期以啟動占卜球。";
  if (!process.env.API_KEY) return "### 🔑 API 未就緒\n\n請設定 `API_KEY`。";

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `你是一位神祕學理財大師。
  用戶資訊：
  - 姓名：${user.name}
  - 星座：${user.zodiac}
  - 生肖：${user.chineseZodiac}
  - 存款：$${totalBalance.toLocaleString()}
  
  請根據今日星象生成 Markdown 財運報告：
  - 【今日財運指數】(1-100)
  - 【理財吉方位與幸運色】
  - 【玄學建議與盲點警示】
  請使用繁體中文，神祕且有趣。`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "占卜球目前一片迷霧。";
  } catch (error: any) {
    return handleApiError(error);
  }
};