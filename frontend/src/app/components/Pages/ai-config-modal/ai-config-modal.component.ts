// Файл: src/app/components/Helpers/ai-config-modal/ai-config-modal.component.ts
import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { AIService, AIProvider } from '../../../shared/ai/ai.service';
import { ConfigService } from '../../../shared/config/config.service';
import { ErrorHandlerService } from '../../../shared/error-handler.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-ai-config-modal',
  templateUrl: './ai-config-modal.component.html',
  styleUrls: ['./ai-config-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TranslateModule]
})
export class AiConfigModalComponent implements OnInit {
  @Output() closed = new EventEmitter<void>();
  
  providers: AIProvider[] = [];
  editingProvider: string | null = null;
  originalProviderState: AIProvider | null = null;
  isLoading = false;

  showAddProviderForm = false;
  newProviderName = '';
  newProviderBaseUrl = '';
  newProviderApiKey = '';
  newProviderModels = '';

  constructor(
    private aiService: AIService,
    private configService: ConfigService,
    private messageService: MessageService,
    private errorHandler: ErrorHandlerService
  ) {}

  ngOnInit(): void {
    this.aiService.getProvidersObservable().subscribe(providers => {
      this.providers = providers;
    });
  }

  isAnyProviderConfigured(): boolean {
    return this.aiService.isAnyProviderConfigured();
  }

  editProvider(providerId: string): void {
    this.editingProvider = providerId;
    const provider = this.providers.find(p => p.id === providerId);
    if (provider) {
      this.originalProviderState = { ...provider };
    }
  }

  cancelEdit(): void {
    if (this.originalProviderState && this.editingProvider) {
      const index = this.providers.findIndex(p => p.id === this.editingProvider);
      if (index !== -1) {
        this.providers[index] = { ...this.originalProviderState };
      }
    }
    this.editingProvider = null;
    this.originalProviderState = null;
  }

  setCurrentProvider(providerId: string): void {
    try {
      this.aiService.setCurrentProvider(providerId);
      this.messageService.add({
        severity: 'success',
        summary: 'Провайдер изменен',
        detail: 'Теперь используется выбранный AI провайдер'
      });
    } catch (error: any) {
      this.errorHandler.showError('Ошибка смены провайдера: ' + error.message, 'AiConfigModalComponent');
    }
  }

  testConnection(providerId: string): void {
    this.aiService.testProviderConnection(providerId).subscribe({
      next: (success) => {
        if (success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Подключение успешно',
            detail: 'AI провайдер отвечает на запросы'
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Ошибка подключения',
            detail: 'Не удалось подключиться к AI провайдеру'
          });
        }
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Ошибка подключения',
          detail: error.message
        });
      }
    });
  }
        
  async connectTogetherAI(): Promise<void> {
    this.isLoading = true;
    try {
      const success = await this.aiService.configureTogetherFromConfig();
      if (success) {
        this.messageService.add({
          severity: 'success',
          summary: 'Together AI подключен и активирован',
          detail: 'Провайдер готов к использованию'
        });
        setTimeout(() => {
          this.testConnection('together');
        }, 1000);
      }
    } catch (error: any) {
      this.errorHandler.showAIError('Ошибка подключения Together AI: ' + error.message, 'AiConfigModalComponent');
    } finally {
      this.isLoading = false;
    }
  }

  saveProviderConfig(provider: AIProvider): void {
    const success = this.aiService.configureProvider(
      provider.id, 
      provider.apiKey, 
      provider.baseUrl
    );
    
    if (success) {
      if (provider.id === 'together' && !this.originalProviderState?.isConfigured) {
        this.aiService.setCurrentProvider('together');
      }
      
      this.messageService.add({
        severity: 'success',
        summary: 'Настройки сохранены',
        detail: `${provider.name} успешно настроен`
      });

      setTimeout(() => {
        this.testConnection(provider.id);
      }, 1000);
    } else {
      this.errorHandler.showAIError('Не удалось сохранить настройки провайдера', 'AiConfigModalComponent');
    }
    
    this.editingProvider = null;
    this.originalProviderState = null;
  }

  isCurrentProvider(providerId: string): boolean {
    const current = this.aiService.getCurrentProvider();
    return current?.id === providerId;
  }

  isCustomProvider(providerId: string): boolean {
    return providerId.startsWith('custom-');
  }

  removeProvider(providerId: string): void {
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider) return;

    const success = this.aiService.removeProvider(providerId);
    if (success) {
      this.messageService.add({
        severity: 'success',
        summary: 'Провайдер удален',
        detail: `${provider.name} удален из списка`
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Невозможно удалить провайдера'
      });
    }
  }

  toggleAddProviderForm(): void {
    this.showAddProviderForm = !this.showAddProviderForm;
    if (!this.showAddProviderForm) {
      this.resetNewProviderForm();
    }
  }

  resetNewProviderForm(): void {
    this.newProviderName = '';
    this.newProviderBaseUrl = '';
    this.newProviderApiKey = '';
    this.newProviderModels = '';
  }

  addCustomProvider(): void {
    if (!this.newProviderName.trim() || !this.newProviderBaseUrl.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Заполните поля',
        detail: 'Название и Base URL обязательны'
      });
      return;
    }

    const models = this.newProviderModels
      .split(',')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    const success = this.aiService.addCustomProvider(
      this.newProviderName.trim(),
      this.newProviderBaseUrl.trim(),
      this.newProviderApiKey.trim(),
      models
    );

    if (success) {
      this.messageService.add({
        severity: 'success',
        summary: 'Провайдер добавлен',
        detail: `${this.newProviderName} добавлен в список`
      });
      this.resetNewProviderForm();
      this.showAddProviderForm = false;
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Не удалось добавить провайдера'
      });
    }
  }

  closeModal(): void {
    this.closed.emit();
  }
}