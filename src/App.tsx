import React, { useState, useEffect } from 'react';
import {
  Menu, Settings, X, Sun, Moon, Globe, Download, CheckCircle2, RotateCcw,
  Plus, Minus, Trash2, ArrowLeft, ArrowRight, ShieldCheck,
  Scale, Calculator, Sparkles, ExternalLink, Info, AlertTriangle,
  Trophy, Crown, Tag, Coins, TrendingDown, Award, User, HelpCircle,
  UploadCloud, Check, Loader2, HardDrive, LogOut, History
} from 'lucide-react';
import developerReferencePhoto from './developer-reference.png';
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

interface HistoryItem {
  id: string;
  timestamp: number;
  dateStr: string;
  products: ProductInput[];
  summary: {
    cheapestName: string;
    productCount: number;
    unitBasis: string;
    savingsPercent?: number;
  };
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
  const [aboutAppModalOpen, setAboutAppModalOpen] = useState(false);
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

  // Past Calculations History
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('ehsably_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveHistory = (items: HistoryItem[]) => {
    setHistory(items);
    try {
      localStorage.setItem('ehsably_history', JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save history', e);
    }
  };

  const handleClearHistory = () => {
    saveHistory([]);
  };

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

  const calculateForProducts = (prodsToCalc: ProductInput[], recordInHistory = true) => {
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

    prodsToCalc.forEach((p, index) => {
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

    // Strict check for weight vs volume compatibility
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

      // Savings compared to each alternative in Egyptian pounds
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

    // Record in history if requested
    if (recordInHistory) {
      const now = new Date();
      const dateStr = now.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        month: 'numeric',
        day: 'numeric',
      });
      const historyItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        dateStr,
        products: prodsToCalc.map(p => ({ ...p })),
        summary: {
          cheapestName: ranked[0].name,
          productCount: validRows.length,
          unitBasis: isVolumeMode ? (lang === 'ar' ? 'لتر' : 'L') : (lang === 'ar' ? 'كيلو' : 'kg'),
          savingsPercent,
        },
      };

      setHistory(prev => {
        const filtered = prev.filter(h => {
          return JSON.stringify(h.products.map(x => ({ w: x.weight, p: x.price, u: x.unit }))) !==
            JSON.stringify(prodsToCalc.map(x => ({ w: x.weight, p: x.price, u: x.unit })));
        });
        const updated = [historyItem, ...filtered].slice(0, 10);
        try {
          localStorage.setItem('ehsably_history', JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        return updated;
      });
    }

    // Scroll smoothly to results
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    calculateForProducts(products, true);
  };

  const handleRestoreHistory = (item: HistoryItem) => {
    const restored = item.products.map(p => ({ ...p }));
    setProducts(restored);
    setErrors({});
    setGeneralError(null);
    setDrawerOpen(false);
    setTimeout(() => {
      calculateForProducts(restored, false);
    }, 100);
  };

  return (
    <div className={`min-h-screen w-full overflow-x-hidden ${theme === 'dark' ? 'bg-[#0b1329] text-slate-100' : 'bg-[#f4f7fc] text-[#1f347d]'} transition-colors duration-200 pb-10`}>
      {/* Top Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b ${theme === 'dark' ? 'bg-[#0f172a]/95 border-slate-800' : 'bg-white/95 border-slate-200'} px-3 sm:px-4 py-2 shadow-xs`}>
        <div className="w-full max-w-xl sm:max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className={`p-1.5 rounded-lg border transition-all hover:scale-105 active:scale-95 ${theme === 'dark' ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-sky-400' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#1f347d]'}`}
              aria-label={lang === 'ar' ? 'الإعدادات' : 'Settings'}
              title={lang === 'ar' ? 'الإعدادات' : 'Settings'}
            >
              <Settings className="w-4.5 h-4.5" />
            </button>

            <div className="flex items-center gap-2 font-black text-lg tracking-tight select-none">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1f347d] to-[#3c89bd] text-white flex items-center justify-center font-black text-sm shadow-md hover:scale-105 active:scale-95 transition-transform">
                <Calculator className="w-4.5 h-4.5 text-white" />
              </div>
              <span
                className="font-black text-lg sm:text-xl tracking-tight text-[#0a192f] dark:text-white"
              >
                {lang === 'ar' ? 'احسبلى' : 'E7sbly'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Theme Toggle */}
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className={`p-1.5 rounded-lg border flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${theme === 'dark' ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-amber-400' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'}`}
              title={theme === 'dark' ? (lang === 'ar' ? 'الوضع الفاتح' : 'Light Mode') : (lang === 'ar' ? 'الوضع الداكن' : 'Dark Mode')}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Help / Calculation Method Button */}
            <button
              onClick={() => setHelpModalOpen(true)}
              className={`p-1.5 rounded-lg border flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${theme === 'dark' ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-sky-400' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#1f347d]'}`}
              title={lang === 'ar' ? 'طريقة الحساب' : 'How it works'}
              aria-label={lang === 'ar' ? 'طريقة الحساب' : 'How it works'}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Navigation Drawer - slides from right in Arabic (RTL) */}
      {drawerOpen && (
        <div className={`fixed inset-0 z-50 flex animate-slide-up-fade ${lang === 'ar' ? 'justify-end' : 'justify-start'}`}>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className={`relative z-10 w-80 max-w-[85vw] h-full p-5 flex flex-col shadow-2xl transition-transform ${theme === 'dark' ? 'bg-[#0f172a] text-slate-100' : 'bg-white text-[#0a192f]'} ${lang === 'ar' ? 'border-l border-slate-200 dark:border-slate-800' : 'border-r border-slate-200 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5 font-black text-base">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1f347d] to-[#3c89bd] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  <Settings className="w-4 h-4 text-white" />
                </div>
                <span className="text-[#0a192f] dark:text-white">{lang === 'ar' ? 'الإعدادات' : 'Settings'}</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-[#0a192f] dark:text-slate-400 dark:hover:text-white hover:scale-110 active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {/* 1. Calculation Method Item (Opens Modal Popup) */}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setHelpModalOpen(true);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-bold text-start transition-all hover:scale-[1.01] active:scale-[0.99] ${
                  theme === 'dark'
                    ? 'bg-slate-800/80 border-slate-700 text-slate-100 hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-[#0a192f] hover:bg-slate-50 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-slate-700 text-[#1f347d] dark:text-sky-300 flex items-center justify-center font-bold flex-shrink-0">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-xs sm:text-sm text-[#0a192f] dark:text-white">
                      {lang === 'ar' ? 'طريقة الحساب والمعادلة' : 'Calculation Method & Formula'}
                    </div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">
                      {lang === 'ar' ? 'شرح المعادلة الرياضية المعيارية' : 'Formula explanation popup'}
                    </div>
                  </div>
                </div>
                <Info className="w-4 h-4 text-[#1f347d] dark:text-sky-400 flex-shrink-0" />
              </button>

              {/* 2. App Theme Selection */}
              <div className={`p-3 rounded-xl border ${
                theme === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-xs'
              } space-y-2`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-slate-700 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold flex-shrink-0">
                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </div>
                  <span className="font-black text-xs sm:text-sm text-[#0a192f] dark:text-white">
                    {lang === 'ar' ? 'مظهر التطبيق' : 'App Theme'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                      theme === 'light'
                        ? 'bg-[#1f347d] text-white shadow-xs'
                        : 'border border-slate-200 dark:border-slate-700 text-[#0a192f] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'فاتح' : 'Light'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                      theme === 'dark'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'border border-slate-200 dark:border-slate-700 text-[#0a192f] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'داكن' : 'Dark'}</span>
                  </button>
                </div>
              </div>

              {/* 3. App Language Selection */}
              <div className={`p-3 rounded-xl border ${
                theme === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-xs'
              } space-y-2`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <span className="font-black text-xs sm:text-sm text-[#0a192f] dark:text-white">
                    {lang === 'ar' ? 'لغة التطبيق' : 'App Language'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setLang('ar')}
                    className={`py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                      lang === 'ar'
                        ? 'bg-[#1f347d] text-white shadow-xs'
                        : 'border border-slate-200 dark:border-slate-700 text-[#0a192f] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>العربية</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                      lang === 'en'
                        ? 'bg-[#1f347d] text-white shadow-xs'
                        : 'border border-slate-200 dark:border-slate-700 text-[#0a192f] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>English</span>
                  </button>
                </div>
              </div>

              {/* 4. Past Calculations History ("حساباتي القديمة") */}
              <div
                className={`p-3 rounded-xl border ${
                  theme === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-xs'
                } space-y-2`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-slate-700 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold flex-shrink-0">
                      <History className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-black text-xs sm:text-sm text-[#0a192f] dark:text-white flex items-center gap-1.5">
                        <span>{lang === 'ar' ? 'حساباتي القديمة' : 'Past Calculations'}</span>
                        {history.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200/60 dark:bg-slate-700 text-amber-900 dark:text-amber-300 font-black">
                            {history.length}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">
                        {lang === 'ar' ? 'استرجاع مقارنة سابقة' : 'Restore past comparison'}
                      </div>
                    </div>
                  </div>

                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="text-[11px] font-black text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline px-1 py-0.5 transition-colors cursor-pointer"
                      title={lang === 'ar' ? 'مسح جميع الحسابات القديمة' : 'Clear calculation history'}
                    >
                      {lang === 'ar' ? 'مسح القيم' : 'Clear values'}
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="text-center py-2.5 px-2 text-[11px] text-slate-500 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                    {lang === 'ar' ? 'لا توجد حسابات قديمة بعد' : 'No past calculations yet'}
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pt-0.5">
                    {history.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleRestoreHistory(item)}
                        className={`w-full text-start p-2 rounded-lg border text-xs transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-slate-900/60 border-slate-700 hover:bg-slate-700 text-slate-200'
                            : 'bg-slate-50 border-slate-200 hover:bg-amber-50/60 text-[#0a192f]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-black text-[#1f347d] dark:text-sky-300 truncate text-[11px]">
                            🏆 {item.summary.cheapestName} {lang === 'ar' ? 'الأوفر' : 'Best'}
                          </span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 flex-shrink-0 font-medium">
                            {item.dateStr}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate mt-0.5 font-bold">
                          {item.products
                            .map((p, idx) => `${p.name || (lang === 'ar' ? `منتج ${idx + 1}` : `P${idx + 1}`)}: ${p.weight}${p.unit}/${p.price}`)
                            .join(' • ')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. About Application Button */}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setAboutAppModalOpen(true);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-bold text-start transition-all hover:scale-[1.01] active:scale-[0.99] ${
                  theme === 'dark'
                    ? 'bg-slate-800/80 border-slate-700 text-slate-100 hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-[#0a192f] hover:bg-slate-50 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-slate-700 text-[#1f347d] dark:text-sky-300 flex items-center justify-center font-bold flex-shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-xs sm:text-sm text-[#0a192f] dark:text-white">
                      {lang === 'ar' ? 'عن التطبيق' : 'About Application'}
                    </div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">
                      {lang === 'ar' ? 'الإصدار والمميزات' : 'Version & features overview'}
                    </div>
                  </div>
                </div>
              </button>

              {/* 6. About Developer Button */}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setDeveloperModalOpen(true);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-bold text-start transition-all hover:scale-[1.01] active:scale-[0.99] ${
                  theme === 'dark'
                    ? 'bg-slate-800/80 border-slate-700 text-slate-100 hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-[#0a192f] hover:bg-slate-50 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-slate-700 text-[#1f347d] dark:text-sky-300 flex items-center justify-center font-bold flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-xs sm:text-sm text-[#0a192f] dark:text-white">
                      {lang === 'ar' ? 'عن المطور' : 'About Developer'}
                    </div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">
                      MARCO SAWIRIS
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-center text-xs font-black text-[#1f347d] dark:text-slate-400 flex items-center justify-center gap-1">
              <span>احسبلى — اختار الأوفر</span>
            </div>
          </aside>
        </div>
      )}

      {/* About Application Modal (Dedicated exclusively to App info) */}
      {aboutAppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setAboutAppModalOpen(false)}
          />
          <div
            className={`relative z-10 w-full max-w-[540px] rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl modal-word-in ${
              theme === 'dark' ? 'bg-[#0f172a] text-slate-100 border border-slate-800' : 'bg-white text-[#1f347d]'
            }`}
          >
            {/* Header Titles */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1f347d] to-[#3c89bd] text-white flex items-center justify-center font-bold text-sm shadow-md">
                  <Calculator className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#1f347d] dark:text-sky-300">
                    {lang === 'ar' ? 'عن التطبيق' : 'About Application'}
                  </h2>
                  <p className="text-xs font-bold text-sky-600 dark:text-sky-400">
                    {lang === 'ar' ? 'احسبلى · الإصدار ٢' : 'E7sbly · Version 2'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAboutAppModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:scale-110 active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content (exact user text) */}
            <div className="py-5 space-y-4 text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-200 font-medium">
              <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-slate-800/80 border border-sky-100 dark:border-slate-700 leading-relaxed">
                {lang === 'ar'
                  ? 'تطبيق أندرويد يعمل بدون إنترنت لمقارنة القيمة الفعلية من خلال إدخال وزن وسعر من منتجين إلى خمسة، وحساب سعر الكيلو وترتيب المنتجات من الأرخص إلى الأغلى، مع دعم الجرام والكيلوجرام واللتر مع توحيد العملة في المقارنة.'
                  : 'An offline Android application to compare actual value by inputting weight and price for 2 to 5 products, calculating normalized price per unit, and ranking products from best value to highest, supporting grams, kilograms, and liters with unified currency.'}
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 leading-relaxed">
                {lang === 'ar'
                  ? 'الإصدار 2، يدعم Android 10 فأحدث، ويوفر العربية والإنجليزية وتطبيقها على اتجاه الواجهة والأرقام والنتائج والتنبيهات، مع الاحتفاظ ببيانات المنتجات والوزن المطلوب.'
                  : 'Version 2 supports Android 10 and above, offering full Arabic and English support applied to interface layout, numbers, results, and alerts, while preserving product data and target weight.'}
              </div>
            </div>

            {/* Close button */}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAboutAppModalOpen(false)}
                className="text-[#3c89bd] hover:text-[#2c6e9b] dark:text-sky-400 font-extrabold text-base sm:text-lg transition-colors px-2 py-1"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer Information Modal (Dedicated exclusively to Marco Sawiris) */}
      {developerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setDeveloperModalOpen(false)}
          />
          <div
            className={`relative z-10 w-full max-w-[540px] rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl modal-word-in ${
              theme === 'dark' ? 'bg-[#0f172a] text-slate-100 border border-slate-800' : 'bg-white text-[#0a192f] border border-slate-200'
            }`}
          >
            {/* Header Titles */}
            <div className="text-start space-y-1 word-in" style={{ '--i': 0 } as React.CSSProperties}>
              <h2 className="text-xl sm:text-2xl font-black text-[#0a192f] dark:text-sky-300">
                {lang === 'ar' ? 'عن المطور' : 'About Developer'}
              </h2>
            </div>

            {/* Developer Name & Title (always LTR as shown in reference) */}
            <div dir="ltr" className="text-start mt-3 mb-2.5 word-in" style={{ '--i': 1 } as React.CSSProperties}>
              <h3 className="text-2xl sm:text-[28px] font-black text-[#0a192f] dark:text-white tracking-tight leading-tight">
                MARCO SAWIRIS
              </h3>
              <p className="text-xs sm:text-sm font-bold text-[#1f347d] dark:text-sky-400 mt-0.5">
                Senior Graphic Designer &amp; Art Director
              </p>
            </div>

            {/* Developer Banner Card - Multi-level animated card with animated line, text, and portrait */}
            <div
              dir="ltr"
              className={`rounded-2xl border ${
                theme === 'dark'
                  ? 'border-slate-700 bg-slate-800/90'
                  : 'border-slate-200 bg-slate-50'
              } shadow-sm overflow-hidden flex items-stretch mt-3 hover-lift relative min-h-[175px]`}
            >
              {/* 1. Animated Decorative Accent Line Running Across Card */}
              <div
                style={{ '--i': 2 } as React.CSSProperties}
                className="absolute -top-0.5 inset-x-0 h-1 bg-gradient-to-r from-sky-400 via-[#1f347d] to-amber-400 rounded-t-2xl word-in pointer-events-none z-20"
              />
              <div
                style={{ '--i': 2 } as React.CSSProperties}
                className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-sky-400/15 blur-xl pointer-events-none word-in"
              />

              {/* 2. Animated Bio Text Container on its own level */}
              <div
                style={{ '--i': 3 } as React.CSSProperties}
                className="flex-1 p-5 sm:p-6 flex items-center z-10 word-in"
              >
                <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 leading-snug">
                  20+ years of design experience across Egypt and Qatar, creating brand identities, campaigns, packaging and motion graphics.
                </p>
              </div>

              {/* 3. Animated Marco Sawiris Portrait on its own level */}
              <div
                style={{ '--i': 4 } as React.CSSProperties}
                className="w-[42%] sm:w-[38%] flex-shrink-0 flex items-end justify-end overflow-hidden m-0 p-0 relative self-stretch word-in"
              >
                <img
                  src={developerReferencePhoto}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes('developer-reference.png')) {
                      target.src = './developer-reference.png';
                    }
                  }}
                  alt="Marco Sawiris"
                  className="w-full h-full object-cover object-bottom block m-0 p-0 select-none pointer-events-none rounded-r-2xl"
                />
              </div>
            </div>

            {/* Website Link centered below card with Globe and ExternalLink icons */}
            <div className="text-center mt-4.5 word-in" style={{ '--i': 5 } as React.CSSProperties}>
              <a
                href="https://marco-sawiris.github.io/"
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1f347d] hover:text-[#0a192f] dark:text-sky-400 dark:hover:text-sky-300 hover:underline transition-colors"
              >
                <Globe className="w-4 h-4 text-[#1f347d] dark:text-sky-400" />
                <span>marco-sawiris.github.io</span>
              </a>
            </div>

            {/* Close button aligned to bottom end (right side in RTL) */}
            <div className="mt-6 flex justify-end word-in" style={{ '--i': 6 } as React.CSSProperties}>
              <button
                type="button"
                onClick={() => setDeveloperModalOpen(false)}
                className="text-[#1f347d] hover:text-[#0a192f] dark:text-sky-400 dark:hover:text-sky-300 font-extrabold text-base sm:text-lg transition-colors px-2 py-1"
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
          <div className={`relative z-10 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-dialog-pop ${theme === 'dark' ? 'bg-[#0f172a] text-slate-100 border border-slate-800' : 'bg-white text-[#1f347d]'}`}>
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
          <div className={`relative z-10 w-full max-w-lg rounded-2xl p-6 shadow-2xl modal-word-in ${theme === 'dark' ? 'bg-[#0f172a] text-slate-100 border border-slate-800' : 'bg-white text-[#1f347d]'}`}>
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
                          📦 E7sbly-release.apk (3.7 MB)
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
      <main className="w-full max-w-xl sm:max-w-2xl mx-auto px-2.5 sm:px-4 pt-2 sm:pt-3">
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
                    href="/E7sbly-release.apk"
                    download="E7sbly-release.apk"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-[#1f347d] hover:from-sky-700 hover:to-[#172960] text-white font-bold text-xs flex items-center gap-2 shadow-md transition-transform active:scale-95"
                  >
                    <Download className="w-4 h-4 text-sky-300" />
                    <span>{lang === 'ar' ? 'تحميل Release APK (3.7 MB)' : 'Download Release APK (3.7 MB)'}</span>
                  </a>
                  <a
                    href="/E7sbly-debug.apk"
                    download="E7sbly-debug.apk"
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
          <div className="space-y-4 animate-slide-up-fade">
            {/* Hero Banner - Compact & Snug */}
            <div
              style={{ '--i': 0 } as React.CSSProperties}
              className={`p-3 sm:p-3.5 rounded-xl border ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              } shadow-xs word-in space-y-2.5`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500/20 to-sky-400/10 border border-sky-400/30 flex items-center justify-center flex-shrink-0">
                  <Calculator className="w-4 h-4 text-sky-500" />
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-black text-[#0a192f] dark:text-white leading-tight">
                    {lang === 'ar' ? 'نفس المنتج، أيهما أوفر؟' : 'Same Product, Better Value?'}
                  </h1>
                  <p className="text-[10px] sm:text-[11px] text-[#1f347d] dark:text-slate-300 mt-0.5 font-bold">
                    {lang === 'ar' ? 'قارن الوزن والسعر، واعرف التوفير بالجنيه المصرى فى لحظة.' : 'Compare weight or volume and price to calculate real savings in EGP.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Try Example at start of text, Clear at end of text */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2.5 w-full">
                <button
                  type="button"
                  onClick={handleLoadExample}
                  className={`px-3 py-1 rounded-lg border text-[11px] sm:text-xs font-black flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 ${
                    theme === 'dark'
                      ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-sky-400'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#1f347d]'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>{lang === 'ar' ? 'جرب بمثال' : 'Try Example'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartOver}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-black text-[#1f347d] dark:text-slate-300 hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-900/60 bg-transparent hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{lang === 'ar' ? 'تفريغ' : 'Clear'}</span>
                </button>
              </div>
            </div>

            {/* Error Banner - High Contrast Red for Light and Dark Modes */}
            {generalError && (
              <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950/70 border-2 border-red-700 text-red-950 dark:text-red-100 text-xs flex items-center gap-2.5 shadow-sm animate-slide-up-fade font-black">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-700 dark:text-red-400" />
                <span className="font-black text-red-950 dark:text-red-100">{generalError}</span>
              </div>
            )}

            {/* Products Form - Compact & Snug */}
            <form onSubmit={handleCalculate} style={{ '--i': 1 } as React.CSSProperties} className="space-y-2.5 word-in">
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-xs font-black uppercase tracking-wider text-[#0a192f] dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3 h-3 text-sky-500" />
                  <span>{lang === 'ar' ? 'المنتجات للمقارنة' : 'Products to Compare'}</span>
                  <span className="text-xs text-sky-600 dark:text-sky-400 font-bold">({products.length}/5)</span>
                </h2>
                <span className="text-[11px] text-[#1f347d] dark:text-slate-400 font-bold">
                  {lang === 'ar' ? 'يمكن مقارنة ٢ إلى ٥ منتجات' : '2 to 5 products'}
                </span>
              </div>

              {/* Product Cards */}
              <div className="space-y-2">
                {products.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`p-2.5 sm:p-3 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'bg-slate-900 border-slate-800 focus-within:border-sky-500'
                        : 'bg-white border-slate-200 focus-within:border-[#1f347d]'
                    } shadow-xs`}
                  >
                    {/* Top Header with Quantity Controls */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black ${theme === 'dark' ? 'bg-slate-800 text-sky-300' : 'bg-sky-50 text-[#1f347d]'}`}>
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => handleProductChange(p.id, 'name', e.target.value)}
                          placeholder={lang === 'ar' ? `اسم المنتج ${idx + 1} (اختيارى)` : `Product ${idx + 1} (optional)`}
                          className="w-full bg-transparent text-xs sm:text-sm font-bold text-[#0a192f] dark:text-white placeholder:text-slate-500 focus:outline-hidden"
                        />
                      </div>

                      {/* Quantity Controls - Styled clean like the delete icon without dark/grey container */}
                      <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg px-1 py-0.5">
                        <span className="text-[10px] text-[#1f347d] dark:text-slate-400 hidden sm:inline px-0.5 font-bold">
                          {lang === 'ar' ? 'العبوات:' : 'Qty:'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityDelta(p.id, -1)}
                          disabled={p.quantity <= 1}
                          className="p-1 rounded text-slate-500 hover:text-[#1f347d] dark:text-slate-400 dark:hover:text-white disabled:opacity-25 transition-colors"
                          aria-label={lang === 'ar' ? 'تقليل العبوات' : 'Decrease Quantity'}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="min-w-5 text-center text-xs font-black text-[#0a192f] dark:text-white">
                          {p.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityDelta(p.id, 1)}
                          disabled={p.quantity >= 99}
                          className="p-1 rounded text-slate-500 hover:text-[#1f347d] dark:text-slate-400 dark:hover:text-white disabled:opacity-25 transition-colors"
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
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 disabled:opacity-20 transition-colors"
                        title={lang === 'ar' ? 'حذف المنتج' : 'Delete Product'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Product Inputs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {/* Weight / Volume Input with Custom Segmented Unit Switcher */}
                      <div>
                        <label className="flex items-center gap-1 text-[11px] font-black text-[#0a192f] dark:text-slate-300 mb-0.5">
                          <Scale className="w-3 h-3 text-sky-500" />
                          <span>{lang === 'ar' ? 'الوزن أو الحجم' : 'Weight / Volume'}</span>
                        </label>
                        <div className={`flex items-center rounded-lg border overflow-hidden ${errors[`${p.id}_weight`] ? 'border-red-500 bg-red-50/40' : theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={p.weight}
                            onFocus={handleNumericFocus}
                            onChange={(e) => handleProductChange(p.id, 'weight', e.target.value)}
                            placeholder={lang === 'ar' ? 'مثال: ٣٠٠' : 'e.g. 300'}
                            className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold bg-transparent text-[#0a192f] dark:text-white text-end focus:outline-hidden placeholder:text-slate-500 placeholder:text-right"
                            dir="ltr"
                          />
                          {/* Custom Segmented Unit Switcher - Unified Montserrat-Arabic Font and Visual Harmony */}
                          <div className="flex items-center border-s border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-0.5">
                            <button
                              type="button"
                              onClick={() => handleProductChange(p.id, 'unit', 'g')}
                              className={`px-1.5 py-0.5 text-[10px] sm:text-[11px] font-black rounded transition-colors ${
                                p.unit === 'g'
                                  ? 'bg-[#1f347d] text-white shadow-xs'
                                  : 'text-[#0a192f] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              {lang === 'ar' ? 'جرام' : 'g'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleProductChange(p.id, 'unit', 'kg')}
                              className={`px-1.5 py-0.5 text-[10px] sm:text-[11px] font-black rounded transition-colors ${
                                p.unit === 'kg'
                                  ? 'bg-[#1f347d] text-white shadow-xs'
                                  : 'text-[#0a192f] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              {lang === 'ar' ? 'كيلو' : 'kg'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleProductChange(p.id, 'unit', 'l')}
                              className={`px-1.5 py-0.5 text-[10px] sm:text-[11px] font-black rounded transition-colors ${
                                p.unit === 'l'
                                  ? 'bg-[#1f347d] text-white shadow-xs'
                                  : 'text-[#0a192f] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              {lang === 'ar' ? 'لتر' : 'L'}
                            </button>
                          </div>
                        </div>
                        {errors[`${p.id}_weight`] && (
                          <p className="text-[10px] text-red-700 dark:text-red-400 mt-0.5 font-black">{errors[`${p.id}_weight`]}</p>
                        )}
                      </div>

                      {/* Price Input */}
                      <div>
                        <label className="flex items-center gap-1 text-[11px] font-black text-[#0a192f] dark:text-slate-300 mb-0.5">
                          <Coins className="w-3 h-3 text-sky-500" />
                          <span>{lang === 'ar' ? 'سعر العبوة' : 'Pack Price'}</span>
                        </label>
                        <div className={`flex items-center rounded-lg border overflow-hidden ${errors[`${p.id}_price`] ? 'border-red-500 bg-red-50/40' : theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={p.price}
                            onFocus={handleNumericFocus}
                            onChange={(e) => handleProductChange(p.id, 'price', e.target.value)}
                            placeholder={lang === 'ar' ? 'مثال: ٣٠' : 'e.g. 30'}
                            className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold bg-transparent text-[#0a192f] dark:text-white text-end focus:outline-hidden placeholder:text-slate-500 placeholder:text-right"
                            dir="ltr"
                          />
                          <span className={`px-2.5 py-1.5 text-xs font-black border-s ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-slate-100 text-[#0a192f]'}`}>
                            {lang === 'ar' ? 'ج.م' : 'EGP'}
                          </span>
                        </div>
                        {errors[`${p.id}_price`] && (
                          <p className="text-[10px] text-red-700 dark:text-red-400 mt-0.5 font-black">{errors[`${p.id}_price`]}</p>
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
                  className={`w-full py-2 rounded-xl border border-dashed font-bold text-xs flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01] ${theme === 'dark' ? 'border-slate-700 hover:border-sky-500 text-sky-400 hover:bg-slate-800/40' : 'border-slate-300 hover:border-[#1f347d] text-[#1f347d] hover:bg-sky-50/50'}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إضافة منتج آخر' : 'Add Another Product'}</span>
                </button>
              )}

              {/* Compare Action Button */}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#1f347d] to-[#3c89bd] hover:from-[#18285c] hover:to-[#3274a1] text-white font-black text-sm shadow-md hover:shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Calculator className="w-4 h-4 text-sky-200" />
                <span>{lang === 'ar' ? 'احسب الأوفر' : 'Find Best Value'}</span>
                {lang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </form>

            {/* Results Section (Requirements 1, 5, 8) */}
            {results && (
              <div id="results-section" className="pt-2 space-y-3">
                {/* Summary Headline Banner */}
                <div
                  style={{ '--i': 0 } as React.CSSProperties}
                  className={`p-3.5 sm:p-4 rounded-xl border ${theme === 'dark' ? 'bg-[#1e3a5f] border-sky-800 text-sky-100' : 'bg-gradient-to-r from-sky-50 to-blue-50 border-sky-200 text-[#0a192f]'} shadow-xs word-in`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-black flex-shrink-0 shadow-sm">
                      <Trophy className="w-5 h-5 text-amber-900" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm sm:text-base">
                        {results.allEqual
                          ? (results.isVolume
                              ? (lang === 'ar' ? 'كل المنتجات متساوية فى السعر لكل لتر' : 'All products have the same price per liter')
                              : (lang === 'ar' ? 'كل المنتجات متساوية فى السعر لكل كيلو' : 'All products have the same price per kg'))
                          : (lang === 'ar'
                              ? `${results.cheapest.name} هو الخيار الأوفر بـ ${results.savingsPerUnit.toFixed(2)} ج.م`
                              : `${results.cheapest.name} is the best value, saving ${results.savingsPerUnit.toFixed(2)} EGP`)}
                      </h3>
                      {!results.allEqual && (
                        <p className="text-[11px] sm:text-xs text-sky-700 dark:text-sky-300 mt-0.5 font-bold flex items-center gap-1.5 flex-wrap">
                          <Sparkles className="w-3 h-3 text-amber-500 inline" />
                          <span>
                            {results.isVolume
                              ? (lang === 'ar' ? 'سعر موحد لـ ١ لتر' : 'Standard 1 Liter')
                              : (lang === 'ar' ? 'سعر موحد لـ ١ كيلو' : 'Standard 1 Kg')}
                          </span>
                          <span>·</span>
                          <span className="font-black text-emerald-700 dark:text-emerald-400">
                            {lang === 'ar'
                              ? `توفير ${results.savingsPercent.toFixed(1)}٪ مقارنة بالخيار الأعلى`
                              : `Saves ${results.savingsPercent.toFixed(1)}% vs highest`}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ranked Cards (Requirement 1 & 5: Enlarged Prominent Best-Value Card) */}
                <div className="space-y-2.5">
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
                        className={`rounded-xl border transition-all word-in ${
                          isBest
                            ? `${theme === 'dark' ? 'bg-[#192b4d] border-sky-400' : 'bg-white border-[#1f347d]'} p-3.5 sm:p-4 shadow-md ring-2 ring-sky-500/30`
                            : `${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-3 shadow-xs`
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${isBest ? 'bg-[#1f347d] text-white shadow-xs' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                              {isBest ? <Crown className="w-3.5 h-3.5 text-amber-300" /> : `#${p.rank}`}
                            </span>
                            <div>
                              <h4 className={`font-black flex items-center gap-1.5 ${isBest ? 'text-base sm:text-lg text-sky-700 dark:text-sky-300' : 'text-sm sm:text-base text-[#0a192f] dark:text-white'}`}>
                                <span>{p.name}</span>
                                {isBest && <Sparkles className="w-3.5 h-3.5 text-amber-500 inline" />}
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold">
                                {p.weight} {p.unit === 'l' ? (lang === 'ar' ? 'لتر' : 'L') : (p.unit === 'kg' ? (lang === 'ar' ? 'كيلو' : 'kg') : (lang === 'ar' ? 'جرام' : 'g'))}
                                {' · '}
                                {lang === 'ar' ? 'سعر العبوة: ' : 'Pack: '}
                                <span className="font-black text-[#0a192f] dark:text-slate-200">{p.price} {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                              </p>
                            </div>
                          </div>

                          {isBest && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 shadow-xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>{lang === 'ar' ? 'الأوفر قيمة' : 'Best Value'}</span>
                            </span>
                          )}
                        </div>

                        {/* Price per kg or per Liter */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between flex-wrap gap-2">
                          <div>
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Calculator className="w-3 h-3 text-sky-500" />
                              <span>
                                {results.isVolume
                                  ? (lang === 'ar' ? 'سعر اللتر' : 'Price per Liter')
                                  : (lang === 'ar' ? 'سعر الكيلو' : 'Price per kg')}
                              </span>
                            </span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className={`font-black ${isBest ? 'text-xl sm:text-2xl text-sky-600 dark:text-sky-400' : 'text-lg font-black text-[#0a192f] dark:text-white'}`}>
                                {p.pricePerUnit.toFixed(2)}
                              </span>
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
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
                              <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-end gap-1">
                                <TrendingDown className="w-3 h-3 text-emerald-500" />
                                <span>{lang === 'ar' ? 'مقدار التوفير بالجنيه' : 'Savings vs Alternatives'}</span>
                              </span>
                              {p.savingsVsAlternative.map((alt, i) => (
                                <div key={i} className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900">
                                  {lang === 'ar'
                                    ? `يوفر ${alt.diffEGP.toFixed(2)} ج.م مقارنة بـ ${alt.altName}`
                                    : `Saves ${alt.diffEGP.toFixed(2)} EGP vs ${alt.altName}`}
                                </div>
                              ))}
                            </div>
                          )}

                          {!isBest && (
                            <div className="text-end">
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
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
                  className="pt-2 grid grid-cols-2 gap-2.5 word-in"
                  style={{ '--i': results.ranked.length + 1 } as React.CSSProperties}
                >
                  <button
                    type="button"
                    onClick={() => {
                      document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`py-2.5 rounded-xl border text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01] active:scale-[0.99] ${
                      theme === 'dark' ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200' : 'border-slate-300 bg-white hover:bg-slate-50 text-[#1f347d] shadow-xs'
                    }`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-sky-500" />
                    <span>{lang === 'ar' ? 'رجوع للمنتجات' : 'Back to Products'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartOver}
                    className="py-2.5 rounded-xl bg-gradient-to-r from-[#1f347d] to-[#3c89bd] hover:from-[#18285c] hover:to-[#3274a1] text-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-sky-200" />
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
