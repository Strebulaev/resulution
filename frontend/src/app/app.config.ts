// src/app/app.config.ts
import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import Aura from "@primeng/themes/aura";
import { routes } from './app.routes';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { MarkdownService, SECURITY_CONTEXT } from 'ngx-markdown';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { MessageService, Translation } from 'primeng/api';
import { AppConfig, ConfigService } from './shared/config/config.service';
import { SupabaseService } from './shared/db/supabase.service';
import { environment } from '../environments/environment.prod';
import { LanguageService } from './shared/utils/language.service';
import { PrimeNGTranslationService } from './shared/utils/primeng-translation.service';
import { BillingService } from './shared/billing/billing.service';
import { PaymentService } from './shared/billing/payment.service';
import { UsageService } from './shared/billing/usage.service';
import { AnalyticsService } from './shared/analytics.service';

export function initializeApp(configService: ConfigService, supabaseService: SupabaseService): () => Promise<void> {
  return async () => {
    try {
      const config = await configService.loadConfig();
      
      if (!config.supabaseUrl || !config.supabaseKey) {
        console.warn('Supabase config missing, using mock mode');
        await supabaseService.initialize(config);
        return;
      }
      
      await supabaseService.initialize(config);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      const fallbackConfig = {
        supabaseUrl: '',
        supabaseKey: '',
        togetherApiKey: '',
        hhClientId: '',
        hhClientSecret: '',
        superJobClientId: '',
        superJobClientSecret: '',
        habrClientId: '',
        habrClientSecret: '',
        yookassaShopId: '',
        yookassaSecretKey: '',
        demoMode: false,
        analytics: {
          googleAnalyticsId: '',
          yandexMetrikaId: '',
          microsoftClarityId: '',
          hotjarId: '',
        }

      };
      await supabaseService.initialize(fallbackConfig);
    }
  };
}

export function initializeTranslation(
  translate: TranslateService,
  languageService: LanguageService
) {
  return () => {
    const defaultLang = languageService.getLanguage();
    translate.setDefaultLang('en');
    translate.use(defaultLang);

    // Set PrimeNG translations based on language
    const primeNgTranslations = getPrimeNgTranslations(defaultLang);
    translate.setTranslation(defaultLang, { PRIMENG: primeNgTranslations }, true);
  };
}

function getPrimeNgTranslations(lang: string): any {
  if (lang === 'ru') {
    return {
      accept: 'Да',
      reject: 'Нет',
      choose: 'Выбрать',
      upload: 'Загрузить',
      cancel: 'Отмена',
      dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
      dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
      dayNamesMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
      monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
      monthNamesShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
      today: 'Сегодня',
      clear: 'Очистить',
      weekHeader: 'Нед',
      firstDayOfWeek: 1,
      dateFormat: 'dd.mm.yy',
      weak: 'Слабый',
      medium: 'Средний',
      strong: 'Сильный',
      passwordPrompt: 'Введите пароль'
    };
  } else {
    return {
      accept: 'Yes',
      reject: 'No',
      choose: 'Choose',
      upload: 'Upload',
      cancel: 'Cancel',
      dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      dayNamesMin: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
      monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      today: 'Today',
      clear: 'Clear',
      weekHeader: 'Wk',
      firstDayOfWeek: 0,
      dateFormat: 'mm/dd/yy',
      weak: 'Weak',
      medium: 'Medium',
      strong: 'Strong',
      passwordPrompt: 'Enter a password'
    };
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [ConfigService, SupabaseService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTranslation,
      deps: [TranslateService, LanguageService],
      multi: true
    },
    { 
      provide: HTTP_INTERCEPTORS, 
      useClass: AuthInterceptor, 
      multi: true,
    },
    provideAnimationsAsync(),
    providePrimeNG(
      {
        theme: {
          preset: Aura
        },
        translation: {
          accept: 'Yes',
          reject: 'No',
          choose: 'Choose',
          upload: 'Upload',
          cancel: 'Cancel',
          dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          dayNamesMin: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
          monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
          monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          today: 'Today',
          clear: 'Clear',
          weekHeader: 'Wk',
          firstDayOfWeek: 0,
          dateFormat: 'mm/dd/yy',
          weak: 'Weak',
          medium: 'Medium',
          strong: 'Strong',
          passwordPrompt: 'Enter a password'
        }
      }
    ),
    provideZoneChangeDetection({ eventCoalescing: true }),
    MarkdownService,
    MessageService,
    { provide: SECURITY_CONTEXT, useValue: 0 },
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/locale/messages.',
        suffix: '.json'
      })
    }),
    PrimeNGTranslationService
  ]
};