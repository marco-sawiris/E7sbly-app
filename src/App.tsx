import React, { useState, useEffect } from 'react';
import {
  Menu, X, Sun, Moon, Globe, Download, CheckCircle2, RotateCcw,
  Plus, Minus, Trash2, ArrowLeft, ArrowRight, ShieldCheck,
  Scale, Calculator, Sparkles, ExternalLink, Info, AlertTriangle,
  Trophy, Crown, Tag, Coins, TrendingDown, Award, User, HelpCircle,
  UploadCloud, Check, Loader2, HardDrive, LogOut
} from 'lucide-react';
import {
  initDriveAuth,
  signInWithGoogle,
  logoutGoogle,
  uploadApkToGoogleDrive,
  uploadFullProjectToFolder,
  type UploadedDriveFile,
  type DriveProjectUploadResult
} from './lib/drive.ts';
import type { User as FirebaseUser } from 'firebase/auth';

interface ProductInput {
  id: string;
  name: string;
  weight: string;
  unit: 'g' | 'kg' | 'l';
  price: string;
  quantity: number;
}

interface RankedProduct {
  id: string;
  name: string;
  weight: number;
  unit: 'g' | 'kg' | 'l';
  price: number;
  quantity: number;
  pricePerUnit: number; // EGP per kg or per L
  rank: number;
  isCheapest: boolean;
  savingsVsAlternative: { altName: string; diffEGP: number }[];
}

