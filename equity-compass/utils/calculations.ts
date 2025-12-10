import { Grant, VestingEvent, ISOScenario, Client, PlannedExercise } from '../types';

const NIIT_RATE = 0.038; // Net Investment Income Tax
const TAX_YEAR_DISPLAY = 2026;

// Simplified State Tax Map
export const STATE_TAX_RATES: Record<string, number> = {
  'CA': 0.144, 
  'NY': 0.109,
  'TX': 0.0,   
  'FL': 0.0,   
  'WA': 0.07,  
  'MA': 0.05,  
  'NJ': 0.1075,
  'Other': 0.05 
};

// --- 2026 PROJECTIONS (TCJA SUNSET SCENARIO) ---

// Estimated 2026 Personal Exemption (Reinstated post-TCJA)
const PERSONAL_EXEMPTION_2026 = 5300; 

// Estimated 2026 Standard Deductions (Approx half of 2025)
const STANDARD_DEDUCTION_2026 = {
    single: 8300, 
    married_joint: 16600 
};

// 2026 Projected Federal Tax Brackets (Reverting to pre-2018 structure)
// [Upper Limit, Rate]
const TAX_BRACKETS_2026 = {
    single: [
        { limit: 11600, rate: 0.10 },
        { limit: 47150, rate: 0.15 }, 
        { limit: 114650, rate: 0.25 }, 
        { limit: 239200, rate: 0.28 }, 
        { limit: 519900, rate: 0.33 }, 
        { limit: 522000, rate: 0.35 }, 
        { limit: Infinity, rate: 0.396 } 
    ],
    married_joint: [
        { limit: 23200, rate: 0.10 },
        { limit: 94300, rate: 0.15 }, 
        { limit: 190200, rate: 0.25 }, 
        { limit: 289900, rate: 0.28 }, 
        { limit: 519900, rate: 0.33 }, 
        { limit: 589150, rate: 0.35 }, 
        { limit: Infinity, rate: 0.396 } 
    ]
};

// 2026 AMT Parameters (The Cliff)
const AMT_PARAMS_2026 = {
    single: { 
        exemption: 64400, 
        phaseout: 140300 
    },
    married_joint: { 
        exemption: 100500, 
        phaseout: 280600 
    },
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(num);
};

export const formatPercent = (decimal: number) => {
  return `${(decimal * 100).toFixed(1)}%`;
};

export const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

export const getEffectiveRates = (client: Client) => {
    const stateRate = client.customStateTaxRate !== undefined 
        ? client.customStateTaxRate / 100 
        : (STATE_TAX_RATES[client.state] || STATE_TAX_RATES['Other']);
    
    // LTCG rates likely to remain similar (0/15/20) but we align breakpoints 
    const fedLtcgRate = client.customLtcgTaxRate !== undefined
        ? client.customLtcgTaxRate / 100
        : (client.taxBracket > 33 ? 0.20 : 0.15); 

    return { stateRate, fedLtcgRate };
};

/**
 * Calculates accurate stats for a grant: Total, Vested, Unvested, Exercised, Available.
 */
export const getGrantStatus = (grant: Grant, plannedExercises: PlannedExercise[]) => {
    const now = new Date();
    // Dummy client for schedule generation
    const schedule = generateVestingSchedule(grant, { taxBracket: 37, state: 'CA', grants: [], plannedExercises: [], name: '', id: '', filingStatus: 'single' } as Client); 
    
    const vestedEvents = schedule.filter(e => new Date(e.date) <= now);
    const unvestedEvents = schedule.filter(e => new Date(e.date) > now);

    const totalVestedShares = vestedEvents.reduce((sum, e) => sum + e.shares, 0);
    const totalUnvestedShares = unvestedEvents.reduce((sum, e) => sum + e.shares, 0);
    
    const exercisedShares = plannedExercises
        .filter(p => p.grantId === grant.id)
        .reduce((sum, p) => sum + p.shares, 0);

    return {
        total: grant.totalShares,
        vestedTotal: totalVestedShares,
        unvested: totalUnvestedShares,
        exercised: exercisedShares,
        available: Math.max(0, totalVestedShares - exercisedShares)
    };
};

/**
 * Calculates Federal Regular Tax using 2026 Progressive Brackets
 */
const calculateProgressiveTax = (taxableIncome: number, status: 'single' | 'married_joint'): number => {
    const brackets = TAX_BRACKETS_2026[status];
    let tax = 0;
    let previousLimit = 0;

    for (const bracket of brackets) {
        if (taxableIncome > bracket.limit) {
            tax += (bracket.limit - previousLimit) * bracket.rate;
            previousLimit = bracket.limit;
        } else {
            tax += (taxableIncome - previousLimit) * bracket.rate;
            break;
        }
    }
    return tax;
};

/**
 * Calculates the "AMT Room" for 2026 considering:
 * 1. Base Salary + RSU Income
 * 2. SALT Deduction (No Cap) vs Standard Deduction logic
 * 3. Personal Exemptions
 * 4. Lower AMT Exemptions (Sunset)
 */
