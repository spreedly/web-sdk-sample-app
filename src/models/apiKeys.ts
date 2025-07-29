import { getCurrentTimeInDays } from "../utils/date";

interface ApiKey {
  key: string;
  expiresAt: number;
}

// This model is used to store the API keys and their expiration dates in memory
// TODO: Implement a database to store the API keys and their expiration dates
class ApiKeys {
  private apiKeys: ApiKey[] = [];

  public constructor() {
    this.apiKeys = [];
  }

  public getApiKeys() {
    return this.apiKeys;
  }

  public addApiKey(apiKey: ApiKey) {
    this.apiKeys = this.apiKeys.filter((item) => item.expiresAt > getCurrentTimeInDays());
    this.apiKeys.push(apiKey);
  }
}

export const apiKeys = new ApiKeys();
