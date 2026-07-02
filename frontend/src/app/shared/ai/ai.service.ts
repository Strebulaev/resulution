// src/app/shared/ai/ai.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, retry, throwError, of, BehaviorSubject } from 'rxjs';
import { ConfigService } from '../config/config.service';
import { ErrorHandlerService } from '../error-handler.service';

export interface AIRequest {
  model: string;
  prompt: string;
  max_tokens: number;
  temperature: number;
  top_p: number;
  top_k?: number;
  repetition_penalty?: number;
  stop?: string[];
  stream?: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  isConfigured: boolean;
  models: string[];
  isDefault?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AIService {
  private currentProvider: AIProvider | null = null;
  private providers: AIProvider[] = [];
  private providersSubject = new BehaviorSubject<AIProvider[]>([]);
  private currentProviderSubject = new BehaviorSubject<AIProvider | null>(null);

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private errorHandler: ErrorHandlerService
  ) {
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    try {
      const config = await this.configService.loadConfig();
      
      this.providers = [
        {
          id: 'together',
          name: 'Together AI',
          baseUrl: 'https://api.together.xyz/v1',
          apiKey: config.togetherApiKey || '',
          isConfigured: !!config.togetherApiKey,
          models: ['meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'],
          isDefault: true
        },
        {
          id: 'deepseek',
          name: 'DeepSeek',
          baseUrl: 'https://api.deepseek.com/v1',
          apiKey: '',
          isConfigured: false,
          models: ['deepseek-chat', 'deepseek-coder']
        },
        {
          id: 'openai',
          name: 'OpenAI',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          isConfigured: false,
          models: ['gpt-4', 'gpt-3.5-turbo']
        },
        {
          id: 'huggingface',
          name: 'Hugging Face',
          baseUrl: 'https://api-inference.huggingface.co/v1',
          apiKey: '',
          isConfigured: false,
          models: ['mistralai/Mistral-7B-Instruct-v0.2', 'google/flan-t5-xxl']
        }
      ];

      const savedConfig = localStorage.getItem('ai_providers_config');
      if (savedConfig) {
        try {
          const parsedConfig = JSON.parse(savedConfig);
          if (parsedConfig.providers) {
            this.providers.forEach(provider => {
              const savedProvider = parsedConfig.providers.find((p: any) => p.id === provider.id);
              if (savedProvider) {
                provider.apiKey = savedProvider.apiKey;
                provider.isConfigured = savedProvider.isConfigured;
                if (savedProvider.baseUrl) provider.baseUrl = savedProvider.baseUrl;
              }
            });

            if (parsedConfig.customProviders) {
              parsedConfig.customProviders.forEach((cp: AIProvider) => {
                if (!this.providers.find(p => p.id === cp.id)) {
                  this.providers.push({ ...cp, isDefault: false });
                }
              });
            }

            if (parsedConfig.currentProviderId) {
              const savedCurrentProvider = this.providers.find(
                p => p.id === parsedConfig.currentProviderId && p.isConfigured
              );
              if (savedCurrentProvider) {
                this.currentProvider = savedCurrentProvider;
              }
            }
          }
        } catch (e) {
          console.error('Error parsing saved AI config:', e);
        }
      }

      if (!this.currentProvider) {
        const togetherProvider = this.providers.find(p => p.id === 'together');
        if (togetherProvider?.isConfigured) {
          this.currentProvider = togetherProvider;
        }
      }

      this.providersSubject.next([...this.providers]);
      this.currentProviderSubject.next(this.currentProvider);
      
    } catch (error) {
      console.error('Failed to initialize AI providers:', error);
      this.errorHandler.showError('Ошибка инициализации AI провайдеров', 'AIService');
    }
  }

  getProviders(): AIProvider[] {
    return this.providers;
  }

  getProvidersObservable(): Observable<AIProvider[]> {
    return this.providersSubject.asObservable();
  }

  getCurrentProvider(): AIProvider | null {
    return this.currentProvider;
  }

  getCurrentProviderObservable(): Observable<AIProvider | null> {
    return this.currentProviderSubject.asObservable();
  }

  setCurrentProvider(providerId: string): void {
    const provider = this.providers.find(p => p.id === providerId);
    if (provider && provider.isConfigured) {
      this.currentProvider = provider;
      this.saveProvidersConfig();
      this.currentProviderSubject.next(this.currentProvider);
      this.providersSubject.next([...this.providers]);
    } else {
      this.errorHandler.showError(`Провайдер ${providerId} не настроен или не найден`, 'AIService');
    }
  }

  configureProvider(providerId: string, apiKey: string, baseUrl?: string): boolean {
    const provider = this.providers.find(p => p.id === providerId);
    if (provider) {
      provider.apiKey = apiKey;
      if (baseUrl) provider.baseUrl = baseUrl;
      provider.isConfigured = !!apiKey;
      
      this.saveProvidersConfig();
      this.providersSubject.next([...this.providers]);
      return true;
    }
    return false;
  }

  async configureTogetherFromConfig(): Promise<boolean> {
    try {
      const config = await this.configService.loadConfig();
      const togetherProvider = this.providers.find(p => p.id === 'together');
      
      if (togetherProvider && config.togetherApiKey) {
        togetherProvider.apiKey = config.togetherApiKey;
        togetherProvider.isConfigured = true;
        
        // Автоматически устанавливаем как активного провайдера
        this.currentProvider = togetherProvider;
        
        this.saveProvidersConfig();
        this.providersSubject.next([...this.providers]);
        this.currentProviderSubject.next(this.currentProvider);
        
        return true;
      } else {
        this.errorHandler.showError('Together API ключ не найден в конфигурации', 'AIService');
        return false;
      }
    } catch (error) {
      console.error('Failed to configure Together AI from config:', error);
      this.errorHandler.showError('Ошибка настройки Together AI', 'AIService');
      return false;
    }
  }