export const calculateAMTRoom = (client: Client) => {
    const currentYear = new Date().getFullYear();
    const status = client.filingStatus || 'single';
    const params = AMT_PARAMS_2026[status];
    const stdDeduction = STANDARD_DEDUCTION_2026[status];
    const personalExemptions = (status === 'married_joint' ? 2 : 1) * PERSONAL_EXEMPTION_2026;

    // 1. Calculate Income
    let projectedRSUIncome = 0;
    client.grants.filter(g => g.type === 'RSU').forEach(g => {
        const schedule = generateVestingSchedule(g, client);
        schedule.forEach(e => {
            const vestYear = new Date(e.date).getFullYear();
            if (vestYear === currentYear || vestYear === TAX_YEAR_DISPLAY) {
                 // Simplistic check for planning year
                 if (vestYear === new Date().getFullYear()) {
                    projectedRSUIncome += e.grossValue;
                 }
            }
        });
    });

    const baseIncome = client.estimatedIncome || 250000;
    const totalGrossIncome = baseIncome + projectedRSUIncome;
    
    // 2. SALT Deduction Logic (The 2026 Game Changer)
    // Estimate State Taxes paid
    const { stateRate } = getEffectiveRates(client);
    const estimatedStateTax = totalGrossIncome * stateRate;
    
    // In 2026, SALT Cap expires. You deduct the GREATER of State Tax OR Std Deduction
    const itemizedDeduction = estimatedStateTax; 
    const isItemizing = itemizedDeduction > stdDeduction;
    
    const effectiveDeduction = isItemizing ? itemizedDeduction : stdDeduction;

    // 3. Regular Tax Calculation
    // Regular Taxable Income = AGI - Deduction - Exemptions
    const regularTaxableIncome = Math.max(0, totalGrossIncome - effectiveDeduction - personalExemptions);
    const regularTax = calculateProgressiveTax(regularTaxableIncome, status);

    // 4. Iterate to find AMT crossover point
    let spread = 0;
    const step = 1000;
    let tmt = 0;
    let breakEvenSpread = 0;

    // Safety break
    while (spread < 10000000) {
        // AMTI = AGI + Spread.
        // Critical: State Taxes (Itemized) and Personal Exemptions are ADDED BACK (not deductible) for AMT.
        // Standard Deduction is also not deductible.
        // So AMTI is roughly just Gross Income + Spread (minus potentially very limited medical/charity, which we ignore here for safety).
        const amti = totalGrossIncome + spread;

        // Calculate Exemption Phaseout (2026 Rules)
        let exemption = params.exemption;
        if (amti > params.phaseout) {
            const reduction = (amti - params.phaseout) * 0.25;
            exemption = Math.max(0, params.exemption - reduction);
        }

        const amtBase = Math.max(0, amti - exemption);
        
        let tentativeTax = 0;
        const threshold = 220700; // 2026 estimated inflation adj
        
        if (amtBase <= threshold) {
            tentativeTax = amtBase * 0.26;
        } else {
            tentativeTax = (threshold * 0.26) + ((amtBase - threshold) * 0.28);
        }

        tmt = tentativeTax;

        if (tmt > regularTax) {
            breakEvenSpread = spread;
            break; 
        }
        spread += step;
    }

    return {
        room: Math.max(0, breakEvenSpread - step),
        regularTax,
        projectedRSUIncome,
        baseIncome,
        stdDeduction,
        personalExemptions,
        effectiveDeduction,
        isItemizing,
        estimatedStateTax
    };
};


