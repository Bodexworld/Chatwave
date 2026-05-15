import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRightLeft, TrendingUp, RefreshCcw, DollarSign, Euro, PoundSterling, Search, Globe } from 'lucide-react';

type Props = {
  onBack?: () => void;
};

const COUNTRIES = [
  { code: 'NGN', name: 'Nigerian Naira', flag: '🇳🇬' },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪' },
  { code: 'PHP', name: 'Philippine Peso', flag: '🇵🇭' },
  { code: 'GHS', name: 'Ghanaian Cedi', flag: '🇬🇭' },
];

const PLATFORMS = [
  { id: 'binance', name: 'Binance P2P', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-500/10', spread: 0.05, type: 'crypto' },
  { id: 'remitly', name: 'Remitly', color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10', spread: -0.015, type: 'fiat' },
  { id: 'wise', name: 'Wise', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10', spread: 0.005, type: 'fiat' },
  { id: 'sendwave', name: 'Sendwave', color: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10', spread: -0.02, type: 'fiat' },
  { id: 'lemonade', name: 'Lemonade Finance', color: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10', spread: 0.01, type: 'crypto' },
];

export default function ExchangeRates({ onBack }: Props) {
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('NGN');
  const [amount, setAmount] = useState('100');
  const [rates, setRates] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchRates();
  }, [baseCurrency]);

  const fetchRates = async () => {
    setLoading(true);
    try {
      // Using a free open API for base rates. 
      const response = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
      const data = await response.json();
      if (data && data.rates) {
        setRates(data.rates);
        if (data.time_last_update_utc) {
          setLastUpdated(data.time_last_update_utc);
        }
      }
    } catch (error) {
      console.error("Failed to fetch rates", error);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformRate = (platform: typeof PLATFORMS[0], baseRate: number) => {
    // Simulate real-world platform rates:
    // Crypto P2P generally has a premium in some countries (positive spread).
    // Traditional fiat remitters have a small fee or worse rate (negative spread).
    // We add some deterministic random jitter based on platform name and currency.
    const charCode = (targetCurrency.charCodeAt(0) + platform.name.charCodeAt(0)) % 10;
    const jitter = (charCode / 1000) * baseRate; 
    
    // For NGN specifically, P2P rates are much higher than official rates
    let countryPremium = 0;
    if (targetCurrency === 'NGN' && platform.type === 'crypto') countryPremium = 0.40; // 40% premium for crypto
    if (targetCurrency === 'ZAR' && platform.type === 'crypto') countryPremium = 0.05;
    
    return baseRate * (1 + platform.spread + countryPremium) + jitter;
  };

  const handleSwap = () => {
    setBaseCurrency(targetCurrency);
    setTargetCurrency(baseCurrency);
  };

  const filteredCountries = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 md:hidden">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Globe className="w-6 h-6 text-indigo-500" />
            Exchange
          </h1>
        </div>
        <button onClick={fetchRates} className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors ${loading ? 'animate-spin text-indigo-500' : 'text-slate-500'}`}>
          <RefreshCcw className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        {/* Converter Section */}
        <div className="bg-white dark:bg-[#151e2e] p-6 shadow-sm border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col space-y-4 relative">
             <div className="flex items-center space-x-4 p-4 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">You Send</p>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-3xl font-display font-bold text-slate-800 dark:text-slate-100 p-0 m-0"
                  />
                </div>
                <select 
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                  className="bg-white dark:bg-slate-800 border shadow-sm border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2 px-3 pl-4 rounded-2xl outline-none focus:ring-2 appearance-none h-12"
                  style={{ backgroundImage: 'none' }} // Custom styled select
                >
                  <option value="USD">🇺🇸 USD</option>
                  <option value="EUR">🇪🇺 EUR</option>
                  <option value="GBP">🇬🇧 GBP</option>
                  <option value="CAD">🇨🇦 CAD</option>
                  {COUNTRIES.map(c => <option key={`from-${c.code}`} value={c.code}>{c.flag} {c.code}</option>)}
                </select>
             </div>

             <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10">
               <button onClick={handleSwap} className="w-full h-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-[#151e2e] transform hover:rotate-180 transition-all duration-300">
                 <ArrowRightLeft className="w-4 h-4 rotate-90" />
               </button>
             </div>

             <div className="flex items-center space-x-4 p-4 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">They Receive (Approx)</p>
                  <div className="w-full bg-transparent text-3xl font-display font-bold text-slate-400 p-0 m-0 truncate">
                    {loading ? '...' : (parseFloat(amount || '0') * (rates[targetCurrency] || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <select 
                  value={targetCurrency}
                  onChange={(e) => setTargetCurrency(e.target.value)}
                  className="bg-white dark:bg-slate-800 border shadow-sm border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2 px-3 pl-4 rounded-2xl outline-none focus:ring-2 appearance-none h-12"
                  style={{ backgroundImage: 'none' }}
                >
                  {COUNTRIES.map(c => <option key={`to-${c.code}`} value={c.code}>{c.flag} {c.code}</option>)}
                  <option value="USD">🇺🇸 USD</option>
                  <option value="EUR">🇪🇺 EUR</option>
                  <option value="GBP">🇬🇧 GBP</option>
                </select>
             </div>
          </div>
        </div>

        {/* Currency Search */}
        {/*
        <div className="p-4 bg-white dark:bg-[#151e2e]">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search pairs..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        */}

        {/* Comparison Section */}
        <div className="p-4 mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
               <div className="flex items-center gap-2">
                 <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wide uppercase">Compare Platform Rates</h3>
                 {lastUpdated && !loading && (
                   <span className="flex items-center text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full" title={new Date(lastUpdated).toLocaleString()}>
                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                     Live Today
                   </span>
                 )}
               </div>
               {rates[targetCurrency] && (
                 <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded w-fit">
                   Base: 1 {baseCurrency} = {rates[targetCurrency].toFixed(2)} {targetCurrency}
                 </span>
               )}
            </div>
            
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {PLATFORMS.map(platform => {
                  const baseRate = rates[targetCurrency] || 1;
                  const platformRate = getPlatformRate(platform, baseRate);
                  const totalAmount = parseFloat(amount || '0') * platformRate;
                  
                  return (
                    <div key={platform.id} className="bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-shadow group">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${platform.color}`}>
                          {platform.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            {platform.name}
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">
                              {platform.type}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                            <TrendingUp className="w-3 h-3" />
                            1 {baseCurrency} = {platformRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} {targetCurrency}
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl sm:text-right group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 transition-colors">
                         <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1 uppercase tracking-wider">They get</div>
                         <div className="text-xl font-display font-bold text-slate-800 dark:text-slate-100">
                           {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                           <span className="text-sm ml-1 text-slate-400">{targetCurrency}</span>
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
