import { MainClient } from 'binance';

export interface BinanceBalance {
  asset: string;
  name: string;
  free: string;
  locked: string;
  total: string;
}

export interface BinanceAccountData {
  balances: BinanceBalance[];
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
}

class BinanceService {
  createClient(apiKey: string, apiSecret: string): MainClient {
    if (!apiKey || !apiSecret) {
      throw new Error('Binance API key and secret are required');
    }

    return new MainClient({
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async getAccountData(apiKey: string, apiSecret: string): Promise<BinanceAccountData> {
    try {
      const client = this.createClient(apiKey, apiSecret);
      
      const accountInfo = await client.getAccountInformation();
      
      const balances: BinanceBalance[] = accountInfo.balances
        .map((balance) => {
          const free = parseFloat(String(balance.free));
          const locked = parseFloat(String(balance.locked));
          const total = free + locked;
          
          return {
            asset: balance.asset,
            name: balance.asset,
            free: String(balance.free),
            locked: String(balance.locked),
            total: total.toString(),
          };
        })
        .filter((balance) => parseFloat(balance.total) > 0);

      return {
        balances,
        canTrade: accountInfo.canTrade,
        canWithdraw: accountInfo.canWithdraw,
        canDeposit: accountInfo.canDeposit,
      };
    } catch (error: any) {
      if (error.message?.includes('Invalid API-key')) {
        throw new Error('مفتاح API غير صحيح. تحقق من المفاتيح في إعدادات Binance');
      } else if (error.message?.includes('Signature for this request')) {
        throw new Error('خطأ في التوقيع. تحقق من API Secret');
      } else if (error.message?.includes('Timestamp')) {
        throw new Error('خطأ في الوقت. تحقق من إعدادات الخادم');
      } else {
        throw new Error(`خطأ في الاتصال بـ Binance: ${error.message || 'خطأ غير معروف'}`);
      }
    }
  }

  async testConnection(apiKey: string, apiSecret: string): Promise<boolean> {
    try {
      const client = this.createClient(apiKey, apiSecret);
      await client.testConnectivity();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const binanceService = new BinanceService();