export const generateVestingSchedule = (grant: Grant, client: Client, simulateSellAll: boolean = false): VestingEvent[] => {
  const events: VestingEvent[] = [];
  const grantDate = new Date(grant.grantDate);
  const totalShares = grant.totalShares;
  const clientTaxRate = client.taxBracket / 100;
  
  const { stateRate } = getEffectiveRates(client);
  
  const electedRate = (grant.withholdingRate !== undefined ? grant.withholdingRate : 22) / 100;

  if (grant.vestingSchedule === 'standard_4y_1y_cliff') {
    const cliffDate = addMonths(grantDate, 12);
    const cliffShares = totalShares * 0.25;
    events.push(calculateEvent(cliffDate, cliffShares, grant, clientTaxRate, stateRate, electedRate, simulateSellAll));

    for (let i = 1; i <= 12; i++) {
      const vestDate = addMonths(cliffDate, i * 3);
      const shares = (totalShares * 0.75) / 12;
      events.push(calculateEvent(vestDate, shares, grant, clientTaxRate, stateRate, electedRate, simulateSellAll));
    }
  } else {
    const sharesPerTranche = totalShares / 16;
    for (let i = 1; i <= 16; i++) {
      const vestDate = addMonths(grantDate, i * 3);
      events.push(calculateEvent(vestDate, sharesPerTranche, grant, clientTaxRate, stateRate, electedRate, simulateSellAll));
    }
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const calculateEvent = (
  date: Date, 
  shares: number, 
  grant: Grant, 
  fedRate: number, 
  stateRate: number,
  electedRate: number,
  simulateSellAll: boolean
): VestingEvent => {
  const price = grant.currentPrice;
  let grossValue = 0;
  let withholdingAmount = 0;
  let netShares = 0;
  let netValue = 0;
  let sharesSoldToCover = 0;
  let taxGap = 0;
  let amtExposure = 0;
  
  let fedLiability = 0;
  let stateLiability = 0;
  let niitLiability = 0; 

  if (grant.type === 'ISO') {
    const strike = grant.strikePrice || 0;
    const spread = Math.max(0, price - strike);
    
    grossValue = spread * shares; 
    
    // Vesting is NOT a taxable event for ISOs.
    amtExposure = 0; 
    
    withholdingAmount = 0;
    netShares = shares;
    netValue = shares * price; 
    taxGap = 0; 

  } else {
    // RSU
    grossValue = shares * price;
    withholdingAmount = grossValue * electedRate;
    
    fedLiability = grossValue * fedRate;
    stateLiability = grossValue * stateRate;
    
    const totalLiability = fedLiability + stateLiability;
    
    taxGap = Math.max(0, totalLiability - withholdingAmount);

    if (simulateSellAll) {
      netShares = 0;
      sharesSoldToCover = shares; 
      netValue = grossValue - withholdingAmount; 
    } else {
      const sharesSoldForTax = withholdingAmount / price;
      sharesSoldToCover = sharesSoldForTax;
      netShares = Math.max(0, shares - sharesSoldForTax);
      netValue = netShares * price;
    }
  }

  return {
    grantType: grant.type,
    date: date.toISOString().split('T')[0],
    shares,
    grossValue,
    withholdingAmount,
    electedWithholdingRate: electedRate * 100,
    netShares,
    netValue,
    sharesSoldToCover,
    taxGap,
    amtExposure,
    taxBreakdown: {
      fed: fedLiability,
      state: stateLiability,
      niit: niitLiability,
      totalLiability: fedLiability + stateLiability + niitLiability
    },
    isPast: date < new Date()
  };
};

export const getQuarterlyProjections = (events: VestingEvent[]) => {
  const now = new Date();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(now.getFullYear() + 1);

  return events.filter(e => {
    const d = new Date(e.date);
    return d >= now && d <= oneYearFromNow;
  });
};

export const calculateISOScenarios = (
  shares: number,
  strikePrice: number,
  fmvAtExercise: number,
  salePrice: number,
  client: Client,
  isQualified: boolean 
): ISOScenario => {
  const exerciseCost = shares * strikePrice;
  const saleProceeds = shares * salePrice;
  const bargainElement = Math.max(0, (fmvAtExercise - strikePrice) * shares);
  
  const { stateRate, fedLtcgRate } = getEffectiveRates(client);
  
  let ordinaryIncome = 0;
  let capitalGain = 0;
  let amtPreference = 0;
  
  let fedAmount = 0;
  let niitAmount = 0;
  let stateAmount = 0;

  if (isQualified) {
    amtPreference = bargainElement; 
    const totalGain = Math.max(0, saleProceeds - exerciseCost);
    capitalGain = totalGain;
    
    fedAmount = capitalGain * fedLtcgRate;
    niitAmount = capitalGain * NIIT_RATE;
    stateAmount = capitalGain * stateRate; 

  } else {
    const actualGain = saleProceeds - exerciseCost;
    ordinaryIncome = Math.min(bargainElement, actualGain);
    capitalGain = Math.max(0, saleProceeds - (shares * fmvAtExercise));
    
    amtPreference = 0; 
    
    const ordinaryFed = ordinaryIncome * (client.taxBracket / 100); 
    const ordinaryState = ordinaryIncome * stateRate;
    
    const capFed = capitalGain * fedLtcgRate;
    const capNiit = capitalGain * NIIT_RATE;
    const capState = capitalGain * stateRate;

    fedAmount = ordinaryFed + capFed;
    niitAmount = capNiit; 
    stateAmount = ordinaryState + capState;
  }

  const totalTax = fedAmount + niitAmount + stateAmount;

  return {
    name: isQualified ? "Qualified Disposition (Hold 1yr+)" : "Disqualified Disposition (Sell Early)",
    description: isQualified 
      ? `Held >2 years from grant & >1 year from exercise. Taxed at favorable Capital Gains rates (${formatPercent(fedLtcgRate)}).` 
      : "Sold early. The bargain element is taxed as Ordinary Income at your marginal rate.",
    exerciseDate: "TBD",
    saleDate: "TBD",
    shares,
    fmvAtExercise,
    salePrice,
    ordinaryIncome,
    capitalGain,
    amtPreference,
    taxes: {
      fedRate: isQualified ? fedLtcgRate : (client.taxBracket/100),
      fedAmount,
      niitRate: NIIT_RATE,
      niitAmount,
      stateRate,
      stateAmount,
      totalTax
    },
    netProfit: saleProceeds - exerciseCost - totalTax
  };
};