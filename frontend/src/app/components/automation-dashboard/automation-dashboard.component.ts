import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Subject, takeUntil } from 'rxjs';
import { JobAutomationService, AutomationSettings, AutomationStats, DailyReport } from '../../shared/job-automation/job-automation.service';
import { AnalyticsService, AnalyticsData } from '../../shared/analytics/analytics.service';
import { NotificationService, NotificationSettings } from '../../shared/notifications/notification.service';
import { Person } from '../../person-schema';
import { ProfileService } from '../../shared/profile/profile.service';

// PrimeNG imports
import { TabsModule } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { InputNumberModule } from 'primeng/inputnumber';
import { PanelModule } from 'primeng/panel';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ChartModule } from 'primeng/chart';

interface SimplifiedPerson {
  name: string;
  gender: 'unknown' | 'male' | 'female';
  desiredPositions: string[];
  employment_types?: string[];
  work_formats?: string[];
  contact: {
    email: string;
    phone?: string;
  };
  location: {
    city: string;
    country?: string;
  };
  skills?: Array<{ name: string; level: number }>;
  experience?: Array<{
    company: string;
    position: string;
    start_date?: string;
    end_date?: string;
  }>;
  notice_period?: number;
  career_level?: string;
  languages?: any[];
  education?: any[];
}

