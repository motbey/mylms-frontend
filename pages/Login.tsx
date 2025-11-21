import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getUserAndRole, redirectByRole } from '../lib/auth';
import OtpCodeInput from '../components/OtpCodeInput';

export default function Login() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1 for email, 2 for OTP
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { user, role } = await getUserAndRole();
      if (user && role) {
        navigate(redirectByRole(role), { replace: true });
      }
    };
    checkSession();
  }, [navigate]);
  
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendCode = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setError('');
    if (cooldown > 0) return;

    setLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (otpError) {
      setError(otpError.message);
    } else {
      setStep(2);
      setCooldown(60);
    }
    setLoading(false);
  };
  
  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });

    if (verifyError) {
      setError(verifyError.message);
    } else if (data.session) {
      // Verification successful, now get role and redirect
      const { role } = await getUserAndRole();
      navigate(redirectByRole(role), { replace: true });
    } else {
      setError('An unknown error occurred during verification.');
    }
    setLoading(false);
  };
  
  const auroraButtonClasses = "aurora-btn relative mt-4 inline-flex w-full items-center justify-center px-10 py-3 rounded-2xl font-semibold tracking-wide text-sm md:text-base text-white overflow-hidden backdrop-blur-xl bg-white/10 border border-white/20 shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-500 hover:-translate-y-0.5 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 border-[#0084FF]/70 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";

  return (
    <>
      <div className="relative min-h-screen overflow-hidden -m-8">
        {/* Animated gradient background */}
        <div className="absolute inset-0 animate-gradient-bg bg-[radial-gradient(120%_120%_at_0%_0%,_#030037_0%,_#153AC7_50%,_#0084FF_100%)]"></div>

        {/* Soft glows */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"></div>
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[36rem] w-[36rem] rounded-full bg-white/10 blur-[100px]"></div>

        {/* Spacer so we sit below the navbar */}
        <div className="h-24"></div>

        {/* Centered glass card */}
        <main className="relative z-10 flex items-center justify-center px-6 pb-16">
          <section className="page-dissolve-in w-full max-w-md rounded-3xl border border-white/25 bg-white/10 backdrop-blur-2xl shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-3xl bg-gradient-to-b from-white/40 to-transparent opacity-90" />
            <div className="relative px-8 py-10">
              
              <h1 className="mb-2 text-center text-2xl md:text-3xl font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
                {step === 1 ? 'User Login' : 'Verify Code'}
              </h1>
               <p className="text-center text-white/80 mb-6 text-sm">
                {step === 1 ? 'Enter your email to receive a login code.' : `A 6-digit code was sent to ${email}`}
              </p>

              {step === 1 ? (
                <form onSubmit={handleSendCode}>
                  <div className="mb-4">
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-white/90">Email address</label>
                    <input
                      id="email"
                      className="w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-white placeholder:text-white/60 focus:border-white/60 focus:ring-2 focus:ring-white/50 outline-none transition disabled:opacity-50"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <button type="submit" className={auroraButtonClasses} disabled={loading}>
                    <span className="relative z-10">{loading ? 'Sending Code...' : 'Send Login Code'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                   <div className="mb-6">
                      <OtpCodeInput
                          value={otp}
                          onChange={setOtp}
                          disabled={loading}
                          inputClassName="otp-input"
                      />
                  </div>
                  <button type="submit" className={auroraButtonClasses} disabled={loading || otp.length < 6}>
                    <span className="relative z-10">{loading ? 'Verifying...' : 'Verify & Sign In'}</span>
                  </button>
                   <div className="text-center mt-4 text-sm">
                      <button
                          type="button"
                          onClick={() => handleSendCode()}
                          disabled={cooldown > 0 || loading}
                          className="text-white/70 hover:text-white hover:underline disabled:text-white/40 disabled:cursor-not-allowed transition"
                      >
                          Resend Code {cooldown > 0 ? `(${cooldown}s)` : ''}
                      </button>
                   </div>
                </form>
              )}
              {error && <p className="text-white text-sm mt-4 text-center bg-red-500/30 p-3 rounded-lg border border-red-500/50">{error}</p>}

            </div>
          </section>
        </main>
        <div className="h-12"></div>
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
        
        @keyframes dissolveIn {
          0%   { opacity: 0; filter: blur(10px);  transform: scale(1.02); }
          100% { opacity: 1; filter: blur(0px);   transform: scale(1); }
        }

        .page-dissolve-in {
          animation: dissolveIn 450ms ease forwards;
        }
      `}</style>
    </>
  );
}