  isAnyProviderConfigured(): boolean {
    return this.providers.some(provider => provider.isConfigured);
  }

  addCustomProvider(name: string, baseUrl: string, apiKey: string, models: string[]): boolean {
    const id = 'custom-' + Date.now();
    const provider: AIProvider = {
      id,
      name,
      baseUrl,
      apiKey,
      isConfigured: !!apiKey,
      models: models.length ? models : ['default'],
      isDefault: false
    };
    this.providers.push(provider);
    this.saveProvidersConfig();
    this.providersSubject.next([...this.providers]);
    return true;
  }
  
  removeProvider(providerId: string): boolean {
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider || provider.isDefault) {
      return false;
    }
    this.providers = this.providers.filter(p => p.id !== providerId);
    if (this.currentProvider?.id === providerId) {
      this.currentProvider = this.providers.find(p => p.isConfigured) || null;
      this.currentProviderSubject.next(this.currentProvider);
    }
    this.saveProvidersConfig();
    this.providersSubject.next([...this.providers]);
    return true;
  }


  generateText(request: AIRequest): Observable<string> {
    if (!this.currentProvider || !this.currentProvider.isConfigured) {
      const error = new Error('AI provider not configured');
      this.errorHandler.showAIError('AI провайдер не настроен. Нажмите на кнопку AI в верхнем меню для настройки.', 'AIService');
      return throwError(() => error);
    }
  
    const url = `${this.currentProvider.baseUrl}/completions`;
  
    return this.http.post<any>(url, request, {
      headers: {
        'Authorization': `Bearer ${this.currentProvider.apiKey}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      map(response => {
        if (!response.choices?.[0]?.text) {
          throw new Error('Invalid response from AI API');
        }
        return this.cleanGeneratedText(response.choices[0].text);
      }),
      catchError(error => {
        console.error('AI API error:', error);
        
        let errorMessage = 'Ошибка подключения к AI сервису';
        
        if (error.status === 0) {
          // CORS ошибка
          errorMessage = 'CORS ошибка: невозможно подключиться к AI API из браузера. Используйте Together AI или настройте прокси';
        } else if (error.status === 401) {
          errorMessage = 'Неверный API ключ AI провайдера';
        } else if (error.status === 403) {
          errorMessage = 'Доступ к AI сервису запрещен. Проверьте настройки API ключа';
        } else if (error.status === 429) {
          errorMessage = 'Превышен лимит запросов к AI сервису. Попробуйте позже';
        } else if (error.status >= 500) {
          errorMessage = 'Временные проблемы с AI сервисом. Попробуйте позже';
        } else {
          errorMessage = `Ошибка AI сервиса: ${error.status} ${error.statusText || error.message}`;
        }
        
        this.errorHandler.showAIError(errorMessage, 'AIService');
        return throwError(() => new Error(errorMessage));
      }),
      retry(2)
    );
  }

  testProviderConnection(providerId: string): Observable<boolean> {
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider || !provider.isConfigured) {
      this.errorHandler.showAIError(`Провайдер ${providerId} не настроен`, 'AIService');
      return of(false);
    }
  
    const testRequest = {
      model: provider.models[0],
      prompt: 'Test connection - ignore this message',
      max_tokens: 5,
      temperature: 0.1
    };
  
    return this.http.post<any>(`${provider.baseUrl}/completions`, testRequest, {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      map(response => {
        // Успешное подключение
        return true;
      }),
      catchError(error => {
        console.error('AI connection test error:', error);
        
        let errorMessage = 'Ошибка подключения к AI провайдеру';
        
        if (error.status === 0) {
          // CORS ошибка или нет сети
          if (error.error instanceof ErrorEvent) {
            errorMessage = 'CORS ошибка: невозможно подключиться к AI API из браузера. Необходимо использовать прокси или серверную часть';
          } else {
            errorMessage = 'Нет подключения к интернету или CORS ошибка';
          }
        } else if (error.status === 401) {
          errorMessage = 'Неверный API ключ';
        } else if (error.status === 403) {
          errorMessage = 'Доступ запрещен. Проверьте API ключ и права доступа';
        } else if (error.status === 429) {
          errorMessage = 'Превышен лимит запросов к AI сервису';
        } else {
          errorMessage = `Ошибка подключения: ${error.status} ${error.statusText || error.message}`;
        }
        
        this.errorHandler.showAIError(errorMessage, 'AIService');
        return of(false);
      })
    );
  }

  private cleanGeneratedText(text: string): string {
    if (!text) return '';
    return text.trim();
  }

  private saveProvidersConfig(): void {
    const builtinProviders = this.providers.filter(p => p.isDefault || ['together', 'deepseek', 'openai', 'huggingface'].includes(p.id));
    const customProviders = this.providers.filter(p => !builtinProviders.includes(p));
    const config = {
      providers: builtinProviders.map(p => ({ id: p.id, apiKey: p.apiKey, isConfigured: p.isConfigured, baseUrl: p.baseUrl })),
      customProviders,
      currentProviderId: this.currentProvider?.id
    };
    localStorage.setItem('ai_providers_config', JSON.stringify(config));
  }
}