@Component({
  selector: 'app-automation-dashboard',
  templateUrl: './automation-dashboard.component.html',
  styleUrls: ['./automation-dashboard.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TabsModule,
    PanelModule,
    ButtonModule,
    ToggleSwitchModule,
    InputNumberModule,
    CheckboxModule,
    SelectModule,
    ChartModule
  ],
  providers: [MessageService]
})
export class AutomationDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  automationEnabled = false;
  automationStats: AutomationStats | null = null;
  analyticsData: AnalyticsData | null = null;
  dailyReports: DailyReport[] = [];
  profile: SimplifiedPerson | null = null;

  // Forms
  automationForm: FormGroup;
  notificationForm: FormGroup;

  // UI state
  loading = false;
  runningAutomation = false;
  currentTab = 0;

  // Tabs configuration
  tabs = [
    { header: 'Обзор' },
    { header: 'Аналитика' },
    { header: 'Настройки' },
    { header: 'История' }
  ];

  // Charts data
  applicationChartData: any;
  platformChartData: any;
  chartOptions: any;

  // Dropdown options
  experienceOptions = [
    { label: 'Без опыта', value: 'noExperience' },
    { label: '1-3 года', value: 'between1And3' },
    { label: '3-6 лет', value: 'between3And6' },
    { label: 'Более 6 лет', value: 'moreThan6' }
  ];

  employmentOptions = [
    { label: 'Полная занятость', value: 'full-time' },
    { label: 'Частичная занятость', value: 'part-time' },
    { label: 'Проектная работа', value: 'contract' },
    { label: 'Фриланс', value: 'freelance' }
  ];

  constructor(
    private fb: FormBuilder,
    private automationService: JobAutomationService,
    private analyticsService: AnalyticsService,
    private notificationService: NotificationService,
    private profileService: ProfileService,
    private messageService: MessageService
  ) {
    this.automationForm = this.createAutomationForm();
    this.notificationForm = this.createNotificationForm();
  }

  ngOnInit(): void {
    this.loadData();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Load all dashboard data
  private loadData(): void {
    this.loading = true;

    // Load profile
    this.profileService.loadProfile().subscribe(profile => {
      this.profile = profile;
    });

    // Load automation status
    this.automationService.getAutomationStatus().subscribe(status => {
      this.automationEnabled = status.enabled;
      this.automationStats = status.stats;
      this.updateAutomationForm(status.enabled);
    });

    // Load analytics
    this.analyticsService.getAnalytics().subscribe(data => {
      this.analyticsData = data;
      this.updateCharts();
    });

    // Load automation history
    this.automationService.getAutomationHistory().subscribe(reports => {
      this.dailyReports = reports;
    });

    this.loading = false;
  }

  // Setup reactive subscriptions
  private setupSubscriptions(): void {
    // Automation status changes
    this.automationService.getAutomationStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.automationEnabled = status.enabled;
        this.automationStats = status.stats;
      });

    // Analytics updates
    this.analyticsService.getAnalytics()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.analyticsData = data;
        this.updateCharts();
      });
  }

  // Create automation settings form
  private createAutomationForm(): FormGroup {
    return this.fb.group({
      enabled: [false],
      dailyLimit: [20, [Validators.min(1), Validators.max(50)]],
      platforms: this.fb.group({
        hh: [true],
        superjob: [true]
      }),
      searchCriteria: this.fb.group({
        text: [''],
        experience: ['noExperience'],
        employment: ['full-time'],
        salary: [0, [Validators.min(0)]]
      }),
      autoApply: [true],
      notificationEnabled: [true]
    });
  }

  // Create notification settings form
  private createNotificationForm(): FormGroup {
    const settings = this.notificationService.getNotificationSettings();

    return this.fb.group({
      email: [settings.email],
      telegram: [settings.telegram],
      inApp: [settings.inApp],
      dailyReports: [settings.dailyReports],
      instantAlerts: [settings.instantAlerts],
      emailAddress: [settings.emailAddress, [Validators.email]],
      telegramChatId: [settings.telegramChatId]
    });
  }

  // Update automation form values
  private updateAutomationForm(enabled: boolean): void {
    this.automationForm.patchValue({ enabled });
  }

  // Update chart data
  private updateCharts(): void {
    if (!this.analyticsData) return;

    const style = getComputedStyle(document.documentElement);
    const infoLight = style.getPropertyValue('--color-info-light').trim();
    const muted = style.getPropertyValue('--color-muted').trim();
    const info = style.getPropertyValue('--color-info').trim();
    const primaryLight = style.getPropertyValue('--color-primary-light').trim();
    const primary = style.getPropertyValue('--color-primary').trim();
    const brandHh = style.getPropertyValue('--color-brand-hh').trim();
    const primaryHover = style.getPropertyValue('--color-primary-hover').trim();
    const brandHhHover = style.getPropertyValue('--color-brand-hh-hover').trim();

    this.applicationChartData = {
      labels: ['Отправлено', 'Просмотрено', 'Отклик', 'Собеседование', 'Оффер'],
      datasets: [{
        data: [
          this.analyticsData.jobApplications,
          Math.floor(this.analyticsData.jobApplications * 0.3),
          this.analyticsData.interviews,
          this.analyticsData.interviews,
          this.analyticsData.offers
        ],
        backgroundColor: [infoLight, muted, info, primaryLight, primary]
      }]
    };

    this.platformChartData = {
      labels: ['HH.ru', 'SuperJob'],
      datasets: [{
        label: 'Отклики',
        data: [
          this.analyticsData.platformStats.hh.applications,
          this.analyticsData.platformStats.superjob.applications
        ],
        backgroundColor: [primary, brandHh]
      }, {
        label: 'Отклики с ответом',
        data: [
          this.analyticsData.platformStats.hh.responses,
          this.analyticsData.platformStats.superjob.responses
        ],
        backgroundColor: [primaryHover, brandHhHover]
      }]
    };
  }

  // Event handlers

  onAutomationToggle(): void {
    const enabled = this.automationForm.value.enabled;
    this.automationService.setAutomationEnabled(enabled);

    this.messageService.add({
      severity: enabled ? 'success' : 'info',
      summary: enabled ? 'Автоматизация включена' : 'Автоматизация отключена',
      detail: enabled ? 'Ежедневный поиск вакансий активирован' : 'Автоматизация остановлена'
    });
  }

  async onRunAutomation(): Promise<void> {
    if (!this.profile) {
      this.messageService.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Профиль не загружен'
      });
      return;
    }

    this.runningAutomation = true;

    try {
      const report = await this.automationService.runDailyAutomation(this.profile as Person);

      this.messageService.add({
        severity: 'success',
        summary: 'Автоматизация выполнена',
        detail: `Найдено ${report.stats.jobsFound} вакансий, отправлено ${report.stats.applicationsSent} откликов`
      });

      // Refresh data
      this.loadData();

    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Ошибка автоматизации',
        detail: error.message
      });
    } finally {
      this.runningAutomation = false;
    }
  }

  onSaveAutomationSettings(): void {
    const settings: Partial<AutomationSettings> = this.automationForm.value;
    this.automationService.updateSettings(settings);

    this.messageService.add({
      severity: 'success',
      summary: 'Настройки сохранены',
      detail: 'Настройки автоматизации обновлены'
    });
  }

  onSaveNotificationSettings(): void {
    const settings: Partial<NotificationSettings> = this.notificationForm.value;
    this.notificationService.updateSettings(settings);

    this.messageService.add({
      severity: 'success',
      summary: 'Настройки уведомлений сохранены',
      detail: 'Настройки уведомлений обновлены'
    });
  }

  async onTestNotifications(): Promise<void> {
    try {
      const success = await this.notificationService.testNotification().toPromise();

      if (success) {
        this.messageService.add({
          severity: 'success',
          summary: 'Тестовое уведомление отправлено',
          detail: 'Проверьте настроенные каналы связи'
        });
      } else {
        this.messageService.add({
          severity: 'warn',
          summary: 'Не удалось отправить уведомление',
          detail: 'Проверьте настройки уведомлений'
        });
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Ошибка отправки уведомления',
        detail: 'Проверьте подключение к интернету'
      });
    }
  }

  onRefreshAnalytics(): void {
    this.analyticsService.refreshAnalytics();
    this.messageService.add({
      severity: 'info',
      summary: 'Обновление данных',
      detail: 'Аналитика обновляется...'
    });
  }

  // Utility methods

  getConversionRate(): number {
    if (!this.analyticsData || this.analyticsData.jobApplications === 0) return 0;
    return Math.round((this.analyticsData.offers / this.analyticsData.jobApplications) * 100);
  }

  getAverageResponseTime(): number {
    if (!this.analyticsData) return 0;
    const hh = this.analyticsData.platformStats.hh.averageResponseTime;
    const sj = this.analyticsData.platformStats.superjob.averageResponseTime;
    return Math.round((hh + sj) / 2);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('ru-RU');
  }

  formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
