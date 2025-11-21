import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { UserRole } from '../types';
import OtpCodeInput from '../components/OtpCodeInput';

// --- Types for dropdown options ---
interface SelectOption {
  id: string;
  name: string;
}

interface StateOption {
  code: string;
  name: string;
}

// --- SVG Icons for UI feedback ---
const CheckIcon = () => (
  <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
  </svg>
);

const ErrorIcon = () => (
    <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
);

const Spinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);


export default function SignUp() {
  // --- State Management ---
  // User input state
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [jobTitleId, setJobTitleId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [stateCode, setStateCode] = useState('');

  // UI/Flow state
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [step, setStep] = useState(1);
  const [cooldown, setCooldown] = useState(0);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const navigate = useNavigate();

  // Email validation state
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [isEmailAvailable, setIsEmailAvailable] = useState<boolean | null>(null);

  // Dropdown data state
  const [dropdownsLoading, setDropdownsLoading] = useState(true);
  const [companies, setCompanies] = useState<SelectOption[]>([]);
  const [jobTitles, setJobTitles] = useState<SelectOption[]>([]);
  const [locations, setLocations] = useState<SelectOption[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);

  // --- Email Availability Check ---
  const checkEmailAvailability = async (emailToCheck: string) => {
    // Basic format check before hitting the server
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToCheck)) {
      setValidationErrors(v => ({ ...v, email: 'Please enter a valid email address.'}));
      setIsEmailAvailable(false);
      return;
    }
    
    setCheckingEmail(true);
    setIsEmailAvailable(null);
    setValidationErrors(v => {
        const newErrors = { ...v };
        delete newErrors.email;
        return newErrors;
    });

    try {
      const { data, error: rpcError } = await supabase.rpc('email_taken', { p_email: emailToCheck });
      if (rpcError) throw rpcError;

      if (data === true) {
        setValidationErrors(v => ({ ...v, email: 'This email already exists. Use a different email or sign in.' }));
        setIsEmailAvailable(false);
      } else {
        setIsEmailAvailable(true);
      }
    } catch (e: any) {
      setValidationErrors(v => ({ ...v, email: 'Could not verify email. Please try again.' }));
      setIsEmailAvailable(false);
    } finally {
      setCheckingEmail(false);
    }
  };

  // --- Effects ---
  // Debounced email check
  useEffect(() => {
    // Clear status if email is empty
    if (!email.trim()) {
      setCheckingEmail(false);
      setIsEmailAvailable(null);
      setValidationErrors(v => {
          const newErrors = { ...v };
          delete newErrors.email;
          return newErrors;
      });
      return;
    }

    const handler = setTimeout(() => {
      checkEmailAvailability(email);
    }, 300);

    return () => clearTimeout(handler);
  }, [email]);

  // Fetch dropdown data on mount
  useEffect(() => {
    const fetchDropdownData = async () => {
      setDropdownsLoading(true);
      try {
        const [companiesRes, jobTitlesRes, locationsRes, statesRes] = await Promise.all([
          supabase.from('companies').select('id, name').eq('is_active', true).order('name'),
          supabase.from('job_titles').select('id, name').eq('is_active', true).order('name'),
          supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
          supabase.from('states').select('code, name').order('name'),
        ]);

        if (companiesRes.error) throw companiesRes.error;
        setCompanies(companiesRes.data || []);
        if (jobTitlesRes.error) throw jobTitlesRes.error;
        setJobTitles(jobTitlesRes.data || []);
        if (locationsRes.error) throw locationsRes.error;
        setLocations(locationsRes.data || []);
        if (statesRes.error) throw statesRes.error;
        setStates(statesRes.data || []);
      } catch (e: any) {
        setError(`Failed to load form options: ${e.message}`);
      } finally {
        setDropdownsLoading(false);
      }
    };
    fetchDropdownData();
  }, []);

  // Cooldown timer effect
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // --- Validation ---
  const validateStep1 = () => {
    const errors: { [key: string]: string } = {};
    if (!firstName.trim()) errors.firstName = 'First name is required.';
    if (!lastName.trim()) errors.lastName = 'Last name is required.';
    if (!companyId) errors.companyId = 'Please select a company.';
    if (!jobTitleId) errors.jobTitleId = 'Please select a job title.';
    if (!locationId) errors.locationId = 'Please select a location.';
    if (!stateCode) errors.stateCode = 'Please select a state.';
    
    // Merge with any existing async validation errors (like email)
    setValidationErrors(currentErrors => ({ ...currentErrors, ...errors }));
    
    // Check if there are any errors in the non-email fields
    return Object.keys(errors).length === 0;
  };

  // --- Handlers ---
  const handleSendCode = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setError('');
    setSuccessMessage('');

    const otherFieldsValid = validateStep1();

    // The primary gate: all fields must be valid AND the email must be confirmed as available.
    if (!otherFieldsValid || isEmailAvailable !== true || cooldown > 0) {
        // If the user clicks submit while the email is invalid, ensure the error is visible.
        if (email && !validationErrors.email) {
            checkEmailAvailability(email);
        }
        return;
    }

    setLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (otpError) {
      setError(otpError.message);
    } else {
      setStep(2);
      setCooldown(60);
      setSuccessMessage('Code sent — check your email.');
    }
    setLoading(false);
  };
  
  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }
    
    if (data.session?.user) {
      const user = data.session.user;
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .single();
        
      if (!profile) {
        const { error: insertError } = await supabase.from('profiles').insert({
          user_id: user.id,
          email: user.email,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          role: UserRole.User,
          company_id: companyId || null,
          job_title_id: jobTitleId || null,
          location_id: locationId || null,
          state_code: stateCode || null,
        });

        if (insertError) {
          setError(`Error creating profile: ${insertError.message}`);
          await supabase.auth.signOut();
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        navigate('/dashboard', { replace: true });
      }
    } else {
      setError('An unknown error occurred during verification.');
    }
    setLoading(false);
  };
  
  const inputClasses = "w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/60 focus:ring-2 focus:ring-white/50 outline-none transition disabled:opacity-50";
  const selectClasses = `${inputClasses} appearance-none bg-no-repeat bg-right pr-8`;
  const selectIcon = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;
  const auroraButtonClasses = "aurora-btn relative mt-4 inline-flex w-full items-center justify-center px-10 py-3 rounded-2xl font-semibold tracking-wide text-sm md:text-base text-white overflow-hidden backdrop-blur-xl bg-white/10 border border-white/20 shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-500 hover:-translate-y-0.5 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 border-[#90BB47]/70 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";

  return (
    <>
      <div className="relative min-h-screen overflow-hidden -m-8">
        <div className="absolute inset-0 animate-gradient-bg bg-[radial-gradient(120%_120%_at_0%_0%,_#030037_0%,_#153AC7_50%,_#0084FF_100%)]"></div>
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"></div>
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[36rem] w-[36rem] rounded-full bg-white/10 blur-[100px]"></div>
        <div className="h-24"></div>
        <main className="relative z-10 flex items-center justify-center px-6 pb-16">
          <section className="w-full max-w-2xl rounded-3xl border border-white/25 bg-white/10 backdrop-blur-xl shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-3xl bg-gradient-to-b from-white/40 to-transparent opacity-90" />
            <div className="relative px-8 py-10">
              
              <div className="flex items-center justify-center space-x-2 mb-6">
                  <div className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${step === 1 ? 'bg-secondary text-white' : 'bg-white/10 text-white/70'}`}>1 Details</div>
                  <div className="flex-grow h-px bg-white/20"></div>
                  <div className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${step === 2 ? 'bg-secondary text-white' : 'bg-white/10 text-white/70'}`}>2 Verify</div>
              </div>

              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
                  {step === 1 ? 'Create Account' : 'Verify Email'}
                </h1>
                <p className="text-white/80 mt-1">
                  {step === 1 ? 'Step 1 of 2 — Your details' : `Step 2 of 2 — Enter 6-digit code sent to ${email}`}
                </p>
              </div>

              {error && <div className="bg-red-500/30 border border-red-500/50 text-white p-4 rounded-lg mb-6 flex items-center text-sm" role="alert"><ErrorIcon />{error}</div>}
              {successMessage && step === 2 && <div className="bg-green-500/30 border border-green-500/50 text-white p-4 rounded-lg mb-6 flex items-center text-sm" role="alert"><CheckIcon />{successMessage}</div>}

              {step === 1 ? (
                <form onSubmit={handleSendCode} noValidate>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-8">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-white/90 mb-1">First Name</label>
                      <input id="firstName" type="text" placeholder="Jane" value={firstName} onChange={(e) => setFirstName(e.target.value)} onBlur={() => validateStep1()} disabled={loading} aria-invalid={!!validationErrors.firstName} className={inputClasses} />
                      {validationErrors.firstName && <p className="text-red-400 text-xs mt-1">{validationErrors.firstName}</p>}
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-white/90 mb-1">Last Name</label>
                      <input id="lastName" type="text" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} onBlur={() => validateStep1()} disabled={loading} aria-invalid={!!validationErrors.lastName} className={inputClasses} />
                      {validationErrors.lastName && <p className="text-red-400 text-xs mt-1">{validationErrors.lastName}</p>}
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-1">Email Address</label>
                      <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => checkEmailAvailability(email)} disabled={loading} aria-invalid={!!validationErrors.email} className={inputClasses} />
                      <div className="h-4 mt-1">
                          {validationErrors.email && <p className="text-red-400 text-xs">{validationErrors.email}</p>}
                          {!validationErrors.email && checkingEmail && <p className="text-white/60 text-xs">Checking availability...</p>}
                          {!validationErrors.email && isEmailAvailable === true && <p className="text-green-400 text-xs">Email is available!</p>}
                      </div>
                    </div>

                    {(['companyId', 'jobTitleId', 'locationId', 'stateCode'] as const).map(key => {
                      const optionsMap = { companyId: companies, jobTitleId: jobTitles, locationId: locations, stateCode: states };
                      const labelMap = { companyId: 'Company', jobTitleId: 'Job Title', locationId: 'Location', stateCode: 'State (AU)' };
                      const valueMap = { companyId, jobTitleId, locationId, stateCode };
                      const setterMap = { companyId: setCompanyId, jobTitleId: setJobTitleId, locationId: setLocationId, stateCode: setStateCode };
                      const keyField = key === 'stateCode' ? 'code' : 'id';
                      
                      return (
                        <div key={key}>
                          <label htmlFor={key} className="block text-sm font-medium text-white/90 mb-1">{labelMap[key]}</label>
                          <select
                            id={key} value={valueMap[key]} onChange={(e) => setterMap[key](e.target.value)}
                            onBlur={() => validateStep1()}
                            disabled={loading || dropdownsLoading}
                            aria-invalid={!!validationErrors[key]}
                            className={selectClasses}
                            style={{ backgroundImage: selectIcon }}
                          >
                            <option value="" disabled>{dropdownsLoading ? 'Loading...' : `Select ${labelMap[key]}...`}</option>
                            {optionsMap[key].map((option: any) => (
                              <option key={option[keyField]} value={option[keyField]} className="text-black">{option.name}</option>
                            ))}
                          </select>
                          {validationErrors[key] && <p className="text-red-400 text-xs mt-1">{validationErrors[key]}</p>}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
                    <Link to="/login" className="text-sm text-white/70 hover:text-white hover:underline">
                      Back to Login
                    </Link>
                    <button type="submit" className={auroraButtonClasses} disabled={loading || dropdownsLoading || isEmailAvailable !== true}>
                      <span className="relative z-10 flex items-center">{loading ? <><Spinner /> Sending...</> : 'Send Sign Up Code'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <div className="mb-6 flex justify-center">
                    <OtpCodeInput value={otp} onChange={setOtp} disabled={loading} inputClassName="otp-input"/>
                  </div>
                  <button type="submit" className={auroraButtonClasses} disabled={loading || otp.length < 6}>
                    <span className="relative z-10 flex items-center">{loading ? <><Spinner /> Verifying...</> : 'Verify & Create Account'}</span>
                  </button>
                  <div className="text-center mt-6 text-sm">
                    <button type="button" onClick={() => handleSendCode()} disabled={cooldown > 0 || loading} className="text-white/70 hover:text-white hover:underline disabled:text-white/40 disabled:cursor-not-allowed">
                      Resend Code {cooldown > 0 ? `in ${cooldown}s` : ''}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </main>
      </div>
       <style>{`
        .otp-input {
          background-color: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
          color: white;
        }
        .otp-input:focus {
          border-color: rgba(255, 255, 255, 0.6);
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
        }
        @keyframes gradientShift {
          0%   { transform: translate3d(0,0,0) scale(1); }
          50%  { transform: translate3d(-2%, -1%, 0) scale(1.02); }
          100% { transform: translate3d(0,0,0) scale(1); }
        }
        .animate-gradient-bg {
          animation: gradientShift 18s ease-in-out infinite;
        }
        @keyframes auroraMove {
          0% { transform: translate3d(-50%, -60%, 0) rotate(0deg); }
          50% { transform: translate3d(0%, -20%, 0) rotate(45deg); }
          100% { transform: translate3d(50%, -60%, 0) rotate(90deg); }
        }

        .aurora-btn::before {
          content: "";
          position: absolute;
          inset: -40%;
          border-radius: inherit;
          background: conic-gradient(
            from 180deg at 50% 50%,
            #0084ff,
            #90bb47,
            #153ac7,
            #0084ff
          );
          filter: blur(18px) brightness(1.4);
          animation: auroraMove 8s ease-in-out infinite alternate;
          opacity: 0.9;
        }

        .aurora-btn::after {
          content: "";
          position: absolute;
          inset: 2px;
          border-radius: inherit;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(8px);
          transition: all 0.5s ease;
          box-shadow:
            inset 0 0 8px rgba(255, 255, 255, 0.15),
            inset 0 0 20px rgba(255, 255, 255, 0.05);
        }

        .aurora-btn:hover::after {
          background: rgba(255, 255, 255, 0.16);
          backdrop-filter: blur(14px);
          box-shadow:
            inset 0 0 12px rgba(255, 255, 255, 0.25),
            inset 0 0 28px rgba(255, 255, 255, 0.12);
        }
      `}</style>
    </>
  );
}