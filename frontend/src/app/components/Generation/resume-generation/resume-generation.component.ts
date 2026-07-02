import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownComponent } from 'ngx-markdown';
import { TranslatePipe } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { HHAuthService } from '../../../shared/job-platforms/hh/hh-auth.service';
import { HHVacancyService } from '../../../shared/job-platforms/hh/hh-vacancy.service';
import { ProfileService } from '../../../shared/profile/profile.service';
import { ResumeGenerationService } from '../../../shared/resume/resume-generation.service';
import { FileProcessorService } from '../../../shared/utils/file-processor.service';
import { TranslatedFileInputComponent } from '../../Helpers/translated-file-input/translated-file-input.component';
import { ErrorHandlerService } from '../../../shared/error-handler.service';
import { AIGuardService } from '../../../shared/ai/ai-guard.service';
import { VacancySelectorComponent } from '../../Helpers/vacancy-selector/vacancy-selector.component';
import { AnalyticsService } from '../../../shared/analytics.service';

@Component({
  selector: 'app-resume-generation',
  standalone: true,
  imports: [
    CommonModule,
    MarkdownComponent,
    TranslatePipe,
    FormsModule,
    ButtonModule,
    DialogModule,
    ProgressSpinnerModule,
    FormsModule,
    InputTextModule,
    TooltipModule,
    TranslatedFileInputComponent,
    VacancySelectorComponent
  ],
  templateUrl: './resume-generation.component.html',
  styleUrls: ['./resume-generation.component.scss']
})
export class ResumeGenerationComponent {
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private messageService = inject(MessageService);
  private fileProcessor = inject(FileProcessorService);
  
  vacancyUrl: string = '';
  selectedVacancy: any = null;
  generatedResume: string | null = null;
  coverLetterContent: string = '';
  coverLetterFile: File | null = null;
  isLoading = false;
  error: string | null = null;
  hhAuthModalVisible = false;
  isPublishing = false;
  publishStatus: 'idle' | 'success' | 'error' = 'idle';
  hhResumeUrl: string | null = null;
  showAIConfigModal = false;
  showVacancySelector = false;
  attachedFiles: File[] = [];
  
  constructor(
    private resumeService: ResumeGenerationService,
    private hhAuthService: HHAuthService,
    private vacancyService: HHVacancyService,
    public aiGuard: AIGuardService,
    private errorHandler: ErrorHandlerService,
    private analyticsService: AnalyticsService
  ) {
    this.generatedResume = this.resumeService.getResume();
    const savedCoverLetter = this.resumeService.getCoverLetter();
    if (savedCoverLetter) {
      this.coverLetterContent = savedCoverLetter;
    }
  }

  // Новые методы для работы с селектором вакансий
  onVacancySelected(vacancy: any): void {
    this.selectedVacancy = vacancy;
    this.resumeService.currentVacancy = vacancy;
    
    this.messageService.add({
      severity: 'success',
      summary: 'Вакансия выбрана',
      detail: `${vacancy.name} - ${vacancy.employer?.name}`
    });
  }

  openVacancySelector(): void {
    this.showVacancySelector = true;
  }

  clearSelectedVacancy(): void {
    this.selectedVacancy = null;
    this.resumeService.currentVacancy = null;
  }

  getPlatformIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      'hh.ru': 'pi pi-briefcase',
      'superjob.ru': 'pi pi-briefcase'
    };
    return icons[platform] || 'pi pi-question-circle';
  }

  getPlatformLabel(platform: string): string {
    const labels: { [key: string]: string } = {
      'hh.ru': 'HH.ru',
      'superjob.ru': 'SuperJob'
    };
    return labels[platform] || platform;
  }

  removeCoverLetterFile(): void {
    this.coverLetterFile = null;
    this.coverLetterContent = '';
  }

  async loadVacancyInfo(): Promise<void> {
    if (!this.vacancyUrl) return;
    
    this.isLoading = true;
    try {
      this.selectedVacancy = await this.vacancyService.getVacancyWithCache(this.vacancyUrl);
      
      if (this.selectedVacancy) {
        this.messageService.add({
          severity: 'success',
          summary: 'Информация о вакансии загружена'
        });
      }
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Ошибка загрузки вакансии',
        detail: error.message
      });
    } finally {
      this.isLoading = false;
    }
  }

  generateResume() {
    
    const aiCheck = this.aiGuard.ensureAIConfigured();
    if (!aiCheck.configured) {
      this.errorHandler.showAIError(aiCheck.message || 'AI не настроен', 'ResumeGenerationComponent');
      this.showAIConfigModal = true;
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.analyticsService.trackEvent('generate_resume', {
      has_vacancy: !!this.selectedVacancy,
      vacancy_source: this.selectedVacancy?.platform
    });
    this.generateResumeWithContext();
  }

  private generateResumeWithContext(): void {
    const coverLetter = this.coverLetterContent || undefined;

    this.resumeService.generateResume(coverLetter).subscribe({
      next: (resume) => {
        this.generatedResume = resume;
        this.isLoading = false;
        if (this.coverLetterContent) {
          this.resumeService.saveCoverLetter(this.coverLetterContent);
        }
        this.messageService.add({
          severity: 'success',
          summary: 'Резюме сгенерировано успешно!'
        });
      },
      error: (error) => {
        this.error = 'Не удалось сгенерировать резюме: ' + error.message;
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Ошибка генерации резюме',
          detail: error.message
        });
      }
    });
  }

  saveResume() {
    if (this.generatedResume) {
      this.resumeService.saveResume(this.generatedResume);
      if (this.coverLetterContent) {
        this.resumeService.saveCoverLetter(this.coverLetterContent);
      }
      this.messageService.add({
        severity: 'success',
        summary: 'Резюме сохранено'
      });
    }
  }

  deleteResume() {
    this.resumeService.deleteResume();
    this.resumeService.deleteCoverLetter();
    this.generatedResume = null;
    this.coverLetterContent = '';
    this.coverLetterFile = null;
    this.selectedVacancy = null;
    this.messageService.add({
      severity: 'info',
      summary: 'Резюме удалено'
    });
  }

  openHHAuthModal() {
    this.hhAuthModalVisible = true;
    this.publishStatus = 'idle';
    this.hhResumeUrl = null;
  }

  async connectToHH() {
    const hhToken = localStorage.getItem('hh_access_token');
    if (!hhToken) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Сначала подключите аккаунт HH.ru'
      });
      return null;
    }
    return hhToken;
  }

  async publishToHH() {
    if (!this.generatedResume) {
      this.messageService.add({
        severity: 'error',
        summary: 'Сначала сгенерируйте резюме'
      });
      return;
    }

    this.isPublishing = true;
    this.publishStatus = 'idle';

    try {
      const hhToken = await this.connectToHH();
      if (!hhToken) return;

      const resumeData = await this.prepareHHResumeData();
      if (!resumeData) return;
      
      const resumeId = await this.hhAuthService.publishResume(hhToken, resumeData);
      this.hhResumeUrl = `https://hh.ru/resume/${resumeId}`;
      this.publishStatus = 'success';
      
      this.messageService.add({
        severity: 'success',
        summary: 'Резюме опубликовано на HH.ru',
        detail: `Ссылка: ${this.hhResumeUrl}`
      });
    } catch (error: any) {
      this.errorHandler.showError('Ошибка публикации резюме', 'ResumeGenerationComponent');
      this.publishStatus = 'error';
      this.messageService.add({
        severity: 'error',
        summary: 'Ошибка публикации',
        detail: error.message || 'Не удалось опубликовать резюме'
      });
    } finally {
      this.isPublishing = false;
    }
  }

  private async prepareHHResumeData(): Promise<any> {
    const profile = await this.profileService.loadProfile().toPromise();
    if (!profile) {
      this.router.navigate(['/profile/edit']);
      this.messageService.add({
        severity: 'warn',
        summary: 'Заполните профиль перед публикацией'
      });
      return null;
    }

    const requiredFields = [
      { field: profile.name, error: 'Укажите имя' },
      { field: profile.contact.email, error: 'Укажите email' },
      { field: (profile.experience?.length ?? 0) > 0, error: 'Добавьте опыт работы' },
      { field: (profile.education?.length ?? 0) > 0, error: 'Добавьте образование' }
    ];

    const missingField = requiredFields.find(f => !f.field);
    if (missingField) {
      this.router.navigate(['/profile/edit'], {
        state: { highlightMissing: true }
      });
      this.messageService.add({
        severity: 'error',
        summary: missingField.error
      });
      return null;
    }

    const aboutText = await this.generateResumeSection(`
      Напиши профессиональное описание для раздела "О себе" используя:
      Навыки: ${(profile.skills || []).map((s: any) => s.name).join(', ')}
      Опыт: ${(profile.experience || []).length} ${this.pluralize((profile.experience || []).length, ['год', 'года', 'лет'])}
      Образование: ${(profile.education || []).map((e: any) => e.specialty).join(', ')}
    `);

    const experienceTexts = await Promise.all(
      (profile.experience || []).map((exp: any) =>
        this.generateResumeSection(`
          Опиши профессиональный опыт для резюме:
          Должность: ${exp.position}
          Компания: ${exp.company}
          Период: ${exp.start_date} - ${exp.end_date || 'по настоящее время'}
          Обязанности: ${(exp.tasks || []).join('; ')}
          Достижения: ${(exp.achievements || []).map((a: any) => a.name).join('; ')}
          Технологии: ${(exp.stack || []).join(', ')}
        `)
      )
    );

    return {
      title: `${(profile.desiredPositions || [])[0] || 'Специалист'} ${profile.name}`,
      first_name: profile.name.split(' ')[0],
      last_name: profile.name.split(' ')[1] || '',
      middle_name: profile.name.split(' ')[2] || '',
      contacts: this.formatContacts(profile.contact),
      salary: {
        amount: 200000,
        currency: 'RUR'
      },
      experience: (profile.experience || []).map((exp: any, i: number) => ({
        position: exp.position,
        company: exp.company,
        start: exp.start_date,
        end: exp.end_date || null,
        description: experienceTexts[i],
        achievements: (exp.achievements || []).map((a: any) => a.name)
      })),
      education: (profile.education || []).map((edu: any) => ({
        year: edu.end_year || edu.start_year,
        name: edu.institution,
        result: `${edu.degree}, ${edu.specialty}`,
        type: 'higher'
      })),
      skill_set: [
        ...(profile.skills || []).map((s: any) => s.name),
        ...(profile.languages || []).map((l: any) => `${l.language} (${l.level})`)
      ],
      about: aboutText,
      skills: this.formatSkills(profile.skills || []),
      hidden_fields: ['resume_access'],
      resume_locale: 'RU'
    };
  }
  closeHHAuthModal(): void {
    this.hhAuthModalVisible = false;
  }
  private generateResumeSection(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.resumeService.generateResumeSection(prompt).subscribe({
        next: (text) => resolve(text),
        error: () => resolve(this.createFallbackText(prompt))
      });
    });
  }
  
  private createFallbackText(prompt: string): string {
    if (prompt.includes('О себе') || prompt.includes('описание')) {
      return 'Опытный специалист с сильными профессиональными навыками и стремлением к развитию.';
    }
    if (prompt.includes('опыт') || prompt.includes('работа')) {
      return 'Ответственный сотрудник с доказанным опытом достижения результатов.';
    }
    return 'Профессионал с качественным опытом работы.';
  }

  private formatContacts(contact: any): any[] {
    return [
      { type: 'email', value: contact.email, preferred: true },
      contact.phone ? { type: 'cell', value: contact.phone } : null,
      contact['linkedin'] ? { type: 'skype', value: contact['linkedin'] } : null
    ].filter(Boolean);
  }

  private formatSkills(skills: any[]): string {
    return skills
      .sort((a: any, b: any) => b.level - a.level)
      .map((s: any) => `${s.name} - ${s.level}/10`)
      .join('\n');
  }

  private pluralize(count: number, forms: string[]): string {
    const cases = [2, 0, 1, 1, 1, 2];
    return forms[
      count % 100 > 4 && count % 100 < 20 ? 2 : cases[Math.min(count % 10, 5)]
    ];
  }

  async onCoverLetterFileSelect(file: File | File[]): Promise<void> {
    try {
      const selectedFile = file instanceof File ? file : (Array.isArray(file) ? file[0] : null);

      if (selectedFile) {
        this.coverLetterFile = selectedFile;
        const content = await this.fileProcessor.extractTextFromFile(selectedFile);
        this.coverLetterContent = content;
        this.messageService.add({
          severity: 'success',
          summary: 'Файл сопроводительного письма загружен'
        });
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Ошибка загрузки файла'
      });
    }
  }

  onAttachmentsSelected(files: File[]): void {
    // Add new files to existing attachments, avoiding duplicates
    const newFiles = files.filter(file =>
      !this.attachedFiles.some(existing => existing.name === file.name && existing.size === file.size)
    );

    this.attachedFiles.push(...newFiles);

    if (newFiles.length > 0) {
      this.messageService.add({
        severity: 'success',
        summary: `${newFiles.length} файл(ов) прикреплено`
      });
    }
  }

  removeAttachment(index: number): void {
    const removedFile = this.attachedFiles[index];
    this.attachedFiles.splice(index, 1);
    this.messageService.add({
      severity: 'info',
      summary: `Файл "${removedFile.name}" удален`
    });
  }

  previewFile(file: File): void {
    // Create a temporary URL for preview
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
    // Clean up the URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  trackByFile(index: number, file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'pi pi-image';
    } else if (mimeType === 'application/pdf') {
      return 'pi pi-file-pdf';
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return 'pi pi-file-word';
    } else if (mimeType.startsWith('text/')) {
      return 'pi pi-file-text';
    }
    return 'pi pi-file';
  }

  getFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getFileTypeLabel(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'Изображение';
    } else if (mimeType === 'application/pdf') {
      return 'PDF';
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return 'Документ';
    } else if (mimeType.startsWith('text/')) {
      return 'Текст';
    }
    return 'Файл';
  }
}