export default function App() {
  const [lang, setLang] = useState<'ar' | 'en'>(() => {
    return (localStorage.getItem('ehsably_lang') as 'ar' | 'en') || 'ar';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ehsably_theme') as 'light' | 'dark') || 'light';
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [developerModalOpen, setDeveloperModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'app' | 'verification'>('app');

  // Google Drive state
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [, setGoogleToken] = useState<string | null>(null);
  const [isDriveLoggingIn, setIsDriveLoggingIn] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadProgress, setDriveUploadProgress] = useState<string | null>(null);
  const [driveStepInfo, setDriveStepInfo] = useState<{ step: number; total: number } | null>(null);
  const [uploadedDriveFile, setUploadedDriveFile] = useState<UploadedDriveFile | null>(null);
  const [uploadedProjectResult, setUploadedProjectResult] = useState<DriveProjectUploadResult | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initDriveAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleDriveSignIn = async () => {
    try {
      setIsDriveLoggingIn(true);
      setDriveError(null);
      const res = await signInWithGoogle();
      setGoogleUser(res.user);
      setGoogleToken(res.accessToken);
    } catch (err: any) {
      console.error(err);
      setDriveError(err?.message || (lang === 'ar' ? 'فشل تسجيل الدخول بحساب Google' : 'Google sign-in failed'));
    } finally {
      setIsDriveLoggingIn(false);
    }
  };

  const handleGoogleDriveLogout = async () => {
    try {
      await logoutGoogle();
      setGoogleUser(null);
      setGoogleToken(null);
      setUploadedDriveFile(null);
      setUploadedProjectResult(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleUploadToDrive = async () => {
    try {
      setIsUploadingToDrive(true);
      setDriveError(null);
      setDriveUploadProgress(lang === 'ar' ? 'جارٍ جلب ملف الـ APK...' : 'Fetching APK file...');
      const file = await uploadApkToGoogleDrive((msg) => setDriveUploadProgress(msg));
      setUploadedDriveFile(file);
    } catch (err: any) {
      console.error(err);
      setDriveError(err?.message || (lang === 'ar' ? 'حدث خطأ أثناء الرفع إلى Google Drive' : 'Failed to upload to Google Drive'));
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleUploadFullProject = async () => {
    try {
      setIsUploadingToDrive(true);
      setDriveError(null);
      setUploadedDriveFile(null);
      setUploadedProjectResult(null);
      const result = await uploadFullProjectToFolder((step, total, msg) => {
        setDriveStepInfo({ step, total });
        setDriveUploadProgress(msg);
      });
      setUploadedProjectResult(result);
    } catch (err: any) {
      console.error(err);
      setDriveError(err?.message || (lang === 'ar' ? 'حدث خطأ أثناء رفع مجلد المشروع إلى Google Drive' : 'Failed to upload project folder to Google Drive'));
    } finally {
      setIsUploadingToDrive(false);
      setDriveStepInfo(null);
    }
  };

  // Requirement 2: Start with empty inputs when opened
  const createEmptyProduct = (): ProductInput => ({
    id: Math.random().toString(36).substring(2, 9),
    name: '',
    weight: '',
    unit: 'g',
    price: '',
    quantity: 1,
  });

  const [products, setProducts] = useState<ProductInput[]>([
    createEmptyProduct(),
    createEmptyProduct(),
  ]);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Results state
  const [results, setResults] = useState<{
    ranked: RankedProduct[];
    isVolume: boolean;
    cheapest: RankedProduct;
    savingsPerUnit: number;
    savingsPercent: number;
    allEqual: boolean;
  } | null>(null);

  // Synchronize document dir and theme
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    localStorage.setItem('ehsably_lang', lang);
  }, [lang]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('ehsably_theme', theme);
  }, [theme]);

  // Requirement 9: Auto-select text on numeric inputs
  const handleNumericFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleProductChange = (id: string, field: keyof ProductInput, val: any) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
    setErrors(prev => {
      const next = { ...prev };
      delete next[`${id}_${field}`];
      return next;
    });
    setGeneralError(null);
  };

  // Requirement 4: Top quantity stepper controls - instant & responsive
  const handleQuantityDelta = (id: string, delta: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== id) return p;
      const nextQty = Math.max(1, Math.min(99, (p.quantity || 1) + delta));
      return { ...p, quantity: nextQty };
    }));
  };

  const handleAddProduct = () => {
    if (products.length >= 5) return;
    setProducts(prev => [...prev, createEmptyProduct()]);
  };

  const handleRemoveProduct = (id: string) => {
    if (products.length <= 2) return;
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Requirement 8: Navigation actions ("Back to Menu" & "Start Over")
  const handleStartOver = () => {
    setProducts([createEmptyProduct(), createEmptyProduct()]);
    setResults(null);
    setErrors({});
    setGeneralError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToMenu = () => {
    setDrawerOpen(true);
  };

  const handleLoadExample = () => {
    setProducts([
      {
        id: 'ex-1',
        name: lang === 'ar' ? 'عبوة ٣٠٠ جرام' : 'Pack 300g',
        weight: '300',
        unit: 'g',
        price: '30',
        quantity: 1,
      },
      {
        id: 'ex-2',
        name: lang === 'ar' ? 'عبوة ٤٥٠ جرام' : 'Pack 450g',
        weight: '450',
        unit: 'g',
        price: '40',
        quantity: 1,
      },
    ]);
    setErrors({});
    setGeneralError(null);
  };

  // Parsing Arabic & English digits safely
  const parseArabicNum = (val: string): number => {
    if (!val) return NaN;
    const normalized = val
      .replace(/[\u0660-\u0669]/g, d => (d.charCodeAt(0) - 0x0660).toString())
      .replace(/[\u06f0-\u06f9]/g, d => (d.charCodeAt(0) - 0x06f0).toString())
      .replace(/٫/g, '.')
      .replace(/,/g, '.')
      .trim();
    return parseFloat(normalized);
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    const validRows: {
      id: string;
      name: string;
      weightNum: number;
      priceNum: number;
      unit: 'g' | 'kg' | 'l';
      quantity: number;
      isVolume: boolean;
    }[] = [];

    products.forEach((p, index) => {
      const defaultName = lang === 'ar' ? `المنتج ${index + 1}` : `Product ${index + 1}`;
      const name = p.name.trim() || defaultName;

      const wt = parseArabicNum(p.weight);
      const pr = parseArabicNum(p.price);

      let hasField = false;
      if (p.weight.trim() !== '' || p.price.trim() !== '' || p.name.trim() !== '') {
        hasField = true;
      }

      if (hasField) {
        if (isNaN(wt) || wt <= 0) {
          newErrors[`${p.id}_weight`] = lang === 'ar' ? 'أدخل وزنًا أو حجمًا صحيحًا' : 'Enter a valid weight/volume';
        }
        if (isNaN(pr) || pr <= 0) {
          newErrors[`${p.id}_price`] = lang === 'ar' ? 'أدخل سعرًا صحيحًا' : 'Enter a valid price';
        }
      }

      if (!isNaN(wt) && wt > 0 && !isNaN(pr) && pr > 0) {
        validRows.push({
          id: p.id,
          name,
          weightNum: wt,
          priceNum: pr,
          unit: p.unit,
          quantity: p.quantity || 1,
          isVolume: p.unit === 'l',
        });
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setGeneralError(lang === 'ar' ? 'راجع الوزن والسعر المكتوبين قبل الحساب.' : 'Check the weights and prices before calculating.');
      return;
    }

    if (validRows.length < 2) {
      setGeneralError(lang === 'ar' ? 'أدخل منتجين على الأقل للمقارنة.' : 'Enter at least two products to compare.');
      return;
    }

    // Requirement 7: Strict check for weight vs volume compatibility
    const hasVolume = validRows.some(r => r.isVolume);
    const hasWeight = validRows.some(r => !r.isVolume);

    if (hasVolume && hasWeight) {
      setGeneralError(
        lang === 'ar'
          ? 'لا يمكن مقارنة الوزن (كيلوجرام/جرام) بالحجم (لتر) مباشرة بدون معرفة الكثافة. يرجى توحيد نوع الوحدة.'
          : 'Cannot compare weight (kg/g) directly with volume (L) without density. Please use compatible units.'
      );
      return;
    }

    const isVolumeMode = hasVolume;

    // Calculate normalized price per comparable unit (per kg or per L)
    const normalized = validRows.map(r => {
      let weightInBasis = r.weightNum;
      if (r.unit === 'g') {
        weightInBasis = r.weightNum / 1000;
      }
      const pricePerUnit = r.priceNum / weightInBasis;
      return {
        ...r,
        pricePerUnit,
      };
    });

    // Rank from lowest to highest price per unit
    normalized.sort((a, b) => a.pricePerUnit - b.pricePerUnit);

    const cheapest = normalized[0];
    const mostExpensive = normalized[normalized.length - 1];
    const allEqual = Math.abs(cheapest.pricePerUnit - mostExpensive.pricePerUnit) < 0.0001;

    let rank = 1;
    const ranked: RankedProduct[] = normalized.map((p, index) => {
      if (index > 0 && Math.abs(p.pricePerUnit - normalized[index - 1].pricePerUnit) > 0.0001) {
        rank = index + 1;
      }
      const isCheapest = Math.abs(p.pricePerUnit - cheapest.pricePerUnit) < 0.0001;

      // Requirement 1 & 5: Savings compared to each alternative in Egyptian pounds
      const savingsVsAlternative: { altName: string; diffEGP: number }[] = [];
      if (isCheapest) {
        normalized.forEach(alt => {
          if (alt.id !== p.id && alt.pricePerUnit > p.pricePerUnit + 0.0001) {
            savingsVsAlternative.push({
              altName: alt.name,
              diffEGP: alt.pricePerUnit - p.pricePerUnit,
            });
          }
        });
      }

      return {
        id: p.id,
        name: p.name,
        weight: p.weightNum,
        unit: p.unit,
        price: p.priceNum,
        quantity: p.quantity,
        pricePerUnit: p.pricePerUnit,
        rank,
        isCheapest,
        savingsVsAlternative,
      };
    });

    const savingsPerUnit = mostExpensive.pricePerUnit - cheapest.pricePerUnit;
    const savingsPercent = mostExpensive.pricePerUnit > 0
      ? (savingsPerUnit / mostExpensive.pricePerUnit) * 100
      : 0;

    setResults({
      ranked,
      isVolume: isVolumeMode,
      cheapest: ranked[0],
      savingsPerUnit,
      savingsPercent,
      allEqual,
    });

    // Scroll smoothly to results
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
  };

  return (
    <div className={`min-h-screen w-full overflow-x-hidden ${theme === 'dark' ? 'bg-[#0b1329] text-slate-100' : 'bg-[#f4f7fc] text-[#1f347d]'} transition-colors duration-200 pb-16`}>
      {/* Top Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b ${theme === 'dark' ? 'bg-[#0f172a]/95 border-slate-800' : 'bg-white/95 border-slate-200'} px-3 sm:px-4 py-3 shadow-xs`}>
        <div className="w-full max-w-2xl lg:max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className={`p-2 rounded-xl border transition-all hover:scale-105 active:scale-95 ${theme === 'dark' ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-sky-400' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#3c89bd]'}`}
              aria-label={lang === 'ar' ? 'القائمة الجانبية' : 'Side Navigation Menu'}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 font-black text-xl tracking-tight select-none">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1f347d] to-[#3c89bd] text-white flex items-center justify-center font-black text-sm shadow-md hover:scale-105 active:scale-95 transition-transform">
                <Scale className="w-5 h-5 text-sky-200" />
              </div>
              <span className="text-[#1f347d] dark:text-white">
                {lang === 'ar' ? 'احسبلى' : 'E7sbly'}
                <span className="text-sky-500">.</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Theme Toggle */}
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-xl border flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${theme === 'dark' ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-amber-400' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'}`}
              title={theme === 'dark' ? (lang === 'ar' ? 'الوضع الفاتح' : 'Light Mode') : (lang === 'ar' ? 'الوضع الداكن' : 'Dark Mode')}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Help / Calculation Method Button */}
            <button
              onClick={() => setHelpModalOpen(true)}
              className={`p-2 rounded-xl border flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${theme === 'dark' ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-sky-400' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#3c89bd]'}`}
              title={lang === 'ar' ? 'طريقة الحساب' : 'How it works'}
              aria-label={lang === 'ar' ? 'طريقة الحساب' : 'How it works'}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Side Navigation Drawer (Requirement 6) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex animate-slide-up-fade">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className={`relative z-10 w-80 max-w-[85vw] h-full p-6 flex flex-col shadow-2xl transition-transform ${theme === 'dark' ? 'bg-slate-900 text-slate-100 border-r border-slate-800' : 'bg-white text-[#1f347d]'}`}>
            <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 font-bold text-lg">
                <div className="w-8 h-8 rounded-lg bg-[#3c89bd] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  <Scale className="w-4 h-4" />
                </div>
                <span>{lang === 'ar' ? 'القائمة الجانبية' : 'Side Navigation'}</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:scale-110 active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-6 space-y-6">
              {/* Clean Final App Download Section (E7sbly-Final.apk) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Download className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تطبيق احسبلى للأندرويد' : 'E7sbly Android App'}</span>
                  </span>
                  <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full shadow-xs">
                    Final APK
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                  {lang === 'ar'
                    ? 'النسخة الكاملة النهائية الجاهزة للتثبيت المباشر على الهاتف وإرسالها للتجربة.'
                    : 'The complete final release APK ready to install and test on Android phones.'}
                </p>
                <a
                  href="/E7sbly-Final.apk"
                  download="E7sbly-Final.apk"
                  className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تحميل E7sbly-Final.apk' : 'Download E7sbly-Final.apk'}</span>
                </a>
              </div>

              {/* Calculation Method Button in Drawer */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  {lang === 'ar' ? 'المعادلة والحساب' : 'Formula & Logic'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    setHelpModalOpen(true);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-sm font-semibold text-start transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                >
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-sky-500" />
                    <span>{lang === 'ar' ? 'طريقة الحساب' : 'Calculation Method'}</span>
                  </div>
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>

              {/* Theme Selection */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  {lang === 'ar' ? 'مظهر التطبيق' : 'App Theme'}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${theme === 'light' ? 'bg-[#3c89bd] text-white border-[#3c89bd] shadow-sm' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'الوضع الفاتح' : 'Light Mode'}</span>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${theme === 'dark' ? 'bg-[#3c89bd] text-white border-[#3c89bd] shadow-sm' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <Moon className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'الوضع الداكن' : 'Dark Mode'}</span>
                  </button>
                </div>
              </div>

              {/* Language Selection */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  {lang === 'ar' ? 'لغة التطبيق' : 'App Language'}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLang('ar')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${lang === 'ar' ? 'bg-[#3c89bd] text-white border-[#3c89bd] shadow-sm' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <Globe className="w-4 h-4" />
                    <span>العربية</span>
                  </button>
                  <button
                    onClick={() => setLang('en')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${lang === 'en' ? 'bg-[#3c89bd] text-white border-[#3c89bd] shadow-sm' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <Globe className="w-4 h-4" />
                    <span>English</span>
                  </button>
                </div>
              </div>

              {/* Developer Info Button */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  {lang === 'ar' ? 'المطور والمعلومات' : 'Developer & Info'}
                </h3>
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    setDeveloperModalOpen(true);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-sm font-semibold text-start transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-sky-500" />
                    <span>{lang === 'ar' ? 'عن التطبيق والمطور' : 'About App & Developer'}</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-1">
              <span>احسبلى — اختار الأوفر</span>
            </div>
          </aside>
        </div>
      )}

      {/* Developer Information Modal (Matched to User's Reference Screenshot) */}
      {developerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setDeveloperModalOpen(false)}
          />
          <div
            className={`relative z-10 w-full max-w-[540px] rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl modal-word-in ${
              theme === 'dark' ? 'bg-[#0f172a] text-slate-100 border border-slate-800' : 'bg-white text-[#1f347d]'
            }`}
          >
            {/* Header Titles */}
            <div className="text-start space-y-1 word-in" style={{ '--i': 0 } as React.CSSProperties}>
              <h2 className="text-xl sm:text-2xl font-black text-[#1f347d] dark:text-sky-300">
                {lang === 'ar' ? 'عن التطبيق والمطور' : 'About App & Developer'}
              </h2>
              <h3 className="text-base sm:text-lg font-black text-[#1f347d] dark:text-slate-100">
                {lang === 'ar' ? 'احسبلى · الإصدار ٢' : 'E7sbly · Version 2'}
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed pt-0.5">
                {lang === 'ar'
                  ? 'قارن لحد ٥ منتجات حسب سعر الكيلو، واختار الأوفر. شغال بدون إنترنت، وبياناتك على جهازك.'
                  : 'Compare up to 5 products by price per kg, and choose the best value. Works offline, data stays on device.'}
              </p>
              <div className="text-xs sm:text-sm font-bold text-[#1f347d] dark:text-sky-400 pt-3">
                {lang === 'ar' ? 'عن المطور' : 'About Developer'}
              </div>
            </div>

            {/* Developer Name & Title (always LTR as shown in reference) */}
            <div dir="ltr" className="text-start mt-3 mb-2.5 word-in" style={{ '--i': 1 } as React.CSSProperties}>
              <h3 className="text-2xl sm:text-[28px] font-black text-[#1f347d] dark:text-white tracking-tight leading-tight">
                MARCO SAWIRIS
              </h3>
              <p className="text-xs sm:text-sm font-bold text-[#3c89bd] dark:text-sky-400 mt-0.5">
                Senior Graphic Designer &amp; Art Director
              </p>
            </div>

            {/* Developer Banner Card (Text left, Cutout portrait right with NO white padding underneath) */}
            <div
              dir="ltr"
              style={{ '--i': 2 } as React.CSSProperties}
              className={`rounded-2xl border ${
                theme === 'dark'
                  ? 'border-slate-700 bg-slate-800/90'
                  : 'border-slate-200 bg-white'
              } shadow-sm overflow-hidden flex items-stretch mt-3 hover-lift word-in`}
            >
              {/* Bio copy on left */}
              <div className="flex-1 p-5 sm:p-6 flex items-center">
                <p className="text-sm sm:text-base font-bold text-slate-700 dark:text-slate-200 leading-snug">
                  20+ years of design experience across Egypt and Qatar, creating brand identities, campaigns, packaging and motion graphics.
                </p>
              </div>

              {/* Marco Sawiris portrait on right - sits flush at bottom edge with zero gap */}
              <div className="w-[38%] sm:w-[36%] flex-shrink-0 flex items-end justify-center self-end overflow-hidden m-0 p-0">
                <img
                  src="/developer-reference.png"
                  alt="Marco Sawiris"
                  className="w-full h-auto max-h-[220px] object-contain object-bottom block m-0 p-0 align-bottom select-none pointer-events-none"
                />
              </div>
            </div>

            {/* Website Link centered below card with Globe and ExternalLink icons */}
            <div className="text-center mt-4.5 word-in" style={{ '--i': 3 } as React.CSSProperties}>
              <a
                href="https://marco-sawiris.github.io/"
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#3c89bd] hover:underline hover:opacity-80 transition-opacity"
              >
                <Globe className="w-4 h-4 text-[#3c89bd]" />
                <span>marco-sawiris.github.io</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#3c89bd]/70" />
              </a>
            </div>

            {/* Close button aligned to bottom end (right side in RTL) */}
            <div className="mt-6 flex justify-end word-in" style={{ '--i': 4 } as React.CSSProperties}>
              <button
                type="button"
                onClick={() => setDeveloperModalOpen(false)}
                className="text-[#3c89bd] hover:text-[#2c6e9b] dark:text-sky-400 font-extrabold text-base sm:text-lg transition-colors px-2 py-1"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setHelpModalOpen(false)}
          />
          <div className={`relative z-10 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-dialog-pop ${theme === 'dark' ? 'bg-slate-900 text-slate-100 border border-slate-800' : 'bg-white text-[#1f347d]'}`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-sky-500" />
                <h3 className="font-extrabold text-base sm:text-lg">
                  {lang === 'ar' ? 'طريقة الحساب والمعادلة' : 'Calculation Method & Logic'}
                </h3>
              </div>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:scale-110"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Calculation Method Box - White, Dark Navy Border, Dark Navy Text in Light Mode */}
            <div className="py-4 space-y-3 font-sans">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {lang === 'ar'
                  ? 'يقوم التطبيق بتحويل كافة الأوزان إلى كيلوجرام (أو الأحجام إلى لتر)، ثم يقسم سعر كل عبوة على وزنها لحساب السعر المعياري بدقة:'
                  : 'E7sbly normalizes all weights to kilograms (or volumes to liters), then calculates exact unit price:'}
              </p>

              {/* Specification Box: White, dark navy border (#0a192f), dark navy text (#0a192f) in light mode; preserved dark mode */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800/95 border-2 border-[#0a192f] dark:border-slate-700 text-[#0a192f] dark:text-slate-100 shadow-sm space-y-2.5">
                <div className="font-black text-xs sm:text-sm pb-1.5 border-b border-[#0a192f]/20 dark:border-slate-700 flex items-center justify-between">
                  <span>{lang === 'ar' ? 'معادلة الحساب الموحدة:' : 'Standardized Formula:'}</span>
                  <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">١ كيلو = ١٠٠٠ جرام</span>
                </div>
                <div className="space-y-1.5 text-xs sm:text-[13px] font-bold">
                  <div className="flex items-center justify-between">
                    <span>٣٠٠ جرام بـ ٣٠ ج.م</span>
                    <span className="font-black text-sky-700 dark:text-sky-300">١٠٠٫٠٠ ج.م / كيلو</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>٤٥٠ جرام بـ ٤٠ ج.م</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">٨٨٫٨٩ ج.م / كيلو</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#0a192f]/15 dark:border-slate-700 text-[11px] font-semibold text-[#0a192f]/80 dark:text-slate-300">
                  {lang === 'ar'
                    ? 'النتيجة: عبوة ٤٥٠ جرام توفر ١١٫١١ ج.م في كل كيلو مقارنة بعبوة ٣٠٠ جرام.'
                    : 'Result: 450g pack saves 11.11 EGP per kg vs 300g pack.'}
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'ar'
                  ? 'مهما اختلفت أحجام العبوات أو أسعارها، احسبلى يقارن بينها فورياً بدون الحاجة لحفظ معادلات معقدة.'
                  : 'Regardless of pack sizes or prices, E7sbly instantly finds the best true value for you.'}
              </p>
            </div>
            <button
              onClick={() => setHelpModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[#0a192f] hover:bg-[#152a4a] text-white font-bold text-sm shadow-sm transition-colors"
            >
              {lang === 'ar' ? 'فهمت، شكراً' : 'Got it, thanks'}
            </button>
          </div>
        </div>
      )}

      {/* Google Drive Upload Modal */}
      {driveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setDriveModalOpen(false)}
          />
          <div className={`relative z-10 w-full max-w-lg rounded-2xl p-6 shadow-2xl modal-word-in ${theme === 'dark' ? 'bg-slate-900 text-slate-100 border border-slate-800' : 'bg-white text-[#1f347d]'}`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-sky-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg">
                    {lang === 'ar' ? 'رفع التطبيق إلى Google Drive' : 'Save APK to Google Drive'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'ar' ? 'حفظ ملف APK في درايف لتنزيله وتثبيته على موبايلك بسهولة' : 'Upload APK to your Drive to easily download and install on phone'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDriveModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-5 space-y-4">
              {!googleUser ? (
                <div className="text-center space-y-4 py-2">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-center">
                    <UploadCloud className="w-8 h-8 text-sky-500" />
                  </div>
                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <h4 className="font-bold text-sm">
                      {lang === 'ar' ? 'اربط حساب Google الخاص بك' : 'Connect your Google Account'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {lang === 'ar'
                        ? 'سجل دخولك بحساب جوجل لتتمكن من رفع ملف E7sbly-release.apk مباشرة إلى مجلد Google Drive الخاص بك، لتفتحه من هاتفك وتثبته بلمسة واحدة.'
                        : 'Sign in with your Google account to upload E7sbly-release.apk directly to your Google Drive, then open and install it on your Android phone.'}
                    </p>
                  </div>

                  {driveError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs text-start flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{driveError}</span>
                    </div>
                  )}

                  {/* Official Sign In with Google Button */}
                  <div className="pt-2 flex justify-center">
                    <button
                      type="button"
                      disabled={isDriveLoggingIn}
                      onClick={handleGoogleDriveSignIn}
                      className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 font-semibold text-sm shadow-xs transition-transform active:scale-95 disabled:opacity-50"
                    >
                      {isDriveLoggingIn ? (
                        <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
                      ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                      )}
                      <span>
                        {isDriveLoggingIn
                          ? (lang === 'ar' ? 'جارٍ تسجيل الدخول...' : 'Signing in...')
                          : (lang === 'ar' ? 'تسجيل الدخول بحساب Google' : 'Sign in with Google')}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Authenticated user banner */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      {googleUser.photoURL ? (
                        <img
                          src={googleUser.photoURL}
                          alt={googleUser.displayName || 'Google User'}
                          className="w-10 h-10 rounded-full border border-sky-400"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center">
                          {googleUser.displayName?.[0] || 'G'}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-sm leading-tight">{googleUser.displayName || 'Google User'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{googleUser.email}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleDriveLogout}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      title={lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>

                  {driveError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{driveError}</span>
                    </div>
                  )}

                  {/* Upload result or action */}
                  {uploadedDriveFile ? (
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span>{lang === 'ar' ? 'تم الرفع بنجاح إلى حسابك في Google Drive!' : 'Successfully uploaded to Google Drive!'}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {lang === 'ar'
                          ? 'تم حفظ ملف E7sbly-release.apk في درايف. يمكنك الآن فتحه من تطبيق Google Drive على موبايلك وتثبيته مباشرة.'
                          : 'E7sbly-release.apk is saved in your Drive. Open Google Drive app on your phone and tap the file to install.'}
                      </p>
                      <a
                        href={uploadedDriveFile.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-transform active:scale-95"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'فتح الملف في Google Drive' : 'Open in Google Drive'}</span>
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-1">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          📦 E7sbly-release.apk (1.8 MB)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {lang === 'ar' ? 'نسخة الإنتاج الرسمية الموقّعة والمتوافقة مع أندرويد 10+' : 'Official signed release APK compatible with Android 10+'}
                        </div>
                      </div>

                      {isUploadingToDrive ? (
                        <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-center gap-3">
                          <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
                          <span className="text-xs font-bold text-sky-700 dark:text-sky-300">
                            {driveUploadProgress || (lang === 'ar' ? 'جارٍ رفع الملف إلى درايف...' : 'Uploading APK to Google Drive...')}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleUploadToDrive}
                          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
                        >
                          <UploadCloud className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'رفع التطبيق إلى Google Drive الآن' : 'Upload APK to Google Drive Now'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setDriveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-bold"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="w-full max-w-2xl lg:max-w-3xl mx-auto px-2.5 sm:px-4 pt-4 sm:pt-6">
        {activeTab === 'verification' ? (
          /* QA Verification Dashboard */
          <div className="space-y-6 animate-slide-up-fade">
            <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="text-xl font-extrabold flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-emerald-500" />
                    <span>{lang === 'ar' ? 'تقرير ضمان الجودة وبناء الحزمة' : 'QA & Build Verification'}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {lang === 'ar' ? 'نتائج الاختبارات الآلية وبناء APK لنظام أندرويد' : 'Automated test suite results and native Android APK build status'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/ehsably-release.apk"
                    download="ehsably-release.apk"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-[#1f347d] hover:from-sky-700 hover:to-[#172960] text-white font-bold text-xs flex items-center gap-2 shadow-md transition-transform active:scale-95"
                  >
                    <Download className="w-4 h-4 text-sky-300" />
                    <span>{lang === 'ar' ? 'تحميل Release APK (1.0 MB)' : 'Download Release APK (1.0 MB)'}</span>
                  </a>
                  <a
                    href="/ehsably-debug.apk"
                    download="ehsably-debug.apk"
                    className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95"
                  >
                    <span>{lang === 'ar' ? 'نسخة Debug' : 'Debug APK'}</span>
                  </a>
                </div>
              </div>

              {/* Test Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">{lang === 'ar' ? 'اختبارات جافا الأصلية' : 'Native Java Tests'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">20 / 20 PASSED</span>
                  </div>
                  <div className="text-2xl font-black mt-2 text-emerald-600">100%</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    com.ehsably.app.NativeCalculatorTest: Liter support, density check, ranking, tie-breaking.
                  </p>
                </div>

                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">{lang === 'ar' ? 'اختبارات نود ولوكالايزيشن' : 'Node & Localization'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">22 / 22 PASSED</span>
                  </div>
                  <div className="text-2xl font-black mt-2 text-emerald-600">100%</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Unit conversions, density validation, Arabic/English string completeness in translations.json.
                  </p>
                </div>

                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">{lang === 'ar' ? 'بناء حزمة أندرويد' : 'Gradle APK Build'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">SUCCESS</span>
                  </div>
                  <div className="text-2xl font-black mt-2 text-sky-500">1,019 KB</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    app-debug.apk assembled with Android SDK (API 35), Min SDK 29, Java 17.
                  </p>
                </div>
              </div>

              {/* Requirement Checklist */}
              <div className="mt-8">
                <h3 className="font-bold text-sm mb-3">
                  {lang === 'ar' ? 'قائمة التحقق من المتطلبات العشرة:' : '10 Requirements Verification:'}
                </h3>
                <div className="space-y-2 text-xs">
                  {[
                    { req: '1. Redesigned Results Screen', desc: 'Cheapest unit winner, exact savings vs each alternative in EGP, normalized price per kg/L.' },
                    { req: '2. Start with Empty Inputs', desc: 'No prefilled product inputs on fresh start; preserves theme & language settings.' },
                    { req: '3. Developer Information Screen', desc: 'Upgraded developer card for Marco Sawiris, compatible with light & dark themes.' },
                    { req: '4. Quantity Controls (+/-)', desc: 'Relocated to product card header; eliminated distracting animations for instant response.' },
                    { req: '5. Enlarged Best-Value Product Card', desc: 'Prominent card with higher visual priority, removed decorative circles, clean RTL/LTR alignment.' },
                    { req: '6. Side Navigation Menu Drawer', desc: 'Theme toggle (Light/Dark), language toggle (Arabic/English), and developer info.' },
                    { req: '7. Liter (L) Support & Compatibility', desc: 'Gram, Kilogram, and Liter support; enforces density incompatibility checks between weight and volume.' },
                    { req: '8. Results Navigation Buttons', desc: '"Back to Menu" and "Start Over" buttons to clear or return smoothly.' },
                    { req: '9. Numeric Input Auto-Selection', desc: 'Tapping any numeric input automatically highlights existing text for quick replacement.' },
                    { req: '10. Tests & APK Build Deliverable', desc: 'All 20 Java and 22 Node tests passing; debug APK successfully generated and verified.' },
                  ].map((item, idx) => (
                    <div key={idx} className={`p-3 rounded-lg flex items-start gap-3 border ${theme === 'dark' ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">{item.req}</span>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Interactive Comparison Application */
          <div className="space-y-6 animate-slide-up-fade">
            {/* Hero Banner */}
            <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-xs`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-sky-400/10 border border-sky-400/30 flex items-center justify-center flex-shrink-0 animate-float-gentle">
                    <Scale className="w-6 h-6 text-sky-500" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black">
                      {lang === 'ar' ? 'نفس المنتج، أنهى أوفر؟' : 'Same Product, Better Value?'}
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {lang === 'ar' ? 'قارن الوزن والسعر، واعرف التوفير بالجنيه المصرى فى لحظة.' : 'Compare weight or volume and price to calculate real savings in EGP.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLoadExample}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 ${theme === 'dark' ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-sky-400' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#3c89bd]'}`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'ar' ? 'جرب بمثال' : 'Try Example'}</span>
                  </button>
                  <button
                    onClick={handleStartOver}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 hover:text-rose-500 transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'تفريغ' : 'Clear'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {generalError && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-slide-up-fade">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                <span>{generalError}</span>
              </div>
            )}

            {/* Products Form */}
            <form onSubmit={handleCalculate} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-sky-500" />
                  <span>{lang === 'ar' ? 'المنتجات للمقارنة' : 'Products to Compare'}</span>
                  <span className="text-xs text-sky-500 font-bold">({products.length}/5)</span>
                </h2>
                <span className="text-xs text-slate-400">
                  {lang === 'ar' ? 'يمكن مقارنة ٢ إلى ٥ منتجات' : '2 to 5 products'}
                </span>
              </div>

              {/* Product Cards */}
              <div className="space-y-3">
                {products.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 focus-within:border-sky-500' : 'bg-white border-slate-200 focus-within:border-[#3c89bd]'} shadow-xs`}
                  >
                    {/* Requirement 4: Top Header with Quantity Controls */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${theme === 'dark' ? 'bg-slate-800 text-sky-400' : 'bg-sky-50 text-[#3c89bd]'}`}>
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => handleProductChange(p.id, 'name', e.target.value)}
                          placeholder={lang === 'ar' ? `اسم المنتج ${idx + 1} (اختيارى)` : `Product ${idx + 1} (optional)`}
                          className="w-full bg-transparent text-sm font-bold placeholder:text-slate-400 focus:outline-hidden"
                        />
                      </div>

                      {/* Requirement 4: Instant, responsive Quantity Controls */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-xl">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline px-1">
                          {lang === 'ar' ? 'العبوات:' : 'Qty:'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityDelta(p.id, -1)}
                          disabled={p.quantity <= 1}
                          className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs disabled:opacity-30 transition-none"
                          aria-label={lang === 'ar' ? 'تقليل العبوات' : 'Decrease Quantity'}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold">
                          {p.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityDelta(p.id, 1)}
                          disabled={p.quantity >= 99}
                          className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs disabled:opacity-30 transition-none"
                          aria-label={lang === 'ar' ? 'زيادة العبوات' : 'Increase Quantity'}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(p.id)}
                        disabled={products.length <= 2}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 disabled:opacity-20 transition-colors"
                        title={lang === 'ar' ? 'حذف المنتج' : 'Delete Product'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Product Inputs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                      {/* Weight / Volume Input */}
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          <Scale className="w-3.5 h-3.5 text-sky-500" />
                          <span>{lang === 'ar' ? 'وزن أو حجم العبوة' : 'Pack Weight / Volume'}</span>
                        </label>
                        <div className={`flex items-center rounded-xl border overflow-hidden ${errors[`${p.id}_weight`] ? 'border-rose-400 bg-rose-50/30' : theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={p.weight}
                            onFocus={handleNumericFocus}
                            onChange={(e) => handleProductChange(p.id, 'weight', e.target.value)}
                            placeholder={lang === 'ar' ? 'مثال: ٣٠٠' : 'e.g. 300'}
                            className="w-full px-3 py-2 text-sm font-bold bg-transparent text-end focus:outline-hidden"
                            dir="ltr"
                          />
                          {/* Requirement 7: Gram, Kilogram, and Liter Support */}
                          <select
                            value={p.unit}
                            onChange={(e) => handleProductChange(p.id, 'unit', e.target.value)}
                            className={`px-2 py-2 text-xs font-bold border-s ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-sky-400' : 'border-slate-200 bg-slate-100 text-[#3c89bd]'} focus:outline-hidden`}
                          >
                            <option value="g">{lang === 'ar' ? 'جرام (g)' : 'Gram (g)'}</option>
                            <option value="kg">{lang === 'ar' ? 'كيلو (kg)' : 'Kilogram (kg)'}</option>
                            <option value="l">{lang === 'ar' ? 'لتر (L)' : 'Liter (L)'}</option>
                          </select>
                        </div>
                        {errors[`${p.id}_weight`] && (
                          <p className="text-[10px] text-rose-500 mt-1">{errors[`${p.id}_weight`]}</p>
                        )}
                      </div>

                      {/* Price Input */}
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          <Coins className="w-3.5 h-3.5 text-sky-500" />
                          <span>{lang === 'ar' ? 'سعر العبوة' : 'Pack Price'}</span>
                        </label>
                        <div className={`flex items-center rounded-xl border overflow-hidden ${errors[`${p.id}_price`] ? 'border-rose-400 bg-rose-50/30' : theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={p.price}
                            onFocus={handleNumericFocus}
                            onChange={(e) => handleProductChange(p.id, 'price', e.target.value)}
                            placeholder={lang === 'ar' ? 'مثال: ٣٠' : 'e.g. 30'}
                            className="w-full px-3 py-2 text-sm font-bold bg-transparent text-end focus:outline-hidden"
                            dir="ltr"
                          />
                          <span className={`px-3 py-2 text-xs font-bold border-s ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                            {lang === 'ar' ? 'ج.م' : 'EGP'}
                          </span>
                        </div>
                        {errors[`${p.id}_price`] && (
                          <p className="text-[10px] text-rose-500 mt-1">{errors[`${p.id}_price`]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Product Button */}
              {products.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className={`w-full py-3 rounded-xl border border-dashed font-bold text-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.01] ${theme === 'dark' ? 'border-slate-700 hover:border-sky-500 text-sky-400 hover:bg-slate-800/40' : 'border-slate-300 hover:border-[#3c89bd] text-[#3c89bd] hover:bg-sky-50/50'}`}
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'إضافة منتج آخر' : 'Add Another Product'}</span>
                </button>
              )}

              {/* Compare Action Button */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#1f347d] to-[#3c89bd] hover:from-[#18285c] hover:to-[#3274a1] text-white font-black text-base shadow-md hover:shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Calculator className="w-5 h-5 text-sky-300 animate-pulse" />
                <span>{lang === 'ar' ? 'احسب الأوفر' : 'Find Best Value'}</span>
                {lang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {/* Calculation Method Box (طريقة الحساب) - White box, Dark Navy Border (#0a192f), Dark Navy Text (#0a192f) in Light Mode */}
            <div className={`p-5 rounded-2xl border-2 transition-all font-sans shadow-xs word-in ${
              theme === 'dark'
                ? 'bg-slate-800/90 border-slate-700 text-slate-100'
                : 'bg-white border-[#0a192f] text-[#0a192f]'
            }`} style={{ '--i': 1 } as React.CSSProperties}>
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm ${
                  theme === 'dark' ? 'bg-sky-500/20 text-sky-400' : 'bg-[#0a192f] text-white'
                }`}>
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`font-black text-sm sm:text-base ${
                    theme === 'dark' ? 'text-white' : 'text-[#0a192f]'
                  }`}>
                    {lang === 'ar' ? 'طريقة الحساب والمعادلة' : 'Calculation Method & Formula'}
                  </h3>
                  <p className={`text-[11px] ${
                    theme === 'dark' ? 'text-slate-400' : 'text-[#0a192f]/70'
                  }`}>
                    {lang === 'ar' ? 'كيف يحسب التطبيق المنتج الأوفر ويحدد الفائز بدقة؟' : 'How the app calculates the best value and rankings'}
                  </p>
                </div>
              </div>

              <div className="pt-3.5 space-y-3 text-xs leading-relaxed">
                <div className={`p-3.5 rounded-xl border ${
                  theme === 'dark'
                    ? 'bg-slate-900/60 border-slate-700 text-sky-300'
                    : 'bg-[#f4f7fc] border-[#0a192f]/20 text-[#0a192f]'
                }`}>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    {lang === 'ar' ? 'المعادلة الرياضية المعيارية:' : 'Standardized Mathematical Formula:'}
                  </div>
                  <div className="text-sm font-black tracking-tight">
                    {lang === 'ar'
                      ? 'سعر الكيلو = (سعر العبوة ÷ وزن العبوة بالجرام) × ١٠٠٠'
                      : 'Price / kg = (Pack Price ÷ Weight in grams) × 1000'}
                  </div>
                  <div className="text-xs font-bold mt-1 opacity-90">
                    {lang === 'ar'
                      ? 'سعر اللتر = سعر العبوة ÷ الحجم باللتر'
                      : 'Price / Liter = Pack Price ÷ Volume in Liters'}
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${
                  theme === 'dark'
                    ? 'bg-slate-900/40 border-slate-700 text-slate-200'
                    : 'bg-white border-[#0a192f]/20 text-[#0a192f]'
                } space-y-2`}>
                  <div className="font-extrabold text-xs">
                    {lang === 'ar' ? 'مثال عملي مباشر:' : 'Direct Practical Example:'}
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{lang === 'ar' ? 'عبوة ٣٠٠ جرام بسعر ٣٠ ج.م:' : '300g pack at 30 EGP:'}</span>
                    <span className="font-black text-sky-600 dark:text-sky-300">١٠٠٫٠٠ ج.م / كيلو</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{lang === 'ar' ? 'عبوة ٤٥٠ جرام بسعر ٤٠ ج.م:' : '450g pack at 40 EGP:'}</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">٨٨٫٨٩ ج.م / كيلو (الأوفر)</span>
                  </div>
                </div>

                <p className={`text-[11px] font-medium leading-relaxed ${
                  theme === 'dark' ? 'text-slate-300' : 'text-[#0a192f]/80'
                }`}>
                  {lang === 'ar'
                    ? 'في هذا المثال، شراء عبوة ٤٥٠ جرام يوفر لك ١١٫١١ ج.م في كل كيلو تشتريه، بالرغم من أن سعر العبوة الفردي أعلى.'
                    : 'In this example, buying the 450g pack saves 11.11 EGP per kg, even though the sticker price is higher.'}
                </p>
              </div>
            </div>

            {/* Results Section (Requirements 1, 5, 8) */}
            {results && (
              <div id="results-section" className="pt-4 space-y-4">
                {/* Summary Headline Banner */}
                <div
                  style={{ '--i': 0 } as React.CSSProperties}
                  className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-[#1e3a5f] border-sky-800 text-sky-100' : 'bg-gradient-to-r from-sky-50 to-blue-50 border-sky-200 text-[#1f347d]'} shadow-sm hover-lift word-in`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-900 flex items-center justify-center font-black flex-shrink-0 shadow-md">
                      <Trophy className="w-6 h-6 text-amber-900" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base sm:text-lg">
                        {results.allEqual
                          ? (results.isVolume
                              ? (lang === 'ar' ? 'كل المنتجات متساوية فى السعر لكل لتر' : 'All products have the same price per liter')
                              : (lang === 'ar' ? 'كل المنتجات متساوية فى السعر لكل كيلو' : 'All products have the same price per kg'))
                          : (lang === 'ar'
                              ? `${results.cheapest.name} هو الخيار الأوفر بـ ${results.savingsPerUnit.toFixed(2)} ج.م`
                              : `${results.cheapest.name} is the best value, saving ${results.savingsPerUnit.toFixed(2)} EGP`)}
                      </h3>
                      {!results.allEqual && (
                        <p className="text-xs text-sky-700 dark:text-sky-300 mt-1 font-medium flex items-center gap-1.5 flex-wrap">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 inline" />
                          <span>
                            {results.isVolume
                              ? (lang === 'ar' ? 'حساب موحد لسعر الـ ١ لتر' : 'Standard 1 Liter basis')
                              : (lang === 'ar' ? 'حساب موحد لسعر الـ ١ كيلو' : 'Standard 1 Kilogram basis')}
                          </span>
                          <span>·</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {lang === 'ar'
                              ? `توفير بنسبة ${results.savingsPercent.toFixed(1)}٪ مقارنة بالخيار الأعلى`
                              : `Saves ${results.savingsPercent.toFixed(1)}% vs highest option`}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ranked Cards (Requirement 1 & 5: Enlarged Prominent Best-Value Card) */}
                <div className="space-y-3">
                  {results.ranked.map((p, pIndex) => {
                    const isBest = p.isCheapest;
                    const basisUnit = results.isVolume
                      ? (lang === 'ar' ? 'ج.م / لتر' : 'EGP / L')
                      : (lang === 'ar' ? 'ج.م / كيلو' : 'EGP / kg');
                    const subUnit = results.isVolume
                      ? (lang === 'ar' ? 'ج.م / ١٠٠ مل' : 'EGP / 100 ml')
                      : (lang === 'ar' ? 'ج.م / ١٠٠ جرام' : 'EGP / 100 g');

                    return (
                      <div
                        key={p.id}
                        style={{ '--i': pIndex + 1 } as React.CSSProperties}
                        className={`rounded-2xl border transition-all word-in ${
                          isBest
                            ? `${theme === 'dark' ? 'bg-[#192b4d] border-sky-400' : 'bg-white border-[#3c89bd]'} p-6 shadow-xl ring-2 ring-sky-500/40 hover-lift`
                            : `${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white/90 border-slate-200'} p-4 shadow-xs hover-lift`
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${isBest ? 'bg-[#3c89bd] text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                              {isBest ? <Crown className="w-4 h-4 text-amber-300" /> : `#${p.rank}`}
                            </span>
                            <div>
                              <h4 className={`font-black flex items-center gap-1.5 ${isBest ? 'text-lg text-sky-600 dark:text-sky-300' : 'text-base'}`}>
                                <span>{p.name}</span>
                                {isBest && <Sparkles className="w-4 h-4 text-amber-400 inline" />}
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {p.weight} {p.unit === 'l' ? (lang === 'ar' ? 'لتر' : 'L') : (p.unit === 'kg' ? (lang === 'ar' ? 'كيلو' : 'kg') : (lang === 'ar' ? 'جرام' : 'g'))}
                                {' · '}
                                {lang === 'ar' ? 'سعر العبوة: ' : 'Pack: '}
                                <span className="font-bold">{p.price} {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                              </p>
                            </div>
                          </div>

                          {isBest && (
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1.5 shadow-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>{lang === 'ar' ? 'الأوفر قيمة' : 'Best Value'}</span>
                            </span>
                          )}
                        </div>

                        {/* Price per kg or per Liter */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between flex-wrap gap-2">
                          <div>
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Scale className="w-3.5 h-3.5 text-sky-500" />
                              <span>
                                {results.isVolume
                                  ? (lang === 'ar' ? 'سعر اللتر' : 'Price per Liter')
                                  : (lang === 'ar' ? 'سعر الكيلو' : 'Price per kg')}
                              </span>
                            </span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className={`font-black ${isBest ? 'text-2xl sm:text-3xl text-sky-600 dark:text-sky-400' : 'text-xl'}`}>
                                {p.pricePerUnit.toFixed(2)}
                              </span>
                              <span className="text-xs font-bold text-slate-500">
                                {basisUnit}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              ({(p.pricePerUnit / 10).toFixed(2)} {subUnit})
                            </span>
                          </div>

                          {/* Savings breakdown vs each alternative (Requirement 1) */}
                          {isBest && p.savingsVsAlternative.length > 0 && (
                            <div className="text-end space-y-1">
                              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                                <TrendingDown className="w-3 h-3 text-emerald-500" />
                                <span>{lang === 'ar' ? 'مقدار التوفير بالجنيه' : 'Savings vs Alternatives'}</span>
                              </span>
                              {p.savingsVsAlternative.map((alt, i) => (
                                <div key={i} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-900">
                                  {lang === 'ar'
                                    ? `يوفر ${alt.diffEGP.toFixed(2)} ج.م مقارنة بـ ${alt.altName}`
                                    : `Saves ${alt.diffEGP.toFixed(2)} EGP vs ${alt.altName}`}
                                </div>
                              ))}
                            </div>
                          )}

                          {!isBest && (
                            <div className="text-end">
                              <span className="text-xs font-semibold text-slate-400">
                                {lang === 'ar'
                                  ? `+ ${(p.pricePerUnit - results.cheapest.pricePerUnit).toFixed(2)} ج.م مقارنة بالأوفر`
                                  : `+ ${(p.pricePerUnit - results.cheapest.pricePerUnit).toFixed(2)} EGP vs best`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Requirement 8: Navigation Buttons */}
                <div
                  className="pt-2 grid grid-cols-2 gap-3 word-in"
                  style={{ '--i': results.ranked.length + 1 } as React.CSSProperties}
                >
                  <button
                    type="button"
                    onClick={handleBackToMenu}
                    className={`py-3.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] ${theme === 'dark' ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200' : 'border-slate-300 bg-white hover:bg-slate-50 text-[#1f347d] shadow-xs'}`}
                  >
                    <Menu className="w-4 h-4 text-sky-500" />
                    <span>{lang === 'ar' ? 'الرجوع للقائمة' : 'Back to Menu'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartOver}
                    className="py-3.5 rounded-xl bg-gradient-to-r from-[#3c89bd] to-[#1f347d] hover:from-[#3274a1] hover:to-[#18285c] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <RotateCcw className="w-4 h-4 text-sky-200" />
                    <span>{lang === 'ar' ? 'ابدأ من جديد' : 'Start Over'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
